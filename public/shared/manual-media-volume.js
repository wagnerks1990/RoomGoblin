"use strict";

(function installManualMediaVolumeControl(){
  if(location.pathname!=="/controller/display.html")return;

  const SESSION_POLL_MS=1500;
  let statusTimer=null,statusInFlight=false;
  function el(id){return document.getElementById(id)}
  function api(url,opt={}){return fetch(url,{cache:"no-store",credentials:"same-origin",...opt}).then(async r=>{const text=await r.text();let body={};try{body=JSON.parse(text)}catch{body={raw:text}}if(!r.ok)throw new Error(body.error||body.message||`HTTP ${r.status}`);return body})}
  function post(url,body){return api(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})}
  function fmtTime(value){const seconds=Math.max(0,Number(value||0));return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")}`}
  function suspendPreview(){const frame=el("previewFrame");if(frame&&frame.src&&frame.src!=="about:blank"){frame.dataset.rgSuspendedForVideo="1";frame.src="about:blank"}}
  function sessionTarget(){return el("manualMediaSessionTarget")?.value||""}
  async function loadSessionTargets(){
    const select=el("manualMediaSessionTarget");if(!select)return;
    try{
      const data=await api("/api/v1/devices"),devices=data.devices||{};
      const rows=Object.entries(devices).filter(([,d])=>d?.enabled!==false).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
      const previous=select.value;
      select.replaceChildren(...rows.map(([id,d])=>new Option(String(d?.name||id),String(id))));
      if(rows.some(([id])=>id===previous))select.value=previous;
      else if(el("previewSelect")?.value&&rows.some(([id])=>id===el("previewSelect").value))select.value=el("previewSelect").value;
    }catch(e){el("manualMediaSessionStatus").textContent=`Playback targets unavailable: ${e.message}`}
  }
  async function controlSession(action,extra={}){
    const id=sessionTarget();if(!id)return;
    try{await post(`/api/v1/displays/${encodeURIComponent(id)}/media/control`,{action,...extra});setTimeout(refreshSessionStatus,120)}
    catch(e){el("manualMediaSessionStatus").textContent=`Playback control failed: ${e.message}`}
  }
  async function refreshSessionStatus(){
    const id=sessionTarget(),status=el("manualMediaSessionStatus");if(!id||!status||statusInFlight||document.hidden)return;
    statusInFlight=true;
    try{
      const response=await api(`/api/v1/displays/${encodeURIComponent(id)}/media/status`),ms=response.mediaSession||response.status||response;
      if(!ms||!ms.sessionId){status.textContent="No active video telemetry from this display.";return}
      const pos=Number(ms.positionSeconds||0),dur=Number(ms.durationSeconds||0),seek=el("manualMediaSeek"),volume=el("mediaVolume"),rate=el("manualMediaRate");
      if(seek){seek.max=String(Math.max(1,dur));seek.value=String(Math.min(pos,Math.max(1,dur)))}
      if(el("manualMediaPosition"))el("manualMediaPosition").textContent=`${fmtTime(pos)} / ${dur?fmtTime(dur):"--:--"}`;
      if(volume&&document.activeElement!==volume){volume.value=String(Math.round(Number(ms.volume??1)*100));el("mediaVolumeValue").textContent=`${volume.value}%`}
      if(rate&&document.activeElement!==rate)rate.value=String(ms.playbackRate||1);
      status.textContent=`${String(ms.state||"unknown")} • ${ms.loop?"looping":"single play"} • session ${String(ms.sessionId)}`;
    }catch(e){status.textContent=`Playback status unavailable: ${e.message}`}
    finally{statusInFlight=false}
  }
  function startStatusPolling(){clearInterval(statusTimer);statusTimer=setInterval(refreshSessionStatus,SESSION_POLL_MS);refreshSessionStatus()}
  function install(){
    const muted=el("videoMuted"),opacity=el("mediaOpacity");
    if(!muted||!opacity||el("mediaVolume"))return;

    const wrap=document.createElement("div");
    wrap.className="grid2";
    wrap.style.marginTop="8px";
    wrap.innerHTML=`
      <label>Playback Volume
        <div class="toolbar" style="margin-top:5px;flex-wrap:nowrap">
          <input id="mediaVolume" type="range" min="0" max="100" step="1" value="100" style="flex:1;min-width:140px">
          <span id="mediaVolumeValue" style="min-width:48px;text-align:center">100%</span>
        </div>
      </label>
      <label>Playback Rate
        <select id="manualMediaRate"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
      </label>
      <label>Start at (seconds)<input id="manualMediaStart" type="number" min="0" step="0.1" value="0"></label>
      <label>End at (seconds)<input id="manualMediaEnd" type="number" min="0" step="0.1" value="0" placeholder="0 = full video"></label>`;

    const checkboxToolbar=muted.closest(".toolbar")||muted.parentElement?.parentElement;
    if(checkboxToolbar?.parentElement)checkboxToolbar.parentElement.insertBefore(wrap,checkboxToolbar);
    else opacity.parentElement?.appendChild(wrap);

    const controls=document.createElement("div");
    controls.id="manualMediaSessionControls";
    controls.className="panel";
    controls.style.marginTop="10px";
    controls.innerHTML=`<h3 style="margin-top:0">Live Video Playback</h3>
      <div class="muted">Controls the video already playing on the selected receiver. Pause, seek, volume and rate changes do not reload the MP4. The local live preview is suspended when video starts to avoid decoding the same MP4 twice in the controller browser.</div>
      <div class="grid2" style="margin-top:8px"><label>Receiver<select id="manualMediaSessionTarget"></select></label><label>Position <span id="manualMediaPosition">0:00 / --:--</span><input id="manualMediaSeek" type="range" min="0" max="1" step="0.1" value="0"></label></div>
      <div class="toolbar"><button type="button" id="manualMediaPlay">Play</button><button type="button" id="manualMediaPause">Pause</button><button type="button" id="manualMediaRestart">Restart Clip</button><button type="button" id="manualMediaStop">Stop / Rewind</button><button type="button" id="manualMediaBack">−10s</button><button type="button" id="manualMediaForward">+10s</button><button type="button" id="manualMediaRefresh">Refresh Status</button></div>
      <div id="manualMediaSessionStatus" class="muted" style="margin-top:7px">No playback telemetry yet.</div>`;
    const mediaWorkspace=el("media")||opacity.closest(".workspace")||opacity.parentElement;
    mediaWorkspace?.appendChild(controls);

    const slider=el("mediaVolume"),value=el("mediaVolumeValue"),rate=el("manualMediaRate"),seek=el("manualMediaSeek");
    slider.addEventListener("input",()=>{value.textContent=`${slider.value}%`;if(Number(slider.value)===0)muted.checked=true;else if(muted.checked)muted.checked=false});
    slider.addEventListener("change",()=>controlSession("volume",{volume:Math.max(0,Math.min(1,Number(slider.value||0)/100))}));
    muted.addEventListener("change",()=>{
      if(muted.checked){slider.dataset.prior=slider.value;slider.value="0";value.textContent="0%"}
      else if(Number(slider.value)===0){slider.value=slider.dataset.prior&&Number(slider.dataset.prior)>0?slider.dataset.prior:"100";value.textContent=`${slider.value}%`}
      controlSession("mute",{muted:muted.checked});
    });
    rate?.addEventListener("change",()=>controlSession("rate",{playbackRate:Number(rate.value||1)}));
    seek?.addEventListener("change",()=>controlSession("seek",{positionSeconds:Number(seek.value||0)}));
    el("manualMediaSessionTarget")?.addEventListener("change",refreshSessionStatus);
    el("manualMediaPlay")?.addEventListener("click",()=>controlSession("play"));
    el("manualMediaPause")?.addEventListener("click",()=>controlSession("pause"));
    el("manualMediaRestart")?.addEventListener("click",()=>controlSession("restart"));
    el("manualMediaStop")?.addEventListener("click",()=>controlSession("stop"));
    el("manualMediaBack")?.addEventListener("click",()=>controlSession("seek",{positionSeconds:Math.max(0,Number(seek?.value||0)-10)}));
    el("manualMediaForward")?.addEventListener("click",()=>controlSession("seek",{positionSeconds:Math.max(0,Number(seek?.value||0)+10)}));
    el("manualMediaRefresh")?.addEventListener("click",refreshSessionStatus);

    window.sendMedia=(type)=>{
      const volume=Math.max(0,Math.min(1,Number(slider.value||0)/100));
      const isVideo=type==="display.video",isWeb=type==="display.web";
      if(typeof window.controllerDisplayCommand!=="function"||typeof window.controllerDisplayTargetArg!=="function")throw new Error("Display controller command bridge is unavailable");
      const payload={
        url:el("mediaUrl").value,
        fit:el("mediaFit").value,
        opacity:Number(el("mediaOpacity").value),
        autoplay:el("videoAutoplay").checked,
        loop:el("videoLoop").checked,
        muted:muted.checked||volume<=0,
        volume,
        playbackRate:Number(rate?.value||1),
        startAtSeconds:Math.max(0,Number(el("manualMediaStart")?.value||0)),
        endAtSeconds:Math.max(0,Number(el("manualMediaEnd")?.value||0))||null,
        ...(isVideo?{sessionId:(globalThis.crypto?.randomUUID?.()||`manual-${Date.now()}-${Math.random().toString(16).slice(2)}`),forceAudio:volume>0}:{}),
        ...(isWeb?{forceAudio:volume>0}:{}),
        localDirect:el("mediaLocalDirect")?.checked!==false
      };
      if(isVideo)suspendPreview();
      const result=window.controllerDisplayCommand(type,window.controllerDisplayTargetArg(),payload);
      if(isVideo){loadSessionTargets().then(()=>{const previewId=el("previewSelect")?.value,select=el("manualMediaSessionTarget");if(previewId&&select&&[...select.options].some(o=>o.value===previewId))select.value=previewId;startStatusPolling()})}
      return result;
    };

    loadSessionTargets();startStatusPolling();
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
