"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const crypto=require("node:crypto");
const {makeLedger,occurrenceId}=require("../src/automation-runtime");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing production boundary: ${start}`);
  return source.slice(a,b);
}
function harness({failStatus,failPersistAt=0,run}={}){
  const now=new Date(2026,9,27,10),event={id:"owner-fixture",name:"Owner fixture",enabled:true,time:"10:00",action:"display.clear",targets:["screen"],revision:1};
  let state={runs:[]},persists=0,dispatches=0;
  const tasks=[],errors=[],audits=[];
  const ledger=makeLedger({getPreference:()=>state,setPreference:(_key,next)=>{
    if(next.runs.at(-1)?.status===failStatus)throw new Error(`fixture ledger ${failStatus} failed`);
    state=next;
  }});
  const ctx=vm.createContext({
    Date,Map,Set,Promise,crypto,occurrenceId,automationRunLedger:ledger,
    shutdownRequested:false,automationSchedulerEnabled:true,SCHEDULER_CATCHUP_MINUTES:5,
    fullExportFreeze:{requested:false,activeAsyncMutations:0},
    schedulerClock:{now:()=>now,status:()=>({active:false}),commandsAllowed:()=>true},
    classroomAutomations:{events:[event]},
    localDateKey:()=>"2026-10-27",localMinutesNow:()=>600,
    isAutomationSuppressed:()=>({blocked:false}),automationClassIds:()=>[],
    resolveAutomationOccurrences:value=>[value],automationMatchesDate:()=>({match:true}),
    automationResourceKeys:()=>["display-content:screen"],
    morningAnnouncementsRuntime:{active:false},automationActionSequence:value=>[{action:value.action}],
    automationRunFailures:()=>[],cleanId:value=>value,
    currentContinuousRecoveryWinnerIdentities:()=>new Set(["winner"]),
    automationOccurrenceIdentity:()=>"winner",automationOccurrenceScheduledMinutes:()=>600,
    automationOccurrenceIsActiveForContinuousRecovery:()=>true,
    persistAutomations:()=>{if(++persists===failPersistAt)throw new Error("fixture final persistence failed")},
    runClassroomAutomation:async(...args)=>{dispatches++;return run?run(...args):{ok:true,results:[]}},
    audit:value=>audits.push(value),diagnosticError:(error,context)=>errors.push({message:error.message,context})
  });
  vm.runInContext(section("function trackFullExportMutation(","// Veyon becomes")+
    section("let automationSchedulerBusy=false;","let automationStartupReconcilePending=true;")+
    section("function startManagedManualAutomation(",'app.post("/api/v1/automations/draft/run"')+
    section("async function recoverContinuousAutomationOccurrences(","async function reconcileScheduledAutomationState(")+
    "\nglobalThis.maps={running:automationRunningOccurrences,meta:automationRunningOccurrenceMeta,cancelled:automationCancelledOccurrences,reasons:automationCancellationReasons};",ctx);
  const track=ctx.trackFullExportMutation;
  ctx.trackFullExportMutation=task=>{const tracked=track(task);tasks.push(tracked);return tracked};
  return {ctx,event,tasks,errors,audits,setFailStatus:value=>{failStatus=value},get dispatches(){return dispatches},get ledger(){return state},
    async settle(){await Promise.allSettled(tasks)},
    assertReleased(){
      for(const [name,map] of Object.entries(ctx.maps))assert.equal(map.size,0,`${name} must release settled ownership`);
      assert.equal(ctx.fullExportFreeze.activeAsyncMutations,0);
    }
  };
}

test("scheduled final persistence failure releases run ownership and reports the error",async()=>{
  const h=harness({failPersistAt:2});await h.ctx.automationSchedulerTick();await h.settle();
  assert.equal(h.dispatches,1);h.assertReleased();
  assert.ok(h.errors.some(row=>/persistence failed/.test(row.message)));
  await h.ctx.automationSchedulerTick();assert.equal(h.dispatches,1,"accepted occurrence must not replay");
});

test("scheduled running-ledger failure cannot strand a registered rejected task",async()=>{
  const h=harness({failStatus:"running"});await h.ctx.automationSchedulerTick();await h.settle();
  assert.equal(h.dispatches,0);h.assertReleased();
  assert.ok(h.errors.some(row=>/ledger running failed/.test(row.message)));
});

test("manual admission failure leaves no ownership or accepted action",()=>{
  const h=harness({failStatus:"manual-running"});
  assert.throws(()=>h.ctx.startManagedManualAutomation(h.event,{storedEvent:h.event}),/ledger manual-running failed/);
  assert.equal(h.dispatches,0);h.assertReleased();
});

test("failed manual admission does not cancel a previously accepted run",async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});
  const h=harness({run:async()=>{await gate;return {ok:true,results:[]}}});
  const accepted=h.ctx.startManagedManualAutomation(h.event,{storedEvent:h.event});
  await Promise.resolve();h.setFailStatus("manual-running");
  assert.throws(()=>h.ctx.startManagedManualAutomation(h.event,{draft:true}),/ledger manual-running failed/);
  assert.equal(h.ctx.maps.running.size,1);assert.equal(h.ctx.maps.meta.size,1);
  assert.equal(h.ctx.maps.running.has(accepted.occurrenceId),true);
  assert.equal(h.ctx.maps.cancelled.size,0);
  release();await h.settle();h.assertReleased();
});

test("manual final persistence failure releases the returned background task",async()=>{
  const h=harness({failPersistAt:1});
  const accepted=h.ctx.startManagedManualAutomation(h.event,{storedEvent:h.event});
  assert.equal(accepted.started,true);await h.settle();h.assertReleased();
  assert.equal(h.dispatches,1);assert.ok(h.errors.some(row=>/persistence failed/.test(row.message)));
});

test("recovery admission failure leaves no phantom running metadata",async()=>{
  const h=harness({failStatus:"recovered-running"});
  await assert.rejects(h.ctx.recoverContinuousAutomationOccurrences(),/ledger recovered-running failed/);
  assert.equal(h.dispatches,0);h.assertReleased();
});

test("recovered runs release ownership after their running-ledger failure",async()=>{
  const h=harness({failStatus:"running"});
  assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,1);
  await h.settle();assert.equal(h.dispatches,0);h.assertReleased();
});

test("accepted manual and scheduled work stays owned until its adapter settles",async()=>{
  for(const manual of [false,true]){
    let release;const gate=new Promise(resolve=>{release=resolve});
    const h=harness({run:async()=>{await gate;return {ok:true,results:[]}}});
    if(manual)h.ctx.startManagedManualAutomation(h.event,{storedEvent:h.event});
    else await h.ctx.automationSchedulerTick();
    await Promise.resolve();
    assert.equal(h.ctx.maps.running.size,1);assert.equal(h.ctx.maps.meta.size,1);
    assert.equal(h.ctx.fullExportFreeze.activeAsyncMutations,1);
    release();await h.settle();h.assertReleased();
  }
});

test("shutdown interruption retains its recovery status while ownership is released",async()=>{
  for(const manual of [false,true]){
    const h=harness({run:async()=>{throw Object.assign(new Error("fixture shutdown"),{code:"AUTOMATION_INTERRUPTED"})}});
    if(manual)h.ctx.startManagedManualAutomation(h.event,{storedEvent:h.event});
    else await h.ctx.automationSchedulerTick();
    await h.settle();h.assertReleased();
    assert.equal(h.ledger.runs.at(-1).status,"interrupted");
    assert.equal(h.event.lastRun.interrupted,true);
    assert.equal(h.event.lastRun.cancelled,undefined);
  }
});

function holdOlderRun(h,{resources=["display-content:screen"],reject=false,timeline=[]}={}){
  let release;const gate=new Promise(resolve=>{release=resolve});
  h.ctx.startOwnedAutomationOccurrence("older-run",{automationId:"older",resources},async()=>{
    timeline.push("older-accepted");await gate;timeline.push("older-settled");
    if(reject)throw new Error("fixture older adapter failed");
  });
  return release;
}

for(const kind of ["scheduled","recovered","manual"]){
  test(`${kind} replacement waits for an older accepted adapter without blocking admission`,async()=>{
    const timeline=[],h=harness({run:async()=>{timeline.push("replacement-dispatched");return {ok:true,results:[]}}});
    const release=holdOlderRun(h,{timeline});await Promise.resolve();
    try{
      if(kind==="scheduled")await h.ctx.automationSchedulerTick();
      else if(kind==="recovered")assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,1);
      else assert.equal(h.ctx.startManagedManualAutomation(h.event).started,true);
      await Promise.resolve();
      assert.equal(h.dispatches,0,"the replacement must wait for accepted adapter work");
      assert.equal(h.ctx.maps.running.size,2);assert.equal(h.ctx.maps.meta.size,2);
      assert.equal(h.ctx.fullExportFreeze.activeAsyncMutations,2,"waiting replacement remains owned by the recovery drain");
      assert.equal(vm.runInContext("automationSchedulerBusy",h.ctx),false,"discovery must remain nonblocking");
      assert.equal(h.ctx.maps.cancelled.has("older-run"),true);
    }finally{release();await h.settle()}
    assert.deepEqual(timeline,["older-accepted","older-settled","replacement-dispatched"]);h.assertReleased();
  });
}

test("an unrelated resource can dispatch while an older adapter remains accepted",async()=>{
  const h=harness(),release=holdOlderRun(h,{resources:["lighting:unrelated"]});await Promise.resolve();
  try{h.ctx.startManagedManualAutomation(h.event);await Promise.resolve();assert.equal(h.dispatches,1);assert.equal(h.ctx.maps.cancelled.has("older-run"),false)}
  finally{release();await h.settle()}
  h.assertReleased();
});

test("an older adapter failure settles before the replacement dispatches and does not poison it",async()=>{
  const timeline=[],h=harness({run:async()=>{timeline.push("replacement-dispatched");return {ok:true,results:[]}}});
  const release=holdOlderRun(h,{reject:true,timeline});await Promise.resolve();
  try{h.ctx.startManagedManualAutomation(h.event);await Promise.resolve();assert.equal(h.dispatches,0)}
  finally{release();await h.settle()}
  assert.deepEqual(timeline,["older-accepted","older-settled","replacement-dispatched"]);
  assert.ok(h.errors.some(row=>/older adapter failed/.test(row.message)));h.assertReleased();
});

test("a newer replacement cancels an already waiting replacement before it sends",async()=>{
  const dispatched=[];let h;
  h=harness({run:async event=>{
    if(h.ctx.maps.cancelled.has(event._occurrenceId))throw Object.assign(new Error("fixture superseded"),{code:"AUTOMATION_CANCELLED"});
    dispatched.push(event.name);return {ok:true,results:[]};
  }});
  const release=holdOlderRun(h);await Promise.resolve();let middle,last;
  try{
    middle=h.ctx.startManagedManualAutomation({...h.event,name:"middle"});
    last=h.ctx.startManagedManualAutomation({...h.event,name:"last"});
    await Promise.resolve();assert.deepEqual(dispatched,[]);
    assert.equal(h.ctx.maps.running.size,3);assert.equal(h.ctx.maps.cancelled.has(middle.occurrenceId),true);
  }finally{release();await h.settle()}
  assert.deepEqual(dispatched,["last"]);
  assert.equal(h.ledger.runs.filter(row=>row.occurrenceId===middle.occurrenceId).at(-1).status,"cancelled");
  assert.equal(h.ledger.runs.filter(row=>row.occurrenceId===last.occurrenceId).at(-1).status,"succeeded");h.assertReleased();
});

test("shutdown during an accepted replacement wait retains interruption and drains both tasks",async()=>{
  let sent=0,h;h=harness({run:async()=>{
    if(h.ctx.shutdownRequested)throw Object.assign(new Error("fixture shutdown"),{code:"AUTOMATION_INTERRUPTED"});
    sent++;return {ok:true,results:[]};
  }});
  const release=holdOlderRun(h);await Promise.resolve();let accepted;
  try{
    accepted=h.ctx.startManagedManualAutomation(h.event,{storedEvent:h.event});
    await Promise.resolve();assert.equal(sent,0);h.ctx.shutdownRequested=true;
    assert.equal(h.ctx.fullExportFreeze.activeAsyncMutations,2);
  }finally{release();await h.settle()}
  assert.equal(sent,0);assert.equal(h.event.lastRun.interrupted,true);
  assert.equal(h.ledger.runs.filter(row=>row.occurrenceId===accepted.occurrenceId).at(-1).status,"interrupted");h.assertReleased();
});
