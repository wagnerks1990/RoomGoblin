#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def text(path): return (ROOT/path).read_text()
def write(path,value): (ROOT/path).write_text(value)
def once(value,old,new,label):
    count=value.count(old)
    if count!=1: raise SystemExit(f"{label}: expected one match, found {count}")
    return value.replace(old,new,1)
def sub_once(value,pattern,repl,label,flags=re.S):
    new,count=re.subn(pattern,repl,value,count=1,flags=flags)
    if count!=1: raise SystemExit(f"{label}: expected one regex match, found {count}")
    return new

# ---------------------------------------------------------------------------
# Backend integration
# ---------------------------------------------------------------------------
p=Path("src/server.js"); s=text(p)

import_line='const {defaultSchoolScheduleProfile,legacySchoolScheduleProfile,normalizeSchoolScheduleProfile,effectiveTimesForRule,groupForCycleDay,validTime}=require("./school-schedule");'
if 'require("./automation-runtime")' not in s:
    s=once(s,import_line,import_line+'\nconst {actionResourceDomain,normalizeIntegerMinutes,expandDisplayTargets,expandTvTargets,assertAdapterResults,SchedulerClock,occurrenceId,makeLedger}=require("./automation-runtime");','runtime import')

store_line='const dbStore = new ClassroomHubStorage({dataDir:DATA_DIR,dbFile:DATABASE_FILE,masterKeyFile:MASTER_KEY_FILE,legacyMirror:LEGACY_JSON_MIRROR});'
if 'const schedulerClock=new SchedulerClock' not in s:
    s=once(s,store_line,store_line+'''\nconst schedulerClock=new SchedulerClock({timezone:SCHEDULER_TIMEZONE});
const automationRunLedger=makeLedger(dbStore);
let automationSchedulerEnabled=(dbStore.getPreference("automation.scheduler",{enabled:true})||{}).enabled!==false;
function setAutomationSchedulerEnabled(value){automationSchedulerEnabled=!!value;dbStore.setPreference("automation.scheduler",{enabled:automationSchedulerEnabled,updatedAt:new Date().toISOString()});return automationSchedulerEnabled}
function automationControlStatus(){const clock=schedulerClock.status(),ledger=automationRunLedger.read();return {enabled:automationSchedulerEnabled,clock,runningOccurrences:typeof automationRunningOccurrences!=="undefined"?automationRunningOccurrences.size:0,recentRuns:ledger.runs.slice(-25).reverse()}}
''','scheduler runtime init')

s=once(s,'const offsetValue=Number(input.classTimeOffsetMinutes??existing.classTimeOffsetMinutes??0);\n  if(!Number.isFinite(offsetValue))throw new Error("Class time offset must be a finite number");','const offsetValue=normalizeIntegerMinutes(input.classTimeOffsetMinutes??existing.classTimeOffsetMinutes??0,{name:"Class time offset",fallback:0,min:-720,max:720});','integer automation offset')
s=once(s,'classTimeOffsetMinutes:Math.max(-720,Math.min(720,offsetValue)),','classTimeOffsetMinutes:offsetValue,','store integer automation offset')

s=sub_once(s,r'function automationTargetDomain\(action\)\{.*?\n\}', '''function automationTargetDomain(action){
  return actionResourceDomain(action);
}''','typed automation domain')
s=sub_once(s,r'function automationDisplayTargets\(targets\)\{.*?\n\}', '''function automationDisplayTargets(targets){
  return expandDisplayTargets(targets,{devices,displayGroups});
}''','display target resolver')

needle='function automationVariableContext(event,date=new Date())'
if 'function requireAutomationTargets' not in s:
    s=once(s,needle,'''function requireAutomationTargets(targets,label="Automation action"){
  const resolved=automationDisplayTargets(targets);
  if(!resolved.length)throw new Error(`${label} has no valid display targets`);
  return resolved;
}
function automationVariableContext(event,date=schedulerClock.now())''','target validation helper')
else:
    s=s.replace(needle,'function automationVariableContext(event,date=schedulerClock.now())',1)
s=s.replace('function expandAutomationVariables(value,event,date=new Date())','function expandAutomationVariables(value,event,date=schedulerClock.now())',1)
s=s.replace('function expandAutomationPayload(value,event,date=new Date())','function expandAutomationPayload(value,event,date=schedulerClock.now())',1)
s=s.replace('const p=expandAutomationPayload(event.payload||{},event,new Date());','const p=expandAutomationPayload(event.payload||{},event,schedulerClock.now());',1)

# TV power: always expand aggregate aliases into the proven per-output CEC operation.
s=sub_once(s,r'''  if\(action==="tv\.power"\)\{.*?\n  \}else if\(action==="display\.timer\.class-end"\)\{''','''  if(action==="tv.power"){
    const on=String(p.state||"on").toLowerCase()==="on";
    const tvTargets=expandTvTargets(event.targets,{devices,connection:p.connection==="hdmi"?"hdmi":"hdbt"});
    if(p.output!==undefined&&tvTargets.length===1){const output=Number(p.output);if(Number.isInteger(output)&&output>=1&&output<=8)tvTargets[0].output=output}
    for(const target of tvTargets){
      outputs.results.push(await directPluto({action:"cecOutput",output:target.output,connection:target.connection,index:on?0:1}));
    }
    assertAdapterResults(outputs.results,{action:"TV power"});
    outputs.tvTargets=tvTargets;
  }else if(action==="display.timer.class-end"){''','per-output TV power')

for action,label in [('display.clear','Display clear'),('display.text','Display text'),('display.url','Display URL'),('display.media','Display media')]:
    old=f'  }}else if(action==="{action}"){{\n    const ts=automationDisplayTargets(event.targets);'
    new=f'  }}else if(action==="{action}"){{\n    const ts=requireAutomationTargets(event.targets,"{label}");'
    if old in s:s=s.replace(old,new,1)

s=s.replace('Number(timerOverlay.durationSeconds||600)','Number(timerOverlay.durationSeconds??600)')

# Remove destructive global pre-clear. Display content actions already own their
# explicit clearBefore behavior and display.clear remains an explicit action.
s=sub_once(s,r'''\n  // alpha\.23: every scheduled/manual automation starts from a known display state,.*?\n  for\(let i=0;i<steps\.length;i\+\+\)\{''','''
  // Resource isolation: no automation implicitly clears display content. Only an
  // explicit display.clear or a display content action with clearBefore enabled may
  // replace its own resolved display targets.
  for(let i=0;i<steps.length;i++){''','remove implicit pre-clear')

# Replace step target resolution with typed target behavior.
s=sub_once(s,r'''    const stepAction=step\.action\|\|event\.action;\n    const stepDomain=automationTargetDomain\(stepAction\);\n    const eventDomain=automationTargetDomain\(event\.action\);.*?\n    let lockedTargets=\[\];''','''    const stepAction=step.action||event.action;
    const stepDomain=automationTargetDomain(stepAction);
    const eventDomain=automationTargetDomain(event.action);
    const explicitTargets=Array.isArray(step.targets)&&step.targets.length ? step.targets : [];
    let rawTargets=[];
    if(step.useEventTargets!==false&&stepDomain===eventDomain)rawTargets=event.targets||[];
    else if((stepDomain==="display-content"||stepDomain==="display-overlay")&&event.useClassTargets!==false&&Array.isArray(event._classDefaultTargets)&&event._classDefaultTargets.length)rawTargets=event._classDefaultTargets;
    else if(explicitTargets.length)rawTargets=explicitTargets;
    let resolvedTargets;
    if(stepDomain==="display-content"||stepDomain==="display-overlay")resolvedTargets=automationDisplayTargets(rawTargets);
    else if(stepDomain==="tv-power")resolvedTargets=expandTvTargets(rawTargets,{devices,connection:step.payload?.connection||"hdbt"}).map(item=>item.id);
    else resolvedTargets=[...rawTargets];
    let lockedTargets=[];''','typed step target resolution')

s=s.replace('if(stepDomain==="display"&&!bypassAnnouncementPriority){','if((stepDomain==="display-content"||stepDomain==="display-overlay"||stepDomain==="tv-power")&&!bypassAnnouncementPriority){',1)
s=s.replace('resolvedTargets=automationDisplayTargets(resolvedTargets).filter(id=>!lockedSet.has(id));','resolvedTargets=resolvedTargets.filter(id=>!lockedSet.has(id));',1)
s=s.replace('''    try{
      const result=await runSingleAutomationAction(stepEvent,{manual,skipOverlay:true,skipAudit:true});''','''    try{
      if(["display-content","display-overlay","tv-power","lighting"].includes(stepDomain)&&!stepEvent.targets.length)throw new Error(`${stepAction} has no valid targets`);
      const result=await runSingleAutomationAction(stepEvent,{manual,skipOverlay:true,skipAudit:true});''',1)

# Scheduler uses the business clock, global suppression for every occurrence, a
# durable claim, and detached execution so delayed actions never block discovery.
start=s.index('// Unified Classroom Automation scheduler')
end=s.index('// Legacy per-output Pluto schedules retained for migration/backward compatibility.')
new_scheduler=r'''// Unified Classroom Automation scheduler
// Discovery is short/non-blocking. Each due occurrence is durably claimed before
// execution and may wait independently without blocking other scheduled work.
let automationSchedulerBusy=false;
const automationRunningOccurrences=new Map();
async function executeScheduledAutomationOccurrence(storedEvent,event,{dateKey,scheduledMinuteKey,deltaMinutes,occurrenceKey}){
  const id=occurrenceId(event,dateKey,event.time);
  automationRunLedger.record({occurrenceId:id,automationId:storedEvent.id,classId:event.classId||null,status:"running",schedulerTime:schedulerClock.now().toISOString()});
  try{
    const runResult=await runClassroomAutomation(event);
    storedEvent.lastRun={at:new Date().toISOString(),scheduledFor:`${dateKey} ${event.time}`,resolvedClassId:event.classId||null,delayMinutes:deltaMinutes,ok:runResult.ok!==false,message:runResult.ok===false?"Completed with action errors":(deltaMinutes>0?`Completed (${deltaMinutes} min catch-up)`:"Completed"),resultSummary:{action:event.action,actions:[event.action,...(event.actions||[]).map(x=>x.action)],targets:event.targets,failures:automationRunFailures(runResult)}};
    automationRunLedger.record({occurrenceId:id,automationId:storedEvent.id,classId:event.classId||null,status:runResult.ok===false?"failed":"succeeded",schedulerTime:schedulerClock.now().toISOString(),failures:automationRunFailures(runResult)});
  }catch(err){
    storedEvent.lastRun={at:new Date().toISOString(),scheduledFor:`${dateKey} ${event.time}`,resolvedClassId:event.classId||null,delayMinutes:deltaMinutes,ok:false,message:err.message};
    automationRunLedger.record({occurrenceId:id,automationId:storedEvent.id,classId:event.classId||null,status:"failed",schedulerTime:schedulerClock.now().toISOString(),error:err.message});
    audit({kind:"automation.error",automationId:storedEvent.id,name:storedEvent.name,error:err.message});
  }finally{
    storedEvent.updatedAt=new Date().toISOString();persistAutomations();automationRunningOccurrences.delete(id);
  }
}
async function automationSchedulerTick(){
  if(fullExportFreeze.requested||automationSchedulerBusy||!automationSchedulerEnabled)return;
  const clockStatus=schedulerClock.status();
  if(clockStatus.active&&!schedulerClock.commandsAllowed())return;
  automationSchedulerBusy=true;
  try{
    const now=schedulerClock.now(),suppression=isAutomationSuppressed(now);
    if(suppression.blocked)return;
    const dateKey=localDateKey(now),nowMinutes=now.getHours()*60+now.getMinutes();
    for(const storedEvent of classroomAutomations.events){
      if(!storedEvent?.enabled)continue;
      const referenceDates=[-1,0,1].map(offset=>{const d=new Date(now);d.setDate(d.getDate()+offset);return d});
      const occurrences=automationClassIds(storedEvent).length
        ? referenceDates.flatMap(referenceDate=>resolveAutomationOccurrences(storedEvent,referenceDate)).filter(event=>event._scheduledDateKey===dateKey)
        : [storedEvent];
      for(const event of occurrences){
        const dateMatch=event._sourceDateMatched?{match:true,reason:"Class occurrence"}:automationMatchesDate(event,now);
        if(!dateMatch.match||isAutomationSuppressed(now).blocked)continue;
        const [eventHour,eventMinute]=String(event.time||"00:00").split(":").map(Number);
        const scheduledMinutes=eventHour*60+eventMinute,deltaMinutes=nowMinutes-scheduledMinutes;
        if(deltaMinutes<0||deltaMinutes>SCHEDULER_CATCHUP_MINUTES)continue;
        const occurrenceKey=event.classId||"manual",scheduledMinuteKey=`${dateKey} ${event.time}`;
        storedEvent.lastExecByClass=storedEvent.lastExecByClass||{};
        if(storedEvent.lastExecByClass[occurrenceKey]===scheduledMinuteKey)continue;
        const id=occurrenceId(event,dateKey,event.time);
        const claim=automationRunLedger.claim(id,{automationId:storedEvent.id,classId:event.classId||null,schedulerTime:now.toISOString()});
        if(!claim.claimed)continue;
        if(morningAnnouncementsRuntime.active&&announcementLockedDisplayTargets([...automationDeferredDisplayTargets(event)]).length)queueAutomationDuringAnnouncements(storedEvent,event,dateKey,scheduledMinuteKey,deltaMinutes);
        storedEvent.lastExecByClass[occurrenceKey]=scheduledMinuteKey;storedEvent.lastExec=scheduledMinuteKey;storedEvent.updatedAt=new Date().toISOString();persistAutomations();
        const task=trackFullExportMutation(executeScheduledAutomationOccurrence(storedEvent,event,{dateKey,scheduledMinuteKey,deltaMinutes,occurrenceKey}));
        automationRunningOccurrences.set(id,task);task.catch(()=>{});
      }
    }
  }catch(error){diagnosticError(error,{component:"automation",operation:"scheduler-tick"})}
  finally{automationSchedulerBusy=false}
}
const automationSchedulerTimer=setInterval(()=>automationSchedulerTick(),15000);automationSchedulerTimer.unref();

'''
s=s[:start]+new_scheduler+s[end:]

# Legacy TV schedule shares scheduler pause/simulation and announcement arbitration.
legacy_start=s.index('// Legacy per-output Pluto schedules retained for migration/backward compatibility.')
legacy_end=s.index('\nconnectMqtt();',legacy_start)
new_legacy=r'''// Legacy per-output Pluto schedules retained for migration/backward compatibility.
// They share the same scheduler policy and Morning Announcements power reservation.
let legacyPlutoSchedulerBusy=false;
const legacyPlutoSchedulerTimer=setInterval(async()=>{
  if(fullExportFreeze.requested||legacyPlutoSchedulerBusy||!automationSchedulerEnabled)return;
  const clockStatus=schedulerClock.status();if(clockStatus.active&&!schedulerClock.commandsAllowed())return;
  legacyPlutoSchedulerBusy=true;
  try{
    const now=schedulerClock.now(),hhmm=String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
    const day=now.getDay(),minuteKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")} ${hhmm}`;
    let changed=false;if(isAutomationSuppressed(now).blocked)return;
    for(const sch of Object.values(plutoSchedules)){
      if(!sch?.enabled||!Array.isArray(sch.days)||!sch.days.map(Number).includes(day))continue;
      sch.lastExec=sch.lastExec||{};sch.lastRun=sch.lastRun||{};
      for(const [kind,time,index] of [["on",sch.onTime,0],["off",sch.offTime,1]]){
        if(time!==hhmm||sch.lastExec[kind]===minuteKey)continue;
        const displayId=Object.keys(devices).find(id=>Number(devices[id]?.avOutput)===Number(sch.index));
        if(displayId&&morningAnnouncementsRuntime.active&&announcementLockedDisplayTargets([displayId]).length){sch.lastRun={text:`Deferred ${kind} while Morning Announcements own ${displayId}`,stamp:Date.now(),ok:true,deferred:true};changed=true;continue}
        sch.lastExec[kind]=minuteKey;
        try{const result=await directPluto({action:"cecOutput",output:Number(sch.index),connection:sch.type,index});assertAdapterResults([result],{action:"Legacy TV power"});sch.lastRun={text:`${kind==="on"?"On":"Off"} ${now.toLocaleString()}`,stamp:Date.now(),ok:true}}
        catch(e){sch.lastRun={text:`ERROR ${now.toLocaleString()}: ${e.message}`,stamp:Date.now(),ok:false}}
        changed=true;
      }
    }
    if(changed)persistPlutoSchedules();
  }finally{legacyPlutoSchedulerBusy=false}
},15000);legacyPlutoSchedulerTimer.unref();
'''
s=s[:legacy_start]+new_legacy+s[legacy_end:]

# Reconciliation and simulated-time operator API. Reuse the same current winner
# resolver already used after Morning Announcements.
auto_route='app.get("/api/v1/automations",requireClassroomRead,(_req,res)=>{'
if '/api/v1/automation-control' not in s:
    insert=r'''function evaluateAutomationAt(now=schedulerClock.now()){
  const suppression=isAutomationSuppressed(now),dateKey=localDateKey(now),items=[];
  for(const stored of classroomAutomations.events){
    const occurrences=automationClassIds(stored).length?resolveAutomationOccurrences(stored,now):[stored];
    for(const event of occurrences){
      const match=event._sourceDateMatched?{match:true,reason:"Class occurrence"}:automationMatchesDate(event,now);
      items.push({automationId:stored.id,name:stored.name,enabled:stored.enabled!==false,time:event.time,classId:event.classId||null,match:!!match.match,suppressed:!!suppression.blocked,reason:suppression.blocked?suppression.reason:(match.reason||null),targets:event.targets||[],actions:[event.action,...(event.actions||[]).map(step=>step.action)]});
    }
  }
  return {observedAt:new Date().toISOString(),schedulerTime:now.toISOString(),schoolCycle:schoolCycleForDate(now),suppression,items};
}
async function reconcileScheduledAutomationState(reason="operator-resume"){
  const now=schedulerClock.now(),suppression=isAutomationSuppressed(now);
  if(suppression.blocked)return {ok:true,skipped:true,reason:suppression.reason,schedulerTime:now.toISOString()};
  if(morningAnnouncementsRuntime.active)return {ok:true,deferred:true,reason:"Morning Announcements have priority",targets:[...(morningAnnouncementsRuntime.targets||[])]};
  const display=await resyncCurrentDisplayAutomationsAfterAnnouncements(reason);
  await backgroundMusicTick();
  audit({kind:"automation.reconcile",reason,schedulerTime:now.toISOString(),displayWinners:display.winnerCount||0});
  return {ok:!display.results?.some(item=>item.ok===false),reason,schedulerTime:now.toISOString(),display,backgroundMusic:{playing:backgroundMusicRuntime.playing,paused:backgroundMusicRuntime.paused}};
}
app.get("/api/v1/automation-control",requireClassroomRead,(_req,res)=>res.json({ok:true,...automationControlStatus()}));
app.put("/api/v1/automation-control",requireCapability("automation.manage"),(req,res)=>{const enabled=setAutomationSchedulerEnabled(req.body?.enabled!==false);audit({kind:"automation.scheduler.toggle",enabled});res.json({ok:true,...automationControlStatus()})});
app.post("/api/v1/automation-control/resume",requireControl,async(_req,res)=>{try{const result=await reconcileScheduledAutomationState("operator-resume");res.json(result)}catch(error){res.status(500).json({ok:false,error:error.message})}});
app.post("/api/v1/automation-control/simulation",requireCapability("automation.manage"),(req,res)=>{try{if(req.body?.active===false)schedulerClock.clearSimulation();else schedulerClock.setSimulation(req.body?.schedulerTime);if(req.body?.liveCommands===true)schedulerClock.enableLiveCommands(req.body?.liveMinutes||15);audit({kind:"automation.simulation",active:schedulerClock.status().active,liveCommands:schedulerClock.status().liveCommands,schedulerTime:schedulerClock.status().schedulerTime});res.json({ok:true,...automationControlStatus(),evaluation:evaluateAutomationAt(schedulerClock.now())})}catch(error){res.status(400).json({ok:false,error:error.message})}});
app.get("/api/v1/automation-control/evaluate",requireClassroomRead,(_req,res)=>res.json({ok:true,...evaluateAutomationAt(schedulerClock.now())}));

'''
    s=once(s,auto_route,insert+auto_route,'automation control routes')

# Copies are drafts, not immediately competing enabled schedules.
s=s.replace('name:String(req.body?.name||`${source.name} - Copy`),\n      lastRun:null,','name:String(req.body?.name||`${source.name} - Copy`),\n      enabled:false,\n      lastRun:null,')

# Preview connections must never navigate to the secret redaction sentinel. Keep the
# secret out of browser state while showing an explicit protected-content placeholder.
s=s.replace('state: publicProjection(persistentState.displays[deviceId] || null),','state: previewDisplayState(deviceId),',1)
if 'function previewDisplayState(id)' not in s:
    anchor='function physicalDisplayState(id){\n  const state=structuredClone(persistentState.displays[id]||null);\n  if(state?.media?.protectedUrl==="morning-announcements")state.media.url=announcementsPlaybackUrl();\n  return state;\n}'
    replacement=anchor+'''\nfunction previewDisplayState(id){
  const state=publicProjection(persistentState.displays[id]||null);
  if(state?.media?.protectedUrl==="morning-announcements")state.media={type:"protected-preview",protectedUrl:"morning-announcements",label:"Morning Announcements / Herd TV is active on this display"};
  return state;
}'''
    s=once(s,anchor,replacement,'protected preview state')

# Shutdown new interval handles.
s=s.replace('clearInterval(heartbeatTimer);clearInterval(veyonPoolTimer);clearInterval(goveeReconcileTimer);','clearInterval(heartbeatTimer);clearInterval(veyonPoolTimer);clearInterval(goveeReconcileTimer);clearInterval(automationSchedulerTimer);clearInterval(legacyPlutoSchedulerTimer);',1)

write(p,s)

# ---------------------------------------------------------------------------
# Physical display: render a protected preview placeholder instead of attempting
# to GET the redaction sentinel. Real displays still receive the hydrated URL.
# ---------------------------------------------------------------------------
p=Path("public/display/index.html"); s=text(p)
old="function renderMedia(m){let authorizedUrl='';if(m?.url){try{authorizedUrl=authorizeAssetUrl(m.url)}catch{badge.textContent=`${id} rejected invalid media URL`;return}}clearWebAudioTimers();"
new="function renderMedia(m){if(preview&&m?.type==='protected-preview'){clearWebAudioTimers();activeWebFrame=null;activeWebSpec=null;media.replaceChildren();const box=document.createElement('div');box.style.cssText='font-size:72px;text-align:center;padding:80px;line-height:1.2';box.textContent=m.label||'Protected live content is active on this display';media.appendChild(box);return}let authorizedUrl='';if(m?.url){try{authorizedUrl=authorizeAssetUrl(m.url)}catch{badge.textContent=`${id} rejected invalid media URL`;return}}clearWebAudioTimers();"
if old in s:s=s.replace(old,new,1)
write(p,s)

# ---------------------------------------------------------------------------
# Operator GUI controls and lossless class editing.
# ---------------------------------------------------------------------------
p=Path("public/controller/index.html"); s=text(p)
old='''  <div class="top">\n    <div><h1>Classroom Automation Scheduler</h1><div class="muted">Schedule TV power, display content, URLs, media, documents, and Govee lighting throughout the day.</div><div id="schedulerClock" class="muted" style="margin-top:5px">Checking scheduler clock…</div></div>\n    <div class="toolbar"><button onclick="loadSchedules()">Refresh</button><button class="primary" onclick="newAutomation()">+ New Event</button></div>\n  </div>\n'''
new='''  <div class="top">\n    <div><h1>Classroom Automation Scheduler</h1><div class="muted">Schedule TV power, display content, URLs, media, documents, and Govee lighting throughout the day.</div><div id="schedulerClock" class="muted" style="margin-top:5px">Checking scheduler clock…</div></div>\n    <div class="toolbar"><button onclick="loadSchedules()">Refresh</button><button class="primary" onclick="newAutomation()">+ New Event</button></div>\n  </div>\n  <div id="automationControlPanel" class="panel" style="margin-bottom:14px">\n    <div class="top"><div><b>Scheduled Automation</b><div id="automationControlSummary" class="muted">Loading scheduler control…</div></div><div class="toolbar"><button id="automationToggleBtn" onclick="toggleAutomationScheduler()">Pause Automatic Runs</button><button class="primary" onclick="resumeScheduledAutomation()">Resume Scheduled State</button></div></div>\n    <details class="workspaceDisclosure" style="margin-top:10px"><summary>Simulation / Troubleshooting</summary><div class="disclosureBody"><div id="automationSimulationBanner" class="status"></div><div class="grid2"><label>Simulated date & time<input id="automationSimulatedTime" type="datetime-local"></label><label>Live test commands<select id="automationSimulationLive"><option value="0">Dry run only</option><option value="1">Allow real-device commands for 15 minutes</option></select></label></div><div class="toolbar"><button onclick="applyAutomationSimulation()">Apply Simulated Time</button><button onclick="evaluateAutomationSimulation()">Evaluate Now</button><button onclick="clearAutomationSimulation()">Return to Real Time</button></div><div id="automationSimulationResults" class="muted" style="margin-top:8px"></div></div></details>\n  </div>\n'''
if old in s:s=s.replace(old,new,1)
s=s.replace('RoomGoblin automatically clears all display screens before Action 1. Add Action 2, Action 3, and more here; they run in order. Cross-domain actions use their own target type.','Actions are resource-isolated: lighting, TV power, AV, timers, and display content affect only their resolved targets. Add Action 2, Action 3, and more here; they run in order.')
write(p,s)

p=Path("public/controller/app.js"); s=text(p)
# Preserve disabled class state through an unchanged edit/save.
s=s.replace("let currentClassEdit={days:[1,2,3,4,5],scheduleMode:'weekly',alternatePhase:'A',anchorDate:'',includeDates:[],dayType:'Any',cycleDays:[]};","let currentClassEdit={days:[1,2,3,4,5],scheduleMode:'weekly',alternatePhase:'A',anchorDate:'',includeDates:[],dayType:'Any',cycleDays:[],enabled:true};",1)
s=s.replace("currentClassEdit={days:[1,2,3,4,5],scheduleMode:'schoolcycle',alternatePhase:'A',anchorDate:S.scheduleProfile?.anchorDate||'',cycleDays:[],dayType:'Any'};","currentClassEdit={days:[1,2,3,4,5],scheduleMode:'schoolcycle',alternatePhase:'A',anchorDate:S.scheduleProfile?.anchorDate||'',cycleDays:[],dayType:'Any',enabled:true};",1)
s=s.replace("currentClassEdit={days:x.days||[1,2,3,4,5],scheduleMode:x.scheduleMode||'schoolcycle',alternatePhase:x.alternatePhase||'A',anchorDate:x.anchorDate||S.scheduleProfile?.anchorDate||'',cycleDays:x.cycleDays||periodPresetCycleDays(x.period),dayType:x.dayType||cycleDayColor(x.cycleDays||[])};","currentClassEdit={days:x.days||[1,2,3,4,5],scheduleMode:x.scheduleMode||'schoolcycle',alternatePhase:x.alternatePhase||'A',anchorDate:x.anchorDate||S.scheduleProfile?.anchorDate||'',cycleDays:x.cycleDays||periodPresetCycleDays(x.period),dayType:x.dayType||cycleDayColor(x.cycleDays||[]),enabled:x.enabled!==false};",1)
s=s.replace("cycleDays,defaultTargets:selectedClassDefaultTargets(),notes:classNotes.value,enabled:true","cycleDays,defaultTargets:selectedClassDefaultTargets(),notes:classNotes.value,enabled:currentClassEdit.enabled!==false",1)

# Whole-minute editor preview.
s=s.replace("function automationResolvedTime(cls,ref,offset){const t=ref==='end'?cls.endTime:cls.startTime;let [h,m]=t.split(':').map(Number),mins=h*60+m+Number(offset||0);mins=((mins%1440)+1440)%1440;return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`}","function automationResolvedTime(cls,ref,offset){const n=Number(offset||0);if(!Number.isInteger(n))return 'Invalid whole-minute offset';const t=ref==='end'?cls.endTime:cls.startTime;let [h,m]=t.split(':').map(Number),mins=h*60+m+n;mins=((mins%1440)+1440)%1440;return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`}",1)

# Scheduler controls.
if 'async function loadAutomationControl()' not in s:
    anchor='function automationResolvedTime(cls,ref,offset)'
    idx=s.index(anchor)
    controls=r'''let AUTOMATION_CONTROL=null;
async function loadAutomationControl(){
  try{const j=await api('/api/v1/automation-control');AUTOMATION_CONTROL=j;paintAutomationControl(j)}catch(e){if(window.automationControlSummary)automationControlSummary.textContent=`Scheduler control error: ${e.message}`}
}
function paintAutomationControl(j={}){
  if(!window.automationControlSummary)return;const clock=j.clock||{},mode=clock.active?'TEST CLOCK':'Real time';automationControlSummary.textContent=`${j.enabled!==false?'Automatic runs ON':'Automatic runs PAUSED'} • ${mode} • ${clock.schedulerTime?new Date(clock.schedulerTime).toLocaleString():''}`;
  automationToggleBtn.textContent=j.enabled!==false?'Pause Automatic Runs':'Enable Automatic Runs';automationToggleBtn.classList.toggle('danger',j.enabled!==false);
  automationSimulationBanner.textContent=clock.active?`TEST CLOCK ACTIVE — ${new Date(clock.schedulerTime).toLocaleString()} • ${clock.liveCommands?'REAL DEVICE COMMANDS ENABLED':'dry-run only'}`:'';
  automationSimulationBanner.className=`status ${clock.active?(clock.liveCommands?'bad':'warn'):''}`;
}
async function toggleAutomationScheduler(){try{const j=await api('/api/v1/automation-control',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:AUTOMATION_CONTROL?.enabled===false})});AUTOMATION_CONTROL=j;paintAutomationControl(j)}catch(e){notify(e.message,'error')}}
async function resumeScheduledAutomation(){try{const j=await api('/api/v1/automation-control/resume',{method:'POST'});notify(j.deferred?j.reason:'Scheduled state reconciled.',j.ok===false?'error':'success');await Promise.all([loadAutomationControl(),refreshOverview()])}catch(e){notify(e.message,'error')}}
function simulatedIsoFromInput(){const v=automationSimulatedTime.value;if(!v)throw Error('Choose a simulated date and time.');const d=new Date(v);if(Number.isNaN(d.getTime()))throw Error('Simulated date/time is invalid.');return d.toISOString()}
async function applyAutomationSimulation(){try{const j=await api('/api/v1/automation-control/simulation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schedulerTime:simulatedIsoFromInput(),liveCommands:automationSimulationLive.value==='1',liveMinutes:15})});AUTOMATION_CONTROL=j;paintAutomationControl(j);paintAutomationEvaluation(j.evaluation)}catch(e){notify(e.message,'error')}}
async function clearAutomationSimulation(){try{const j=await api('/api/v1/automation-control/simulation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:false})});AUTOMATION_CONTROL=j;paintAutomationControl(j);automationSimulationResults.textContent=''}catch(e){notify(e.message,'error')}}
async function evaluateAutomationSimulation(){try{paintAutomationEvaluation(await api('/api/v1/automation-control/evaluate'))}catch(e){notify(e.message,'error')}}
function paintAutomationEvaluation(j={}){if(!window.automationSimulationResults)return;const items=(j.items||[]).filter(x=>x.enabled);automationSimulationResults.innerHTML=`<b>${esc(j.schoolCycle?.reason||j.schoolCycle?.dayColor||'Schedule')}</b> • ${esc(j.suppression?.blocked?`Suppressed: ${j.suppression.reason}`:'Automatic actions eligible')}<br>`+items.slice(0,30).map(x=>`${esc(x.time||'')} • ${esc(x.name)} — ${x.suppressed||!x.match?'SKIP':'MATCH'}${x.reason?' • '+esc(x.reason):''}`).join('<br>')}

'''
    s=s[:idx]+controls+s[idx:]

# Load the control independently so optional provider failures do not hide it.
s=s.replace("if(id==='schedules'){loadSchedules();ensureAutomationMediaLibrary().then(refreshAutomationMediaPickers);}","if(id==='schedules'){loadAutomationControl();loadSchedules();ensureAutomationMediaLibrary().then(refreshAutomationMediaPickers);}")
# If exact minified statement differs, append to loadSchedules success path via broad occurrence.
s=s.replace("schedulerClock.textContent=`Timezone: ${esc(j.scheduler?.timezone||'')} • Server: ${esc(j.scheduler?.localTime||'')}`;","schedulerClock.textContent=`Timezone: ${esc(j.scheduler?.timezone||'')} • Server: ${esc(j.scheduler?.localTime||'')}`;loadAutomationControl();")

write(p,s)

# Include the runtime module in syntax validation.
p=Path("package.json"); s=text(p)
s=s.replace('node --check src/server.js &&','node --check src/server.js && node --check src/automation-runtime.js &&',1)
write(p,s)

print('automation reliability patch applied')
