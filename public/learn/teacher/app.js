'use strict';
const $=id=>document.getElementById(id),API='/api/v1/learning';
const tabs=['overview','assignments','submissions','discussions','commands','audit'];
let me=null,classId='',data=null,tab='overview',generation=0,pending=false;
const dirty=new Set();
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(cls)node.className=cls;return node;}
function notice(message){$('status').textContent=message;}
async function api(path,method='GET',body){
 const response=await fetch(API+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','x-roomgoblin-learning':'1'},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json();if(!response.ok){if(response.status===401){$('workspace').hidden=true;$('login').hidden=false;$('logout').hidden=true;$('identity').textContent='';data=null;classId='';generation++;dirty.clear();}throw Error(value.error||'The request could not be completed.');}return value;
}
async function run(button,fn){button.disabled=true;try{await fn();}catch(error){notice(error.message);}finally{button.disabled=false;}}
function action(text,fn){const button=el('button',text);button.type='button';button.onclick=()=>run(button,fn);return button;}
function field(form,label,type,value,attrs={}){const wrapper=el('label',label),input=el(type==='textarea'?'textarea':type==='select'?'select':'input');if(!['textarea','select'].includes(type))input.type=type;Object.assign(input,attrs);input.value=value??'';wrapper.append(input);form.append(wrapper);return input;}
function formSave(form,label,fn){const button=el('button',label);form.append(button);form.onsubmit=event=>{event.preventDefault();run(button,async()=>{await fn();dirty.delete(form);await refresh();notice(dirty.size?'Saved. Other unsaved drafts remain open.':'Saved to RoomGoblin.');});};}
function table(rows,columns){if(!rows.length)return el('p','No records for this class yet.','muted');const table=el('table'),head=el('thead'),tr=el('tr');for(const [label]of columns)tr.append(el('th',label));head.append(tr);table.append(head);const body=el('tbody');for(const row of rows){const line=el('tr');for(const [,value]of columns)line.append(el('td',value(row)));body.append(line);}table.append(body);return table;}
const when=value=>new Date(value).toLocaleString();
function selectTab(next){tab=next;for(const id of tabs)$(id).hidden=id!==next;for(const button of document.querySelectorAll('[data-tab]')){if(button.dataset.tab===next)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}}
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>selectTab(button.dataset.tab);
document.addEventListener('input',event=>{const form=event.target.closest('form');if(form&&form.id!=='login-form')dirty.add(form);});
document.addEventListener('change',event=>{const form=event.target.closest('form');if(form&&form.id!=='login-form')dirty.add(form);});
window.addEventListener('beforeunload',event=>{if(dirty.size){event.preventDefault();event.returnValue='';}});

function draw(){
 if(!data)return;
 $('stats').replaceChildren(...[['Events',data.counts.events],['Submissions',data.counts.submissions],['Discussion posts',data.counts.discussions],['Reviewed submissions',data.counts.reviewed]].map(([title,count])=>{const card=el('div',title,'card stat');card.append(el('strong',count));return card;}));
 $('activity').replaceChildren(table(data.signals,[['When',r=>when(r.received_at)],['Assignment',r=>r.title],['Learner',r=>r.alias],['Event',r=>r.kind]]));
 $('audit-list').replaceChildren(table(data.events,[['When',r=>when(r.at)],['Assignment',r=>r.title],['Action',r=>r.kind],['Record',r=>r.record_id]]));
 if(dirty.size)return;
 drawAssignments();drawSubmissions();drawWritten();drawDiscussions();drawCommands();
}
async function refresh(){
 if(!classId||pending)return;pending=true;const id=classId,owner=generation;
 try{const result=await api('/teacher/classes/'+id);if(owner!==generation||id!==classId)return;data=result;draw();notice(dirty.size?'Updates available. Save your drafts or refresh to discard them.':'Connected · last refreshed '+new Date().toLocaleTimeString());}
 finally{pending=false;}
}
function drawAssignments(){
 const node=$('assignment-list');node.replaceChildren();if(!data.activities.length)node.append(el('p','Create your first assignment below.'));
 for(const item of data.activities){const card=el('div',undefined,'card');card.append(el('h3',item.title),el('p',`${item.template_id==='scorm-connector-v1'?'SCORM assignment':'Written discussion'} · ${item.points||20} points · ${item.open?'Open':'Closed'}`));const links=el('div',undefined,'actions'),link=el('a','Open assignment');link.href='/learn/?activity='+encodeURIComponent(item.id);if(item.template_id!=='scorm-connector-v1')links.append(link);const setup=el('a','Configure connection');setup.href='/learn/platform/';links.append(setup);card.append(links);node.append(card);}
}
function drawSubmissions(){
 const node=$('submission-list');node.replaceChildren();if(!data.submissions.length)node.append(el('p','No written SCORM submissions yet. Assignments configured to save written responses will appear here. Discussion work appears below.','muted'));
 for(const row of data.submissions){const details=el('details');details.append(el('summary',`${row.alias} · ${row.title} · ${row.score===null?'Needs review':row.score+' / '+row.points+' reviewed'}`),el('p',`${when(row.received_at)} · Provisional score: ${row.payload.earned} / ${row.points}`));for(const [question,answer]of Object.entries(row.payload.answers||{}))details.append(el('h3',question),el('pre',answer));
  const form=el('form'),score=field(form,'Teacher score','number',row.score??row.payload.earned,{min:0,max:row.points,step:'any',required:true}),feedback=field(form,'Teacher feedback','textarea',row.feedback||'',{maxLength:1000,rows:3});
  formSave(form,'Save review',()=>api('/teacher/submissions/'+row.id+'/review','PUT',{score:Number(score.value),feedback:feedback.value,revision:row.revision||0}));details.append(form,el('p','This private review does not write a Schoology grade.','muted'));node.append(details);
 }
}
function drawWritten(){
 const node=$('written-reviews');node.replaceChildren();if(!data.reviews.length)node.append(el('p','Written review requests will appear here after students submit a discussion.','muted'));
 for(const row of data.reviews){const details=el('details');details.append(el('summary',`${row.alias} · ${row.title} · ${row.status} · ${row.final?.total??row.ai?.total??'pending'} / 20`),el('h3','Initial response'),el('pre',row.snapshot.initial),el('h3','Selected reply'),el('pre',row.snapshot.reply||'Not submitted'),el('h3','Peer or alternate context'),el('pre',row.snapshot.parent||'None'));
  if(['approved','needs_review','unavailable'].includes(row.status))details.append(action('Review rubric',async()=>{
   const owner=generation,activity=await api('/activities/'+row.activityId);if(owner!==generation||!details.isConnected)return;
   if(details.querySelector('form'))return;const form=el('form'),grade=row.final||row.ai,criteria={};
   for(const [key,levels]of Object.entries(activity.activity.case.scoreLevels)){
    const points=field(form,(activity.activity.case.criterionLabels?.[key]||key)+' points','select','');for(const level of levels)points.add(new Option(String(level),String(level)));points.value=String(grade?.criteria[key]?.points??0);
    const feedback=field(form,(activity.activity.case.criterionLabels?.[key]||key)+' feedback','textarea',grade?.criteria[key]?.feedback||'',{required:true,maxLength:1600});criteria[key]={points,feedback};
   }
   const summary=field(form,'Teacher summary','textarea',grade?.summary||'',{required:true,maxLength:1600}),response=field(form,'Public teacher response (optional)','textarea','',{maxLength:1800}),waive=field(form,'Waive late penalty','checkbox','');waive.parentElement.className='check';
   formSave(form,row.status==='approved'?'Publish correction':'Publish reviewed grade',()=>api(`/activities/${row.activityId}/reviews/${row.id}/approve`,'POST',{criteria:Object.fromEntries(Object.entries(criteria).map(([key,value])=>[key,{points:Number(value.points.value),feedback:value.feedback.value}])),summary:summary.value,response:response.value,waiveLate:waive.checked}));details.append(form);
  }));node.append(details);
 }
}
function drawDiscussions(){
 const node=$('discussion-list');node.replaceChildren();if(!data.discussions.length)node.append(el('p','No discussion posts for this class yet.','muted'));
 for(const row of data.discussions){const details=el('details');details.append(el('summary',`${row.alias} · ${row.title} · ${row.kind}${row.hidden?' · Hidden':''}`),el('p',when(row.created_at),'muted'),el('pre',row.body));if(row.parent_id)details.append(el('p','Reply to post '+row.parent_id,'muted'));
  details.append(action(row.hidden?'Show post':'Hide post',async()=>{await api(`/activities/${row.activity_id}/posts/${row.id}/moderation`,'PUT',{hidden:!row.hidden});await refresh();}));
  if(!row.hidden){const form=el('form'),body=field(form,'Teacher reply','textarea','',{required:true,maxLength:3000,rows:3});formSave(form,'Post reply',()=>api(`/activities/${row.activity_id}/posts`,'POST',{parentId:row.id,body:body.value}));details.append(form);}node.append(details);
 }
}
function drawCommands(){
 const node=$('command-list');node.replaceChildren();if(!data.activities.length)node.append(el('p','Add an assignment first.','muted'));
 for(const item of data.activities){const details=el('details');details.append(el('summary',`${item.title} · ${item.command.paused?'Paused':'Accepting submissions'}`));const form=el('form'),paused=field(form,'Pause new submissions','checkbox',''),stage=field(form,'Stage','number',item.command.stage,{min:1,max:20,required:true}),hint=field(form,'Hint','textarea',item.command.hint,{maxLength:300,rows:2});paused.checked=!!item.command.paused;paused.parentElement.className='check';
  formSave(form,'Save controls',()=>api('/teacher/activities/'+item.id+'/command','PUT',{paused:paused.checked,stage:Number(stage.value),hint:hint.value,version:item.command.version}));details.append(form);node.append(details);
 }
}
$('class-select').onchange=async()=>{
 const next=$('class-select').value;if(dirty.size&&!confirm('Discard unsaved drafts and switch classes?')){$('class-select').value=classId;return;}
 dirty.clear();generation++;classId=next;data=null;for(const id of ['activity','assignment-list','submission-list','written-reviews','discussion-list','command-list','audit-list','stats'])$(id).replaceChildren();
 // An older request may still be finishing; its generation cannot render here.
 while(pending)await new Promise(resolve=>setTimeout(resolve,25));refresh().catch(error=>notice(error.message));
};
$('refresh').onclick=()=>run($('refresh'),async()=>{if(dirty.size&&!confirm('Discard unsaved drafts and refresh?'))return;dirty.clear();await refresh();});
$('export').onclick=()=>{if(classId)location.href=API+'/teacher/classes/'+encodeURIComponent(classId)+'/export';};
$('new-assignment').onsubmit=event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');run(button,async()=>{
 const selected=classId,fields=new FormData(form),templateId=fields.get('templateId'),points=Number(fields.get('points'));
 const result=await api('/classes/'+selected+'/activities','POST',{title:fields.get('title'),templateId});
 if(templateId==='scorm-connector-v1')await api('/platform/activities/'+result.id+'/config','PUT',{points});
 form.reset();dirty.delete(form);await refresh();notice('Assignment created. Configure its signed Schoology connection under Connections & setup.');
});};
async function start(){
 me=await api('/me');if(!me.user.teacher)throw Error('This workspace requires teacher access.');$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;$('identity').textContent=me.user.alias;
 const classes=me.classes.filter(item=>item.role==='teacher');$('class-select').replaceChildren(...classes.map(item=>new Option(item.title,item.id)));classId=classes[0]?.id||'';generation++;$('refresh').disabled=!classId;$('export').disabled=!classId;$('new-assignment').querySelector('button').disabled=!classId;
 if(classId)await refresh();else notice('No assigned classes yet. Open Manage classes & accounts to create a class.');
}
$('login-form').onsubmit=event=>{event.preventDefault();run(event.currentTarget.querySelector('button'),async()=>{try{const response=await fetch('/api/v1/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('username').value,password:$('password').value})});if(!response.ok)throw Error('Sign-in failed. Check your username and password.');await start();}finally{$('password').value='';}});};
$('logout').onclick=()=>run($('logout'),async()=>{if(dirty.size&&!confirm('Discard unsaved drafts and sign out?'))return;const response=await fetch('/api/v1/auth/logout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});if(!response.ok)throw Error('Sign-out was not confirmed. Try again.');dirty.clear();location.reload();});
setInterval(()=>{if(!document.hidden&&classId)refresh().catch(error=>notice(error.message));},8000);
start().catch(error=>notice(error.message));
