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
