"use strict";

const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {makeLedger,occurrenceId}=require("../src/automation-runtime");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing production boundary: ${start}`);return source.slice(a,b);
}
function cancellationHarness({failFor=null,limit=500}={}){
  let state={version:1,runs:[]},writes=0;
  const attempts=[],audits=[],routes=new Map(),running=new Map(),meta=new Map(),cancelled=new Set(),reasons=new Map();
  const ledger=makeLedger({
    // SQLite reads parse JSON afresh; a failed write must not mutate persisted state.
    getPreference:()=>plain(state),
    setPreference:(_key,next)=>{
      writes++;attempts.push({cancelled:[...cancelled],reasons:[...reasons],next:plain(next)});
      if(next.runs.some(row=>row.occurrenceId===failFor))throw new Error("fixture cancellation save failed");
      state=plain(next);
    }
  },{limit});
  const ctx=vm.createContext({Date,Map,Set,Promise,automationRunLedger:ledger,
    automationRunningOccurrences:running,automationRunningOccurrenceMeta:meta,
    automationCancelledOccurrences:cancelled,automationCancellationReasons:reasons,
    automationResourceKeys:event=>event.resources||[],schedulerClock:{now:()=>new Date("2026-10-27T14:00:00Z")},
    audit:row=>audits.push(row),schedulerMutationLimit:()=>{},requireControl:()=>{},
    app:{post:(url,...handlers)=>routes.set(url,handlers.at(-1))}
  });
  const helper=source.includes("function requestAutomationRunCancellation(")
    ?section("function requestAutomationRunCancellation(","function startOwnedAutomationOccurrence("):"";
  vm.runInContext(helper+
    section("function supersedeOverlappingAutomationRuns(","async function executeScheduledAutomationOccurrence(")+
    section("function pauseActiveAutomationRunsForManualMedia(","async function pausePlayingMusicAssistantPlayersForManualMedia(")+
    section('app.post("/api/v1/automation-control/runs/:occurrenceId/cancel"','app.post("/api/v1/automation-control/resume"'),ctx);
  function add(id,{manual=true,resources=["display-content:screen"],task=Promise.resolve()}={}){
    running.set(id,task);meta.set(id,{manual,resources,automationId:`event-${id}`,classId:"class-a"});
  }
  function operator(id){const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
    routes.get("/api/v1/automation-control/runs/:occurrenceId/cancel")({params:{occurrenceId:id}},res);return res;
  }
  return {ctx,add,operator,ledger,running,meta,cancelled,reasons,attempts,audits,get state(){return state},get writes(){return writes}};
}
const methods={
  operator:h=>h.operator("first"),
  supersede:h=>h.ctx.supersedeOverlappingAutomationRuns({id:"replacement",resources:["display-content:screen"]},"new"),
  resume:h=>h.ctx.cancelActiveManualAutomationRuns(),
  replaceManual:h=>h.ctx.cancelOverlappingManualAutomationRuns({id:"replacement",resources:["display-content:screen"]}),
  manualMedia:h=>h.ctx.pauseActiveAutomationRunsForManualMedia()
};
for(const [name,invoke] of Object.entries(methods)){
  test(`${name} cancellation save failure leaves active execution unchanged`,async()=>{
    const h=cancellationHarness({failFor:"first"});h.add("first");h.add("second");
    await assert.rejects(async()=>invoke(h),/fixture cancellation save failed/);
    assert.deepEqual([...h.cancelled],[]);assert.deepEqual([...h.reasons],[]);
    assert.deepEqual(h.state.runs,[]);assert.equal(h.running.size,2);assert.equal(h.audits.length,0);
  });
}
for(const [name,invoke] of Object.entries(methods).filter(([name])=>name!=="operator")){
  test(`${name} cancels its whole selection with one durable write before changing execution`,async()=>{
    const h=cancellationHarness();h.add("first");h.add("second");
    assert.deepEqual(plain(await invoke(h)),["first","second"]);
    assert.equal(h.writes,1);assert.deepEqual(h.attempts[0].cancelled,[]);assert.deepEqual(h.attempts[0].reasons,[]);
    assert.deepEqual([...h.cancelled],["first","second"]);
    assert.deepEqual(h.state.runs.map(row=>row.occurrenceId),["first","second"]);
    const reason={supersede:"superseded",resume:"schedule-resumed",replaceManual:"manual-run-replaced",manualMedia:"manual-media-priority"}[name];
    assert.ok(h.state.runs.every(row=>row.status==="cancel-requested"&&row.reason===reason&&row.observedAt));
  });
  test(`${name} cannot partially cancel when persisting a later selected run fails`,async()=>{
    const h=cancellationHarness({failFor:"second"});h.add("first");h.add("second");
    await assert.rejects(async()=>invoke(h),/fixture cancellation save failed/);
    assert.deepEqual(h.state.runs,[]);assert.deepEqual([...h.cancelled],[]);assert.deepEqual([...h.reasons],[]);
  });
}
test("operator cancellation preserves the response and records before exposing the stop",()=>{
  const h=cancellationHarness();h.add("first");const res=h.operator("first");
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);
  assert.match(res.body.message,/Already-dispatched hardware actions are not undone/);
  assert.deepEqual(h.attempts[0].cancelled,[]);assert.equal(h.reasons.get("first"),"operator-cancelled");
  assert.equal(h.operator("absent").statusCode,404);assert.equal(h.writes,1);
});
test("manual cancellation keeps scheduled and disjoint work and awaits accepted manual work",async()=>{
  const h=cancellationHarness();let release;const held=new Promise(resolve=>{release=resolve});
  h.add("first",{task:held});h.add("scheduled",{manual:false});h.add("other",{resources:["lighting:lamp"]});
  let settled=false;const done=methods.replaceManual(h).then(ids=>{settled=true;return ids});
  await Promise.resolve();assert.equal(settled,false);assert.deepEqual([...h.cancelled],["first"]);
  release();assert.deepEqual(plain(await done),["first"]);
  assert.equal(h.state.runs[0].automationId,"event-first");assert.equal(h.state.runs[0].classId,"class-a");
});
test("empty cancellation selections do not write history",async()=>{
  const h=cancellationHarness();for(const [name,invoke] of Object.entries(methods))if(name!=="operator")assert.deepEqual(plain(await invoke(h)),[]);
  assert.equal(h.writes,0);
});
test("an oversized cancellation batch fails before losing any selected marker",async()=>{
  const h=cancellationHarness({limit:2});for(const id of ["first","second","third"])h.add(id);
  await assert.rejects(async()=>methods.resume(h),/ledger.*limit/i);
  assert.equal(h.writes,0);assert.deepEqual(h.state.runs,[]);assert.deepEqual([...h.cancelled],[]);
});
test("ledger batches retain bounded history and preserve single-record and claim behavior",()=>{
  const h=cancellationHarness({limit:3});const first={occurrenceId:"old",status:"succeeded"};
  assert.equal(h.ledger.record(first),first);h.add("first");h.add("second");methods.manualMedia(h);
  assert.deepEqual(h.state.runs.map(row=>row.occurrenceId),["old","first","second"]);
  assert.equal(h.ledger.claim("new").claimed,true);assert.equal(h.ledger.claim("new").claimed,false);
  assert.deepEqual(h.state.runs.map(row=>row.occurrenceId),["first","second","new"]);
});

function recoveryHarness(statuses){
  const now=new Date("2026-10-27T14:00:00Z"),event={id:"continuous",enabled:true,time:"10:00"};
  const id=occurrenceId(event,"2026-10-27",event.time),starts=[];
  const rows=statuses.map(status=>({occurrenceId:id,status}));
  const ctx=vm.createContext({Date,Map,Set,Promise,occurrenceId,
    automationSchedulerEnabled:true,schedulerClock:{now:()=>now,status:()=>({active:false}),commandsAllowed:()=>true},
    isAutomationSuppressed:()=>({blocked:false}),currentContinuousRecoveryWinnerIdentities:()=>new Set(["winner"]),
    automationOccurrenceIdentity:()=>"winner",automationOccurrenceIsActiveForContinuousRecovery:()=>true,
    automationOccurrenceScheduledMinutes:()=>600,localMinutesNow:()=>600,localDateKey:()=>"2026-10-27",
    classroomAutomations:{events:[event]},resolveAutomationOccurrences:value=>[value],
    automationRunLedger:{read:()=>({runs:rows}),record:row=>rows.push(row)},automationRunningOccurrences:new Map(),
    supersedeOverlappingAutomationRuns:()=>{},automationResourceKeys:()=>["display-content:screen"],
    startOwnedAutomationOccurrence:(...args)=>starts.push(args),executeScheduledAutomationOccurrence:()=>{},audit:()=>{}
  });
  vm.runInContext(section("async function recoverContinuousAutomationOccurrences(","async function reconcileScheduledAutomationState("),ctx);
  return {ctx,starts,rows,id};
}
for(const statuses of [["cancel-requested"],["cancel-requested","running"],["cancel-requested","interrupted"],["cancelled"]]){
  test(`restart recovery respects retained stop intent after ${statuses.join(" then ")}`,async()=>{
    const h=recoveryHarness(statuses);assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,0);
    assert.equal(h.starts.length,0);assert.equal(h.rows.length,statuses.length);
  });
}
test("shutdown interruption without cancellation remains recoverable",async()=>{
  const h=recoveryHarness(["interrupted"]);assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,1);assert.equal(h.starts.length,1);
});
test("a different occurrence's cancellation cannot suppress the current winner",async()=>{
  const h=recoveryHarness([]);h.rows.push({occurrenceId:"other-day",status:"cancel-requested"});
  assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,1);
});
