"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n"),a=source.indexOf("function resetMusicAssistantTvAudioRestore("),b=source.indexOf("\n\n// Persistent Music Assistant",a);assert.ok(a>0&&b>a);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const flush=()=>new Promise(setImmediate);
function fixture(){
 const calls=[],timers=[],audits=[],errors=[],ws={readyState:1,connectionId:"original",deviceId:"screen"},desired={volume:20,muted:false,updatedAt:"saved"};
 const ctx=vm.createContext({WebSocket:{OPEN:1},maApiGeneration:0,shutdownRequested:false,fullExportFreeze:{requested:false},runtime:{displays:{screen:{connectionId:"original"}}},
  musicAssistantTvAudioState:()=>({...desired}),musicAssistantCommand:(command,args)=>{const d=deferred();calls.push({command,args,...d});return d.promise},
  trackFullExportMutation:p=>p,audit:v=>audits.push(v),diagnosticError:e=>errors.push(e),setTimeout:(fn,ms)=>{timers.push({fn,ms})}});
 vm.runInContext(source.slice(a,b),ctx);return {ctx,calls,timers,audits,errors,ws,desired,run:()=>ctx.restoreMusicAssistantTvAudioState("screen",ws)};
}

for(const boundary of ["volume","mute"])test("uncertain "+boundary+" does not retry or admit repeated status restoration",async()=>{
 const h=fixture();assert.equal(h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws),true);assert.equal(h.timers[0].ms,250);h.timers.shift().fn();
 if(boundary==="mute"){h.calls[0].resolve();await flush()}
 h.calls.at(-1).reject(Object.assign(Error("response lost"),{mayHaveExecuted:true}));await flush();
 assert.equal(h.ws.maAudioRestorePending,false);assert.equal(h.ws.maAudioRestoreUncertain,true);assert.notEqual(h.ws.maAudioRestored,true);
 assert.equal(h.timers.length,0);assert.equal(h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws),false);assert.equal(await h.run(),false);assert.equal(h.calls.length,boundary==="volume"?1:2);assert.equal(h.errors.length,1);
});
test("repeated status schedules exactly one current restore",async()=>{
 const h=fixture();assert.equal(h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws),true);assert.equal(h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws),false);assert.equal(h.timers.length,1);
 h.timers.shift().fn();h.calls[0].resolve();await flush();h.calls[1].resolve();await flush();
 assert.equal(h.ws.maAudioRestorePending,false);assert.equal(h.ws.maAudioRestored,true);assert.equal(h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws),false);
});
test("old timer cannot start after explicit reconnect",()=>{
 const h=fixture();h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws);const old=h.timers.shift();h.ctx.resetMusicAssistantTvAudioRestore(h.ws);h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws);old.fn();
 assert.equal(h.calls.length,0);assert.equal(h.ws.maAudioRestorePending,true);assert.equal(h.timers.length,1);
});
for(const fails of [false,true])test("old restore "+(fails?"failure":"success")+" cannot clear successor pending ownership",async()=>{
 const h=fixture();h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws);h.timers.shift().fn();h.ctx.resetMusicAssistantTvAudioRestore(h.ws);h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws);
 if(fails)h.calls[0].reject(Object.assign(Error("old uncertain"),{mayHaveExecuted:true}));else h.calls[0].resolve();await flush();
 assert.equal(h.ws.maAudioRestorePending,true);assert.equal(h.ws.maAudioRestoreUncertain,false);assert.equal(h.calls.length,1);assert.equal(h.errors.length,0);
 h.timers.shift().fn();h.calls[1].resolve();await flush();h.calls[2].resolve();await flush();assert.equal(h.ws.maAudioRestored,true);assert.equal(h.ws.maAudioRestorePending,false);
});
test("explicit reconnect can start a fresh restore after an uncertain outcome",async()=>{
 const h=fixture(),p=h.run();h.calls[0].reject(Object.assign(Error("uncertain"),{mayHaveExecuted:true}));await p;
 h.ctx.resetMusicAssistantTvAudioRestore(h.ws);assert.equal(h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws),true);h.timers.shift().fn();h.calls[1].resolve();await flush();h.calls[2].resolve();await flush();assert.equal(h.ws.maAudioRestored,true);
});
test("matching current telemetry confirms uncertainty without another mutation",()=>{
 const h=fixture();h.ws.maAudioRestoreUncertain=true;h.ctx.confirmMusicAssistantTvAudioRestore(h.ws,{protocolActive:true,volume:20,muted:false});
 assert.equal(h.ws.maAudioRestoreUncertain,false);assert.equal(h.ws.maAudioRestored,true);assert.equal(h.calls.length,0);assert.equal(h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws),false);
});
for(const status of [{volume:10,muted:false},{volume:20,muted:true},{volume:"20",muted:false},{volume:20},{volume:NaN,muted:false}])test("nonconfirming telemetry retains uncertainty "+JSON.stringify(status),()=>{
 const h=fixture();h.ws.maAudioRestoreUncertain=true;h.ctx.confirmMusicAssistantTvAudioRestore(h.ws,{protocolActive:true,...status});assert.equal(h.ws.maAudioRestoreUncertain,true);assert.notEqual(h.ws.maAudioRestored,true);assert.equal(h.calls.length,0);
});
test("replaced receiver telemetry cannot confirm audio",()=>{
 const h=fixture();h.ws.maAudioRestoreUncertain=true;h.ctx.runtime.displays.screen.connectionId="new";h.ctx.confirmMusicAssistantTvAudioRestore(h.ws,{protocolActive:true,volume:20,muted:false});assert.equal(h.ws.maAudioRestoreUncertain,true);
});
for(const freeze of [false,true])test("deferred restore respects "+(freeze?"recovery freeze":"shutdown"),()=>{
 const h=fixture();h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws);if(freeze)h.ctx.fullExportFreeze.requested=true;else h.ctx.shutdownRequested=true;h.timers.shift().fn();assert.equal(h.calls.length,0);assert.equal(h.ws.maAudioRestorePending,false);
});
test("unexpected tracked restore rejection remains visible and releases only its owner",async()=>{
 const h=fixture();h.ctx.restoreMusicAssistantTvAudioState=async()=>{throw Error("storage unavailable")};h.ctx.scheduleMusicAssistantTvAudioRestore(h.ws);h.timers.shift().fn();await flush();
 assert.equal(h.errors.length,1);assert.equal(h.ws.maAudioRestorePending,false);assert.notEqual(h.ws.maAudioRestored,true);
});
for(const protocolActive of [false,undefined])test('inactive bridge cannot confirm saved audio '+protocolActive,()=>{const h=fixture();h.ws.maAudioRestoreUncertain=true;h.ctx.confirmMusicAssistantTvAudioRestore(h.ws,{protocolActive,volume:20,muted:false});assert.equal(h.ws.maAudioRestoreUncertain,true);assert.notEqual(h.ws.maAudioRestored,true)});
