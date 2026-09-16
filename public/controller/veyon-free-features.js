/* Free Veyon extensions. No private keys or upstream connection UIDs in this page. */
(() => {
  'use strict';
  function selection(max=64){const ids=targetIds();if(!ids.length||ids.length>max)throw Error(`Select 1–${max} computers.`);return ids}
  function bind(id,fn){$(id).onclick=async()=>{const button=$(id);button.disabled=true;try{await fn()}catch(error){alert(error.message)}finally{button.disabled=false}}}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000)}
  async function desktop(mode){
    const targets=selection(16);
    const response=await fetch('/api/v1/veyon/desktop-launcher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targets,mode})});
    if(!response.ok){const error=await response.json();throw Error(error.error||'Could not create desktop launcher')}
    download(await response.blob(),'RoomGoblin-Veyon-Desktop.ps1');
    $('commandFeedback').textContent='Launcher downloaded. Run it on your teacher Windows computer. Native Master requires selecting the listed targets in its own inventory; no keys were exported.';
  }
  bind('nativeView',()=>desktop('view'));bind('nativeControl',()=>desktop('control'));bind('nativeMaster',()=>desktop('master'));
  bind('saveMac',async()=>{const [id]=selection(1),computer=computers.find(c=>c.id===id);const mac=prompt('MAC address for Wake-on-LAN (blank removes it):',computer.mac||'');if(mac===null)return;await api(`/api/v1/veyon/computers/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({mac})});await load()});
  bind('wakeComputers',async()=>{const targets=selection();if(!confirm(`Send Wake-on-LAN packets for ${targets.length} selected computers?`))return;const result=await api('/api/v1/veyon/wake',{method:'POST',body:JSON.stringify({targets})});$('commandFeedback').textContent=(result.results||[]).map(r=>`${r.id}: ${r.accepted?'Wake packet sent; startup unverified':r.error||'Failed'}`).join(' · ')});
  bind('deviceInfo',async()=>{const [id]=selection(1);const x=await api(`/api/v1/veyon/computers/${encodeURIComponent(id)}/info`),c=x.computer;openInfo('User and session details',`<pre style="white-space:pre-wrap">${esc(JSON.stringify({name:c.name,online:c.online,authenticated:c.authenticated,user:c.user,session:c.session,locks:c.featureState,error:c.error},null,2))}</pre>`)});
  bind('freeCatalog',async()=>{const [id]=selection(1),x=await api(`/api/v1/veyon/computers/${encodeURIComponent(id)}/catalog`);openInfo('Free feature coverage',`<p>Advertised means the appliance plugin is present. It does not verify the Windows endpoint. Desktop and configuration features use native Veyon.</p><div style="overflow:auto"><table><thead><tr><th>Feature</th><th>Access</th><th>Appliance</th><th>Use</th></tr></thead><tbody>${x.features.map(f=>`<tr><td>${esc(f.name)}</td><td>${esc(f.provider)}</td><td>${f.advertised?'Advertised':'Not advertised'}</td><td>${esc(f.detail)}</td></tr>`).join('')}</tbody></table></div>`)});
  for(const [id,name,label] of [['powerNow','powerDownNow','shut down immediately'],['powerConfirm','powerDownConfirmed','request shutdown confirmation (shuts down immediately when no user is logged in)'],['powerDelay','powerDownDelayed','schedule shutdown'],['powerUpdates','installUpdatesAndPowerDown','install available updates and shut down']])bind(id,async()=>{
    const targets=selection(),args={};
    if(name==='powerDownDelayed'){const value=prompt('Shutdown delay in seconds (30–3600):','120');if(value===null)return;args.shutdownTimeout=Number(value);if(!Number.isInteger(args.shutdownTimeout)||args.shutdownTimeout<30||args.shutdownTimeout>3600)throw Error('Enter 30–3600 seconds.')}
    if(confirm(`For ${targets.length} selected computers: ${label}? Unsaved work may be lost. Veyon cannot cancel this request.`))await feature(targets,name,true,args);
  });
  async function studentDemo(mode){
    const ids=selection();if(ids.length<2)throw Error('Select a source and at least one recipient.');
    const sources=ids.map(id=>computers.find(c=>c.id===id)).filter(c=>c?.online&&c.user?.login);
    const choice=prompt('Choose the source:\n'+sources.map((c,i)=>`${i+1}. ${c.name||c.ip}`).join('\n'),'1');if(choice===null)return;
    const source=sources[Number(choice)-1];if(!source)throw Error('Choose an online source with a signed-in user.');
    const studentIds=ids.filter(id=>id!==source.id);
    if(!confirm(`Share ${source.name||source.ip} with ${studentIds.length} selected recipients?`))return;
    const result=await api('/api/v1/veyon/demo/start',{method:'POST',body:JSON.stringify({teacherId:source.id,studentIds,mode})});
    $('commandFeedback').textContent=result.ok?'Broadcast commands accepted; verify recipient screens.':'Some broadcast commands failed. Check command progress.';await refreshCommandJobs();
  }
  bind('studentDemoFull',()=>studentDemo('fullscreen'));bind('studentDemoWindow',()=>studentDemo('window'));
  bind('stopSelectedDemo',async()=>{
    const ids=selection();if(!confirm(`Stop broadcast modes on ${ids.length} selected computers? Include the source and audience.`))return;
    const result=await api('/api/v1/veyon/demo/stop-selected',{method:'POST',body:JSON.stringify({targets:ids})});
    for(const job of result.jobs||[])rememberCommandJob(job);
    $('commandFeedback').textContent='Broadcast cleanup queued; check progress, including offline participants.';
    await refreshCommandJobs();
  });
  bind('lessonActions',async()=>{
    const response=await api('/api/v1/veyon/lesson-actions');let actions=response.actions||[];
    const renderActions=()=>{
      openInfo('Saved lesson actions',`<p>Website, application and message presets. Do not save passwords, tokens or private URLs here. Actions run only when you select targets and press Run.</p><div id="lessonList">${actions.map((a,i)=>`<div class="featureRow"><span>${esc(a.name)} · ${esc(a.feature)}</span><span><button data-lesson-run="${i}">Run</button><button data-lesson-remove="${i}">Remove</button></span></div>`).join('')}</div><form id="lessonForm"><label>Name<input id="lessonName" maxlength="80" required></label><label>Action<select id="lessonKind"><option value="openWebsite">Website</option><option value="startApp">Application</option><option value="textMessage">Message</option></select></label><label>URL, application command or message<textarea id="lessonValue" maxlength="2000" required></textarea></label><button type="submit">Save action</button></form>`);
      $('lessonForm').onsubmit=async event=>{event.preventDefault();const next=[...actions,{name:$('lessonName').value,feature:$('lessonKind').value,value:$('lessonValue').value}];try{actions=(await api('/api/v1/veyon/lesson-actions',{method:'PUT',body:JSON.stringify({actions:next})})).actions;renderActions()}catch(error){alert(error.message)}};
      $('lessonList').querySelectorAll('[data-lesson-run]').forEach(button=>button.onclick=async()=>{try{const a=actions[Number(button.dataset.lessonRun)],targets=selection();if(!confirm(`Run ${a.name} on ${targets.length} selected computers?`))return;await feature(targets,a.feature,true,a.feature==='openWebsite'?{websiteUrls:[a.value]}:a.feature==='startApp'?{applications:[a.value]}:{text:a.value})}catch(error){alert(error.message)}});
      $('lessonList').querySelectorAll('[data-lesson-remove]').forEach(button=>button.onclick=async()=>{if(!confirm('Remove this saved action?'))return;try{actions=(await api('/api/v1/veyon/lesson-actions',{method:'PUT',body:JSON.stringify({actions:actions.filter((_,i)=>i!==Number(button.dataset.lessonRemove))})})).actions;renderActions()}catch(error){alert(error.message)}});
    };renderActions();
  });

  // Recording stays in browser memory and uses the existing sensitive-read route.
  // No audio capture, disk service, FFmpeg download or automatic recording.
  let recording=null,recordingBlob=null;
  function recordingButtons(){ $('startRecording').disabled=!!recording;$('stopRecording').disabled=!recording;$('downloadRecording').disabled=!recordingBlob;$('discardRecording').disabled=!recordingBlob; }
  function stopRecording(reason='Stopped'){
    if(!recording)return;const r=recording;r.stopping=true;r.reason=reason;clearTimeout(r.timer);clearTimeout(r.deadline);r.controller?.abort();
    if(r.recorder.state!=='inactive')r.recorder.stop();
  }
  $('stopRecording').onclick=()=>stopRecording();
  $('discardRecording').onclick=()=>{recordingBlob=null;recordingButtons();$('recordingStatus').textContent='Recording discarded'};
  $('downloadRecording').onclick=()=>{if(recordingBlob)download(recordingBlob,`RoomGoblin-recording-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`)};
  $('startRecording').onclick=async()=>{
    if(recording)return;
    try{
      const ids=selection(4);if(!previewSurfaceVisible())throw Error('Keep this workspace visible to record.');
      if(!globalThis.MediaRecorder||!HTMLCanvasElement.prototype.captureStream)throw Error('This browser does not support canvas recording.');
      const mime=['video/webm;codecs=vp8','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));if(!mime)throw Error('WebM recording is unavailable in this browser.');
      if(!confirm(`Record ${ids.length} selected screens for up to five minutes?${recordingBlob?' This replaces the previous undownloaded recording.':''}`))return;
      const canvas=document.createElement('canvas');canvas.width=ids.length>1?1280:640;canvas.height=384*Math.ceil(ids.length/2);if(ids.length===1)canvas.height=384;
      const context=canvas.getContext('2d');if(!context)throw Error('Canvas unavailable.');
      const stream=canvas.captureStream(1),recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1000000});
      const r={recorder,stream,canvas,context,ids,chunks:[],bytes:0,started:Date.now(),timer:null,controller:null,stopping:false,reason:'Stopped'};recording=r;recordingBlob=null;recordingButtons();
      recorder.ondataavailable=event=>{if(event.data.size&&!r.discard){if(r.bytes+event.data.size>32*1024*1024){r.discard=true;r.chunks=[];stopRecording('Size limit exceeded; recording discarded');return}r.chunks.push(event.data);r.bytes+=event.data.size;if(r.bytes>=32*1024*1024)stopRecording('Size limit reached')}};
      recorder.onerror=()=>stopRecording('Encoder failed; recording may be incomplete');
      recorder.onstop=()=>{clearTimeout(r.timer);clearTimeout(r.deadline);stream.getTracks().forEach(track=>track.stop());recordingBlob=r.chunks.length?new Blob(r.chunks,{type:mime}):null;recording=null;recordingButtons();$('recordingStatus').textContent=`${r.reason}. ${recordingBlob?'Download or discard the recording before leaving.':'No recording produced.'}`};
      context.fillStyle='#000';context.fillRect(0,0,canvas.width,canvas.height);recorder.start(1000);r.deadline=setTimeout(()=>stopRecording('Five-minute limit reached'),300000);
      async function frame(){
        if(r.stopping||recording!==r)return;
        if(!previewSurfaceVisible())return stopRecording('Workspace hidden');
        if(Date.now()-r.started>=300000)return stopRecording('Five-minute limit reached');
        try{
          for(let i=0;i<ids.length;i++){
            if(r.stopping)return;const x=(i%2)*640,y=Math.floor(i/2)*384;r.controller=new AbortController();
            let url;try{
              url=await imageFrame(`/api/v1/veyon/computers/${encodeURIComponent(ids[i])}/framebuffer?format=jpeg&width=640&quality=60`,r.controller);
              if(r.stopping)return;const image=new Image();image.src=url;await image.decode();if(r.stopping)return;
              context.fillStyle='#000';context.fillRect(x,y,640,384);const ratio=Math.min(640/image.naturalWidth,354/image.naturalHeight);
              context.drawImage(image,x,y,image.naturalWidth*ratio,image.naturalHeight*ratio);context.fillStyle='#fff';context.font='14px sans-serif';context.fillText(`${ids[i]} · ${new Date().toLocaleTimeString()}`,x+8,y+377,624);
            }finally{if(url)URL.revokeObjectURL(url);r.controller=null}
          }
          $('recordingStatus').textContent=`Recording ${ids.length} screens · ${Math.floor((Date.now()-r.started)/1000)} seconds`;
          r.timer=setTimeout(frame,1000);
        }catch(error){if(!r.stopping)stopRecording(`Capture stopped: ${error.message}`)}
      }
      frame();
    }catch(error){if(recording){recording.stream.getTracks().forEach(t=>t.stop());recording=null;recordingButtons()}alert(error.message)}
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRecording('Workspace hidden')});
  window.addEventListener('roomgoblin:viewport',()=>{if(!previewSurfaceVisible())stopRecording('Workspace hidden')});
  window.addEventListener('pagehide',()=>stopRecording('Page closed'));
  window.addEventListener('beforeunload',event=>{if(recording||recordingBlob){event.preventDefault();event.returnValue=''}});
})();
