"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),express=require('express'),multer=require('multer'),{rateLimit}=require('express-rate-limit');
const {registerSportsRoutes}=require('../src/sports-routes'),model=require('../src/sports');
test('Sports routes enforce operator, write, source-admin and receiver boundaries',async t=>{
 const app=express();app.use(express.json());const values=new Map();const gate=role=>(req,res,next)=>req.get('x-role')===role||req.get('x-role')==='admin'?next():res.sendStatus(403);
 const runtime=registerSportsRoutes(app,{store:{getPreference:(k,d)=>values.get(k)??d,setPreference:(k,v)=>values.set(k,v)},readGuard:gate('operator'),writeGuard:[gate('editor')],adminGuard:gate('admin'),canManageSources:req=>req.get('x-role')==='admin',assetGuard:(req,res,next)=>req.get('x-role')==='receiver'?next():res.sendStatus(401),rateLimit,multer,canRun:()=>false});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{runtime.close();server.close()});const url='http://127.0.0.1:'+server.address().port+'/api/v1/sports';
 const req=(path='',role='operator',method='GET',body)=>fetch(url+path,{method,headers:{'x-role':role,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await req('','receiver')).status,403);assert.equal((await req('','operator','PUT',{})).status,403);
 let config=model.normalize({teams:[{id:'t',name:'School',sport:'Volleyball'}],boards:[{id:'b',teamIds:['t']}]});
 let response=await req('','editor','PUT',config);assert.equal(response.status,200);config=(await response.json()).config;
 config.teams[0].sources=[{id:'s',url:'https://school.example',enabled:true,approved:true}];assert.equal((await req('','editor','PUT',config)).status,403);response=await req('','admin','PUT',config);assert.equal(response.status,200);config=(await response.json()).config;
 assert.equal((await req('/boards/b/display','operator')).status,401);response=await req('/boards/b/display','receiver');assert.equal(response.status,200);assert.equal(JSON.stringify(await response.json()).includes('school.example'),false);
 assert.equal((await req('/refresh','editor','POST',{})).status,403);assert.equal((await req('/boards/b/scene','operator','POST',{})).status,200);
 assert.equal((await req('/import/roster','editor','POST',{csv:'name,number\nExample Athlete,12'})).status,200);
 assert.equal(runtime.service.read().teams[0].roster.length,0,'import is review-only');
});
