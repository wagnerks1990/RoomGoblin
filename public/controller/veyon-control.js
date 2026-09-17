/* Bounded browser remote-control session. Input is queued, never claimed executed. */
(() => {
  'use strict';
  const canvas=$('controlCanvas'),image=$('liveImg'),screen=$('liveScreen'),clipboard=$('remoteClipboard');
  let current=null,opening=false;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function call(s,action,args={}){
    const task=s.tail.catch(()=>{}).then(()=>{
      if(current!==s&&action!=='close')throw Error('Control session closed');
      return api(`/api/v1/veyon/computers/${encodeURIComponent(s.id)}/browser/${action}`,{method:'POST',body:JSON.stringify({...args,session:s.session})});
    });
    s.tail=task;return task;
  }
  function selectedRect(s){
    if(screen.value==='all')return {x:0,y:0,width:s.state.frameWidth,height:s.state.frameHeight};
    return s.state.screens.find(item=>String(item.index)===screen.value)||{x:0,y:0,width:s.state.frameWidth,height:s.state.frameHeight};
  }
  function draw(s){
    if(current!==s||!s.state||!s.frameImage?.naturalWidth)return;
    const rect=selectedRect(s),source=s.frameImage,scaleX=source.naturalWidth/s.state.frameWidth,scaleY=source.naturalHeight/s.state.frameHeight;
    let width=Math.max(1,Math.min(rect.width,Math.round(rect.width*scaleX))),height=Math.max(1,Math.min(rect.height,Math.round(rect.height*scaleY)));
    const areaScale=Math.min(1,Math.sqrt(4_000_000/(width*height)));width=Math.max(1,Math.round(width*areaScale));height=Math.max(1,Math.round(height*areaScale));
    canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(source,rect.x*scaleX,rect.y*scaleY,rect.width*scaleX,rect.height*scaleY,0,0,width,height);
  }
  function updateScreens(s,state){
    const signature=JSON.stringify(state.screens.map(item=>[item.index,item.name,item.x,item.y,item.width,item.height]));
    if(signature===s.screenSignature)return;
    s.screenSignature=signature;const previous=screen.value;
    screen.replaceChildren(new Option('All screens','all'),...state.screens.map(item=>new Option(item.name||`Screen ${item.index+1}`,String(item.index))));
    screen.value=[...screen.options].some(option=>option.value===previous)?previous:'all';
  }
  async function controlFrame(s){
    if(current!==s||s.frameBusy)return;s.frameBusy=true;canvas.dataset.ready='false';let url;
    try{
      const before=await call(s,'state');if(current!==s)return;
      s.controller=new AbortController();const width=Math.max(640,Math.min(2560,Math.round(($('liveStage').clientWidth||1280)*devicePixelRatio)));
      url=await imageFrame(`/api/v1/veyon/computers/${encodeURIComponent(s.id)}/framebuffer?format=jpeg&width=${width}&quality=78&t=${Date.now()}`,s.controller);
      const frame=new Image();frame.src=url;await frame.decode();const after=await call(s,'state');if(current!==s)return;
      // Live VNC can complete incremental updates continuously. The lease is
      // deliberately issued/refreshed after this decoded capture; dimensions
      // and topology, not an update counter, prove the crop is still valid.
      const same=before.ready&&after.ready&&after.frameRevision>=before.frameRevision&&before.topology===after.topology&&before.frameWidth===after.frameWidth&&before.frameHeight===after.frameHeight;
      s.state=after;s.frameImage=frame;updateScreens(s,after);draw(s);canvas.dataset.ready=same?'true':'false';
      $('liveStatus').textContent=same?'CONTROL ACTIVE — input queued, endpoint execution unverified. Press Escape to exit.':'Control paused because the remote frame changed during capture; retrying.';
    }catch(error){if(current===s)$('liveStatus').textContent=`Control paused: ${error.message}`}
    finally{if(url)URL.revokeObjectURL(url);s.controller=null;s.frameBusy=false;if(current===s)s.frameTimer=setTimeout(()=>controlFrame(s),1000)}
  }
  function lease(s){
    if(!s.state?.ready||canvas.dataset.ready!=='true')throw Error('Wait for a fresh control frame.');
    return {lease:s.state.lease,revision:s.state.frameRevision,sequence:++s.sequence};
  }
  function releaseLease(s){
    if(!s.state?.lease)throw Error('No control lease is available.');
    return {lease:s.state.lease,revision:s.state.frameRevision,sequence:++s.sequence};
  }
  function buttonMask(buttons){return (buttons&1?1:0)|(buttons&4?2:0)|(buttons&2?4:0)}
  function point(event,s){
    const box=canvas.getBoundingClientRect(),rect=selectedRect(s);
    return {x:Math.max(rect.x,Math.min(rect.x+rect.width-1,Math.floor(rect.x+(event.clientX-box.left)*rect.width/box.width))),y:Math.max(rect.y,Math.min(rect.y+rect.height-1,Math.floor(rect.y+(event.clientY-box.top)*rect.height/box.height)))};
  }
  function keyName(name){return ({ArrowLeft:'Left',ArrowRight:'Right',ArrowUp:'Up',ArrowDown:'Down'})[name]||name}
  async function pointer(event,buttons=buttonMask(event.buttons)){
    const s=current;if(!s)return;const now=performance.now();
    if(event.type==='pointermove'&&now-s.lastPointer<150)return;s.lastPointer=now;
    try{const coordinates=point(event,s);s.lastPoint=coordinates;await call(s,'pointer',{...coordinates,buttons,...event.type==='pointerup'?releaseLease(s):lease(s)})}catch(error){canvas.dataset.ready='false';$('liveStatus').textContent=`Input paused: ${error.message}`}
  }
  async function close(reason='Control exited'){
    const s=current;if(!s)return;current=null;clearTimeout(s.frameTimer);s.controller?.abort();canvas.dataset.ready='false';
    $('modal').classList.remove('control-active');canvas.hidden=true;image.hidden=false;
    $('liveScreenLabel').hidden=true;$('readRemoteClipboard').hidden=true;$('stopBrowserControl').hidden=true;$('startBrowserControl').hidden=false;
    $('liveRefreshMs').disabled=false;clipboard.value='';clipboard.hidden=true;screen.replaceChildren(new Option('All screens','all'));window.resumeVeyonLive?.();
    queueMicrotask(()=>{if(!current&&$('modal').classList.contains('open')&&!$('startBrowserControl').hidden)$('startBrowserControl').focus()});
    try{await call(s,'close')}catch(error){$('commandFeedback').textContent=`${reason}; native input watchdog will release keys/buttons: ${error.message}`}
  }
  window.closeVeyonControl=close;
  async function open(){
    const id=$('startBrowserControl').dataset.id;if(!id||opening||current)return;
    if(!confirm('Enter browser control for this one computer? Mouse and keyboard events are sent immediately but execution cannot be confirmed. Escape exits.'))return;
    opening=true;$('startBrowserControl').disabled=true;
    try{
      const result=await api(`/api/v1/veyon/computers/${encodeURIComponent(id)}/browser/open`,{method:'POST',body:JSON.stringify({kind:'control'})});
      const s={id,session:result.session,tail:Promise.resolve(),sequence:0,state:null,frameBusy:false,lastPointer:0};current=s;window.pauseVeyonLive?.();
      $('modal').classList.add('control-active');canvas.hidden=false;image.hidden=true;$('startBrowserControl').hidden=true;
      $('liveScreenLabel').hidden=false;$('readRemoteClipboard').hidden=false;$('stopBrowserControl').hidden=false;
      $('liveRefreshMs').disabled=true;canvas.focus();controlFrame(s);
    }catch(error){alert(error.message)}finally{opening=false;$('startBrowserControl').disabled=false}
  }
  $('startBrowserControl').onclick=open;$('stopBrowserControl').onclick=()=>close();
  screen.onchange=async()=>{const s=current;if(s){try{if(s.lastPoint)await call(s,'pointer',{...s.lastPoint,buttons:0,...lease(s)})}catch{}draw(s);canvas.focus()}};
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  for(const type of ['pointerdown','pointerup','pointermove'])canvas.addEventListener(type,event=>{event.preventDefault();if(type==='pointerdown'){canvas.setPointerCapture(event.pointerId);canvas.focus()}pointer(event)});
  canvas.addEventListener('wheel',async event=>{event.preventDefault();const s=current;if(!s)return;try{const p=point(event,s);await call(s,'pointer',{...p,buttons:buttonMask(event.buttons),wheel:event.deltaY<0?-1:1,...lease(s)})}catch(error){canvas.dataset.ready='false';$('liveStatus').textContent=`Input paused: ${error.message}`}}, {passive:false});
  canvas.addEventListener('keydown',async event=>{const s=current;if(!s)return;if(event.key==='Escape'){event.preventDefault();return close()}if(event.repeat)return;event.preventDefault();const key=keyName(event.key);s.keys??=new Set();s.keys.add(key);try{await call(s,'key',{key,pressed:true,...lease(s)})}catch(error){canvas.dataset.ready='false';$('liveStatus').textContent=`Input paused: ${error.message}`}});
  canvas.addEventListener('keyup',async event=>{const s=current;if(!s)return;event.preventDefault();const key=keyName(event.key);s.keys?.delete(key);try{await call(s,'key',{key,pressed:false,...releaseLease(s)})}catch{}});
  $('readRemoteClipboard').onclick=async()=>{
    const s=current;if(!s)return;s.confirming=true;const confirmed=confirm('Read up to 8 KiB of text from this computer clipboard once? It will be shown here and cleared when control closes.');s.confirming=false;if(!confirmed)return;
    $('readRemoteClipboard').disabled=true;clipboard.value='';clipboard.hidden=true;
    try{
      for(let attempt=0;attempt<22;attempt++){const result=await call(s,'clipboard');if(result.error)throw Error(result.error);if(!result.pending){clipboard.value=result.text;clipboard.hidden=false;clipboard.focus();return}await sleep(250)}
      throw Error('Clipboard response timed out.');
    }catch(error){alert(error.message)}finally{$('readRemoteClipboard').disabled=false}
  };
  window.addEventListener('blur',()=>{if(current&&!current.confirming)close('Browser lost focus')});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&current)close('Workspace hidden')});
  document.addEventListener('keydown',event=>{if(current&&event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}},true);
})();
