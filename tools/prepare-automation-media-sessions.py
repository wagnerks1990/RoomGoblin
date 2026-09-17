#!/usr/bin/env python3
from pathlib import Path

p=Path(__file__).with_name('apply-automation-media-sessions.py')
s=p.read_text()
start=s.index('# Add stable session metadata and playback configuration to uploaded video delivery.')
end=s.index('# Manual media-session control API.',start)
lines=[
'# Add stable session metadata and playback configuration to uploaded video delivery.',
"media_start=s.index('}else if(action===\"display.media\"){')",
'try:',
"    media_end=s.index('}else if(action===',media_start+10)",
'except ValueError:',
"    media_end=s.index('\\n  }\\n',media_start)+4",
'block=s[media_start:media_end]',
"rec_marker='const rec=mediaLibrary.files[name]||{},type=rec.type||classifyMedia(name,rec.mime||\"\");'",
"if rec_marker not in block: raise SystemExit('display media record/type marker not found')",
"if 'const mediaSession=' not in block:",
"    session_code='\\n    const mediaSession={\\n      sessionId:String(p.sessionId||`${event._occurrenceId||event.id||\\\"manual\\\"}:${event._stepId||\\\"primary\\\"}:${name}`),\\n      volume:Math.max(0,Math.min(1,Number(p.volume??1))),\\n      muted:!!p.muted,loop:!!p.loop,\\n      startAtSeconds:Math.max(0,Number(p.startAtSeconds||0)),\\n      endAtSeconds:Number(p.endAtSeconds)>0?Number(p.endAtSeconds):null,\\n      playbackRate:Math.max(.25,Math.min(4,Number(p.playbackRate||1)))\\n    };'",
"    block=block.replace(rec_marker,rec_marker+session_code)",
"needle='type:\"display.video\"'",
'pos=0',
'changed=0',
'while True:',
'    hit=block.find(needle,pos)',
'    if hit<0: break',
"    payload=block.find('payload:{',hit)",
'    if payload<0: break',
"    brace=payload+len('payload:{')",
'    depth=1;i=brace;quote=None;escape=False',
'    while i<len(block) and depth:',
'        ch=block[i]',
'        if quote:',
'            if escape: escape=False',
"            elif ch=='\\\\': escape=True",
'            elif ch==quote: quote=None',
'        else:',
"            if ch in \"'\\\"`\": quote=ch",
"            elif ch=='{': depth+=1",
"            elif ch=='}': depth-=1",
'        i+=1',
"    if depth: raise SystemExit('unterminated display.video payload')",
'    close=i-1',
'    payload_text=block[brace:close]',
"    if '...mediaSession' not in payload_text:",
"        block=block[:close]+(',' if payload_text.strip() else '')+'...mediaSession'+block[close:]",
'        changed+=1',
"        pos=close+len('...mediaSession')+1",
'    else: pos=close+1',
"if changed==0 and '...mediaSession' not in block: raise SystemExit('no display.video payload found in display.media action')",
's=s[:media_start]+block+s[media_end:]',
'',
]
replacement='\n'.join(lines)+'\n'
s=s[:start]+replacement+s[end:]
old="if entry not in d:d=once(d,'## Unreleased\\n','## Unreleased\\n\\n'+entry,'changelog entry')"
new="if entry not in d:d=d.replace('## Unreleased\\n','## Unreleased\\n\\n'+entry,1)"
if old not in s: raise SystemExit('changelog generator marker missing')
s=s.replace(old,new,1)

# Final review hardening: use the authoritative receiver inventory, add a stable
# status API, make video event binding idempotent, avoid DOM-id globals, and keep
# AI context aligned with implementation.
s=s.replace('!displayDevices[id]||displayDevices[id].enabled===false','!devices[id]||devices[id].enabled===false')
post_marker='''app.post("/api/v1/displays/:id/media/control",schedulerMutationLimit,requireControl,async(req,res)=>{'''
status_api='''app.get("/api/v1/displays/:id/media/status",requireControl,(req,res)=>{\n  const id=cleanId(req.params.id);\n  if(!id||!devices[id]||devices[id].enabled===false)return res.status(404).json({ok:false,error:"Unknown display"});\n  res.json({ok:true,status:runtime.displays[id]?.mediaSession||null});\n});\n\n'''
if status_api not in s:
    if post_marker not in s: raise SystemExit('media control API marker missing')
    s=s.replace(post_marker,status_api+post_marker,1)

bind_old='''  activeMediaSession={video,spec:{...m,startAtSeconds:start,endAtSeconds:end}};\n  const enforceEnd=()=>{'''
bind_new='''  activeMediaSession={video,spec:{...m,startAtSeconds:start,endAtSeconds:end}};\n  if(video.dataset.rgMediaSessionBound==='1'){reportMediaStatus('session-update');return}\n  video.dataset.rgMediaSessionBound='1';\n  const enforceEnd=()=>{'''
if bind_old not in s: raise SystemExit('media listener binding marker missing')
s=s.replace(bind_old,bind_new,1)

# Replace controller live-status implementation with explicit DOM lookup and the
# dedicated media-status endpoint. This avoids depending on named-element globals
# or the broad /status response shape.
ctl_start=s.index("let mediaSessionRefreshTimer=null;")
ctl_end=s.index("async function reloadAllDisplays(){",ctl_start)
ctl=r'''let mediaSessionRefreshTimer=null;
function mediaSessionTargetOptions(){return configuredDisplayTargets(false).map(([id,name])=>`<option value="${esc(id)}">${esc(name)}</option>`).join('')}
function ensureMediaSessionControls(){
  const page=document.getElementById('media');if(!page||document.getElementById('mediaSessionControls'))return;
  const panel=document.createElement('div');panel.id='mediaSessionControls';panel.className='panel';panel.innerHTML=`<h3 style="margin-top:0">Live Video Playback</h3><div class="muted">Control the video element already playing on a receiver. Volume, pause, seek, and playback-rate changes do not reload the MP4.</div><div class="grid2" style="margin-top:10px"><label>Display<select id="mediaSessionTarget">${mediaSessionTargetOptions()}</select></label><label>Playback Rate<select id="mediaSessionRate"><option>.5</option><option>.75</option><option selected>1</option><option>1.25</option><option>1.5</option><option>2</option></select></label></div><div class="toolbar" style="margin-top:10px"><button onclick="mediaSessionCommand('play')">Play</button><button onclick="mediaSessionCommand('pause')">Pause</button><button onclick="mediaSessionCommand('restart')">Restart Clip</button><button onclick="mediaSessionCommand('stop')">Stop / Rewind</button><button onclick="mediaSessionSeekRelative(-10)">−10s</button><button onclick="mediaSessionSeekRelative(10)">+10s</button></div><label style="display:block;margin-top:10px">Position <span id="mediaSessionPositionLabel">0:00 / --:--</span><input id="mediaSessionSeek" type="range" min="0" max="1" step="0.1" value="0" style="width:100%" onchange="mediaSessionCommand('seek',{positionSeconds:Number(this.value)})"></label><label style="display:block;margin-top:10px">Volume <span id="mediaSessionVolumeLabel">100%</span><input id="mediaSessionVolume" type="range" min="0" max="100" step="1" value="100" style="width:100%" oninput="document.getElementById('mediaSessionVolumeLabel').textContent=this.value+'%'" onchange="mediaSessionCommand('volume',{volume:Number(this.value)/100})"></label><div id="mediaSessionStatus" class="muted" style="margin-top:8px">No playback telemetry yet.</div>`;
  page.appendChild(panel);
  document.getElementById('mediaSessionTarget').addEventListener('change',refreshMediaSessionControls);
  document.getElementById('mediaSessionRate').addEventListener('change',()=>mediaSessionCommand('rate',{playbackRate:Number(document.getElementById('mediaSessionRate').value)}));
  clearInterval(mediaSessionRefreshTimer);mediaSessionRefreshTimer=setInterval(()=>{if(document.getElementById('media')?.classList.contains('active'))refreshMediaSessionControls()},1000)
}
function mediaTime(v){v=Math.max(0,Number(v||0));const m=Math.floor(v/60),sec=Math.floor(v%60);return `${m}:${String(sec).padStart(2,'0')}`}
async function mediaSessionCommand(action,extra={}){try{const target=document.getElementById('mediaSessionTarget');const id=target?.value;if(!id)return;await jpost(`/api/v1/displays/${encodeURIComponent(id)}/media/control`,{action,...extra});setTimeout(refreshMediaSessionControls,120)}catch(e){notify(e.message,'error')}}
function mediaSessionSeekRelative(delta){const seek=document.getElementById('mediaSessionSeek');const cur=Number(seek?.value||0);mediaSessionCommand('seek',{positionSeconds:Math.max(0,cur+Number(delta||0))})}
async function refreshMediaSessionControls(){
  const target=document.getElementById('mediaSessionTarget');if(!target)return;
  const options=mediaSessionTargetOptions();if(target.innerHTML!==options){const old=target.value;target.innerHTML=options;if([...target.options].some(o=>o.value===old))target.value=old}
  const id=target.value;if(!id)return;
  const status=document.getElementById('mediaSessionStatus'),seek=document.getElementById('mediaSessionSeek'),position=document.getElementById('mediaSessionPositionLabel'),volume=document.getElementById('mediaSessionVolume'),volumeLabel=document.getElementById('mediaSessionVolumeLabel'),rate=document.getElementById('mediaSessionRate');
  try{const row=await api(`/api/v1/displays/${encodeURIComponent(id)}/media/status`),ms=row.status;if(!ms){status.textContent='No active video telemetry from this display.';return}const pos=Number(ms.positionSeconds||0),dur=Number(ms.durationSeconds||0);seek.max=String(Math.max(1,dur));seek.value=String(Math.min(pos,Math.max(1,dur)));position.textContent=`${mediaTime(pos)} / ${dur?mediaTime(dur):'--:--'}`;volume.value=String(Math.round(Number(ms.volume??1)*100));volumeLabel.textContent=volume.value+'%';rate.value=String(ms.playbackRate||1);status.textContent=`${String(ms.state||'unknown')} • session ${String(ms.sessionId||'manual')} • ${ms.loop?'looping':'single play'}`}catch(e){status.textContent=`Playback status unavailable: ${e.message}`}
}

'''
s=s[:ctl_start]+ctl+s[ctl_end:]

# Extend tests for review findings.
test_marker="  assert.match(server,/\\/api\\/v1\\/displays\\/:id\\/media\\/control/);"
test_extra=test_marker+"\n  assert.match(server,/\\/api\\/v1\\/displays\\/:id\\/media\\/status/);\n  assert.doesNotMatch(server,/displayDevices\\[id\\]/);\n  assert.match(display,/rgMediaSessionBound/);"
if test_marker in s and 'doesNotMatch(server,/displayDevices' not in s:s=s.replace(test_marker,test_extra,1)

# Keep the AI context source of truth synchronized.
ai_marker="p=Path('CHANGELOG.md'); d=read(p)"
ai_block="""p=Path('docs/AI-CONTEXT.md'); d=read(p)\nai_section=r'''\n\n## Automation action execution and media-session control\n\nAutomation action looping is per-action, never implemented by restarting the whole occurrence. Additional actions persist `executionMode`, `repeatCount`, and `repeatDelaySeconds`; continuous `loop` is native only for `display.media`, while other commands remain bounded repeats. Uploaded video uses a persistent receiver media session. Live play/pause/seek/volume/mute/rate changes use `display.media.control` and must not reissue `display.media`, because replacing the content command restarts playback. Receivers report bounded media-session status for the controller scrubber. Preserve Morning Announcements priority, scheduler winner reconciliation, Background Music recovery, stable receiver IDs and signed media URLs when changing this path.\n'''\nif '## Automation action execution and media-session control' not in d:d+=ai_section\nwrite(p,d)\n\n"""+ai_marker
if "p=Path('docs/AI-CONTEXT.md')" not in s:
    if ai_marker not in s: raise SystemExit('AI context insertion marker missing')
    s=s.replace(ai_marker,ai_block,1)

p.write_text(s)
print('prepared robust automation/media patch generator')
