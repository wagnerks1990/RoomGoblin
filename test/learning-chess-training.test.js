'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {ChessTraining}=require('../src/learning-chess-training');
const {parse,legal,uci,checked}=require('../src/learning-chess');
const id=()=>crypto.randomUUID(),examples={...Object.fromEntries(require('../src/learning-chess-curriculum').EXTRA_LESSONS.map(x=>[x.id,x.example])),'escape-check':'e1d1','castle-safely':'e1g1','en-passant':'e5d6','promote-pawn':'a7a8n','mate-in-one':'g6g7','knight-fork':'h5f6'};
async function setup(){const f=await fixture();f.id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic chess drills',templateId:'scorm-connector-v1'});let available=true;f.training=new ChessTraining(f.learning,{available:()=>available});f.available=value=>available=value;return f;}
function start(f,lessonId='mate-in-one',user=f.a,revision=0){return f.training.startLesson(user,f.id,{lessonId,revision,requestId:id()});}
const action=(session,extra={})=>({revision:session.revision,requestId:id(),...extra});

test('32 original drills solve only through legal server-checked objectives without touching matches or grades',async()=>{
 const f=await setup();try{
  const before={matches:f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_matches').get().n,reviews:f.store.db.prepare('SELECT COUNT(*) n FROM learning_reviews').get().n,score:f.learning.chess.progress(f.a,f.id),standings:f.learning.chess.standings(f.a)};
  const catalog=f.training.catalogue(f.a,f.id);assert.equal(catalog.lessons.length,32);assert.match(catalog.notice,/do not change grades/);
  for(const [lessonIndex,lesson]of catalog.lessons.entries()){const learner=lessonIndex<24?f.a:f.b;assert.equal(lesson.session,null);for(const key of ['example','hints','goal','solution','userId'])assert.equal(Object.hasOwn(lesson,key),false);const begun=start(f,lesson.id,learner);assert.ok(begun.session.legalMoves.includes(examples[lesson.id]));let solved=f.training.attempt(learner,f.id,begun.session.id,action(begun.session,{move:examples[lesson.id]}));if(lesson.id==='center-and-develop')solved=f.training.attempt(learner,f.id,begun.session.id,action(solved.session,{move:'g1f3'}));assert.equal(solved.session.status,'solved');assert.equal(solved.progress.completions,1);assert.equal(solved.progress.unassistedCompletions,1);assert.equal(solved.progress.firstTryCompletions,1);assert.equal(solved.session.assisted,false);assert.deepEqual(solved.session.legalMoves,[]);}
  const mate=f.training.catalogue(f.a,f.id).lessons.find(l=>l.id==='mate-in-one').session,s=parse(mate.fen);assert.equal(checked(s),true);assert.equal(legal(s).length,0);
  assert.deepEqual({matches:f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_matches').get().n,reviews:f.store.db.prepare('SELECT COUNT(*) n FROM learning_reviews').get().n,score:f.learning.chess.progress(f.a,f.id),standings:f.learning.chess.standings(f.a)},before);
 }finally{await f.close();}
});
test('wrong legal tries reset the diagram; illegal moves and client correctness cannot grant progress',async()=>{
 const f=await setup();try{const begun=start(f),prior=begun.session;
  assert.throws(()=>f.training.attempt(f.a,f.id,prior.id,action(prior,{move:'a1a8'})),{status:409});
  assert.throws(()=>f.training.attempt(f.a,f.id,prior.id,{...action(prior,{move:'g6g7'}),correct:true}),{status:400});
  const wrong=f.training.attempt(f.a,f.id,prior.id,action(prior,{move:'g6g5'}));assert.equal(wrong.session.status,'active');assert.equal(wrong.session.fen,prior.fen);assert.equal(wrong.progress.attempts,1);assert.equal(wrong.progress.completions,0);assert.match(wrong.session.feedback,/does not meet/);
  const solved=f.training.attempt(f.a,f.id,prior.id,action(wrong.session,{move:'g6g7'}));assert.equal(solved.progress.attempts,2);assert.equal(solved.progress.firstTryCompletions,0);assert.equal(solved.progress.unassistedCompletions,1);
 }finally{await f.close();}
});
test('progressive hints are durable and assistance-aware; retries preserve aggregate practice history',async()=>{
 const f=await setup();try{let result=start(f,'knight-fork');for(let level=1;level<=3;level++){result=f.training.hint(f.a,f.id,result.session.id,action(result.session));assert.equal(result.session.hintLevel,level);assert.equal(result.session.hints.length,level);assert.equal(result.session.assisted,true);}
  assert.throws(()=>f.training.hint(f.a,f.id,result.session.id,action(result.session)),{status:409});
  result=f.training.attempt(f.a,f.id,result.session.id,action(result.session,{move:'h5f6'}));assert.equal(result.progress.assistedCompletions,1);assert.equal(result.progress.unassistedCompletions,0);assert.equal(result.progress.bestHintLevel,3);
  const reopened=new ChessTraining(f.learning).catalogue(f.a,f.id).lessons.find(l=>l.id==='knight-fork');assert.deepEqual(reopened.session,result.session);
  const fresh=start(f,'knight-fork',f.a,result.session.revision);assert.notEqual(fresh.session.id,result.session.id);assert.equal(fresh.session.hintLevel,0);assert.equal(fresh.session.attempts,0);assert.equal(fresh.progress.assistedCompletions,1);
  const solved=f.training.attempt(f.a,f.id,fresh.session.id,action(fresh.session,{move:'h5f6'}));assert.equal(solved.progress.completions,2);assert.equal(solved.progress.bestHintLevel,0);
 }finally{await f.close();}
});
test('request retries are idempotent and stale revisions cannot duplicate attempts, hints or resets',async()=>{
 const f=await setup();try{const body={lessonId:'mate-in-one',revision:0,requestId:id()},begun=f.training.startLesson(f.a,f.id,body);assert.deepEqual(f.training.startLesson(f.a,f.id,body),begun);
  const hint=action(begun.session),help=f.training.hint(f.a,f.id,begun.session.id,hint);assert.deepEqual(f.training.hint(f.a,f.id,begun.session.id,hint),help);
  assert.throws(()=>f.training.attempt(f.a,f.id,begun.session.id,{...hint,move:'g6g7'}),{status:409});assert.throws(()=>f.training.startLesson(f.a,f.id,body),{status:409});
  const attempt=action(help.session,{move:'g6g7'}),solved=f.training.attempt(f.a,f.id,help.session.id,attempt);assert.deepEqual(f.training.attempt(f.a,f.id,help.session.id,attempt),solved);assert.equal(solved.progress.attempts,1);
  assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM learning_events WHERE activity_id=? AND kind LIKE 'chess.training.%'").get(f.id).n,3);
 }finally{await f.close();}
});
test('private training denies other learners, other activities, missing class authority and disabled identities',async()=>{
 const f=await setup();try{const begun=start(f);assert.throws(()=>f.training.hint(f.b,f.id,begun.session.id,action(begun.session)),{status:404});assert.equal(f.training.catalogue(f.b,f.id).lessons.every(l=>l.session===null),true);
  const other=f.learning.createActivity(f.admin,f.classId,{title:'Other',templateId:'scorm-connector-v1'});assert.throws(()=>f.training.attempt(f.a,other,begun.session.id,action(begun.session,{move:'g6g7'})),{status:404});assert.throws(()=>f.training.catalogue(f.outside,f.id),{status:404});
  const teacher=f.training.startLesson(f.admin,f.id,{lessonId:'mate-in-one',revision:0,requestId:id()},{teacher:true});assert.throws(()=>f.training.hint(f.admin,f.id,begun.session.id,action(begun.session),{teacher:true}),{status:404});assert.ok(teacher.session.id);
  f.store.putUser({...f.a,enabled:false});assert.throws(()=>f.training.catalogue(f.a,f.id),{status:401});assert.throws(()=>f.training.hint(f.a,f.id,begun.session.id,action(begun.session)),{status:401});
 }finally{await f.close();}
});
test('direct training retains the original assignment, bearer revocation and owner availability boundaries',async()=>{
 const f=await setup();try{f.learning.platform.configure(f.admin,f.id,{points:20});const key=f.learning.direct.issue(f.admin,f.id),token=crypto.randomBytes(32).toString('hex'),user=f.learning.direct.enroll(f.id,key,{participantToken:token,reportedId:'training-synthetic',name:'Synthetic Student'});const begun=start(f,'mate-in-one',user);
  const other=f.learning.createActivity(f.admin,f.classId,{title:'Other',templateId:'scorm-connector-v1'});assert.throws(()=>f.training.catalogue(user,other),{status:401});assert.throws(()=>f.training.catalogue(user,f.id,{teacher:true}),{status:404});
  f.store.db.prepare('UPDATE learning_direct_participants SET revoked=1 WHERE user_id=?').run(user.id);assert.throws(()=>f.training.hint(user,f.id,begun.session.id,action(begun.session)),{status:401});f.store.db.prepare('UPDATE learning_direct_participants SET revoked=0 WHERE user_id=?').run(user.id);
  f.store.setPreference(f.learning.direct.key(f.id),{enabled:false,ownerId:f.admin.id});assert.throws(()=>f.training.catalogue(user,f.id),{status:401});
 }finally{await f.close();}
});
test('paused or closed activities and application freeze block writes without erasing progress',async()=>{
 const f=await setup();try{const begun=start(f),before=f.training.catalogue(f.a,f.id);f.available(false);assert.throws(()=>f.training.hint(f.a,f.id,begun.session.id,action(begun.session)),{status:423});assert.deepEqual(f.training.catalogue(f.a,f.id),before);f.available(true);
  await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.id+'/command','PUT',{paused:true,stage:1,hint:'',version:0});assert.throws(()=>f.training.attempt(f.a,f.id,begun.session.id,action(begun.session,{move:'g6g7'})),{status:409});
  await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.id+'/command','PUT',{paused:false,stage:1,hint:'',version:1});f.learning.settings(f.admin,f.id,{open:false});assert.throws(()=>f.training.hint(f.a,f.id,begun.session.id,action(begun.session)),{status:409});assert.deepEqual(f.training.catalogue(f.a,f.id),before);
 }finally{await f.close();}
});
test('audit failure rolls back session creation, attempts and hints atomically',async()=>{
 const f=await setup();try{const original=f.learning.event;f.learning.event=()=>{throw Error('synthetic audit failure');};assert.throws(()=>start(f));assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_training').get().n,0);f.learning.event=original;
  const begun=start(f),before=f.training.catalogue(f.a,f.id);f.learning.event=()=>{throw Error('synthetic audit failure');};assert.throws(()=>f.training.attempt(f.a,f.id,begun.session.id,action(begun.session,{move:'g6g7'})));assert.throws(()=>f.training.hint(f.a,f.id,begun.session.id,action(begun.session)));assert.deepEqual(f.training.catalogue(f.a,f.id),before);f.learning.event=original;
 }finally{await f.close();}
});
test('training payloads and per-user work remain bounded and activity deletion removes private progress',async()=>{
 const f=await setup();try{for(const body of [null,[],{}, {lessonId:'mate-in-one',revision:0,requestId:[id()]},{lessonId:'mate-in-one',revision:0,requestId:id(),fen:'forged'}])assert.throws(()=>f.training.startLesson(f.a,f.id,body),{status:400});
  const begun=start(f);for(let i=0;i<59;i++)f.training.startLesson(f.a,f.id,{lessonId:'mate-in-one',revision:begun.session.revision+i,requestId:id()});assert.throws(()=>f.training.startLesson(f.a,f.id,{lessonId:'mate-in-one',revision:60,requestId:id()}),{status:429});
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_training').get().n,1);assert.ok(f.store.db.prepare('SELECT length(last_response_json) n FROM learning_chess_training').get().n<32768);
  f.store.db.prepare('DELETE FROM learning_activities WHERE id=?').run(f.id);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_training').get().n,0);
 }finally{await f.close();}
});

test('guided opening branches validate authored replies, resume each step and record only final completion',async()=>{const f=await setup();try{const begun=start(f,'center-and-develop'),body=action(begun.session,{move:'d2d4'}),first=f.training.attempt(f.a,f.id,begun.session.id,body);assert.equal(first.session.status,'active');assert.equal(first.session.step,2);assert.equal(first.session.totalSteps,2);assert.equal(first.progress.completions,0);assert.match(first.session.fen,/3p4\/3P4/);assert.deepEqual(f.training.attempt(f.a,f.id,begun.session.id,body),first);const resumed=new ChessTraining(f.learning).catalogue(f.a,f.id).lessons.find(x=>x.id==='center-and-develop');assert.deepEqual(resumed.session,first.session);const wrong=f.training.attempt(f.a,f.id,first.session.id,action(first.session,{move:'e2e4'}));assert.equal(wrong.session.fen,first.session.fen);assert.equal(wrong.session.step,2);assert.equal(wrong.progress.completions,0);const helped=f.training.hint(f.a,f.id,wrong.session.id,action(wrong.session));assert.match(helped.session.hints[0],/minor piece/);const solved=f.training.attempt(f.a,f.id,helped.session.id,action(helped.session,{move:'g1f3'}));assert.equal(solved.session.status,'solved');assert.equal(solved.progress.completions,1);assert.equal(solved.progress.assistedCompletions,1);assert.equal(solved.progress.attempts,3);assert.equal(solved.progress.firstTryCompletions,0);const reset=start(f,'center-and-develop',f.a,solved.session.revision);assert.equal(reset.session.step,1);assert.equal(reset.session.hintLevel,0);assert.equal(reset.session.fen,require('../src/learning-chess').START);}finally{await f.close();}});
