'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {route}=require('../src/learning-direct');
const {allowedPath}=require('../src/learning-public');
test('training gateway admits only exact scoped methods and paths',()=>{
 const id=crypto.randomUUID(),session=crypto.randomUUID(),base='/api/v1/learning/direct/activities/'+id+'/chess/training/';
 for(const [suffix,method] of [['catalogue','GET'],['progress','GET'],['start','POST'],['sessions/'+session+'/attempt','POST'],['sessions/'+session+'/hint','POST']]){
  assert.deepEqual(route(method,base+suffix),{id,part:'chess'});assert.equal(allowedPath(method,base+suffix),true);
  for(const wrong of ['GET','POST','PUT','DELETE'].filter(x=>x!==method))assert.equal(route(wrong,base+suffix),null);
  for(const bad of [base+suffix+'/',base+suffix+'/other',base+suffix.toUpperCase(),base+suffix.replace(session,'not-a-session')].filter(x=>x!==base+suffix))assert.equal(route(method,bad),null);
 }
 for(const path of ['/learn/chess','/api/v1/learning/teacher/classes/'+id+'/chess/training/catalogue','/api/v1/diagnostics'])assert.equal(allowedPath('GET',path),false);
});
test('direct training persists private sessions through real routes without grade or authority expansion',async()=>{
 const f=await fixture();try{
  const activity=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic drills',templateId:'scorm-connector-v1'});
  f.learning.platform.configure(f.admin,activity,{points:20});const enrollment=f.learning.direct.issue(f.admin,activity),token=crypto.randomBytes(32).toString('hex');
  const enroll=await f.rawRequest(null,'/api/v1/learning/direct/activities/'+activity+'/enroll','POST',{participantToken:token,reportedId:'synthetic',name:'Synthetic learner'},{Authorization:'RoomGoblin-Assignment '+enrollment});assert.equal(enroll.status,200);
  const base='/api/v1/learning/direct/activities/'+activity+'/chess/training/',call=(suffix,method='GET',body)=>f.rawRequest(null,base+suffix,method,body,{Authorization:'Bearer '+token,Origin:'https://synthetic-lms.example'});
  assert.equal((await call('catalogue')).body.lessons.length,32);
  const request={lessonId:'mate-in-one',revision:0,requestId:crypto.randomUUID()},started=await call('start','POST',request);assert.equal(started.status,200);assert.equal((await call('start','POST',request)).body.session.id,started.body.session.id);
  const session=started.body.session;
  const solved=await call('sessions/'+session.id+'/attempt','POST',{revision:session.revision,requestId:crypto.randomUUID(),move:'g6g7'});assert.equal(solved.status,200);assert.equal(solved.body.session.status,'solved');
  assert.equal((await call('progress')).body.lessons.find(x=>x.id==='mate-in-one').progress.unassistedCompletions,1);
  assert.equal(f.learning.chess.progress({id:enroll.body.state.learnerKey},activity),0);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_matches').get().n,0);
  const teacher='/api/v1/learning/teacher/classes/'+f.classId+'/chess/training/';
  assert.equal((await f.request(f.admin,teacher+'catalogue')).body.lessons.every(x=>x.session===null),true);
  assert.notEqual((await f.rawRequest(null,teacher+'catalogue','GET',undefined,{Authorization:'Bearer '+token})).status,200);
  assert.equal((await f.request(f.b,'/api/v1/learning/activities/'+activity+'/chess/training/sessions/'+session.id+'/hint','POST',{revision:solved.body.session.revision,requestId:crypto.randomUUID()})).status,404);
  f.store.db.prepare('UPDATE learning_direct_participants SET revoked=1 WHERE user_id=?').run(enroll.body.state.learnerKey);
  assert.equal((await call('progress')).status,401);
 }finally{await f.close();}
});
