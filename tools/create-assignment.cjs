'use strict';
// One authoring API for reusable data-defined assignments. No secrets in arguments/logs.
const fs=require('node:fs'),path=require('node:path'),{normalize}=require('../src/learning-assignment-definition');
async function create({baseURL,session,classId,classTitle,definition,dueAt=null,outfile,fetchImpl=fetch}){
 const d=normalize(definition),base=new URL(baseURL);if(base.pathname!=='/'||base.search||base.hash||base.username||base.password||!(base.protocol==='https:'||base.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(base.hostname)))throw Error('Use the native teacher HTTPS origin, or loopback HTTP for isolated tests.');
 if(!session||/[\r\n;]/.test(session))throw Error('Set ROOMGOBLIN_TEACHER_SESSION privately to the native teacher session value.');
 if(classId&&!/^[a-f0-9-]{36}$/.test(classId))throw Error('Use a class UUID.');
 if(!classId&&(typeof classTitle!=='string'||!classTitle.trim()||classTitle.length>100))throw Error('Choose an existing class or explicitly name a new class.');
 if(dueAt&&(!/T.*(?:Z|[+-]\d\d:\d\d)$/.test(dueAt)||!Number.isFinite(Date.parse(dueAt))))throw Error('A due time must include its timezone.');
 if(!outfile)throw Error('Choose a private output ZIP outside the repository.');
 const target=path.resolve(outfile);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target))throw Error('The output already exists; choose a new path.');
 async function call(route,method='GET',body,binary=false){const r=await fetchImpl(base.origin+'/api/v1/learning'+route,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{Cookie:'classroom_hub_session='+session,'Content-Type':'application/json','X-RoomGoblin-Learning':'1'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw Error('Learning API rejected '+method+' '+route+' (HTTP '+r.status+'). Inspect saved assignments before retrying an uncertain create.');return binary?Buffer.from(await r.arrayBuffer()):r.json();}
 const me=await call('/me');if(!me.user?.teacher||me.assignmentDefinitions?.schemaVersion!==1||!me.assignmentDefinitions.kinds.includes(d.kind))throw Error('The reusable assignment API must be deployed and the teacher session authorized before creation.');
 if(!classId){const result=await call('/classes','POST',{title:classTitle});classId=result.id;}
 const created=await call('/teacher/classes/'+classId+'/assignments','POST',{definition:d});const activityId=created.id;
 if(dueAt)await call('/activities/'+activityId,'PUT',{open:true,dueAt,closeAt:null});
 const zip=await call('/teacher/activities/'+activityId+'/direct-package','POST',{},true);fs.writeFileSync(target,zip,{flag:'wx',mode:0o600});
 return {classId,activityId,points:d.points,dueAt,clipboardPolicy:d.clipboardPolicy,package:target,sha256:require('node:crypto').createHash('sha256').update(zip).digest('hex')};
}
if(require.main===module){const args=process.argv.slice(2),values={};for(let i=0;i<args.length;i+=2){if(!['--origin','--class-id','--class-title','--due-at','--definition','--out'].includes(args[i])||!args[i+1])throw Error('Use --origin, --definition, --class-id or --class-title, optional --due-at, and --out.');values[args[i]]=args[i+1];}Promise.resolve().then(()=>create({baseURL:values['--origin'],session:process.env.ROOMGOBLIN_TEACHER_SESSION,classId:values['--class-id'],classTitle:values['--class-title'],definition:JSON.parse(fs.readFileSync(values['--definition'],'utf8')),dueAt:values['--due-at'],outfile:values['--out']})).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={create};
