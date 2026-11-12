import {node,field,choices} from './ui.mjs';

export function createManagement(ui,host){
 let ctx=null,loading=null;
 async function load(next,{force=false}={}){
  if(!force&&ctx===next)return;if([...ui.dirty].some(f=>host.contains(f)))return;
  const selected=next,token={};loading=token;
  const [roster,accounts]=await Promise.all([next.classId?ui.api('/classes/'+next.classId):Promise.resolve({members:[]}),next.me.user.admin?ui.api('/accounts'):Promise.resolve(null)]);
  ui.assert(selected);if(loading!==token)return;ctx=selected;
  host.replaceChildren(node('p','Participants register automatically when their direct API assignment first reports data.','muted'));
  const create=node('section',undefined,'card');create.append(node('h2','Create a class'));
  const cf=node('form'),title=field(cf,'Class title','text','',{required:true,maxLength:100});
  ui.save(cf,'Create class',async()=>{const result=await ui.api('/classes','POST',{title:title.value});ui.dirty.delete(cf);await ui.onCatalog(result.id);},selected,{refresh:false});create.append(cf);host.append(create);
  if(selected.classId){
   const members=node('section',undefined,'card');members.append(node('h2','Assigned members'));
   const rows=roster.members||[];
   if(!rows.length)members.append(node('p','No members are assigned.','muted'));
   for(const member of rows){const line=node('div',undefined,'member-row');line.append(node('span',`${member.alias} · ${member.role}${member.identitySource==='API-reported identity'?' · API-reported identity':''}${member.exempt?' · deadline exception':''}`));
    if(member.role==='student')line.append(ui.button('Remove access',async()=>{if(!confirm('Remove this student’s access to the selected class? Saved work will remain.'))return;ui.assert(selected);await ui.api(`/classes/${selected.classId}/members/${member.user_id}`,'DELETE');ui.assert(selected);await load(selected,{force:true});}));
    members.append(line);
   }host.append(members);
  }
  if(!selected.me.user.admin){host.append(node('p','An administrator manages teacher assignment.','muted'));return;}
  if(selected.classId){
   const box=node('section',undefined,'card');box.append(node('h2','Assign a teacher'));
   const f=node('form'),account=field(f,'Account','select'),alias=field(f,'Name shown in this class','text','',{required:true,maxLength:40});
   choices(account,[{id:'',label:'Choose a teacher'},...accounts.users.filter(u=>u.role==='teacher').map(u=>({id:u.id,label:u.username}))]);account.required=true;
   ui.save(f,'Assign teacher',async()=>{await ui.api(`/classes/${selected.classId}/members`,'POST',{userId:account.value,alias:alias.value,role:'teacher'});f.reset();ui.dirty.delete(f);await load(selected,{force:true});},selected);box.append(f);host.append(box);
  }

 }
 return {load,reset(){ctx=null;loading=null;host.replaceChildren();}};
}
