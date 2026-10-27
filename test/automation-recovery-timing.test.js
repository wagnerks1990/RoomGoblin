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
function harness({devices,locked=[],announcementActive=false,blocked=false,reply,now=new Date(2026,9,27,10)}={}){
  devices=devices||Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  const commands=[],audits=[],started=[];let ledgerState={version:1,runs:[]};
  const ledger=runtime.makeLedger({getPreference:()=>plain(ledgerState),setPreference:(_key,value)=>{ledgerState=plain(value)}});
  let musicTicks=0,announcementRestores=0;
  const ctx=vm.createContext({planningStudio:require("../src/planning-studio"),planningStudioConfig:{overlays:[]},
    ...schema,...runtime,devices,Date,Set,Map,
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
    directGoveeCommand:async(...args)=>{commands.push({kind:"govee",args:plain(args)});return {ok:true};},
    audit:entry=>audits.push(plain(entry))
  });
  vm.runInContext(
    section("function resolveAutomationOccurrences","function resolveAutomationFromClass")+"\n"+
    section("async function runSingleAutomationAction","function timerLinkedClassChain")+"\n"+
    section("function currentAutomationNonDisplayWinners","function automationOccurrenceIsActiveForContinuousRecovery")+"\n"+
    section("function automationOccurrenceScheduledMinutes(","function automationOccurrenceIsCurrentlyApplicable(")+"\n"+
    section("function automationOccurrenceIsActiveForContinuousRecovery(","async function reconcileScheduledAutomationState(")+"\n"+
    section("async function reconcileScheduledAutomationState",'app.get("/api/v1/automation-control"'),ctx);
  return {
    commands,audits,started,ledger,
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


const at=seconds=>new Date(new Date(2026,9,27,10).getTime()+seconds*1000);
const sequence=(steps,extra={})=>event("timed","10:00",steps[0],{actionSequence:steps,...extra});
const tv=state=>({action:"cecOutput",output:1,connection:"hdbt",index:state==="on"?0:1});
for(const [delay,elapsed] of [[59,1],[0.5,0.499],[30,29.999]]){
  test(`recovery waits for the exact ${delay}-second pre-action delay`,async()=>{
    const h=harness({now:at(elapsed)});await h.reconcile([sequence([{...power(["tv1"],{state:"on"}),delaySeconds:delay}])]);
    assert.deepEqual(h.commands,[]);
  });
}
test("the exact fractional delay boundary is eligible",async()=>{
  const h=harness({now:at(0.5)});await h.reconcile([sequence([{...power(["tv1"],{state:"on"}),delaySeconds:0.5}])]);
  assert.deepEqual(h.commands,[tv("on")]);
});
test("a preceding display dwell delays TV recovery",async()=>{
  const h=harness({now:at(30)});await h.reconcile([sequence([{id:"display",action:"display.text",targets:["screen"],executionMode:"once",repeatDelaySeconds:120},power(["tv1"])])]);
  assert.deepEqual(h.commands,[]);
});
test("pre-action delays and earlier dwells accumulate in canonical order",async()=>{
  const steps=[{...power(["tv1"],{state:"on"}),delaySeconds:30,repeatDelaySeconds:60},{...power(["tv1"]),delaySeconds:10}];
  const before=harness({now:at(99.999)});await before.reconcile([sequence(steps)]);assert.deepEqual(before.commands,[tv("on")]);
  const after=harness({now:at(100)});await after.reconcile([sequence(steps)]);assert.deepEqual(after.commands,[tv("off")]);
});
test("later eligible zero-delay state replaces the earlier action of the same occurrence",async()=>{
  const h=harness({now:at(30)});await h.reconcile([sequence([power(["tv1"],{state:"on"}),power(["tv1"])])]);
  assert.deepEqual(h.commands,[tv("off")]);
});
test("same-minute priority between occurrences remains unchanged",async()=>{
  const h=harness({now:at(59)});await h.reconcile([
    sequence([power(["tv1"],{state:"on"})],{id:"priority",priority:10}),
    sequence([{...power(["tv1"]),delaySeconds:59}],{id:"later",priority:0})]);
  assert.deepEqual(h.commands,[tv("on")]);
});
test("same-minute event identity still breaks equal priority ties",async()=>{
  const h=harness({now:at(30)});await h.reconcile([
    sequence([power(["tv1"],{state:"on"})],{id:"z-winner"}),
    sequence([power(["tv1"])],{id:"a-other"})]);
  assert.deepEqual(h.commands,[tv("on")]);
});
test("separate resource winners retain their own eligible state",async()=>{
  const h=harness({now:at(30)});await h.reconcile([sequence([
    {...power(["tv1"],{state:"on"}),repeatDelaySeconds:10},
    {id:"light",action:"govee.power",targets:["lamp"],useEventTargets:false,payload:{state:"off"},executionMode:"once"}])]);
  assert.deepEqual(h.commands,[tv("on"),{kind:"govee",args:["lamp","off",{state:"off"}]}]);
});
test("lighting recovery also waits through its pre-action delay",async()=>{
  const steps=[{id:"light",action:"govee.power",targets:["lamp"],payload:{state:"on"},delaySeconds:20}];
  const before=harness({now:at(19.999)});await before.reconcile([sequence(steps)]);assert.deepEqual(before.commands,[]);
  const after=harness({now:at(20)});await after.reconcile([sequence(steps)]);
  assert.deepEqual(after.commands,[{kind:"govee",args:["lamp","on",{state:"on"}]}]);
});

const loop=(id,time,{delay=0,dwell=30,targets=["tv1"]}={})=>sequence([
  {...power(targets,{state:"on"}),executionMode:"loop",delaySeconds:delay,repeatDelaySeconds:dwell},
  {...power(targets),executionMode:"loop",repeatDelaySeconds:30}
],{id,time});
test("a delayed continuous owner can restart without applying its state early",async()=>{
  const h=harness({now:at(1)}),events=[loop("pending","10:00",{delay:59})];
  await h.reconcile(events);assert.deepEqual(h.commands,[]);
  assert.equal((await h.recover(events)).started,1);
  assert.deepEqual(h.started,[runtime.occurrenceId(events[0],"2026-10-27","10:00")]);
});
test("a newer delayed continuous owner prevents the older loop from recovering",async()=>{
  const h=harness({now:at(1)}),events=[loop("old","09:59"),loop("new","10:00",{delay:120})];
  assert.equal((await h.recover(events)).started,1);
  assert.deepEqual(h.started,[runtime.occurrenceId(events[1],"2026-10-27","10:00")]);
});
test("a later step in an older loop cannot displace a newer recovery owner",async()=>{
  const h=harness({now:at(600)}),events=[loop("old","09:59",{dwell:600}),loop("new","10:00")];
  assert.equal((await h.recover(events)).started,1);
  assert.deepEqual(h.started,[runtime.occurrenceId(events[1],"2026-10-27","10:00")]);
});
test("a stopped pending winner does not revive its superseded predecessor",async()=>{
  const h=harness({now:at(1)}),events=[loop("old","09:59"),loop("stopped","10:00",{delay:120})];
  h.ledger.record({occurrenceId:runtime.occurrenceId(events[1],"2026-10-27","10:00"),status:"cancel-requested"});
  assert.equal((await h.recover(events)).started,0);assert.deepEqual(h.started,[]);
});
test("independent delayed owners both remain recoverable",async()=>{
  const h=harness({now:at(1)}),events=[loop("first","10:00",{delay:120}),loop("second","10:00",{delay:90,targets:["tv2"]})];
  assert.equal((await h.recover(events)).started,2);assert.equal(h.started.length,2);
});
