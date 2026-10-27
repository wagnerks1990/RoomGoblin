"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const schema=require("../src/automation-schema");
const {actionResourceDomain,SchedulerClock}=require("../src/automation-runtime");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const start=source.indexOf("async function runClassroomAutomation"),end=source.indexOf("function safeStoredName",start);
assert.ok(start>=0&&end>start);
const runner=source.slice(start,end);
function harness({onWait,actionCost=0}={}){
  let elapsed=0,wallShift=0;
  const calls=[],waits=[],origin=Date.parse("2026-10-27T14:00:00Z");
  class ClockDate extends Date{
    constructor(...args){super(...(args.length?args:[origin+elapsed+wallShift]))}
    static now(){return origin+elapsed+wallShift}
  }
  const ctx=vm.createContext({
    ...schema,Date:ClockDate,performance:{now:()=>elapsed},Set,Map,
    normalizeTimerOverlay:overlay=>overlay||null,
    automationTargetDomain:actionResourceDomain,automationDisplayTargets:targets=>targets,
    defaultAutomationActionTargets:()=>["all"],announcementLockedDisplayTargets:()=>[],
    automationCancelledOccurrences:new Set(),automationCancellationReasons:new Map(),
    automationSchedulerEnabled:true,shuttingDown:false,classroomAutomations:{events:[]},
    schedulerClock:{now:()=>new ClockDate(),commandsAllowed:()=>true},isAutomationSuppressed:()=>({blocked:false}),
    setTimeout:callback=>{throw new Error("Fixture timer must receive its delay")},
    runSingleAutomationAction:async event=>{calls.push({id:event._stepId,at:elapsed});elapsed+=actionCost;return {ok:true,results:[]}},
    audit:()=>{},diagnosticError:()=>{}
  });
  ctx.setTimeout=(callback,ms)=>{waits.push(ms);elapsed+=ms;onWait?.({ctx,elapsed,shiftWall:delta=>{wallShift+=delta}});queueMicrotask(callback);return 1};
  vm.runInContext(runner,ctx);
  const step=(id,extra={})=>({id,action:"display.clear",targets:["screen"],executionMode:"loop",...extra});
  return {calls,waits,ctx,step,get elapsed(){return elapsed},async run(sequence=[step("one"),step("two")],options={},extra={}){
    const event={id:"cycle-fixture",name:"Cycle fixture",revision:1,_occurrenceId:"cycle-fixture:run",actionSequence:sequence,...extra};
    ctx.classroomAutomations.events=[event];
    return ctx.runClassroomAutomation(event,{maxPasses:3,...options});
  }};
}

test("zero-delay continuous sequences wait between passes without a final extra wait",async()=>{
  const h=harness();const result=await h.run();
  assert.equal(result.passes,3);
  assert.deepEqual(h.calls.filter(x=>x.id==="one").map(x=>x.at),[0,1000,2000]);
  assert.equal(h.elapsed,2000);
  assert.ok(h.waits.every(ms=>ms<=500));
});

test("continuous cycle floor observes operator cancellation before another pass",async()=>{
  const h=harness({onWait:({ctx})=>ctx.automationCancelledOccurrences.add("cycle-fixture:run")});
  await assert.rejects(h.run(),error=>error.code==="AUTOMATION_CANCELLED");
  assert.equal(h.calls.length,2);
});

test("action time and configured dwell count toward the continuous floor",async()=>{
  const h=harness({actionCost:100});
  await h.run([h.step("one",{repeatDelaySeconds:.2}),h.step("two",{repeatDelaySeconds:.2})]);
  assert.deepEqual(h.calls.filter(x=>x.id==="one").map(x=>x.at),[0,1000,2000]);
  const slow=harness({actionCost:600});await slow.run();
  assert.deepEqual(slow.calls.filter(x=>x.id==="one").map(x=>x.at),[0,1200,2400]);
  assert.deepEqual(slow.waits,[0,0]);
});

test("a slow pass still yields so cancellation can be observed",async()=>{
  const h=harness({actionCost:600,onWait:({ctx})=>ctx.automationCancelledOccurrences.add("cycle-fixture:run")});
  await assert.rejects(h.run(),error=>error.code==="AUTOMATION_CANCELLED");
  assert.equal(h.calls.length,2);
  assert.deepEqual(h.waits,[0]);
});

test("one remaining continual action and finite-only repeats do not gain a floor",async()=>{
  const single=harness();assert.equal((await single.run([single.step("one")])).passes,1);
  assert.deepEqual(single.waits,[]);
  const finite=harness();assert.equal((await finite.run([finite.step("one",{executionMode:"repeat",repeatCount:3})])).passes,3);
  assert.deepEqual(finite.waits,[]);
  const bounded=harness();await bounded.run(undefined,{maxPasses:1});assert.deepEqual(bounded.waits,[]);
});

test("shutdown, scheduler pause and class end remain responsive during the floor",async()=>{
  for(const [change,code] of [[ctx=>{ctx.shuttingDown=true},"AUTOMATION_INTERRUPTED"],[ctx=>{ctx.automationSchedulerEnabled=false},"AUTOMATION_SCHEDULER_PAUSED"]]){
    const h=harness({onWait:({ctx})=>change(ctx)});
    await assert.rejects(h.run(),error=>error.code===code);
    assert.equal(h.calls.length,2);
  }
  const h=harness(),endAt=Date.parse("2026-10-27T14:00:00Z")+400;
  const result=await h.run(undefined,{}, {_classEndAt:endAt});
  assert.equal(result.endedReason,"class-ended");
  assert.equal(h.calls.length,2);
  assert.equal(h.elapsed,500);
});

test("wall-clock corrections cannot extend or skip monotonic waits",async()=>{
  for(const shift of [-3600000,3600000]){
    let changed=false;
    const h=harness({onWait:({shiftWall})=>{if(!changed){shiftWall(shift);changed=true}}});
    await h.run(undefined,{manual:true});
    assert.deepEqual(h.calls.filter(x=>x.id==="one").map(x=>x.at),[0,1000,2000]);
  }
});

test("configured waits keep their duration across wall-clock corrections",async()=>{
  for(const shift of [-3600000,3600000]){
    let changed=false;
    const h=harness({onWait:({shiftWall})=>{if(!changed){shiftWall(shift);changed=true}}});
    await h.run([h.step("one",{executionMode:"once",delaySeconds:1})],{manual:true,maxPasses:1});
    assert.equal(h.calls[0].at,1000);
    assert.equal(h.elapsed,1000);
  }
});

test("a native timer receives an event-loop turn between real continuous passes",async()=>{
  const h=harness();let yielded=false,secondPassYielded=false,calls=0;
  h.ctx.performance=performance;h.ctx.setTimeout=setTimeout;h.ctx.Date=Date;
  h.ctx.runSingleAutomationAction=async()=>{if(++calls===3)secondPassYielded=yielded;return {ok:true,results:[]}};
  const marker=setTimeout(()=>{yielded=true},0);
  try{await h.run(undefined,{manual:true,maxPasses:2});assert.equal(secondPassYielded,true)}
  finally{clearTimeout(marker)}
});

function simulation({live=false}={}){
  const clock=new SchedulerClock();clock.setSimulation("2026-10-27T14:00:00Z");
  if(live)clock.enableLiveCommands(1);
  return clock;
}
const dryRunError=error=>error.code==="AUTOMATION_SIMULATION_DRY_RUN";

test("scheduled sequences refuse admission in dry test-clock mode",async()=>{
  const h=harness();h.ctx.schedulerClock=simulation();
  await assert.rejects(h.run(),dryRunError);assert.equal(h.calls.length,0);
});

test("live simulation expiry stops a scheduled pre-action wait",async()=>{
  const clock=simulation({live:true});
  const h=harness({onWait:()=>{clock.liveExpiresAt=Date.now()-1}});h.ctx.schedulerClock=clock;
  await assert.rejects(h.run([h.step("one",{delaySeconds:1})]),dryRunError);
  assert.equal(h.calls.length,0);assert.equal(clock.status().liveCommands,false);
});

test("live simulation expiry stops scheduled dwell and continuous cycle waits",async()=>{
  for(const dwell of [0,1]){
    const clock=simulation({live:true});
    const h=harness({onWait:()=>{clock.liveExpiresAt=Date.now()-1}});h.ctx.schedulerClock=clock;
    await assert.rejects(h.run([h.step("one",{repeatDelaySeconds:dwell}),h.step("two")]),dryRunError);
    assert.equal(h.calls.length,dwell?1:2);
  }
});

test("switching a live simulation to dry mode prevents the next scheduled action",async()=>{
  const clock=simulation({live:true}),h=harness();h.ctx.schedulerClock=clock;
  const dispatch=h.ctx.runSingleAutomationAction;
  h.ctx.runSingleAutomationAction=async event=>{const result=await dispatch(event);clock.setSimulation(clock.now());return result};
  await assert.rejects(h.run(),dryRunError);assert.equal(h.calls.length,1);
});

test("expiry after an accepted final action prevents a new timer-overlay dispatch",async()=>{
  const clock=simulation({live:true}),h=harness();h.ctx.schedulerClock=clock;let overlays=0;
  const dispatch=h.ctx.runSingleAutomationAction;
  h.ctx.runSingleAutomationAction=async event=>{const result=await dispatch(event);clock.liveExpiresAt=Date.now()-1;return result};
  h.ctx.runAutomationTimerOverlay=async()=>{overlays++;return {ok:true}};
  await assert.rejects(h.run([h.step("one",{executionMode:"once"})],{},
    {timerOverlay:{enabled:true,source:"duration",durationSeconds:60}}),dryRunError);
  assert.equal(h.calls.length,1);assert.equal(overlays,0);
});

test("explicit manual runs remain available while the scheduler test clock is dry",async()=>{
  const h=harness();h.ctx.schedulerClock=simulation();
  assert.equal((await h.run(undefined,{manual:true,maxPasses:2})).ok,true);
  assert.equal(h.calls.length,4);
});

test("unexpired live simulation and return to real time retain scheduled execution",async()=>{
  for(const real of [false,true]){
    const h=harness(),clock=simulation({live:true});if(real)clock.clearSimulation();h.ctx.schedulerClock=clock;
    assert.equal((await h.run(undefined,{maxPasses:2})).ok,true);assert.equal(h.calls.length,4);
  }
});
