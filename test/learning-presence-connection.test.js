'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {LearningPresence}=require('../src/learning-presence');
const {flowCookie}=require('../src/learning-connection');
async function setup(t){let now=Date.now();const f=await fixture({platformOptions:{clock:()=>now}});t.after(f.close);const p=f.learning.platform,id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic connector',templateId:'scorm-connector-v1'});f.store.setPreference('learning.bridgeOrigins',['https://lms.example.test']);p.configure(f.admin,id,{points:50,launchUrl:'https://lms.example.test/launch'});p.saveSettings(f.admin,{classroomNetworks:['192.0.2.0/24'],networksConfirmed:true});p.start(f.admin,f.classId,60);p.admit(f.admin,f.classId,[f.a.id]);return {...f,p,id,user:{...f.a,learningSso:true,sessionId:crypto.randomUUID()},advance:ms=>now+=ms};}
const local={headers:{},socket:{remoteAddress:'192.0.2.10'}};
test('LAN proof is one-use and bound to the exact authenticated session, activity and event',async t=>{
 const f=await setup(t),event=crypto.randomUUID(),proof=f.p.presence.challenge(f.user,f.id,event);assert.ok(proof.available);
 assert.equal(f.p.presence.consume(f.user,f.id,event,proof.id),false);f.p.presence.attest(proof.id,local);
 for(const [u,a,e] of [[{...f.user,sessionId:'other'},f.id,event],[{...f.user,id:f.b.id},f.id,event],[f.user,f.activityId,event],[f.user,f.id,crypto.randomUUID()]])assert.equal(f.p.presence.consume(u,a,e,proof.id),false);
 assert.equal(f.p.presence.consume(f.user,f.id,event,proof.id),true);assert.equal(f.p.presence.consume(f.user,f.id,event,proof.id),false);
});
test('offsite, forwarded, expired and restarted LAN proofs cannot authorize effects',async t=>{
 const f=await setup(t),event=crypto.randomUUID();let proof=f.p.presence.challenge(f.user,f.id,event);
 for(const req of [{...local,socket:{remoteAddress:'198.51.100.1'}},{...local,headers:{'x-forwarded-for':'192.0.2.10'}}])assert.throws(()=>f.p.presence.attest(proof.id,req),{status:403});
 f.advance(8001);assert.throws(()=>f.p.presence.attest(proof.id,local),{status:409});proof=f.p.presence.challenge(f.user,f.id,event);f.p.presence.attest(proof.id,local);f.advance(5001);assert.equal(f.p.presence.consume(f.user,f.id,event,proof.id),false);
 proof=f.p.presence.challenge(f.user,f.id,event);f.p.presence.attest(proof.id,local);new LearningPresence(f.p);assert.equal(f.p.presence.consume(f.user,f.id,event,proof.id),false);
});
test('changing the confirmed network invalidates a previously attested proof',async t=>{const f=await setup(t),event=crypto.randomUUID(),proof=f.p.presence.challenge(f.user,f.id,event);f.p.presence.attest(proof.id,local);f.p.saveSettings(f.admin,{classroomNetworks:['198.51.100.0/24'],networksConfirmed:true});assert.equal(f.p.presence.consume(f.user,f.id,event,proof.id),false);});
test('a fresh signed LMS launch is mandatory even when an old SSO cookie exists',async t=>{
 const f=await setup(t),c=f.p.connection,flow=c.start(f.id,'https://lms.example.test');
 assert.throws(()=>c.authorize(f.user,f.id,flow.id),{status:401});assert.equal(c.signed(f.user,f.id,f.user.sessionId,flow.id),true);assert.doesNotThrow(()=>c.authorize(f.user,f.id,flow.id));
 assert.equal(c.signed(f.user,f.id,crypto.randomUUID(),flow.id),false);
 for(const [u,id] of [[{...f.user,sessionId:crypto.randomUUID()},f.id],[{...f.user,learningSso:false},f.id],[f.user,f.activityId]])assert.throws(()=>c.authorize(u,id,flow.id),{status:401});
 f.advance(28800001);assert.throws(()=>c.authorize(f.user,f.id,flow.id),{status:401});
});
test('connector setup rejects closed activities, wrong launch class and unapproved parent origins',async t=>{
 const f=await setup(t),c=f.p.connection;assert.throws(()=>c.start(f.id,'https://attacker.example.test'));
 const flow=c.start(f.id,'https://lms.example.test'),otherClass=f.learning.createClass(f.admin,'Another synthetic class');f.learning.enroll(f.admin,otherClass,{userId:f.a.id,alias:'A'});const other=f.learning.createActivity(f.admin,otherClass,{});
 assert.equal(c.signed(f.user,other,f.user.sessionId,flow.id),false);f.learning.settings(f.admin,f.id,{open:false});assert.throws(()=>c.start(f.id,'https://lms.example.test'));
 assert.equal(flowCookie({headers:{cookie:'other=1; roomgoblin_bridge_flow='+flow.id}}),flow.id);assert.equal(flowCookie({headers:{cookie:'roomgoblin_bridge_flow=invalid'}}),null);
});
