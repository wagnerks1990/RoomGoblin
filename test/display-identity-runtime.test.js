"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {WebSocket}=require('ws'),{once}=require('node:events');
const {ClassroomHubStorage}=require('../src/storage');
const {launch,linux}=require('./helpers/lifecycle-process.cjs');
async function fixture(t,{required=false,groups={}}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'roomgoblin-display-identity-')),master=path.join(directory,'master.key');fs.writeFileSync(master,Buffer.alloc(32,23));
 const store=new ClassroomHubStorage({dataDir:directory,dbFile:path.join(directory,'hub.db'),masterKeyFile:master});
 const devices={'Screen-A':{name:'Upper receiver',enabled:true},'screen-a':{name:'Lower receiver',enabled:true},'screen.dot':{name:'Dotted receiver',enabled:true},'OnlyUpper':{name:'Upper only',enabled:true},'disabled':{name:'Disabled',enabled:false}};
 store.writeNormalized('devices',{room:'Fixture',devices,displayGroups:{all:Object.keys(devices).filter(id=>id!=='disabled'),...groups},lightingGroups:[]});
 store.setDisplayCredentialPolicy({authenticationRequired:required,legacySharedTokenAllowed:false});
 const code=store.createDisplayEnrollment('Screen-A'),enrolled=store.consumeDisplayEnrollment('Screen-A',code.token);store.db.close();
 const app=await launch(t,{directory});
 const created=await fetch(`http://127.0.0.1:${app.control}/api/v1/setup/administrator`,{method:'POST',headers:{'content-type':'application/json','x-setup-token':'lifecycle-test-setup'},body:JSON.stringify({username:'fixture-admin',password:'fixture-long-admin-password'})});
 assert.equal(created.status,201);await created.text();
 app.cookie=created.headers.get('set-cookie').split(';',1)[0];app.credential=enrolled.credential;app.credentialId=enrolled.id;
 app.request=(url,{body,method='GET',auth=true}={})=>fetch(`http://127.0.0.1:${app.control}${url}`,{method,headers:{'content-type':'application/json',...(auth?{cookie:app.cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return app;
}
async function hello(t,app,deviceId,extra={}){
 const ws=new WebSocket(`ws://127.0.0.1:${app.control}/ws`,extra.role==='preview'?{headers:{cookie:app.cookie,origin:`http://127.0.0.1:${app.control}`}}:{});t.after(()=>ws.terminate());
 const response=new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Display handshake timed out')),5000);
  ws.on('message',data=>{const m=JSON.parse(data);if(m.type==='hello.ack'||m.type==='error'){clearTimeout(timer);resolve(m)}});
  ws.once('error',error=>{clearTimeout(timer);reject(error)});
 });
 await once(ws,'open');ws.send(JSON.stringify({type:'hello',role:'display',deviceId,...extra}));return {ws,ack:await response};
}
test('HTTP receiver lookup retains exact case when both identities exist',linux,async t=>{
 const app=await fixture(t),r=await app.request('/api/v1/devices/Screen-A');assert.equal(r.status,200);assert.equal((await r.json()).id,'Screen-A');
 const page=await app.request('/display/OnlyUpper',{auth:false});assert.equal(page.status,200);await page.text();
});
test('direct WebSocket receiver identity preserves exact configured casing',linux,async t=>{
 const app=await fixture(t),{ack}=await hello(t,app,'Screen-A');assert.equal(ack.type,'hello.ack');assert.equal(ack.deviceId,'Screen-A');assert.equal(ack.config.name,'Upper receiver');
});
test('administrator enrollment is issued to the exact configured receiver',linux,async t=>{
 const app=await fixture(t),r=await app.request('/api/v1/admin/displays/Screen-A/enrollment',{method:'POST',body:{}});assert.equal(r.status,201);assert.equal((await r.json()).enrollment.displayId,'Screen-A');
});
test('persisted uppercase receiver credentials still authenticate without migration',linux,async t=>{
 const app=await fixture(t,{required:true}),{ack}=await hello(t,app,'Screen-A',{credential:app.credential});assert.equal(ack.type,'hello.ack');assert.equal(ack.deviceId,'Screen-A');assert.equal(ack.authMode,'credential');
});
test('dotted receiver identities can use their signed asset access token',linux,async t=>{
 const app=await fixture(t),{ack}=await hello(t,app,'screen.dot');assert.equal(ack.type,'hello.ack');
 fs.mkdirSync(path.join(app.dir,'media'),{recursive:true});fs.writeFileSync(path.join(app.dir,'media','fixture.txt'),'fixture-media');
 const r=await app.request('/media/fixture.txt?access_token='+encodeURIComponent(ack.assetAccessToken),{auth:false});assert.equal(r.status,200);assert.equal(await r.text(),'fixture-media');
});
test('unknown and disabled receivers cannot obtain a direct display identity',linux,async t=>{
 const app=await fixture(t);for(const id of ['unknown','disabled'])assert.equal((await hello(t,app,id)).ack.type,'error');
});
test('a credential for one exact receiver cannot authenticate its differently cased peer',linux,async t=>{
 const app=await fixture(t,{required:true});assert.equal((await hello(t,app,'screen-a',{credential:app.credential})).ack.type,'error');
});
test('ambiguous casing and malformed receiver aliases fail closed',linux,async t=>{
 const app=await fixture(t);
 for(const id of ['SCREEN-A','screen-!a'])assert.equal((await hello(t,app,id)).ack.type,'error');
 const {ack}=await hello(t,app,'ONLYUPPER');assert.equal(ack.type,'hello.ack');assert.equal(ack.deviceId,'OnlyUpper');
});
test('explicit commands retain the exact configured receiver target',linux,async t=>{
 const app=await fixture(t);await hello(t,app,'Screen-A');await hello(t,app,'screen-a');
 const r=await app.request('/api/v1/commands',{method:'POST',body:{type:'display.clear',target:'Screen-A',payload:{}}});
 assert.equal(r.status,200);assert.deepEqual((await r.json()).deliveries.websocket,['Screen-A']);
});
test('authorized preview sockets retain exact receiver identity without becoming physical deliveries',linux,async t=>{
 const app=await fixture(t),{ack}=await hello(t,app,'Screen-A',{role:'preview'});assert.equal(ack.type,'hello.ack');assert.equal(ack.deviceId,'Screen-A');
 const r=await app.request('/api/v1/commands',{method:'POST',body:{type:'display.clear',target:'Screen-A',payload:{}}});assert.deepEqual((await r.json()).deliveries.websocket,[]);
});
test('revoked credentials invalidate signed assets and cannot reconnect',linux,async t=>{
 const app=await fixture(t,{required:true}),{ack}=await hello(t,app,'Screen-A',{credential:app.credential});assert.equal(ack.type,'hello.ack');
 fs.mkdirSync(path.join(app.dir,'media'),{recursive:true});fs.writeFileSync(path.join(app.dir,'media','fixture.txt'),'fixture-media');
 let r=await app.request('/media/fixture.txt?access_token='+encodeURIComponent(ack.assetAccessToken),{auth:false});assert.equal(r.status,200);await r.text();
 r=await app.request('/media/fixture.txt?access_token='+encodeURIComponent(ack.assetAccessToken.replace('Screen-A.','screen-a.')),{auth:false});assert.equal(r.status,401);await r.text();
 r=await app.request('/api/v1/admin/display-credentials/'+app.credentialId,{method:'DELETE'});assert.equal(r.status,200);await r.text();
 r=await app.request('/media/fixture.txt?access_token='+encodeURIComponent(ack.assetAccessToken),{auth:false});assert.equal(r.status,401);await r.text();
 assert.equal((await hello(t,app,'Screen-A',{credential:app.credential})).ack.type,'error');
});
test('saved announcement target IDs preserve their configured casing',linux,async t=>{
 const app=await fixture(t),r=await app.request('/api/v1/automations/morning-announcements',{method:'PUT',body:{enabled:false,streamUrl:'',targets:['OnlyUpper']}});
 assert.equal(r.status,200);assert.deepEqual((await r.json()).config.targets,['OnlyUpper']);
});
test('saved automation and overlay targets retain exact receiver IDs',linux,async t=>{
 const app=await fixture(t),r=await app.request('/api/v1/automations',{method:'POST',body:{name:'Fixture identity',enabled:false,time:'00:00',scheduleMode:'weekly',days:[0],action:'display.clear',targets:['Screen-A'],timerOverlay:{enabled:true,targets:['OnlyUpper'],useEventTargets:false}}});
 assert.equal(r.status,200);const {event}=await r.json();assert.deepEqual(event.targets,['Screen-A']);assert.deepEqual(event.actionSequence[0].targets,['Screen-A']);assert.deepEqual(event.timerOverlay.targets,['OnlyUpper']);
});
test('saved class default targets retain exact receiver IDs',linux,async t=>{
 const app=await fixture(t),r=await app.request('/api/v1/class-schedules',{method:'POST',body:{name:'Fixture identity',enabled:false,startTime:'08:00',endTime:'09:00',scheduleMode:'weekly',days:[1],defaultTargets:['OnlyUpper']}});
 assert.equal(r.status,200);assert.deepEqual((await r.json()).classSchedule.defaultTargets,['OnlyUpper']);
});
test('existing long group saves retain their key and exact receiver membership',linux,async t=>{
 const group='display-LongHistoricalGroup'+'-Segment'.repeat(15),app=await fixture(t,{groups:{[group]:['OnlyUpper']}});
 const r=await app.request('/api/v1/config/groups/'+encodeURIComponent(group),{method:'POST',body:{members:['Screen-A','OnlyUpper']}});
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.id,group);assert.deepEqual(body.members,['Screen-A','OnlyUpper']);
});
