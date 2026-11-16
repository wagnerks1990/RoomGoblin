// Browse/review is a UI mode, never a teacher authorization claim.
export function mountPreview(cfg,{renderInstructions,renderPosts}){
 const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 document.body.classList.add('preview-mode');document.querySelector('.work-grid').hidden=true;
 $('conversation').querySelector('h2').textContent='Live discussion — read only';$('conversation').querySelector('.muted').textContent='These are saved shared posts. Preview practice does not add to this conversation.';
 $('title').textContent=cfg.title;document.title='Preview · '+cfg.title;
 $('composer-status').textContent='';
 const banner=node('section');banner.className='card preview-banner';banner.append(node('h2','Preview mode'),node('p','View the live shared discussion and try the writing controls locally. Practice is not posted, graded or saved as an LMS attempt. Private assessments and teacher actions stay in the teacher workspace.'));
 try{const u=new URL(cfg.teacherOrigin);if(u.origin===cfg.teacherOrigin&&(u.protocol==='https:'||u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname))){const link=node('a','Open teacher workspace');link.href=u.origin+'/learn?activity='+encodeURIComponent(cfg.activityId)+'&view=discussions';link.target='_blank';link.rel='noopener noreferrer';banner.append(link);}}catch{}
 const retry=node('button','Refresh preview');retry.type='button';banner.append(retry);document.querySelector('.connection').after(banner);
 const practice=node('section');practice.className='card preview-practice';practice.append(node('h2','Local practice — not shared'));
 const local=node('div'),form=node('form'),label=node('label','Practice response'),input=node('textarea');input.rows=5;input.maxLength=6000;input.required=true;input.id='preview-response';label.htmlFor=input.id;
 const submit=node('button','Add practice response'),reset=node('button','Clear practice');submit.disabled=true;reset.type='button';form.append(label,input,submit);practice.append(node('p','These controls keep text only in this page. Closing or reloading clears practice.'),form,reset,local);$('instructions').after(practice);
 form.onsubmit=event=>{event.preventDefault();if(submit.disabled)return;const p=node('article');p.append(node('strong','Your local practice response'),node('p',input.value));local.append(p);input.value='';$('status').textContent='Practice added locally. Nothing was posted or graded.';};
 reset.onclick=()=>{input.value='';local.replaceChildren();};
 let busy=false,retired=false;
 async function refresh(){if(busy||retired)return;busy=true;retry.disabled=true;try{
  const url=new URL(cfg.origin);if(url.origin!==cfg.origin||url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Invalid assignment connection.');
  const response=await fetch(url.origin+'/api/v1/learning/direct/activities/'+cfg.activityId+'/preview',{credentials:'omit',cache:'no-store',headers:{'X-RoomGoblin-Learning':'1',Authorization:'RoomGoblin-Assignment '+cfg.enrollmentKey},signal:AbortSignal.timeout(20000)}),data=await response.json();if(retired)return;
  if(!response.ok){if([401,403,409].includes(response.status)){$('posts').replaceChildren();$('instructions').replaceChildren();submit.disabled=true;input.readOnly=true;}throw Error(data.error||'Preview is unavailable.');}
  renderInstructions(data.activity.case);if(cfg.written){renderPosts(data.posts);$('independent-reply').hidden=true;}submit.disabled=false;input.readOnly=false;
  $('status').textContent='Preview connected. Shared posts refresh automatically; practice stays local.';
 }catch(error){if(!retired)$('status').textContent=error.message;}finally{busy=false;retry.disabled=false;}}
 retry.onclick=refresh;refresh();const timer=setInterval(()=>{if(!document.hidden)refresh();},8000);
 window.addEventListener('pagehide',()=>{retired=true;clearInterval(timer);local.replaceChildren();input.value='';},{once:true});
}
