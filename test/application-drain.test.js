"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const http=require("node:http"),{once}=require("node:events");
const {setTimeout:delay}=require("node:timers/promises");
const express=require("express"),{WebSocketServer,WebSocket}=require("ws");
const {trackApplicationHandlers,waitUntilDrained,closeWebSockets}=require("../src/application-drain");

async function listen(t,app){
  const server=http.createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");
  t.after(()=>{server.closeAllConnections();server.close()});
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}

test("disconnected HTTP handlers remain owned until their final write",async t=>{
  const route=express.application.route,use=express.application.use;
  const app=express(),tracker=trackApplicationHandlers(app);
  let release,entered,write=false;
  const started=new Promise(resolve=>{entered=resolve});
  const blocked=new Promise(resolve=>{release=resolve});
  app.post("/write",async(_req,res)=>{entered();await blocked;write=true;res.end()});
  const {server,url}=await listen(t,app);
  const req=http.request(url+"/write",{method:"POST"});req.on("error",()=>{});req.end();
  await started;req.destroy();
  await new Promise(resolve=>server.close(resolve));
  assert.equal(tracker.pending,1);assert.equal(write,false);
  release();await waitUntilDrained(()=>tracker.pending===0);assert.equal(write,true);
  assert.equal(express.application.route,route);assert.equal(express.application.use,use);
});

test("registration retains nested guards, route chains, settings and async error handling",async t=>{
  const app=express(),tracker=trackApplicationHandlers(app);app.set("test-value","kept");
  app.use(async(_req,_res,next)=>{await delay(1);next()});
  app.route("/guarded").get([(_req,_res,next)=>next("route")],()=>assert.fail("skipped route"));
  app.get("/guarded",[async()=>{await delay(1);throw Error("expected")}]);
  app.use(async(error,_req,res,_next)=>{await delay(1);res.status(409).json({error:error.message})});
  const {url}=await listen(t,app),response=await fetch(url+"/guarded");
  assert.equal(response.status,409);assert.deepEqual(await response.json(),{error:"expected"});
  await waitUntilDrained(()=>tracker.pending===0);assert.equal(app.get("test-value"),"kept");
});

test("an aborted body retains ordinary cleanup but cannot start a new writer during shutdown",async t=>{
  for(const stopping of [false,true]){
    const app=express();trackApplicationHandlers(app,{isStopping:()=>stopping});
    let entered,afterAbort,handled=false;
    const started=new Promise(resolve=>{entered=resolve});
    const aborted=new Promise(resolve=>{afterAbort=resolve});
    app.use((req,_res,next)=>{
      req.resume();entered();
      req.once("aborted",()=>setImmediate(()=>{next();afterAbort()}));
    });
    app.post("/upload",()=>{handled=true});
    const {url}=await listen(t,app);
    const req=http.request(url+"/upload",{method:"POST",headers:{"Transfer-Encoding":"chunked"}});
    req.on("error",()=>{});req.write("partial body");
    await started;req.destroy();await aborted;
    assert.equal(handled,!stopping);
  }
});

test("WebSocket drain bounds an unresponsive peer and waits for disconnect writes",async t=>{
  const {server,url}=await listen(t,express()),wss=new WebSocketServer({server});
  let closed=false;
  wss.on("connection",socket=>socket.on("close",()=>{closed=true}));
  const client=new WebSocket(url.replace("http:","ws:"));t.after(()=>client.terminate());await once(client,"open");
  client._socket.pause(); // A real peer which cannot read/acknowledge the close frame.
  await closeWebSockets(wss);
  assert.equal(closed,true);assert.equal(wss.clients.size,0);
});

test("queued announcement work retains ownership and continues after a failed predecessor",async()=>{
  const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
  const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
  const context=vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("let morningAnnouncementsLifecycle="),source.indexOf("function restartMorningAnnouncementsWatcher")),context);
  let release;const writes=[];
  const gate=new Promise(resolve=>{release=resolve});
  const first=context.serializeMorningAnnouncementsLifecycle(async()=>{await gate;throw Error("expected")});
  const failed=assert.rejects(first,/expected/);
  const second=context.serializeMorningAnnouncementsLifecycle(async()=>{writes.push("final-write")});
  assert.equal(vm.runInContext("morningAnnouncementsLifecycleBusy",context),2);
  release();await failed;await second;
  assert.deepEqual(writes,["final-write"]);assert.equal(vm.runInContext("morningAnnouncementsLifecycleBusy",context),0);
});
