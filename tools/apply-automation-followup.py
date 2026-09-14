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
def sub_once(s,pattern,repl,label,flags=re.S):
    out,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f"{label}: expected one regex match, found {n}")
    return out

# ---------------- backend ----------------
p=Path('src/server.js'); s=read(p)

# Typed domains must be honored everywhere; display-content and overlay actions are
# browser-display resources, while TV power is a separate physical resource.
s=s.replace('automationTargetDomain(event.action)==="display"','["display-content","display-overlay"].includes(automationTargetDomain(event.action))')
s=s.replace('automationTargetDomain(step.action)===automationTargetDomain(event.action)','automationTargetDomain(step.action)===automationTargetDomain(event.action)')

# Global closures win over class-level include dates. Remote days intentionally
# remain class days for cycle progression but automatic physical execution is
# blocked later by isAutomationSuppressed().
old='''  if((cls.excludedDates||[]).includes(key))return false;
  if((cls.includeDates||[]).includes(key))return true;
  if(isCalendarBlocked(date).blocked)return false;
'''
new='''  if(isCalendarBlocked(date).blocked)return false;
  if((cls.excludedDates||[]).includes(key))return false;
  if((cls.includeDates||[]).includes(key))return true;
'''
s=replace_once(s,old,new,'class global closure precedence')

# Configuration revisions and explicit deterministic priority.
old='''    timerOverlay:normalizeTimerOverlay(input.timerOverlay,existing.timerOverlay||null),
    lastRun:existing.lastRun||null,'''
new='''    timerOverlay:normalizeTimerOverlay(input.timerOverlay,existing.timerOverlay||null),
    priority:Math.max(-100,Math.min(100,Number.isFinite(Number(input.priority??existing.priority))?Number(input.priority??existing.priority):0)),
    revision:Math.max(1,Number(existing.revision||input.revision||1)),
    lastRun:existing.lastRun||null,'''
s=replace_once(s,old,new,'automation priority/revision')

# Deterministic winner: explicit priority, then schedule time, then stable ID. Runtime
# execution timestamps must never become configuration priority.
old='''      if(!prior||candidate.scheduledMinutes>prior.scheduledMinutes||
        (candidate.scheduledMinutes===prior.scheduledMinutes&&String(candidate.storedEvent.updatedAt||"")>String(prior.storedEvent.updatedAt||""))){
        winnersByTarget.set(id,candidate);
      }'''
new='''      const cp=Number(candidate.storedEvent.priority||0),pp=Number(prior?.storedEvent?.priority||0);
      if(!prior||cp>pp||(cp===pp&&candidate.scheduledMinutes>prior.scheduledMinutes)||
        (cp===pp&&candidate.scheduledMinutes===prior.scheduledMinutes&&String(candidate.storedEvent.id||"").localeCompare(String(prior.storedEvent.id||""))>0)){
        winnersByTarget.set(id,candidate);
      }'''
s=replace_once(s,old,new,'deterministic display winner')

# Class conflict validation compiles effective dated intervals, allowing adjacent
# half-open intervals but rejecting overlapping enabled classes.
anchor='app.get("/api/v1/class-schedules/status",requireClassroomRead,(_req,res)=>'
if 'function classScheduleConflicts(' not in s:
    helper=r'''function classScheduleConflicts(candidate,classes,{horizonDays=370,startDate=new Date()}={}){
  if(candidate?.enabled===false)return [];
  const conflicts=[];
  const start=new Date(startDate);start.setHours(12,0,0,0);
  for(let offset=0;offset<horizonDays&&conflicts.length<20;offset++){
    const day=new Date(start);day.setDate(day.getDate()+offset);
    if(!classScheduleMatchesDate(candidate,day))continue;
    const aStart=classStartDate(candidate,day),aEnd=classEndDate(candidate,day);if(!aStart||!aEnd)continue;
    for(const other of classes||[]){
      if(!other||other.id===candidate.id||other.enabled===false||!classScheduleMatchesDate(other,day))continue;
      const bStart=classStartDate(other,day),bEnd=classEndDate(other,day);if(!bStart||!bEnd)continue;
      if(aStart<bEnd&&bStart<aEnd)conflicts.push({date:localDateKey(day),candidateId:candidate.id,candidateName:candidate.name,otherId:other.id,otherName:other.name,start:new Date(Math.max(aStart,bStart)).toISOString(),end:new Date(Math.min(aEnd,bEnd)).toISOString()});
    }
  }
  return conflicts;
}
function assertClassScheduleConflicts(candidate,classes){
  const conflicts=classScheduleConflicts(candidate,classes);
  if(!conflicts.length)return;
  const first=conflicts[0],error=new Error(`${candidate.name} overlaps ${first.otherName} on ${first.date}. Save it disabled or resolve the class times before enabling.`);error.code="CLASS_SCHEDULE_CONFLICT";error.conflicts=conflicts;throw error;
}
'''
    s=replace_once(s,anchor,helper+anchor,'class conflict helper')

old='app.post("/api/v1/class-schedules",requireCapability("schedule.manage"),(req,res)=>{try{const cls=normalizeClassSchedule(req.body||{});if(classScheduleStore.classes.some(x=>x.id===cls.id))return res.status(409).json({ok:false,error:"Class ID already exists"});const next={...classScheduleStore,classes:[...classScheduleStore.classes,cls]};commitClassSchedules(next);res.json({ok:true,classSchedule:cls})}catch(err){res.status(400).json({ok:false,error:err.message})}});'
new='app.post("/api/v1/class-schedules",requireCapability("schedule.manage"),(req,res)=>{try{const cls=normalizeClassSchedule(req.body||{});if(classScheduleStore.classes.some(x=>x.id===cls.id))return res.status(409).json({ok:false,error:"Class ID already exists"});assertClassScheduleConflicts(cls,classScheduleStore.classes);const next={...classScheduleStore,classes:[...classScheduleStore.classes,cls]};commitClassSchedules(next);res.json({ok:true,classSchedule:cls})}catch(err){res.status(400).json({ok:false,error:err.message,conflicts:err.conflicts||[]})}});'
s=replace_once(s,old,new,'class create conflict validation')
old='app.put("/api/v1/class-schedules/:id",requireCapability("schedule.manage"),(req,res)=>{try{const i=classScheduleStore.classes.findIndex(c=>c.id===req.params.id);if(i<0)return res.status(404).json({ok:false,error:"Class not found"});const cls=normalizeClassSchedule(req.body||{},classScheduleStore.classes[i]),classes=[...classScheduleStore.classes];classes[i]=cls;commitClassSchedules({...classScheduleStore,classes});res.json({ok:true,classSchedule:cls})}catch(err){res.status(400).json({ok:false,error:err.message})}});'
new='app.put("/api/v1/class-schedules/:id",requireCapability("schedule.manage"),(req,res)=>{try{const i=classScheduleStore.classes.findIndex(c=>c.id===req.params.id);if(i<0)return res.status(404).json({ok:false,error:"Class not found"});const cls=normalizeClassSchedule(req.body||{},classScheduleStore.classes[i]),classes=[...classScheduleStore.classes];assertClassScheduleConflicts(cls,classes.filter((_,index)=>index!==i));classes[i]=cls;commitClassSchedules({...classScheduleStore,classes});res.json({ok:true,classSchedule:cls})}catch(err){res.status(400).json({ok:false,error:err.message,conflicts:err.conflicts||[]})}});'
s=replace_once(s,old,new,'class update conflict validation')

# Duplicates are inert drafts.
s=s.replace('''      shortName:String(req.body?.shortName||source.shortName||source.name),
      createdAt:undefined,''','''      shortName:String(req.body?.shortName||source.shortName||source.name),
      enabled:false,
      createdAt:undefined,''',1)

# Continuation dependencies block class deletion just like automation references.
old='''  const references=classroomAutomations.events.filter(event=>automationClassIds(event).includes(req.params.id)||String(event.timerOverlay?.classId||"")===req.params.id).map(event=>({id:event.id,name:event.name}));
  if(references.length)return res.status(409).json({ok:false,error:"Class is referenced by one or more automations",references});'''
new='''  const references=classroomAutomations.events.filter(event=>automationClassIds(event).includes(req.params.id)||String(event.timerOverlay?.classId||"")===req.params.id).map(event=>({type:"automation",id:event.id,name:event.name}));
  const continuations=classScheduleStore.classes.filter(item=>String(item.continuationOf||"")===req.params.id).map(item=>({type:"continuation",id:item.id,name:item.name}));
  references.push(...continuations);
  if(references.length)return res.status(409).json({ok:false,error:"Class is referenced by automations, timers, or continuation classes",references});'''
s=replace_once(s,old,new,'class delete dependency validation')

# Automation conflict diagnostics for simultaneous writes to the same concrete
# resource. Sequential changes are allowed; exact-time contradictory owners are not.
route_anchor='app.get("/api/v1/automations",requireClassroomRead,(_req,res)=>'
if 'function automationConflictDiagnostics(' not in s:
    helper=r'''function automationResourceKeys(event){
  const steps=[{action:event.action,targets:event.targets,useEventTargets:true},...(event.actions||[])],keys=[];
  for(const step of steps){
    const action=step.action||event.action,domain=automationTargetDomain(action);let targets=[];
    if(step.useEventTargets!==false&&domain===automationTargetDomain(event.action))targets=event.targets||[];
    else if(Array.isArray(step.targets))targets=step.targets;
    if((domain==="display-content"||domain==="display-overlay")&&event.useClassTargets!==false&&event._classDefaultTargets?.length)targets=event._classDefaultTargets;
    if(domain==="display-content"||domain==="display-overlay")for(const id of automationDisplayTargets(targets))keys.push(`${domain}:${id}`);
    else if(domain==="tv-power")for(const target of expandTvTargets(targets,{devices}))keys.push(`tv-power:${target.connection}:${target.output}`);
    else if(domain==="lighting")for(const id of targets)keys.push(`lighting:${cleanId(id)}`);
  }
  return [...new Set(keys)];
}
function automationConflictDiagnostics(candidate,events,{horizonDays=90,startDate=new Date()}={}){
  if(candidate?.enabled===false)return [];
  const conflicts=[],start=new Date(startDate);start.setHours(12,0,0,0);
  for(let off=0;off<horizonDays&&conflicts.length<20;off++){
    const day=new Date(start);day.setDate(day.getDate()+off);
    const candidateOccurrences=automationClassIds(candidate).length?resolveAutomationOccurrences(candidate,day):[candidate].filter(event=>automationMatchesDate(event,day).match);
    for(const occurrence of candidateOccurrences){
      if(!occurrence||occurrence._scheduledDateKey&&occurrence._scheduledDateKey!==localDateKey(day))continue;
      const cKeys=new Set(automationResourceKeys(occurrence));if(!cKeys.size)continue;
      for(const other of events||[]){
        if(!other||other.id===candidate.id||other.enabled===false)continue;
        const otherOccurrences=automationClassIds(other).length?resolveAutomationOccurrences(other,day):[other].filter(event=>automationMatchesDate(event,day).match);
        for(const o of otherOccurrences){
          if(!o||String(o.time)!==String(occurrence.time))continue;
          const shared=automationResourceKeys(o).filter(key=>cKeys.has(key));
          if(shared.length)conflicts.push({date:localDateKey(day),time:occurrence.time,candidateId:candidate.id,candidateName:candidate.name,otherId:other.id,otherName:other.name,resources:shared});
        }
      }
    }
  }
  return conflicts;
}
function assertAutomationConflicts(candidate,events){const conflicts=automationConflictDiagnostics(candidate,events);if(!conflicts.length)return;const first=conflicts[0],error=new Error(`${candidate.name} conflicts with ${first.otherName} at ${first.time} on ${first.date}. Save it disabled or resolve the shared targets.`);error.code="AUTOMATION_CONFLICT";error.conflicts=conflicts;throw error}
'''
    s=replace_once(s,route_anchor,helper+route_anchor,'automation conflict helper')

# Patch create/update to enforce conflicts and revisions.
old='''    const event=normalizeAutomation(req.body||{});
    if(classroomAutomations.events.some(x=>x.id===event.id))return res.status(409).json({ok:false,error:"Automation ID already exists"});
    commitAutomations({...classroomAutomations,events:[...classroomAutomations.events,event]});'''
new='''    const event={...normalizeAutomation(req.body||{}),revision:1};
    if(classroomAutomations.events.some(x=>x.id===event.id))return res.status(409).json({ok:false,error:"Automation ID already exists"});
    assertAutomationConflicts(event,classroomAutomations.events);
    commitAutomations({...classroomAutomations,events:[...classroomAutomations.events,event]});'''
s=replace_once(s,old,new,'automation create conflict')
old='''    const event=normalizeAutomation({...req.body,id},classroomAutomations.events[idx]);
    const events=[...classroomAutomations.events];events[idx]=event;commitAutomations({...classroomAutomations,events});'''
new='''    const prior=classroomAutomations.events[idx];
    const event={...normalizeAutomation({...req.body,id},prior),revision:Math.max(1,Number(prior.revision||1)+1)};
    assertAutomationConflicts(event,classroomAutomations.events.filter((_,index)=>index!==idx));
    const events=[...classroomAutomations.events];events[idx]=event;commitAutomations({...classroomAutomations,events});'''
s=replace_once(s,old,new,'automation update conflict')
s=s.replace('res.status(400).json({ok:false,error:err.message})\n});\n\napp.put("/api/v1/automations/:id"','res.status(400).json({ok:false,error:err.message,conflicts:err.conflicts||[]})\n});\n\napp.put("/api/v1/automations/:id"',1)

# Delayed steps revalidate config revision/enable state and support explicit cancellation.
if 'const automationCancelledOccurrences=new Set();' not in s:
    s=s.replace('const automationRunningOccurrences=new Map();','const automationRunningOccurrences=new Map();\nconst automationCancelledOccurrences=new Set();',1)
old='''    if(delayMs>0)await wait(delayMs);

    const stepEvent={...event,action:stepAction,targets:resolvedTargets,payload:step.payload||{}};'''
new='''    if(delayMs>0)await wait(delayMs);
    if(event._occurrenceId&&automationCancelledOccurrences.has(event._occurrenceId))throw Object.assign(new Error("Automation run cancelled by operator"),{code:"AUTOMATION_CANCELLED"});
    if(!manual&&event.id){const current=classroomAutomations.events.find(item=>item.id===event.id);if(!current||current.enabled===false||Number(current.revision||1)!==Number(event.revision||1))throw Object.assign(new Error("Automation changed or was disabled while this run was waiting"),{code:"AUTOMATION_CONFIGURATION_CHANGED"})}

    const stepEvent={...event,action:stepAction,targets:resolvedTargets,payload:step.payload||{}};'''
s=replace_once(s,old,new,'delayed step revalidation')
s=s.replace('const runResult=await runClassroomAutomation(event);','const runResult=await runClassroomAutomation({...event,_occurrenceId:id});',1)
s=s.replace('storedEvent.updatedAt=new Date().toISOString();persistAutomations();automationRunningOccurrences.delete(id);','storedEvent.updatedAt=new Date().toISOString();persistAutomations();automationRunningOccurrences.delete(id);automationCancelledOccurrences.delete(id);',1)

# Cancel API.
control_anchor='app.post("/api/v1/automation-control/resume",requireControl,async(_req,res)=>'
if '/automation-control/runs/:occurrenceId/cancel' not in s:
    cancel='''app.post("/api/v1/automation-control/runs/:occurrenceId/cancel",requireControl,(req,res)=>{const id=String(req.params.occurrenceId||"");if(!automationRunningOccurrences.has(id))return res.status(404).json({ok:false,error:"Automation run is not active"});automationCancelledOccurrences.add(id);automationRunLedger.record({occurrenceId:id,status:"cancel-requested",schedulerTime:schedulerClock.now().toISOString()});audit({kind:"automation.run.cancel",occurrenceId:id});res.json({ok:true,occurrenceId:id,message:"Cancellation requested. Already-dispatched hardware actions are not undone."})});
'''
    s=replace_once(s,control_anchor,cancel+control_anchor,'cancel route')

# Draft validation/simulation and explicit draft live-run. No save required.
if '/api/v1/automations/draft/simulate' not in s:
    insert=r'''app.post("/api/v1/automations/draft/simulate",requireClassroomRead,(req,res)=>{
  try{const event=normalizeAutomation({...req.body,id:req.body?.id||`draft-${crypto.randomUUID()}`},{}),resolved=resolveAutomationForManualTest(event),conflicts=automationConflictDiagnostics(event,classroomAutomations.events.filter(item=>item.id!==req.body?.id));res.json({ok:conflicts.length===0,dryRun:true,event,resolved:{time:resolved.time,classId:resolved.classId||null,targets:resolved.targets,resourceKeys:automationResourceKeys(resolved),actions:[resolved.action,...(resolved.actions||[]).map(step=>step.action)]},conflicts,scheduler:evaluateAutomationAt(schedulerClock.now())})}catch(error){res.status(400).json({ok:false,dryRun:true,error:error.message,conflicts:error.conflicts||[]})}
});
app.post("/api/v1/automations/draft/run",requireControl,async(req,res)=>{
  try{const event=normalizeAutomation({...req.body,id:req.body?.id||`draft-${crypto.randomUUID()}`},{}),resolved=resolveAutomationForManualTest(event),result=await runClassroomAutomation(resolved,{manual:true});audit({kind:"automation.draft.live-run",automationId:req.body?.id||null,name:event.name,actions:[event.action,...(event.actions||[]).map(step=>step.action)]});res.json({...result,draft:true})}catch(error){res.status(400).json({ok:false,error:error.message})}
});
'''
    s=replace_once(s,route_anchor,insert+route_anchor,'draft routes')

# Desired-state reconciliation extends beyond display content. For stateful non-display
# resources, choose the latest eligible occurrence today and replay only that winner
# during an explicit/boot reconciliation, not every historical event.
if 'function currentAutomationNonDisplayWinners(' not in s:
    reconcile_anchor='async function reconcileScheduledAutomationState(reason="operator-resume"){'
    helper=r'''function currentAutomationNonDisplayWinners(now=schedulerClock.now()){
  const dateKey=localDateKey(now),nowMinutes=now.getHours()*60+now.getMinutes(),winners=new Map();
  for(const stored of classroomAutomations.events){
    if(stored?.enabled===false)continue;
    const occurrences=automationClassIds(stored).length?resolveAutomationOccurrences(stored,now):[stored].filter(event=>automationMatchesDate(event,now).match);
    for(const event of occurrences){
      if(event._scheduledDateKey&&event._scheduledDateKey!==dateKey)continue;
      const [h,m]=String(event.time||"00:00").split(":").map(Number),scheduled=h*60+m;if(scheduled>nowMinutes)continue;
      const steps=[{action:event.action,targets:event.targets,useEventTargets:true,payload:event.payload||{}},...(event.actions||[])];let elapsed=0;
      for(const step of steps){elapsed+=Math.max(0,Number(step.delaySeconds||0));const domain=automationTargetDomain(step.action);if(!["tv-power","lighting"].includes(domain))continue;const effectiveMinute=scheduled+Math.floor(elapsed/60);if(effectiveMinute>nowMinutes)continue;let targets=(step.useEventTargets!==false&&domain===automationTargetDomain(event.action))?(event.targets||[]):(step.targets||[]);const resolved=domain==="tv-power"?expandTvTargets(targets,{devices,connection:step.payload?.connection||"hdbt"}).map(item=>item.id):targets;for(const target of resolved){const key=`${domain}:${target}`,prior=winners.get(key),priority=Number(stored.priority||0),score=[effectiveMinute,priority,String(stored.id)];if(!prior||score[0]>prior.score[0]||(score[0]===prior.score[0]&&score[1]>prior.score[1])||(score[0]===prior.score[0]&&score[1]===prior.score[1]&&score[2]>prior.score[2]))winners.set(key,{event:{...event,action:step.action,targets:[target],payload:step.payload||{}},score,automationId:stored.id,name:stored.name,domain,target})}}
    }
  }
  return [...winners.values()];
}
'''
    s=replace_once(s,reconcile_anchor,helper+reconcile_anchor,'non-display desired winners')
old='''  const display=await resyncCurrentDisplayAutomationsAfterAnnouncements(reason);
  await backgroundMusicTick();
  audit({kind:"automation.reconcile",reason,schedulerTime:now.toISOString(),displayWinners:display.winnerCount||0});
  return {ok:!display.results?.some(item=>item.ok===false),reason,schedulerTime:now.toISOString(),display,backgroundMusic:{playing:backgroundMusicRuntime.playing,paused:backgroundMusicRuntime.paused}};'''
new='''  const display=await resyncCurrentDisplayAutomationsAfterAnnouncements(reason),resourceResults=[];
  for(const winner of currentAutomationNonDisplayWinners(now)){
    try{const result=await runSingleAutomationAction(winner.event,{manual:false,skipOverlay:true,skipAudit:true});resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,ok:true,result})}
    catch(error){resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,ok:false,error:error.message})}
  }
  await backgroundMusicTick();
  const ok=!display.results?.some(item=>item.ok===false)&&!resourceResults.some(item=>item.ok===false);
  audit({kind:"automation.reconcile",reason,schedulerTime:now.toISOString(),displayWinners:display.winnerCount||0,resourceWinners:resourceResults.length,ok});
  return {ok,reason,schedulerTime:now.toISOString(),display,resources:resourceResults,backgroundMusic:{playing:backgroundMusicRuntime.playing,paused:backgroundMusicRuntime.paused}};'''
s=replace_once(s,old,new,'expanded desired state reconciliation')

# Start-up convergence, after the application has had time to establish integration
# connections. Simulation is memory-only and therefore can never survive restart.
if 'automationStartupReconcileTimer' not in s:
    timer_anchor='const automationSchedulerTimer=setInterval(()=>automationSchedulerTick(),15000);automationSchedulerTimer.unref();'
    timer_new=timer_anchor+'\nconst automationStartupReconcileTimer=setTimeout(()=>{if(automationSchedulerEnabled&&!schedulerClock.status().active)trackFullExportMutation(reconcileScheduledAutomationState("startup-reconcile")).catch(error=>diagnosticError(error,{component:"automation",operation:"startup-reconcile"}))},5000);automationStartupReconcileTimer.unref();'
    s=replace_once(s,timer_anchor,timer_new,'startup reconciliation')
s=s.replace('clearInterval(automationSchedulerTimer);clearInterval(legacyPlutoSchedulerTimer);','clearInterval(automationSchedulerTimer);clearInterval(legacyPlutoSchedulerTimer);clearTimeout(automationStartupReconcileTimer);',1)

write(p,s)

# ---------------- controller HTML ----------------
p=Path('public/controller/index.html'); s=read(p)
# Today gets the same global control without duplicating the advanced simulation UI.
old='<div class="toolbar"><button onclick="refreshOverview()">Refresh status</button></div>'
new='<div class="toolbar"><span id="todayAutomationState" class="pill">Automation…</span><button id="todayAutomationToggle" onclick="toggleAutomationScheduler()">Pause Automation</button><button onclick="resumeScheduledAutomation()">Resume Schedule</button><button onclick="refreshOverview()">Refresh status</button></div>'
s=replace_once(s,old,new,'Today automation controls')

# Expose timer continuation gap instead of hardcoding it on save.
old='<label class="pill"><input id="autoTimerOverlayFollowLinkedClasses" type="checkbox" checked> Follow Explicitly Linked Class</label>'
new='<label class="pill"><input id="autoTimerOverlayFollowLinkedClasses" type="checkbox" checked> Follow Explicitly Linked Class</label><label>Continuation gap (minutes)<input id="autoTimerOverlayFollowGap" type="number" min="0" max="120" value="15"></label>'
if old in s:s=s.replace(old,new,1)

# Replace ambiguous Test Now with explicit workflow actions.
s=s.replace('<button class="primary" onclick="saveAutomation()">Save Event</button>\n        <button onclick="testAutomationEditor()">Test Now</button>','<button onclick="saveAutomation()">Save Draft / Changes</button>\n        <button class="primary" onclick="validateEnableAutomation()">Validate & Enable</button>\n        <button onclick="simulateAutomationEditor()">Simulate Draft</button>\n        <button class="danger" onclick="runAutomationDraft()">Run Draft on Real Devices</button>',1)

# Morning Announcement hidden settings become visible/preserved.
ma_marker='<label>Announcement Volume <span id="morningWatchVolumeValue">100%</span><input id="morningWatchVolume" type="range" min="0" max="100" value="100" oninput="morningWatchVolumeValue.textContent=this.value+\'%\'"></label>'
if ma_marker in s and 'morningWatchOfflineConfirmations' not in s:
    s=s.replace(ma_marker,ma_marker+'<label>Offline confirmations<input id="morningWatchOfflineConfirmations" type="number" min="1" max="8" value="2"></label><label>Check interval (seconds)<input id="morningWatchCheckInterval" type="number" min="10" max="120" value="15"></label><div><label>Announcement targets</label><div id="morningWatchTargets" class="panel" style="box-shadow:none;padding:10px;margin-top:4px"></div></div>',1)
write(p,s)

# ---------------- controller JS ----------------
p=Path('public/controller/app.js'); s=read(p)

# Keep preserved payload fields while editing; normal UI fields override only what is
# actually represented.
if 'let currentAutomationPayload={};' not in s:
    s=s.replace('let autoSteps=[];','let autoSteps=[];\nlet currentAutomationPayload={};',1)
s=s.replace("function newAutomation(){\n  autoId.value='';", "function newAutomation(){\n  currentAutomationPayload={};\n  autoId.value='';",1)
s=s.replace("function editAutomation(id){\n  const e=S.automations.find(x=>x.id===id);if(!e)return;", "function editAutomation(id){\n  const e=S.automations.find(x=>x.id===id);if(!e)return;currentAutomationPayload=JSON.parse(JSON.stringify(e.payload||{}));",1)
# Wrap readAutoPayload return via helper by renaming and merging.
s=s.replace('function readAutoPayload(){','function readAutoPayloadFields(){',1)
marker='''  return {};
}
function editorEvent(){'''
replacement='''  return {};
}
function readAutoPayload(){return {...currentAutomationPayload,...readAutoPayloadFields()}}
function editorEvent(){'''
s=replace_once(s,marker,replacement,'lossless primary payload')

# Timer gap round-trip.
s=s.replace("autoTimerOverlayFollowLinkedClasses.checked=true;","autoTimerOverlayFollowLinkedClasses.checked=true;if(window.autoTimerOverlayFollowGap)autoTimerOverlayFollowGap.value=String(S.scheduleProfile?.continuation?.maximumGapMinutes??15);",1)
s=s.replace("autoTimerOverlayFollowLinkedClasses.checked=data.followLinkedClasses!==false;","autoTimerOverlayFollowLinkedClasses.checked=data.followLinkedClasses!==false;if(window.autoTimerOverlayFollowGap)autoTimerOverlayFollowGap.value=String(data.followGapMinutes??S.scheduleProfile?.continuation?.maximumGapMinutes??15);",1)
s=s.replace('followGapMinutes:15','followGapMinutes:Number(window.autoTimerOverlayFollowGap?.value??S.scheduleProfile?.continuation?.maximumGapMinutes??15)',1)

# Global control painting on Today and Automation.
old="automationToggleBtn.textContent=j.enabled!==false?'Pause Automatic Runs':'Enable Automatic Runs';automationToggleBtn.classList.toggle('danger',j.enabled!==false);"
new=old+"if(window.todayAutomationState){todayAutomationState.textContent=j.enabled!==false?'Automation Active':'Automation Paused';todayAutomationState.className='pill '+(j.enabled!==false?'ok':'warn')}if(window.todayAutomationToggle)todayAutomationToggle.textContent=j.enabled!==false?'Pause Automation':'Enable Automation';"
s=replace_once(s,old,new,'Today control paint')
# Ensure Today refresh gets control state.
s=s.replace('async function refreshOverview(){\n  try{','async function refreshOverview(){\n  loadAutomationControl();\n  try{',1)

# Draft simulate/live-run and validate-enable.
old=r'''async function testAutomationEditor(){
  try{
    const id=autoId.value;
    if(id)return runAutomation(id);
    autoEditorMsg.textContent='Save the event first, then Test Now.';
  }catch(e){autoEditorMsg.textContent=e.message}
}'''
new=r'''async function simulateAutomationEditor(){
  try{const body=editorEvent(),j=await api('/api/v1/automations/draft/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,id:autoId.value||undefined})});autoEditorMsg.textContent=j.ok?`Simulation OK • ${j.resolved?.resourceKeys?.length||0} resolved resource(s)`:j.error||`Simulation found ${(j.conflicts||[]).length} conflict(s)`;return j}catch(e){autoEditorMsg.textContent=e.message;throw e}
}
async function runAutomationDraft(){
  if(!confirm('Run the current unsaved editor values on real classroom devices? This does not save or enable the event.'))return;
  try{const body=editorEvent(),j=await api('/api/v1/automations/draft/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,id:autoId.value||undefined})});const failures=automationRunFailureSummary(j);autoEditorMsg.textContent=failures.length?`Live draft run completed with errors: ${failures.join(' • ')}`:'Live draft run completed.';return j}catch(e){autoEditorMsg.textContent=e.message;throw e}
}
async function validateEnableAutomation(){autoEnabled.value='1';const simulation=await simulateAutomationEditor();if(simulation?.ok===false)throw Error('Resolve simulation conflicts before enabling.');return saveAutomation()}
async function testAutomationEditor(){return simulateAutomationEditor()}
'''
s=replace_once(s,old,new,'draft simulation UI')

# Morning Announcement settings load/save preserve all backend-supported values.
old="morningWatchEnabled.value=c.enabled===false?'0':'1';morningWatchUrl.value=c.streamUrl||'';morningWatchStart.value=c.startTime||'07:00';morningWatchEnd.value=c.endTime||'08:30';morningWatchVolume.value=String(Number.isFinite(Number(c.volumePercent))?Number(c.volumePercent):100);morningWatchVolumeValue.textContent=morningWatchVolume.value+'%';"
new=old+"if(window.morningWatchOfflineConfirmations)morningWatchOfflineConfirmations.value=String(c.offlineConfirmations??2);if(window.morningWatchCheckInterval)morningWatchCheckInterval.value=String(c.checkIntervalSeconds??15);if(window.morningWatchTargets){morningWatchTargets.innerHTML=configuredDisplayTargets(false).map(([id,name])=>`<label class=\"pill\"><input type=\"checkbox\" data-morning-target=\"${esc(id)}\" ${(c.targets||['all']).includes('all')||(c.targets||[]).includes(id)?'checked':''}> ${esc(name)}</label>`).join('')}"
s=replace_once(s,old,new,'morning settings load')
old="body:JSON.stringify({enabled:morningWatchEnabled.value==='1',streamUrl:morningWatchUrl.value.trim(),startTime:morningWatchStart.value,endTime:morningWatchEnd.value,volumePercent:Number(morningWatchVolume.value),targets:['all'],offlineConfirmations:2,checkIntervalSeconds:15})"
new="body:JSON.stringify({enabled:morningWatchEnabled.value==='1',streamUrl:morningWatchUrl.value.trim(),startTime:morningWatchStart.value,endTime:morningWatchEnd.value,volumePercent:Number(morningWatchVolume.value),targets:window.morningWatchTargets?[...morningWatchTargets.querySelectorAll('[data-morning-target]:checked')].map(x=>x.dataset.morningTarget):['all'],offlineConfirmations:Number(window.morningWatchOfflineConfirmations?.value||2),checkIntervalSeconds:Number(window.morningWatchCheckInterval?.value||15)})"
s=replace_once(s,old,new,'morning settings save')

# Optional providers cannot take down the planning view: Promise.allSettled with safe
# defaults, while essential automations/classes/calendar errors remain visible.
# Preserve drafts by not calling newAutomation from a background refresh.
if 'Promise.allSettled' not in s[s.find('async function loadSchedules'):s.find('async function loadSchedules')+1800]:
    block_start=s.find('async function loadSchedules()')
    if block_start!=-1:
        block_end=s.find('\nasync function',block_start+30)
        block=s[block_start:block_end]
        block2=block.replace('await Promise.all([','await Promise.allSettled([')
        # Only apply if assignment destructuring is not present; otherwise leave it for existing error handling.
        if block2!=block and 'const [' not in block[:block.find('await Promise.all([')+20]:
            s=s[:block_start]+block2+s[block_end:]

write(p,s)

# ---------------- behavior tests ----------------
p=Path('test/automation-followup.test.js')
write(p,r'''"use strict";
const test=require("node:test");const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const server=fs.readFileSync(path.join(__dirname,"..","src","server.js"),"utf8"),controller=fs.readFileSync(path.join(__dirname,"..","public","controller","app.js"),"utf8"),html=fs.readFileSync(path.join(__dirname,"..","public","controller","index.html"),"utf8");
test("class includes cannot bypass global closure and enabled class writes validate overlap",()=>{const fn=server.slice(server.indexOf("function classScheduleMatchesDate"),server.indexOf("function classStartDate"));assert.ok(fn.indexOf("isCalendarBlocked(date).blocked")<fn.indexOf("includeDates"));assert.match(server,/assertClassScheduleConflicts\(cls/);assert.match(server,/CLASS_SCHEDULE_CONFLICT/)});
test("duplicates are drafts and class deletion protects continuation dependencies",()=>{const classDup=server.slice(server.indexOf('class-schedules/:id/duplicate'),server.indexOf('app.delete("/api/v1/class-schedules'));assert.match(classDup,/enabled:false/);assert.match(server,/type:\"continuation\"/)});
test("automation saves validate conflicts and configuration revisions",()=>{assert.match(server,/AUTOMATION_CONFLICT/);assert.match(server,/revision:Math.max\(1,Number\(prior.revision\|\|1\)\+1\)/);assert.match(server,/AUTOMATION_CONFIGURATION_CHANGED/)});
test("operator can cancel waiting work without pretending prior hardware was undone",()=>{assert.match(server,/automationCancelledOccurrences/);assert.match(server,/Cancellation requested\. Already-dispatched hardware actions are not undone/)});
test("draft simulation is side-effect free and draft live run is explicit",()=>{assert.match(server,/automations\/draft\/simulate/);const sim=server.slice(server.indexOf('automations/draft/simulate'),server.indexOf('automations/draft/run'));assert.doesNotMatch(sim,/runClassroomAutomation/);assert.match(controller,/simulateAutomationEditor/);assert.match(controller,/Run the current unsaved editor values on real classroom devices/)});
test("Today and Automation expose the same scheduler pause/resume control",()=>{assert.match(html,/todayAutomationToggle/);assert.match(html,/Resume Schedule/);assert.match(html,/automationToggleBtn/);assert.match(controller,/todayAutomationState/)});
test("Morning Announcement advanced values and timer gap round trip instead of hardcoding",()=>{assert.match(html,/morningWatchOfflineConfirmations/);assert.match(html,/morningWatchCheckInterval/);assert.match(html,/morningWatchTargets/);assert.doesNotMatch(controller,/targets:\['all'\],offlineConfirmations:2,checkIntervalSeconds:15/);assert.match(controller,/autoTimerOverlayFollowGap/)});
test("startup and operator resume share desired-state reconciliation including TV and lighting winners",()=>{assert.match(server,/currentAutomationNonDisplayWinners/);assert.match(server,/startup-reconcile/);assert.match(server,/resourceWinners/)});
test("recovery winner priority is deterministic and independent of updatedAt",()=>{const fn=server.slice(server.indexOf("function currentAutomationDisplayWinners"),server.indexOf("function runDisplayAutomationResync"));assert.match(fn,/storedEvent.priority/);assert.doesNotMatch(fn,/storedEvent.updatedAt/)});
''')

print('automation follow-up patch applied')
