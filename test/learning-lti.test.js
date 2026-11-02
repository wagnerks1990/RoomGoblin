"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture,good}=require('./helpers/learning-fixture');
const {signature,LearningLti,COOKIE,learningSessionUser,outcomeUrl,outcomeBody,validateOutcome,postOutcome}=require('../src/learning-lti');
const secret='synthetic-lti-secret-not-real-0000000000000000';
const platform='https://lms.example.edu',outcomes='https://outcomes.example.edu';
async function setup(t,options={}){
 const f=await fixture(options);t.after(f.close);
 f.learning.lti.configure(f.admin,f.activityId,{appOrigin:f.base,platformOrigin:platform,consumerKey:'synthetic-consumer',sharedSecret:secret,enabled:true,outcomeOrigins:[outcomes]});
 const url=f.base+'/learn/lti/'+f.activityId;
 const params=(overrides={})=>{const p={lti_message_type:'basic-lti-launch-request',lti_version:'LTI-1p0',oauth_consumer_key:'synthetic-consumer',oauth_signature_method:'HMAC-SHA1',oauth_version:'1.0',oauth_timestamp:String(Math.floor(Date.now()/1000)),oauth_nonce:crypto.randomUUID(),context_id:'synthetic-course',resource_link_id:'synthetic-material',roles:'Learner',user_id:'synthetic-student',lis_person_name_full:'Example, Alex',...overrides};p.oauth_signature=signature('POST',url,Object.entries(p),secret);return p;};
 const launch=(p=params(),origin=platform)=>fetch(url,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:origin},body:new URLSearchParams(p)});
 const bind=()=>launch(params({roles:'Instructor',user_id:'synthetic-teacher'}));
 return {...f,url,params,launch,bind};
}
function response(id,code='success'){return `<imsx_POXEnvelopeResponse><imsx_POXHeader><imsx_POXResponseHeaderInfo><imsx_statusInfo><imsx_codeMajor>${code}</imsx_codeMajor><imsx_messageRefIdentifier>${id}</imsx_messageRefIdentifier><imsx_operationRefIdentifier>replaceResult</imsx_operationRefIdentifier></imsx_statusInfo></imsx_POXResponseHeaderInfo></imsx_POXHeader><imsx_POXBody><replaceResultResponse/></imsx_POXBody></imsx_POXEnvelopeResponse>`;}

test('OAuth normalization matches the RFC 5849 duplicate-parameter HMAC example',()=>{
 const entries=[...new URLSearchParams('c2&a3=2+q'),...Object.entries({oauth_consumer_key:'9djdj82h48djs9d2',oauth_token:'kkk9d7dh3k39sjv7',oauth_nonce:'7d8f3e4a',oauth_signature_method:'HMAC-SHA1',oauth_timestamp:'137131201'})];
 assert.equal(signature('POST','http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b',entries,'j49sk3j29djd','dh893hdasih9'),'r6/TJjbCOr97/+UU0NsvSne7s5g=');
});
test('signed instructor binds one course/material; students enter automatically with isolated access',async t=>{
 const f=await setup(t);assert.equal((await f.launch()).status,409);assert.equal((await f.bind()).status,200);
 assert.equal((await f.launch(f.params({context_id:'other-course'}))).status,403);
 assert.equal((await f.launch(f.params({resource_link_id:'other-material'}))).status,403);
 const r=await f.launch();assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/learn/?lms=1&activity='+f.activityId);
 const cookie=r.headers.get('set-cookie');assert(cookie.startsWith(COOKIE+'='));assert(cookie.includes('HttpOnly'));assert(!cookie.includes('classroom_hub_session='));
 const headers={cookie:cookie.split(';')[0]},view=await fetch(f.base+'/api/v1/learning/me',{headers});const me=await view.json();assert.equal(me.user.alias,'Example, Alex');assert.equal(me.user.lms,true);assert.equal(me.user.admin,false);assert.equal(me.classes.length,1);
 const user=f.store.listUsers().find(u=>u.displayName==='Example, Alex');assert.equal(user.profileId,'learning-student');assert.equal(user.role,'viewer');
 assert.equal(learningSessionUser({path:'/api/v1/admin',headers},f.store),undefined);
 assert.equal((await fetch(f.base+'/api/v1/learning/classes',{method:'POST',headers:{...headers,'Content-Type':'application/json','x-roomgoblin-learning':'1'},body:'{"title":"Unauthorized"}'})).status,403);
 assert.equal((await fetch(f.base+'/api/v1/learning/activities/'+f.activityId+'/lms-name',{method:'PUT',headers:{...headers,'Content-Type':'application/json','x-roomgoblin-learning':'1'},body:JSON.stringify({name:'Someone else',launcherOrigin:platform})})).status,403);
 const count=f.store.userCount();assert.equal((await f.launch(f.params({lis_person_name_full:'Example, Alex Updated'}))).status,303);assert.equal(f.store.userCount(),count);assert.equal(f.learning.membership(user,f.classId).alias,'Example, Alex Updated');
 const logout=await fetch(f.base+'/api/v1/learning/logout',{method:'POST',headers:{...headers,'Content-Type':'application/json','x-roomgoblin-learning':'1'},body:'{}'});assert.equal(logout.status,200);assert.equal((await fetch(f.base+'/api/v1/learning/me',{headers})).status,401);
});
test('tampering, stale timestamps, duplicate parameters, wrong origins and replay are rejected',async t=>{
 const f=await setup(t);await f.bind();
 for(const overrides of [{oauth_timestamp:'1000000000'},{oauth_timestamp:String(Math.floor(Date.now()/1000)+3600)},{oauth_signature_method:'PLAINTEXT'},{roles:'Administrator'},{oauth_consumer_key:'other'},{oauth_token:'unexpected'}])assert((await f.launch(f.params(overrides))).status>=400);
 const changed=f.params();changed.user_id='impersonated';assert.equal((await f.launch(changed)).status,401);
 assert.equal((await f.launch(f.params(),'https://foreign.example.edu')).status,401);
 const missingOrigin=await fetch(f.url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(f.params())});assert.equal(missingOrigin.status,401);
 const duplicate=new URLSearchParams(f.params());duplicate.append('user_id','other');const r=await fetch(f.url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:duplicate});assert.equal(r.status,400);
 const p=f.params();assert.equal((await f.launch(p)).status,303);assert.equal((await f.launch(p)).status,401);
 // Persisted replay checks survive process reconstruction.
 f.learning.lti=new LearningLti(f.learning);assert.throws(()=>f.learning.lti.launch(f.activityId,p,platform,f.url),/already been used/);
});
test('disabled accounts, removed memberships, disabled integrations and export freeze fail closed',async t=>{
 const f=await setup(t);await f.bind();await f.launch();const user=f.store.listUsers().find(u=>u.displayName==='Example, Alex');
 f.store.db.prepare('UPDATE users SET enabled=0 WHERE id=?').run(user.id);assert.equal((await f.launch()).status,403);f.store.db.prepare('UPDATE users SET enabled=1 WHERE id=?').run(user.id);
 f.store.db.prepare('DELETE FROM learning_members WHERE class_id=? AND user_id=?').run(f.classId,user.id);assert.equal((await f.launch()).status,404);
 f.freeze(true);assert.equal((await f.launch(f.params({user_id:'new'}))).status,423);f.freeze(false);
 f.store.setPreference(f.learning.lti.key(f.activityId),{...f.learning.lti.config(f.activityId),enabled:false});assert.equal((await f.launch()).status,401);
});
test('LTI configuration remains admin-only, encrypted and course-bound',async t=>{
 const f=await setup(t),path='/api/v1/learning/activities/'+f.activityId+'/lti';
 assert.equal((await f.request(f.a,path)).status,403);assert.equal((await f.request(f.a,path,'PUT',{})).status,403);
 const settings=await f.request(f.admin,path);assert.equal(settings.body.settings.secretConfigured,true);assert(!JSON.stringify(settings.body).includes(secret));assert(!JSON.stringify(f.store.getPreference(f.learning.lti.key(f.activityId),{})).includes(secret));
 await f.bind();assert.throws(()=>f.learning.lti.configure(f.admin,f.activityId,{...settings.body.settings,platformOrigin:'https://another.example.edu',sharedSecret:''}),/new activity/);
});
test('published server grade is sent automatically and teacher corrections replace the prior outcome',async t=>{
 const sent=[];const f=await setup(t,{ltiOptions:{send:async(url,headers,body)=>{sent.push({url,headers,body});return response(body.match(/<imsx_messageIdentifier>([^<]+)</)[1]);}}});await f.bind();
 const r=await f.launch(f.params({lis_outcome_service_url:outcomes+'/grade',lis_result_sourcedid:'synthetic-target<&>'})),cookie=r.headers.get('set-cookie').split(';')[0];
 const user=f.store.listUsers().find(u=>u.displayName==='Example, Alex');f.cookies[user.id]=cookie;
 const path='/api/v1/learning/activities/'+f.activityId;
 const post=await f.request(user,path+'/posts','POST',{kind:'initial',body:'Synthetic initial explanation.'});assert.equal(post.status,200);assert.equal(sent.length,1);assert(sent[0].body.includes('<textString>0.85</textString>'));assert(sent[0].body.includes('synthetic-target&lt;&amp;&gt;'));assert(!sent[0].body.includes('Example, Alex'));assert.equal(sent[0].headers['Content-Type'],'application/xml');assert(sent[0].headers.Authorization.includes('oauth_body_hash'));
 assert.equal(f.learning.lti.status(user,f.activityId).state,'sent');await f.learning.lti.sync(user,f.activityId);assert.equal(sent.length,1);
 const review=f.learning.currentReview(user,f.activityId),grade=good();grade.criteria.claim.points=3;grade.criteria.reply.points=0;
 await f.request(f.admin,path+'/reviews/'+review.id+'/approve','POST',{criteria:grade.criteria,summary:'Teacher corrected the claim.'});assert.equal(sent.length,2);assert(sent[1].body.includes('<textString>0.7</textString>'));
});
test('unapproved outcomes cannot receive credentials; failures retain grade for a safe retry',async t=>{
 let calls=0;const f=await setup(t,{ltiOptions:{send:async()=>{calls++;throw Error('private service detail');}}});await f.bind();await f.launch(f.params({lis_outcome_service_url:'https://unapproved.example.edu/grade',lis_result_sourcedid:'synthetic-target'}));
 const user=f.store.listUsers().find(u=>u.displayName==='Example, Alex');f.cookies[user.id]='classroom_hub_session='+f.store.createSession(user).token;
 await f.request(user,'/api/v1/learning/activities/'+f.activityId+'/posts','POST',{kind:'initial',body:'Synthetic writing.'});assert.equal(calls,0);assert.equal(f.learning.currentReview(user,f.activityId).status,'approved');assert.equal(f.learning.lti.status(user,f.activityId).state,'failed');
 const cfg=f.learning.lti.config(f.activityId);f.store.setPreference(f.learning.lti.key(f.activityId),{...cfg,outcomeOrigins:['https://unapproved.example.edu']});assert.deepEqual(await f.learning.lti.sync(user,f.activityId),{state:'failed'});assert.equal(calls,1);
});
test('outcome XML accepts only a well-formed matching success and rejects entities',()=>{
 validateOutcome(response('synthetic-id'),'synthetic-id');
 for(const body of [response('other'),response('synthetic-id','failure'),response('synthetic-id').replace('replaceResultResponse','deleteResultResponse'),'<!DOCTYPE x [<!ENTITY secret SYSTEM "file:///private">]>'+response('synthetic-id'),response('synthetic-id').slice(0,-5)])assert.throws(()=>validateOutcome(body,'synthetic-id'));
 assert(outcomeBody('test','<target>',0).includes('&lt;target&gt;'));assert.throws(()=>outcomeUrl('http://127.0.0.1/grade',['http://127.0.0.1']));assert.throws(()=>outcomeUrl('https://user:password@example.edu/grade',['https://example.edu']));
});
test('outcome transport rejects private DNS before making any credential-bearing request',async()=>{
 let called=false;await assert.rejects(postOutcome(new URL('https://outcomes.example.edu/grade'),{Authorization:'synthetic'},'body',{lookup:async()=>[{address:'127.0.0.1',family:4}],request:()=>{called=true;}}));assert.equal(called,false);
});

test('Schoology cartridge is well-formed, credential-free and teacher-only',async t=>{
 const f=await setup(t),path='/api/v1/learning/activities/'+f.activityId+'/lti-package';
 assert.equal((await f.request(f.a,path)).status,403);
 const result=await f.request(f.admin,path);assert.equal(result.status,200);
 const zip=new(require('adm-zip'))(result.body),{XMLValidator,XMLParser}=require('fast-xml-parser');
 assert.deepEqual(zip.getEntries().map(e=>e.entryName).sort(),['imsmanifest.xml','launch.xml']);
 for(const entry of zip.getEntries()){const content=entry.getData().toString();assert.equal(XMLValidator.validate(content),true);assert(!content.includes(secret));assert(!content.includes('synthetic-consumer'));}
 const launch=new XMLParser().parse(zip.readAsText('launch.xml')).cartridge_basiclti_link;assert.equal(launch.launch_url,f.url);
 f.store.db.prepare('INSERT INTO learning_lti_results VALUES(?,?,?,?,?,?)').run(f.activityId,f.a.id,'malformed','synthetic',null,'pending');
 assert.deepEqual(f.learning.lti.settings(f.activityId).observedOutcomeOrigins,[]);
});

test('overlapping grade corrections are serialized and stale target responses cannot confirm a new target',async t=>{
 const f=await setup(t);await f.bind();await f.launch(f.params({lis_outcome_service_url:outcomes+'/grade',lis_result_sourcedid:'old-target'}));
 const user=f.store.listUsers().find(u=>u.displayName==='Example, Alex');f.cookies[user.id]='classroom_hub_session='+f.store.createSession(user).token;
 f.learning.lti.send=async(_url,_headers,body)=>response(body.match(/<imsx_messageIdentifier>([^<]+)</)[1]);
 await f.request(user,'/api/v1/learning/activities/'+f.activityId+'/posts','POST',{kind:'initial',body:'Synthetic writing.'});
 const review=f.learning.currentReview(user,f.activityId),grade=good();grade.criteria.claim.points=3;grade.criteria.reply.points=0;
 f.learning.approve(f.admin,f.activityId,review.id,{criteria:grade.criteria,summary:'First correction.'});
 const pending=[],sent=[];let active=0,maximum=0;
 f.learning.lti.send=(_url,_headers,body)=>{active++;maximum=Math.max(maximum,active);sent.push(body);return new Promise(resolve=>pending.push(()=>{active--;resolve(response(body.match(/<imsx_messageIdentifier>([^<]+)</)[1]));}));};
 const first=f.learning.lti.sync(user,f.activityId);await new Promise(setImmediate);assert.equal(sent.length,1);
 await f.launch(f.params({lis_outcome_service_url:outcomes+'/grade',lis_result_sourcedid:'new-target'}));
 grade.criteria.claim.points=6;f.learning.approve(f.admin,f.activityId,review.id,{criteria:grade.criteria,summary:'Latest correction.'});
 const second=f.learning.lti.sync(user,f.activityId);await new Promise(setImmediate);assert.equal(sent.length,1);
 pending.shift()();await first;await new Promise(setImmediate);assert.equal(sent.length,2);assert.equal(f.learning.lti.status(user,f.activityId).state,'pending');
 pending.shift()();await second;assert.equal(maximum,1);assert(sent[0].includes('<textString>0.7</textString>'));assert(sent[1].includes('<textString>0.85</textString>'));assert(sent[1].includes('<sourcedId>new-target</sourcedId>'));assert.equal(f.learning.lti.status(user,f.activityId).state,'sent');
});
