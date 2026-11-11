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
    const configHost=node('div');card.append(ui.button('Connection & grading settings',async()=>{await configure(item,configHost,next);}),configHost);host.append(card);
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
  const save=ui.save(form,'Create assignment',async()=>{const result=await ui.api(`/teacher/classes/${selected.classId}/assignments`,'POST',{title:title.value,templateId:type.value,points:Number(points.value)});form.reset();type.onchange();await ui.onCatalog();ui.notice('Assignment created. Open its Connection & grading settings to finish setup.');return result;},selected);
  save.disabled=!selected.classId;createHost.append(form);
 }
 async function configure(activity,box,selected){
  const [connection,lms,policy,roster,settings,campaigns]=await Promise.all([
   ui.api(`/platform/activities/${activity.id}/config`),selected.me.user.admin?ui.api(`/activities/${activity.id}/lti`):Promise.resolve(null),
   ui.api(`/platform/activities/${activity.id}/grade-policy`),ui.api('/classes/'+selected.classId),
   selected.me.user.admin?ui.api('/platform/settings'):Promise.resolve({settings:{publicOrigin:selected.connectionOrigin||''}}),
   activity.template_id==='scorm-connector-v1'?ui.api('/platform/campaigns'):Promise.resolve({campaigns:[]})
  ]);ui.assert(selected);if(!box.isConnected)return;
  if([...ui.dirty].some(f=>box.contains(f))&&!confirm('Discard unsaved connection changes?'))return;
  for(const f of box.querySelectorAll('form'))ui.dirty.delete(f);box.replaceChildren();
  const cfg=connection.config,form=node('form'),url=field(form,'Schoology ungraded External Tool material URL','url',cfg?.launch_url||'',{maxLength:1500}),points=field(form,'Possible points','number',cfg?.points||(activity.template_id==='scorm-connector-v1'?50:20),{min:1,max:1000,required:true});
  points.readOnly=activity.template_id!=='scorm-connector-v1';
  form.append(node('p','Possible points become fixed after the first saved progress event.','muted'));
  ui.save(form,'Save assignment connection',()=>ui.api(`/platform/activities/${activity.id}/config`,'PUT',{points:Number(points.value),launchUrl:url.value}),selected);box.append(form);
  const downloads=node('div',undefined,'actions');
  const cartridge=node('a',activity.template_id==='scorm-connector-v1'?'Download ungraded identity connection':'Download Schoology discussion tool');cartridge.href=`/api/v1/learning/activities/${activity.id}/lti-package`;downloads.append(cartridge);
  if(activity.template_id!=='scorm-connector-v1'){const scorm=node('a','Download written SCORM launcher');scorm.href=`/api/v1/learning/activities/${activity.id}/scorm`;downloads.append(scorm);}box.append(downloads);
  if(lms)provider(activity,lms.settings,settings.settings,box,selected);
  const developer=detail('For assignment authors','sdk:'+activity.id);developer.append(node('p','Include the connector in a configured copy of your existing assignment. No password or shared secret belongs in a package.'));
  developer.append(node('pre','window.ROOMGOBLIN_SCORM = '+JSON.stringify({origin:settings.settings.publicOrigin||'https://learn.example.org',activityId:activity.id},null,2)+';'));
  const sdk=node('a','Download SCORM connector');sdk.href='/learn/sdk/roomgoblin-scorm.js';developer.append(sdk);box.append(developer);
  grading(activity,policy.policy,roster.members||[],box,selected);
  const matching=campaigns.campaigns.filter(c=>c.classes.some(x=>x.classId===selected.classId));
  if(matching.length){const f=node('form'),select=field(f,'Continuing arcade campaign','select');choices(select,matching.map(c=>({id:c.id,label:c.title})));ui.save(f,'Link assignment to campaign',()=>ui.api(`/platform/campaigns/${select.value}/activities/${activity.id}`,'PUT',{}),selected);box.append(f);}
 }
 function provider(activity,lti,settings,box,selected){
  const d=detail('Signed Schoology provider · administrator','provider:'+activity.id),f=node('form');
  const app=field(f,'Student HTTPS origin','url',lti.appOrigin||settings.publicOrigin||'',{required:true}),platform=field(f,'Schoology origin','url',lti.platformOrigin||'',{required:true}),key=field(f,'Consumer key','text',lti.consumerKey||'',{required:true,maxLength:120}),secret=field(f,'Shared secret · blank keeps the saved value','password','',{autoComplete:'new-password',maxLength:512}),origins=field(f,'Approved HTTPS grade-service origins · one per line','textarea',(lti.outcomeOrigins||[]).join('\n'),{rows:3}),enabled=field(f,'Enable signed launches','checkbox',!!lti.enabled);
  d.append(node('p',lti.bound?'Schoology course and material are bound.':'Configure the matching Schoology provider, then launch once as the teacher.'),node('p',lti.secretConfigured?'A shared secret is saved. Its value is never returned.':'No shared secret is saved.','muted'));
  if(lti.observedOutcomeOrigins?.length)d.append(node('p','Observed signed grade services: '+lti.observedOutcomeOrigins.join(', '),'muted'));
  ui.save(f,'Save signed provider',async()=>{try{await ui.api(`/activities/${activity.id}/lti`,'PUT',{appOrigin:app.value,platformOrigin:platform.value,consumerKey:key.value,sharedSecret:secret.value,outcomeOrigins:lines(origins),enabled:enabled.checked});}finally{secret.value='';}},selected);d.append(f);box.append(d);
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
