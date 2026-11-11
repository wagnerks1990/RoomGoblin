import {node,field,choices,detail,table} from './ui.mjs';
const campaignInput=c=>({id:c.id,title:c.title,classes:c.classes,targets:c.targets,enabled:c.enabled,dedicatedDisplay:c.dedicatedDisplay,leaderboardAnywhere:c.leaderboardAnywhere});

export function createClassroom(ui,host){
 let ctx=null,meta=null,roster=[],loading=null,refreshing=null,lastRefresh=0,campaignHost=null;
 async function load(next,{force=false}={}){
  if(!next.classId){host.replaceChildren(node('p','Create or select a class first.','muted'));return;}
  if(!force&&ctx===next)return;if([...ui.dirty].some(f=>host.contains(f)))return;
  const token={};loading=token;
  const [session,members,options,campaigns]=await Promise.allSettled([ui.api('/platform/classes/'+next.classId),ui.api('/classes/'+next.classId),ui.api('/platform/options'),ui.api('/platform/campaigns')]);
  ui.assert(next);if(loading!==token)return;loading=null;
  if(session.status!=='fulfilled')throw session.reason;
  ctx=next;meta=options.status==='fulfilled'?options.value.options:null;roster=members.status==='fulfilled'?members.value.members||[]:[];
  const opened=new Set([...host.querySelectorAll('details[open][data-key]')].map(d=>d.dataset.key));
  host.replaceChildren();sessionView(session.value,next);
  campaignHost=node('section',undefined,'card');campaignHost.id='campaigns';host.append(campaignHost);
  if(campaigns.status==='fulfilled')renderCampaigns(campaigns.value.campaigns,next);else campaignHost.append(node('h2','Arcade campaigns'),node('p','Campaigns could not refresh. Existing display ownership is unchanged.','muted'));
  recipes(session.value,next);
  const summary=node('section',undefined,'card');summary.append(node('h2','Saved progress'),node('p',`${session.value.summary.attempts} activity records · ${session.value.summary.completed} completed · ${session.value.summary.meanReportedPercent??'—'}% mean reported score.`));
  summary.append(ui.button('Suggest a teaching next step',async()=>{const result=await ui.api('/platform/classes/'+next.classId+'/insights','POST',{});ui.assert(next);output.replaceChildren(...['observation','nextStep','limitation'].map(k=>node('p',result.suggestion[k])));},{id:'insights'}));const output=node('div');output.id='insight';summary.append(output,node('p','Local summaries use aggregate progress only. Suggestions cannot change grades or operate equipment.','muted'));host.append(summary);for(const d of host.querySelectorAll('details[data-key]'))if(opened.has(d.dataset.key))d.open=true;lastRefresh=Date.now();
 }
 function sessionView(data,selected){
  const box=node('section',undefined,'card');box.id='live-session';const title=node('h2');title.id='session-label';box.append(title);
  const info=node('p');info.id='session-detail';box.append(info);
  const manual=node('form');manual.id='manual-session';const minutes=field(manual,'Session minutes','number',60,{min:1,max:180,required:true,id:'minutes'});
  const start=ui.save(manual,'Start classroom session',async()=>{await ui.api('/platform/classes/'+selected.classId+'/start','POST',{minutes:Number(minutes.value)});ui.dirty.delete(manual);await refresh({force:true});},selected,{refresh:false});start.id='start';box.append(manual);
  const buttons=node('div',undefined,'actions'),stop=ui.button('Stop effects',async()=>{await ui.api('/platform/classes/'+selected.classId+'/stop','POST',{});await refresh({force:true});},{id:'stop'}),resume=ui.button('Resume automatic mode',async()=>{await ui.api('/platform/classes/'+selected.classId+'/resume','POST',{});await refresh({force:true});},{id:'resume-automatic'});buttons.append(stop,resume);box.append(buttons);
  const attendance=node('form');attendance.id='manual-attendance';const choicesHost=node('div');choicesHost.id='attendance';attendance.append(choicesHost);
  const save=ui.save(attendance,'Save attendance',async()=>{await ui.api('/platform/classes/'+selected.classId+'/attendance','PUT',{userIds:[...choicesHost.querySelectorAll('input:checked')].map(i=>i.value)});ui.dirty.delete(attendance);await refresh({force:true});},selected,{refresh:false});save.id='save-attendance';attendance.append(node('p','Attendance and fresh classroom presence are required for manual classroom effects.','muted'));box.append(attendance);
  const automatic=node('p');automatic.id='automatic-attendance';box.append(automatic);
  const board=node('div');board.id='board';box.append(node('h3','Live classroom leaderboard'),board);host.append(box);updateSession(data,selected);
 }
 function updateSession(data,selected){
  const auto=data.automation||{},session=data.session,find=id=>host.querySelector('#'+id);
  find('session-label').textContent=auto.automatic?(auto.paused?'Paused for today':session?'Automatic classroom session':'Waiting for scheduled class'):session?'Classroom session active':'Effects are off';
  find('session-detail').textContent=auto.automatic?(auto.paused?'Resumes automatically on the next school day.':session?'Ends '+new Date(session.expires_at).toLocaleTimeString()+'. Signed learners join after a fresh classroom network check.':auto.reason||'Waiting for the mapped class.'):session?'Ends '+new Date(session.expires_at).toLocaleTimeString()+'.':'Work can save normally. Start a session only for learners physically present.';
  find('manual-session').hidden=!!auto.automatic;find('manual-attendance').hidden=!!auto.automatic;find('automatic-attendance').hidden=!auto.automatic;
  find('automatic-attendance').textContent=data.attending.length+' learner(s) verified. Students enroll through signed Schoology launches; each classroom event needs fresh local presence.';
  find('stop').textContent=auto.automatic?'Pause this class today':'Stop effects';find('stop').disabled=auto.automatic?auto.paused:!session;find('resume-automatic').hidden=!auto.automatic||!auto.paused;
  const attendance=find('manual-attendance');
  if(!ui.dirty.has(attendance)&&!attendance.contains(document.activeElement)){
   const target=find('attendance');target.replaceChildren();for(const m of roster.filter(m=>m.role==='student'))field(target,m.alias,'checkbox',data.attending.includes(m.user_id),{value:m.user_id,disabled:!session});
  }
  find('save-attendance').disabled=!session;
  const board=find('board');board.replaceChildren(table(data.board,[['Learner',r=>r.firstName],['Assignment',r=>r.activityTitle],['Progress',r=>Number.isFinite(r.earned)?r.earned+' / '+r.possible:(r.current||0)+' / '+(r.total||0)+' steps']], 'No verified classroom progress yet.'));
 }
 async function refresh({force=false}={}){
  const selected=ctx;if(!selected||!ui.owned(selected)||(!force&&Date.now()-lastRefresh<14000))return;
  if(loading||refreshing)return;const token={};refreshing=token;try{const data=await ui.api('/platform/classes/'+selected.classId);ui.assert(selected);if(refreshing!==token)return;updateSession(data,selected);lastRefresh=Date.now();}finally{if(refreshing===token)refreshing=null;}
 }
 function recipes(data,selected){
  const box=node('section',undefined,'card'),d=detail('Classroom celebrations','celebrations');box.append(d);host.append(box);
  d.append(node('p','Effects need approved targets, an active classroom session and fresh presence. Announcements retain priority except on an explicitly dedicated arcade display.','muted'));
  for(const recipe of data.recipes){const row=node('div',undefined,'member-row');row.append(node('span',recipe.label+' · '+(recipe.config.enabled?'Enabled':'Off')),ui.button(recipe.config.enabled?'Disable celebration':'Enable celebration',async()=>{await ui.api(`/platform/classes/${selected.classId}/recipes`,'POST',{id:recipe.id,label:recipe.label,eventKind:recipe.event_kind,actions:recipe.config.actions,enabled:!recipe.config.enabled});await load(selected,{force:true});}));d.append(row);}
  if(!meta){d.append(node('p','Target options are unavailable. Existing celebrations are unchanged.','muted'));return;}
  const f=node('form');f.id='recipe';const label=field(f,'Celebration name','text','Mission complete',{required:true,maxLength:80,id:'recipe-label'}),event=field(f,'When','select','',{id:'event-kind'}),kind=field(f,'Effect','select','',{id:'effect-kind'}),target=field(f,'Target','select','',{required:true,id:'target'}),asset=field(f,'Approved media','select','',{id:'asset'}),color=field(f,'Light color','color','#0f766e',{id:'color'}),volume=field(f,'Volume percent','number',20,{min:0,max:35,id:'volume'}),enabled=field(f,'Use this celebration automatically','checkbox',false,{id:'recipe-enabled'});
  choices(event,[{id:'completed',label:'Assignment completed'},{id:'score',label:'Score saved'},{id:'progress',label:'Progress saved'}]);choices(kind,[{id:'leaderboard',label:'Leaderboard'},{id:'image',label:'Image'},{id:'video',label:'Video clip'},{id:'sound',label:'Sound'},{id:'lights',label:'Static light color'}]);
  const change=()=>{choices(target,[{id:'',label:'Choose a target'},...(kind.value==='lights'?meta.lights:meta.displays)]);choices(asset,meta.assets.filter(a=>a.kind===kind.value));asset.parentElement.hidden=!['image','video','sound'].includes(kind.value);asset.required=!asset.parentElement.hidden;color.parentElement.hidden=kind.value!=='lights';volume.parentElement.hidden=!['video','sound'].includes(kind.value);};kind.onchange=change;change();
  ui.save(f,'Save celebration',async()=>{const action={kind:kind.value,targets:[target.value]};if(kind.value==='lights')action.color=color.value;if(['image','video','sound'].includes(kind.value))action.assetId=asset.value;if(['video','sound'].includes(kind.value))action.volume=Number(volume.value)/100;await ui.api(`/platform/classes/${selected.classId}/recipes`,'POST',{label:label.value,eventKind:event.value,enabled:enabled.checked,actions:[action]});ui.dirty.delete(f);await load(selected,{force:true});},selected,{refresh:false});d.append(f,node('p',data.recentEffects.length?'Recent outcomes: '+data.recentEffects.map(x=>x.status).join(', '):'No effects dispatched in this session.','muted'));
 }
 function renderCampaigns(campaigns,selected){
  const box=campaignHost;box.replaceChildren(node('h2','Arcade campaigns for this class'));
  const matching=campaigns.filter(c=>c.classes.some(x=>x.classId===selected.classId));
  if(!matching.length)box.append(node('p','No continuing campaign is linked to this class.','muted'));
  for(const c of matching){
   const d=detail(c.title,'campaign:'+c.id);d.append(node('p',c.classes.map(x=>x.label).join(' / ')+' · '+(c.enabled?'Board enabled':'Board off')));
   const board=node('div',undefined,'tablewrap');board.append(table(c.board,[['Learner',r=>r.firstName],['Period',r=>r.period],['Arcade points',r=>r.arcadeScore],['Progress',r=>'Level '+r.level+', board '+r.board+' · '+r.completed+'/'+r.assignments]]));d.append(board);
   const f=node('form'),enabled=field(f,'Enable this board','checkbox',c.enabled),anywhere=field(f,'Accept signed leaderboard updates from any location','checkbox',c.leaderboardAnywhere===true),dedicated=field(f,'Dedicate this display to scheduled class standings','checkbox',c.dedicatedDisplay===true);
   f.append(node('p','A dedicated display excludes other content, presentations, music and Morning Announcements. Disable dedication to restore ordinary use. Remote arcade updates do not authorize attendance or room effects.','privacy'));
   ui.save(f,'Save campaign settings',async()=>{await ui.api('/platform/campaigns','POST',{...campaignInput(c),enabled:enabled.checked,leaderboardAnywhere:anywhere.checked,dedicatedDisplay:dedicated.checked});ui.dirty.delete(f);await load(selected,{force:true});},selected,{refresh:false});d.append(f);box.append(d);
  }
  if(!meta)return;
  const d=detail('Create a continuing campaign','new-campaign'),f=node('form'),title=field(f,'Campaign name','text','',{required:true,maxLength:100}),checks=[];
  for(const c of selected.classes){const row=node('div',undefined,'campaign-class'),check=field(row,c.title,'checkbox',c.id===selected.classId),label=field(row,c.title+' period label','text','',{maxLength:30,placeholder:'Short period label'});checks.push({c,check,label});f.append(row);}
  const target=field(f,'Board display','select','',{required:true}),enabled=field(f,'Enable the classroom board','checkbox',false);choices(target,[{id:'',label:'Choose a display'},...meta.displays]);
  f.append(node('p','Choose the classes that share this campaign. Saved game checkpoints continue across linked assignments; academic grades never appear on this board.','muted'));
  ui.save(f,'Create campaign',async()=>{await ui.api('/platform/campaigns','POST',{title:title.value,classes:checks.filter(x=>x.check.checked).map(x=>({classId:x.c.id,label:x.label.value||x.c.title})),targets:[target.value],enabled:enabled.checked});ui.dirty.delete(f);await load(selected,{force:true});},selected,{refresh:false});d.append(f);box.append(d);
 }
 return {load,refresh,reset(){ctx=null;meta=null;loading=null;refreshing=null;host.replaceChildren();}};
}
