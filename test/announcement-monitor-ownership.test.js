"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function fixture({active=true,probe=async()=>({live:false})}={}){
 const timers=new Set(),calls=[],errors=[],routes=new Map();let probes=0;
 const state={active,mode:active?"automatic":null,offlineCount:0,lastError:null};
 const ctx=vm.createContext({Date,Promise,Math,Number,shutdownRequested:false,fullExportFreeze:{requested:false},
  morningAnnouncements:{enabled:true,checkIntervalSeconds:15,offlineConfirmations:6},morningAnnouncementsRuntime:state,
  setTimeout:(cb,ms)=>{const timer={cb,ms,unref(){}};timers.add(timer);return timer},clearTimeout:timer=>timers.delete(timer),
  withinMorningAnnouncementsWindow:()=>true,morningAnnouncementsSchoolDay:()=>true,
  probeMorningAnnouncementsLive:()=>{probes++;return probe()},
  releaseMorningAnnouncements:async reason=>{calls.push({type:"release",reason});state.active=false},
  assertMorningAnnouncements:async()=>{calls.push({type:"start"});state.active=true},diagnosticError:error=>errors.push(error),
  app:{post:(route,...handlers)=>routes.set(route,handlers.at(-1))},requireControl:()=>{},
  publicProjection:value=>value,publicMorningAnnouncementsConfig:()=>({enabled:ctx.morningAnnouncements.enabled})
 });
 vm.runInContext(section("let morningAnnouncementsTimer=null;","const deferredAnnouncementAutomations")+
  section("let morningAnnouncementsTickBusy=false;","function calendarRuleForDate(")+
  section('app.post("/api/v1/automations/morning-announcements/check"','app.post("/api/v1/automations/morning-announcements/start"'),ctx);
 const fire=timer=>{assert.ok(timers.delete(timer));return timer.cb()};
 async function check(){let status=200,body;const res={status(value){status=value;return res},json(value){body=value;return res}};await routes.get("/api/v1/automations/morning-announcements/check")({},res);return {status,body}}
 return {ctx,state,timers,calls,errors,fire,check,get probes(){return probes}};
}
test("restarting during an in-flight announcement probe leaves one timer chain",async()=>{
 const gate=deferred(),h=fixture({probe:()=>gate.promise});h.ctx.restartMorningAnnouncementsWatcher();
 const pending=h.fire([...h.timers][0]);await Promise.resolve();assert.equal(h.probes,1);
 h.ctx.restartMorningAnnouncementsWatcher();gate.resolve({live:false});await pending;
 assert.equal(h.timers.size,1);assert.equal([...h.timers][0].ms,2500);
});
test("a retired watcher waiting in the lifecycle queue cannot probe or reschedule",async()=>{
 const gate=deferred(),h=fixture(),block=h.ctx.serializeMorningAnnouncementsLifecycle(()=>gate.promise);
 h.ctx.restartMorningAnnouncementsWatcher();const pending=h.fire([...h.timers][0]);
 h.ctx.restartMorningAnnouncementsWatcher();gate.resolve();await block;await pending;
 assert.equal(h.probes,0);assert.equal(h.timers.size,1);
});
test("repeated idle restarts retain one initial timer and normal ticks retain their interval",async()=>{
 const h=fixture();for(let i=0;i<5;i++)h.ctx.restartMorningAnnouncementsWatcher();
 assert.equal(h.timers.size,1);assert.equal([...h.timers][0].ms,2500);
 await h.fire([...h.timers][0]);assert.equal(h.probes,1);assert.equal(h.timers.size,1);assert.equal([...h.timers][0].ms,15000);
});
test("shutdown during a probe cannot restart the watcher chain",async()=>{
 const gate=deferred(),h=fixture({probe:()=>gate.promise});h.ctx.restartMorningAnnouncementsWatcher();
 const pending=h.fire([...h.timers][0]);await Promise.resolve();h.ctx.shutdownRequested=true;gate.resolve({live:false});await pending;
 assert.equal(h.timers.size,0);assert.equal(vm.runInContext("morningAnnouncementsLifecycleBusy",h.ctx),0);
});
for(const unknown of [null,undefined,"error"])test("unknown automatic evidence resets the consecutive-offline count: "+unknown,async()=>{
 const values=[false,false,false,unknown,false,false,false],h=fixture({probe:async()=>{const live=values.shift();if(live==="error")throw Error("probe unavailable");return {live}}});
 for(let i=0;i<7;i++)await h.ctx.morningAnnouncementsTick();
 assert.equal(h.calls.length,0);assert.equal(h.state.active,true);assert.equal(h.state.offlineCount,3);
});
test("six consecutive automatic offline observations still release exactly once",async()=>{
 const h=fixture();for(let i=0;i<5;i++)await h.ctx.morningAnnouncementsTick();assert.equal(h.calls.length,0);
 await h.ctx.morningAnnouncementsTick();await h.ctx.morningAnnouncementsTick();assert.deepEqual(h.calls,[{type:"release",reason:"stream-ended"}]);
});
test("successful live observations keep an active player stable and reset offline evidence",async()=>{
 const h=fixture({probe:async()=>({live:true})});h.state.offlineCount=5;
 for(let i=0;i<3;i++)await h.ctx.morningAnnouncementsTick();assert.equal(h.calls.length,0);assert.equal(h.state.offlineCount,0);
});
for(const live of [true,false,"error"])test("a result from replaced announcement settings cannot change the new lifecycle: "+live,async()=>{
 const gate=deferred(),h=fixture({active:live!==true,probe:()=>gate.promise});h.state.offlineCount=5;
 const pending=h.ctx.morningAnnouncementsTick();h.ctx.morningAnnouncements={...h.ctx.morningAnnouncements,enabled:false};h.state.lastError="replacement status";
 if(live==="error")gate.reject(Error("obsolete probe error"));else gate.resolve({live});await pending;
 assert.equal(h.calls.length,0);assert.equal(h.state.offlineCount,5);assert.equal(h.state.lastError,"replacement status");
});
test("manual announcement mode remains operator-owned without automatic probing",async()=>{
 const h=fixture();h.state.mode="manual";await h.ctx.morningAnnouncementsTick();assert.equal(h.probes,0);assert.equal(h.calls.length,0);
});
test("manual diagnostic checks cannot advance the automatic release threshold",async()=>{
 const h=fixture();h.state.offlineCount=2;for(let i=0;i<8;i++)assert.equal((await h.check()).status,200);
 assert.equal(h.state.offlineCount,2);assert.equal(h.calls.length,0);
 await h.ctx.morningAnnouncementsTick();assert.equal(h.state.offlineCount,3);assert.equal(h.calls.length,0);
});
for(const live of [true,null,"error"])test("manual live or unknown evidence breaks an offline streak: "+live,async()=>{
 const h=fixture({probe:async()=>{if(live==="error")throw Error("manual probe unavailable");return {live}}});h.state.offlineCount=5;
 const result=await h.check();assert.equal(result.status,live==="error"?500:200);assert.equal(h.state.offlineCount,0);assert.equal(h.calls.length,0);
});
for(const live of [true,false,"error"])test("manual diagnostics from replaced settings cannot overwrite current status: "+live,async()=>{
 const gate=deferred(),h=fixture({probe:()=>gate.promise});h.state.offlineCount=4;
 const pending=h.check();h.ctx.morningAnnouncements={...h.ctx.morningAnnouncements,enabled:false};h.state.lastError="new settings status";
 if(live==="error")gate.reject(Error("retired diagnostic"));else gate.resolve({live});
 const result=await pending;assert.equal(result.status,409);assert.equal(h.state.offlineCount,4);assert.equal(h.state.lastError,"new settings status");assert.equal(h.calls.length,0);
});
