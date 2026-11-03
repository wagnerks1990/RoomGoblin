'use strict';
// Teacher-only setup. The student SDK cannot choose its class or campaign.
async function loadCampaigns(){
 const {campaigns}=await api('/platform/campaigns'),host=$('campaigns');host.replaceChildren();
 for(const c of campaigns){
  const row=el('div');row.className='connection';row.append(el('h3',c.title),el('p',c.classes.map(x=>x.label).join(' / ')+' · '+(c.enabled?'Board enabled':'Board off')));
  const board=el('ol');for(const r of c.board)board.append(el('li',r.firstName+' · '+r.period+' · '+r.arcadeScore+' arcade points · level '+r.level+', board '+r.board+' · '+r.completed+'/'+r.assignments+' assignments'));
  row.append(board,btn(c.enabled?'Disable board':'Enable board',async()=>{await api('/platform/campaigns','POST',{...c,enabled:!c.enabled});await loadCampaigns();}));
  if(activityId&&c.classes.some(x=>x.classId===classId))row.append(btn('Link selected assignment',async()=>{await api('/platform/campaigns/'+c.id+'/activities/'+activityId,'PUT',{});notice('Selected assignment now continues this campaign.');}));
  host.append(row);
 }
 const form=el('form'),titleLabel=el('label','Campaign name'),title=el('input');title.required=true;title.maxLength=100;title.placeholder='IT1 continuing arcade';titleLabel.append(title);form.append(titleLabel);
 const checks=[];for(const c of me.classes.filter(c=>c.role==='teacher')){const l=el('label',c.title),check=el('input'),label=el('input');l.className='check';check.type='checkbox';label.placeholder='Short period label';label.maxLength=30;label.setAttribute('aria-label',c.title+' period label');l.prepend(check);l.append(label);form.append(l);checks.push({c,check,label});}
 const targetLabel=el('label','Board display'),target=el('select');choose(target,options.displays);targetLabel.append(target);form.append(targetLabel,el('p','Choose only the classes that share this campaign. Saved arcade scores and game checkpoints continue across linked assignments. Academic grades never appear on this board. The display runs only during an active session for one of these classes.'));
 const enabledLabel=el('label','Enable the classroom board'),enabled=el('input');enabled.type='checkbox';enabledLabel.className='check';enabledLabel.prepend(enabled);form.append(enabledLabel,el('button','Create campaign'));
 form.onsubmit=task(async()=>{await api('/platform/campaigns','POST',{title:title.value,classes:checks.filter(x=>x.check.checked).map(x=>({classId:x.c.id,label:x.label.value||x.c.title})),targets:target.value?[target.value]:[],enabled:enabled.checked});await loadCampaigns();notice('Campaign saved. Configure an assignment, then link it to this campaign.');});
 const detail=el('details');detail.append(el('summary','Create a continuing campaign'),form);host.append(detail);
}
