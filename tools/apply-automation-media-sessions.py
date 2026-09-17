#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(p): return (ROOT/p).read_text()
def write(p,s): (ROOT/p).write_text(s)
def once(s,old,new,label):
    n=s.count(old)
    if n!=1: raise SystemExit(f"{label}: expected 1 match, found {n}")
    return s.replace(old,new,1)
def sub1(s,pat,repl,label,flags=re.S):
    out,n=re.subn(pat,repl,s,count=1,flags=flags)
    if n!=1: raise SystemExit(f"{label}: expected 1 regex match, found {n}")
    return out

# -----------------------------------------------------------------------------
# Backend: action execution policy + persistent display media sessions.
# -----------------------------------------------------------------------------
p=Path('src/server.js'); s=read(p)

marker='''const AUTOMATION_ACTIONS=new Set([\n  "tv.power","display.clear","display.text","display.url","display.media","display.timer.class-end",\n  "govee.power","govee.color","govee.brightness","govee.temp","govee.scene"\n]);\n'''
insert=marker+'''const AUTOMATION_EXECUTION_MODES=new Set(["once","repeat","loop"]);\nfunction normalizeAutomationExecutionMode(value,action){\n  const mode=String(value||"once").trim().toLowerCase();\n  if(!AUTOMATION_EXECUTION_MODES.has(mode))return "once";\n  // Continuous looping is intentionally native only for media. Reissuing power,\n  // routing, lighting or clear commands forever is unsafe and unnecessary.\n  return mode==="loop"&&action!=="display.media"?"repeat":mode;\n}\nfunction automationRepeatCount(value){const n=Number(value);return Number.isInteger(n)?Math.max(1,Math.min(100,n)):2}\nfunction automationRepeatDelaySeconds(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(3600,n)):0}\n'''
s=once(s,marker,insert,'automation execution helpers')

old='''          delaySeconds:Math.max(0,Math.min(3600,delaySeconds)),\n          continueOnError:item?.continueOnError!==false'''
new='''          delaySeconds:Math.max(0,Math.min(3600,delaySeconds)),\n          executionMode:normalizeAutomationExecutionMode(item?.executionMode,stepAction),\n          repeatCount:automationRepeatCount(item?.repeatCount),\n          repeatDelaySeconds:automationRepeatDelaySeconds(item?.repeatDelaySeconds),\n          continueOnError:item?.continueOnError!==false'''
s=once(s,old,new,'additional action execution policy')

old='''  const steps=[{id:"primary",action:event.action,targets:event.targets,useEventTargets:true,payload:event.payload||{},delaySeconds:0,continueOnError:true},...additional];'''
new='''  const steps=[{id:"primary",action:event.action,targets:event.targets,useEventTargets:true,payload:event.payload||{},delaySeconds:0,executionMode:"once",repeatCount:1,repeatDelaySeconds:0,continueOnError:true},...additional];'''
s=once(s,old,new,'primary action execution defaults')

old='''    const stepEvent={...event,action:stepAction,payload:step.payload||{},targets:resolvedTargets,timerOverlay:null};\n    try{\n      if(["display-content","display-overlay","tv-power","lighting"].includes(stepDomain)&&!stepEvent.targets.length)throw new Error(`${stepAction} has no valid targets`);\n      const result=await runSingleAutomationAction(stepEvent,{manual,skipOverlay:true,skipAudit:true});\n      combined.results.push(...(result.results||[]));\n      combined.steps.push({index:i+1,id:step.id||`step-${i+1}`,action:stepEvent.action,targets:stepEvent.targets,ok:true,...(lockedTargets.length?{deferred:true,lockedTargets}:{})});'''
new='''    const executionMode=normalizeAutomationExecutionMode(step.executionMode,stepAction);\n    const repeatCount=executionMode==="repeat"?automationRepeatCount(step.repeatCount):1;\n    const repeatDelaySeconds=automationRepeatDelaySeconds(step.repeatDelaySeconds);\n    const stepEvent={...event,_stepId:step.id||`step-${i+1}`,action:stepAction,payload:{...(step.payload||{}),...(executionMode==="loop"&&stepAction==="display.media"?{loop:true}:{})},targets:resolvedTargets,timerOverlay:null};\n    try{\n      if(["display-content","display-overlay","tv-power","lighting"].includes(stepDomain)&&!stepEvent.targets.length)throw new Error(`${stepAction} has no valid targets`);\n      let lastResult=null;\n      for(let attempt=0;attempt<repeatCount;attempt++){\n        if(attempt&&repeatDelaySeconds)await new Promise(r=>setTimeout(r,repeatDelaySeconds*1000));\n        if(event._occurrenceId&&automationCancelledOccurrences.has(event._occurrenceId))throw Object.assign(new Error("Automation run cancelled by operator"),{code:"AUTOMATION_CANCELLED"});\n        lastResult=await runSingleAutomationAction(stepEvent,{manual,skipOverlay:true,skipAudit:true});\n        combined.results.push(...(lastResult.results||[]));\n      }\n      combined.steps.push({index:i+1,id:step.id||`step-${i+1}`,action:stepEvent.action,targets:stepEvent.targets,ok:true,executionMode,repeatCount,...(lockedTargets.length?{deferred:true,lockedTargets}:{})});'''
s=once(s,old,new,'action execution loop')

# Add stable session metadata and playback configuration to uploaded video delivery.
pat=r'''(\}else if\(action==="display\.media"\)\{.*?const rec=mediaLibrary\.files\[name\]\|\|\{\},type=rec\.type\|\|classifyMedia\(name,rec\.mime\|\|""\);)(.*?)(\n  \}else if\(action==="display\.timer\.class-end"\))'''
m=re.search(pat,s,re.S)
if not m: raise SystemExit('display media action block not found')
block=m.group(1)+m.group(2)
# The existing block already constructs the command payload. Replace known video payload keys if present,
# otherwise inject session configuration immediately after type resolution and let the later payload spread it.
if 'sessionId' not in block:
    block=block.replace('const rec=mediaLibrary.files[name]||{},type=rec.type||classifyMedia(name,rec.mime||"");',
'''const rec=mediaLibrary.files[name]||{},type=rec.type||classifyMedia(name,rec.mime||"");\n    const mediaSession={\n      sessionId:String(p.sessionId||`${event._occurrenceId||event.id||"manual"}:${event._stepId||"primary"}:${name}`),\n      volume:Math.max(0,Math.min(1,Number(p.volume??1))),\n      muted:!!p.muted,loop:!!p.loop,\n      startAtSeconds:Math.max(0,Number(p.startAtSeconds||0)),\n      endAtSeconds:Number(p.endAtSeconds)>0?Number(p.endAtSeconds):null,\n      playbackRate:Math.max(.25,Math.min(4,Number(p.playbackRate||1)))\n    };''')
    # Inject session properties into every display.video payload in this block.
    block=block.replace("payload:{url,fit:p.fit||'contain',autoplay:true,loop:!!p.loop,muted:!!p.muted}","payload:{url,fit:p.fit||'contain',autoplay:true,...mediaSession}")
    block=block.replace('payload:{url,fit:p.fit||"contain",autoplay:true,loop:!!p.loop,muted:!!p.muted}', 'payload:{url,fit:p.fit||"contain",autoplay:true,...mediaSession}')
    # Fallback for payloads that already spread p.
    block=block.replace('payload:{url,fit:p.fit||"contain",autoplay:true,...p}', 'payload:{url,fit:p.fit||"contain",autoplay:true,...p,...mediaSession}')
    block=block.replace("payload:{url,fit:p.fit||'contain',autoplay:true,...p}","payload:{url,fit:p.fit||'contain',autoplay:true,...p,...mediaSession}")
s=s[:m.start()]+block+m.group(3)+s[m.end():]

# Manual media-session control API. It controls the current element without reissuing display.media.
api_marker='''app.post("/api/v1/automations/draft/run",schedulerMutationLimit,requireControl,async(req,res)=>{'''
api_block='''app.post("/api/v1/displays/:id/media/control",schedulerMutationLimit,requireControl,async(req,res)=>{\n  try{\n    const id=cleanId(req.params.id);if(!id||!displayDevices[id]||displayDevices[id].enabled===false)throw new Error("Unknown display");\n    const action=String(req.body?.action||"").trim().toLowerCase();\n    if(!["play","pause","stop","restart","seek","volume","mute","rate"].includes(action))throw new Error("Unsupported media control action");\n    const payload={action};\n    if(action==="seek")payload.positionSeconds=Math.max(0,Number(req.body?.positionSeconds||0));\n    if(action==="volume")payload.volume=Math.max(0,Math.min(1,Number(req.body?.volume??1)));\n    if(action==="mute")payload.muted=req.body?.muted!==false;\n    if(action==="rate")payload.playbackRate=Math.max(.25,Math.min(4,Number(req.body?.playbackRate||1)));\n    const result=await executeCommand({type:"display.media.control",target:[id],payload},"controller");\n    audit({kind:"display.media.control",deviceId:id,action});\n    res.json({ok:true,result});\n  }catch(error){res.status(400).json({ok:false,error:error.message})}\n});\n\n'''+api_marker
s=once(s,api_marker,api_block,'media control API')

# Record receiver media telemetry for controller scrubber/status.
ws_marker='''      if (msg.type === "display.media.ended" && ws.role === "display") {'''
ws_block='''      if (msg.type === "display.media.status" && ws.role === "display") {\n        const previous=runtime.displays[ws.deviceId]||{};\n        runtime.displays[ws.deviceId]={...previous,mediaSession:boundedWsObject(msg.status,"Media session status"),lastSeen:new Date().toISOString()};\n        return;\n      }\n\n'''+ws_marker
s=once(s,ws_marker,ws_block,'media telemetry websocket')
write(p,s)

# -----------------------------------------------------------------------------
# Display receiver: persistent HTML5 video session, live controls and telemetry.
# -----------------------------------------------------------------------------
p=Path('public/display/index.html'); s=read(p)

new_render=r'''let activeMediaSession=null,mediaStatusLastSent=0;
function reportMediaStatus(reason='timeupdate'){
  const video=activeMediaSession?.video;if(preview||!video||!ws||ws.readyState!==1)return;
  const now=Date.now();if(reason==='timeupdate'&&now-mediaStatusLastSent<750)return;mediaStatusLastSent=now;
  const spec=activeMediaSession.spec||{};
  try{ws.send(JSON.stringify({type:'display.media.status',status:{sessionId:spec.sessionId||null,state:video.ended?'ended':video.paused?'paused':'playing',positionSeconds:Number(video.currentTime||0),durationSeconds:Number.isFinite(video.duration)?Number(video.duration):null,volume:Number(video.volume),muted:!!video.muted,loop:!!video.loop,playbackRate:Number(video.playbackRate||1),startAtSeconds:Number(spec.startAtSeconds||0),endAtSeconds:Number(spec.endAtSeconds)||null,reason}}))}catch{}
}
function configureVideoSession(video,m){
  const start=Math.max(0,Number(m.startAtSeconds||0)),end=Number(m.endAtSeconds)>0?Number(m.endAtSeconds):null;
  video.autoplay=m.autoplay!==false;video.muted=!!m.muted;video.defaultMuted=!!m.muted;video.volume=Math.max(0,Math.min(1,Number(m.volume??1)));video.loop=!!m.loop&&!end;video.playbackRate=Math.max(.25,Math.min(4,Number(m.playbackRate||1)));video.playsInline=true;
  activeMediaSession={video,spec:{...m,startAtSeconds:start,endAtSeconds:end}};
  const enforceEnd=()=>{if(!activeMediaSession||activeMediaSession.video!==video)return;if(end&&video.currentTime>=end-.08){if(m.loop){video.currentTime=start;video.play().catch(()=>{})}else{video.pause();reportMediaStatus('clip-ended');if(ws&&ws.readyState===1){try{ws.send(JSON.stringify({type:'display.media.ended',mediaType:'video',sessionId:m.sessionId||null}))}catch{}}}}else reportMediaStatus('timeupdate')};
  video.addEventListener('timeupdate',enforceEnd);video.addEventListener('play',()=>reportMediaStatus('play'));video.addEventListener('pause',()=>reportMediaStatus('pause'));video.addEventListener('ratechange',()=>reportMediaStatus('ratechange'));video.addEventListener('volumechange',()=>reportMediaStatus('volumechange'));
  video.addEventListener('loadedmetadata',()=>{const wanted=Math.min(Number.isFinite(video.duration)?video.duration:start,start);if(Math.abs(video.currentTime-wanted)>.2)video.currentTime=wanted;reportMediaStatus('loadedmetadata')});
  video.oncanplay=()=>{if(m.forceAudio){video.muted=false;video.defaultMuted=false;video.volume=Math.max(.01,Number(m.volume??1))}if(m.autoplay!==false)video.play().catch(()=>{});reportMediaStatus('canplay')};
  video.onended=()=>{reportMediaStatus('ended');if(!video.loop&&ws&&ws.readyState===1){try{ws.send(JSON.stringify({type:'display.media.ended',mediaType:'video',sessionId:m.sessionId||null}))}catch{}}};
}
function applyMediaControl(p={}){
  const video=activeMediaSession?.video;if(!video)return false;const action=String(p.action||'').toLowerCase(),spec=activeMediaSession.spec||{};
  if(action==='play')video.play().catch(()=>{});
  else if(action==='pause')video.pause();
  else if(action==='stop'){video.pause();video.currentTime=Math.max(0,Number(spec.startAtSeconds||0));}
  else if(action==='restart'){video.currentTime=Math.max(0,Number(spec.startAtSeconds||0));video.play().catch(()=>{});}
  else if(action==='seek')video.currentTime=Math.max(0,Math.min(Number.isFinite(video.duration)?video.duration:Number.MAX_SAFE_INTEGER,Number(p.positionSeconds||0)));
  else if(action==='volume'){video.volume=Math.max(0,Math.min(1,Number(p.volume??1)));if(video.volume>0){video.muted=false;video.defaultMuted=false}}
  else if(action==='mute'){video.muted=p.muted!==false;video.defaultMuted=video.muted;}
  else if(action==='rate')video.playbackRate=Math.max(.25,Math.min(4,Number(p.playbackRate||1)));
  else return false;reportMediaStatus(action);return true;
}
function renderMedia(m){
  if(preview&&m?.type==='protected-preview'){clearWebAudioTimers();activeWebFrame=null;activeWebSpec=null;activeMediaSession=null;media.replaceChildren();const box=document.createElement('div');box.style.cssText='font-size:72px;text-align:center;padding:80px;line-height:1.2';box.textContent=m.label||'Protected live content is active on this display';media.appendChild(box);return}
  let authorizedUrl='';if(m?.url){try{authorizedUrl=authorizeAssetUrl(m.url)}catch{badge.textContent=`${id} rejected invalid media URL`;return}}
  if(m?.type==='video'&&activeMediaSession?.video&&activeMediaSession.spec?.sessionId&&m.sessionId===activeMediaSession.spec.sessionId&&authorizedUrl===activeMediaSession.spec.authorizedUrl){activeMediaSession.spec={...activeMediaSession.spec,...m,authorizedUrl};configureVideoSession(activeMediaSession.video,activeMediaSession.spec);return}
  clearWebAudioTimers();activeWebFrame=null;activeWebSpec=null;activeMediaSession=null;media.replaceChildren();if(!authorizedUrl)return;let n;
  if(m.type==='image'){n=document.createElement('img');n.decoding='async';n.src=authorizedUrl;let retries=0;n.onerror=()=>{if(retries>=3)return;retries++;const join=authorizedUrl.includes('?')?'&':'?';setTimeout(()=>{n.src=authorizedUrl+join+'retry='+Date.now()},500*retries)}}
  else if(m.type==='video'){n=document.createElement('video');n.src=authorizedUrl;configureVideoSession(n,{...m,authorizedUrl})}
  else if(m.type==='web'||m.type==='pdf'){n=document.createElement('iframe');const isWeb=m.type==='web';const integratedAntMedia=!!(isWeb&&m.forceAudio&&isAntMediaPlayerUrl(authorizedUrl));const spec={...m,url:authorizedUrl,integratedAntMedia};const frameUrl=integratedAntMedia?integratedAntMediaUrl(authorizedUrl,m.volume??1):authorizedUrl;const framePath=new URL(frameUrl).pathname;if(new URL(frameUrl).origin!==location.origin||framePath.startsWith('/display-gateway/'))n.setAttribute('sandbox','allow-scripts allow-forms allow-presentation');n.src=frameUrl;if(isWeb){n.allow='autoplay; fullscreen; picture-in-picture';n.setAttribute('allowfullscreen','');n.setAttribute('webkitallowfullscreen','');if(m.localDirect!==false){n.dataset.loadPath='tv-local';n.referrerPolicy='no-referrer-when-downgrade'}activeWebFrame=n;activeWebSpec=spec;n.addEventListener('load',()=>{if(spec.forceAudio)scheduleWebAudioRecovery()})}}
  if(n){n.style.objectFit=m.fit||'contain';n.style.opacity=String(m.opacity??1);media.appendChild(n);if(activeWebFrame&&activeWebSpec?.forceAudio)scheduleWebAudioRecovery()}
}
'''
s=sub1(s,r'function renderMedia\(m\)\{.*?\}\nlet maSendspinPlayer',new_render+'let maSendspinPlayer','persistent video renderer')
s=once(s,"case'display.video':renderMedia({type:'video',...p});break;case'display.web':","case'display.video':renderMedia({type:'video',...p});break;case'display.media.control':applyMediaControl(p);break;case'display.web':",'media control receiver command')
s=once(s,"case'display.clear':clearWebAudioTimers();activeWebFrame=null;activeWebSpec=null;","case'display.clear':clearWebAudioTimers();activeWebFrame=null;activeWebSpec=null;activeMediaSession=null;",'clear media session')
write(p,s)

# -----------------------------------------------------------------------------
# Controller: action-level once/repeat/loop controls + rich video options + live player.
# -----------------------------------------------------------------------------
p=Path('public/controller/app.js'); s=read(p)

s=once(s,"if(id==='media')loadMedia();","if(id==='media'){loadMedia();ensureMediaSessionControls();refreshMediaSessionControls();}",'media page controls hook')
s=once(s,"delaySeconds:0,continueOnError:true","delaySeconds:0,executionMode:'once',repeatCount:2,repeatDelaySeconds:0,continueOnError:true",'new step execution defaults')

# Add execution controls above Continue on Error.
needle='''      <label style=\"display:flex;gap:8px;align-items:center;margin-top:10px\">\n        <input type=\"checkbox\" ${step.continueOnError!==false?'checked':''}'''
replacement='''      <div class=\"grid2\" style=\"margin-top:10px\">\n        <label>Execution\n          <select onchange=\"autoSteps[${i}].executionMode=this.value;renderAutomationSteps()\">\n            <option value=\"once\" ${step.executionMode!=='repeat'&&step.executionMode!=='loop'?'selected':''}>Run once</option>\n            <option value=\"repeat\" ${step.executionMode==='repeat'?'selected':''}>Repeat N times</option>\n            ${step.action==='display.media'?`<option value=\"loop\" ${step.executionMode==='loop'?'selected':''}>Loop media continuously</option>`:''}\n          </select>\n        </label>\n        ${step.executionMode==='repeat'?`<label>Repeat Count<input type=\"number\" min=\"1\" max=\"100\" value=\"${Number(step.repeatCount||2)}\" onchange=\"autoSteps[${i}].repeatCount=Math.max(1,Math.min(100,Number(this.value||2)))\"></label>`:''}\n        ${step.executionMode==='repeat'?`<label>Seconds Between Repeats<input type=\"number\" min=\"0\" max=\"3600\" step=\"0.1\" value=\"${Number(step.repeatDelaySeconds||0)}\" onchange=\"autoSteps[${i}].repeatDelaySeconds=Math.max(0,Number(this.value||0))\"></label>`:''}\n      </div>\n      <div class=\"muted\">Loop is receiver-native for video, so earlier TV, routing, lighting, and setup actions are not restarted.</div>\n\n      <label style=\"display:flex;gap:8px;align-items:center;margin-top:10px\">\n        <input type=\"checkbox\" ${step.continueOnError!==false?'checked':''}'''
s=once(s,needle,replacement,'action execution editor')

old='''  return {id:x.id||`step-${i+1}`,action:x.action,targets,useEventTargets,payload:x.payload||{},delaySeconds:Number(x.delaySeconds||0),continueOnError:x.continueOnError!==false};'''
new='''  return {id:x.id||`step-${i+1}`,action:x.action,targets,useEventTargets,payload:x.payload||{},delaySeconds:Number(x.delaySeconds||0),executionMode:x.executionMode||'once',repeatCount:Number(x.repeatCount||2),repeatDelaySeconds:Number(x.repeatDelaySeconds||0),continueOnError:x.continueOnError!==false};'''
s=once(s,old,new,'read action execution fields')

# Rich primary media configuration.
old='''       <div class=\"toolbar\"><label><input id=\"autoLoop\" type=\"checkbox\" ${payload.loop!==false?'checked':''}> Loop</label><label><input id=\"autoMuted\" type=\"checkbox\" ${payload.muted?'checked':''}> Mute Video</label></div>`;'''
new='''       <div class=\"grid2\" style=\"margin-top:8px\">\n         ${payloadInput('Start at (seconds)','autoMediaStart','number',Number(payload.startAtSeconds||0),'min=\"0\" step=\"0.1\"')}\n         ${payloadInput('End at (seconds, 0 = file end)','autoMediaEnd','number',Number(payload.endAtSeconds||0),'min=\"0\" step=\"0.1\"')}\n         ${payloadInput('Volume %','autoMediaVolume','number',Math.round(Number(payload.volume??1)*100),'min=\"0\" max=\"100\"')}\n         ${payloadInput('Playback Rate','autoMediaRate','number',Number(payload.playbackRate||1),'min=\"0.25\" max=\"4\" step=\"0.25\"')}\n       </div>\n       <div class=\"toolbar\"><label><input id=\"autoLoop\" type=\"checkbox\" ${payload.loop!==false?'checked':''}> Loop selected video/clip</label><label><input id=\"autoMuted\" type=\"checkbox\" ${payload.muted?'checked':''}> Mute Video</label></div>`;'''
s=once(s,old,new,'primary rich media settings')
old="if(action==='display.media')return {storedName:autoMedia.value,fit:autoFit.value,autoAdvanceMs:Number(autoMediaSeconds.value||0)*1000,loop:autoLoop.checked,muted:autoMuted.checked};"
new="if(action==='display.media')return {storedName:autoMedia.value,fit:autoFit.value,autoAdvanceMs:Number(autoMediaSeconds.value||0)*1000,loop:autoLoop.checked,muted:autoMuted.checked,startAtSeconds:Number(autoMediaStart.value||0),endAtSeconds:Number(autoMediaEnd.value||0),volume:Math.max(0,Math.min(1,Number(autoMediaVolume.value||100)/100)),playbackRate:Number(autoMediaRate.value||1)};"
s=once(s,old,new,'read primary media settings')

# Add detailed media settings to extra steps immediately after media selector/preview section.
step_pat=r'''(if\(a==='display\.media'\)\{\n    return `<label>Media.*?<button type=\\"button\\" onclick=\\"previewAutomationMedia\(\$\{i\}\)\\">Preview Selected Media</button>)(.*?)`\;\n  \}'''
m=re.search(step_pat,s,re.S)
if m:
    tail=m.group(2)
    extra='''\n      <label>Start at (seconds)<input type="number" min="0" step="0.1" value="${Number(p.startAtSeconds||0)}" onchange="autoSteps[${i}].payload.startAtSeconds=Number(this.value||0)"></label>\n      <label>End at (seconds; 0=file end)<input type="number" min="0" step="0.1" value="${Number(p.endAtSeconds||0)}" onchange="autoSteps[${i}].payload.endAtSeconds=Number(this.value||0)"></label>\n      <label>Volume %<input type="number" min="0" max="100" value="${Math.round(Number(p.volume??1)*100)}" onchange="autoSteps[${i}].payload.volume=Math.max(0,Math.min(1,Number(this.value||100)/100))"></label>\n      <label>Playback Rate<input type="number" min="0.25" max="4" step="0.25" value="${Number(p.playbackRate||1)}" onchange="autoSteps[${i}].payload.playbackRate=Number(this.value||1)"></label>\n      <label><input type="checkbox" ${p.muted?'checked':''} onchange="autoSteps[${i}].payload.muted=this.checked"> Mute</label>\n'''
    replacement=m.group(1)+tail+extra+'`;\n  }'
    s=s[:m.start()]+replacement+s[m.end():]

# Live media controller is injected into the existing Media workspace without changing navigation contracts.
anchor='''async function reloadAllDisplays(){'''
controls=r'''let mediaSessionRefreshTimer=null;
function mediaSessionTargetOptions(){return configuredDisplayTargets(false).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}
function ensureMediaSessionControls(){
  const page=document.getElementById('media');if(!page||document.getElementById('mediaSessionControls'))return;
  const panel=document.createElement('div');panel.id='mediaSessionControls';panel.className='panel';panel.innerHTML=`<h3 style="margin-top:0">Live Video Playback</h3><div class="muted">Control the video element already playing on a receiver. Volume, pause, seek, and playback-rate changes do not reload the MP4.</div><div class="grid2" style="margin-top:10px"><label>Display<select id="mediaSessionTarget">${mediaSessionTargetOptions()}</select></label><label>Playback Rate<select id="mediaSessionRate"><option>.5</option><option>.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>2</option></select></label></div><div class="toolbar" style="margin-top:10px"><button onclick="mediaSessionCommand('play')">Play</button><button onclick="mediaSessionCommand('pause')">Pause</button><button onclick="mediaSessionCommand('restart')">Restart Clip</button><button onclick="mediaSessionCommand('stop')">Stop / Rewind</button><button onclick="mediaSessionSeekRelative(-10)">−10s</button><button onclick="mediaSessionSeekRelative(10)">+10s</button></div><label style="display:block;margin-top:10px">Position <span id="mediaSessionPositionLabel">0:00 / --:--</span><input id="mediaSessionSeek" type="range" min="0" max="1" step="0.1" value="0" style="width:100%" onchange="mediaSessionCommand('seek',{positionSeconds:Number(this.value)})"></label><label style="display:block;margin-top:10px">Volume <span id="mediaSessionVolumeLabel">100%</span><input id="mediaSessionVolume" type="range" min="0" max="100" step="1" value="100" style="width:100%" oninput="mediaSessionVolumeLabel.textContent=this.value+'%'" onchange="mediaSessionCommand('volume',{volume:Number(this.value)/100})"></label><div id="mediaSessionStatus" class="muted" style="margin-top:8px">No playback telemetry yet.</div>`;page.appendChild(panel);mediaSessionTarget.onchange=refreshMediaSessionControls;mediaSessionRate.onchange=()=>mediaSessionCommand('rate',{playbackRate:Number(mediaSessionRate.value)});clearInterval(mediaSessionRefreshTimer);mediaSessionRefreshTimer=setInterval(()=>{if(document.getElementById('media')?.classList.contains('active'))refreshMediaSessionControls()},1000)
}
function mediaTime(v){v=Math.max(0,Number(v||0));const m=Math.floor(v/60),sec=Math.floor(v%60);return `${m}:${String(sec).padStart(2,'0')}`}
async function mediaSessionCommand(action,extra={}){try{const id=mediaSessionTarget?.value;if(!id)return;await jpost(`/api/v1/displays/${encodeURIComponent(id)}/media/control`,{action,...extra});setTimeout(refreshMediaSessionControls,120)}catch(e){notify(e.message,'error')}}
function mediaSessionSeekRelative(delta){const cur=Number(mediaSessionSeek?.value||0);mediaSessionCommand('seek',{positionSeconds:Math.max(0,cur+Number(delta||0))})}
async function refreshMediaSessionControls(){
  if(!window.mediaSessionTarget)return;const options=mediaSessionTargetOptions();if(mediaSessionTarget.innerHTML!==options){const old=mediaSessionTarget.value;mediaSessionTarget.innerHTML=options;if([...mediaSessionTarget.options].some(o=>o.value===old))mediaSessionTarget.value=old}
  const id=mediaSessionTarget.value;if(!id)return;try{const st=await api('/api/v1/status'),ms=st.runtime?.displays?.[id]?.mediaSession||st.displays?.[id]?.mediaSession;if(!ms){mediaSessionStatus.textContent='No active video telemetry from this display.';return}const pos=Number(ms.positionSeconds||0),dur=Number(ms.durationSeconds||0);mediaSessionSeek.max=String(Math.max(1,dur));mediaSessionSeek.value=String(Math.min(pos,Math.max(1,dur)));mediaSessionPositionLabel.textContent=`${mediaTime(pos)} / ${dur?mediaTime(dur):'--:--'}`;mediaSessionVolume.value=String(Math.round(Number(ms.volume??1)*100));mediaSessionVolumeLabel.textContent=mediaSessionVolume.value+'%';mediaSessionRate.value=String(ms.playbackRate||1);mediaSessionStatus.textContent=`${String(ms.state||'unknown')} • session ${String(ms.sessionId||'manual')} • ${ms.loop?'looping':'single play'}`}catch(e){mediaSessionStatus.textContent=`Playback status unavailable: ${e.message}`}
}

'''+anchor
s=once(s,anchor,controls,'live media controller')
write(p,s)

# -----------------------------------------------------------------------------
# Regression coverage and documentation.
# -----------------------------------------------------------------------------

test=ROOT/'test/automation-media-sessions.test.js'
test.write_text(r'''"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const server=fs.readFileSync(path.join(root,"src/server.js"),"utf8");
const display=fs.readFileSync(path.join(root,"public/display/index.html"),"utf8");
const controller=fs.readFileSync(path.join(root,"public/controller/app.js"),"utf8");

test("automation actions persist per-step execution policy",()=>{
  assert.match(server,/executionMode:normalizeAutomationExecutionMode/);
  assert.match(server,/repeatCount:automationRepeatCount/);
  assert.match(controller,/Loop media continuously/);
  assert.match(controller,/repeatDelaySeconds/);
});

test("video renderer keeps a stable media session and supports live control",()=>{
  assert.match(display,/activeMediaSession/);
  assert.match(display,/display\.media\.control/);
  assert.match(display,/video\.currentTime/);
  assert.match(display,/display\.media\.status/);
  assert.match(server,/\/api\/v1\/displays\/:id\/media\/control/);
});

test("automation video payload supports clip boundaries volume and rate",()=>{
  for(const token of ["startAtSeconds","endAtSeconds","playbackRate","volume","sessionId"])assert.ok(server.includes(token),token);
  assert.match(controller,/Start at \(seconds\)/);
  assert.match(controller,/Live Video Playback/);
});
''')

for target in ['docs/AUTOMATION-DISPLAY-MEDIA.md','wiki/Automation-Display-Media.md']:
    p=Path(target); d=read(p)
    section=r'''

## Action execution modes and persistent video sessions

Automation follow-up actions now carry an execution policy. **Run once** executes the action one time, **Repeat N times** repeats only that action with an optional delay, and **Loop media continuously** is available for `display.media`. Media looping is receiver-native: RoomGoblin does not restart the automation, so preceding TV power, routing, lighting, or setup actions are not reissued.

Uploaded video playback is a persistent media session identified by a stable `sessionId`. Reissuing the same session updates playback properties rather than replacing the `<video>` element. Operators can change volume, mute state, playback rate, play/pause state, and current position while the MP4 remains loaded.

Video actions support `startAtSeconds`, `endAtSeconds`, `volume`, `muted`, `playbackRate`, and `loop`. When an end boundary is configured, looping seeks back to the configured start boundary instead of restarting the automation. A non-looping bounded clip pauses at the end and emits the normal media-ended signal.

The Media workspace includes a live playback panel for the selected receiver with play, pause, stop/rewind, restart, ±10-second seek, scrubber, volume, playback rate, and receiver telemetry. These commands use `display.media.control` and do not call `display.media`, so they must not reload or restart the active video.

Receivers report bounded `display.media.status` telemetry containing session ID, position, duration, volume, mute, loop and playback-rate state. This telemetry is operational state only; it does not replace persisted automation configuration.

### Safety and priority invariants

- Morning Announcements remain the highest-priority display/audio owner.
- Normal automation media still participates in existing Background Music priority reconciliation.
- Arbitrary non-media actions are never allowed to run forever. A requested `loop` on a non-media action is normalized to bounded repeat behavior.
- Display clear explicitly destroys the active video session.
- Existing stable display URLs, signed media access, class-target resolution, scheduler recovery, and timer behavior remain unchanged.
'''
    if '## Action execution modes and persistent video sessions' not in d:d+=section
    write(p,d)

p=Path('docs/AUTOMATION-FRAMEWORK.md'); d=read(p)
if '## Per-action execution policy' not in d:
    d+=r'''

## Per-action execution policy

Additional automation actions persist `executionMode`, `repeatCount`, and `repeatDelaySeconds`. The default is `once`. `repeat` is bounded to 100 executions. `loop` is native only for display media and therefore loops the receiver's current media element rather than replaying the whole automation. Non-media loop requests are normalized to bounded repeat semantics so power, routing, lighting, and other side-effecting commands cannot accidentally become unbounded command generators.

Scheduler reconciliation continues to reason about the configured action sequence and resources; repeat metadata does not create additional scheduled occurrences or restart earlier steps.
'''
write(p,d)

p=Path('AGENTS.md'); d=read(p)
needle='''### Morning Announcements\n'''
addition='''### Automation action loops and media sessions\n\nPer-action looping must never be implemented by restarting an automation occurrence. `display.media` loop mode is receiver-native and preserves the active HTML5 media session. Live volume/seek/pause/rate changes use `display.media.control`; do not reissue `display.media` for control-only changes because replacing the media command restarts playback. Non-media actions may use bounded repeat only. Preserve Morning Announcements priority, Background Music reconciliation, scheduler occurrence identity and display recovery.\n\n'''
if addition.strip() not in d:d=once(d,needle,addition+needle,'AGENTS media session contract')
write(p,d)

p=Path('CHANGELOG.md'); d=read(p)
entry='''### Automation action loops and live media sessions\n\n- Add per-action run-once, bounded-repeat and receiver-native media-loop behavior so looping one video no longer restarts an entire scheduled automation.\n- Keep MP4 playback as a persistent receiver session with live play/pause, stop/restart, seek/scrub, volume/mute and playback-rate controls that do not reload the file.\n- Add configurable video start/end boundaries, clip looping and receiver playback telemetry; expose the same live controls in the Media workspace and document scheduler/announcement/BGM invariants.\n\n'''
if entry not in d:d=once(d,'## Unreleased\n','## Unreleased\n\n'+entry,'changelog entry')
write(p,d)

print('automation/media session patch applied')
