"use strict";
// Synthetic local test service only. Never mounted by the production server.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),express=require('express');
const {ClassroomHubStorage}=require('../../src/storage');
const {registerLearning,restrictedStudentGate}=require('../../src/learning');
const {hasCapability}=require('../../src/security');
const good=()=>({reasoningLimit:"These calculations do not prove the router or return path works.",criteria:{claim:{points:6,feedback:'Correctly separates the two /26 networks.'},evidence:{points:6,feedback:'Both network and broadcast boundaries are supported.'},reasoning:{points:5,feedback:'Explains the router next hop and a reachability limit.'},reply:{points:3,feedback:'Adds a justified verification step.'}},summary:'The boundaries support your conclusion. Verify the real next hop before declaring connectivity.',coachResponse:'Your subnet boundaries support the correction. Matching three octets is not enough with /26. What would you check on the actual router before saying the remote path works?'});
async function fixture({grader=async()=>good()}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-learning-test-')),key=path.join(dir,'master');fs.writeFileSync(key,crypto.randomBytes(32));
 const store=new ClassroomHubStorage({dataDir:dir,masterKeyFile:key});const admin=store.createFirstAdministrator({username:'teacher-test',displayName:'Mr. Wagner'},{password:'synthetic-test-password'});
 const app=express();app.use(express.json({limit:'32kb'}));const user=req=>{if(req.authUser!==undefined)return req.authUser;const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('classroom_hub_session='));return req.authUser=store.sessionUser(cookie?.split('=')[1])||null;};
 const can=(u,c)=>hasCapability(u,c,store.listAccessProfiles().find(p=>p.id===u?.profileId));
 app.use((req,res,next)=>{user(req);restrictedStudentGate(req,res,next);});
 let frozen=false;
 const learning=registerLearning(app,{store,requestUser:user,hasCapability:can,grade:grader,freezeRequested:()=>frozen,publicDir:path.join(__dirname,'../../public/learn')});
 const a=store.putUser({username:'learner-a',displayName:'Investigator A',role:'viewer',profileId:'learning-student'},{password:'synthetic-test-password'}),b=store.putUser({username:'learner-b',displayName:'Investigator B',role:'viewer',profileId:'learning-student'},{password:'synthetic-test-password'}),outside=store.putUser({username:'learner-c',displayName:'Other Class',role:'viewer',profileId:'learning-student'},{password:'synthetic-test-password'});
 const classId=learning.createClass(admin,'Synthetic Period 7');learning.enroll(admin,classId,{userId:a.id,alias:'Investigator A'});learning.enroll(admin,classId,{userId:b.id,alias:'Investigator B'});
 const activityId=learning.createActivity(admin,classId,{title:'Subnet Case Files · Local QA'});
 store.putSecret('learning.openai.key','synthetic-only-not-a-real-key');store.setPreference('learning.ai',{enabled:true,model:'synthetic-fixture-model',dailyLimit:100,autonomous:true});
 app.post('/api/v1/auth/login',(req,res)=>{const u=store.verifyUser(req.body.username,req.body.password);if(!u)return res.status(401).json({ok:false,error:'Invalid credentials'});const s=store.createSession(u);res.setHeader('Set-Cookie',`classroom_hub_session=${s.token}; Path=/; HttpOnly; SameSite=Strict`);res.json({ok:true});});
 app.post('/api/v1/auth/logout',(req,res)=>{const token=String(req.headers.cookie||'').split('=')[1];store.deleteSession(token);res.setHeader('Set-Cookie','classroom_hub_session=; Path=/; Max-Age=0');res.json({ok:true});});
 app.get('/api/v1/diagnostics',(_req,res)=>res.json({sentinel:'must not reach student'}));
 app.use('/learn',express.static(path.join(__dirname,'../../public/learn')));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base=`http://127.0.0.1:${server.address().port}`;
 const cookies=Object.fromEntries([admin,a,b,outside].map(u=>[u.id,'classroom_hub_session='+store.createSession(u).token]));
 async function request(u,url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{...(u?{cookie:cookies[u.id]}:{}),'Content-Type':'application/json','x-roomgoblin-learning':'1',...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:r.headers.get('content-type')?.includes('json')?await r.json():Buffer.from(await r.arrayBuffer()),headers:r.headers};}
 return {store,learning,admin,a,b,outside,classId,activityId,base,request,cookies,freeze:v=>frozen=v,close:async()=>{await new Promise(r=>server.close(r));store.db.close();fs.rmSync(dir,{recursive:true,force:true});}};
}
module.exports={fixture,good};
