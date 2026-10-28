"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const runtime=require(path.join(root,"src/automation-runtime")),schema=require(path.join(root,"src/automation-schema"));
const source=fs.readFileSync(path.join(root,"src/server.js"),"utf8"),plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function harness({live=false,revokeAfter=0}={}){
 const clock=new runtime.SchedulerClock();clock.setSimulation(new Date(2026,9,27,10));if(live)clock.enableLiveCommands();
 const commands=[],errors=[];let saved;
 async function send(command){commands.push(plain(command));if(commands.length===revokeAfter)clock.setSimulation(clock.now());return {ok:true}}
 const ctx=vm.createContext({...runtime,...schema,Date,Map,Set,Promise,schedulerClock:clock,
  cleanId:value=>String(value).trim().toLowerCase(),devices:{tv1:{enabled:true,avOutput:1},tv2:{enabled:true,avOutput:2}},
  expandAutomationPayload:value=>value,expandAutomationVariables:value=>value,
  AUTOMATION_ACTIONS:new Set(["display.clear","display.text","tv.power","govee.power"]),
  automationDisplayTargets:targets=>targets,requireAutomationTargets:targets=>targets,
  announcementLockedDisplayTargets:()=>[],executeCommand:send,directPluto:send,
  directGoveeCommand:async(target,action)=>send({target,action}),commandId:()=>"fixture",
  planningStudio:{matchingOverlays:()=>[]},planningStudioConfig:{},persistentState:{displays:{}},
  localDateKey:()=>"2026-10-27",schoolCycleForDate:()=>({}),audit:()=>{},
  normalizeTimerOverlay:value=>value||null,automationTargetDomain:runtime.actionResourceDomain,
  morningAnnouncementsRuntime:{active:false},isAutomationSuppressed:()=>({blocked:false}),
  assertMorningAnnouncements:async()=>send({type:"announcement"}),
  resyncCurrentDisplayAutomationsAfterAnnouncements:async()=>{await send({type:"resync"});return {results:[],winnerCount:1}},
  currentAutomationNonDisplayWinners:()=>[],planAutomationNonDisplayDispatches:rows=>rows,
  backgroundMusicTick:async()=>send({type:"music"}),backgroundMusicRuntime:{playing:false,paused:false},
  shutdownRequested:false,fullExportFreeze:{requested:false},automationSchedulerEnabled:true,
  plutoSchedules:Object.fromEntries([1,2].map(index=>[String(index),{enabled:true,index,type:"hdbt",onTime:"10:00",offTime:"18:00",days:[2],lastExec:{},lastRun:{}}])),
  persistPlutoSchedules:()=>{saved=plain(ctx.plutoSchedules)},diagnosticError:error=>errors.push(error),
  setInterval:()=>({unref(){}})
 });
 vm.runInContext(section("function configuredDisplayId(","function cookieValue(")+"\n"+ section("async function runSingleAutomationAction(","function timerLinkedClassChain(")+
 section("async function runAutomationTimerOverlay(","function automationRunFailures(")+
 section("async function runDisplayAutomationResync(","function consumeDeferredAnnouncementAutomations(")+
 section("async function reconcileScheduledAutomationState(",'app.get("/api/v1/automation-control"')+
 section("// Legacy per-output Pluto schedules","connectMqtt();"),ctx);
 return {ctx,clock,commands,errors,get saved(){return saved}};
}
function event(action,payload={},targets=["tv1"]){return {id:"simulation-dispatch",name:"Simulation fixture",time:"10:00",action,payload,targets}}
test("dry test clock blocks a direct scheduled action before dispatch",async()=>{
 const h=harness();await assert.rejects(h.ctx.runSingleAutomationAction(event("display.clear")),{code:"AUTOMATION_SIMULATION_DRY_RUN"});assert.equal(h.commands.length,0);
});
for(const [label,value] of [
 ["text",event("display.text",{title:"Title",subtitle:"Subtitle",text:"Body"})],
 ["TV",event("tv.power",{state:"on"},["tv1","tv2"])],
 ["lighting",event("govee.power",{state:"on"},["front","rear"])]
]){
 test(label+" stops admitting commands when live permission ends during accepted work",async()=>{
  const h=harness({live:true,revokeAfter:1});await assert.rejects(h.ctx.runSingleAutomationAction(value),{code:"AUTOMATION_SIMULATION_DRY_RUN"});assert.equal(h.commands.length,1);
 });
}
test("explicit manual actions remain available while the test clock is dry",async()=>{
 const h=harness();assert.equal((await h.ctx.runSingleAutomationAction(event("display.text",{title:"Title",text:"Body"}),{manual:true})).ok,true);assert.equal(h.commands.length,3);
});
test("direct timer overlays respect dry scheduled permission",async()=>{
 const h=harness(),value={...event("display.clear"),timerOverlay:{enabled:true,source:"duration",durationSeconds:60}};
 await assert.rejects(h.ctx.runAutomationTimerOverlay(value),{code:"AUTOMATION_SIMULATION_DRY_RUN"});assert.equal(h.commands.length,0);
});
test("display reconciliation cannot send its preliminary clear in dry mode",async()=>{
 const h=harness(),value={...event("display.clear"),actionSequence:[{action:"display.clear",targets:["tv1"],payload:{},useEventTargets:false}]};
 await assert.rejects(h.ctx.runDisplayAutomationResync(value,["tv1"]),{code:"AUTOMATION_SIMULATION_DRY_RUN"});assert.equal(h.commands.length,0);
});
test("scheduled-state reconciliation skips every dispatch when the test clock is dry",async()=>{
 const h=harness();const result=await h.ctx.reconcileScheduledAutomationState();assert.equal(h.commands.length,0);assert.equal(result.skipped,true);
});
test("legacy TV tick stops before claiming a later output when live permission ends",async()=>{
 const h=harness({live:true,revokeAfter:1});await h.ctx.legacyPlutoSchedulerTick();assert.equal(h.commands.length,1);assert.equal(h.saved["1"].lastRun.ok,true);assert.equal(h.saved["2"].lastExec.on,undefined);
});

for(const value of [event("display.clear"),event("tv.power",{state:"on"},["tv1","tv2"]),event("govee.power",{state:"on"},["front","rear"])]){
 test("valid live permission preserves "+value.action+" dispatch",async()=>{const h=harness({live:true});assert.equal((await h.ctx.runSingleAutomationAction(value)).ok,true);assert.ok(h.commands.length>0)});
}
test("an explicitly manual timer overlay remains available in dry mode",async()=>{
 const h=harness();const result=await h.ctx.runAutomationTimerOverlay({...event("display.clear"),timerOverlay:{enabled:true,source:"duration",durationSeconds:60}},{manual:true});assert.equal(result.ok,true);assert.equal(h.commands.length,1);
});
test("reconciliation does not start Background Music after permission ends during display recovery",async()=>{
 const h=harness({live:true,revokeAfter:1});await h.ctx.reconcileScheduledAutomationState();assert.deepEqual(h.commands.map(row=>row.type),["resync"]);
});
test("dry reconciliation leaves announcement restoration undispatched",async()=>{
 const h=harness();h.ctx.morningAnnouncementsRuntime.active=true;const result=await h.ctx.reconcileScheduledAutomationState();assert.equal(result.skipped,true);assert.equal(h.commands.length,0);
});

for(const enabled of [false,true]){
 test("failed scheduler toggle preserves its prior "+enabled+" runtime state",()=>{
  const ctx=vm.createContext({Date,automationSchedulerEnabled:enabled,dbStore:{setPreference(){throw new Error("fixture toggle save failed")}}});
  vm.runInContext(section("function setAutomationSchedulerEnabled(","function automationControlStatus("),ctx);
  assert.throws(()=>ctx.setAutomationSchedulerEnabled(!enabled),/fixture toggle save failed/);
  assert.equal(ctx.automationSchedulerEnabled,enabled);
 });
 test("scheduler toggle persists before projecting its new "+!enabled+" runtime state",()=>{
  const observations=[];let ctx;ctx=vm.createContext({Date,automationSchedulerEnabled:enabled,dbStore:{setPreference:(key,value)=>observations.push({key,value:plain(value),enabled:ctx.automationSchedulerEnabled})}});
  vm.runInContext(section("function setAutomationSchedulerEnabled(","function automationControlStatus("),ctx);
  assert.equal(ctx.setAutomationSchedulerEnabled(!enabled),!enabled);
  assert.equal(observations[0].enabled,enabled);assert.equal(observations[0].value.enabled,!enabled);
  assert.equal(observations[0].key,"automation.scheduler");assert.ok(observations[0].value.updatedAt);
 });
}

for(const live of [false,true]){
 test("post-announcement resync checks permission between candidates with live="+live,async()=>{
  const h=harness({live});let persisted=0,sent=0;
  const winners=[1,2].map(id=>({event:event("display.clear"),storedEvent:{id:String(id)},winningTargets:["tv1"]}));
  h.ctx.currentAutomationDisplayWinners=()=>winners;h.ctx.persistAutomations=()=>{persisted++};
  h.ctx.runDisplayAutomationResync=async()=>{sent++;h.clock.setSimulation(h.clock.now());return {ok:true,results:[]}};
  vm.runInContext(section("async function resyncCurrentDisplayAutomationsAfterAnnouncements(","function scheduleMorningAnnouncementsReleaseRetry("),h.ctx);
  const result=await h.ctx.resyncCurrentDisplayAutomationsAfterAnnouncements();
  assert.equal(result.skipped,true);assert.equal(sent,live?1:0);assert.equal(persisted,live?1:0);
  if(live){assert.equal(winners[0].storedEvent.lastRun.ok,true);assert.equal(winners[1].storedEvent.lastRun,undefined)}
 });
}
