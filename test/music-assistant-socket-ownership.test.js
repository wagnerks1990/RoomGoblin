"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),crypto=require("node:crypto"),{EventEmitter}=require("node:events");
const source=fs.readFileSync(require.resolve("../src/server.js"),"utf8").replace(/\r\n/g,"\n"),start=source.indexOf("let maApiSocket="),end=source.indexOf("\n\n\n//",start);
function fixture(){
 const sockets=[],timers=[],requests=[],controls={token:"fixture-token",constructorFailure:false,sendFailure:false};
 class Socket extends EventEmitter{static OPEN=1;constructor(url){super();if(controls.constructorFailure)throw Error("constructor failed");this.url=url;this.readyState=1;this.sent=[];sockets.push(this)}send(raw){if(controls.sendFailure)throw Error("send failed");this.sent.push(JSON.parse(raw))}close(){this.readyState=2}message(value){this.emit("message",JSON.stringify(value))}}
 const ctx=vm.createContext({URL,Buffer,crypto,AbortSignal,WebSocket:Socket,musicAssistantConfig:()=>({url:"http://fixture.invalid"}),musicAssistantToken:()=>controls.token,diagnosticError(){},setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t},clearTimeout:t=>{if(t)t.cleared=true},fetch:async(...args)=>{requests.push(args);return {ok:true,status:200,text:async()=>"null"}}});vm.runInContext(source.slice(start,end),ctx);
 function connect(){const p=ctx.ensureMusicAssistantApi();p.catch(()=>{});return {p,ws:sockets.at(-1)}}
 async function authenticate(c,name="current"){c.ws.message({server_id:name,schema_version:1});const auth=c.ws.sent.at(-1);assert.equal(auth.command,"auth");c.ws.message({message_id:auth.message_id,result:{authenticated:true}});await c.p;return c.ws}
 return {ctx,sockets,timers,requests,controls,connect,authenticate,get:expr=>vm.runInContext(expr,ctx)};
}
test("late close cannot disconnect an authenticated successor",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a,"old");h.ctx.musicAssistantApiClose();const b=h.connect();await h.authenticate(b);a.ws.emit("close",1000,Buffer.from("retired"));assert.equal(h.get("maApiSocket"),b.ws);assert.equal(h.get("maApiAuthenticated"),true);
});
test("late error cannot fail an authenticated successor",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a);h.ctx.musicAssistantApiClose();const b=h.connect();await h.authenticate(b);a.ws.emit("error",Error("retired error"));assert.equal(h.get("maApiSocket"),b.ws);assert.equal(h.get("maApiLastError"),null);
});
test("late hello cannot replace successor metadata",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a,"old");h.ctx.musicAssistantApiClose();const b=h.connect();await h.authenticate(b,"new");a.ws.message({server_id:"retired",schema_version:1});assert.equal(h.get("maApiServerInfo.server_id"),"new");
});
test("old socket messages cannot settle a successor command",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a);h.ctx.musicAssistantApiClose();const b=h.connect();await h.authenticate(b);const request=h.ctx.musicAssistantApiRawCommand("players/all");let done=false;request.then(()=>{done=true},()=>{done=true});await Promise.resolve();await Promise.resolve();const id=b.ws.sent.at(-1).message_id;a.ws.message({message_id:id,result:"retired"});await Promise.resolve();await Promise.resolve();assert.equal(done,false);b.ws.message({message_id:id,result:"current"});assert.equal(await request,"current");
});
test("old connection completion cannot remove successor single flight",async()=>{
 const h=fixture(),a=h.connect();h.ctx.musicAssistantApiClose();const b=h.connect();a.ws.emit("close",1000,Buffer.from("retired"));await a.p.catch(()=>{});const duplicate=h.connect();assert.equal(h.sockets.length,2);await h.authenticate(b);await duplicate.p;
});
test("retired hello timeout cannot close the successor",async()=>{
 const h=fixture(),a=h.connect(),timer=h.timers[0];h.ctx.musicAssistantApiClose();const b=h.connect();await h.authenticate(b);timer.fn();await a.p.catch(()=>{});assert.equal(h.get("maApiSocket"),b.ws);assert.equal(h.get("maApiAuthenticated"),true);
});
test("raw dispatch cannot switch sockets across its authentication await",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a);const request=h.ctx.musicAssistantApiRawCommand("players/cmd/play");const rejected=assert.rejects(request);h.ctx.musicAssistantApiClose();const b=h.connect();await Promise.resolve();await Promise.resolve();assert.equal(b.ws.sent.length,0);await rejected;
});
test("explicit reset settles an unfinished handshake before its close event",async()=>{
 const h=fixture(),a=h.connect();let settled=false;a.p.catch(()=>{settled=true});h.ctx.musicAssistantApiClose();await new Promise(setImmediate);assert.equal(settled,true);assert.equal(h.timers[0].cleared,true);
});

test("reset during authentication retires its request and rejects without a close event",async()=>{
 const h=fixture(),a=h.connect();a.ws.message({server_id:"old",schema_version:1});h.ctx.musicAssistantApiClose("configuration-changed");await assert.rejects(a.p,/configuration-changed/);assert.equal(h.get("maApiPending.size"),0);assert.ok(h.timers.every(t=>t.cleared));
});
test("late authentication response and timeout cannot authenticate or close a successor",async()=>{
 const h=fixture(),a=h.connect();a.ws.message({server_id:"old",schema_version:1});const id=a.ws.sent[0].message_id,timer=h.timers.at(-1);h.ctx.musicAssistantApiClose();const b=h.connect();a.ws.message({message_id:id,result:true});timer.fn();assert.equal(h.get("maApiSocket"),b.ws);assert.equal(h.get("maApiAuthenticated"),false);await h.authenticate(b);await assert.rejects(a.p);
});
test("a duplicate hello does not create another authentication request",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a);a.ws.message({server_id:"duplicate",schema_version:1});assert.equal(a.ws.sent.length,1);assert.equal(h.get("maApiPending.size"),0);assert.equal(await h.ctx.ensureMusicAssistantApi(),a.ws);assert.equal(h.sockets.length,1);
});
test("a current hello deadline rejects and permits a new connection",async()=>{
 const h=fixture(),a=h.connect();assert.equal(h.timers[0].ms,10000);h.timers[0].fn();await assert.rejects(a.p,/server information/);assert.equal(h.get("maApiSocket"),null);assert.equal(h.get("maApiConnectPromise"),null);const b=h.connect();await h.authenticate(b);
});
test("a current authentication deadline rejects and clears pending ownership",async()=>{
 const h=fixture(),a=h.connect();a.ws.message({server_id:"current",schema_version:1});const timer=h.timers.at(-1);assert.equal(timer.ms,10000);timer.fn();await assert.rejects(a.p,/authentication timed out/);assert.equal(h.get("maApiPending.size"),0);assert.equal(h.get("maApiAuthenticated"),false);assert.equal(timer.cleared,true);
});
test("rejected authentication stays unauthenticated and permits retry",async()=>{
 const h=fixture(),a=h.connect();a.ws.message({server_id:"current",schema_version:1});a.ws.message({message_id:a.ws.sent[0].message_id,result:false});await assert.rejects(a.p,/authentication was rejected/);assert.equal(h.get("maApiAuthenticated"),false);const b=h.connect();await h.authenticate(b);
});
test("authentication send errors are contained and retire the connection",async()=>{
 const h=fixture(),a=h.connect();h.controls.sendFailure=true;assert.doesNotThrow(()=>a.ws.message({server_id:"current",schema_version:1}));await assert.rejects(a.p,/send failed/);assert.equal(h.get("maApiSocket"),null);assert.equal(h.get("maApiPending.size"),0);
});
test("current close rejects an unfinished handshake and permits retry",async()=>{
 const h=fixture(),a=h.connect();a.ws.emit("close",1006,Buffer.from("lost"));await assert.rejects(a.p,/closed 1006/);assert.equal(h.get("maApiConnectPromise"),null);const b=h.connect();await h.authenticate(b);
});
test("current close rejects uncertain mutations without HTTP replay",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a);const request=h.ctx.musicAssistantCommand("players/cmd/play"),rejected=assert.rejects(request,e=>e.mayHaveExecuted===true);await Promise.resolve();await Promise.resolve();a.ws.emit("close",1006,Buffer.from("lost"));await rejected;assert.equal(h.requests.length,0);assert.equal(h.get("maApiPending.size"),0);
});
test("late close leaves successor pending commands and timers intact",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a);h.ctx.musicAssistantApiClose();const b=h.connect();await h.authenticate(b);const request=h.ctx.musicAssistantApiRawCommand("players/all");await Promise.resolve();await Promise.resolve();const command=b.ws.sent.at(-1),timer=h.timers.at(-1);a.ws.emit("close",1000,Buffer.from("retired"));assert.equal(timer.cleared,undefined);assert.equal(h.get("maApiPending.size"),1);b.ws.message({message_id:command.message_id,result:["player"]});assert.equal(JSON.stringify(await request),'["player"]');assert.equal(timer.cleared,true);
});
for(const command of ["players/all","players/cmd/pause"])test(`explicit reset prevents HTTP fallback for ${command}`,async()=>{
 const h=fixture(),request=h.ctx.musicAssistantCommand(command),rejected=assert.rejects(request,/configuration-changed/);h.ctx.musicAssistantApiClose("configuration-changed");await rejected;assert.equal(h.requests.length,0);
});
test("retirement across authenticated dispatch prevents fallback to a replacement",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a);const request=h.ctx.musicAssistantCommand("players/cmd/play"),rejected=assert.rejects(request,/connection changed/);h.ctx.musicAssistantApiClose();const b=h.connect();await rejected;assert.equal(h.requests.length,0);assert.equal(b.ws.sent.length,0);
});
test("ordinary current handshake failure retains unsent HTTP compatibility",async()=>{
 const h=fixture(),request=h.ctx.musicAssistantCommand("players/cmd/pause");h.sockets[0].emit("error",Error("connection failed"));assert.equal(await request,null);assert.equal(h.requests.length,1);assert.equal(h.sockets[0].sent.length,0);
});
test("current partial results settle once and retire their timer",async()=>{
 const h=fixture(),a=h.connect();await h.authenticate(a);const request=h.ctx.musicAssistantApiRawCommand("players/all");await Promise.resolve();await Promise.resolve();const id=a.ws.sent.at(-1).message_id,timer=h.timers.at(-1);a.ws.message({message_id:id,partial:true,result:["first"]});a.ws.message({message_id:id,result:["last"]});assert.equal(JSON.stringify(await request),'["first","last"]');assert.equal(timer.cleared,true);timer.fn();assert.equal(h.get("maApiPending.size"),0);
});
test("missing credentials and constructor failure do not retain a connecting owner",async()=>{
 const h=fixture();h.controls.token="";await assert.rejects(h.ctx.ensureMusicAssistantApi(),/token is not configured/);assert.equal(h.sockets.length,0);h.controls.token="fixture-token";h.controls.constructorFailure=true;await assert.rejects(h.ctx.ensureMusicAssistantApi(),/constructor failed/);assert.equal(h.get("maApiConnectPromise"),null);h.controls.constructorFailure=false;const a=h.connect();await h.authenticate(a);
});
