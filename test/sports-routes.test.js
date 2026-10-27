"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),multer=require('multer'),{rateLimit}=require('express-rate-limit');
const {registerSportsRoutes}=require('../src/sports-routes'),model=require('../src/sports');
test('Sports routes enforce operator, write, source-admin and receiver boundaries',async t=>{
 const app=express();app.use(express.json());const values=new Map();const gate=role=>(req,res,next)=>req.get('x-role')===role||req.get('x-role')==='admin'?next():res.sendStatus(403);
 const runtime=registerSportsRoutes(app,{store:{getPreference:(k,d)=>values.get(k)??d,setPreference:(k,v)=>values.set(k,v)},readGuard:gate('operator'),writeGuard:[gate('editor')],adminGuard:gate('admin'),canManageSources:req=>req.get('x-role')==='admin',canRead:req=>['operator','admin'].includes(req.get('x-role')),canWrite:req=>['editor','admin'].includes(req.get('x-role')),canReadAssets:req=>req.get('x-role')==='receiver',assetGuard:(req,res,next)=>req.get('x-role')==='receiver'?next():res.sendStatus(401),rateLimit,multer,canRun:()=>false});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{runtime.close();server.close()});const url='http://127.0.0.1:'+server.address().port+'/api/v1/sports';
 const req=(path='',role='operator',method='GET',body)=>fetch(url+path,{method,headers:{'x-role':role,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 for(let i=0;i<25;i++){assert.equal((await req('','anonymous','PUT',{})).status,403);assert.equal((await req('/refresh','anonymous','POST',{})).status,403)}
 for(let i=0;i<245;i++){const rejected=await req('/boards/b/display','anonymous');assert.equal(rejected.status,401)}
 assert.equal((await req('','receiver')).status,403);assert.equal((await req('','operator','PUT',{})).status,403);
 let config=model.normalize({teams:[{id:'t',name:'School',sport:'Volleyball'}],boards:[{id:'b',teamIds:['t']}]});
 let response=await req('','editor','PUT',config);assert.equal(response.status,200);config=(await response.json()).config;
 config.teams[0].sources=[{id:'s',url:'https://school.example',enabled:true,approved:true}];assert.equal((await req('','editor','PUT',config)).status,403);response=await req('','admin','PUT',config);assert.equal(response.status,200);config=(await response.json()).config;
 for(const [key,value]of [['sport','Other sport'],['category','girls'],['level','jv'],['season','2027']]){const changed=structuredClone(config);changed.teams[0][key]=value;assert.equal((await req('','editor','PUT',changed)).status,403)}
 assert.equal((await req('/boards/b/display','operator')).status,401);response=await req('/boards/b/display','receiver');assert.equal(response.status,200);assert.equal(JSON.stringify(await response.json()).includes('school.example'),false);
 assert.equal((await req('/refresh','editor','POST',{})).status,403);assert.equal((await req('/boards/b/scene','operator','POST',{})).status,200);
 assert.equal((await req('/import/roster','editor','POST',{csv:'name,number\nExample Athlete,12'})).status,200);
 assert.equal(runtime.service.read().teams[0].roster.length,0,'import is review-only');
 for(const [field,size]of [['unexpected',8],['file',5242881]]){
  const body=new FormData();body.append(field,new Blob([Buffer.alloc(size)]),'fixture.pdf');
  const rejected=await fetch(url+'/import/roster',{method:'POST',headers:{'x-role':'editor'},body});
  assert.equal(rejected.status,400);assert.equal((await rejected.json()).error,'Upload a roster PDF under 5 MiB');
 }
});
