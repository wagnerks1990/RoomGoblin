'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');const {fixture}=require('./helpers/learning-fixture');const {ChessPuzzleRuns}=require('../src/learning-chess-puzzle-runs');const {EXTRA_LESSONS}=require('../src/learning-chess-curriculum');
const request=revision=>({requestId:crypto.randomUUID(),...(revision?{revision}:{})});
async function setup(){const f=await fixture();f.id=f.learning.createActivity(f.admin,f.classId,{title:'Puzzle fixture',templateId:'scorm-connector-v1'});let now=Date.UTC(2026,10,20,12),available=true;f.puzzles=new ChessPuzzleRuns(f.learning,{now:()=>now,available:()=>available});f.advance=ms=>now+=ms;f.available=value=>available=value;f.daily=(ids=['pawn-step'],timeLimit=0)=>f.puzzles.createDaily(f.admin,f.id,{...request(),lessonIds:ids,timeLimit},{teacher:true});f.start=(mode='daily',user=f.a)=>f.puzzles.start(user,f.id,{...request(),mode}).run;return f;}
test('daily server objectives score exactly once, preserve tied ranks, and expose no solution/private IDs',async()=>{
 const f=await setup();try{f.daily();for(const user of [f.a,f.b]){let run=f.start('daily',user);assert.equal(JSON.stringify(run).includes('example'),false);const body={...request(run.revision),move:'e2e3'};run=f.puzzles.attempt(user,f.id,run.id,body).run;assert.equal(run.score,1);assert.equal(run.status,'completed');assert.deepEqual(f.puzzles.attempt(user,f.id,run.id,body).run,run);assert.equal(f.start('daily',user).id,run.id);}
  const list=f.puzzles.catalogue(f.a,f.id);assert.equal(list.leaderboard.length,2);assert.equal(list.leaderboard[0].rank,1);assert.equal(list.leaderboard[1].rank,1);assert.equal(JSON.stringify(list.leaderboard).includes(f.b.id),false);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_matches').get().n,0);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_training').get().n,0);
 }finally{await f.close();}
});
test('server deadline wins races and reads never persist expiration or grant late points',async()=>{
 const f=await setup();try{f.daily(['pawn-step','pawn-double'],60);let run=f.start();f.advance(60000);const before=f.store.db.prepare('SELECT total_changes() n').get().n;assert.equal(f.puzzles.catalogue(f.a,f.id).run.status,'expired');assert.equal(f.store.db.prepare('SELECT total_changes() n').get().n,before);run=f.puzzles.attempt(f.a,f.id,run.id,{...request(run.revision),move:'e2e3'}).run;assert.equal(run.status,'expired');assert.equal(run.score,0);assert.equal(run.completed,0);assert.throws(()=>f.puzzles.hint(f.a,f.id,run.id,request(run.revision)),{status:409});
 }finally{await f.close();}
});
test('hints persist assistance across positions while wrong survival answers end the personal run',async()=>{
 const f=await setup();try{f.daily(['pawn-step','pawn-double']);let run=f.start();run=f.puzzles.hint(f.a,f.id,run.id,request(run.revision)).run;assert.equal(run.assisted,true);assert.equal(run.lesson.hints.length,1);run=f.puzzles.attempt(f.a,f.id,run.id,{...request(run.revision),move:'e2e3'}).run;assert.equal(run.assisted,true);assert.equal(run.lesson.hints.length,0);run=f.puzzles.attempt(f.a,f.id,run.id,{...request(run.revision),move:'d2d4'}).run;assert.equal(f.puzzles.catalogue(f.b,f.id).leaderboard[0].assisted,true);
  let personal=f.start('survival');personal=f.puzzles.attempt(f.a,f.id,personal.id,{...request(personal.revision),move:'a2a3'}).run;assert.equal(personal.status,'ended');assert.equal(personal.score,0);assert.equal(personal.mistakes,1);assert.notEqual(f.start('survival').id,personal.id);
 }finally{await f.close();}
});
test('resumed start receipts remain idempotent after stop and illegal attempts do not advance',async()=>{
 const f=await setup();try{let run=f.start('survival'),body={...request(),mode:'survival'};assert.equal(f.puzzles.start(f.a,f.id,body).run.id,run.id);assert.throws(()=>f.puzzles.attempt(f.a,f.id,run.id,{...request(run.revision),move:'e2e5'}),{status:409});assert.equal(f.puzzles.catalogue(f.a,f.id).run.revision,run.revision);run=f.puzzles.stop(f.a,f.id,run.id,request(run.revision)).run;assert.equal(f.puzzles.start(f.a,f.id,body).run.id,run.id);assert.equal(f.puzzles.start(f.a,f.id,body).run.status,'stopped');
 }finally{await f.close();}
});
test('daily publication, own scopes, fresh revocation and teacher roles fail closed',async()=>{
 const f=await setup();try{assert.throws(()=>f.puzzles.createDaily(f.a,f.id,{...request(),lessonIds:['pawn-step'],timeLimit:0},{teacher:true}),{status:404});f.daily();assert.throws(()=>f.daily(),{status:409});let run=f.start();assert.throws(()=>f.puzzles.stop(f.b,f.id,run.id,request(run.revision)),{status:404});assert.throws(()=>f.puzzles.start(f.a,f.id,{...request(),mode:'daily',score:99}),{status:400});f.store.db.prepare('UPDATE learning_activities SET open=0 WHERE id=?').run(f.id);assert.throws(()=>f.puzzles.hint(f.a,f.id,run.id,request(run.revision)),{status:409});f.store.db.prepare('UPDATE learning_activities SET open=1 WHERE id=?').run(f.id);f.available(false);assert.throws(()=>f.puzzles.stop(f.a,f.id,run.id,request(run.revision)),{status:423});assert.equal(f.puzzles.catalogue(f.a,f.id).run.id,run.id);
 }finally{await f.close();}
});
test('audit rollback and deletion preserve independent practice boundaries',async()=>{
 const f=await setup();try{f.daily();const run=f.start(),original=f.learning.event;f.learning.event=()=>{throw Error('synthetic audit failure');};assert.throws(()=>f.puzzles.attempt(f.a,f.id,run.id,{...request(run.revision),move:'e2e3'}),/synthetic audit failure/);assert.equal(f.puzzles.catalogue(f.a,f.id).run.score,0);f.learning.event=original;f.store.deleteUser(f.a.id);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_puzzle_runs').get().n,0);f.store.db.prepare('DELETE FROM learning_classes WHERE id=?').run(f.classId);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_daily_puzzles').get().n,0);
 }finally{await f.close();}
});
test('every original run objective is legal and completes using its verified example',async()=>{
 const f=await setup();try{let run=f.start('survival');while(run.status==='active'){const lesson=EXTRA_LESSONS.find(lesson=>lesson.id===run.lesson.id);run=f.puzzles.attempt(f.a,f.id,run.id,{...request(run.revision),move:lesson.example}).run;}assert.equal(run.status,'completed');assert.equal(run.score,run.total);assert.equal(run.mistakes,0);
 }finally{await f.close();}
});
test('direct participant revocation and original assignment scope protect private runs',async()=>{
 const f=await setup();try{f.learning.platform.configure(f.admin,f.id,{points:20});const key=f.learning.direct.issue(f.admin,f.id),user=f.learning.direct.enroll(f.id,key,{participantToken:crypto.randomBytes(32).toString('hex'),reportedId:'puzzle-direct',name:'Synthetic Puzzles'});const run=f.start('survival',user),other=f.learning.createActivity(f.admin,f.classId,{title:'Other',templateId:'scorm-connector-v1'});assert.throws(()=>f.puzzles.catalogue(user,other),{status:401});f.store.db.prepare('UPDATE learning_direct_participants SET revoked=1 WHERE user_id=?').run(user.id);assert.throws(()=>f.puzzles.catalogue(user,f.id),{status:401});assert.throws(()=>f.puzzles.stop(user,f.id,run.id,request(run.revision)),{status:401});
 }finally{await f.close();}
});
