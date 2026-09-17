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

/* Controller overview must not behave like a bank of display receivers.
 * Replace receiver preview iframes with lightweight status placeholders so the
 * operator browser never opens one WebSocket/video renderer per TV.
 */
(()=>{
 'use strict';
 const root=document.getElementById('overviewDisplays');
 if(!root)return;
 function stripReceiverPreviews(scope=root){
  scope.querySelectorAll?.('iframe[data-overview-preview]').forEach(frame=>{
   const holder=frame.closest('.displayPreview')||frame.parentElement;
   const name=frame.dataset.overviewPreview||'display';
   frame.src='about:blank';
   frame.remove();
   if(holder&&!holder.querySelector('[data-rg-overview-preview-disabled]')){
    const note=document.createElement('div');
    note.dataset.rgOverviewPreviewDisabled='1';
    note.className='displayPreviewOffline';
    note.innerHTML=`<div style="text-align:center"><b>${String(name).replace(/[<>&"']/g,'')}</b><br>Live preview disabled in controller</div>`;
    holder.appendChild(note);
   }
  })
 }
 const originalRefresh=window.refreshOverviewDisplayPreviews;
 window.refreshOverviewDisplayPreviews=()=>{stripReceiverPreviews();return undefined};
 const originalRender=window.renderOverviewDisplays;
 if(typeof originalRender==='function')window.renderOverviewDisplays=function(...args){const result=originalRender.apply(this,args);stripReceiverPreviews();return result};
 const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)stripReceiverPreviews(node.matches?.('iframe[data-overview-preview]')?node.parentElement||root:node)});
 observer.observe(root,{childList:true,subtree:true});
 stripReceiverPreviews();
})();
