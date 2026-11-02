"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module'),express=require('express'),{rateLimit}=require('express-rate-limit');
async function fixture(t){
 const source=fs.readFileSync(require.resolve('../src/server'),'utf8'),app=express();app.use(express.json());
 const role=req=>req.get('x-test-role'),controlAccessAllowed=req=>['operator','editor'].includes(role(req)),assetAccessAllowed=req=>['asset','operator','editor'].includes(role(req));
 const capabilityAccessAllowed=(req,capability)=>role(req)==='editor'||role(req)===(capability==='schedule.manage'?'schedule-only':'automation-only');
 const guard=allowed=>(req,res,next)=>allowed(req)?next():res.sendStatus(role(req)?403:401);
 const weather={text:'Fixture weather',widgets:{},source:'Fixture',updatedAt:Date.now()};
 const ctx=vm.createContext({app,rateLimit,controlAccessAllowed,assetAccessAllowed,capabilityAccessAllowed,
  requireControl:guard(controlAccessAllowed),requireAssetAccess:guard(assetAccessAllowed),requireCapability:c=>guard(req=>capabilityAccessAllowed(req,c)),Date,URL,URLSearchParams,AbortSignal,
  fetch:async()=>new Response(JSON.stringify({results:[]})),require:createRequire(require.resolve('../src/server')),
  planningStudio:require('../src/planning-studio'),planningStudioConfig:{weather:{enabled:false,unit:'fahrenheit'},overlays:[]},planningWeather:{read:()=>weather,settled:async()=>{},status:()=>({})},dbStore:{setPreference:()=>{}},audit:()=>{}});
 const start=source.indexOf('const weatherReadLimit='),end=source.indexOf('function planningClassesForProfile(',start);vm.runInContext(source.slice(start,end),ctx);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const base=`http://127.0.0.1:${server.address().port}/api/v1/weather`;
 return async(path='',who='operator',method='GET')=>{
  const response=await fetch(base+path,{method,headers:{...(who?{'x-test-role':who}:{}),'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(path==='/config'?{enabled:false,unit:'fahrenheit'}:{mode:'overlay',overlayFields:['temperature']})})});
  await response.text();return response.status;
 };
}
for(const [path,method] of [['','GET'],['/locations?q=Example','GET'],['/scene','POST']])test(`rejected operator Weather ${path||'read'} requests preserve the shared read allowance`,async t=>{
 const request=await fixture(t);
 for(let i=0;i<241;i++)assert.equal(await request(path,'asset',method),403);
 assert.equal(await request('','operator'),200);
 assert.equal(await request('/display','asset'),200);
});
test('rejected Weather receiver requests preserve the shared read allowance',async t=>{
 const request=await fixture(t);
 for(let i=0;i<241;i++)assert.equal(await request('/display',null),401);
 assert.equal(await request('/display','asset'),200);
 assert.equal(await request('','operator'),200);
});
for(const role of ['schedule-only','automation-only'])test(`Weather settings require both capabilities before charging ${role}`,async t=>{
 const request=await fixture(t);
 for(let i=0;i<21;i++)assert.equal(await request('/config',role,'PUT'),403);
 assert.equal(await request('/config','editor','PUT'),200);
});
test('accepted Weather reads remain appliance-wide and bounded',async t=>{
 const request=await fixture(t);
 for(let i=0;i<240;i++)assert.equal(await request(i%2?'/display':'',i%2?'asset':'operator'),200);
 assert.equal(await request('','operator'),429);
 assert.equal(await request('/display','asset'),429);
 assert.equal(await request('/display',null),401);
});
test('accepted Weather writes retain the fixed quota and rejected callers retain their denial',async t=>{
 const request=await fixture(t);
 for(let i=0;i<20;i++)assert.equal(await request('/config','editor','PUT'),200);
 assert.equal(await request('/config','editor','PUT'),429);
 assert.equal(await request('/config','schedule-only','PUT'),403);
});
