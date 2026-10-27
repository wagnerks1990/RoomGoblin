"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const http=require("node:http");
const express=require("express");
const {trackApplicationHandlers,waitUntilDrained}=require("../src/application-drain");
const {setTimeout:delay}=require("node:timers/promises");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const transportPath=path.join(__dirname,"../src/pluto-transport.js");
const transport=fs.existsSync(transportPath)?require(transportPath):{};
const plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing production boundary: ${start}`);
  return source.slice(a,b);
}
function harness({fetchImpl,budgetMs=1000,cacheMs=20,timeoutMs=100,readRetries=0,clock}={}){
  const calls=[],routes=new Map(),audits=[];
  const ctx=vm.createContext({
    AbortController,AbortSignal,Date,Buffer,setTimeout,clearTimeout,
    PLUTO_URL:"http://127.0.0.1:1/test-matrix",PLUTO_TIMEOUT_MS:timeoutMs,PLUTO_READ_RETRIES:readRetries,
    PLUTO_STATUS_BUDGET_MS:budgetMs,
    plutoAbortableDelay:delay,readPlutoResponse:transport.readPlutoResponse,
    createPlutoStatusReader:read=>transport.createPlutoStatusReader(read,{budgetMs,cacheMs,clock}),
    runtime:{hardware:{pluto:{}}},avLabels:{inputs:["Source"]},
    audit:entry=>audits.push(entry),diagnosticError:()=>{},requireClassroomRead:()=>{},
    app:{get:(url,...handlers)=>routes.set(url,handlers.at(-1))},
    fetch:async(url,options)=>{
      const body=JSON.parse(options.body);calls.push(body);
      return fetchImpl?fetchImpl(body,options,calls):Response.json({...body,allsource:[1]});
    }
  });
  vm.runInContext(section("function plutoBuild(","async function runLightingCommand")+"\n"+
    section('app.get("/api/v1/pluto/status"','app.get("/api/v1/pluto/labels"'),ctx);
  return {calls,audits,ctx,handler:routes.get("/api/v1/pluto/status"),
    direct:action=>ctx.directPluto(action),invalidate:()=>vm.runInContext("plutoStatusReader.invalidate()",ctx),async status(){
    let code=200,result;
    const res={status:value=>{code=value;return res},json:value=>{result=plain(value)}};
    await routes.get("/api/v1/pluto/status")({},res);
    return {code,...result};
  }};
}

test("concurrent matrix status readers share one serial six-query scan",async()=>{
  const h=harness();
  const results=await Promise.all([h.status(),h.status(),h.status()]);
  assert.equal(h.calls.length,6);
  assert.ok(results.every(result=>result.ok&&result.code===200));
  assert.deepEqual(results[0],results[1]);
});

test("aggregate matrix deadline cancels a stuck transport and prevents later probes",async()=>{
  const h=harness({budgetMs:60,fetchImpl:(_body,{signal})=>new Promise((_resolve,reject)=>{
    signal.addEventListener("abort",()=>reject(signal.reason),{once:true});
  })});
  const result=await h.status();
  assert.equal(result.code,207);
  assert.equal(result.ok,false);
  assert.equal(h.calls.length,1);
  for(const action of ["videoStatus","outputStatus","inputStatus","cecStatus","systemStatus","networkStatus"])
    assert.match(result[action].error,/budget/i);
});

test("status caches briefly using monotonic time but labels remain current",async()=>{
  let now=10;
  const h=harness({clock:()=>now});
  const first=await h.status();
  assert.match(first.observedAt,/^\d{4}-/);
  h.ctx.avLabels={inputs:["Renamed source"]};
  now=29;
  const cached=await h.status();
  assert.equal(h.calls.length,6);
  assert.equal(cached.labels.inputs[0],"Renamed source");
  now=30;await h.status();
  assert.equal(h.calls.length,12);
});

test("an unconfigured optional matrix fails without transport or retries",async()=>{
  const h=harness({readRetries:4});h.ctx.PLUTO_URL="";
  const result=await h.status();
  assert.equal(h.calls.length,0);
  assert.equal(result.code,207);
  assert.match(result.videoStatus.error,/not configured/);
});

test("aggregate budget interrupts stale-response retry backoff",async()=>{
  const h=harness({budgetMs:60,readRetries:4,fetchImpl:()=>Response.json({comhead:"stale"})});
  const result=await h.status();
  assert.equal(h.calls.length,1);
  assert.match(result.videoStatus.error,/budget/);
  assert.equal(result.code,207);
  assert.match(h.ctx.runtime.hardware.pluto.lastError,/budget/);
});

test("named reads used outside the status scan also have a total retry budget",async()=>{
  const h=harness({budgetMs:60,readRetries:4,fetchImpl:()=>Response.json({comhead:"stale"})});
  await assert.rejects(h.direct({action:"videoStatus"}),/budget/);
  assert.equal(h.calls.length,1);
});

test("status deadline covers a real HTTP body that never finishes",async(t)=>{
  const server=http.createServer((_req,res)=>{res.writeHead(200,{"Content-Type":"application/json"});res.write('{"comhead":');});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve))});
  const h=harness({budgetMs:150,timeoutMs:2000,fetchImpl:(_body,options)=>fetch(`http://127.0.0.1:${server.address().port}`,options)});
  const result=await h.status();
  assert.equal(h.calls.length,1);
  assert.match(result.videoStatus.error,/budget/);
  assert.equal(result.code,207);
});

test("per-attempt timeouts retry reads within the aggregate budget",async()=>{
  const h=harness({timeoutMs:20,readRetries:1,fetchImpl:(body,{signal},calls)=>{
    if(calls.length===1)return new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));
    return Response.json(body);
  }});
  assert.equal((await h.status()).ok,true);
  assert.equal(h.calls.length,7);
});

test("uncertain and rejected writes stay single-attempt and invalidate status",async()=>{
  let outcome="rejected";
  const h=harness({readRetries:4,fetchImpl:body=>{
    if(body.comhead==="video switch"){
      if(outcome==="timeout")throw new Error("Uncertain delivery");
      return Response.json(outcome==="rejected"?{comhead:body.comhead,result:0}:{comhead:"stale"});
    }
    return Response.json(body);
  }});
  await h.status();
  assert.equal((await h.direct({action:"route",output:1,input:2})).ok,false);
  await h.status();
  assert.equal(h.calls.length,13);
  outcome="stale";
  assert.equal((await h.direct({action:"route",output:1,input:2})).pendingVerify,true);
  outcome="timeout";
  await assert.rejects(h.direct({action:"route",output:1,input:2}),/Uncertain delivery/);
  assert.equal(h.calls.filter(body=>body.comhead==="video switch").length,3);
  await h.status();assert.equal(h.calls.length,21);
});

test("connection invalidation aborts an old scan and does not cache it",async()=>{
  let started,stall=true;
  const ready=new Promise(resolve=>{started=resolve});
  const h=harness({fetchImpl:(body,{signal})=>{
    if(!stall)return Response.json(body);
    started();return new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));
  }});
  const pending=h.status();await ready;h.invalidate();
  const stale=await pending;
  assert.equal(h.calls.length,1);
  assert.match(stale.videoStatus.error,/connection change/);
  stall=false;assert.equal((await h.status()).ok,true);
  assert.equal(h.calls.length,7);
});

test("a command interrupts an older status scan without retrying the write",async()=>{
  let started,stall=true;
  const ready=new Promise(resolve=>{started=resolve});
  const h=harness({fetchImpl:(body,{signal})=>{
    if(body.comhead==="video switch")return Response.json({...body,result:1});
    if(!stall)return Response.json(body);
    started();return new Promise((_resolve,reject)=>signal.addEventListener("abort",()=>reject(signal.reason),{once:true}));
  }});
  const pending=h.status();await ready;
  assert.equal((await h.direct({action:"route",output:1,input:2})).ok,true);
  assert.equal((await pending).ok,false);
  assert.equal(h.calls.length,2);
  stall=false;assert.equal((await h.status()).ok,true);
  assert.equal(h.calls.length,8);
});

test("disconnected status readers retain their returned lifecycle promise",async(t)=>{
  let started,release;
  const ready=new Promise(resolve=>{started=resolve}),gate=new Promise(resolve=>{release=resolve});
  const h=harness({fetchImpl:async body=>{started();await gate;return Response.json(body)}});
  const app=express(),tracking=trackApplicationHandlers(app);
  app.get("/status",h.handler);
  const server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>{release();server.closeAllConnections();return new Promise(resolve=>server.close(resolve))});
  const controller=new AbortController();
  const request=fetch(`http://127.0.0.1:${server.address().port}/status`,{signal:controller.signal});
  const rejected=assert.rejects(request,/abort/i);
  await ready;controller.abort();await rejected;
  assert.equal(tracking.pending,1);
  release();await waitUntilDrained(()=>tracking.pending===0);
  assert.equal(h.calls.length,6);
});

test("bounded matrix parser rejects declared and streamed oversized bodies",async()=>{
  let cancelled=0;
  const declared=new Response(new ReadableStream({cancel(){cancelled++}}),{headers:{"Content-Length":String(transport.MAX_RESPONSE_BYTES+1)}});
  await assert.rejects(transport.readPlutoResponse(declared),/64 KiB/);
  assert.equal(cancelled,1);
  const streamed=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(transport.MAX_RESPONSE_BYTES+1))},cancel(){cancelled++}}));
  await assert.rejects(transport.readPlutoResponse(streamed),/64 KiB/);
  assert.equal(cancelled,2);
  for(const body of ["<html>private upstream text</html>","null","[]"])
    await assert.rejects(transport.readPlutoResponse(new Response(body)),/invalid/);
});
