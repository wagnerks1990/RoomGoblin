"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n"),a=source.indexOf("let musicAssistantTvBridgeWrites="),b=source.indexOf('\napp.get("/api/v1/database/status"',a);assert.ok(a>0&&b>a);
const flush=()=>new Promise(setImmediate);
function fixture(){
 let route,token="fixture",failWrite=false;const calls=[],prefs=new Map(),tickets=[];
 const c=vm.createContext({app:{post:(_p,...args)=>route=args.at(-1)},musicAssistantMutationLimit(){},requireControl(){},maApiGeneration:0,musicAssistantConfig:()=>({url:"http://fixture.invalid"}),musicAssistantToken:()=>token,resolveDisplayTargets:v=>Array.isArray(v)?v:[v],
 dbStore:{getPreference:(k,f)=>prefs.has(k)?prefs.get(k):f,setPreference:(k,v)=>{if(failWrite)throw Error("storage unavailable");prefs.set(k,v)}},
 executeCommand:(command,source,options)=>new Promise((resolve,reject)=>calls.push({command,source,options,resolve:()=>resolve({deliveries:{websocket:Array.isArray(command.target)?command.target:[command.target]}}),reject})),
 issueMusicAssistantProxyTicket:id=>{tickets.push(id);return {playerId:"classroom-hub-"+id,ticket:"fixture-ticket"}},musicAssistantTvAttachPayload:(_id,issued)=>({playerId:issued.playerId})});
 vm.runInContext(source.slice(a,b),c);
 return {c,calls,prefs,tickets,noToken:()=>{token=""},failWrites:()=>{failWrite=true},allowWrites:()=>{failWrite=false},attached:()=>Array.from(prefs.get("musicassistant.tvBridgeTargets")||[]),
 async send(action,targets){let status=200,body;const res={status(v){status=v;return res},json(v){body=JSON.parse(JSON.stringify(v));return res}};await route({body:{action,targets}},res);return {status,body}}};
}
test("overlapping attach and detach retain accepted command and preference order",async()=>{
 const h=fixture(),p=h.send("attach",["tv1","front-screen"]),q=h.send("detach",["front-screen"]);await flush();assert.equal(h.calls.length,1);
 h.calls[0].resolve();await flush();assert.equal(h.calls.length,2);assert.equal(h.calls[1].command.type,"music.assistant.attach");h.calls[1].resolve();assert.equal((await p).status,200);await flush();
 assert.equal(h.calls.length,3);assert.equal(h.calls[2].command.type,"music.assistant.detach");h.calls[2].resolve();const r=await q;assert.equal(r.status,200);assert.deepEqual(h.attached(),["tv1"]);assert.deepEqual(r.body.attachedTargets,["tv1"]);assert.equal(h.calls[0].options.expectedMusicAssistantGeneration,0);
});
test("queued attachments merge against the latest committed desired targets",async()=>{
 const h=fixture(),p=h.send("attach",["tv1"]),q=h.send("attach",["front-screen"]);await flush();h.calls[0].resolve();await p;await flush();h.calls[1].resolve();await q;assert.deepEqual(h.attached(),["tv1","front-screen"]);
});
test("unknown action is rejected without preference writes or dispatch",async()=>{
 const h=fixture(),r=await h.send("unexpected",["tv1"]);assert.equal(r.status,400);assert.equal(h.calls.length,0);assert.equal(h.prefs.size,0);assert.equal(h.tickets.length,0);
});
test("missing token rejects a queued change without persistence",async()=>{
 const h=fixture();h.noToken();const r=await h.send("attach",["tv1"]);assert.equal(r.status,409);assert.equal(h.calls.length,0);assert.equal(h.prefs.size,0);
});
test("connection replacement stops remaining targets and retires queued old work",async()=>{
 const h=fixture(),p=h.send("attach",["tv1","front-screen"]),q=h.send("detach",["tv1"]);await flush();h.c.maApiGeneration++;h.calls[0].resolve();assert.equal((await p).status,409);assert.equal((await q).status,409);assert.equal(h.calls.length,1);assert.deepEqual(h.tickets,["tv1"]);
});
test("connection retirement before queue admission performs no mutation",async()=>{
 const h=fixture(),p=h.send("attach",["tv1"]);h.c.maApiGeneration++;assert.equal((await p).status,409);assert.equal(h.calls.length,0);assert.equal(h.prefs.size,0);
});
test("failed dispatch stays visible and releases the next explicit operation",async()=>{
 const h=fixture(),p=h.send("attach",["tv1"]),q=h.send("detach",["tv1"]);await flush();h.calls[0].reject(Object.assign(Error("uncertain delivery"),{mayHaveExecuted:true}));assert.equal((await p).status,400);await flush();assert.equal(h.calls.length,2);assert.equal(h.calls[1].command.type,"music.assistant.detach");h.calls[1].resolve();assert.equal((await q).status,200);assert.deepEqual(h.attached(),[]);
});
test("retired delivery error reports refresh without a stale connection error",async()=>{
 const h=fixture(),p=h.send("attach",["tv1"]);await flush();h.c.maApiGeneration++;h.calls[0].reject(Error("old connection"));const r=await p;assert.equal(r.status,409);assert.match(r.body.error,/Refresh/);assert.equal(h.calls.length,1);
});
test("persistence failure sends nothing and permits a fresh explicit retry",async()=>{
 const h=fixture();h.failWrites();const r=await h.send("attach",["tv1"]);assert.equal(r.status,400);assert.equal(h.calls.length,0);h.allowWrites();const p=h.send("attach",["tv1"]);await flush();h.calls[0].resolve();assert.equal((await p).status,200);
});
test("long receiver IDs and the omitted-action compatibility default remain intact",async()=>{
 const h=fixture(),id="display-"+("a".repeat(70)),p=h.send(undefined,[id]);await flush();assert.equal(h.calls[0].command.target,id);assert.equal(h.calls[0].command.payload.playerId,"classroom-hub-"+id);h.calls[0].resolve();const r=await p;assert.equal(r.body.action,"attach");assert.deepEqual(r.body.attachedTargets,[id]);
});
test("returned handler lifetime includes every accepted target delivery",async()=>{
 const h=fixture();let done=false;const p=h.send("attach",["tv1","front-screen"]).then(r=>{done=true;return r});await flush();assert.equal(done,false);h.calls[0].resolve();await flush();assert.equal(done,false);h.calls[1].resolve();await p;assert.equal(done,true);
});
test("detach retains unrelated desired bridge targets",async()=>{
 const h=fixture();h.prefs.set("musicassistant.tvBridgeTargets",["tv1","front-screen"]);const p=h.send("detach",["tv1"]);await flush();h.calls[0].resolve();const r=await p;assert.deepEqual(r.body.attachedTargets,["front-screen"]);assert.equal(h.tickets.length,0);
});
