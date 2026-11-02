'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),express=require('express'),{rateLimit}=require('express-rate-limit');
const source=fs.readFileSync(require.resolve('../src/server'),'utf8').replace(/\r\n/g,'\n');
function section(a,b){const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return source.slice(x,y)}
const limiter=source.includes('const displayEnrollmentMutationLimit=rateLimit(')?section('const displayEnrollmentMutationLimit=rateLimit(','\napp.get("/api/v1/admin/display-credentials"'):'';
const code=section('function authenticationUnavailable(','function requireAuthenticated(')+limiter+section('app.post("/api/v1/admin/displays/:id/enrollment"','\napp.delete("/api/v1/admin/display-credentials/:id"');
async function fixture(t,legacy=false){
 const app=express();app.use(express.json());let writes=0;
 const dbStore={authEnabled:()=>!legacy,userCount:()=>1,createDisplayEnrollment:()=>{writes++;return {id:'fixture',token:'fixture-code',expiresAt:'fixture'}},cancelDisplayEnrollments:()=>{writes++;return 1}};
 vm.runInNewContext(code,{app,rateLimit,dbStore,CONTROL_TOKEN:'fixture-control',secureTokenEqual:(a,b)=>a===b,requestUser:req=>({role:req.get('x-fixture-role')}),hasRole:(u,r)=>u.role===r,hasCapability:u=>u.role==='admin',configuredDisplayId:value=>value,audit(){}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
 return {writes:()=>writes,async request({method='POST',role='admin',token='',ip='192.0.2.1'}={}){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/displays/Screen-A/enrollment`,{method,headers:{'content-type':'application/json','x-fixture-role':role,'x-control-token':token,'x-maintenance-token':'fixture-maintenance','x-forwarded-for':ip},body:'{}'});return {status:r.status,headers:r.headers,body:await r.json()}}};
}
test('enrollment creation and cancellation share a fixed administrator budget',async t=>{
 const h=await fixture(t);for(let i=0;i<120;i++)assert.equal((await h.request({method:i%2?'DELETE':'POST',ip:`192.0.2.${i+1}`})).status,i%2?200:201);
 for(const method of ['POST','DELETE']){const r=await h.request({method,ip:'198.51.100.1'});assert.equal(r.status,429);assert.ok(Number(r.headers.get('retry-after'))>0)}assert.equal(h.writes(),120);
});
test('anonymous and rejected profiles cannot consume enrollment admission',async t=>{
 const h=await fixture(t);for(let i=0;i<125;i++)for(const role of ['','viewer'])assert.equal((await h.request({role})).status,403);
 assert.equal(h.writes(),0);for(let i=0;i<120;i++)assert.equal((await h.request()).status,201);assert.equal((await h.request()).status,429);assert.equal((await h.request({role:'viewer'})).status,403);
});
test('legacy rejected control tokens do not spend the administrator enrollment budget',async t=>{
 const h=await fixture(t,true);for(let i=0;i<125;i++)assert.equal((await h.request({token:'rejected'})).status,401);
 for(let i=0;i<120;i++)assert.equal((await h.request({token:'fixture-control'})).status,201);assert.equal((await h.request({token:'fixture-control'})).status,429);assert.equal(h.writes(),120);
});
