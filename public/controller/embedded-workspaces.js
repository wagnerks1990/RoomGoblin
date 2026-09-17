/* Same-origin lab frames use the controller document's natural page scroll.
 * Keep each frame mounted; report the actual visible parent viewport to preview workers.
 */
(()=>{
 'use strict';
 const frames=[...document.querySelectorAll('#labVeyonFrame,#labWindowsFrame')];
 const state=new Map();let scheduled=false;
 const embedCss=`
 html.rg-embedded-lab,html.rg-embedded-lab body{height:auto!important;min-height:0!important;overflow:clip!important}
 html.rg-embedded-lab body{display:flow-root}
 html.rg-embedded-lab .lab-nav{display:none}
 html.rg-embedded-lab header{position:static}
 html.rg-embedded-lab .modal{top:var(--rg-embed-top,0px)!important;bottom:auto!important;height:var(--rg-embed-height,600px)!important;padding:8px!important}
 html.rg-embedded-lab .modal .modalBox{min-height:0!important;min-width:0!important;max-height:calc(var(--rg-embed-height,600px) - 16px)!important;max-width:100%!important}
 html.rg-embedded-lab #modal .modalBox{height:min(900px,calc(var(--rg-embed-height,600px) - 16px))!important}
 html.rg-embedded-lab dialog[open]{position:fixed;top:calc(var(--rg-embed-top,0px) + 8px);bottom:auto;max-height:calc(var(--rg-embed-height,600px) - 16px);margin:0 auto;overflow:auto}
 html.rg-embedded-lab .modal:fullscreen{top:0!important;height:100dvh!important}
 html.rg-embedded-lab .modal:fullscreen .modalBox{height:100dvh!important;max-height:100dvh!important}
 `;
 function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;for(const frame of frames)update(frame)})}
 function update(frame){
  const entry=state.get(frame);if(!entry)return;
  const doc=entry.doc,win=frame.contentWindow;
  if(!doc.body||win.document!==doc)return;
  const visible=frame.getClientRects().length>0&&!document.hidden;
  if(visible){
   const height=Math.max(1,Math.ceil(doc.body.getBoundingClientRect().height)+2);
   if(Math.abs(frame.getBoundingClientRect().height-height)>1)frame.style.height=height+'px';
  }
  const rect=frame.getBoundingClientRect(),mobileBar=document.querySelector('.rg-mobilebar');
  const inset=mobileBar&&getComputedStyle(mobileBar).display!=='none'?mobileBar.getBoundingClientRect().bottom:0;
  const top=Math.max(0,inset-rect.top),bottom=Math.min(frame.clientHeight,innerHeight-rect.top);
  const viewport={top,bottom:Math.max(top,bottom),height:Math.max(0,bottom-top),visible:visible&&bottom>top};
  const key=JSON.stringify(viewport);if(entry.viewport===key)return;entry.viewport=key;
  doc.documentElement.style.setProperty('--rg-embed-top',top+'px');
  doc.documentElement.style.setProperty('--rg-embed-height',Math.max(0,viewport.height)+'px');
  win.RoomGoblinEmbeddedViewport=viewport;
  win.dispatchEvent(new win.CustomEvent('roomgoblin:viewport',{detail:viewport}));
 }
 function connect(frame){
  const old=state.get(frame);old?.observer.disconnect();state.delete(frame);
  try{
   const doc=frame.contentDocument;
   if(!doc?.body||!['/controller/veyon.html','/controller/lab.html'].includes(frame.contentWindow.location.pathname))return;
   doc.documentElement.classList.add('rg-embedded-lab');
   const style=doc.createElement('style');style.dataset.embeddedWorkspace='true';style.textContent=embedCss;doc.head.append(style);
   frame.dataset.naturalHeight='true';
   const observer=new ResizeObserver(schedule);observer.observe(doc.body);
   state.set(frame,{doc,observer,viewport:null});schedule();
  }catch{}
 }
 for(const frame of frames){frame.addEventListener('load',()=>connect(frame));new MutationObserver(schedule).observe(frame,{attributes:true,attributeFilter:['hidden']});connect(frame)}
 new ResizeObserver(schedule).observe(document.getElementById('workspaceMain'));
 const lab=document.getElementById('lab');if(lab)new MutationObserver(schedule).observe(lab,{attributes:true,attributeFilter:['class','data-authorized']});
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);document.addEventListener('visibilitychange',schedule);
})();

/* Today-page display previews remain live observers for text, images, timers and
 * state changes. Video payloads are intentionally not decoded in the controller:
 * once a preview renderer adds a <video>, cancel its source and show a lightweight
 * status overlay while the physical display keeps playing the real media.
 */
(()=>{
 'use strict';
 const install=frame=>{
  try{
   const doc=frame.contentDocument;if(!doc?.body)return;
   const media=doc.getElementById('media');if(!media)return;
   const suppress=()=>{
    media.querySelectorAll('video').forEach(video=>{
     if(video.dataset.rgControllerPreviewSuppressed==='1')return;
     video.dataset.rgControllerPreviewSuppressed='1';
     try{video.pause()}catch{}
     try{video.removeAttribute('src');video.load()}catch{}
     if(!media.querySelector('[data-rg-video-preview-note]')){
      const note=doc.createElement('div');
      note.dataset.rgVideoPreviewNote='1';
      note.style.cssText='position:absolute;inset:0;display:grid;place-items:center;padding:8%;text-align:center;background:#05080c;color:#d9e2ec;font-size:64px;line-height:1.2;z-index:20';
      note.textContent='Video active on physical display';
      media.appendChild(note);
     }
    });
    if(!media.querySelector('video'))media.querySelectorAll('[data-rg-video-preview-note]').forEach(n=>n.remove());
   };
   suppress();
   const observer=new MutationObserver(suppress);observer.observe(media,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
   frame.addEventListener('load',()=>observer.disconnect(),{once:true});
  }catch{}
 };
 const wire=()=>document.querySelectorAll('iframe[data-overview-preview]').forEach(frame=>{if(frame.dataset.rgLightPreviewBound==='1')return;frame.dataset.rgLightPreviewBound='1';frame.addEventListener('load',()=>install(frame));if(frame.contentDocument?.readyState==='complete')install(frame)});
 const root=document.getElementById('overviewDisplays');if(!root)return;
 wire();new MutationObserver(wire).observe(root,{childList:true,subtree:true});
})();
