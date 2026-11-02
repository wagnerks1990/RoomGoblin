"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n"),a=source.indexOf("async function restoreMusicAssistantTvAudioState("),b=source.indexOf("\n\n// Persistent Music Assistant",a);assert.ok(a>0&&b>a);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const flush=()=>new Promise(setImmediate);
function fixture(){
 const calls=[],timers=[],audits=[],errors=[],ws={readyState:1,connectionId:"original"},desired={volume:20,muted:false,updatedAt:"saved"};
 const ctx=vm.createContext({WebSocket:{OPEN:1},maApiGeneration:0,shutdownRequested:false,fullExportFreeze:{requested:false},runtime:{displays:{screen:{connectionId:"original"}}},
  musicAssistantTvAudioState:()=>({...desired}),musicAssistantCommand:(command,args)=>{const d=deferred();calls.push({command,args,...d});return d.promise},
  audit:v=>audits.push(v),diagnosticError:e=>errors.push(e),setTimeout:(fn,ms)=>{timers.push({fn,ms})}});
 vm.runInContext(source.slice(a,b),ctx);return {ctx,calls,timers,audits,errors,ws,desired,run:()=>ctx.restoreMusicAssistantTvAudioState("screen",ws)};
}
const retire={
 "closed receiver":h=>{h.ws.readyState=3},
 "replacement receiver":h=>{h.ctx.runtime.displays.screen.connectionId="replacement"},
 "new connection":h=>{h.ctx.maApiGeneration++},
 "changed volume":h=>{h.desired.volume=70},
 "changed mute":h=>{h.desired.muted=true},
 "new saved revision":h=>{h.desired.updatedAt="replacement"},
 "shutdown":h=>{h.ctx.shutdownRequested=true},
 "recovery freeze":h=>{h.ctx.fullExportFreeze.requested=true}
};
for(const [reason,change]of Object.entries(retire)){
 test("TV restore stops before mute after "+reason,async()=>{
  const h=fixture(),p=h.run();change(h);h.calls[0].resolve();assert.equal(await p,false);assert.equal(h.calls.length,1);assert.notEqual(h.ws.maAudioRestored,true);assert.equal(h.audits.length,0);
 });
 test("TV restore cannot claim completion after "+reason,async()=>{
  const h=fixture(),p=h.run();h.calls[0].resolve();await flush();assert.equal(h.calls.length,2);change(h);h.calls[1].resolve();assert.equal(await p,false);assert.notEqual(h.ws.maAudioRestored,true);assert.equal(h.audits.length,0);
 });
}
test("current TV restore keeps exact stable player identity and saved audio",async()=>{
 const h=fixture(),p=h.run();assert.equal(h.calls[0].args.player_id,"classroom-hub-screen");assert.equal(h.calls[0].args.volume_level,20);
 h.calls[0].resolve();await flush();assert.equal(h.calls[1].command,"players/cmd/volume_mute");assert.equal(h.calls[1].args.muted,false);
 h.calls[1].resolve();assert.equal(await p,true);assert.equal(h.ws.maAudioRestored,true);assert.equal(h.audits.length,1);assert.equal(h.audits[0].attempt,1);
});
test("a retired failure does not schedule another restore or report a current error",async()=>{
 const h=fixture(),p=h.run();h.ctx.maApiGeneration++;h.calls[0].reject(Error("retired"));assert.equal(await p,false);assert.equal(h.timers.length,0);assert.equal(h.errors.length,0);
});
test("a replacement during retry delay stops the next mutation",async()=>{
 const h=fixture(),p=h.run();h.calls[0].reject(Error("not registered yet"));await flush();assert.equal(h.timers[0].ms,700);
 h.desired.muted=true;h.timers.shift().fn();assert.equal(await p,false);assert.equal(h.calls.length,1);
});
test("current known failure retains bounded retry and visible final diagnostics",async()=>{
 const h=fixture(),p=h.run();
 for(let i=0;i<8;i++){assert.equal(h.calls.length,i+1);h.calls[i].reject(Error("not registered yet"));await flush();if(i<7){assert.equal(h.timers.length,1);h.timers.shift().fn();await flush()}}
 assert.equal(await p,false);assert.equal(h.calls.length,8);assert.equal(h.errors.length,1);assert.equal(h.timers.length,0);assert.notEqual(h.ws.maAudioRestored,true);
});
test("a successful current retry restores once and records the accepted attempt",async()=>{
 const h=fixture(),p=h.run();h.calls[0].reject(Error("not registered yet"));await flush();h.timers.shift().fn();await flush();
 h.calls[1].resolve();await flush();h.calls[2].resolve();assert.equal(await p,true);assert.equal(h.audits.length,1);assert.equal(h.audits[0].attempt,2);
});
test("an already replaced receiver issues no restore command",async()=>{
 const h=fixture();h.ctx.runtime.displays.screen.connectionId="new";assert.equal(await h.run(),false);assert.equal(h.calls.length,0);
});
