"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {allowedPath,createStudentGateway,isPublicRequest,publicOrigin}=require('../src/learning-public');
const id='00000000-0000-4000-8000-000000000001';
test('public connector allows only exact student routes, never controller/admin or encoded alternatives',()=>{
 for(const [method,path] of [['GET','/learn/connect/'],['GET','/learn/sdk/roomgoblin-scorm.js'],['POST','/learn/lti/'+id],['POST',`/api/v1/learning/platform/activities/${id}/events`]])assert.equal(allowedPath(method,path),true);
 for(const path of ['/controller/','/health','/api/v1/learning/settings','/api/v1/auth/login','/api/v1/admin/health','/api/v1/learning/activities/'+id+'/lti','/learn/../controller/','/learn/%2e%2e/controller/','//learn/','/learn/\\controller','/api/v1/learning/platform/activities/'+id+'/events/'])for(const method of ['GET','POST','PUT','OPTIONS'])assert.equal(allowedPath(method,path),false,path);
 assert.equal(allowedPath('DELETE',`/api/v1/learning/activities/${id}/posts/${id}`),false);
});
async function fixture(t,{enabled=true,clock=Date.now}={}){
 let reached=0;
 const server=createStudentGateway({store:{getPreference:()=>({publicEnabled:enabled,publicOrigin:'https://learn.example.test'})},clock,app:(req,res)=>{reached++;assert.ok(isPublicRequest(req));res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Content-Security-Policy','default-src *');res.end('student');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const request=(url,extra={})=>new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:server.address().port,path:url,headers:{Host:'learn.example.test','X-Forwarded-Proto':'https','CF-Connecting-IP':'192.0.2.1',...extra}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}));}).on('error',reject);});
 return {request,reached:()=>reached};
}
test('dedicated listener blocks administration before shared app and keeps companion-compatible strict headers',async t=>{
 const f=await fixture(t);assert.equal((await f.request('/controller/')).status,404);assert.equal(f.reached(),0);
 assert.equal((await f.request('/learn/connect/',{Host:'admin.example.test'})).status,404);
 assert.equal((await f.request('/learn/connect/',{'X-Forwarded-Proto':'http'})).status,404);
 const r=await f.request('/learn/connect/');assert.equal(r.status,200);assert.equal(r.headers['cross-origin-opener-policy'],'unsafe-none');assert.match(r.headers['content-security-policy'],/connect-src 'self'/);assert.equal(r.headers['cache-control'],'no-store');assert.equal(f.reached(),1);
});
test('disabled or malformed persisted public configuration never reaches the Hub',async t=>{const f=await fixture(t,{enabled:false});assert.equal((await f.request('/learn/connect/')).status,503);assert.equal(f.reached(),0);});
test('corrupt, cleartext and credential-bearing stored origins fail closed',()=>{for(const cfg of [null,[],{publicEnabled:true,publicOrigin:'not-url'},{publicEnabled:true,publicOrigin:'http://learn.example.test'},{publicEnabled:true,publicOrigin:'https://u:p@learn.example.test'},{publicEnabled:true,publicOrigin:'https://127.0.0.1'}])assert.equal(publicOrigin({getPreference:()=>cfg}),null);});
test('public request budget expires without retaining an unbounded address map',async t=>{
 let now=0;const f=await fixture(t,{clock:()=>now});for(let i=0;i<1200;i++)assert.equal((await f.request('/learn/connect/')).status,200);
 assert.equal((await f.request('/learn/connect/')).status,429);now=60000;assert.equal((await f.request('/learn/connect/')).status,200);
});
