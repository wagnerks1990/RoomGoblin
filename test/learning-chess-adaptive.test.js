'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {ChessAdaptive}=require('../src/learning-chess-adaptive');
const uuid=()=>crypto.randomUUID();
const WHITE_WIN=['e2e4','e7e5','f1c4','b8c6','d1h5','g8f6','h5f7'];
const BLACK_WIN=['f2f3','e7e5','g2g4','d8h4'];
test('corrupt historical games are quarantined without starving later games or accepting invalid evidence',async()=>{
 const f=await setup();try{
  const bad=create(f);finish(f,bad);f.store.db.prepare("UPDATE learning_chess_matches SET moves_json='malformed synthetic history',updated_at='2000-01-01' WHERE id=?").run(bad.id);
  const good=create(f);finish(f,good);const before=f.learning.chess.row(bad.id);
  assert.deepEqual(f.adaptive.backfill({limit:2}),{scanned:2,recorded:1,limit:2});assert.equal(f.adaptive.profile(f.a,f.id).eligibleGames,1);
  assert.deepEqual(f.learning.chess.row(bad.id),before);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_receipts WHERE match_id=?').get(bad.id).n,0);
  const quarantine=f.store.db.prepare('SELECT * FROM learning_chess_adaptive_quarantine WHERE match_id=?').get(bad.id);assert.match(quarantine.history_fingerprint,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(quarantine).includes('malformed'),false);
  assert.equal(f.adaptive.backfill({limit:2}).scanned,0);assert.throws(()=>f.adaptive.recordCompleted(bad.id),{status:409});
  f.store.db.prepare('UPDATE learning_chess_matches SET moves_json=? WHERE id=?').run(JSON.stringify(WHITE_WIN),bad.id);assert.equal(f.adaptive.recordCompleted(bad.id).eligible,true);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_quarantine').get().n,0);
 }finally{await f.close();}
});
test('quarantine audit failure rolls back and deleting the source game removes quarantine',async()=>{
 const f=await setup();try{const bad=create(f);finish(f,bad);f.store.db.prepare("UPDATE learning_chess_matches SET moves_json='invalid' WHERE id=?").run(bad.id);
  const original=f.learning.event;f.learning.event=()=>{throw Error('synthetic audit failure');};assert.throws(()=>f.adaptive.backfill({limit:1}),/synthetic audit failure/);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_quarantine').get().n,0);f.learning.event=original;
  assert.equal(f.adaptive.backfill({limit:1}).recorded,0);f.store.db.prepare('DELETE FROM learning_chess_matches WHERE id=?').run(bad.id);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_quarantine').get().n,0);
 }finally{await f.close();}
});
async function setup(){const f=await fixture();f.id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic adaptive chess',templateId:'scorm-connector-v1'});let available=true;f.adaptive=new ChessAdaptive(f.learning,{available:()=>available});f.available=value=>available=value;return f;}
function create(f,{user=f.a,mode='computer',difficulty='beginner',tracked=true,activity=f.id}={}){
 const game=f.learning.chess.create(user,activity,{mode,difficulty,requestId:uuid()});
 // Explicitly model both new instrumented and pre-upgrade historical games.
 f.store.db.prepare('DELETE FROM learning_chess_adaptive_provenance WHERE match_id=?').run(game.id);if(tracked)f.adaptive.trackMatch(game.id);return game;
}
function finish(f,game,{result='white',reason='checkmate',moves=result==='black'?BLACK_WIN:WHITE_WIN}={}){
 f.store.db.prepare("UPDATE learning_chess_matches SET status='finished',result=?,reason=?,moves_json=?,revision=revision+1,updated_at=? WHERE id=?").run(result,reason,JSON.stringify(moves),new Date().toISOString(),game.id);return f.learning.chess.row(game.id);
}
test('completed game evidence is durable, own-scoped and exactly idempotent',async()=>{
 const f=await setup();try{const game=create(f);finish(f,game);const before=f.learning.chess.row(game.id),first=f.adaptive.recordCompleted(game.id);assert.equal(first.eligible,true);assert.equal(f.adaptive.recordCompleted(game.id).reason,'already-recorded');
  const profile=f.adaptive.profile(f.a,f.id);assert.equal(profile.recentGames,1);assert.equal(profile.eligibleGames,1);assert.equal(profile.rating,null);assert.equal(f.adaptive.profile(f.b,f.id).recentGames,0);assert.deepEqual(new ChessAdaptive(f.learning).profile(f.a,f.id),profile);
  assert.deepEqual(f.learning.chess.row(game.id),before);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM learning_events WHERE kind='chess.adaptive.record'").get().n,1);
  for(const value of [f.a.id,f.b.id,game.id,f.a.displayName])assert.equal(JSON.stringify(profile).includes(value),false);
 }finally{await f.close();}
});
test('assisted, unknown-history, forfeited, timed-out, abandoned and solo games do not estimate strength',async()=>{
 const f=await setup();try{
  const assisted=create(f);f.adaptive.markAssisted(assisted.id);finish(f,assisted);assert.equal(f.adaptive.recordCompleted(assisted.id).exclusion,'assisted');
  const historical=create(f,{tracked:false});finish(f,historical);assert.equal(f.adaptive.recordCompleted(historical.id).exclusion,'unknown-assistance');
  for(const reason of ['forfeit','resignation','timeout','practice ended','queue cancelled','queue expired','inactive game','move limit']){const game=create(f);finish(f,game,{reason});assert.equal(f.adaptive.recordCompleted(game.id).eligible,false);}
  const solo=create(f,{mode:'solo'});finish(f,solo);assert.equal(f.adaptive.recordCompleted(solo.id).exclusion,'solo');
  const active=create(f);assert.equal(f.adaptive.recordCompleted(active.id).reason,'unfinished');
  const profile=f.adaptive.profile(f.a,f.id);assert.equal(profile.eligibleGames,0);assert.equal(profile.assistedGames,1);assert.equal(profile.band,1);
 }finally{await f.close();}
});
test('coach availability alone is not assistance; later actual help removes prior strength evidence',async()=>{
 const f=await setup();try{const game=create(f);f.store.db.prepare("UPDATE learning_chess_matches SET difficulty='adaptive-coach' WHERE id=?").run(game.id);finish(f,game);assert.equal(f.adaptive.recordCompleted(game.id).eligible,true);
  f.adaptive.markAssisted(game.id);assert.equal(f.adaptive.profile(f.a,f.id).eligibleGames,0);assert.equal(f.adaptive.profile(f.a,f.id).assistedGames,1);f.adaptive.recordCompleted(game.id);assert.equal(f.adaptive.profile(f.a,f.id).recentGames,1);
 }finally{await f.close();}
});
test('actual committed bands are bounded, per-revision idempotent and private',async()=>{
 const f=await setup();try{const game=create(f);f.store.db.prepare('UPDATE learning_chess_matches SET revision=1 WHERE id=?').run(game.id);const decision={band:4,style:'solid',unexpected:'not persisted'};
  const saved=f.adaptive.saveDecision(game.id,decision);assert.deepEqual(saved,{band:4,style:'solid',revision:1});assert.deepEqual(f.adaptive.saveDecision(game.id,decision),saved);
  assert.equal(f.store.db.prepare('SELECT band_turns FROM learning_chess_adaptive_provenance WHERE match_id=?').get(game.id).band_turns,1);assert.throws(()=>f.adaptive.saveDecision(game.id,{band:2,style:'solid'}),{status:409});
  f.store.db.prepare('UPDATE learning_chess_matches SET revision=2 WHERE id=?').run(game.id);f.adaptive.saveDecision(game.id,{band:2,style:'balanced'});finish(f,game);f.adaptive.recordCompleted(game.id);assert.equal(f.store.db.prepare('SELECT challenge_band FROM learning_chess_adaptive_samples WHERE match_id=?').get(game.id).challenge_band,3);
  assert.deepEqual(f.adaptive.lastDecision(f.a,f.id,game.id),{band:2,style:'balanced',revision:2});assert.throws(()=>f.adaptive.lastDecision(f.b,f.id,game.id),{status:404});assert.throws(()=>f.adaptive.saveDecision(game.id,{band:9,style:'balanced'}),{status:400});assert.throws(()=>f.adaptive.saveDecision(game.id,{band:1,style:'forged'}),{status:400});
 }finally{await f.close();}
});
test('repeated losses do not increase challenge merely through participation',async()=>{
 const f=await setup();try{const bands=[];for(let i=0;i<25;i++){const game=create(f,{difficulty:'standard'});finish(f,game,{result:'black'});f.adaptive.recordCompleted(game.id);bands.push(f.adaptive.profile(f.a,f.id).band);}
  for(let i=1;i<bands.length;i++)assert.ok(bands[i]<=bands[i-1]);const profile=f.adaptive.profile(f.a,f.id);assert.equal(profile.band,0);assert.equal(profile.style,'solid');assert.deepEqual(profile.recommendations,['escape-check','mate-in-one']);assert.match(profile.recommendationReason,/do not diagnose/);
 }finally{await f.close();}
});
test('decision is read-only, legal-history-bound and cannot provide live multiplayer assistance',async()=>{
 const f=await setup();try{const game=create(f),before=f.store.db.prepare('SELECT total_changes() n').get().n,decision=f.adaptive.decision(f.a,f.id,game,['e2e4']);assert.ok(decision.band>=0&&decision.band<=5);assert.equal(f.store.db.prepare('SELECT total_changes() n').get().n,before);
  assert.throws(()=>f.adaptive.decision(f.b,f.id,game,['e2e4']),{status:404});assert.throws(()=>f.adaptive.decision(f.a,f.id,{...game,revision:99},['e2e4']),{status:409});assert.throws(()=>f.adaptive.decision(f.a,f.id,game,['e2e5']),{status:409});assert.throws(()=>f.adaptive.decision(f.a,f.id,game,['e2e4','e7e5']),{status:409});
  const multi=create(f,{mode:'multiplayer'});assert.throws(()=>f.adaptive.decision(f.a,f.id,multi,['e2e4']),{status:404});f.available(false);assert.throws(()=>f.adaptive.decision(f.a,f.id,game,['e2e4']),{status:423});assert.throws(()=>f.adaptive.trackMatch(game.id),{status:423});
 }finally{await f.close();}
});
test('between-games adaptive practice preserves its creation snapshot while live mode follows new evidence',async()=>{
 const f=await setup();try{const game=create(f);f.store.db.prepare("UPDATE learning_chess_matches SET difficulty='adaptive-practice' WHERE id=?").run(game.id);f.store.db.prepare('DELETE FROM learning_chess_adaptive_provenance WHERE match_id=?').run(game.id);f.adaptive.trackMatch(game.id);
  const before=f.adaptive.decision(f.a,f.id,game,['e2e4']);assert.equal(before.band,1);
  for(let i=0;i<5;i++){const completed=create(f,{difficulty:'grandmaster'});finish(f,completed);f.adaptive.recordCompleted(completed.id);}
  assert.ok(f.adaptive.profile(f.a,f.id).band>before.band);assert.deepEqual(f.adaptive.decision(f.a,f.id,game,['e2e4']),before);
  f.store.db.prepare("UPDATE learning_chess_matches SET difficulty='adaptive' WHERE id=?").run(game.id);assert.ok(f.adaptive.decision(f.a,f.id,game,['e2e4']).band>before.band);
 }finally{await f.close();}
});
test('anonymous aggregate influence requires ten games and five distinct accounts',async()=>{
 const f=await setup();try{
  for(let i=0;i<10;i++){const game=create(f);finish(f,game,{result:'black',moves:BLACK_WIN});f.adaptive.recordCompleted(game.id);}assert.equal(f.adaptive.aggregateStyle(),'balanced','one account cannot create aggregate influence');
  for(let i=0;i<4;i++){const user=f.store.putUser({username:'synthetic-adaptive-'+i,displayName:'Synthetic '+i,role:'viewer',profileId:'learning-student'},{password:'synthetic-test-password'});f.learning.enroll(f.admin,f.classId,{userId:user.id,alias:'Synthetic '+i});const game=create(f,{user});finish(f,game,{result:'black',moves:BLACK_WIN});f.adaptive.recordCompleted(game.id);}
  assert.equal(f.adaptive.aggregateStyle(),'exploratory');const fresh=create(f,{user:f.b});const decision=f.adaptive.decision(f.b,f.id,fresh,['e2e4']);assert.equal(decision.style,'exploratory');assert.deepEqual(Object.keys(decision).sort(),['band','basis','confidence','notice','style']);
 }finally{await f.close();}
});
test('activity and account deletion remove evidence rather than leaving irreversible adaptation counters',async()=>{
 const f=await setup();try{const game=create(f);finish(f,game);f.adaptive.recordCompleted(game.id);assert.equal(f.adaptive.profile(f.a,f.id).eligibleGames,1);f.store.db.prepare('DELETE FROM learning_chess_matches WHERE id=?').run(game.id);assert.equal(f.adaptive.profile(f.a,f.id).eligibleGames,0);
  const next=create(f);finish(f,next);f.adaptive.recordCompleted(next.id);assert.equal(f.store.deleteUser(f.a.id),1);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_samples').get().n,0);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_receipts').get().n,0);
  const remaining=create(f,{user:f.b});finish(f,remaining);f.adaptive.recordCompleted(remaining.id);f.store.db.prepare('DELETE FROM learning_activities WHERE id=?').run(f.id);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_samples').get().n,0);
 }finally{await f.close();}
});
test('audit or outer transaction failures roll back evidence and applied decisions',async()=>{
 const f=await setup();try{const game=create(f);finish(f,game);const original=f.learning.event;f.learning.event=()=>{throw Error('synthetic audit failure');};assert.throws(()=>f.adaptive.recordCompleted(game.id));assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_receipts').get().n,0);f.learning.event=original;
  assert.throws(()=>f.store.tx(()=>{f.adaptive.saveDecision(game.id,{band:2,style:'balanced'});f.adaptive.recordCompleted(game.id);throw Error('synthetic move rollback');}));assert.equal(f.adaptive.lastDecision(f.a,f.id,game.id),null);assert.equal(f.adaptive.profile(f.a,f.id).recentGames,0);
 }finally{await f.close();}
});
test('backfill is explicit and bounded; direct revocation and assignment scope remain fresh',async()=>{
 const f=await setup();try{for(let i=0;i<3;i++){const game=create(f,{tracked:false});finish(f,game);}assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_adaptive_receipts').get().n,0);assert.deepEqual(f.adaptive.backfill({limit:2}),{scanned:2,recorded:2,limit:2});assert.equal(f.adaptive.backfill({limit:2}).recorded,1);assert.equal(f.adaptive.backfill({limit:2}).recorded,0);assert.throws(()=>f.adaptive.backfill({limit:51}),{status:400});assert.equal(f.adaptive.profile(f.a,f.id).eligibleGames,0);
  f.learning.platform.configure(f.admin,f.id,{points:20});const key=f.learning.direct.issue(f.admin,f.id),token=crypto.randomBytes(32).toString('hex'),user=f.learning.direct.enroll(f.id,key,{participantToken:token,reportedId:'adaptive-test',name:'Synthetic Participant'}),other=f.learning.createActivity(f.admin,f.classId,{title:'Other',templateId:'scorm-connector-v1'});assert.throws(()=>f.adaptive.profile(user,other),{status:401});f.store.db.prepare('UPDATE learning_direct_participants SET revoked=1 WHERE user_id=?').run(user.id);assert.throws(()=>f.adaptive.profile(user,f.id),{status:401});f.available(false);assert.throws(()=>f.adaptive.backfill({limit:1}),{status:423});
 }finally{await f.close();}
});
