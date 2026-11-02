"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8"),runtime=require("../src/automation-runtime"),schema=require("../src/automation-schema"),studio=require("../src/planning-studio"),school=require("../src/school-schedule");
const plain=value=>JSON.parse(JSON.stringify(value)),key=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function fixture({legacyMark=false,rows=[],cancelled=[],now=new Date(2026,9,26,10),lighting=false}={}){
 const profile=school.normalizeSchoolScheduleProfile({anchorDate:"2026-10-26",planning:{enabled:true,defaultTimetableId:"regular",timetables:[{id:"regular",name:"Regular",blocks:[
  {id:"short",kind:"break",label:"First",startTime:"10:00",endTime:"10:30"},{id:"long",kind:"event",label:"Second",startTime:"10:00",endTime:"11:00"}]}]}});
 const action=lighting?"govee.power":"display.clear",targets=[lighting?"lamp":"screen"],event={id:"blocks",name:"Blocks",enabled:true,blockIds:["short","long"],targets,actionSequence:[
  {id:"one",action,targets,payload:{state:"on"},executionMode:"loop"},{id:"two",action,targets,payload:{state:"off"},executionMode:"loop"}],
  ...(legacyMark?{lastExecByClass:{manual:"2026-10-26 10:00"}}:{})};
 let state={version:1,runs:plain(rows),cancelledOccurrences:[...cancelled]};const starts=[],errors=[],superseded=[];
 const ledger=runtime.makeLedger({getPreference:()=>plain(state),setPreference:(_key,value)=>{state=plain(value)}},{now:()=>now});
 const ctx=vm.createContext({...runtime,...schema,Date,Set,Map,planningStudio:studio,schoolScheduleProfile:profile,schedulerCalendar:{},classroomAutomations:{events:[event]},
  localDateKey:key,localMinutesNow:date=>date.getHours()*60+date.getMinutes(),automationClassIds:()=>[],automationMatchesDate:()=>({match:true}),
  schedulerClock:{now:()=>now,status:()=>({active:false}),commandsAllowed:()=>true},shutdownRequested:false,fullExportFreeze:{requested:false},automationSchedulerBusy:false,automationSchedulerEnabled:true,
  isAutomationSuppressed:()=>({blocked:false}),SCHEDULER_CATCHUP_MINUTES:2,automationRunLedger:ledger,
  morningAnnouncementsRuntime:{active:false},announcementLockedDisplayTargets:()=>[],persistAutomations:()=>{},
  automationRunningOccurrences:new Map(),startOwnedAutomationOccurrence:(id,meta,task)=>starts.push({id,meta,task}),executeScheduledAutomationOccurrence:()=>{},
  supersedeOverlappingAutomationRuns:(event,id)=>superseded.push({event,id}),audit:()=>{},diagnosticError:error=>errors.push(error),
  devices:{screen:{enabled:true}},automationDisplayTargets:targets=>runtime.expandDisplayTargets(targets,{devices:{screen:{enabled:true}}}),
  automationTargetDomain:runtime.actionResourceDomain,defaultAutomationActionTargets:()=>["all"],cleanId:value=>String(value).toLowerCase(),goveeDevices:{lamp:{}},goveeGroups:{}
 });
 vm.runInContext(section("function resolveAutomationOccurrences(","function resolveAutomationFromClass(")+
  section("function automationDeferredDisplayTargets(","async function runDisplayAutomationResync(")+
  section("function goveeTargets(","async function goveeUdpTemperature(")+
  section("function currentAutomationNonDisplayWinners(","function planAutomationNonDisplayDispatches(")+
  section("function automationResourceKeys(","function automationConflictDiagnostics(")+
  section("function automationOccurrenceIsActiveForContinuousRecovery(","async function reconcileScheduledAutomationState(")+
  section("async function automationSchedulerTick(","let automationStartupReconcilePending"),ctx);
 return {ctx,event,ledger,starts,errors,superseded,now,get state(){return state},runs:()=>ctx.resolveAutomationOccurrences(event,now)};
}
const oldId="blocks:manual:2026-10-26:10:00";
test("simultaneous timetable blocks receive distinct execution and recovery identities",()=>{
 const h=fixture(),runs=h.runs();assert.equal(runs.length,2);
 assert.equal(new Set(runs.map(run=>runtime.occurrenceId(run,key(h.now),run.time))).size,2);
 assert.equal(new Set(runs.map(run=>h.ctx.automationOccurrenceIdentity(h.event,run))).size,2);
});
test("the live tick admits both distinct blocks and retains their individual execution markers",async()=>{
 const h=fixture();await h.ctx.automationSchedulerTick();assert.deepEqual(h.errors,[]);assert.equal(h.starts.length,2);assert.equal(new Set(h.starts.map(row=>row.id)).size,2);
 assert.equal(h.event.lastExecByClass["block:short"],"2026-10-26 10:00");assert.equal(h.event.lastExecByClass["block:long"],"2026-10-26 10:00");
 await h.ctx.automationSchedulerTick();assert.equal(h.starts.length,2);
});
for(const lighting of [false,true])test("equal-time "+(lighting?"lighting":"display")+" recovery agrees with the last live block",()=>{
 const h=fixture({lighting}),rows=lighting?h.ctx.currentAutomationNonDisplayWinners(h.now):h.ctx.currentAutomationDisplayWinners(h.now);
 assert.equal(rows.length,1);assert.equal((rows[0].occurrence||rows[0].event)._planningBlockId,"long");
});
test("continuous recovery selects only the complete final block owner",async()=>{
 const h=fixture();const result=await h.ctx.recoverContinuousAutomationOccurrences();
 assert.equal(result.started,1);assert.equal(h.starts.length,1);assert.match(h.starts[0].id,/:block:long:/);
});
test("the historical manual execution marker prevents replay during upgrade",async()=>{
 const h=fixture({legacyMark:true});await h.ctx.automationSchedulerTick();assert.deepEqual(h.errors,[]);assert.equal(h.starts.length,0);assert.equal(h.state.runs.length,0);
});
for(const status of ["claimed","running","succeeded"])test("historical "+status+" block identity prevents uncertain replay after upgrade",async()=>{
 const h=fixture({rows:[{occurrenceId:oldId,status}]});await h.ctx.automationSchedulerTick();assert.deepEqual(h.errors,[]);assert.equal(h.starts.length,0);assert.equal(h.state.runs.length,1);
});
test("retained historical Stop protects every formerly ambiguous block during tick and recovery",async()=>{
 const h=fixture({cancelled:[oldId]});await h.ctx.automationSchedulerTick();assert.deepEqual(h.errors,[]);assert.equal(h.starts.length,0);
 assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,0);
 assert.ok(h.ledger.cancelledOccurrenceIds().has(oldId));
});
test("a stopped new block winner does not revive its earlier same-time block",async()=>{
 const h=fixture();const winner=h.runs().find(run=>run._planningBlockId==="long"),id=runtime.occurrenceId(winner,key(h.now),winner.time);
 h.ledger.record({occurrenceId:id,status:"cancelled"});assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,0);assert.equal(h.starts.length,0);
});
test("ordinary class and clock identities remain byte-for-byte compatible",()=>{
 assert.equal(runtime.occurrenceId({id:"event",classId:"class"},"2026-10-26","10:00"),"event:class:2026-10-26:10:00");
 assert.equal(runtime.occurrenceId({id:"event"},"2026-10-26","10:00"),"event:manual:2026-10-26:10:00");
});

for(const status of ["cancel-requested","cancelled"])test("historical "+status+" block rows protect live admission and recovery",async()=>{
 const h=fixture({rows:[{occurrenceId:oldId,status}]});await h.ctx.automationSchedulerTick();
 assert.deepEqual(h.errors,[]);assert.equal(h.starts.length,0);
 assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,0);
});

test("an unrelated historical Stop does not suppress the current block winner",async()=>{
 const h=fixture({cancelled:[oldId.replace("blocks:","another:")]});
 assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,1);
 assert.match(h.starts[0].id,/:block:long:/);
});

test("stopping the earlier block does not suppress the distinct current winner",async()=>{
 const h=fixture(),earlier=h.runs().find(run=>run._planningBlockId==="short");
 h.ledger.record({occurrenceId:runtime.occurrenceId(earlier,key(h.now),earlier.time),status:"cancelled"});
 assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,1);
 assert.match(h.starts[0].id,/:block:long:/);
});
