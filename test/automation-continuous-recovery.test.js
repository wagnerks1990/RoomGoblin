"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const schema=require("../src/automation-schema");
const runtime=require("../src/automation-runtime");
const source=fs.readFileSync("src/server.js","utf8");
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing production boundary: ${start}`);
  return source.slice(a,b);
}

// Execute recovery, the occurrence lifecycle and the real ordered runner. Only
// appliance I/O and timetable/winner inputs are replaced; waits use a fake clock.
function harness({cancelReason="manual-media-priority",status="cancelled",blocked=false,enabled=true,dryRun=false,winner=true,expired=false,locked=false}={}){
  const initial=Date.parse("2026-10-08T10:00:00Z");
  let stamp=initial,ledgerValue={version:1,runs:[]};
  class Clock extends Date{
    constructor(...args){super(...(args.length?args:[stamp]));}
    static now(){return stamp;}
  }
  const commands=[],timers=[],audits=[];
  const event={id:"lesson",name:"Lesson fixture",enabled:true,revision:1,classId:"period",time:"09:00",targets:["tv1"],
    _class:{id:"period"},_classStartAt:initial-3600000,_classEndAt:initial+(expired?0:61000),_classDefaultTargets:["tv1"],
    timerOverlay:{enabled:true,source:"class-end"},
    actionSequence:["lesson","reminder"].map(id=>({id,action:"display.text",targets:["tv1"],executionMode:"loop",repeatDelaySeconds:15,payload:{text:id}}))};
  const ledger=runtime.makeLedger({getPreference:()=>ledgerValue,setPreference:(_key,value)=>{ledgerValue=value;}});
  const id=runtime.occurrenceId(event,"2026-10-08",event.time);
  if(status)ledger.record({occurrenceId:id,status,reason:cancelReason});
  const ctx=vm.createContext({
    ...schema,...runtime,Date:Clock,Map,Set,
    setTimeout:(callback,ms)=>{stamp+=ms;queueMicrotask(callback);},
    schedulerClock:{now:()=>new Clock(),status:()=>({active:dryRun}),commandsAllowed:()=>!dryRun},
    localDateKey:()=>"2026-10-08",localMinutesNow:now=>now.getUTCHours()*60+now.getUTCMinutes(),
    automationOccurrenceScheduledMinutes:item=>{const [h,m]=item.time.split(":").map(Number);return h*60+m;},
    automationSchedulerEnabled:enabled,isAutomationSuppressed:()=>({blocked,reason:"no-school"}),
    classroomAutomations:{events:[event]},resolveAutomationOccurrences:item=>[item],
    automationMatchesDate:item=>({match:item.matchDate!==false}),
    currentAutomationDisplayWinners:()=>winner?[{storedEvent:event,event}]:[],currentAutomationNonDisplayWinners:()=>[],
    automationRunningOccurrences:new Map(),automationRunningOccurrenceMeta:new Map(),
    automationCancelledOccurrences:new Set(),automationCancellationReasons:new Map(),automationRunLedger:ledger,
    supersedeOverlappingAutomationRuns:()=>{},automationResourceKeys:()=>["display-content:tv1"],
    trackFullExportMutation:task=>task,persistAutomations:()=>{},
    normalizeTimerOverlay:overlay=>overlay,automationTargetDomain:runtime.actionResourceDomain,
    automationDisplayTargets:targets=>targets,defaultAutomationActionTargets:()=>["tv1"],
    announcementLockedDisplayTargets:()=>locked?["tv1"]:[],
    runSingleAutomationAction:async item=>{commands.push({text:item.payload.text,at:stamp});return {ok:true,results:[]};},
    runAutomationTimerOverlay:async item=>{timers.push(item._classEndAt);return {ok:true};},
    audit:entry=>audits.push(entry),diagnosticError:error=>{throw error;}
  });
  vm.runInContext(
    section("function automationRunFailures","function safeStoredName")+"\n"+
    section("function automationOccurrenceIsActiveForContinuousRecovery","async function reconcileScheduledAutomationState")+"\n"+
    section("async function executeScheduledAutomationOccurrence","async function automationSchedulerTick"),ctx);
  return {ctx,event,id,ledger,commands,timers,audits,initial,
    recover:reason=>ctx.recoverContinuousAutomationOccurrences(reason),
    drain:()=>Promise.all([...ctx.automationRunningOccurrences.values()])};
}

test("Resume restarts the interrupted current sequence beyond catch-up and advances every 15 seconds",async()=>{
  const h=harness();
  assert.equal((await h.recover("operator-resume")).started,1);
  await h.drain();
  assert.deepEqual(h.commands.map(row=>row.text),["lesson","reminder","lesson","reminder","lesson"]);
  assert.deepEqual(h.commands.map(row=>row.at-h.initial),[0,15000,30000,45000,60000]);
  assert.ok(h.timers.length>1);
  assert.ok(h.timers.every(end=>end===h.event._classEndAt));
  assert.equal(h.ctx.automationRunningOccurrences.size,0,"class end removes the recovered occurrence");
  assert.equal(h.ledger.read().runs.at(-1).status,"succeeded");
});

test("Resume drains an interruption still cancelling before reusing its occurrence",async()=>{
  const h=harness({status:"cancel-requested"});
  let finish;
  const oldTask=new Promise(resolve=>{finish=()=>{
    h.ledger.record({occurrenceId:h.id,status:"cancelled",reason:"manual-media-priority"});
    h.ctx.automationRunningOccurrences.delete(h.id);
    h.ctx.automationCancellationReasons.delete(h.id);
    h.ctx.automationCancelledOccurrences.delete(h.id);
    resolve();
  };});
  h.ctx.automationRunningOccurrences.set(h.id,oldTask);
  h.ctx.automationCancellationReasons.set(h.id,"manual-media-priority");
  h.ctx.automationCancelledOccurrences.add(h.id);
  const recovery=h.recover("operator-resume");
  assert.equal(h.commands.length,0);
  finish();
  assert.equal((await recovery).started,1);
  await h.drain();
  assert.equal(h.commands[1].text,"reminder");
  assert.equal(h.ledger.read().runs.at(-1).status,"succeeded");
});

for(const reason of ["operator-cancelled","superseded","manual-run-replaced","cancelled",undefined]){
  test(`Resume preserves explicit/other cancellation: ${reason}`,async()=>{
    const h=harness({cancelReason:reason||""});
    assert.equal((await h.recover("operator-resume")).started,0);
    assert.equal(h.commands.length,0);
  });
}
for(const reason of ["startup-reconcile","scheduler-recovery"]){
  test(`${reason} cannot release a manual-media cancellation`,async()=>{
    const h=harness();
    assert.equal((await h.recover(reason)).started,0);
    assert.equal(h.commands.length,0);
  });
}
for(const options of [{blocked:true},{enabled:false},{dryRun:true},{winner:false},{expired:true}]){
  test(`Resume retains scheduling boundaries: ${JSON.stringify(options)}`,async()=>{
    const h=harness(options);
    assert.equal((await h.recover("operator-resume")).started,0);
    assert.equal(h.commands.length,0);
  });
}
test("Resume does not duplicate an occurrence already running",async()=>{
  const h=harness({status:"running"});
  h.ctx.automationRunningOccurrences.set(h.id,Promise.resolve());
  assert.equal((await h.recover("operator-resume")).started,0);
  assert.equal(h.commands.length,0);
});
test("recovered loops still defer to Morning Announcements",async()=>{
  const h=harness({locked:true});
  assert.equal((await h.recover("operator-resume")).started,1);
  await h.drain();
  assert.equal(h.commands.length,0);
  assert.equal(h.timers.length,0);
});
test("startup still recovers a current sequence interrupted by process restart",async()=>{
  const h=harness({status:"running"});
  assert.equal((await h.recover("startup-reconcile")).started,1);
  await h.drain();
  assert.ok(h.commands.length>2);
});
