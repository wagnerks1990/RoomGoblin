#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path): return (ROOT/path).read_text()
def write(path,value): (ROOT/path).write_text(value)
def replace_once(s,old,new,label):
    n=s.count(old)
    if n!=1: raise SystemExit(f"{label}: expected one match, found {n}")
    return s.replace(old,new,1)
def replace_between(s,start_marker,end_marker,new,label):
    start=s.find(start_marker)
    if start<0: raise SystemExit(f"{label}: start marker missing")
    end=s.find(end_marker,start)
    if end<0: raise SystemExit(f"{label}: end marker missing")
    return s[:start]+new+s[end:]
def sub_once(s,pattern,repl,label,flags=re.S):
    out,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f"{label}: expected one regex match, found {n}")
    return out

# ---------------------------------------------------------------------------
# Runtime: recover stale claims and retry bounded failures.
# ---------------------------------------------------------------------------
p=Path('src/automation-runtime.js'); s=read(p)
start=s.index('function makeLedger(')
end=s.index('\nmodule.exports=',start)
ledger=r'''function makeLedger(store,{key="automation.run-ledger",limit=500,maxAttempts=3,retryDelayMs=30000,staleAfterMs=90000}={}){
  function read(){
    const value=store.getPreference(key,{version:1,runs:[]})||{};
    return {version:1,runs:Array.isArray(value.runs)?value.runs:[]};
  }
  function write(value){store.setPreference(key,{version:1,runs:value.runs.slice(-limit)})}
  function record(entry){const state=read();const row={...entry,observedAt:new Date().toISOString()};state.runs.push(row);write(state);return row}
  function claim(id,details={}){
    const state=read(),rows=state.runs.filter(run=>run.occurrenceId===id),latest=rows[rows.length-1]||null,now=Date.now();
    if(latest&&["succeeded","cancelled","superseded"].includes(latest.status))return {claimed:false,existing:latest,reason:"terminal"};
    if(latest&&["claimed","running"].includes(latest.status)){
      const age=now-Date.parse(latest.observedAt||0);
      if(Number.isFinite(age)&&age<staleAfterMs)return {claimed:false,existing:latest,reason:"active"};
    }
    const failures=rows.filter(run=>run.status==="failed");
    if(failures.length>=maxAttempts)return {claimed:false,existing:failures[failures.length-1],reason:"attempts-exhausted"};
    const lastFailure=failures[failures.length-1];
    if(lastFailure){
      const age=now-Date.parse(lastFailure.observedAt||0);
      if(Number.isFinite(age)&&age<retryDelayMs)return {claimed:false,existing:lastFailure,reason:"retry-delay",retryAfterMs:retryDelayMs-age};
    }
    const row={occurrenceId:id,status:"claimed",attempt:failures.length+1,...details,observedAt:new Date().toISOString()};
    state.runs.push(row);write(state);return {claimed:true,row,attempt:row.attempt};
  }
  return {read,record,claim};
}
'''
s=s[:start]+ledger+s[end:]
write(p,s)

# ---------------------------------------------------------------------------
# Backend: one dated resolver, per-resource display reconciliation, safe simulated
# time, retryable run lifecycle, and scheduler-clock timer math.
# ---------------------------------------------------------------------------
p=Path('src/server.js'); s=read(p)

# The clock is constructed before database-backed timezone settings are loaded.
needle='''}catch(error){console.warn(`Stored scheduler timezone ignored: ${error.message}`)}
function privacyRetentionPolicy()'''
s=replace_once(s,needle,''' }catch(error){console.warn(`Stored scheduler timezone ignored: ${error.message}`)}
schedulerClock.timezone=SCHEDULER_TIMEZONE;
function privacyRetentionPolicy()'''.lstrip(), 'scheduler clock timezone sync')

# Display desired state is planned per content/overlay resource. Reconciliation never
# performs an unconditional clear and never sleeps through historical delays.
start_marker='function automationDeferredDisplayTargets(event){'
end_marker='function consumeDeferredAnnouncementAutomations(){'
new_display=r'''function automationDisplayResourceEntries(event){
  const entries=[],eventDomain=automationTargetDomain(event.action);
  const steps=[{id:"primary",action:event.action,targets:event.targets,useEventTargets:true,payload:event.payload||{},delaySeconds:0},...(Array.isArray(event.actions)?event.actions:[])];
  let elapsedSeconds=0;
  for(const step of steps){
    elapsedSeconds+=Math.max(0,Number(step?.delaySeconds||0));
    const action=step?.action||event.action,domain=automationTargetDomain(action);
    if(!["display-content","display-overlay"].includes(domain))continue;
    const explicit=Array.isArray(step?.targets)&&step.targets.length?step.targets:[];
    let rawTargets=[];
    if(step?.useEventTargets!==false&&domain===eventDomain)rawTargets=event.targets||[];
    else if(event.useClassTargets!==false&&Array.isArray(event._classDefaultTargets)&&event._classDefaultTargets.length)rawTargets=event._classDefaultTargets;
    else if(explicit.length)rawTargets=explicit;
    for(const target of automationDisplayTargets(rawTargets))entries.push({domain,target,action,payload:step.payload||{},effectiveDelaySeconds:elapsedSeconds,stepId:step.id||action});
  }
  const timer=event.timerOverlay&&typeof event.timerOverlay==="object"?event.timerOverlay:null;
  if(timer?.enabled){
    const rawTargets=(event.useClassTargets!==false&&Array.isArray(event._classDefaultTargets)&&event._classDefaultTargets.length)
      ? event._classDefaultTargets
      : (timer.useEventTargets!==false?event.targets:(Array.isArray(timer.targets)&&timer.targets.length?timer.targets:event.targets));
    for(const target of automationDisplayTargets(rawTargets||[]))entries.push({domain:"display-overlay",target,action:"timer-overlay",timerOverlay:timer,effectiveDelaySeconds:elapsedSeconds,stepId:"timer-overlay"});
  }
  return entries;
}
function automationDeferredDisplayTargets(event){return new Set(automationDisplayResourceEntries(event).map(entry=>entry.target))}
function automationOccurrenceScheduledMinutes(event){
  const [h,m]=String(event?.time||"00:00").split(":").map(Number);
  return (Number.isFinite(h)?h:0)*60+(Number.isFinite(m)?m:0);
}
function automationOccurrenceIsCurrentlyApplicable(event,now=schedulerClock.now()){
  if(!event)return false;
  if(event._scheduledDateKey&&event._scheduledDateKey!==localDateKey(now))return false;
  if(event._class){
    const start=Number(event._classStartAt),end=Number(event._classEndAt),stamp=now.getTime();
    if(Number.isFinite(start)&&stamp<start)return false;
    if(Number.isFinite(end)&&stamp>=end)return false;
  }
  return true;
}
function currentAutomationDisplayWinners(now=schedulerClock.now()){
  const winners=new Map(),currentSeconds=now.getHours()*3600+now.getMinutes()*60+now.getSeconds();
  for(const storedEvent of classroomAutomations.events){
    if(!storedEvent?.enabled)continue;
    for(const event of automationOccurrencesForDate(storedEvent,now)){
      if(!automationOccurrenceIsCurrentlyApplicable(event,now))continue;
      const scheduledSeconds=automationOccurrenceScheduledMinutes(event)*60;
      for(const entry of automationDisplayResourceEntries(event)){
        const effectiveSeconds=scheduledSeconds+entry.effectiveDelaySeconds;if(effectiveSeconds>currentSeconds)continue;
        const key=`${entry.domain}:${entry.target}`,prior=winners.get(key),priority=Number(storedEvent.priority||0),score=[effectiveSeconds,priority,String(storedEvent.id||"")];
        if(!prior||score[0]>prior.score[0]||(score[0]===prior.score[0]&&score[1]>prior.score[1])||(score[0]===prior.score[0]&&score[1]===prior.score[1]&&score[2]>prior.score[2]))winners.set(key,{storedEvent,event,entry,score});
      }
    }
  }
  return [...winners.values()].sort((a,b)=>a.score[0]-b.score[0]||a.entry.domain.localeCompare(b.entry.domain)||a.entry.target.localeCompare(b.entry.target));
}
async function runDisplayAutomationResync(candidate,reason="automation-reconcile"){
  const {event,entry}=candidate,target=entry.target,commandSource=reason.startsWith("stream")||reason.includes("announcement")?"morning-announcements-resync":"automation-reconcile";
  if(entry.action==="timer-overlay"){
    const timerResult=await runAutomationTimerOverlay({...event,useClassTargets:false,targets:[target],timerOverlay:{...entry.timerOverlay,useEventTargets:true,targets:[target]}},{manual:false,commandSource});
    return {ok:timerResult?.ok!==false,results:timerResult?.result?[timerResult.result]:[],timerOverlay:timerResult};
  }
  const output=await runSingleAutomationAction({...event,action:entry.action,targets:[target],payload:entry.payload||{},timerOverlay:null},{manual:false,skipOverlay:true,skipAudit:true,commandSource});
  return {ok:output.ok!==false,results:output.results||[]};
}

'''
s=replace_between(s,start_marker,end_marker,new_display,'display resource reconciliation block')

# Runtime bookkeeping must not change configuration priority timestamps.
consume_start=s.index('function consumeDeferredAnnouncementAutomations(){')
consume_end=s.index('async function resyncCurrentDisplayAutomationsAfterAnnouncements',consume_start)
consume=s[consume_start:consume_end].replace('    storedEvent.updatedAt=new Date().toISOString();\n','')
s=s[:consume_start]+consume+s[consume_end:]

# Reconcile current desired resources; do not replay waits or write execution markers.
resync_new=r'''async function resyncCurrentDisplayAutomationsAfterAnnouncements(reason="stream-ended"){
  const now=schedulerClock.now(),winners=currentAutomationDisplayWinners(now),results=[];
  for(const candidate of winners){
    try{
      const result=await runDisplayAutomationResync(candidate,reason);
      results.push({automationId:candidate.storedEvent.id,name:candidate.storedEvent.name,classId:candidate.event.classId||null,time:candidate.event.time,domain:candidate.entry.domain,target:candidate.entry.target,action:candidate.entry.action,ok:result.ok!==false});
    }catch(err){
      results.push({automationId:candidate.storedEvent.id,name:candidate.storedEvent.name,classId:candidate.event.classId||null,time:candidate.event.time,domain:candidate.entry.domain,target:candidate.entry.target,action:candidate.entry.action,ok:false,error:err.message});
      diagnosticError(err,{component:"automation",operation:"desired-state-display-reconcile",data:{automationId:candidate.storedEvent.id,reason,domain:candidate.entry.domain,target:candidate.entry.target}});
    }
  }
  audit({kind:"automation.display.reconcile",reason,at:now.toISOString(),winnerCount:winners.length,results});
  return {winnerCount:winners.length,results};
}
'''
s=replace_between(s,'async function resyncCurrentDisplayAutomationsAfterAnnouncements(reason="stream-ended"){','function scheduleMorningAnnouncementsReleaseRetry',resync_new,'desired display resync')

# Timer calculations use business scheduler time; host/security/announcement clocks stay real.
run_start=s.index('async function runSingleAutomationAction(')
run_end=s.index('\nfunction timerLinkedClassChain',run_start)
run=s[run_start:run_end]
run=replace_once(run,'const ts=automationDisplayTargets(event.targets),cls=event._class||activeAutomationClassAt(event,new Date())||classScheduleById(event.classId)||activeClassAt(new Date());\n    if(!cls)throw new Error("No class schedule is available for the class-end timer");\n    const now=new Date();if(!manual&&!classScheduleMatchesDate(cls,now))throw new Error(`${cls.name} is not scheduled today`);','const now=schedulerClock.now(),ts=requireAutomationTargets(event.targets,"Class-end timer"),cls=event._class||activeAutomationClassAt(event,now)||classScheduleById(event.classId)||activeClassAt(now);\n    if(!cls)throw new Error("No class schedule is available for the class-end timer");\n    if(!manual&&!classScheduleMatchesDate(cls,now))throw new Error(`${cls.name} is not scheduled today`);','standalone timer scheduler time')
run=run.replace('(endAt-Date.now())/1000','(endAt-now.getTime())/1000')
run=run.replace('    const now=new Date();\n    let remainingSeconds=0;','    const now=schedulerClock.now();\n    let remainingSeconds=0;',1)
run=run.replace('(endAt.getTime()-Date.now())/1000','(endAt.getTime()-now.getTime())/1000')
run=run.replace('endAt=new Date(Date.now()+remainingSeconds*1000);','endAt=new Date(now.getTime()+remainingSeconds*1000);')
s=s[:run_start]+run+s[run_end:]
s=s.replace('function timerLinkedClassChain(event,baseClass,now=new Date(),timerOverlay={}){','function timerLinkedClassChain(event,baseClass,now=schedulerClock.now(),timerOverlay={}){',1)
overlay_start=s.index('async function runAutomationTimerOverlay(')
overlay_end=s.index('\nfunction automationRunFailures',overlay_start)
overlay=s[overlay_start:overlay_end].replace('  const now=new Date();','  const now=schedulerClock.now();',1).replace('(endAt.getTime()-Date.now())/1000','(endAt.getTime()-now.getTime())/1000').replace('endAt=new Date(Date.now()+remainingSeconds*1000);','endAt=new Date(now.getTime()+remainingSeconds*1000);')
s=s[:overlay_start]+overlay+s[overlay_end:]

# A single dated occurrence resolver powers execution, simulation, desired-state and
# conflict planning, including class offsets that cross midnight.
occ_marker='''function resolveAutomationOccurrences(event,date=new Date()){
  const ids=automationClassIds(event);
  if(!ids.length)return [event];
  return ids.map(id=>resolveAutomationForClass(event,id,date)).filter(Boolean);
}
'''
occ_new=occ_marker+r'''function automationOccurrencesForDate(event,date=schedulerClock.now()){
  const key=localDateKey(date);
  if(!automationClassIds(event).length)return automationMatchesDate(event,date).match?[{...event,_scheduledDateKey:key}]:[];
  const refs=[-1,0,1].map(offset=>{const d=new Date(date);d.setDate(d.getDate()+offset);return d});
  return refs.flatMap(referenceDate=>resolveAutomationOccurrences(event,referenceDate)).filter(occurrence=>occurrence?._scheduledDateKey===key);
}
'''
s=replace_once(s,occ_marker,occ_new,'authoritative dated occurrence resolver')

# Planning/evaluation uses that same resolver.
eval_new=r'''function evaluateAutomationAt(now=schedulerClock.now()){
  const suppression=isAutomationSuppressed(now),items=[];
  for(const stored of classroomAutomations.events){
    const occurrences=automationOccurrencesForDate(stored,now);
    if(!occurrences.length)items.push({automationId:stored.id,name:stored.name,enabled:stored.enabled!==false,time:stored.time,classId:null,match:false,suppressed:!!suppression.blocked,reason:suppression.blocked?suppression.reason:"No occurrence on this date",targets:stored.targets||[],actions:[stored.action,...(stored.actions||[]).map(step=>step.action)]});
    for(const event of occurrences)items.push({automationId:stored.id,name:stored.name,enabled:stored.enabled!==false,time:event.time,classId:event.classId||null,match:true,suppressed:!!suppression.blocked,reason:suppression.blocked?suppression.reason:"Scheduled occurrence",targets:event.targets||[],actions:[event.action,...(event.actions||[]).map(step=>step.action)]});
  }
  return {observedAt:new Date().toISOString(),schedulerTime:now.toISOString(),schoolCycle:schoolCycleForDate(now),suppression,items};
}
'''
s=replace_between(s,'function evaluateAutomationAt(now=schedulerClock.now()){','function currentAutomationNonDisplayWinners',eval_new,'simulation evaluation resolver')

non_display_new=r'''function automationLightingTargets(targets){
  const out=[];for(const raw of Array.isArray(targets)?targets:[]){try{for(const alias of goveeTargets(raw))if(!out.includes(alias))out.push(alias)}catch{}}
  return out;
}
function currentAutomationNonDisplayWinners(now=schedulerClock.now()){
  const currentSeconds=now.getHours()*3600+now.getMinutes()*60+now.getSeconds(),winners=new Map();
  for(const stored of classroomAutomations.events){
    if(stored?.enabled===false)continue;
    for(const event of automationOccurrencesForDate(stored,now)){
      if(!automationOccurrenceIsCurrentlyApplicable(event,now))continue;
      const scheduledSeconds=automationOccurrenceScheduledMinutes(event)*60,steps=[{action:event.action,targets:event.targets,useEventTargets:true,payload:event.payload||{},delaySeconds:0},...(event.actions||[])];let elapsedSeconds=0;
      for(const step of steps){
        elapsedSeconds+=Math.max(0,Number(step.delaySeconds||0));const domain=automationTargetDomain(step.action);if(!["tv-power","lighting"].includes(domain))continue;
        const effectiveSeconds=scheduledSeconds+elapsedSeconds;if(effectiveSeconds>currentSeconds)continue;
        let targets=(step.useEventTargets!==false&&domain===automationTargetDomain(event.action))?(event.targets||[]):(step.targets||[]);
        const resolved=domain==="tv-power"?expandTvTargets(targets,{devices,connection:step.payload?.connection||"hdbt"}):automationLightingTargets(targets);
        for(const target of resolved){
          const targetId=domain==="tv-power"?target.id:target,key=domain==="tv-power"?`tv-power:${target.connection}:${target.output}`:`lighting:${targetId}`,prior=winners.get(key),priority=Number(stored.priority||0),score=[effectiveSeconds,priority,String(stored.id||"")];
          if(!prior||score[0]>prior.score[0]||(score[0]===prior.score[0]&&score[1]>prior.score[1])||(score[0]===prior.score[0]&&score[1]===prior.score[1]&&score[2]>prior.score[2]))winners.set(key,{event:{...event,action:step.action,targets:[targetId],payload:step.payload||{}},score,automationId:stored.id,name:stored.name,domain,target:targetId,resourceKey:key});
        }
      }
    }
  }
  return [...winners.values()];
}
'''
s=replace_between(s,'function currentAutomationNonDisplayWinners(now=schedulerClock.now()){','async function reconcileScheduledAutomationState',non_display_new,'non-display desired winners')

reconcile_new=r'''async function reconcileScheduledAutomationState(reason="operator-resume"){
  const now=schedulerClock.now(),clock=schedulerClock.status(),suppression=isAutomationSuppressed(now);
  if(suppression.blocked)return {ok:true,skipped:true,reason:suppression.reason,schedulerTime:now.toISOString()};
  if(clock.active&&!schedulerClock.commandsAllowed())return {ok:true,dryRun:true,reason:"Simulated scheduler is dry-run only",schedulerTime:now.toISOString(),evaluation:evaluateAutomationAt(now)};
  if(morningAnnouncementsRuntime.active)return {ok:true,deferred:true,reason:"Morning Announcements have priority",targets:[...(morningAnnouncementsRuntime.targets||[])]};
  const display=await resyncCurrentDisplayAutomationsAfterAnnouncements(reason),resourceResults=[];
  for(const winner of currentAutomationNonDisplayWinners(now)){
    try{const result=await runSingleAutomationAction(winner.event,{manual:false,skipOverlay:true,skipAudit:true});resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,resourceKey:winner.resourceKey,ok:true,result})}
    catch(error){resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,resourceKey:winner.resourceKey,ok:false,error:error.message})}
  }
  await backgroundMusicTick();
  const ok=!display.results?.some(item=>item.ok===false)&&!resourceResults.some(item=>item.ok===false);
  audit({kind:"automation.reconcile",reason,schedulerTime:now.toISOString(),displayWinners:display.winnerCount||0,resourceWinners:resourceResults.length,ok,simulated:clock.active});
  return {ok,reason,schedulerTime:now.toISOString(),display,resources:resourceResults,backgroundMusic:{playing:backgroundMusicRuntime.playing,paused:backgroundMusicRuntime.paused},simulated:clock.active};
}
'''
s=replace_between(s,'async function reconcileScheduledAutomationState(reason="operator-resume"){','app.get("/api/v1/automation-control"',reconcile_new,'scheduler reconciliation')

# Enable/Resume converges current state. Simulated automatic ticks never dispatch; live
# simulated hardware requires an explicit operator Resume.
old='app.put("/api/v1/automation-control",requireCapability("automation.manage"),(req,res)=>{const enabled=setAutomationSchedulerEnabled(req.body?.enabled!==false);audit({kind:"automation.scheduler.toggle",enabled});res.json({ok:true,...automationControlStatus()})});'
new='app.put("/api/v1/automation-control",requireCapability("automation.manage"),async(req,res)=>{try{const enabled=setAutomationSchedulerEnabled(req.body?.enabled!==false);audit({kind:"automation.scheduler.toggle",enabled});const reconciliation=enabled?await reconcileScheduledAutomationState("scheduler-enabled"):null;res.json({ok:true,...automationControlStatus(),reconciliation})}catch(error){res.status(500).json({ok:false,error:error.message})}});'
s=replace_once(s,old,new,'scheduler toggle reconciliation')
old='app.post("/api/v1/automation-control/resume",requireControl,async(_req,res)=>{try{const result=await reconcileScheduledAutomationState("operator-resume");res.json(result)}catch(error){res.status(500).json({ok:false,error:error.message})}});'
new='app.post("/api/v1/automation-control/resume",requireControl,async(_req,res)=>{try{setAutomationSchedulerEnabled(true);const result=await reconcileScheduledAutomationState("operator-resume");res.json({...result,...automationControlStatus()})}catch(error){res.status(500).json({ok:false,error:error.message})}});'
s=replace_once(s,old,new,'resume enables scheduler')
s=s.replace('resolveAutomationForManualTest(event),conflicts=automationConflictDiagnostics','resolveAutomationForManualTest(event,schedulerClock.now()),conflicts=automationConflictDiagnostics',1)

# Scheduled run lifecycle: successful occurrences get lastExec; failures remain retryable
# through the durable ledger and active in-memory map. Runtime runs never change updatedAt.
scheduler_new=r'''// Unified Classroom Automation scheduler
// Discovery is short/non-blocking. Automatic ticks are disabled while the volatile
// SchedulerClock is simulated; simulated hardware is only available through an
// explicit operator reconciliation and never writes occurrence markers.
let automationSchedulerBusy=false;
const automationRunningOccurrences=new Map();
const automationCancelledOccurrences=new Set();
async function executeScheduledAutomationOccurrence(storedEvent,event,{dateKey,scheduledMinuteKey,deltaMinutes,occurrenceKey,id,attempt}){
  automationRunLedger.record({occurrenceId:id,automationId:storedEvent.id,classId:event.classId||null,status:"running",attempt,schedulerTime:schedulerClock.now().toISOString()});
  try{
    const runResult=await runClassroomAutomation({...event,_occurrenceId:id});
    const failures=automationRunFailures(runResult),ok=runResult.ok!==false;
    storedEvent.lastRun={at:new Date().toISOString(),scheduledFor:`${dateKey} ${event.time}`,resolvedClassId:event.classId||null,delayMinutes:deltaMinutes,ok,message:ok?(deltaMinutes>0?`Completed (${deltaMinutes} min catch-up)`:"Completed"):"Completed with action errors",resultSummary:{action:event.action,actions:[event.action,...(event.actions||[]).map(x=>x.action)],targets:event.targets,failures}};
    if(ok){
      storedEvent.lastExecByClass=storedEvent.lastExecByClass||{};storedEvent.lastExecByClass[occurrenceKey]=scheduledMinuteKey;storedEvent.lastExec=scheduledMinuteKey;
      automationRunLedger.record({occurrenceId:id,automationId:storedEvent.id,classId:event.classId||null,status:"succeeded",attempt,schedulerTime:schedulerClock.now().toISOString()});
    }else automationRunLedger.record({occurrenceId:id,automationId:storedEvent.id,classId:event.classId||null,status:"failed",attempt,schedulerTime:schedulerClock.now().toISOString(),failures});
  }catch(err){
    const status=err.code==="AUTOMATION_CANCELLED"?"cancelled":err.code==="AUTOMATION_CONFIGURATION_CHANGED"?"superseded":"failed";
    storedEvent.lastRun={at:new Date().toISOString(),scheduledFor:`${dateKey} ${event.time}`,resolvedClassId:event.classId||null,delayMinutes:deltaMinutes,ok:false,message:err.message,status};
    automationRunLedger.record({occurrenceId:id,automationId:storedEvent.id,classId:event.classId||null,status,attempt,schedulerTime:schedulerClock.now().toISOString(),error:err.message});
    audit({kind:"automation.error",automationId:storedEvent.id,name:storedEvent.name,error:err.message,status});
  }finally{
    persistAutomations();automationRunningOccurrences.delete(id);automationCancelledOccurrences.delete(id);
  }
}
async function automationSchedulerTick(){
  if(fullExportFreeze.requested||automationSchedulerBusy||!automationSchedulerEnabled)return;
  const clockStatus=schedulerClock.status();if(clockStatus.active)return;
  automationSchedulerBusy=true;
  try{
    const now=schedulerClock.now(),suppression=isAutomationSuppressed(now);if(suppression.blocked)return;
    const dateKey=localDateKey(now),nowMinutes=now.getHours()*60+now.getMinutes();
    for(const storedEvent of classroomAutomations.events){
      if(!storedEvent?.enabled)continue;
      for(const event of automationOccurrencesForDate(storedEvent,now)){
        const [eventHour,eventMinute]=String(event.time||"00:00").split(":").map(Number),scheduledMinutes=eventHour*60+eventMinute,deltaMinutes=nowMinutes-scheduledMinutes;
        if(deltaMinutes<0||deltaMinutes>SCHEDULER_CATCHUP_MINUTES)continue;
        const occurrenceKey=event.classId||"manual",scheduledMinuteKey=`${dateKey} ${event.time}`;storedEvent.lastExecByClass=storedEvent.lastExecByClass||{};
        if(storedEvent.lastExecByClass[occurrenceKey]===scheduledMinuteKey)continue;
        const id=occurrenceId(event,dateKey,event.time);if(automationRunningOccurrences.has(id))continue;
        const claim=automationRunLedger.claim(id,{automationId:storedEvent.id,classId:event.classId||null,schedulerTime:now.toISOString()});if(!claim.claimed)continue;
        if(morningAnnouncementsRuntime.active&&announcementLockedDisplayTargets([...automationDeferredDisplayTargets(event)]).length)queueAutomationDuringAnnouncements(storedEvent,event,dateKey,scheduledMinuteKey,deltaMinutes);
        const task=trackFullExportMutation(executeScheduledAutomationOccurrence(storedEvent,event,{dateKey,scheduledMinuteKey,deltaMinutes,occurrenceKey,id,attempt:claim.attempt||1}));
        automationRunningOccurrences.set(id,task);task.catch(()=>{});
      }
    }
  }catch(error){diagnosticError(error,{component:"automation",operation:"scheduler-tick"})}
  finally{automationSchedulerBusy=false}
}
const automationSchedulerTimer=setInterval(()=>automationSchedulerTick(),15000);automationSchedulerTimer.unref();
const automationStartupReconcileTimer=setTimeout(()=>{if(automationSchedulerEnabled&&!schedulerClock.status().active)trackFullExportMutation(reconcileScheduledAutomationState("startup-reconcile")).catch(error=>diagnosticError(error,{component:"automation",operation:"startup-reconcile"}))},5000);automationStartupReconcileTimer.unref();

'''
s=replace_between(s,'// Unified Classroom Automation scheduler','// Legacy per-output Pluto schedules retained for migration/backward compatibility.',scheduler_new,'retryable scheduler lifecycle')

legacy_new=r'''// Legacy per-output Pluto schedules retained for migration/backward compatibility.
// They share global pause and Morning Announcements arbitration. The volatile test
// clock never drives this automatic executor.
let legacyPlutoSchedulerBusy=false;
const legacyPlutoSchedulerTimer=setInterval(async()=>{
  if(fullExportFreeze.requested||legacyPlutoSchedulerBusy||!automationSchedulerEnabled)return;
  if(schedulerClock.status().active)return;
  legacyPlutoSchedulerBusy=true;
  try{
    const now=schedulerClock.now(),hhmm=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0"),day=now.getDay(),minuteKey=`${localDateKey(now)} ${hhmm}`;let changed=false;
    if(isAutomationSuppressed(now).blocked)return;
    for(const sch of Object.values(plutoSchedules)){
      if(!sch?.enabled||!Array.isArray(sch.days)||!sch.days.map(Number).includes(day))continue;sch.lastExec=sch.lastExec||{};sch.lastRun=sch.lastRun||{};
      for(const [kind,time,index] of [["on",sch.onTime,0],["off",sch.offTime,1]]){
        if(time!==hhmm||sch.lastExec[kind]===minuteKey)continue;
        const displayId=Object.keys(devices).find(id=>Number(devices[id]?.avOutput)===Number(sch.index));
        if(displayId&&morningAnnouncementsRuntime.active&&announcementLockedDisplayTargets([displayId]).length){sch.lastRun={text:`Deferred ${kind} while Morning Announcements own ${displayId}`,stamp:Date.now(),ok:true,deferred:true};changed=true;continue}
        try{const result=await directPluto({action:"cecOutput",output:Number(sch.index),connection:sch.type,index});assertAdapterResults([result],{action:"Legacy TV power"});sch.lastExec[kind]=minuteKey;sch.lastRun={text:`${kind==="on"?"On":"Off"} ${now.toLocaleString()}`,stamp:Date.now(),ok:true}}
        catch(e){sch.lastRun={text:`ERROR ${now.toLocaleString()}: ${e.message}`,stamp:Date.now(),ok:false}}
        changed=true;
      }
    }
    if(changed)persistPlutoSchedules();
  }finally{legacyPlutoSchedulerBusy=false}
},15000);legacyPlutoSchedulerTimer.unref();

'''
s=replace_between(s,'// Legacy per-output Pluto schedules retained for migration/backward compatibility.','connectMqtt();',legacy_new,'legacy scheduler simulation safety')

write(p,s)

# ---------------------------------------------------------------------------
# Controller: optional providers cannot blank the scheduler view; timer zero is
# preserved and background refreshes do not reset an unsaved draft.
# ---------------------------------------------------------------------------
p=Path('public/controller/app.js'); s=read(p)
s=s.replace('let currentAutomationPayload={};','let currentAutomationPayload={};\nlet automationEditorInitialized=false;',1)
s=s.replace('function newAutomation(){\n  currentAutomationPayload={};','function newAutomation(){\n  automationEditorInitialized=true;\n  currentAutomationPayload={};',1)
s=s.replace('function editAutomation(id){\n  const e=S.automations.find(x=>x.id===id);if(!e)return;currentAutomationPayload=', 'function editAutomation(id){\n  const e=S.automations.find(x=>x.id===id);if(!e)return;automationEditorInitialized=true;currentAutomationPayload=',1)
s=s.replace('autoTimerOverlayMinutes.value=String(Math.max(1,Math.round(Number(data.durationSeconds||600)/60)));','autoTimerOverlayMinutes.value=String(Math.max(0,Math.round(Number(data.durationSeconds??600)/60)));',1)
s=s.replace('durationSeconds:Math.max(60,Number(autoTimerOverlayMinutes.value||10)*60),','durationSeconds:Math.max(0,Number(autoTimerOverlayMinutes.value??10)*60),',1)
load_new=r'''async function loadSchedules(){
  try{
    const results=await Promise.allSettled([
      api('/api/v1/automations'),api('/api/v1/media'),api('/api/v1/govee'),api('/api/v1/automations/calendar'),api('/api/v1/class-schedules')
    ]);
    const required=[[0,'automations'],[3,'school calendar'],[4,'class schedules']];
    for(const [index,label] of required)if(results[index].status==='rejected')throw Error(`Unable to load ${label}: ${results[index].reason?.message||results[index].reason}`);
    const a=results[0].value,cal=results[3].value,cls=results[4].value,m=results[1].status==='fulfilled'?results[1].value:{files:S.mediaFiles||[]},g=results[2].status==='fulfilled'?results[2].value:(S.govee||{devices:{},groups:{}});
    S.automations=a.events||[];S.mediaFiles=m.files||[];S.govee=g;S.scheduler=a.scheduler||null;S.classes=cls.classes||[];S.classStatus={schoolCycle:cls.schoolCycle||null,calendarRule:cls.calendarRule||null,activeClass:cls.activeClass||null,nextClass:cls.nextClass||null};populateAutomationClassSelect(selectedAutomationClassIds());
    S.schedulerCalendar=cal.calendar||S.schedulerCalendar;S.scheduleProfile=cal.scheduleProfile||S.scheduleProfile;S.districtNoSchoolDates=cal.districtNoSchoolDates||[];
    renderSchedulerClock();renderSchedulerCalendar();renderAutomationList();loadMorningWatch();
    const optionalFailures=[];if(results[1].status==='rejected')optionalFailures.push('media library');if(results[2].status==='rejected')optionalFailures.push('lighting inventory');
    if(optionalFailures.length&&window.autoEditorMsg&&!autoEditorMsg.textContent)autoEditorMsg.textContent=`Optional data unavailable: ${optionalFailures.join(', ')}. Scheduling remains available.`;
    if(!automationEditorInitialized)newAutomation();
  }catch(e){automationList.innerHTML=`<div class="bad">${esc(e.message)}</div>`}
}

'''
s=replace_between(s,'async function loadSchedules(){','function diagBadge',load_new,'resilient scheduler planning view')
write(p,s)

p=Path('public/controller/index.html'); s=read(p)
s=s.replace('<input id="autoTimerOverlayMinutes" type="number" min="1" max="720" value="10">','<input id="autoTimerOverlayMinutes" type="number" min="0" max="720" value="10">',1)
write(p,s)

# ---------------------------------------------------------------------------
# Regression tests.
# ---------------------------------------------------------------------------
p=Path('test/automation-convergence.test.js')
write(p,r'''"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const runtime=require("../src/automation-runtime");
const server=fs.readFileSync(path.join(__dirname,"..","src","server.js"),"utf8"),controller=fs.readFileSync(path.join(__dirname,"..","public","controller","app.js"),"utf8"),html=fs.readFileSync(path.join(__dirname,"..","public","controller","index.html"),"utf8");
function fakeStore(){let value={version:1,runs:[]};return {getPreference:(_k,f)=>value||f,setPreference:(_k,v)=>{value=JSON.parse(JSON.stringify(v))},value:()=>value}}
test("failed durable occurrences retry but terminal outcomes and exhausted attempts do not",()=>{const store=fakeStore(),ledger=runtime.makeLedger(store,{retryDelayMs:0,maxAttempts:2,staleAfterMs:10});let c=ledger.claim("x");assert.equal(c.claimed,true);ledger.record({occurrenceId:"x",status:"running",attempt:1});ledger.record({occurrenceId:"x",status:"failed",attempt:1});c=ledger.claim("x");assert.equal(c.claimed,true);assert.equal(c.attempt,2);ledger.record({occurrenceId:"x",status:"failed",attempt:2});assert.equal(ledger.claim("x").reason,"attempts-exhausted");const y=ledger.claim("y");assert.equal(y.claimed,true);ledger.record({occurrenceId:"y",status:"succeeded"});assert.equal(ledger.claim("y").reason,"terminal")});
test("stale claims are recoverable",async()=>{const store=fakeStore(),ledger=runtime.makeLedger(store,{staleAfterMs:1,retryDelayMs:0});assert.equal(ledger.claim("stale").claimed,true);await new Promise(r=>setTimeout(r,5));assert.equal(ledger.claim("stale").claimed,true)});
test("display reconciliation owns content and overlays independently without blanket clear or replay delays",()=>{const block=server.slice(server.indexOf("function automationDisplayResourceEntries"),server.indexOf("function consumeDeferredAnnouncementAutomations"));assert.match(block,/`\$\{entry\.domain\}:\$\{entry\.target\}`/);assert.doesNotMatch(block,/reason:\"morning-announcements-resync\"/);const runner=server.slice(server.indexOf("async function runDisplayAutomationResync"),server.indexOf("function consumeDeferredAnnouncementAutomations"));assert.doesNotMatch(runner,/setTimeout/);assert.doesNotMatch(runner,/type:\"display\.clear\"/)});
test("simulated scheduler never drives automatic executors",()=>{const scheduler=server.slice(server.indexOf("async function automationSchedulerTick"),server.indexOf("connectMqtt();"));assert.match(scheduler,/if\(clockStatus\.active\)return/);assert.match(scheduler,/if\(schedulerClock\.status\(\)\.active\)return/);const reconcile=server.slice(server.indexOf("async function reconcileScheduledAutomationState"),server.indexOf('app.get("/api/v1/automation-control"'));assert.match(reconcile,/dryRun:true/)});
test("successful execution marks lastExec while failures remain ledger-retryable",()=>{const run=server.slice(server.indexOf("async function executeScheduledAutomationOccurrence"),server.indexOf("async function automationSchedulerTick"));assert.match(run,/if\(ok\).*lastExecByClass/s);assert.match(run,/status:\"failed\"/);assert.doesNotMatch(run,/updatedAt=/)});
test("scheduler planning uses one dated occurrence resolver",()=>{assert.match(server,/function automationOccurrencesForDate/);for(const name of ["currentAutomationDisplayWinners","currentAutomationNonDisplayWinners","evaluateAutomationAt","automationSchedulerTick"]){const start=server.indexOf(`function ${name}`)>=0?server.indexOf(`function ${name}`):server.indexOf(`async function ${name}`);assert.ok(start>=0,name);const next=server.indexOf("\nfunction ",start+20),asyncNext=server.indexOf("\nasync function ",start+20),ends=[next,asyncNext].filter(x=>x>start);const end=ends.length?Math.min(...ends):start+5000;assert.match(server.slice(start,end),/automationOccurrencesForDate/,name)}});
test("automation timer paths use SchedulerClock business time",()=>{const timer=server.slice(server.indexOf('}else if(action==="display.timer.class-end")'),server.indexOf('}else if(action==="display.clear")'));assert.match(timer,/schedulerClock\.now\(\)/);assert.doesNotMatch(timer,/Date\.now\(\)/);const overlay=server.slice(server.indexOf("async function runAutomationTimerOverlay"),server.indexOf("function automationRunFailures"));assert.match(overlay,/schedulerClock\.now\(\)/);assert.doesNotMatch(overlay,/Date\.now\(\)/)});
test("planner tolerates optional provider failures and timer duration zero round trips",()=>{const load=controller.slice(controller.indexOf("async function loadSchedules"),controller.indexOf("function diagBadge"));assert.match(load,/Promise\.allSettled/);assert.match(load,/Optional data unavailable/);assert.match(controller,/Math\.max\(0,Number\(autoTimerOverlayMinutes\.value\?\?10\)\*60\)/);assert.match(html,/autoTimerOverlayMinutes[^>]+min=\"0\"/)});
''')

print('automation convergence hardening applied')
