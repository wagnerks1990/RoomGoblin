import {node,field,choices,detail} from './ui.mjs';

export function createManagement(ui,host){
 let ctx=null,loading=null;
 async function load(next,{force=false}={}){
  if(!force&&ctx===next)return;if([...ui.dirty].some(f=>host.contains(f)))return;
  const selected=next,token={};loading=token;
  const [roster,accounts]=await Promise.all([next.classId?ui.api('/classes/'+next.classId):Promise.resolve({members:[]}),next.me.user.admin?ui.api('/accounts'):Promise.resolve(null)]);
  ui.assert(selected);if(loading!==token)return;ctx=selected;
  host.replaceChildren(node('p','Direct API participants register when their assignment first reports data. Manual accounts are optional for older learning flows.','muted'));
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
  if(!selected.me.user.admin){host.append(node('p','An administrator manages account creation and class assignment.','muted'));return;}
  if(selected.classId){
   const box=node('section',undefined,'card');box.append(node('h2','Assign an existing account'));
   const f=node('form'),account=field(f,'Account','select'),alias=field(f,'Name shown in this class','text','',{required:true,maxLength:40}),role=field(f,'Class role','select'),exempt=field(f,'Approved deadline exception','checkbox',false);
   choices(account,[{id:'',label:'Choose an account'},...accounts.users.map(u=>({id:u.id,label:u.username+' · '+u.role}))]);account.required=true;choices(role,[{id:'student',label:'Student'},{id:'teacher',label:'Teacher'}]);
   account.addEventListener('change',()=>{role.value=accounts.users.find(u=>u.id===account.value)?.role||'student';});
   ui.save(f,'Assign account',async()=>{await ui.api(`/classes/${selected.classId}/members`,'POST',{userId:account.value,alias:alias.value,role:role.value,exempt:exempt.checked});f.reset();ui.dirty.delete(f);await load(selected,{force:true});},selected);box.append(f);host.append(box);
  }
  const box=node('section',undefined,'card'),d=detail('Create a restricted student account','new-account');box.append(d);
  const f=node('form'),username=field(f,'Username','text','',{required:true,maxLength:80,autoComplete:'off'}),alias=field(f,'Display name','text','',{required:true,maxLength:40}),password=field(f,'Temporary password','password','',{required:true,minLength:10,autoComplete:'new-password'});
  f.append(node('p','The account can access assigned learning activities only. Assign it to a class after creation.','muted'));
  ui.save(f,'Create student account',async()=>{try{await ui.api('/accounts','POST',{username:username.value,alias:alias.value,password:password.value});f.reset();ui.dirty.delete(f);await load(selected,{force:true});}finally{password.value='';}},selected);d.append(f);host.append(box);
 }
 return {load,reset(){ctx=null;loading=null;host.replaceChildren();}};
}
