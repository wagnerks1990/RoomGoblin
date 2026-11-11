import {node,field,choices,detail} from './ui.mjs';
const lines=input=>input.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
export function createSetup(ui,host){
 let ctx=null,request=null;
 async function load(next,{force=false}={}){
  if(!next.me.user.admin)return;if(!force&&ctx===next)return;if([...ui.dirty].some(f=>host.contains(f)))return;
  const token={};request=token;
  const results=await Promise.allSettled(['/platform/settings','/platform/schedule','/settings','/platform/tools'].map(path=>ui.api(path)));
  ui.assert(next);if(request!==token)return;ctx=next;host.replaceChildren();
  const sections=[connection,schedule,grading,tools];
  for(let i=0;i<results.length;i++){
   const result=results[i];if(result.status==='fulfilled')sections[i](result.value,next);
   else{const box=node('section',undefined,'card');box.append(node('h2',['Schoology connection','Timetable setup','Grading service','AI tool links'][i]),node('p','This setting could not be loaded. Existing configuration is unchanged.'),ui.button('Retry setup',()=>load(next,{force:true})));host.append(box);}
  }
 }
 function connection({settings},selected){
  const box=node('section',undefined,'card');box.append(node('h2','Schoology connection'),node('p','The student connection is separate from this protected teacher workspace.'));
  const f=node('form');f.id='settings';
  const origin=field(f,'Student HTTPS origin','url',settings.publicOrigin,{id:'public-origin'}),presence=field(f,'Local presence origin','url',settings.presenceOrigin,{id:'presence-origin'}),networks=field(f,'Classroom networks · one per line','textarea',settings.classroomNetworks.join('\n'),{id:'networks',rows:3}),origins=field(f,'Approved Schoology and SCORM origins · one per line','textarea',selected.me.bridgeOrigins.join('\n'),{id:'bridge-origins',rows:3}),confirmed=field(f,'I verified these networks identify this classroom','checkbox',settings.networksConfirmed,{id:'networks-confirmed'}),enabled=field(f,'Enable the isolated student connection','checkbox',settings.publicEnabled,{id:'public-enabled'}),embedded=field(f,'Allow signed connections inside approved Schoology frames','checkbox',settings.embeddedEnabled,{id:'embedded-enabled'}),insights=field(f,'Enable teacher-requested local summaries','checkbox',settings.insightsEnabled,{id:'insights-enabled'});
  ui.save(f,'Save connection settings',async()=>{const result=await ui.api('/teacher/connection-settings','PUT',{settings:{publicOrigin:origin.value,presenceOrigin:presence.value,classroomNetworks:lines(networks),networksConfirmed:confirmed.checked,publicEnabled:enabled.checked,embeddedEnabled:embedded.checked,insightsEnabled:insights.checked},origins:lines(origins)});selected.connectionOrigin=result.settings.publicOrigin;selected.me.bridgeOrigins=result.origins;},selected,{refresh:false});
  box.append(f,ui.button('Publish student connection',async()=>{if([...ui.dirty].some(form=>box.contains(form)))throw Error('Save your connection settings before publishing.');const result=await ui.api('/platform/publish','POST',{});ui.assert(selected);ui.notice('Student connection published at '+result.origin+'.');},{id:'publish'}),node('p','Publishing keeps the administrator Access policy. Teacher pages, room controls and AI services remain unavailable through the student listener.','muted'));host.append(box);
 }
 function schedule({schedule},selected){
  const box=node('section',undefined,'card');box.append(node('h2','Automatic classroom setup'));
  const f=node('form');f.id='schedule-settings';const enabled=field(f,'Sync classes and follow the RoomGoblin timetable','checkbox',schedule.enabled,{id:'schedule-enabled',disabled:!schedule.available});
  const status=node('p',schedule.available?(schedule.enabled?'Automatic mode is configured.':'Automatic mode is off. Manual sessions remain available.'):schedule.reason,'muted');status.id='schedule-status';f.append(status);
  const d=detail('Class mappings','schedule-mappings-detail'),mappings=node('div');mappings.id='schedule-mappings';
  for(const source of schedule.classes){const select=field(mappings,source.title+(source.enabled?'':' · disabled in Planning'),'select');select.dataset.scheduleId=source.id;choices(select,[{id:'',label:'Import automatically'},...selected.classes.map(c=>({id:c.id,label:c.title}))],schedule.links.find(l=>l.scheduleId===source.id)?.classId||'');}
  d.append(node('p','Link existing learning classes before importing new ones. Mapping changes do not delete assignments, students or saved work.','muted'),mappings);f.append(d);
  const button=ui.save(f,'Save automatic setup',async()=>{await ui.api('/platform/schedule','PUT',{enabled:enabled.checked,links:[...mappings.querySelectorAll('select')].map(s=>({scheduleId:s.dataset.scheduleId,classId:s.value}))});ui.dirty.delete(f);await ui.onCatalog();await load(selected,{force:true});},selected,{refresh:false});button.id='schedule-save';button.disabled=!schedule.available;box.append(f);host.append(box);
 }
 function grading(saved,selected){
  const box=node('section',undefined,'card'),d=detail('Automatic writing feedback & grading service','grading-service');box.append(d);
  const f=node('form'),enabled=field(f,'Enable the grading service','checkbox',saved.ai.enabled===true),autonomous=field(f,'Publish grades and replies automatically','checkbox',saved.ai.autonomous!==false),label=field(f,'Public response name','text',saved.responseLabel||'Teacher',{required:true,maxLength:40}),provider=field(f,'Provider','select'),endpoint=field(f,'Local service endpoint','url',saved.ai.baseURL||'http://127.0.0.1:11434/api'),model=field(f,'Exact model ID','text',saved.ai.model||'',{required:true,maxLength:150}),key=field(f,'API key · blank keeps the saved value','password','',{autoComplete:'new-password',maxLength:500}),limit=field(f,'Daily grading limit','number',saved.ai.dailyLimit||100,{required:true,min:1,max:1000});
  choices(provider,[{id:'ollama',label:'Ollama'},{id:'local',label:'Local compatible API'},{id:'openai',label:'OpenAI'}],saved.ai.provider||'ollama');
  const change=()=>{endpoint.disabled=provider.value==='openai';endpoint.required=!endpoint.disabled;};provider.onchange=change;change();
  d.append(node('p','Enable automatic publication only after rubric calibration. Students’ writing is sent to the configured provider; teacher review remains available.','muted'));
  ui.save(f,'Save grading service',async()=>{try{await ui.api('/settings','PUT',{enabled:enabled.checked,autonomous:autonomous.checked,responseLabel:label.value,provider:provider.value,baseURL:endpoint.value,model:model.value,apiKey:key.value,dailyLimit:Number(limit.value)});}finally{key.value='';}},selected,{refresh:false});d.append(f);host.append(box);
 }
 function tools({tools},selected){
  const box=node('section',undefined,'card'),d=detail('AI chat and media shortcuts','tool-links'),f=node('form');f.id='tool-settings';
  const ai=field(f,'AI chat HTTPS URL','url',tools.aiChatUrl,{id:'ai-chat-url',maxLength:2048}),media=field(f,'Images and media HTTPS URL','url',tools.mediaStudioUrl,{id:'media-studio-url',maxLength:2048});
  d.append(node('p','Optional shortcuts open each service with its own sign-in. Leave an address blank to hide its link.','muted'));
  ui.save(f,'Save AI tool links',async()=>{const result=await ui.api('/platform/tools','PUT',{aiChatUrl:ai.value,mediaStudioUrl:media.value});ui.onTools(result.tools);},selected,{refresh:false});d.append(f);box.append(d);host.append(box);
 }
 return {load,reset(){ctx=null;request=null;host.replaceChildren();}};
}
