"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');const {allowedPath}=require('../src/learning-public');
const key=()=>crypto.randomBytes(32).toString('hex');
async function setup(t,options={}){const f=await fixture(options);t.after(f.close);f.learning.platform.configure(f.admin,f.activityId,{points:20});const enrollmentKey=f.learning.direct.issue(f.admin,f.activityId),token=key();const enroll=(tokenValue=token,reportedId='reported-1',name='Reported Learner')=>f.rawRequest(null,'/api/v1/learning/direct/activities/'+f.activityId+'/enroll','POST',{participantToken:tokenValue,reportedId,name},{Authorization:'RoomGoblin-Assignment '+enrollmentKey,Origin:'https://arbitrary-lms.example.test'});const call=(path,method='GET',body,tokenValue=token)=>f.rawRequest(null,'/api/v1/learning/direct'+path,method,body,{Authorization:'Bearer '+tokenValue,Origin:'https://arbitrary-lms.example.test'});return {...f,enrollmentKey,token,enroll,call};}

test('direct enrollment needs no roster, origin preapproval or cookie and is retry-safe',async t=>{
 const f=await setup(t),a=await f.enroll();assert.equal(a.status,200);assert.equal(a.body.identitySource,'SCORM-reported');assert.equal((await f.enroll()).body.state.learnerKey,a.body.state.learnerKey);
 assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_direct_participants').get().n,1);assert.equal(f.learning.membership({id:a.body.state.learnerKey},f.classId).role,'student');
 assert.equal((await f.enroll(f.token,'somebody-else')).status,409);const b=await f.enroll(key(),'reported-1');assert.equal(b.status,200);assert.notEqual(b.body.state.learnerKey,a.body.state.learnerKey);
 assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM user_sessions WHERE user_id=?').get(a.body.state.learnerKey).n,0);assert(!JSON.stringify(f.store.listUsers()).includes(f.token));assert.equal(a.headers.get('access-control-allow-origin'),'*');assert.equal(a.headers.get('access-control-allow-credentials'),null);
});

test('direct bearer can access only its own assignment and cannot use a teacher cookie',async t=>{
 const f=await setup(t);await f.enroll();assert.equal((await f.call('/activities/'+f.activityId)).status,200);
 const other=f.learning.createActivity(f.admin,f.classId,{title:'Another assignment'});
 for(const path of ['/activities/'+other,'/teacher/classes/'+f.classId,'/classes/'+f.classId,'/activities/'+f.activityId+'/lti','/platform/classes/'+f.classId])assert([401,404].includes((await f.call(path)).status));
 assert.equal((await f.rawRequest(f.admin,'/api/v1/learning/direct/activities/'+f.activityId)).status,401);
 const actor=(await f.enroll()).body.state.learnerKey;assert.throws(()=>f.learning.activity({id:actor},other),{status:404});
 f.learning.db.prepare('DELETE FROM learning_members WHERE user_id=? AND class_id=?').run(actor,f.classId);assert.equal((await f.enroll()).status,404);
});

test('direct route allowlist supports narrow CORS preflight and rejects public teacher/control routes',async t=>{
 const f=await setup(t),path='/api/v1/learning/direct/activities/'+f.activityId+'/enroll';
 assert.equal(allowedPath('OPTIONS',path),true);assert.equal(allowedPath('POST',path),true);assert.equal(allowedPath('DELETE',path),false);assert.equal(allowedPath('POST','/learn/direct-presence/attest'),false);
 for(const path of ['/api/v1/learning/direct/teacher/classes','/api/v1/learning/teacher/classes','/api/v1/learning/direct/activities/'+f.activityId+'/lti'])assert.equal(allowedPath('GET',path),false);
 const r=await f.rawRequest(null,path,'OPTIONS',undefined,{'Access-Control-Request-Method':'POST',Origin:'https://new-player.example.test'});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'*');
});

test('direct reports are bound, idempotent and retain private teacher feedback',async t=>{
 const f=await setup(t),a=(await f.enroll()).body.state,other=key();await f.enroll(other,'other','Other');
 const event={id:crypto.randomUUID(),sequence:1,learnerKey:a.learnerKey,kind:'submission',raw:75,answers:{evidence:'Use a verified backup and test the restore.'},occurredAt:new Date().toISOString()},path='/platform/activities/'+f.activityId+'/events';
 assert.equal((await f.call(path,'POST',event)).body.saved,true);assert.equal((await f.call(path,'POST',event)).body.duplicate,true);assert.equal((await f.call(path,'POST',{...event,raw:50})).status,409);assert.equal((await f.call(path,'POST',event,other)).status,409);
 const row=f.learning.portal.overview(f.admin,f.classId).submissions[0];f.learning.portal.review(f.admin,row.id,{revision:0,score:18,feedback:'PRIVATE DIRECT FEEDBACK'});
 assert.equal((await f.call('/platform/activities/'+f.activityId+'/state')).body.submissionReview.feedback,'PRIVATE DIRECT FEEDBACK');assert(!JSON.stringify((await f.call('/platform/activities/'+f.activityId+'/state','GET',undefined,other)).body).includes('PRIVATE DIRECT FEEDBACK'));
});

test('direct written discussion receives automatic feedback and grade without a launcher session',async t=>{
 const f=await setup(t);await f.enroll();const result=await f.call('/activities/'+f.activityId+'/posts','POST',{kind:'initial',body:'The subnet mask establishes separate local network boundaries. Verify the actual router before claiming reachability.'});assert.equal(result.status,200);
 await f.learning.reviewQueue.drain();const receipt=await f.call('/activities/'+f.activityId+'/receipt');assert.equal(receipt.status,200);assert.equal(receipt.body.possible,20);
 const view=await f.call('/activities/'+f.activityId);assert(view.body.posts.some(p=>p.role==='ai'));assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_lti_users').get().n,0);
});

test('direct activation, package export and reports respect freeze and teacher ownership',async t=>{
 const f=await setup(t);await f.enroll();f.freeze(true);assert.equal((await f.enroll(key())).status,423);assert.equal((await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.activityId+'/direct-package','POST',{})).status,423);
 assert.equal((await f.call('/platform/activities/'+f.activityId+'/state')).status,200);f.freeze(false);
 assert.equal((await f.request(f.a,'/api/v1/learning/teacher/activities/'+f.activityId+'/direct-package','POST',{})).status,403);
 const pkg=await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.activityId+'/direct-package','POST',{});assert.equal(pkg.status,200);const zip=new(require('adm-zip'))(pkg.body);assert(zip.test());assert(zip.readAsText('config.js').includes('"transport":"direct"'));assert(!zip.getEntry('bridge.js'));assert(!zip.readAsText('index.html').includes('window.open'));
 await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.activityId+'/direct-settings','PUT',{enabled:false});assert.equal((await f.call('/activities/'+f.activityId)).status,401);
});

test('generic written submissions use teacher rubric, private AI feedback and durable server jobs',async t=>{
 let calls=0;const f=await setup(t,{reviewOptions:{intervalMs:0,assignmentModelJSON:async(options,request)=>{calls++;assert(!request.input.includes('Reported Learner'));return {criteria:[{id:'1',points:17,feedback:'The answer identifies a concrete restore test.'}],summary:'Specific supporting evidence; explain the recovery limit.'};}}});
 const id=f.learning.portal.createAssignment(f.admin,f.classId,{title:'Backup evidence',points:20}),enrollKey=f.learning.direct.issue(f.admin,id),token=key();
 f.learning.assignmentAI.configure(f.admin,id,{enabled:true,prompt:'Describe a safe backup and restore verification.',criteria:[{label:'Evidence',points:20,description:'Concrete backup and restore checks with a limitation.'}]});
 const e=await f.rawRequest(null,'/api/v1/learning/direct/activities/'+id+'/enroll','POST',{participantToken:token,reportedId:'generic-learner',name:'Reported Learner'},{Authorization:'RoomGoblin-Assignment '+enrollKey});
 const event={id:crypto.randomUUID(),sequence:1,learnerKey:e.body.state.learnerKey,kind:'submission',raw:100,answers:{evidence:'Verify the backup hash, restore a copy and test the files.'},occurredAt:new Date().toISOString()};
 const headers={Authorization:'Bearer '+token};assert.equal((await f.rawRequest(null,'/api/v1/learning/direct/platform/activities/'+id+'/events','POST',event,headers)).status,200);
 f.freeze(true);await f.learning.assignmentAI.drain();assert.equal(calls,0);f.freeze(false);await f.learning.assignmentAI.drain();assert.equal(calls,1);
 const state=await f.rawRequest(null,'/api/v1/learning/direct/platform/activities/'+id+'/state','GET',undefined,headers);assert.equal(state.body.submissionReview.score,17);assert.equal(state.body.submissionReview.source,'assignment-ai');assert.equal(state.body.assignmentReview.status,'published');
 const overview=f.learning.portal.overview(f.admin,f.classId);assert.equal(overview.submissions[0].ai.total,17);assert.equal(overview.submissions[0].score,17);
});

test('AI cannot publish invalid scores or overwrite a teacher review',async t=>{
 let score=21;const f=await setup(t,{reviewOptions:{intervalMs:0,assignmentModelJSON:async()=>({criteria:[{id:'1',points:score,feedback:'Evidence'}],summary:'Feedback'})}});
 f.learning.assignmentAI.configure(f.admin,f.activityId,{enabled:true,prompt:'Evaluate evidence.',criteria:[{label:'Evidence',points:20,description:'Use a concrete test.'}]});const actor=(await f.enroll()).body.state.learnerKey;
 const send=async n=>f.call('/platform/activities/'+f.activityId+'/events','POST',{id:crypto.randomUUID(),sequence:n,learnerKey:actor,kind:'submission',raw:100,answers:{evidence:'Concrete test.'},occurredAt:new Date().toISOString()});
 await send(1);await f.learning.assignmentAI.drain();assert.equal((await f.call('/platform/activities/'+f.activityId+'/state')).body.assignmentReview.status,'unavailable');assert.equal(f.learning.portal.overview(f.admin,f.classId).submissions[0].score,null);
 score=18;await send(2);const row=f.learning.portal.overview(f.admin,f.classId).submissions[0];f.learning.portal.review(f.admin,row.id,{score:12,feedback:'Teacher correction',revision:0});await f.learning.assignmentAI.drain();assert.equal(f.learning.portal.overview(f.admin,f.classId).submissions[0].score,12);
});


test('owner revocation closes direct enrollment and existing participant data access',async t=>{
 const f=await setup(t);await f.enroll();f.learning.teacherCapability=()=>false;assert.equal((await f.enroll(key())).status,401);assert.equal((await f.call('/activities/'+f.activityId)).status,401);
});

test('direct classroom reports require manual attendance and fresh private-network evidence',async t=>{
 let effects=0;const f=await setup(t,{platformOptions:{dispatch:async()=>{effects++;return {ok:true};},options:()=>({displays:[{id:'synthetic-screen',label:'Synthetic'}],lights:[],assets:[]})}});const actor=(await f.enroll()).body.state.learnerKey,user=f.learning.direct.authorize(f.activityId,f.token),p=f.learning.platform;
 p.saveSettings(f.admin,{classroomNetworks:['192.0.2.0/24'],networksConfirmed:true});p.start(f.admin,f.classId,60);p.saveRecipe(f.admin,f.classId,{label:'Synthetic celebration',eventKind:'completed',enabled:true,actions:[{kind:'leaderboard',targets:['synthetic-screen']}]});
 let n=0;const event=()=>({id:crypto.randomUUID(),sequence:++n,learnerKey:actor,kind:'completed',raw:80,occurredAt:new Date().toISOString()});
 assert.equal((await p.record(user,f.activityId,event(),{headers:{},socket:{remoteAddress:'192.0.2.10'}})).classroom,false);p.admit(f.admin,f.classId,[actor]);
 const input=event(),challenge=(await f.call('/platform/activities/'+f.activityId+'/presence','POST',{eventId:input.id})).body;assert.equal(challenge.available,true);
 p.presence.attest(challenge.id,{headers:{},socket:{remoteAddress:'192.0.2.10'}});const r=await f.call('/platform/activities/'+f.activityId+'/events','POST',{...input,presenceId:challenge.id});assert.equal(r.body.classroom,true);assert.equal(effects,1);
 assert.equal((await f.call('/platform/activities/'+f.activityId+'/events','POST',event())).body.classroom,false);assert.equal(effects,1);
 assert.equal((await f.rawRequest(null,'/learn/direct-presence/attest','POST',{id:challenge.id},{'X-RoomGoblin-Presence':'1',Origin:'https://lms.example.test'})).status,403);
});

test('AI publication rechecks rubric changes, teacher review policy and actor access after inference',async t=>{
 let release,started;const waiting=new Promise(r=>{started=r;});const f=await setup(t,{reviewOptions:{intervalMs:0,assignmentModelJSON:async()=>{started();await new Promise(r=>{release=r;});return {criteria:[{id:'1',points:18,feedback:'Evidence'}],summary:'Feedback'};}}});
 const policy={enabled:true,prompt:'Evaluate evidence.',criteria:[{label:'Evidence',points:20,description:'Concrete test.'}]};f.learning.assignmentAI.configure(f.admin,f.activityId,policy);const actor=(await f.enroll()).body.state.learnerKey;
 await f.call('/platform/activities/'+f.activityId+'/events','POST',{id:crypto.randomUUID(),sequence:1,learnerKey:actor,kind:'submission',raw:100,answers:{evidence:'A concrete test.'},occurredAt:new Date().toISOString()});
 const task=f.learning.assignmentAI.drain();await waiting;f.learning.assignmentAI.configure(f.admin,f.activityId,{...policy,prompt:'Changed instructions.'});release();await task;
 assert.equal((await f.call('/platform/activities/'+f.activityId+'/state')).body.assignmentReview.status,'unavailable');assert.equal(f.learning.portal.overview(f.admin,f.classId).submissions[0].score,null);
});

test('AI automatic-publication off keeps a private proposal for teacher review',async t=>{
 const f=await setup(t,{reviewOptions:{intervalMs:0,assignmentModelJSON:async()=>({criteria:[{id:'1',points:18,feedback:'Evidence'}],summary:'Feedback'})}});f.store.setPreference('learning.ai',{...f.store.getPreference('learning.ai'),autonomous:false});
 f.learning.assignmentAI.configure(f.admin,f.activityId,{enabled:true,prompt:'Evaluate evidence.',criteria:[{label:'Evidence',points:20,description:'Concrete test.'}]});const actor=(await f.enroll()).body.state.learnerKey;
 await f.call('/platform/activities/'+f.activityId+'/events','POST',{id:crypto.randomUUID(),sequence:1,learnerKey:actor,kind:'submission',raw:100,answers:{evidence:'A concrete test.'},occurredAt:new Date().toISOString()});await f.learning.assignmentAI.drain();
 assert.equal((await f.call('/platform/activities/'+f.activityId+'/state')).body.assignmentReview.status,'needs_review');assert.equal(f.learning.portal.overview(f.admin,f.classId).submissions[0].score,null);
});

test('direct package export requires published student routing outside local development',async t=>{
 const f=await setup(t);f.learning.platform.saveSettings(f.admin,{publicOrigin:'https://learn.example.test',publicEnabled:false});
 assert.equal((await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.activityId+'/direct-package','POST',{})).status,409);
 f.learning.platform.saveSettings(f.admin,{publicOrigin:'https://learn.example.test',publicEnabled:true});
 assert.equal((await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.activityId+'/direct-package','POST',{})).status,200);
});

test('AI cannot publish against possible points changed during inference',async t=>{
 let release,started;const waiting=new Promise(r=>{started=r;});const f=await setup(t,{reviewOptions:{intervalMs:0,assignmentModelJSON:async()=>{started();await new Promise(r=>{release=r;});return {criteria:[{id:'1',points:18,feedback:'Evidence'}],summary:'Feedback'};}}});
 f.learning.assignmentAI.configure(f.admin,f.activityId,{enabled:true,prompt:'Evaluate evidence.',criteria:[{label:'Evidence',points:20,description:'Concrete test.'}]});const actor=(await f.enroll()).body.state.learnerKey;
 await f.call('/platform/activities/'+f.activityId+'/events','POST',{id:crypto.randomUUID(),sequence:1,learnerKey:actor,kind:'submission',raw:100,answers:{evidence:'A concrete test.'},occurredAt:new Date().toISOString()});
 const task=f.learning.assignmentAI.drain();await waiting;f.learning.db.prepare('UPDATE learning_connectors SET points=10 WHERE activity_id=?').run(f.activityId);release();await task;
 assert.equal((await f.call('/platform/activities/'+f.activityId+'/state')).body.assignmentReview.status,'unavailable');assert.equal(f.learning.portal.overview(f.admin,f.classId).submissions[0].score,null);
});

test('direct authorization is rate-limited without consuming native teacher requests',async t=>{
 const f=await setup(t);const path='/activities/'+f.activityId;
 for(let i=0;i<600;i++)assert.equal((await f.call(path)).status,401);
 assert.equal((await f.call(path)).status,429);assert.equal((await f.request(f.admin,'/api/v1/learning/teacher/classes')).status,200);
});

test('direct package config escapes script delimiters without changing assignment text',()=>{
 const title='Evidence <script> and & symbols';const zip=new(require('adm-zip'))(require('../src/learning-direct-package').createPackage({id:crypto.randomUUID(),title,template_id:'scorm-connector-v1'},{origin:'https://learn.example.test',enrollmentKey:'synthetic-only'},require('node:path').resolve(__dirname,'../public/learn')));
 const config=zip.readAsText('config.js');assert(!config.includes('<'));assert(config.includes('\\u003c'));const context={window:{}};require('node:vm').runInNewContext(config,context);assert.equal(context.window.ROOMGOBLIN_SCORM.title,title);assert(zip.readAsText('imsmanifest.xml').includes('&lt;script&gt;'));
});
