import {node,field,choices,detail} from './ui.mjs';
const lines=input=>input.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const localDate=value=>{if(!value)return '';const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const iso=value=>value?new Date(value).toISOString():null;

export function createAssignments(ui,host,createHost){
 let ctx=null;
 function render(data,next,{force=false}={}){
  const changed=ctx!==next;ctx=next;
  ui.draw(host,[next.classId,data.activities],()=>{
   host.replaceChildren();if(!data.activities.length)host.append(node('p','No assignments yet. Add one below.','muted'));
   for(const item of data.activities){
    const card=detail(item.title,'assignment:'+item.id);card.className='assignment-card';
    card.append(node('p',`${item.template_id==='scorm-connector-v1'?'SCORM connection':'Written discussion'} · ${item.points||20} points · ${item.open?'Open':'Closed'}`,'muted'));
    const instructions=next.me.cases.find(c=>c.id===item.template_id);if(instructions)card.append(node('p',instructions.prompt));
    const availability=node('form'),open=field(availability,'Accept student work','checkbox',!!item.open),due=field(availability,'Due time · '+Intl.DateTimeFormat().resolvedOptions().timeZone,'datetime-local',localDate(item.due_at)),close=field(availability,'Close time · optional','datetime-local',localDate(item.close_at));
    ui.save(availability,'Save availability',()=>ui.api('/activities/'+item.id,'PUT',{open:open.checked,dueAt:iso(due.value),closeAt:iso(close.value)}),next);card.append(availability);
    const controls=detail('Pause, hint & stage','command:'+item.id),form=node('form'),paused=field(form,'Pause new submissions','checkbox',!!item.command.paused),stage=field(form,'Stage','number',item.command.stage,{min:1,max:20,required:true}),hint=field(form,'Hint','textarea',item.command.hint,{maxLength:300,rows:2});
    controls.append(node('p','Pause is enforced by RoomGoblin. Hints and stages appear in assignments that support teacher controls.','muted'));
    ui.save(form,'Save activity controls',async()=>{const result=await ui.api('/teacher/activities/'+item.id+'/command','PUT',{version:item.command.version,paused:paused.checked,stage:Number(stage.value),hint:hint.value});item.command=result.command;},next);controls.append(form);card.append(controls);
    card.append(ui.button(item.template_id==='scorm-connector-v1'?'Download direct API starter':'Download direct API assignment',()=>download(item,next)),node('p','Learners connect automatically through the assignment API. No separate login, roster approval or companion window.','muted'));
    if(item.directEnabled)card.append(ui.button('Disable direct API access',()=>ui.api('/teacher/activities/'+item.id+'/direct-settings','PUT',{enabled:false}).then(()=>ui.onSaved(next))));
    if(item.template_id==='scorm-connector-v1')card.append(ui.button('AI grading rubric',()=>rubric(item,card,next)));
    const configHost=node('div');card.append(ui.button('Points & grading settings',async()=>{await configure(item,configHost,next);}),configHost);host.append(card);
   }
  },{force});
  if(changed||!createHost.childElementCount)create(next);
 }
 function create(selected){
  createHost.replaceChildren();const form=node('form');form.id='new-assignment';
  const title=field(form,'Assignment title','text','',{name:'title',required:true,maxLength:120}),type=field(form,'Assignment type','select','',{name:'templateId'}),points=field(form,'Possible points','number',50,{name:'points',min:1,max:1000,required:true});
  choices(type,[{id:'scorm-connector-v1',label:'SCORM assignment connection'},...selected.me.cases.map(c=>({id:c.id,label:c.title}))]);
  type.onchange=()=>{const written=type.value!=='scorm-connector-v1';points.disabled=written;if(written)points.value='20';};
  form.append(node('p','Use one connection for each assignment. Keep the original assignment and gradebook in Schoology.','muted'));
  const save=ui.save(form,'Create assignment',async()=>{const result=await ui.api(`/teacher/classes/${selected.classId}/assignments`,'POST',{title:title.value,templateId:type.value,points:Number(points.value)});form.reset();type.onchange();await ui.onCatalog();ui.notice('Assignment created. Open its Points & grading settings to finish setup.');return result;},selected);
  save.disabled=!selected.classId;createHost.append(form);
 }
 async function download(activity,selected){
  const r=await fetch('/api/v1/learning/teacher/activities/'+activity.id+'/direct-package',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-roomgoblin-learning':'1'},body:'{}',signal:AbortSignal.timeout(60000)});ui.assert(selected);
  if(!r.ok){let message='Assignment package could not be downloaded.';try{message=(await r.json()).error||message;}catch{}throw Error(message);}
  const blob=await r.blob();ui.assert(selected);const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='RoomGoblin-Direct-Assignment.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);ui.notice('API package downloaded. Upload it as SCORM in your LMS. Existing games can include its config.js and connector SDK.');
 }
 async function rubric(activity,card,selected){
  if(card.querySelector('[data-ai-policy]'))return;
  const result=await ui.api('/teacher/activities/'+activity.id+'/ai-policy');ui.assert(selected);if(!card.isConnected)return;
  const policy=result.policy,d=detail('AI assignment grading','ai-policy:'+activity.id);d.dataset.aiPolicy='1';d.open=true;
  const f=node('form'),enabled=field(f,'Grade submitted written evidence automatically','checkbox',policy.enabled),prompt=field(f,'Assignment instructions','textarea',policy.prompt||'',{maxLength:3000,rows:4});
  const rows=node('div'),editors=[];
  const add=criterion=>{const line=node('fieldset'),label=field(line,'Criterion name','text',criterion.label||'',{maxLength:100}),points=field(line,'Criterion possible points','number',criterion.points||1,{min:1,max:1000}),description=field(line,'Evidence required for these points','textarea',criterion.description||'',{maxLength:1000,rows:3});const entry={line,label,points,description};editors.push(entry);line.append(ui.button('Remove criterion',()=>{editors.splice(editors.indexOf(entry),1);line.remove();ui.dirty.add(f);}));rows.append(line);};
  for(const criterion of policy.criteria.length?policy.criteria:[{label:'Assignment evidence',points:activity.points||50,description:''}])add(criterion);
  f.append(rows,ui.button('Add criterion',()=>{if(editors.length>=8)throw Error('Use up to eight rubric criteria.');add({});ui.dirty.add(f);}));
  f.append(node('p','Rubric points must equal assignment possible points. Uses the configured server-side AI service and its automatic-publication policy. Student reports never set their AI grade.','muted'));
  ui.save(f,'Save AI grading rubric',()=>ui.api('/teacher/activities/'+activity.id+'/ai-policy','PUT',{enabled:enabled.checked,prompt:prompt.value,criteria:editors.map(x=>({label:x.label.value,points:Number(x.points.value),description:x.description.value}))}),selected);d.append(f);card.append(d);
 }
 async function configure(activity,box,selected){
  const [connection,policy,roster,campaigns]=await Promise.all([
   ui.api(`/platform/activities/${activity.id}/config`),
   ui.api(`/platform/activities/${activity.id}/grade-policy`),ui.api('/classes/'+selected.classId),
   activity.template_id==='scorm-connector-v1'?ui.api('/platform/campaigns'):Promise.resolve({campaigns:[]})
  ]);ui.assert(selected);if(!box.isConnected)return;
  if([...ui.dirty].some(f=>box.contains(f))&&!confirm('Discard unsaved connection changes?'))return;
  for(const f of box.querySelectorAll('form'))ui.dirty.delete(f);box.replaceChildren();
  const cfg=connection.config,form=node('form'),points=field(form,'Possible points','number',cfg?.points||(activity.template_id==='scorm-connector-v1'?50:20),{min:1,max:1000,required:true});
  points.readOnly=activity.template_id!=='scorm-connector-v1';
  form.append(node('p','Possible points become fixed after the first saved progress event.','muted'));
  ui.save(form,'Save assignment points',()=>ui.api(`/platform/activities/${activity.id}/config`,'PUT',{points:Number(points.value),launchUrl:''}),selected);box.append(form);
  const developer=detail('For assignment authors','sdk:'+activity.id);developer.append(node('p','Include the connector in a configured copy of your existing assignment.'));
  developer.append(node('p','For direct API reporting, download the API starter above and include its config.js and roomgoblin-scorm.js before your game scripts. The assignment enrollment key is registration-only; each learner receives a separate private data token.','muted'));
  const sdk=node('a','Download SCORM connector');sdk.href='/learn/sdk/roomgoblin-scorm.js';developer.append(sdk);box.append(developer);
  grading(activity,policy.policy,roster.members||[],box,selected);
  const matching=campaigns.campaigns.filter(c=>c.classes.some(x=>x.classId===selected.classId));
  if(matching.length){const f=node('form'),select=field(f,'Continuing arcade campaign','select');choices(select,matching.map(c=>({id:c.id,label:c.title})));ui.save(f,'Link assignment to campaign',()=>ui.api(`/platform/campaigns/${select.value}/activities/${activity.id}`,'PUT',{}),selected);box.append(f);}
 }
 function grading(activity,policy,roster,box,selected){
  const d=detail('Date-based assessment credit & exceptions','policy:'+activity.id),f=node('form');
  const enabled=field(f,'Use date-based assessment credit','checkbox',!!policy?.enabled),date=field(f,'Assignment date','date',policy?.assignmentDate||'',{required:true}),zone=field(f,'School time zone','text',policy?.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone,{required:true});
  d.append(node('p','Full credit on the class date, half the next day, zero starting day two. Higher earlier awards stay protected. This does not grade written reasoning.','muted'));
  ui.save(f,'Save assessment policy',()=>ui.api(`/platform/activities/${activity.id}/grade-policy`,'PUT',{enabled:enabled.checked,assignmentDate:date.value,timeZone:zone.value}),selected);d.append(f);
  const students=roster.filter(m=>m.role==='student');
  if(students.length){const ef=node('form'),student=field(ef,'Student exception','select'),until=field(ef,'Full-credit date for this student','date','',{required:true}),reason=field(ef,'Exception reason','text','',{maxLength:500,required:true});choices(student,students.map(m=>({id:m.user_id,label:m.alias})));
   ui.save(ef,'Save student exception',()=>ui.api(`/platform/activities/${activity.id}/grade-override`,'PUT',{userId:student.value,creditDate:until.value,reason:reason.value}),selected);
   ef.append(ui.button('Remove selected exception',()=>ui.api(`/platform/activities/${activity.id}/grade-override`,'PUT',{userId:student.value,creditDate:null})));d.append(ef);
  }
  const restore=detail('Advanced: restore documented grades','restore:'+activity.id),rf=node('form'),json=field(rf,'Verified private grade backup JSON','textarea','',{required:true,rows:4});restore.append(node('p','Restoration only raises retained awards and records the backup fingerprint. It cannot restore student writing.','muted'));
  ui.save(rf,'Restore documented grades',async()=>{await ui.api(`/platform/activities/${activity.id}/grade-restore`,'POST',JSON.parse(json.value));json.value='';},selected);restore.append(rf);d.append(restore);box.append(d);
 }
 return {render,reset(){ctx=null;host.replaceChildren();createHost.replaceChildren();}};
}
