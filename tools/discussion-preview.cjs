'use strict';
// Local operator test harness, never mounted by the Hub or student gateway.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),express=require('express'),AdmZip=require('adm-zip');
const {rateLimit}=require('express-rate-limit');
const {normalize}=require('../src/learning-assignment-definition');
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
function originURL(value){const u=new URL(value);if(u.pathname!=='/'||u.search||u.hash||u.username||u.password||!(u.protocol==='https:'||u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw Error('Use the native RoomGoblin HTTPS origin or an isolated loopback test origin.');return u.origin;}
async function createPreview({origin,definition,outdir,port=0,fetchImpl=fetch}){
 origin=originURL(origin);definition=normalize(definition);if(definition.kind!=='discussion')throw Error('Choose a discussion definition.');
 outdir=path.resolve(outdir);fs.mkdirSync(outdir,{recursive:true,mode:0o700});
 const receiptPath=path.join(outdir,'test-assignment-receipt.json'),zipPath=path.join(outdir,'Discussion-TEST-ONLY.zip'),definitionHash=digest(JSON.stringify(definition));
 const app=express();let server,base,zip=null,receipt=null,busy=false,uncertain=false;
 if(fs.existsSync(receiptPath)&&fs.existsSync(zipPath)){
  const saved=JSON.parse(fs.readFileSync(receiptPath,'utf8')),data=fs.readFileSync(zipPath);
  if(saved.origin===origin&&saved.definitionHash===definitionHash&&saved.sha256===digest(data)){receipt=saved;zip=new AdmZip(data);}
 }
 if(!zip&&fs.existsSync(path.join(outdir,'creation-checkpoint.json')))uncertain=true;
 app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');if(req.get('host')!==new URL(base).host)return res.status(403).end();if(req.method==='POST'&&(req.get('origin')!==base||req.get('x-roomgoblin-preview')!=='1'))return res.status(403).json({error:'Use the local preview page.'});next();});
 app.use(express.json({limit:'16kb'}));
 const reads=rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-8',legacyHeaders:false});
 const connects=rateLimit({windowMs:15*60000,limit:5,standardHeaders:'draft-8',legacyHeaders:false});
 app.get('/',reads,(_req,res)=>res.sendFile(path.join(__dirname,'discussion-preview/index.html')));
 app.get('/status',(_req,res)=>res.json({ready:!!zip,busy,uncertain,origin,title:definition.title,points:definition.points,storageKey:definitionHash,aiConfigured:receipt?.aiConfigured??null,testOnly:true}));
 app.post('/connect',connects,async(req,res)=>{
  if(zip)return res.json({ready:true});
  if(busy||uncertain)return res.status(409).json({error:uncertain?'A creation result is unconfirmed. Inspect the test class in RoomGoblin before starting another test.':'Connection is already in progress.'});
  const {username,password}=req.body||{};
  if(typeof username!=='string'||!username.trim()||username.length>200||typeof password!=='string'||!password||password.length>1024)return res.status(400).json({error:'Enter your existing RoomGoblin teacher sign-in.'});
  busy=true;let cookie='',createdClass=null,createdActivity=null;
  async function request(route,method='GET',body,binary=false){
   const response=await fetchImpl(origin+'/api/v1/'+route,{method,redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json','X-RoomGoblin-Learning':'1',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
   if(!response.ok){await response.body?.cancel();throw Error('RoomGoblin request was not accepted (HTTP '+response.status+').');}
   return binary?Buffer.from(await response.arrayBuffer()):response.json();
  }
  try{
   const login=await fetchImpl(origin+'/api/v1/auth/login',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
   req.body.password='';
   if(!login.ok){await login.body?.cancel();throw Error('RoomGoblin sign-in was not accepted. Check your existing teacher account.');}
   const cookies=typeof login.headers.getSetCookie==='function'?login.headers.getSetCookie():[login.headers.get('set-cookie')||''];
   const match=cookies.map(x=>x.match(/(?:^|[,;]\s*)classroom_hub_session=([^;\s,]+)/)).find(Boolean);await login.body?.cancel();
   if(!match)throw Error('RoomGoblin did not return a native sign-in session.');cookie='classroom_hub_session='+match[1];
   const me=await request('learning/me');if(!me.user?.teacher||me.assignmentDefinitions?.schemaVersion!==1)throw Error('This account needs teacher access to the reusable discussion API.');
   // Never retry an uncertain create. These identifiers contain no credentials.
   uncertain=true;
   const c=await request('learning/classes','POST',{title:('TEST - '+definition.title).slice(0,100)});createdClass=c.id;
   fs.writeFileSync(path.join(outdir,'creation-checkpoint.json'),JSON.stringify({origin,classId:createdClass,definitionHash,status:'class-created'},null,2),{mode:0o600});
   const a=await request('learning/teacher/classes/'+createdClass+'/assignments','POST',{definition});createdActivity=a.id;
   fs.writeFileSync(path.join(outdir,'creation-checkpoint.json'),JSON.stringify({origin,classId:createdClass,activityId:createdActivity,definitionHash,status:'assignment-created'},null,2),{mode:0o600});
   const data=await request('learning/teacher/activities/'+createdActivity+'/direct-package','POST',{},true),nextZip=new AdmZip(data);
   if(!nextZip.getEntry('imsmanifest.xml')||!nextZip.getEntry('index.html')||!nextZip.getEntry('config.js'))throw Error('The exported assignment package is incomplete.');
   receipt={origin,classId:createdClass,activityId:createdActivity,title:definition.title,points:definition.points,aiConfigured:!!me.aiConfigured,definitionHash,sha256:digest(data),testOnly:true};
   fs.writeFileSync(zipPath,data,{mode:0o600});fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2),{mode:0o600});zip=nextZip;uncertain=false;
   res.json({ready:true,aiConfigured:receipt.aiConfigured});
  }catch(error){req.body.password='';res.status(400).json({error:error.message+(createdActivity?' The test assignment was created; inspect it in RoomGoblin before retrying.':createdClass?' A test class was created; inspect it in RoomGoblin before retrying.':'')});}
  finally{if(cookie)await request('auth/logout','POST',{}).catch(()=>{});cookie='';busy=false;}
 });
 app.get('/sco/*entry', (req,res)=>{
  if(!zip)return res.status(409).send('Connect the local preview first.');
  const filename=(req.params.entry||[]).join('/');if(!filename||filename.includes('..')||filename.startsWith('/'))return res.status(404).end();
  const entry=zip.getEntry(filename);if(!entry||entry.isDirectory)return res.status(404).end();
  const ext=path.extname(filename);res.type(ext==='.js'?'application/javascript':ext==='.css'?'text/css':ext==='.xml'?'application/xml':'text/html');res.send(zip.readFile(entry));
 });
 app.get('/download',reads,(_req,res)=>{if(!zip)return res.status(409).end();res.download(zipPath,'Discussion-TEST-ONLY.zip');});
 app.post('/stop',(_req,res)=>{res.json({ok:true});setImmediate(()=>server.close());});
 app.use((error,_req,res,_next)=>res.status(400).json({error:'The local request could not be processed.'}));
 server=await new Promise((resolve,reject)=>{const s=app.listen(port,'127.0.0.1',()=>resolve(s));s.once('error',reject);});base='http://127.0.0.1:'+server.address().port;
 const status={url:base,pid:process.pid,testOnly:true};fs.writeFileSync(path.join(outdir,'preview-status.json'),JSON.stringify(status,null,2));
 fs.writeFileSync(path.join(outdir,'Open-Discussion-Test.html'),'<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url='+base+'"><title>Open discussion test</title></head><body><p><a href="'+base+'">Open the local discussion test</a></p><p>If the page is unavailable, run Start-Discussion-Test.cmd first.</p></body></html>');
 return {url:base,app,close:()=>new Promise(r=>server.close(r))};
}
if(require.main===module){const values={};for(let i=2;i<process.argv.length;i+=2){if(!['--origin','--definition','--out','--port'].includes(process.argv[i])||!process.argv[i+1])throw Error('Use --origin, --definition, --out and optional --port.');values[process.argv[i]]=process.argv[i+1];}createPreview({origin:values['--origin'],definition:JSON.parse(fs.readFileSync(values['--definition'],'utf8')),outdir:values['--out'],port:Number(values['--port']||0)}).then(r=>console.log('Local discussion test: '+r.url)).catch(error=>{console.error(error.message);process.exitCode=1;});}
module.exports={createPreview,originURL};
