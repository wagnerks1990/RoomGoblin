'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {signature}=require('../src/learning-lti');
const platform='https://lms.example.edu',secret='synthetic-concurrent-secret-000000000000000';
async function setup(t){
 const f=await fixture();t.after(f.close);const p=f.learning.platform;
 const identity=f.learning.createActivity(f.admin,f.classId,{title:'Class identity',templateId:'scorm-connector-v1'});
 const assessment=f.learning.createActivity(f.admin,f.classId,{title:'Do Now',templateId:'scorm-connector-v1'});
 f.store.setPreference('learning.bridgeOrigins',[platform]);
 for(const id of [assessment,f.activityId])p.configure(f.admin,id,{points:20,launchUrl:platform+'/launch'});
 f.learning.lti.configure(f.admin,identity,{appOrigin:f.base,platformOrigin:platform,consumerKey:'synthetic',sharedSecret:secret,enabled:true,outcomeOrigins:[]});
 const url=f.base+'/learn/lti/'+identity;
 function params(subject='learner',role='Learner'){const v={lti_message_type:'basic-lti-launch-request',lti_version:'LTI-1p0',oauth_consumer_key:'synthetic',oauth_signature_method:'HMAC-SHA1',oauth_timestamp:String(Math.floor(Date.now()/1000)),oauth_nonce:crypto.randomUUID(),context_id:'synthetic-course',resource_link_id:'synthetic-identity',roles:role,user_id:subject,lis_person_name_given:'Alex',lis_person_name_full:'Alex Example'};v.oauth_signature=signature('POST',url,Object.entries(v),secret);return v;}
 f.learning.lti.launch(identity,params('teacher','Instructor'),platform,url);
 let browserCookie='';
 async function start(id){const r=await f.rawRequest(null,'/learn/connect/start','POST',{activityId:id,parent:platform},{origin:f.base,cookie:browserCookie});assert.equal(r.status,200);return r.body.id;}
 async function sign(flow,subject='learner',expected=303){
  // The Lax learning cookie is absent on this cross-site POST. The browser
  // retains it, while the SameSite=None one-use flow cookie is sent.
  const r=await fetch(url,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:platform,Cookie:'roomgoblin_bridge_flow='+flow},body:new URLSearchParams(params(subject))});
  assert.equal(r.status,expected);const next=r.headers.getSetCookie().find(x=>x.startsWith('roomgoblin_learning_session='));if(next)browserCookie=next.split(';')[0];return r;
 }
 const state=(id,flow)=>f.rawRequest(null,'/api/v1/learning/platform/activities/'+id+'/state','GET',undefined,{cookie:browserCookie,'x-roomgoblin-connection':flow});
 return {...f,p,identity,assessment,start,sign,state,cookie:()=>browserCookie};
}

test('a second signed assignment leaves the first assignment session writable',async t=>{
 const f=await setup(t),first=await f.start(f.assessment);await f.sign(first);assert.equal((await f.state(f.assessment,first)).status,200);
 const second=await f.start(f.activityId);assert.equal((await f.state(f.activityId,second)).status,401,'old cookie cannot authorize an unsigned flow');await f.sign(second);
 assert.equal((await f.state(f.activityId,second)).status,200);
 assert.equal((await f.state(f.assessment,first)).status,200,'opening Discussion must not disconnect Do Now');
 const renewed=await f.start(f.assessment);await f.sign(renewed);
 for(const [id,flow] of [[f.assessment,first],[f.activityId,second],[f.assessment,renewed]])assert.equal((await f.state(id,flow)).status,200);
});

test('fresh signed identity cannot reuse another learner session or read their flow',async t=>{
 const f=await setup(t),first=await f.start(f.assessment);await f.sign(first);const cookie=f.cookie();
 const second=await f.start(f.activityId);await f.sign(second,'other-learner');
 assert.notEqual(f.cookie(),cookie);assert.equal((await f.state(f.assessment,first)).status,401);assert.equal((await f.state(f.activityId,second)).status,200);
});

for(const invalidation of ['expired','revoked'])test(invalidation+' sessions are replaced only after a new signed launch',async t=>{
 const f=await setup(t),first=await f.start(f.assessment);await f.sign(first);const cookie=f.cookie(),second=await f.start(f.activityId);
 const session=f.store.sessionUser(cookie.split('=')[1]);
 if(invalidation==='expired')f.store.db.prepare('UPDATE user_sessions SET expires_at=? WHERE id=?').run('2000-01-01T00:00:00Z',session.sessionId);
 else f.store.deleteUserSession(session.id,session.sessionId);
 assert.equal((await f.state(f.activityId,second)).status,401);await f.sign(second);assert.notEqual(f.cookie(),cookie);assert.equal((await f.state(f.activityId,second)).status,200);
 assert.equal((await f.state(f.assessment,first)).status,401);
});

test('reusing the browser session does not extend its expiry or preserve disabled access',async t=>{
 const f=await setup(t),first=await f.start(f.assessment);await f.sign(first);const cookie=f.cookie(),session=f.store.sessionUser(cookie.split('=')[1]);
 const second=await f.start(f.activityId);await f.sign(second);assert.equal(f.cookie(),cookie);assert.equal(f.store.sessionUser(cookie.split('=')[1]).expiresAt,session.expiresAt);
 const third=await f.start(f.assessment);f.store.db.prepare('UPDATE users SET enabled=0 WHERE id=?').run(session.id);await f.sign(third,'learner',403);assert.equal((await f.state(f.activityId,second)).status,401);
});

test('simultaneous first launches converge after one signed renewal without session ping-pong',async t=>{
 const f=await setup(t),first=await f.start(f.assessment),second=await f.start(f.activityId);await f.sign(first);await f.sign(second);
 assert.equal((await f.state(f.assessment,first)).status,401);
 const renewed=await f.start(f.assessment);await f.sign(renewed);
 assert.equal((await f.state(f.assessment,renewed)).status,200);assert.equal((await f.state(f.activityId,second)).status,200);
});

test('expired or already-signed flows cannot supply a session candidate',async t=>{
 const f=await setup(t),first=await f.start(f.assessment);await f.sign(first);const second=await f.start(f.activityId);
 assert(f.p.connection.candidate(second,f.identity));f.store.db.prepare('UPDATE learning_bridge_flows SET expires_at=0 WHERE id=?').run(second);assert.equal(f.p.connection.candidate(second,f.identity),null);
 const third=await f.start(f.activityId);await f.sign(third);assert.equal(f.p.connection.candidate(third,f.identity),null);
 assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_bridge_candidates WHERE flow_id IN (?,?)').get(second,third).n,0);
});
