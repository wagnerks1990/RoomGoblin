"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const root=require('node:path').resolve(__dirname,'..'),source=fs.readFileSync(root+'/src/server.js','utf8'),runtime=require(root+'/src/automation-runtime'),schema=require(root+'/src/automation-schema'),studio=require(root+'/src/planning-studio'),school=require(root+'/src/school-schedule');
const key=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function extract(name){const match=new RegExp('(?:async )?function '+name+'\\(').exec(source);assert.ok(match,name);const start=match.index,next=source.slice(start+1).search(/\n(?:async )?function /);assert.ok(next>=0,name);return source.slice(start,start+1+next)}
function harness({weekday=2,start='00:30',end='01:00',offset=-60,now=new Date(2026,9,26,23,31),action='govee.power',block=false,delay=0,steps=null,blocked=false}={}){
 const cls={id:'class',name:'Class fixture',enabled:true,scheduleMode:'weekly',days:[weekday],startTime:start,endTime:end,defaultTargets:['screen']};
 const event={id:'routine',enabled:true,classIds:block?[]:['class'],...(block?{blockIds:['block']}:{}),classTimeOffsetMinutes:offset,action,targets:[action.startsWith('display.')?'screen':'lamp'],payload:{state:'on'},
 actionSequence:steps||[{id:'first',action,targets:[action.startsWith('display.')?'screen':'lamp'],payload:{state:'on'},delaySeconds:delay}]};
 const profile=school.normalizeSchoolScheduleProfile({anchorDate:'2026-10-26',planning:{enabled:true,dates:{'2026-10-27':{status:'school',timetableId:'special'}},timetables:[{id:'special',name:'Fixture',blocks:[{id:'block',kind:'break',label:'Block',startTime:start,endTime:end}]}]}});
 let elapsed=0; const calls=[];
 const ctx=vm.createContext({...runtime,...schema,Date,Map,Set,planningStudio:studio,schoolScheduleProfile:profile,schedulerCalendar:{},devices:{screen:{enabled:true,avOutput:1}},goveeDevices:{lamp:{}},goveeGroups:{},
  localDateKey:key,localMinutesNow:d=>d.getHours()*60+d.getMinutes(),schedulerClock:{now:()=>new Date(now.getTime()+elapsed),commandsAllowed:()=>true},schoolCycleForDate:()=>({}),
  classroomAutomations:{events:[event]},isAutomationSuppressed:()=>({blocked}),cleanId:v=>String(v).toLowerCase(),automationTargetDomain:runtime.actionResourceDomain,automationDisplayTargets:t=>runtime.expandDisplayTargets(t,{devices:{screen:{enabled:true}}}),
  defaultAutomationActionTargets:()=>['all'],classScheduleById:()=>cls,schoolCycleAnchor:()=>'',periodDefaultCycleDays:()=>[],isTransitionClass:()=>false,
  effectiveClassTimes:()=>({startTime:start,endTime:end}),classStartDate:(_cls,date)=>new Date(key(date)+'T'+start+':00'),classEndDate:(_cls,date)=>new Date(key(date)+'T'+end+':00'),
  performance:{now:()=>elapsed},setTimeout:(cb,ms)=>{elapsed+=ms;queueMicrotask(cb);return 1},shuttingDown:false,automationSchedulerEnabled:true,
  automationCancelledOccurrences:new Set(),automationCancellationReasons:new Map(),normalizeTimerOverlay:()=>null,announcementLockedDisplayTargets:()=>[],
  runSingleAutomationAction:async e=>{calls.push(e.action);return {ok:true,results:[]}},audit:()=>{},diagnosticError:()=>{}
 });
 const names=['goveeTargets','automationMatchesDate','automationClassIds','resolveAutomationForClass','resolveAutomationOccurrences','automationOccurrenceScheduledMinutes','automationDeferredDisplayTargets','automationOccurrenceIsCurrentlyApplicable','automationDueActionSequence','currentAutomationDisplayWinners','currentAutomationNonDisplayWinners','automationOccurrenceIsActiveForContinuousRecovery','evaluateAutomationAt','runClassroomAutomation'];
 if(source.includes('function resolveScheduledAutomationOccurrences('))names.push('resolveScheduledAutomationOccurrences');
 for(const name of names)vm.runInContext(extract(name),ctx);
 ctx.classScheduleMatchesDate=(c,date)=>ctx.automationMatchesDate(c,date).match;
 ctx.effectiveClassSegments=(c,date)=>ctx.classScheduleMatchesDate(c,date)?[{startTime:start,endTime:end}]:[];
 const liveOccurrences=()=>[-1,0,1].flatMap(offset=>{const d=new Date(now);d.setDate(d.getDate()+offset);return ctx.resolveAutomationOccurrences(event,d)}).filter(e=>e._scheduledDateKey===key(now));
 return {ctx,event,now,calls,liveOccurrences};
}
test('before-midnight class power intent is available to recovery',async()=>{
 const h=harness(),run=h.liveOccurrences()[0];assert.ok(run);await h.ctx.runClassroomAutomation(run);assert.equal(h.calls.length,1);
 assert.equal(h.ctx.currentAutomationNonDisplayWinners(h.now).length,1);
});
test('before-midnight timetable block intent is available to recovery',()=>{
 const h=harness({block:true});assert.equal(h.liveOccurrences().length,1);assert.equal(h.ctx.currentAutomationNonDisplayWinners(h.now).length,1);
});
test('before-midnight class display intent is available to recovery',()=>{
 const h=harness({action:'display.clear'});assert.equal(h.liveOccurrences().length,1);assert.equal(h.ctx.currentAutomationDisplayWinners(h.now).length,1);
});
test('same-day pre-class display preparation remains recoverable',()=>{
 const h=harness({weekday:1,start:'10:00',end:'11:00',offset:-10,now:new Date(2026,9,26,9,51),action:'display.clear'});
 assert.equal(h.ctx.currentAutomationDisplayWinners(h.now).length,1);
});
test('pre-class continuous occurrence remains recoverable before class starts',()=>{
 const h=harness({steps:[{id:'one',action:'govee.power',targets:['lamp'],payload:{state:'on'},executionMode:'loop'},{id:'two',action:'govee.power',targets:['lamp'],payload:{state:'off'},executionMode:'loop'}]});
 assert.equal(h.ctx.automationOccurrenceIsActiveForContinuousRecovery(h.liveOccurrences()[0],h.now),true);
});
test('diagnostics include a previous-day class with a positive offset',()=>{
 const h=harness({weekday:1,start:'23:30',end:'23:59',offset:60,now:new Date(2026,9,27,0,31)});
 assert.equal(h.liveOccurrences().length,1);assert.equal(h.ctx.evaluateAutomationAt(h.now).items.length,1);
});
test('a positive offset after class end cannot become recovered device state',async()=>{
 const h=harness({weekday:1,start:'10:00',end:'11:00',offset:65,now:new Date(2026,9,26,11,6)}),run=h.liveOccurrences()[0];
 assert.equal((await h.ctx.runClassroomAutomation(run)).endedReason,'class-ended');assert.equal(h.calls.length,0);assert.equal(h.ctx.currentAutomationNonDisplayWinners(h.now).length,0);
});
test('a pre-action delay crossing class end cannot become recovered device state',async()=>{
 const h=harness({weekday:1,start:'10:00',end:'10:01',offset:0,delay:120,now:new Date(2026,9,26,10,0)});
 assert.equal((await h.ctx.runClassroomAutomation(h.liveOccurrences()[0])).endedReason,'class-ended');assert.equal(h.calls.length,0);
 assert.equal(h.ctx.currentAutomationNonDisplayWinners(new Date(2026,9,26,10,2)).length,0);
});
test('an already due one-shot state remains recoverable after its class ends',()=>{
 const h=harness({weekday:1,start:'10:00',end:'10:01',offset:0,now:new Date(2026,9,26,10,2)});
 assert.equal(h.ctx.currentAutomationNonDisplayWinners(h.now).length,1);
});
test('school suppression still rejects a pre-class recovery candidate',()=>{
 const h=harness({blocked:true});assert.equal(h.ctx.currentAutomationNonDisplayWinners(h.now).length,0);assert.equal(h.ctx.currentAutomationDisplayWinners(h.now).length,0);
});

test('recovery retains the executed state before a class-ending dwell',async()=>{
 const h=harness({weekday:1,start:'10:00',end:'10:01',offset:0,now:new Date(2026,9,26,10,0),steps:[
  {id:'on',action:'govee.power',targets:['lamp'],payload:{state:'on'},repeatDelaySeconds:120},
  {id:'off',action:'govee.power',targets:['lamp'],payload:{state:'off'}}]});
 assert.equal((await h.ctx.runClassroomAutomation(h.liveOccurrences()[0])).endedReason,'class-ended');assert.equal(h.calls.length,1);
 const winners=h.ctx.currentAutomationNonDisplayWinners(new Date(2026,9,26,10,2));assert.equal(winners.length,1);assert.equal(winners[0].event.payload.state,'on');
});
test('future next-day state is not applied on its source date',()=>{
 const h=harness({weekday:1,start:'23:30',end:'23:59',offset:60,now:new Date(2026,9,26,23,40)});
 assert.equal(h.liveOccurrences().length,0);assert.equal(h.ctx.currentAutomationNonDisplayWinners(h.now).length,0);assert.equal(h.ctx.currentAutomationDisplayWinners(h.now).length,0);
});
function timerHarness(options={}){
 const h=harness({action:'display.timer.class-end',...options}),commands=[],NativeDate=Date;
 class ClockDate extends NativeDate{constructor(...args){super(...(args.length?args:[h.now.getTime()]))}static now(){return h.now.getTime()}}
 Object.assign(h.ctx,{Date:ClockDate,commandId:()=> 'fixture-timer',expandAutomationVariables:value=>value,expandAutomationPayload:value=>value,
  executeCommand:async command=>{commands.push(command);return {ok:true}},
  AUTOMATION_ACTIONS:new Set(['display.timer.class-end']),timeToMinutes:value=>Number(value.slice(0,2))*60+Number(value.slice(3)),
  normalizeTimerOverlay:value=>value||null});
 const names=['resolvedOccurrenceEndDate','timerLinkedClassChain','runAutomationTimerOverlay','runSingleAutomationAction','isValidTimerContinuation','classEndDate'];
 if(source.includes('function resolvedClassReferenceDate('))names.push('resolvedClassReferenceDate');
 for(const name of names)vm.runInContext(extract(name),h.ctx);
 return {...h,commands};
}
test('pre-midnight class-end action uses the resolved next-day class',async()=>{
 const h=timerHarness(),run=h.liveOccurrences()[0];
 await h.ctx.runSingleAutomationAction(run,{skipOverlay:true});
 assert.equal(h.commands.length,1);assert.equal(h.commands[0].payload.endAt,new Date(2026,9,27,1,0).getTime());
 assert.equal(h.commands[0].payload.remainingSeconds,89*60);
});
test('pre-midnight linked timer overlay uses the resolved next-day class',async()=>{
 const h=timerHarness(),run=h.liveOccurrences()[0];
 await h.ctx.runAutomationTimerOverlay({...run,timerOverlay:{enabled:true,source:'class-end'}});
 assert.equal(h.commands.length,1);assert.equal(h.commands[0].payload.endAt,new Date(2026,9,27,1,0).getTime());
 assert.equal(h.commands[0].payload.remainingSeconds,89*60);
});
test('pre-midnight block timer keeps its next-day resolved deadline',async()=>{
 const h=timerHarness({block:true}),run=h.liveOccurrences()[0];
 await h.ctx.runAutomationTimerOverlay({...run,timerOverlay:{enabled:true,source:'class-end'}});
 assert.equal(h.commands.length,1);assert.equal(h.commands[0].payload.endAt,new Date(2026,9,27,1,0).getTime());
 assert.equal(h.commands[0].payload.remainingSeconds,89*60);
});
test('same-day class timer behavior remains unchanged',async()=>{
 const h=timerHarness({weekday:1,start:'10:00',end:'11:00',offset:-10,now:new Date(2026,9,26,9,51)}),run=h.liveOccurrences()[0];
 await h.ctx.runAutomationTimerOverlay({...run,timerOverlay:{enabled:true,source:'class-end'}});
 assert.equal(h.commands[0].payload.endAt,new Date(2026,9,26,11,0).getTime());assert.equal(h.commands[0].payload.remainingSeconds,69*60);
});
test('unresolved class timers cannot bypass current class-date validation',async()=>{
 const h=timerHarness(),run={...h.event,_class:h.ctx.classScheduleById('class')};
 await assert.rejects(h.ctx.runAutomationTimerOverlay({...run,timerOverlay:{enabled:true,source:'class-end'}}),/not scheduled/);
 assert.equal(h.commands.length,0);
});
for(const linked of [true,false])test(`next-day timer ${linked?'follows an explicit continuation':'does not chain an adjacent normal class'}`,()=>{
 const h=timerHarness(),base=h.ctx.classScheduleById('class'),next={...base,id:'next',name:'Next class',startTime:'01:00',endTime:'01:30',continuationOf:linked?base.id:''};
 h.ctx.classScheduleById=id=>id===base.id?base:id===next.id?next:null;
 h.ctx.effectiveClassTimes=cls=>({startTime:cls.startTime,endTime:cls.endTime});
 const run={...h.liveOccurrences()[0],classIds:[base.id,next.id]};
 const chain=h.ctx.timerLinkedClassChain(run,base,h.now);
 assert.equal(chain.endAt.getTime(),new Date(2026,9,27,1,linked?30:0).getTime());assert.equal(chain.classes.length,linked?2:1);
});
