'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {allowedPath}=require('../src/learning-public');
const {LearningTeacherPortal}=require('../src/learning-teacher-portal');
async function setup(t){const f=await fixture();t.after(f.close);const id=f.learning.createActivity(f.admin,f.classId,{title:'Storage plan',templateId:'scorm-connector-v1'});f.learning.platform.configure(f.admin,id,{points:20});const event=(sequence,extra={})=>({id:crypto.randomUUID(),sequence,learnerKey:f.a.id,kind:'submission',raw:75,answers:{allocation:'Use a separate volume and retain the existing backup.'},occurredAt:new Date().toISOString(),...extra});return {...f,id,event};}
const remote={headers:{},socket:{remoteAddress:'198.51.100.1'}};

test('teacher portal isolates class records, rejects students and stays off the student gateway',async t=>{
 const f=await setup(t),url='/api/v1/learning/teacher/classes/'+f.classId;
 assert.equal((await f.request(null,url)).status,401);assert.equal((await f.request(f.a,url)).status,403);
 const other=f.store.putUser({username:'other-teacher',displayName:'Other teacher',role:'operator',profileId:'teacher'},{password:'synthetic-test-password'});
 assert.throws(()=>f.learning.portal.overview(other,f.classId),{status:404});
 const isolated=f.learning.createClass(other,'Another class');f.learning.createActivity(other,isolated,{title:'PRIVATE OTHER CLASS'});
 await f.learning.platform.record(f.a,f.id,f.event(1),remote);
 const result=await f.request(f.admin,url);assert.equal(result.status,200);assert.equal(result.body.counts.submissions,1);assert(!JSON.stringify(result.body).includes('PRIVATE OTHER CLASS'));
 for(const path of [url,url+'/export','/learn/teacher/','/learn/teacher/app.js',`/api/v1/learning/teacher/activities/${f.id}/command`])for(const method of ['GET','POST','PUT'])assert.equal(allowedPath(method,path),false);
});
test('native submissions use signed actor binding, bounded answers, idempotent events and no device effects',async t=>{
 const f=await setup(t),event=f.event(1),p=f.learning.platform;
 const first=await p.record(f.a,f.id,event,remote);assert.equal(first.saved,true);assert.deepEqual(first.state.progress.answers,event.answers);
 assert.equal((await p.record(f.a,f.id,event,remote)).duplicate,true);
 await assert.rejects(p.record(f.a,f.id,{...event,answers:{allocation:'changed'}},remote),{status:409});
 await assert.rejects(p.record(f.b,f.id,f.event(2),remote),{status:409});
 for(const answers of [null,[],{}, {x:'x'.repeat(2001)},Object.fromEntries(Array.from({length:13},(_,i)=>[i,'x']))])await assert.rejects(p.record(f.a,f.id,f.event(2,{answers}),remote),{status:400});
 assert.equal(f.learning.portal.overview(f.admin,f.classId).submissions.length,1);
 assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_effect_runs').get().n,0);
 assert.equal(p.state(f.b,f.id).progress.answers,undefined);
});
test('teacher reviews are versioned, scoped, audited and separate from official grade receipts',async t=>{
 const f=await setup(t);await f.learning.platform.record(f.a,f.id,f.event(1),remote);
 const submission=f.learning.portal.overview(f.admin,f.classId).submissions[0],url='/api/v1/learning/teacher/submissions/'+submission.id+'/review',body={score:18,feedback:'Strong evidence.',revision:0};
 assert.equal((await f.request(f.a,url,'PUT',body)).status,403);
 assert.equal((await f.request(f.admin,url,'PUT',{...body,score:21})).status,400);
 assert.equal((await f.request(f.admin,url,'PUT',body)).body.review.revision,1);
 assert.equal((await f.request(f.admin,url,'PUT',body)).status,409);
 const report=f.learning.portal.overview(f.admin,f.classId);assert.equal(report.counts.reviewed,1);assert.equal(report.submissions[0].score,18);assert(report.events.some(e=>e.kind==='portal.review'));
 assert.equal((await f.request(f.a,`/api/v1/learning/activities/${f.id}/receipt`)).status,409);
});
test('activity pause rejects new writes without changing other assignments and controls survive restart',async t=>{
 const f=await setup(t),url='/api/v1/learning/teacher/activities/'+f.id+'/command',input={paused:true,stage:3,hint:'Explain the backup boundary.',version:0};
 const other=f.learning.createActivity(f.admin,f.classId,{title:'Still open',templateId:'scorm-connector-v1'});f.learning.platform.configure(f.admin,other,{points:20});
 assert.equal((await f.request(f.admin,url,'PUT',input)).status,200);
 await assert.rejects(f.learning.platform.record(f.a,f.id,f.event(1),remote),{status:409});
 assert.equal((await f.learning.platform.record(f.a,other,f.event(1),remote)).saved,true);
 f.store.db.exec('ALTER TABLE learning_portal_commands ADD COLUMN future_column TEXT');
 f.learning.portal=new LearningTeacherPortal(f.learning);
 assert.equal(f.learning.portal.command(f.id).stage,3);
 assert.equal((await f.request(f.admin,url,'PUT',input)).status,409);
 assert.equal((await f.request(f.admin,url,'PUT',{...input,paused:false,version:1})).status,200);
 assert.equal((await f.learning.platform.record(f.a,f.id,f.event(1),remote)).saved,true);
});
test('all portal mutations honor the export freeze and malformed commands fail before writes',async t=>{
 const f=await setup(t),url='/api/v1/learning/teacher/activities/'+f.id+'/command',input={paused:false,stage:1,hint:'',version:0};
 for(const change of [{stage:21},{paused:'true'},{hint:'x'.repeat(301)},{version:-1}])assert([400,409].includes((await f.request(f.admin,url,'PUT',{...input,...change})).status));
 await f.learning.platform.record(f.a,f.id,f.event(1),remote);const id=f.learning.portal.overview(f.admin,f.classId).submissions[0].id;
 f.freeze(true);assert.equal((await f.request(f.admin,url,'PUT',input)).status,423);assert.equal((await f.request(f.admin,`/api/v1/learning/teacher/submissions/${id}/review`,'PUT',{score:10,feedback:'',revision:0})).status,423);
 assert.equal(f.learning.portal.command(f.id).version,0);
});
test('CSV export quotes private responses, neutralizes spreadsheet formulas and excludes another class',async t=>{
 const f=await setup(t);await f.learning.platform.record(f.a,f.id,f.event(1,{answers:{evidence:'"quoted", evidence\nnext line'}}),remote);
 f.store.db.prepare('UPDATE learning_members SET alias=? WHERE class_id=? AND user_id=?').run('=HYPERLINK("bad")',f.classId,f.a.id);
 const id=f.learning.portal.overview(f.admin,f.classId).submissions[0].id;f.learning.portal.review(f.admin,id,{score:17,feedback:' +SUM(1,1)',revision:0});
 const response=await f.request(f.admin,'/api/v1/learning/teacher/classes/'+f.classId+'/export');assert.equal(response.status,200);
 const csv=response.body.toString();assert.match(csv,/'=HYPERLINK/);assert.match(csv,/' \+SUM/);assert.match(csv,/answers_json/);assert.match(csv,/quoted/);assert.equal((await f.request(f.b,'/api/v1/learning/teacher/classes/'+f.classId+'/export')).status,403);
});


test('teacher catalog groups only owned classes with meaningful activity and class audit',async t=>{
 const f=await setup(t),other=f.store.putUser({username:'catalog-other',role:'operator',profileId:'teacher'},{password:'synthetic-test-password'});
 const privateId=f.learning.createClass(other,'PRIVATE CLASS');
 f.learning.post(f.a,f.activityId,{kind:'initial',body:'Verify the network boundary before making changes.'});
 const result=await f.request(f.admin,'/api/v1/learning/teacher/classes');assert.equal(result.status,200);
 assert(!result.body.classes.some(c=>c.id===privateId));const item=result.body.classes.find(c=>c.id===f.classId);assert.equal(item.studentCount,2);assert.equal(item.assignmentCount,2);assert(item.lastActivityAt>0);
 const report=f.learning.portal.overview(f.admin,f.classId);assert.equal(report.counts.events,1);assert.equal(report.recentActivity[0].kind,'discussion.initial');assert(report.events.some(e=>e.kind==='class.create'));
 assert.equal((await f.request(f.a,'/api/v1/learning/teacher/classes')).status,403);
});

test('assignment creation configures atomically, preserves written points and honors freeze',async t=>{
 const f=await setup(t),url='/api/v1/learning/teacher/classes/'+f.classId+'/assignments';
 assert.equal((await f.request(f.admin,url,'POST',[])).status,400);
 const count=()=>f.store.db.prepare('SELECT COUNT(*) n FROM learning_activities').get().n,before=count();
 assert.equal((await f.request(f.admin,url,'POST',{title:'Invalid',points:0})).status,400);assert.equal(count(),before);
 const configure=f.learning.platform.configure;f.learning.platform.configure=()=>{throw Object.assign(Error('Synthetic configure failure'),{status:400});};
 assert.equal((await f.request(f.admin,url,'POST',{title:'Rolled back',points:50})).status,400);assert.equal(count(),before);f.learning.platform.configure=configure;
 const result=await f.request(f.admin,url,'POST',{title:'Native assignment',points:50});assert.equal(result.status,200);assert.equal(f.learning.platform.config(result.body.id).points,50);
 const written=await f.request(f.admin,url,'POST',{title:'Writing',templateId:'it1-u03-c01-os-selection-v1',points:999});assert.equal(written.status,200);assert.equal(f.learning.platform.config(written.body.id).points,20);
 assert.equal((await f.request(f.a,url,'POST',{points:50})).status,403);f.freeze(true);assert.equal((await f.request(f.admin,url,'POST',{points:50})).status,423);
});

test('connection settings save atomically and grading edits retain concurrent launcher origins',async t=>{
 const f=await setup(t),url='/api/v1/learning/teacher/connection-settings',before=f.learning.platform.settings(),body={settings:{...before,publicOrigin:'https://learn.example.test'},origins:['https://lms.example.test']};
 assert.equal((await f.request(f.a,url,'PUT',body)).status,403);
 assert.equal((await f.request(f.admin,url,'PUT',{...body,origins:['https://lms.example.test/path']})).status,400);assert.deepEqual(f.learning.platform.settings(),before);
 const set=f.store.setPreference;f.store.setPreference=function(key,...args){if(key==='learning.bridgeOrigins')throw Object.assign(Error('Synthetic storage failure'),{status:400});return set.call(this,key,...args);};
 assert.equal((await f.request(f.admin,url,'PUT',body)).status,400);f.store.setPreference=set;assert.deepEqual(f.learning.platform.settings(),before);
 assert.equal((await f.request(f.admin,url,'PUT',body)).status,200);
 assert.equal((await f.request(f.admin,'/api/v1/learning/settings','PUT',{provider:'openai',model:'synthetic-model',dailyLimit:100,enabled:false})).status,200);assert.deepEqual(f.store.getPreference('learning.bridgeOrigins'),body.origins);
 f.freeze(true);assert.equal((await f.request(f.admin,url,'PUT',body)).status,423);
 for(const path of [url,'/api/v1/learning/teacher/classes','/learn/teacher/setup.mjs'])assert.equal(allowedPath('GET',path),false);
});

test('portal marks changed writing superseded and teacher response edits reject stale revisions',async t=>{
 const f=await setup(t);const post=f.learning.post(f.a,f.activityId,{kind:'initial',body:'Use the subnet mask to establish the boundary.'});
 await f.request(f.a,`/api/v1/learning/activities/${f.activityId}/submit`,'POST',{});
 assert.equal(f.learning.portal.overview(f.admin,f.classId).reviews[0].status,'approved');
 f.store.db.prepare('UPDATE learning_posts SET body=?,revision=revision+1 WHERE id=?').run('Revised boundary evidence with a specific test.',post);
 assert.equal(f.learning.portal.overview(f.admin,f.classId).reviews[0].status,'superseded');
 const response=f.learning.post(f.admin,f.activityId,{body:'Explain your test.'}),url=`/api/v1/learning/activities/${f.activityId}/posts/${response}/teacher-edit`;
 const revision=f.store.db.prepare('SELECT revision FROM learning_posts WHERE id=?').get(response).revision;
 assert.equal((await f.request(f.admin,url,'PUT',{body:'Include the subnet mask.',revision})).status,200);assert.equal((await f.request(f.admin,url,'PUT',{body:'Stale overwrite',revision})).status,409);
});
