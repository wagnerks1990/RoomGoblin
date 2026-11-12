"use strict";
(async()=>{
 const [{createUI,node,table,dateText,retired},{createAssignments},{createWork},{createClassroom},{createManagement},{createSetup}]=await Promise.all([
  import('./ui.mjs'),import('./assignments.mjs'),import('./work.mjs'),import('./classroom.mjs'),import('./management.mjs'),import('./setup.mjs')
 ]);
 const $=id=>document.getElementById(id),API='/api/v1/learning',views=['overview','assignments','submissions','discussions','classroom','classes','setup','audit'];
 let me=null,classes=[],current=null,data=null,authEpoch=0,classEpoch=0,view='overview',lastCatalog=0;
 const requests=new Map(),params=new URLSearchParams(location.search);
 const notice=message=>{if($('status').textContent!==message)$('status').textContent=message;};
 const owned=ctx=>!!ctx&&ctx===current&&ctx.authEpoch===authEpoch;
 const ui=createUI({api,notice,context:()=>current,owned,onSaved:async ctx=>{if(owned(ctx))await refresh({force:true});},onCatalog:catalog,onTools:showTools});
 const assignments=createAssignments(ui,$('assignment-list'),$('assignment-create'));
 const work=createWork(ui,{submissions:$('submission-list'),written:$('written-reviews'),discussions:$('discussion-list'),filterHost:$('discussion-filter')});
 const classroom=createClassroom(ui,$('classroom-content')),management=createManagement(ui,$('management-content')),setup=createSetup(ui,$('setup-content'));
 function clearPrivate(){
  authEpoch++;classEpoch++;me=null;current=null;data=null;classes=[];requests.clear();ui.clear();
  for(const module of [assignments,work,classroom,management,setup])module.reset();
  for(const id of ['stats','activity','audit-list','class-select','identity','last-refreshed'])$(id).replaceChildren();
  $('workspace').hidden=true;$('logout').hidden=true;showTools({});document.querySelector('[data-tab="setup"]').hidden=true;
 }
 async function api(path,method='GET',body){
  const epoch=authEpoch;let response;
  try{response=await fetch(API+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','x-roomgoblin-learning':'1'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(method==='GET'?60000:600000)});}
  catch{if(epoch!==authEpoch)throw retired();throw Error(method==='GET'?'The page could not refresh. Your saved data is unchanged.':'The change was not confirmed. Refresh before retrying.');}
  if(epoch!==authEpoch)throw retired();
  let value;try{value=await response.json();}catch{if(epoch!==authEpoch)throw retired();throw Error('RoomGoblin returned an unreadable response. Refresh before retrying.');}if(epoch!==authEpoch)throw retired();
  if(response.status===401){clearPrivate();$('login').hidden=false;notice('Your session ended. Sign in again to continue.');throw retired();}
  if(!response.ok||value.ok===false)throw Object.assign(Error(value.error||'The request could not be completed.'),{status:response.status});return value;
 }
 function remember(){if(!me)return;try{sessionStorage.setItem('roomgoblin.teacher.'+me.user.learnerKey,JSON.stringify({classId:current?.classId||'',follow:$('follow-current').checked}));}catch{}}
 function remembered(){try{return JSON.parse(sessionStorage.getItem('roomgoblin.teacher.'+me.user.learnerKey))||{};}catch{return {};}}
 function showTools(tools){for(const [id,key]of [['ai-chat','aiChatUrl'],['media-studio','mediaStudioUrl']]){const link=$(id),value=tools[key];link.hidden=!value;if(value)link.href=value;else link.removeAttribute('href');}}
 function classChoices(){
  const select=$('class-select'),selected=current?.classId,groups=[['Classes with assignments or learners',classes.filter(c=>c.assignmentCount||c.studentCount)],['Other classes',classes.filter(c=>!c.assignmentCount&&!c.studentCount)]];
  select.replaceChildren();for(const [label,rows]of groups){if(!rows.length)continue;const group=node('optgroup');group.label=label;for(const row of rows)group.append(new Option(row.title,row.id));select.append(group);}
  if(classes.some(c=>c.id===selected))select.value=selected;select.disabled=!classes.length;
 }
 async function catalog(preferred,{follow=false}={}){
  const epoch=authEpoch,[identity,list]=await Promise.all([api('/me'),api('/teacher/classes')]);if(epoch!==authEpoch)throw retired();
  if(!identity.user.teacher)throw Error('Teacher access required.');me=identity;classes=list.classes;lastCatalog=Date.now();
  if(current){current.me=me;current.classes=classes;}
  const saved=remembered(),valid=id=>classes.some(c=>c.id===id);
  if(follow)$('follow-current').checked=true;
  const active=$('follow-current').checked&&valid(me.activeClassId)?me.activeClassId:null;
  let selected=valid(preferred)?preferred:valid(current?.classId)?current.classId:valid(saved.classId)?saved.classId:active;
  if(follow&&active)selected=active;
  if(!selected)selected=[...classes].sort((a,b)=>(b.lastActivityAt||0)-(a.lastActivityAt||0)||b.studentCount-a.studentCount||a.title.localeCompare(b.title))[0]?.id||'';
  if(current&&selected!==current.classId&&ui.dirty.size)selected=current.classId;
  classChoices();if(!current||selected!==current.classId)await chooseClass(selected);else $('class-select').value=selected;
  remember();return classes;
 }
 async function chooseClass(id){
  if(current?.classId===id)return;
  ui.clear();data=null;classEpoch++;current={classId:id,epoch:classEpoch,authEpoch,me,classes,connectionOrigin:''};
  for(const module of [assignments,work,classroom,management,setup])module.reset();for(const name of ['stats','activity','audit-list'])$(name).replaceChildren();
  $('class-select').value=id;$('export').disabled=!id;remember();syncURL();
  if(id)await refresh({force:true});else{notice('Create a class under Classes & accounts to get started.');$('activity').replaceChildren(node('p','No assigned classes yet.','muted'));}
  await showView(view,{load:true});
 }
 function syncURL(){const next=new URL(location.href);next.pathname='/learn';if(current?.classId)next.searchParams.set('class',current.classId);else next.searchParams.delete('class');next.searchParams.delete('manage');next.searchParams.set('view',view);history.replaceState(null,'',next.pathname+next.search);}
 function label(kind){const map={'discussion.initial':'Initial post','discussion.reply':'Discussion reply','discussion.teacher':'Teacher response','discussion.ai':'Automatic response','discussion.critique':'Independent critique',score:'SCORM score',progress:'SCORM progress',completed:'Assignment completed',submission:'Written SCORM response',checkpoint:'Progress checkpoint',arcade:'Arcade checkpoint',assessment:'Assessment saved'};return map[kind]||kind.replace(/[._]/g,' ');}
 function draw({force=false}={}){
  if(!data||!current)return;
  $('stats').replaceChildren(...[['Activity events',data.counts.events],['SCORM responses',data.counts.submissions],['Discussion posts',data.counts.discussions],['Reviews saved',data.counts.reviewed],['Needs review',data.counts.pending]].map(([title,count])=>{const card=node('div',title,'card stat');card.append(node('strong',count));return card;}));
  $('activity').replaceChildren(table(data.recentActivity,[['When',r=>dateText(r.at)],['Assignment',r=>r.title],['Learner',r=>r.alias],['Activity',r=>label(r.kind)]]));
  $('audit-list').replaceChildren(table(data.events,[['When',r=>dateText(r.at)],['Assignment',r=>r.title||'Class setup'],['Action',r=>label(r.kind)]]));
  current.connectionOrigin=data.connectionOrigin||'';assignments.render(data,current,{force});work.render(data,current,{force});
 }
 async function refresh({force=false}={}){
  const selected=current;if(!selected?.classId)return;
  const key=selected.authEpoch+':'+selected.epoch;if(requests.has(key))return requests.get(key);
  const request=(async()=>{const result=await api('/teacher/classes/'+selected.classId);ui.assert(selected);data=result;draw({force});$('last-refreshed').dateTime=new Date().toISOString();$('last-refreshed').textContent='Updated '+new Date().toLocaleTimeString();})();requests.set(key,request);
  try{await request;}finally{if(requests.get(key)===request)requests.delete(key);}
 }
 async function showView(next,{load=true}={}){
  if(!views.includes(next))next='overview';if(next==='setup'&&!me?.user.admin)next='overview';view=next;
  for(const name of views)$(name).hidden=name!==view;for(const button of document.querySelectorAll('[data-tab]')){if(button.dataset.tab===view)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}syncURL();
  if(!current||!load)return;
  if(view==='classroom')await classroom.load(current,{force:true});if(view==='classes')await management.load(current,{force:true});if(view==='setup')await setup.load(current,{force:true});
 }
 async function start(){
  const identity=await api('/me');if(!identity.user.teacher){clearPrivate();$('login').hidden=false;notice('This workspace requires a teacher account. Open your assigned learning activity instead.');return;}
  clearPrivate();me=identity;const epoch=authEpoch;const saved=remembered();$('follow-current').checked=saved.follow!==false;
  view=views.includes(params.get('view'))?params.get('view'):location.hash==='#classes'?'classes':location.hash==='#classroom'?'classroom':'overview';
  if(view==='setup'&&!me.user.admin)view='overview';$('login').hidden=true;$('identity').textContent=me.user.alias;$('logout').hidden=false;document.querySelector('[data-tab="setup"]').hidden=!me.user.admin;
  let preferred=params.get('class');
  if(params.get('activity')){const result=await api('/activities/'+encodeURIComponent(params.get('activity')));if(epoch!==authEpoch)throw retired();preferred=result.activity.class_id;if(!views.includes(params.get('view')))view='discussions';}
  await catalog(preferred);if(params.get('activity'))await work.selectActivity(params.get('activity'));if(epoch!==authEpoch)throw retired();$('workspace').hidden=false;notice('Connected to RoomGoblin.');
  api('/platform/tools').then(result=>{if(epoch===authEpoch)showTools(result.tools);}).catch(()=>{});
 }
 for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>ui.run(button,()=>showView(button.dataset.tab));
 $('class-select').onchange=async()=>{const next=$('class-select').value;if(!ui.canLeave()){$('class-select').value=current?.classId||'';return;}$('follow-current').checked=false;try{await chooseClass(next);}catch(error){if(!error.retired)notice(error.message);}};
 $('follow-current').onchange=()=>{remember();if($('follow-current').checked&&!ui.dirty.size&&me?.activeClassId&&classes.some(c=>c.id===me.activeClassId))chooseClass(me.activeClassId).catch(error=>{if(!error.retired)notice(error.message);});};
 $('workspace').addEventListener('input',event=>{if(event.target.closest('form')){$('follow-current').checked=false;remember();}});
 $('refresh').onclick=()=>ui.run($('refresh'),async()=>{if(!ui.canLeave())return;ui.clear();await catalog();await refresh({force:true});await showView(view);notice('Refreshed from RoomGoblin.');});
 $('export').onclick=()=>ui.run($('export'),async()=>{
  const selected=current;ui.assert(selected);let response;try{response=await fetch(`${API}/teacher/classes/${selected.classId}/export`,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(60000)});}catch{throw Error('The export could not be downloaded. Your drafts are unchanged.');}
  ui.assert(selected);if(!response.ok)throw Error('Export was not available. Sign in again if your session ended.');const blob=await response.blob();ui.assert(selected);const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='RoomGoblin-submissions.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
 });
 $('login-form').onsubmit=event=>{event.preventDefault();ui.run(event.submitter,async()=>{try{const result=await fetch('/api/v1/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('username').value,password:$('password').value})});if(!result.ok)throw Error('Sign-in failed. Check your username and password.');await start();}finally{$('password').value='';}});};
 $('logout').onclick=()=>ui.run($('logout'),async()=>{if(!ui.canLeave())return;const result=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!result.ok)throw Error('Sign-out was not confirmed. Try again.');clearPrivate();$('login').hidden=false;notice('Signed out.');});
 let polling=false;setInterval(async()=>{
  if(polling||document.hidden||!current)return;polling=true;
  try{
   if(Date.now()-lastCatalog>30000)await catalog();
   if($('follow-current').checked&&['overview','classroom'].includes(view)&&!ui.dirty.size&&!document.activeElement?.matches('input,textarea,select')&&me.activeClassId&&classes.some(c=>c.id===me.activeClassId)&&current.classId!==me.activeClassId)await chooseClass(me.activeClassId);
   if(view==='classroom')await classroom.refresh();else if(!['classes','setup'].includes(view))await refresh();
   if(view==='discussions')await work.refresh();
  }catch(error){if(!error.retired)notice(error.message);}finally{polling=false;}
 },8000);
 try{await start();}catch(error){if(!error.retired){$('login').hidden=false;notice(error.message);}}
})().catch(()=>{document.getElementById('status').textContent='The teacher workspace could not start. Refresh to try again.';});
