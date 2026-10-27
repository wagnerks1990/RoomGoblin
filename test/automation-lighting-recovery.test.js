"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const schema=require("../src/automation-schema");
const runtime=require("../src/automation-runtime");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing production boundary: ${start}`);
  return source.slice(a,b);
}

// Exercise winner selection, dispatch planning, reconciliation and the real TV
// handler together. No appliance, network, persistent database or credentials.
function harness({devices,locked=[],announcementActive=false,blocked=false,reply,goveeDevices={lamp:{},other:{},third:{}},goveeGroups={all:["lamp","other","third"],group:["lamp"],pair:["lamp","other"],rear:["other","third"]},now=new Date(2026,9,27,10)}={}){
  devices=devices||Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  const commands=[],audits=[],started=[],lightState=new Map();let ledgerState={version:1,runs:[]};
  const ledger=runtime.makeLedger({getPreference:()=>plain(ledgerState),setPreference:(_key,value)=>{ledgerState=plain(value)}});
  let musicTicks=0,announcementRestores=0;
  const ctx=vm.createContext({planningStudio:require("../src/planning-studio"),planningStudioConfig:{overlays:[]},
    ...schema,...runtime,devices,goveeDevices,goveeGroups,Date,Set,Map,
    schedulerClock:{now:()=>now,commandsAllowed:()=>true,status:()=>({active:false})},
    automationSchedulerEnabled:true,automationRunLedger:ledger,automationRunningOccurrences:new Map(),
    currentAutomationDisplayWinners:()=>[],localMinutesNow:date=>date.getHours()*60+date.getMinutes(),
    supersedeOverlappingAutomationRuns:()=>{},automationResourceKeys:()=>["fixture-resource"],
    startOwnedAutomationOccurrence:id=>started.push(id),executeScheduledAutomationOccurrence:()=>{},
    cleanId:value=>String(value||"").trim().toLowerCase(),
    localDateKey:()=>"2026-10-27",
    automationClassIds:()=>[],
    automationMatchesDate:event=>({match:event.matchDate!==false}),
    automationTargetDomain:runtime.actionResourceDomain,
    defaultAutomationActionTargets:()=>["all"],
    expandAutomationPayload:payload=>plain(payload),
    AUTOMATION_ACTIONS:new Set(["tv.power","govee.power"]),
    classroomAutomations:{events:[]},
    isAutomationSuppressed:()=>({blocked,reason:blocked?"no-school":null}),
    morningAnnouncementsRuntime:{active:announcementActive,targets:locked,mode:"automatic"},
    announcementLockedDisplayTargets:targets=>runtime.expandDisplayTargets(targets,{devices}).filter(id=>locked.includes(id)),
    assertMorningAnnouncements:async()=>{announcementRestores++;return {ok:true};},
    resyncCurrentDisplayAutomationsAfterAnnouncements:async()=>({results:[],winnerCount:0}),
    backgroundMusicRuntime:{playing:false,paused:false},
    backgroundMusicTick:async()=>{musicTicks++;},
    directPluto:async command=>{commands.push(plain(command));return reply?reply(command):{ok:true};},
    goveePublish:async(alias,payload)=>{commands.push({alias,payload:plain(payload)});lightState.set(alias,payload.state);return {ok:true}},
    audit:entry=>audits.push(plain(entry))
  });
  vm.runInContext(
    section("function goveeTargets(","async function goveeUdpTemperature(")+"\n"+section("async function directGoveeCommand(","function goveeInventory(")+"\n"+section("function resolveAutomationOccurrences","function resolveAutomationFromClass")+"\n"+
    section("async function runSingleAutomationAction","function timerLinkedClassChain")+"\n"+
    section("function currentAutomationNonDisplayWinners","function automationOccurrenceIsActiveForContinuousRecovery")+"\n"+
    section("function automationOccurrenceScheduledMinutes(","function automationOccurrenceIsCurrentlyApplicable(")+"\n"+
    section("function automationOccurrenceIsActiveForContinuousRecovery(","async function reconcileScheduledAutomationState(")+"\n"+
    section("async function reconcileScheduledAutomationState",'app.get("/api/v1/automation-control"'),ctx);
  return {
    ctx,commands,audits,started,ledger,lightState,
    get musicTicks(){return musicTicks;},
    get announcementRestores(){return announcementRestores;},
    async reconcile(events,reason="operator-resume"){
      ctx.classroomAutomations.events=events;
      return plain(await ctx.reconcileScheduledAutomationState(reason));
    },
    async recover(events){
      ctx.classroomAutomations.events=events;
      return plain(await ctx.recoverContinuousAutomationOccurrences("fixture-restart"));
    }
  };
}
function power(targets=["all"],payload={state:"off"}){
  return {id:"power",action:"tv.power",targets,payload,useEventTargets:false,executionMode:"once"};
}
function event(id="shutdown",time="00:01",step=power(),extra={}){
  return {id,name:id,enabled:true,time,actionSequence:[step],...extra};
}



const light=(id,time,targets,state,extra={})=>event(id,time,{id:"light",action:"govee.power",targets,payload:{state},useEventTargets:false},extra);
const on={state:"ON"},off={state:"OFF"};
test("a newer device winner cannot be overwritten by an older group listed later",async()=>{
 const h=harness();await h.reconcile([light("new","09:59",["lamp"],"on"),light("old","09:58",["group"],"off")]);
 assert.deepEqual(h.commands,[{alias:"lamp",payload:on}]);
});
test("a partially overridden group retains only its independent member",async()=>{
 const h=harness();await h.reconcile([light("new","09:59",["lamp"],"on"),light("old","09:58",["pair"],"off")]);
 assert.equal(h.lightState.get("lamp"),"ON");assert.equal(h.lightState.get("other"),"OFF");assert.equal(h.commands.length,2);
});
test("a newer group prevents the older device state from being sent",async()=>{
 const h=harness();await h.reconcile([light("old","09:58",["lamp"],"off"),light("new","09:59",["pair"],"on")]);
 assert.deepEqual(h.commands,[{alias:"lamp",payload:on},{alias:"other",payload:on}]);
});
test("overlapping groups select each actual device once",async()=>{
 const h=harness();await h.reconcile([light("new","09:59",["rear"],"on"),light("old","09:58",["pair"],"off")]);
 assert.equal(h.lightState.get("lamp"),"OFF");assert.equal(h.lightState.get("other"),"ON");assert.equal(h.lightState.get("third"),"ON");assert.equal(h.commands.length,3);
});
test("empty primary targets use the same all-group membership as dispatch",async()=>{
 const h=harness();await h.reconcile([light("new","09:59",["lamp"],"on"),light("old","09:58",[],"off")]);
 assert.equal(h.lightState.get("lamp"),"ON");assert.equal(h.lightState.get("other"),"OFF");assert.equal(h.commands.length,3);
});
test("a device takes precedence over a same-name group",async()=>{
 const h=harness({goveeGroups:{lamp:["other"]}});await h.reconcile([light("current","09:59",["lamp"],"on")]);
 assert.deepEqual(h.commands,[{alias:"lamp",payload:on}]);
});
test("unknown lighting targets remain visible failures without blocking independent winners",async()=>{
 const h=harness();const result=await h.reconcile([light("unknown","09:59",["missing"],"on"),light("known","09:59",["lamp"],"off")]);
 assert.equal(result.ok,false);assert.deepEqual(h.commands,[{alias:"lamp",payload:off}]);assert.equal(result.resources.filter(row=>row.ok===false).length,1);
});
test("independent devices retain both states",async()=>{
 const h=harness();await h.reconcile([light("a","09:59",["lamp"],"on"),light("b","09:59",["other"],"off")]);
 assert.deepEqual(h.commands,[{alias:"lamp",payload:on},{alias:"other",payload:off}]);
});
const loop=(id,time,targets)=>light(id,time,targets,"on",{actionSequence:[
 {id:"on",action:"govee.power",targets,payload:{state:"on"},executionMode:"loop",repeatDelaySeconds:30},
 {id:"off",action:"govee.power",targets,payload:{state:"off"},executionMode:"loop",repeatDelaySeconds:30}
]});
test("a newer group owner prevents an older member loop from recovering",async()=>{
 const h=harness(),events=[loop("old","09:58",["lamp"]),loop("new","09:59",["group"])];
 assert.equal((await h.recover(events)).started,1);assert.deepEqual(h.started,[runtime.occurrenceId(events[1],"2026-10-27","09:59")]);
});
test("a stopped group owner cannot revive its older member loop",async()=>{
 const h=harness(),events=[loop("old","09:58",["lamp"]),loop("new","09:59",["group"])];
 h.ledger.record({occurrenceId:runtime.occurrenceId(events[1],"2026-10-27","09:59"),status:"cancel-requested"});
 assert.equal((await h.recover(events)).started,0);assert.deepEqual(h.started,[]);
});
test("a later inherited group step retains canonical same-occurrence precedence",async()=>{
 const h=harness(),e=light("sequence","09:59",["group"],"off");e.actionSequence.push({id:"second",action:"govee.power",targets:["other"],payload:{state:"on"},useEventTargets:true});
 await h.reconcile([e]);assert.deepEqual(h.commands,[{alias:"lamp",payload:on}]);
});
test("disabled, future and unmatched groups cannot take a device winner",async()=>{
 for(const [time,extra] of [["09:59",{enabled:false}],["10:01",{}],["09:59",{matchDate:false}]]){
  const h=harness();await h.reconcile([light("base","09:58",["lamp"],"on"),light("ignored",time,["group"],"off",extra)]);assert.deepEqual(h.commands,[{alias:"lamp",payload:on}]);
 }
});
