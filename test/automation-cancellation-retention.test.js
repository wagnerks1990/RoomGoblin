"use strict";

const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {makeLedger,occurrenceId}=require("../src/automation-runtime");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function fixture({limit=500,cancellationLimit=5000,state={version:1,runs:[]},date=new Date(2026,9,27,10)}={}){
  state=plain(state);let writes=0,fail=false;
  const store={getPreference:()=>plain(state),setPreference:(_key,next)=>{writes++;if(fail)throw new Error("fixture save failed");state=plain(next)}};
  const options={limit,cancellationLimit,now:()=>date};
  return {ledger:makeLedger(store,options),get state(){return plain(state)},get writes(){return writes},
    setFailure:value=>{fail=value},setDate:value=>{date=value},restart:()=>makeLedger(store,options)};
}
const id=(date="2026-10-27",name="winner")=>occurrenceId({id:name},date,"10:00");
function recover(ledger){
  const event={id:"winner",enabled:true,time:"10:00"},now=new Date(2026,9,27,10),starts=[];
  const ctx=vm.createContext({Date,Map,Set,Promise,occurrenceId,automationRunLedger:ledger,
    automationSchedulerEnabled:true,schedulerClock:{now:()=>now,status:()=>({active:false}),commandsAllowed:()=>true},
    isAutomationSuppressed:()=>({blocked:false}),currentContinuousRecoveryWinnerIdentities:()=>new Set(["winner"]),
    automationOccurrenceIdentity:()=>"winner",automationOccurrenceIsActiveForContinuousRecovery:()=>true,
    automationOccurrenceScheduledMinutes:()=>600,localMinutesNow:()=>600,localDateKey:()=>"2026-10-27",
    classroomAutomations:{events:[event]},resolveAutomationOccurrences:value=>[value],automationRunningOccurrences:new Map(),
    supersedeOverlappingAutomationRuns:()=>{},automationResourceKeys:()=>["display-content:screen"],
    startOwnedAutomationOccurrence:(...args)=>starts.push(args),executeScheduledAutomationOccurrence:()=>{},audit:()=>{}
  });
  vm.runInContext(section("function resolveScheduledAutomationOccurrences(","function resolveAutomationFromClass(")+section("async function recoverContinuousAutomationOccurrences(","async function reconcileScheduledAutomationState("),ctx);
  return ctx.recoverContinuousAutomationOccurrences();
}

test("500 later history rows cannot revive a stopped current winner after restart",async()=>{
  const h=fixture();h.ledger.record({occurrenceId:id(),status:"cancel-requested",reason:"operator-cancelled"});
  for(let i=0;i<500;i++)h.ledger.record({occurrenceId:"unrelated-"+i,status:"succeeded"});
  assert.equal(h.ledger.read().runs.length,500);
  assert.equal(h.ledger.read().runs.some(row=>row.occurrenceId===id()),false);
  assert.equal((await recover(h.restart())).started,0);
});
test("legacy cancellation history migrates before an ordinary batch evicts it",async()=>{
  const h=fixture({limit:2,state:{version:1,runs:[{occurrenceId:id(),status:"cancelled"}]}});
  h.ledger.recordMany([{occurrenceId:"one",status:"succeeded"},{occurrenceId:"two",status:"succeeded"}]);
  assert.equal((await recover(h.restart())).started,0);
  assert.deepEqual(Object.keys(h.ledger.read()).sort(),["runs","version"],"public history shape remains compatible");
});
test("claims preserve Stop identities while retaining duplicate-claim behavior",async()=>{
  const h=fixture({limit:2});h.ledger.record({occurrenceId:id(),status:"cancel-requested"});
  assert.equal(h.ledger.claim("one").claimed,true);assert.equal(h.ledger.claim("two").claimed,true);
  assert.equal(h.ledger.claim("two").claimed,false);assert.equal((await recover(h.restart())).started,0);
});
test("failed persistence cannot accept or lose a durable Stop identity",()=>{
  const h=fixture();h.ledger.record({occurrenceId:id(),status:"cancel-requested"});const before=h.state;
  h.setFailure(true);assert.throws(()=>h.ledger.record({occurrenceId:id("2026-10-27","second"),status:"cancel-requested"}),/fixture save failed/);
  assert.deepEqual(h.state,before);h.setFailure(false);
  assert.deepEqual([...h.restart().cancelledOccurrenceIds()],[id()]);
});
test("Stop retention capacity rejects the entire selection before changing execution",()=>{
  const h=fixture({cancellationLimit:1});h.ledger.record({occurrenceId:id(),status:"cancel-requested"});
  const before=h.state,second=id("2026-10-27","second"),cancelled=new Set(),reasons=new Map();
  const ctx=vm.createContext({Date,Map,Set,automationRunLedger:h.ledger,
    automationCancelledOccurrences:cancelled,automationCancellationReasons:reasons,
    automationRunningOccurrenceMeta:new Map([[second,{automationId:"second"}]]),schedulerClock:{now:()=>new Date(2026,9,27,10)}});
  vm.runInContext(section("function requestAutomationRunCancellation(","function startOwnedAutomationOccurrence("),ctx);
  assert.throws(()=>ctx.requestAutomationRunCancellation([second],"operator-cancelled"),/cancellation.*limit/i);
  assert.deepEqual(h.state,before);assert.equal(cancelled.size,0);assert.equal(reasons.size,0);
});
test("repeated markers do not consume additional retention capacity",()=>{
  const h=fixture({cancellationLimit:1});h.ledger.record({occurrenceId:id(),status:"cancel-requested"});
  h.ledger.record({occurrenceId:id(),status:"cancelled"});
  assert.deepEqual(h.state.cancelledOccurrences,[id()]);
});
test("real local date cleanup retains yesterday, today and future simulation identities",()=>{
  const retained=[id("2026-10-26"),id(),id("2050-01-01")];
  const h=fixture({state:{version:1,runs:[],cancelledOccurrences:[id("2026-10-25"),...retained]}});
  h.ledger.record({occurrenceId:"ordinary",status:"succeeded"});
  assert.deepEqual(h.state.cancelledOccurrences,retained);
  h.setDate(new Date(2026,9,28,0,1));h.ledger.record({occurrenceId:"next-day",status:"succeeded"});
  assert.deepEqual(h.state.cancelledOccurrences,[id(),id("2050-01-01")]);
});
test("empty batches do not persist cleanup and manual IDs remain ordinary history",()=>{
  const h=fixture();h.ledger.recordMany([]);assert.equal(h.writes,0);
  h.ledger.record({occurrenceId:"manual:winner:unique",status:"cancel-requested"});
  assert.deepEqual(h.state.cancelledOccurrences,[]);assert.equal(h.ledger.read().runs.length,1);
});
test("UTF-8 retention byte limits reject a Stop without writing or losing earlier Stops",()=>{
  const h=fixture();h.ledger.record({occurrenceId:id(),status:"cancel-requested"});
  const before=h.state,writes=h.writes;
  const oversized=id("2026-10-27","\u{1f47a}".repeat(270000));
  assert.throws(()=>h.ledger.record({occurrenceId:oversized,status:"cancel-requested"}),/cancellation.*limit/i);
  assert.equal(h.writes,writes);assert.deepEqual(h.state,before);
  assert.deepEqual([...h.restart().cancelledOccurrenceIds()],[id()]);
});
test("real-date expiry frees retention capacity across restart without simulated-date cleanup",()=>{
  const h=fixture({limit:1,cancellationLimit:1});h.ledger.record({occurrenceId:id("2026-10-26"),status:"cancel-requested"});
  h.ledger.record({occurrenceId:"history-eviction",status:"succeeded"});
  assert.throws(()=>h.restart().record({occurrenceId:id(),status:"cancel-requested"}),/cancellation.*limit/i);
  h.setDate(new Date(2026,9,28,0,1));
  h.restart().record({occurrenceId:id(),status:"cancel-requested"});
  assert.deepEqual(h.state.cancelledOccurrences,[id()]);
});
for(const cancelledOccurrences of [null,"invalid",["invalid"],[id("2026-02-30")],[id(),id("2026-10-27","second")]]){
  test("invalid or oversized protected state fails closed: "+JSON.stringify(cancelledOccurrences),async()=>{
    const h=fixture({cancellationLimit:1,state:{version:1,runs:[],cancelledOccurrences}});
    await assert.rejects(recover(h.ledger),/cancellation/i);assert.equal(h.writes,0);
  });
}
