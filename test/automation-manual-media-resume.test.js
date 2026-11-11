"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {makeLedger,occurrenceId,automationOccurrenceKey}=require("../src/automation-runtime");
const source=fs.readFileSync("src/server.js","utf8"),plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function fixture({state={version:1,runs:[]},limit=2,blocked=false,winner=true,enabled=true,legacyStop=false}={}){
  const now=new Date(2030,0,15,10),event={id:"lesson",enabled:true,time:"09:00",_planningBlockId:"first"};
  const id=occurrenceId(event,"2030-01-15",event.time),legacyId=occurrenceId({...event,_planningBlockId:null},"2030-01-15",event.time),starts=[];
  state=plain(state);let fail=false;
  const store={getPreference:()=>plain(state),setPreference:(_key,next)=>{if(fail)throw Error("fixture save failed");state=plain(next)}};
  const options={limit,now:()=>now},ledger=makeLedger(store,options);
  const ctx=vm.createContext({Date,Map,Set,Promise,occurrenceId,automationOccurrenceKey,
    automationSchedulerEnabled:enabled,schedulerClock:{now:()=>now,status:()=>({active:false}),commandsAllowed:()=>true},
    isAutomationSuppressed:()=>({blocked}),currentContinuousRecoveryWinnerIdentities:()=>new Set(winner?["winner"]:[]),
    automationOccurrenceIdentity:()=>"winner",automationOccurrenceIsActiveForContinuousRecovery:()=>true,
    automationOccurrenceScheduledMinutes:()=>540,localMinutesNow:()=>600,localDateKey:()=>"2030-01-15",
    classroomAutomations:{events:[event]},resolveAutomationOccurrences:value=>[value],
    automationRunLedger:ledger,automationRunningOccurrences:new Map(),automationCancellationReasons:new Map(),
    supersedeOverlappingAutomationRuns:()=>{},automationResourceKeys:()=>["display-content:screen"],
    startOwnedAutomationOccurrence:(...args)=>starts.push(args),executeScheduledAutomationOccurrence:()=>{},audit:()=>{}
  });
  vm.runInContext(section("function resolveScheduledAutomationOccurrences(","function resolveAutomationFromClass(")+section("async function recoverContinuousAutomationOccurrences(","async function reconcileScheduledAutomationState("),ctx);
  if(legacyStop)ledger.record({occurrenceId:legacyId,status:"cancel-requested",reason:"operator-cancelled"});
  return {ctx,id,legacyId,ledger,starts,get state(){return plain(state)},fail:()=>{fail=true},
    cancel:(reason="manual-media-priority",target=id)=>ledger.record({occurrenceId:target,status:"cancel-requested",reason}),
    restart:()=>makeLedger(store,options),recover:reason=>ctx.recoverContinuousAutomationOccurrences(reason)};
}
test("explicit Resume releases a proven takeover, while startup leaves it stopped",async()=>{
  const h=fixture();h.cancel();assert.equal((await h.recover("startup-reconcile")).started,0);
  assert.equal((await h.recover("operator-resume")).started,1);
  assert.equal(h.starts[0][0],h.id);assert.equal(h.ledger.cancelledOccurrenceIds().has(h.id),false);
  assert.equal(h.restart().claim(h.id).claimed,true,"released cancellation does not reappear after restart");
});
test("takeover disposition survives history eviction and restart",()=>{
  const h=fixture();h.cancel();for(let i=0;i<5;i++)h.ledger.record({occurrenceId:"other"+i,status:"succeeded"});
  assert.equal(h.ledger.read().runs.length,2);assert.equal(h.restart().manualMediaOccurrenceIds().has(h.id),true);
  assert.equal(h.restart().releaseManualMediaOccurrences([h.id]).has(h.id),true);
  assert.equal(h.restart().cancelledOccurrenceIds().has(h.id),false);
});
for(const reasons of [["operator-cancelled","manual-media-priority"],["manual-media-priority","operator-cancelled"],["superseded","manual-media-priority"]]){
  test("terminal Stop wins across history eviction: "+reasons.join(" then "),async()=>{
    const h=fixture();for(const reason of reasons)h.cancel(reason);
    for(let i=0;i<3;i++)h.ledger.record({occurrenceId:"other"+i,status:"succeeded"});
    assert.equal(h.restart().manualMediaOccurrenceIds().has(h.id),false);
    assert.equal((await h.recover("operator-resume")).started,0);
  });
}
test("legacy cancellations without disposition are never guessed to be resumable",async()=>{
  const h=fixture();h.cancel();const state=h.state;delete state.manualMediaOccurrences;
  const old=fixture({state});assert.equal((await old.recover("operator-resume")).started,0);
});
test("release persistence failure sends nothing and preserves the retained cancellation",async()=>{
  const h=fixture();h.cancel();const before=h.state;h.fail();
  await assert.rejects(h.recover("operator-resume"),/fixture save failed/);
  assert.equal(h.starts.length,0);assert.deepEqual(h.state,before);
});
test("Resume drains the old runner before selecting and starting its replacement",async()=>{
  const h=fixture();h.cancel();let finish;
  h.ctx.automationRunningOccurrences.set(h.id,new Promise(resolve=>{finish=()=>{h.ctx.automationRunningOccurrences.delete(h.id);h.ctx.automationCancellationReasons.delete(h.id);resolve()}}));
  h.ctx.automationCancellationReasons.set(h.id,"manual-media-priority");
  const pending=h.recover("operator-resume");await Promise.resolve();assert.equal(h.starts.length,0);
  finish();assert.equal((await pending).started,1);
});
for(const options of [{blocked:true},{winner:false},{enabled:false},{legacyStop:true}]){
  test("Resume retains takeover cancellation when ineligible: "+JSON.stringify(options),async()=>{
    const h=fixture(options);h.cancel();assert.equal((await h.recover("operator-resume")).started,0);
    assert.equal(h.restart().cancelledOccurrenceIds().has(h.id),true);
  });
}
test("releasing one takeover cannot clear a different occurrence",()=>{
  const h=fixture();h.cancel();h.cancel("manual-media-priority",h.legacyId);
  h.ledger.releaseManualMediaOccurrences([h.id]);assert.equal(h.restart().cancelledOccurrenceIds().has(h.legacyId),true);
});
