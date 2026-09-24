"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),http=require("node:http"),crypto=require("node:crypto");
const source=fs.readFileSync(require.resolve("../src/server.js"),"utf8");
const start=source.indexOf("let maApiSocket="),end=source.indexOf("\n\n\n//",start);

function fixture(overrides={}){
  const timers=[],sent=[],requests=[];
  const socket={readyState:1,send:raw=>sent.push(JSON.parse(raw)),close(){}};
  const context=vm.createContext({URL,Buffer,crypto,AbortSignal,WebSocket:{OPEN:1},
    musicAssistantConfig:()=>({url:"http://fixture.invalid"}),musicAssistantToken:()=>"fixture-token",
    diagnosticError(){},setTimeout:(fn,ms)=>{const timer={fn,ms};timers.push(timer);return timer},clearTimeout:t=>{t.cleared=true},
    fetch:async(...args)=>{requests.push(args);return {ok:true,status:200,text:async()=>"null"}},...overrides});
  vm.runInContext(source.slice(start,end),context);
  context.socket=socket;
  vm.runInContext("ensureMusicAssistantApi=async()=>{};maApiSocket=socket",context);
  return {context,timers,sent,requests,socket};
}

test("HTTP compatibility accepts real null, array, scalar and wrapped command results",async t=>{
  let body="null",status=200;
  const server=http.createServer((req,res)=>{
    assert.equal(req.headers.authorization,"Bearer fixture-token");
    req.resume();res.writeHead(status,{"content-type":"application/json"});res.end(body);
  }).listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  const f=fixture({fetch,musicAssistantConfig:()=>({url:`http://127.0.0.1:${server.address().port}`})});
  for(const value of [null,[],false,0,"ok",{player_id:"fixture"},{result:null},{result:false}]){
    body=JSON.stringify(value);
    assert.equal(JSON.stringify(await f.context.musicAssistantHttpCommand("players/cmd/pause")),JSON.stringify(value&&Object.hasOwn(value,"result")?value.result:value));
  }
  for(const value of [null,{error:"denied"},{error:{message:"denied"}},{error_code:0,details:"denied"}]){
    body=JSON.stringify(value);status=value===null?503:200;
    await assert.rejects(f.context.musicAssistantHttpCommand("players/all"),/Music Assistant HTTP 503|denied/);
  }
  body="upstream-private-response";status=502;
  await assert.rejects(f.context.musicAssistantHttpCommand("players/all"),e=>/HTTP 502/.test(e.message)&&!e.message.includes(body));
});

test("playback waits through provider backoff without replaying an uncertain command",async()=>{
  const f=fixture();
  const request=f.context.musicAssistantCommand("player_queues/play_media",{queue_id:"fixture",media:"fixture://track"});
  const rejected=assert.rejects(request,e=>e.mayHaveExecuted===true&&/timed out/.test(e.message));
  await Promise.resolve();await Promise.resolve();
  assert.equal(f.timers[0].ms,60000);assert.equal(f.sent.length,1);
  f.timers[0].fn();await rejected;
  assert.equal(f.requests.length,0);
  assert.equal(vm.runInContext("maApiPending.size",f.context),0);
});

test("pause and stop retain short deadlines and disconnections do not duplicate mutations",async()=>{
  for(const command of ["players/cmd/pause","players/cmd/stop"]){
    const f=fixture(),request=f.context.musicAssistantCommand(command,{player_id:"fixture"});
    const rejected=assert.rejects(request,e=>e.mayHaveExecuted===true);
    await Promise.resolve();await Promise.resolve();
    assert.equal(f.timers[0].ms,15000);
    f.context.rejectMusicAssistantPending("disconnected");await rejected;
    assert.equal(f.requests.length,0);assert.equal(f.timers[0].cleared,true);
  }
});

test("read-only polling can fall back after timeout; unsent writes can use HTTP",async()=>{
  const f=fixture(),request=f.context.musicAssistantCommand("players/all");
  await Promise.resolve();await Promise.resolve();
  f.timers[0].fn();assert.equal(await request,null);assert.equal(f.requests.length,1);
  const g=fixture();g.socket.readyState=3;
  assert.equal(await g.context.musicAssistantCommand("players/cmd/pause"),null);
  assert.equal(g.sent.length,0);assert.equal(g.requests.length,1);
});

test("successful WebSocket replies clear the timer and preserve null results",async()=>{
  const f=fixture(),request=f.context.musicAssistantCommand("players/cmd/play");
  await Promise.resolve();await Promise.resolve();
  f.context.musicAssistantApiHandleMessage(JSON.stringify({message_id:f.sent[0].message_id,result:null}));
  assert.equal(await request,null);assert.equal(f.timers[0].cleared,true);assert.equal(f.requests.length,0);
});
