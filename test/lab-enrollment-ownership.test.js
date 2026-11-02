"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/controller/lab-enrollment.js'),'utf8');
const packageFor=id=>({enrollment:{agentId:id,token:'synthetic-enrollment-fixture',installerUrl:'https://example.test/lab-agent/install.ps1',expiresAt:'2026-01-01T00:00:00Z'}});
function fixture(){
 const requests=[],events={},notices=[],blobs=[],revoked=[],timers=[],downloads=[];let admin=true,loads=0,button;
 const nodes={labEnrollmentId:{value:'fixture-a'},labEnrollmentTtl:{value:'15'}};
 let html='';nodes.labEnrollmentResult={style:{},get innerHTML(){return html},set innerHTML(value){html=value;button={addEventListener(name,fn,options){this[name]=fn;this.options=options}}},querySelector:()=>button};nodes.labEnrollmentResult.innerHTML='';
 class FixtureURL extends URL {static createObjectURL(blob){blobs.push(blob);return 'blob:fixture-'+blobs.length}static revokeObjectURL(url){revoked.push(url)}}
 const c={window:{addEventListener:(name,fn)=>events[name]=fn},document:{getElementById:id=>nodes[id],body:{append(){}},createElement:()=>({click(){downloads.push({href:this.href,download:this.download})},remove(){}})},
 URL:FixtureURL,Blob,location:{href:'https://example.test/controller/'},esc:String,Date,setTimeout:fn=>timers.push(fn),loadLabAgentCredentials:async()=>{loads++},notify:(...args)=>notices.push(args),userCan:()=>admin,
 api:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))};
 vm.createContext(c);vm.runInContext(source,c);
 return{c,nodes,requests,notices,blobs,revoked,timers,downloads,button:()=>button,loads:()=>loads,auth:value=>{admin=value;events['roomgoblin:authchange']?.()},create:()=>c.window.createLabAgentEnrollment()};
}
test('one enrollment issuance remains pending at a time and captures accepted fields',async()=>{
 const h=fixture(),first=h.create();h.nodes.labEnrollmentId.value='fixture-b';h.nodes.labEnrollmentTtl.value='30';await h.create();assert.equal(h.requests.length,1);assert.match(h.notices[0][0],/still pending/);assert.match(h.requests[0].url,/fixture-a\/enrollment$/);assert.deepEqual(JSON.parse(h.requests[0].options.body),{ttlMinutes:15});h.requests[0].resolve(packageFor('fixture-a'));await first;assert.match(h.nodes.labEnrollmentResult.innerHTML,/native bootstrap for fixture-a/);assert.equal(h.nodes.labEnrollmentId.value,'fixture-b');assert.equal(h.nodes.labEnrollmentTtl.value,'30');
});
test('new enrollment attempt clears a previous raw package before sending',async()=>{
 const h=fixture();h.nodes.labEnrollmentResult.innerHTML='synthetic previous package';const pending=h.create();assert.equal(h.nodes.labEnrollmentResult.innerHTML,'');assert.equal(h.nodes.labEnrollmentResult.style.display,'none');h.requests[0].reject(Error('Unavailable'));await pending;
});
test('authorization changes clear an existing enrollment package',()=>{
 const h=fixture();h.nodes.labEnrollmentResult.innerHTML='synthetic previous package';h.auth(false);assert.equal(h.nodes.labEnrollmentResult.innerHTML,'');assert.equal(h.nodes.labEnrollmentResult.style.display,'none');
});
test('a late enrollment reply cannot refill a logged-out view',async()=>{
 const h=fixture(),pending=h.create();h.auth(false);h.requests[0].resolve(packageFor('fixture-a'));await pending;assert.equal(h.nodes.labEnrollmentResult.innerHTML,'');assert.equal(h.loads(),0);
});
test('a changed administrator session cannot inherit a pending package',async()=>{
 const h=fixture(),pending=h.create();h.auth(true);h.requests[0].resolve(packageFor('fixture-a'));await pending;assert.equal(h.nodes.labEnrollmentResult.innerHTML,'');assert.equal(h.loads(),0);
});
test('rejected callers cannot issue enrollment or retain a previous package',async()=>{
 const h=fixture();h.auth(false);h.nodes.labEnrollmentResult.innerHTML='synthetic previous package';await h.create();assert.equal(h.requests.length,0);assert.equal(h.nodes.labEnrollmentResult.innerHTML,'');assert.match(h.notices[0][0],/Administrator access/);
});
test('empty identifiers are rejected and release admission for a later request',async()=>{
 const h=fixture();h.nodes.labEnrollmentId.value=' ';await h.create();assert.equal(h.requests.length,0);h.nodes.labEnrollmentId.value='fixture-a';const pending=h.create();assert.equal(h.requests.length,1);h.requests[0].resolve(packageFor('fixture-a'));await pending;
});
test('an unavailable result view cannot issue an unusable package',async()=>{
 const h=fixture();delete h.nodes.labEnrollmentResult;await h.create();assert.equal(h.requests.length,0);assert.match(h.notices[0][0],/result view is unavailable/);
});
test('a failed issuance permits explicit retry but never replays itself',async()=>{
 const h=fixture(),first=h.create();h.requests[0].reject(Error('Connection failed'));await first;assert.equal(h.requests.length,1);assert.equal(h.nodes.labEnrollmentResult.innerHTML,'');assert.match(h.notices[0][0],/Connection failed/);const retry=h.create();h.requests[1].resolve(packageFor('fixture-a'));await retry;assert.equal(h.requests.length,2);assert.equal(h.loads(),1);
});
test('an old issuance error cannot notify a replacement session',async()=>{
 const h=fixture(),first=h.create();h.auth(false);h.requests[0].reject(Error('Old error'));await first;assert.equal(h.notices.length,0);h.auth(true);const retry=h.create();h.requests[1].resolve(packageFor('fixture-a'));await retry;assert.equal(h.loads(),1);
});
for(const missing of ['token','installerUrl'])test('incomplete packages stay hidden: '+missing,async()=>{
 const h=fixture(),pending=h.create(),data=packageFor('fixture-a');delete data.enrollment[missing];h.requests[0].resolve(data);await pending;assert.equal(h.nodes.labEnrollmentResult.innerHTML,'');assert.match(h.notices[0][0],/incomplete enrollment package/);assert.equal(h.loads(),0);
});
test('current download retains the native schema, returned canonical ID and transport policy',async()=>{
 const h=fixture();h.nodes.labEnrollmentId.value='Fixture A';const pending=h.create(),data=packageFor('fixture-a');data.enrollment.preferredOrigin='https://remote.example.test';data.enrollment.requestOrigin='http://192.0.2.50:3000';h.requests[0].resolve(data);await pending;h.button().click();
 assert.deepEqual(JSON.parse(await h.blobs[0].text()),{schema:'roomgoblin-native-enrollment-v1',hubUrl:'https://remote.example.test',fallbackHubUrl:'http://192.0.2.50:3000',allowHttpFallback:true,agentId:'fixture-a',enrollmentToken:'synthetic-enrollment-fixture',allowHttp:false,trustedPublisherThumbprint:''});
 assert.equal(h.button().options.once,true);assert.equal(h.downloads[0].download,'roomgoblin-enrollment-fixture-a.json');h.timers[0]();assert.deepEqual(h.revoked,['blob:fixture-1']);
});
test('a detached package button cannot download after authorization changes',async()=>{
 const h=fixture(),pending=h.create();h.requests[0].resolve(packageFor('fixture-a'));await pending;const click=h.button().click;h.auth(false);click();assert.equal(h.blobs.length,0);assert.equal(h.downloads.length,0);
});
test('a previous package button cannot download after a new issuance begins',async()=>{
 const h=fixture(),first=h.create();h.requests[0].resolve(packageFor('fixture-a'));await first;const click=h.button().click;const second=h.create();click();assert.equal(h.blobs.length,0);h.requests[1].resolve(packageFor('fixture-a'));await second;
});
test('an accepted request keeps admission across authentication changes until it settles',async()=>{
 const h=fixture(),first=h.create();h.auth(false);h.auth(true);await h.create();assert.equal(h.requests.length,1);h.requests[0].resolve(packageFor('fixture-a'));await first;const next=h.create();assert.equal(h.requests.length,2);h.requests[1].resolve(packageFor('fixture-a'));await next;
});
