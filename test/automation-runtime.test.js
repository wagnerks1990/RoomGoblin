"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {
  actionResourceDomain,isDisplayContentAction,normalizeIntegerMinutes,
  expandDisplayTargets,expandTvTargets,summarizeAdapterResult,assertAdapterResults,
  SchedulerClock,occurrenceId,makeLedger
}=require("../src/automation-runtime");

const devices={
  tv1:{enabled:true,avOutput:1},tv2:{enabled:true,avOutput:2},tv3:{enabled:false,avOutput:3}
};

test("resource domains keep TV power and lighting separate from display content",()=>{
  assert.equal(actionResourceDomain("display.url"),"display-content");
  assert.equal(actionResourceDomain("display.timer.class-end"),"display-overlay");
  assert.equal(actionResourceDomain("tv.power"),"tv-power");
  assert.equal(actionResourceDomain("govee.brightness"),"lighting");
  assert.equal(isDisplayContentAction("tv.power"),false);
  assert.equal(isDisplayContentAction("display.url"),true);
});

test("display expansion never treats TV transport aliases as browser displays",()=>{
  assert.deepEqual(expandDisplayTargets(["hdmi-all"],{devices}),[]);
  assert.deepEqual(expandDisplayTargets(["all"],{devices}),["tv1","tv2"]);
});

test("TV aggregate selectors expand to individual known-good CEC outputs",()=>{
  assert.deepEqual(expandTvTargets(["all"],{devices}),[
    {id:"tv1",output:1,connection:"hdbt"},{id:"tv2",output:2,connection:"hdbt"}
  ]);
  assert.deepEqual(expandTvTargets(["hdmi-all"],{devices}),[
    {id:"tv1",output:1,connection:"hdmi"},{id:"tv2",output:2,connection:"hdmi"}
  ]);
});

test("whole-minute offsets are enforced",()=>{
  assert.equal(normalizeIntegerMinutes("5"),5);
  assert.throws(()=>normalizeIntegerMinutes(0.5),/whole number/);
});

test("negative and uncertain adapter acknowledgements are not success",()=>{
  assert.deepEqual(summarizeAdapterResult({ok:false,error:"rejected"}),{ok:false,status:"rejected",reason:"rejected"});
  assert.equal(summarizeAdapterResult({ok:true,pendingVerify:true}).status,"pending-verification");
  assert.throws(()=>assertAdapterResults([],{action:"TV power"}),/no executable targets/);
  assert.throws(()=>assertAdapterResults([{ok:false,error:"no ack"}],{action:"TV power"}),/did not complete successfully/);
  assert.doesNotThrow(()=>assertAdapterResults([{ok:true,verified:true}],{action:"TV power"}));
});

test("scheduler simulation is volatile and dry-run unless explicitly enabled",()=>{
  const clock=new SchedulerClock({timezone:"America/New_York"});
  assert.equal(clock.status().mode,"real");
  clock.setSimulation("2026-09-18T14:42:00Z");
  assert.equal(clock.status().mode,"simulated");
  assert.equal(clock.commandsAllowed(),false);
  clock.enableLiveCommands(1);
  assert.equal(clock.commandsAllowed(),true);
  clock.clearSimulation();
  assert.equal(clock.status().mode,"real");
  assert.equal(clock.commandsAllowed(),true);
});

test("durable ledger refuses a duplicate claimed occurrence",()=>{
  let value={version:1,runs:[]};
  const store={getPreference:(_key,fallback)=>value||fallback,setPreference:(_key,next)=>{value=next}};
  const ledger=makeLedger(store);
  const id=occurrenceId({id:"auto-1",classId:"class-1"},"2026-09-18","09:00");
  assert.equal(ledger.claim(id,{status:"claimed"}).claimed,true);
  assert.equal(ledger.claim(id,{status:"claimed"}).claimed,false);
});
