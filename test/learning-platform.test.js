"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {LearningPlatform,classroomRequest,normalizeSettings}=require('../src/learning-platform');
const campus={socket:{remoteAddress:'192.0.2.10'},headers:{}};
const remote={socket:{remoteAddress:'198.51.100.10'},headers:{}};
const options=()=>({displays:[{id:'screen-a'}],lights:[{id:'light-a'}],assets:[{id:'image-a',kind:'image'},{id:'sound-a',kind:'sound'}]});
async function setup(t,dispatch){let now=Date.now();const sent=[];const f=await fixture({platformOptions:{clock:()=>now,options,dispatch:dispatch|| (async(action,context)=>{sent.push({action,context});return {ok:true};})}});t.after(f.close);const p=f.learning.platform;
 const id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic arcade',templateId:'scorm-connector-v1'});p.configure(f.admin,id,{points:50});p.saveSettings(f.admin,{classroomNetworks:['192.0.2.0/24'],networksConfirmed:true});
 const event=(sequence,extra={})=>({id:crypto.randomUUID(),sequence,learnerKey:f.a.id,kind:'score',raw:80,occurredAt:new Date(now).toISOString(),...extra});
 return {...f,p,id,sent,event,advance:ms=>now+=ms};}
function start(f){f.p.start(f.admin,f.classId,60);f.p.admit(f.admin,f.classId,[f.a.id]);f.p.saveRecipe(f.admin,f.classId,{label:'Scoreboard',eventKind:'score',enabled:true,actions:[{kind:'leaderboard',targets:['screen-a']}]});}
test('off-campus work is retained without touching an active classroom board or effect',async t=>{
 const f=await setup(t);start(f);await f.p.record(f.a,f.id,f.event(1),campus);assert.equal(f.sent.length,1);
 const r=await f.p.record(f.a,f.id,f.event(2,{raw:100}),remote);assert.equal(r.state.progress.earned,50);assert.equal(r.classroom,false);assert.equal(f.sent.length,1);assert.equal(f.p.session(f.admin,f.classId).board[0].earned,40);
});
test('session, confirmed network and explicit attendance are all necessary',async t=>{
 const f=await setup(t);assert.equal((await f.p.record(f.a,f.id,f.event(1),campus)).classroom,false);
 f.p.start(f.admin,f.classId,60);assert.equal((await f.p.record(f.a,f.id,f.event(2),campus)).classroom,false);
 f.p.admit(f.admin,f.classId,[f.a.id]);f.p.saveSettings(f.admin,{classroomNetworks:['192.0.2.0/24']});assert.equal((await f.p.record(f.a,f.id,f.event(3),campus)).classroom,false);
 f.p.saveSettings(f.admin,{classroomNetworks:['192.0.2.0/24'],networksConfirmed:true});f.p.stop(f.admin,f.classId);assert.equal((await f.p.record(f.a,f.id,f.event(4),campus)).classroom,false);assert.equal(f.sent.length,0);
});
test('delayed, duplicate and out-of-order events do not produce later classroom effects',async t=>{
 const f=await setup(t);start(f);const e=f.event(1);await f.p.record(f.a,f.id,e,remote);assert.equal((await f.p.record(f.a,f.id,e,campus)).duplicate,true);assert.equal(f.sent.length,0);
 const old=f.event(2);f.advance(31000);assert.equal((await f.p.record(f.a,f.id,old,campus)).classroom,false);
 await f.p.record(f.a,f.id,f.event(5,{raw:70}),campus);f.advance(16000);assert.equal((await f.p.record(f.a,f.id,f.event(3,{raw:100}),campus)).classroom,false);assert.equal(f.p.state(f.a,f.id).progress.raw,70);assert.equal(f.sent.length,1);
 await assert.rejects(()=>f.p.record(f.a,f.id,{...e,raw:99},campus),{status:409});
});
test('restart keeps progress but stops sessions and never replays hardware writes',async t=>{
 const f=await setup(t);start(f);await f.p.record(f.a,f.id,f.event(1),campus);
 const p=new LearningPlatform(f.learning,{options,dispatch:async()=>{throw Error('must not dispatch');}});assert.equal(p.currentSession(f.classId),null);assert.equal(p.state(f.a,f.id).progress.raw,80);assert.equal((await p.record(f.a,f.id,f.event(2),campus)).classroom,false);
});
test('stopping during an effect prevents subsequent actions',async t=>{
 let entered,release;const started=new Promise(r=>entered=r),blocked=new Promise(r=>release=r);let calls=0;
 const f=await setup(t,async()=>{calls++;entered();await blocked;return {ok:true};});f.p.start(f.admin,f.classId,60);f.p.admit(f.admin,f.classId,[f.a.id]);f.p.saveRecipe(f.admin,f.classId,{label:'Two steps',eventKind:'score',enabled:true,actions:[{kind:'leaderboard',targets:['screen-a']},{kind:'lights',targets:['light-a'],color:'#146b58'}]});
 const work=f.p.record(f.a,f.id,f.event(1),campus);await started;f.p.stop(f.admin,f.classId);release();assert.equal((await work).effect.status,'cancelled');assert.equal(calls,1);
});
test('unconfirmed physical commands are recorded without automatic replay',async t=>{
 let calls=0;const f=await setup(t,async()=>{calls++;throw Error('transport uncertain');});start(f);const e=f.event(1);assert.equal((await f.p.record(f.a,f.id,e,campus)).effect.status,'unconfirmed');await f.p.record(f.a,f.id,e,campus);assert.equal(calls,1);
});
test('first-name projections exclude surname and resume data; AI context excludes identities',async t=>{
 const f=await setup(t);start(f);f.p.signedName(f.classId,f.a.id,'Alex');await f.p.record(f.a,f.id,f.event(1,{kind:'checkpoint',state:'private response'}),campus);await f.p.record(f.a,f.id,f.event(2),campus);
 const board=f.p.session(f.admin,f.classId).board;assert.equal(board[0].firstName,'Alex');assert.ok(!JSON.stringify(board).includes('private response'));assert.ok(!JSON.stringify(board).includes(f.a.id));const summary=JSON.stringify(f.p.summary(f.admin,f.classId));assert.ok(!summary.includes('Alex'));assert.ok(!summary.includes('private response'));
});
test('actor binding, membership, timestamps and numeric limits reject forged events',async t=>{
 const f=await setup(t);for(const patch of [{learnerKey:f.b.id},{raw:101},{raw:'90'},{sequence:0},{kind:'lights'},{kind:'checkpoint',state:'x'.repeat(4097)},{occurredAt:'not a date'}])await assert.rejects(()=>f.p.record(f.a,f.id,f.event(1,patch),campus));
 await assert.rejects(()=>f.p.record(f.outside,f.id,f.event(1,{learnerKey:f.outside.id}),campus),{status:404});
 f.learning.settings(f.admin,f.id,{open:false});await assert.rejects(()=>f.p.record(f.a,f.id,f.event(1),campus),{status:409});
});
test('teacher routes preserve authorization and export freeze',async t=>{
 const f=await setup(t);const base='/api/v1/learning/platform';assert.equal((await f.request(f.a,base+'/settings','PUT',{})).status,403);assert.equal((await f.request(f.a,base+'/classes/'+f.classId+'/start','POST',{minutes:60})).status,403);assert.equal((await f.request(null,base+'/activities/'+f.id+'/state')).status,401);
 f.freeze(true);assert.equal((await f.request(f.a,base+'/activities/'+f.id+'/events','POST',f.event(1))).status,423);assert.equal(f.p.state(f.a,f.id).sequence,0);
});
test('only explicitly configured targets, stored media and restrained effects can be approved',async t=>{
 const f=await setup(t);for(const action of [{kind:'shell',targets:['screen-a']},{kind:'lights',targets:['all'],color:'#00ff00'},{kind:'sound',targets:['screen-a'],assetId:'sound-a',volume:1},{kind:'image',targets:['screen-a'],assetId:'https://arbitrary.example.test/image'}])assert.throws(()=>f.p.saveRecipe(f.admin,f.classId,{label:'Bad recipe',eventKind:'score',enabled:true,actions:[action]}),{status:400});
});
test('network identity rejects spoofed forwarding and unconfirmed or overly broad rules',()=>{
 const cfg={networksConfirmed:true,classroomNetworks:['192.0.2.0/24']};assert.ok(classroomRequest(campus,cfg));assert.ok(!classroomRequest(remote,cfg));assert.ok(!classroomRequest({...campus,headers:{'cf-connecting-ip':'192.0.2.10'}},cfg));
 const forwarded={socket:{remoteAddress:'127.0.0.1'},headers:{'x-forwarded-proto':'https','cf-connecting-ip':'192.0.2.10','x-forwarded-for':'192.0.2.10','cf-ray':'1234567890abcdef-IAD'}};assert.ok(classroomRequest(forwarded,cfg));assert.ok(!classroomRequest({...forwarded,headers:{...forwarded.headers,'x-forwarded-for':'198.51.100.10'}},cfg));assert.ok(!classroomRequest(forwarded,{...cfg,networksConfirmed:false}));assert.throws(()=>normalizeSettings({classroomNetworks:['0.0.0.0/0']}));
});
test('malformed persisted settings and recipes fail closed without hardware writes',async t=>{
 const f=await setup(t);start(f);f.store.setPreference('learning.platform',{classroomNetworks:['invalid'],networksConfirmed:true});assert.equal((await f.p.record(f.a,f.id,f.event(1),campus)).classroom,false);
 f.p.saveSettings(f.admin,{classroomNetworks:['192.0.2.0/24'],networksConfirmed:true});f.p.db.prepare("UPDATE learning_effect_recipes SET config_json=?").run('{broken');await f.p.record(f.a,f.id,f.event(2),campus);assert.equal(f.sent.length,0);
 f.p.db.prepare('UPDATE learning_effect_recipes SET config_json=?').run(JSON.stringify({enabled:true,actions:[{kind:'shell',targets:['screen-a']}]}));assert.equal((await f.p.record(f.a,f.id,f.event(3),campus)).effect.status,'unconfirmed');assert.equal(f.sent.length,0);
});
test('offsite scores cannot enter the room board through a later progress-only update',async t=>{const f=await setup(t);start(f);await f.p.record(f.a,f.id,f.event(1),remote);await f.p.record(f.a,f.id,f.event(2,{kind:'progress',current:1,total:50}),campus);assert.equal(f.p.session(f.admin,f.classId).board[0].raw,undefined);assert.equal(f.p.state(f.a,f.id).progress.raw,80);});
test('teacher revocation or closing an assignment blocks the remaining effect actions',async t=>{
 let end,release;const began=new Promise(r=>end=r),pending=new Promise(r=>release=r);let calls=0;const f=await setup(t,async()=>{calls++;end();await pending;return {ok:true};});start(f);f.p.saveRecipe(f.admin,f.classId,{label:'Later action',eventKind:'completed',enabled:true,actions:[{kind:'leaderboard',targets:['screen-a']},{kind:'lights',targets:['light-a'],color:'#008800'}]});const work=f.p.record(f.a,f.id,f.event(1,{kind:'completed'}),campus);await began;f.learning.settings(f.admin,f.id,{open:false});release();assert.equal((await work).effect.status,'cancelled');assert.equal(calls,1);
});
