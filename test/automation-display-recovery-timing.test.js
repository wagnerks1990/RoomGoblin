const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const path=require('node:path'),root=path.resolve(__dirname,'..'),runtime=require(root+'/src/automation-runtime'),schema=require(root+'/src/automation-schema'),source=fs.readFileSync(root+'/src/server.js','utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b)}
const plain=value=>JSON.parse(JSON.stringify(value));
function harness(events,seconds=1,{clockDate=null,persistentState={displays:{}}}={}){
 const stamp=new Date(2026,9,27,10,0,seconds).getTime(),NativeDate=Date;
 class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[stamp]))}static now(){return stamp}}
 const commands=[],timers=[],started=[];let ledgerState={version:1,runs:[]};
 const ledger=runtime.makeLedger({getPreference:()=>plain(ledgerState),setPreference:(_key,next)=>{ledgerState=plain(next)}});
 const devices={screen:{enabled:true},future:{enabled:true},other:{enabled:true}};
 const ctx=vm.createContext({...runtime,...schema,Date:FixedDate,Map,Set,
 schedulerClock:{now:()=>new NativeDate(clockDate||stamp),commandsAllowed:()=>true,status:()=>({active:false})},
 localDateKey:date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`,
 localMinutesNow:date=>date.getHours()*60+date.getMinutes(),
 classroomAutomations:{events},resolveAutomationOccurrences:e=>[e],automationMatchesDate:()=>({match:true}),
 automationTargetDomain:runtime.actionResourceDomain,automationDisplayTargets:targets=>runtime.expandDisplayTargets(targets,{devices}),
 normalizeTimerOverlay:value=>value||null,persistentState,
 executeCommand:async command=>{commands.push(plain(command));if(command.type==='display.clear')for(const id of command.target){if(persistentState.displays[id])persistentState.displays[id].timer=null}return {ok:true}},
 runAutomationTimerOverlay:async(event,options)=>{timers.push({event:plain(event),options:plain(options)});return {ok:true,result:{ok:true}}},
 expandAutomationPayload:value=>value,requireAutomationTargets:targets=>targets,announcementLockedDisplayTargets:()=>[],
 AUTOMATION_ACTIONS:new Set(['display.text','display.clear','display.url']),schoolCycleForDate:()=>({}),
 planningStudio:{matchingOverlays:()=>[]},planningStudioConfig:{},audit:()=>{},persistAutomations:()=>{},diagnosticError:error=>{throw error},
 automationSchedulerEnabled:true,isAutomationSuppressed:()=>({blocked:false}),currentAutomationNonDisplayWinners:()=>[],
 automationRunLedger:ledger,automationRunningOccurrences:new Map(),supersedeOverlappingAutomationRuns:()=>{},defaultAutomationActionTargets:()=>['all'],
 startOwnedAutomationOccurrence:id=>started.push(id),executeScheduledAutomationOccurrence:()=>{}
 });
 vm.runInContext(section('function resolveScheduledAutomationOccurrences(','function resolveAutomationFromClass(')+section('function automationDeferredDisplayTargets(','function consumeDeferredAnnouncementAutomations(')+
 section('async function runSingleAutomationAction(','function timerLinkedClassChain(')+
 section('function automationResourceKeys(','function automationConflictDiagnostics(')+
 section('function automationOccurrenceIsActiveForContinuousRecovery(','async function reconcileScheduledAutomationState(')+
 section('async function resyncCurrentDisplayAutomationsAfterAnnouncements(','function scheduleMorningAnnouncementsReleaseRetry('),ctx);
 return {ctx,commands,timers,started,ledger,get actions(){return commands.filter(row=>row.type==='display.text').map(row=>row.payload.text)},now:new NativeDate(clockDate||stamp)};
}
const text=(value,extra={})=>({id:value,action:'display.text',targets:['screen'],payload:{text:value},executionMode:'once',...extra});
const event=(id,time,steps)=>({id,enabled:true,time,actionSequence:steps});
test('a delayed display occurrence cannot steal the current target before its first action is due',()=>{
 const h=harness([event('old','09:59',[text('old')]),event('new','10:00',[text('new',{delaySeconds:59})])]);
 assert.equal(h.ctx.currentAutomationDisplayWinners(h.now)[0].storedEvent.id,'old');
});
test('display resync does not dispatch a later action during the preceding dwell',async()=>{
 const e=event('sequence','10:00',[text('first',{repeatDelaySeconds:120}),text('future')]),h=harness([e],30);
 await h.ctx.runDisplayAutomationResync(e,['screen']);assert.deepEqual(h.actions,['first']);
});
test('a preceding lighting dwell also postpones a following display action',async()=>{
 const e=event('sequence','10:00',[{id:'light',action:'govee.power',targets:['lamp'],payload:{state:'on'},repeatDelaySeconds:120},text('future')]),h=harness([e],30);
 await h.ctx.runDisplayAutomationResync(e,['screen']);assert.deepEqual(h.actions,[]);
});
test('an immediately due display action remains available',async()=>{
 const e=event('sequence','10:00',[text('ready')]),h=harness([e]);await h.ctx.runDisplayAutomationResync(e,['screen']);assert.deepEqual(h.actions,['ready']);
});

test('a pending first action does not clear a winning target',async()=>{
 const e=event('pending','10:00',[text('future',{delaySeconds:60})]),h=harness([e]);
 await h.ctx.runDisplayAutomationResync(e,['screen']);assert.deepEqual(h.commands,[]);
});
test('resync clears only targets with an eligible action',async()=>{
 const e=event('partial','10:00',[text('ready'),text('later',{targets:['future'],useEventTargets:false,delaySeconds:60})]),h=harness([e]);
 await h.ctx.runDisplayAutomationResync(e,['screen','future']);
 assert.deepEqual(h.commands.filter(row=>row.payload.reason==='morning-announcements-resync').map(row=>row.target),[['screen']]);
 assert.deepEqual(h.actions,['ready']);
});
test('class-default targets remain authoritative for due actions',async()=>{
 const e={...event('class','10:00',[text('ready')]),_classDefaultTargets:['other']},h=harness([e]);
 await h.ctx.runDisplayAutomationResync(e,['screen','other']);
 assert.deepEqual(h.commands.filter(row=>row.type==='display.text').map(row=>row.target),[['other']]);
});
test('due actions retain their ordered composed state',async()=>{
 const e=event('composed','10:00',[
  text('first',{payload:{text:'first',title:'Kept title',clearBefore:false}}),
  text('second',{payload:{text:'second',clearBefore:false}})
 ]),h=harness([e]);await h.ctx.runDisplayAutomationResync(e,['screen']);
 assert.deepEqual(h.commands.map(row=>row.type),['display.clear','display.title','display.text','display.text']);
 assert.deepEqual(h.actions,['first','second']);
});
test('a timer overlay cannot clear or display before the first action is due',async()=>{
 const e={...event('timer','10:00',[text('future',{delaySeconds:60})]),timerOverlay:{enabled:true,source:'duration',durationSeconds:120,useEventTargets:true}},h=harness([e]);
 await h.ctx.runDisplayAutomationResync(e,['screen']);assert.deepEqual(h.commands,[]);assert.deepEqual(h.timers,[]);
});
test('a due non-display action can initialize its explicit timer without clearing future content',async()=>{
 const e={...event('timer','10:00',[{id:'light',action:'govee.power',targets:['lamp'],repeatDelaySeconds:120},text('future')]),timerOverlay:{enabled:true,source:'duration',durationSeconds:120,useEventTargets:false,targets:['other']}},h=harness([e],30);
 await h.ctx.runDisplayAutomationResync(e,['screen','other']);
 assert.deepEqual(h.commands.map(row=>row.target),[['other']]);assert.deepEqual(h.actions,[]);
 assert.equal(h.timers.length,1);assert.deepEqual(h.timers[0].event.targets,['other']);
 assert.equal(new Date(h.timers[0].options.endAtOverride).getTime(),new Date(2026,9,27,10,2).getTime());
});
test('resync captures an owned timer deadline before clearing its target',async()=>{
 const deadline=new Date(2026,9,27,10,7).getTime();
 const persistentState={displays:{screen:{timer:{automationId:'timer',automationOccurrence:'timer:2026-10-27:clock:10:00',endAt:deadline}}}};
 const e={...event('timer','10:00',[text('ready')]),timerOverlay:{enabled:true,source:'duration',durationSeconds:120,useEventTargets:true}},h=harness([e],30,{persistentState});
 await h.ctx.runDisplayAutomationResync(e,['screen']);assert.equal(persistentState.displays.screen.timer,null);
 assert.equal(new Date(h.timers[0].options.endAtOverride).getTime(),deadline);
});
test('the exact delay boundary becomes eligible',async()=>{
 const e=event('boundary','10:00',[text('ready',{delaySeconds:59})]),h=harness([e],59);
 await h.ctx.runDisplayAutomationResync(e,['screen']);assert.deepEqual(h.actions,['ready']);
});
test('an occurrence that has not started cannot clear a target',async()=>{
 const e=event('future','10:01',[text('future')]),h=harness([e]);
 await h.ctx.runDisplayAutomationResync(e,['screen']);assert.deepEqual(h.commands,[]);
});
const displayLoop=(id,time,delay=0)=>event(id,time,[text(id,{executionMode:'loop',delaySeconds:delay}),text(id+'-next',{executionMode:'loop',repeatDelaySeconds:30})]);
test('pending display ownership can recover without admitting its older predecessor',async()=>{
 const events=[displayLoop('old','09:59'),displayLoop('pending','10:00',120)],h=harness(events);
 assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,1);
 assert.deepEqual(h.started,[runtime.occurrenceId(events[1],'2026-10-27','10:00')]);
});
test('a stopped pending display winner does not revive its predecessor',async()=>{
 const events=[displayLoop('old','09:59'),displayLoop('stopped','10:00',120)],h=harness(events);
 h.ledger.record({occurrenceId:runtime.occurrenceId(events[1],'2026-10-27','10:00'),status:'cancel-requested'});
 assert.equal((await h.ctx.recoverContinuousAutomationOccurrences()).started,0);assert.deepEqual(h.started,[]);
});
test('display reconciliation selects the same scheduler clock used by live recovery',async()=>{
 const e=event('clock','10:30',[text('scheduled')]),h=harness([e],1,{clockDate:new Date(2026,9,27,10,31)});
 const result=await h.ctx.resyncCurrentDisplayAutomationsAfterAnnouncements('fixture');
 assert.equal(result.winnerCount,1);assert.deepEqual(h.actions,['scheduled']);
});

test('a clock change that leaves no due actions does not consume the scheduled occurrence',async()=>{
 const e=event('clock-moved','10:00',[text('scheduled')]),h=harness([e]);let calls=0;
 h.ctx.schedulerClock.now=()=>new Date(2026,9,27,10,++calls===1?0:-1,1);
 const result=await h.ctx.resyncCurrentDisplayAutomationsAfterAnnouncements('fixture');
 assert.equal(result.winnerCount,1);assert.equal(result.results[0].skipped,true);
 assert.equal(result.results[0].reason,'no-actions-due');assert.deepEqual(h.commands,[]);
 assert.equal(e.lastExec,undefined);assert.equal(e.lastExecByClass,undefined);assert.equal(e.lastRun,undefined);
});
