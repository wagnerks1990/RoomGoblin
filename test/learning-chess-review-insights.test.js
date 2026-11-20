'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/learning-fixture'),{legal,parse,uci}=require('../src/learning-chess');
test('adaptive personalities persist, bind idempotency and preserve fixed levels and black openings',async()=>{
 const f=await fixture();try{
  const crypto=require('node:crypto'),id=f.learning.createActivity(f.admin,f.classId,{title:'Personality',templateId:'scorm-connector-v1'}),c=f.learning.chess,requestId=crypto.randomUUID();
  const legacy=c.create(f.a,id,{mode:'computer',difficulty:'beginner',requestId});assert.equal(legacy.personality,'dynamic');assert.equal(f.store.db.prepare('SELECT fingerprint FROM learning_chess_requests WHERE request_id=?').get(requestId).fingerprint,JSON.stringify([id,'computer','beginner','none']));
  for(const opts of [{mode:'computer',difficulty:'beginner',personality:'guardian'},{mode:'solo',personality:'guardian'},{mode:'computer',personality:'bad'}])assert.throws(()=>c.create(f.a,id,opts),{status:400});
  const req=crypto.randomUUID(),m=c.create(f.a,id,{mode:'computer',personality:'guardian',requestId:req});assert.equal(c.render(c.row(m.id),f.a).personality,'guardian');assert.equal(c.create(f.a,id,{mode:'computer',personality:'guardian',requestId:req}).id,m.id);assert.throws(()=>c.create(f.a,id,{mode:'computer',personality:'explorer',requestId:req}),{status:409});assert.equal(f.learning.adaptive.decision(f.a,id,c.row(m.id),['e2e4']).style,'solid');
  let style;c.computer={choose:async(position,_level,options)=>{style=options.adaptive.style;return uci(legal(parse(position))[0]);}};
  const black=await c.create(f.a,id,{mode:'computer',humanColor:'black',personality:'explorer',requestId:crypto.randomUUID()});assert.equal(style,'exploratory');assert.equal(black.personality,'explorer');assert.equal(c.progress(f.a,id),0);assert.equal(JSON.parse(c.row(black.id).moves_json).length,1);
 }finally{await f.close();}
});
test('recurring review coaching counts only owned side, valid engine/history evidence and fresh scope',async()=>{
 const f=await fixture();try{
  const crypto=require('node:crypto'),{ENGINE}=require('../src/learning-chess-review-insights'),id=f.learning.createActivity(f.admin,f.classId,{title:'Coaching evidence',templateId:'scorm-connector-v1'}),c=f.learning.chess,s=f.learning.chessInsights;
  let m=c.create(f.a,id);m=c.join(f.b,id,m.id);
  for(const [i,move] of ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'].entries())m=await c.move(i%2?f.b:f.a,id,m.id,move,m.revision);
  c.leave(f.a,id,m.id,m.revision);const row=c.row(m.id),moves=JSON.parse(row.moves_json),hash=crypto.createHash('sha256').update(row.moves_json).digest('hex');
  const insert=(ply,patch={},engine=ENGINE,history=hash)=>{const evidence={ply,played:moves[ply],before:{depth:7,score:{type:'cp',value:100}},after:{depth:7,score:{type:'cp',value:0}},lossCp:100,factCodes:['moved-piece-capturable'],facts:['The moved piece can be captured legally.'],...patch};f.store.db.prepare('INSERT OR REPLACE INTO learning_chess_review_evidence VALUES(?,?,?,?,?,?)').run(m.id,ply,history,engine,JSON.stringify(evidence),new Date().toISOString());};
  for(const ply of [1,3,5])insert(ply);assert.equal(s.coaching(f.a,id).patterns.length,0);assert.equal(s.coaching(f.b,id).patterns[0].count,3);assert.equal(s.coaching(f.admin,id,{teacher:true}).patterns.length,0,'teacher cannot collect student evidence');
  for(const ply of [0,2])insert(ply);assert.equal(s.coaching(f.a,id).patterns.length,0);insert(4);assert.equal(s.coaching(f.a,id).patterns[0].count,3);assert.ok(f.learning.adaptive.profile(f.a,id).recommendations.includes('queen-capture'));
  insert(4,{lossCp:999});assert.equal(s.coaching(f.a,id).patterns.length,0);insert(4,{},'old-engine');assert.equal(s.coaching(f.a,id).patterns.length,0);insert(4,{},ENGINE,'old-history');assert.equal(s.coaching(f.a,id).patterns.length,0);
  f.store.db.prepare('UPDATE learning_chess_review_evidence SET evidence_json=? WHERE match_id=? AND ply=4').run('{',m.id);assert.equal(s.coaching(f.a,id).patterns.length,0);
  for(const ply of [0,2,4])insert(ply,{factCodes:['candidate-fork-evaluation-loss','king-neighborhood-evaluation-loss']});assert.deepEqual(s.coaching(f.a,id).patterns.map(p=>p.id),['candidate-fork-review','king-safety-review']);for(const ply of [0,2,4])insert(ply);
  insert(4);f.store.db.prepare("UPDATE learning_chess_matches SET mode='computer',human_color='black',black_id=NULL WHERE id=?").run(m.id);assert.equal(s.coaching(f.a,id).patterns[0].count,3,'black human counts odd plies');
  for(const ply of [1,3,5])insert(ply,{lossCp:0,after:{depth:7,score:{type:'cp',value:-100}}});assert.equal(s.coaching(f.a,id).patterns.length,0,'white engine moves never become black human mistakes');
  f.store.db.prepare("UPDATE learning_chess_matches SET mode='solo' WHERE id=?").run(m.id);assert.deepEqual(s.coaching(f.a,id).patterns[0],{id:'piece-safety-review',count:0,practiceBothSides:3});
  const other=f.learning.createActivity(f.admin,f.classId,{title:'Separate assignment',templateId:'scorm-connector-v1'});assert.equal(s.coaching(f.a,other).patterns.length,0);assert.throws(()=>s.coaching(f.outside,id));
  f.learning.platform.configure(f.admin,id,{points:20});const key=f.learning.direct.issue(f.admin,id),direct=f.learning.direct.enroll(id,key,{participantToken:crypto.randomBytes(32).toString('hex'),reportedId:'review-coaching-direct',name:'Synthetic Review'});assert.equal(s.coaching(direct,id).patterns.length,0);assert.throws(()=>s.coaching(direct,other));f.store.db.prepare('UPDATE learning_direct_participants SET revoked=1 WHERE user_id=?').run(direct.id);assert.throws(()=>s.coaching(direct,id));
  f.store.putUser({...f.a,enabled:false});assert.throws(()=>s.coaching(f.a,id));
 }finally{await f.close();}
});
test('saved bounded review advances, resumes, scopes and never changes played history',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic insights',templateId:'scorm-connector-v1'}),c=f.learning.chess;let m=c.create(f.a,id,{mode:'solo'});
  for(const move of ['e2e4','e7e5','g1f3','b8c6'])m=await c.move(f.a,id,m.id,move,m.revision);m=c.leave(f.a,id,m.id,m.revision);const before={...c.row(m.id)};let calls=0;
  c.computer={analyze:async position=>{calls++;return {move:uci(legal(parse(position))[0]),depth:7,score:{type:'cp',value:40}};}};
  const path='/api/v1/learning/activities/'+id+'/chess/review/matches/'+m.id+'/insights';
  let r=await f.request(f.a,path);assert.equal(r.body.analyzed,0);assert.equal(r.body.nextPly,0);
  r=await f.request(f.a,path,'POST',{});assert.equal(r.status,200);assert.equal(r.body.analyzed,3);assert.equal(r.body.nextPly,3);assert.equal(calls,6);assert.equal(r.body.graph[1].whiteCp,-40);
  assert.equal((await f.request(f.b,path)).status,404);r=await f.request(f.a,path);assert.equal(r.body.analyzed,3);assert.equal(calls,6,'reading evidence never starts search');
  r=await f.request(f.a,path,'POST',{});assert.equal(r.body.complete,true);assert.equal(r.body.analyzed,4);assert.equal(calls,8);await f.request(f.a,path,'POST',{});assert.equal(calls,8,'complete evidence is reused');
  assert.deepEqual({...c.row(m.id)},before);assert.equal(f.store.db.prepare('SELECT count(*) n FROM learning_chess_review_evidence').get().n,4);
  f.freeze(true);assert.equal((await f.request(f.a,path,'POST',{})).status,423);f.freeze(false);
  f.store.db.prepare('DELETE FROM learning_chess_matches WHERE id=?').run(m.id);assert.equal(f.store.db.prepare('SELECT count(*) n FROM learning_chess_review_evidence').get().n,0);
 }finally{await f.close();}
});
test('failed analysis and revoked authorization do not persist evidence',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic insights failure',templateId:'scorm-connector-v1'}),c=f.learning.chess;let m=c.create(f.a,id,{mode:'solo'});m=await c.move(f.a,id,m.id,'e2e4',m.revision);c.leave(f.a,id,m.id,m.revision);
  c.computer={analyze:async()=>{throw Error('Synthetic engine unavailable');}};await assert.rejects(f.learning.chessInsights.advance(f.a,id,m.id),/unavailable/);assert.equal(f.learning.chessInsights.pending.size,0);assert.equal(f.store.db.prepare('SELECT count(*) n FROM learning_chess_review_evidence').get().n,0);
  c.computer={analyze:async position=>{f.store.putUser({...f.a,enabled:false});return {move:uci(legal(parse(position))[0]),depth:7,score:{type:'cp',value:40}};}};await assert.rejects(f.learning.chessInsights.advance(f.a,id,m.id));assert.equal(f.store.db.prepare('SELECT count(*) n FROM learning_chess_review_evidence').get().n,0);
 }finally{await f.close();}
});
