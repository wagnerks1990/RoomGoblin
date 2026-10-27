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
    persistentState:{displays:{}},normalizeTimerOverlay:value=>value||null,automationDisplayTargets:targets=>runtime.expandDisplayTargets(targets,{devices}),localMinutesNow:date=>date.getHours()*60+date.getMinutes(),
    supersedeOverlappingAutomationRuns:()=>{},
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
    section("function automationDeferredDisplayTargets(","function consumeDeferredAnnouncementAutomations(")+"\n"+section("function automationResourceKeys(","function automationConflictDiagnostics(")+"\n"+section("function goveeTargets(","async function goveeUdpTemperature(")+"\n"+section("async function directGoveeCommand(","function goveeInventory(")+"\n"+section("function resolveAutomationOccurrences","function resolveAutomationFromClass")+"\n"+
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




const light=(targets,extra={})=>({id:'light',action:'govee.power',targets,payload:{state:'on'},useEventTargets:false,...extra});
const display=(targets,extra={})=>({id:'screen',action:'display.text',targets,payload:{text:'fixture'},useEventTargets:false,...extra});
const loop=(id,time,steps)=>event(id,time,steps[0],{actionSequence:steps.map((step,i)=>({...step,id:'step-'+i,executionMode:'loop',repeatDelaySeconds:30}))});
const once=(id,time,step)=>event(id,time,step);
const only=(e)=>runtime.occurrenceId(e,'2026-10-27',e.time);
test('partial lighting ownership does not admit the whole older loop',async()=>{
 const h=harness(),events=[loop('old','09:58',[light(['pair']),light(['pair'])]),once('new','09:59',light(['lamp']))];
 assert.equal((await h.recover(events)).started,0);assert.deepEqual(h.started,[]);
});
test('partial display ownership does not admit the whole older loop',async()=>{
 const h=harness(),events=[loop('old','09:58',[display(['tv1','tv2']),display(['tv1','tv2'])]),once('new','09:59',display(['tv1']))];
 assert.equal((await h.recover(events)).started,0);assert.deepEqual(h.started,[]);
});
for(const lost of ['lighting','display'])test('a mixed-domain loop must own its '+lost+' targets too',async()=>{
 const h=harness(),events=[loop('old','09:58',[display(['tv1']),light(['lamp'])]),once('new','09:59',lost==='lighting'?light(['lamp']):display(['tv1']))];
 assert.equal((await h.recover(events)).started,0);assert.deepEqual(h.started,[]);
});
test('an unopposed mixed-domain loop retains complete recovery ownership',async()=>{
 const h=harness(),e=loop('current','09:59',[display(['tv1']),light(['lamp'])]);
 assert.equal((await h.recover([e])).started,1);assert.deepEqual(h.started,[only(e)]);
});
test('independent complete loops remain recoverable',async()=>{
 const h=harness(),events=[loop('lights','09:58',[light(['pair']),light(['pair'])]),loop('screen','09:59',[display(['tv1']),display(['tv1'])])];
 assert.equal((await h.recover(events)).started,2);assert.deepEqual(h.started,events.map(only));
});
test('a delayed newer owner prevents recovery of the partially owned old group',async()=>{
 const h=harness(),events=[loop('old','09:58',[light(['pair']),light(['pair'])]),loop('new','09:59',[light(['lamp'],{delaySeconds:120}),light(['lamp'])])];
 assert.equal((await h.recover(events)).started,1);assert.deepEqual(h.started,[only(events[1])]);
});
test('retained Stop remains terminal for a complete owner',async()=>{
 const h=harness(),e=loop('stopped','09:59',[light(['pair']),light(['pair'])]);
 h.ledger.record({occurrenceId:only(e),status:'cancel-requested'});
 assert.equal((await h.recover([e])).started,0);assert.deepEqual(h.started,[]);
});

const withTimer=e=>({...e,timerOverlay:{enabled:true,useEventTargets:false,targets:['tv1'],source:'duration',durationSeconds:600}});
test('a lighting loop must retain its explicit display timer target',async()=>{
 const h=harness(),events=[withTimer(loop('old','09:58',[light(['lamp']),light(['lamp'])])),once('new','09:59',display(['tv1']))];
 assert.equal((await h.recover(events)).started,0);assert.deepEqual(h.started,[]);
});
test('an unopposed lighting loop with its explicit timer remains recoverable',async()=>{
 const h=harness(),e=withTimer(loop('current','09:59',[light(['lamp']),light(['lamp'])]));
 assert.equal((await h.recover([e])).started,1);assert.deepEqual(h.started,[only(e)]);
});
