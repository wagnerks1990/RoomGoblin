'use strict';
// Opt-in Linux acceptance using the real fixed-path native engine and HTTP API.
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {parse,legal,uci,apply,fen}=require('../src/learning-chess');
const enabled=process.env.ROOMGOBLIN_TEST_NATIVE_STOCKFISH==='1'&&process.env.ROOMGOBLIN_STOCKFISH==='1';
test('native adaptive HTTP creation, moves, resume, privacy and shutdown',{skip:!enabled,timeout:30000},async t=>{
 const f=await fixture(),computer=f.learning.chess.computer=new(require('../src/learning-chess-ai').ChessComputer)(),pids=new Set(),native=computer.stockfish,spawn=native.spawnProcess;
 native.spawnProcess=(...args)=>{const child=spawn(...args);pids.add(child.pid);return child;};
 try{
  const activity=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic native adaptive acceptance',templateId:'scorm-connector-v1'}),base='/api/v1/learning/activities/'+activity+'/chess';
  for(const difficulty of [undefined,'adaptive-practice','adaptive-coach','grandmaster'])await t.test(difficulty||'default adaptive',async()=>{
   const created=await f.rawRequest(f.a,base,'POST',{mode:'computer',...(difficulty?{difficulty}:{}),requestId:crypto.randomUUID()});assert.equal(created.status,200,JSON.stringify(created.body));const game=created.body.match;assert.equal(game.difficulty,difficulty||'adaptive');
   const pending=f.rawRequest(f.a,base+'/matches/'+game.id+'/move','POST',{move:'e2e4',revision:game.revision});
   // Wait for real process admission, then verify ordinary drain does not cancel
   // the ongoing HTTP transaction. No fake engine/search responses are used.
   for(let i=0;i<500&&!native.jobs.size;i++)await new Promise(resolve=>setTimeout(resolve,2));assert.ok(native.jobs.size>0);await computer.drain();
   const moved=await pending;assert.equal(moved.status,200,JSON.stringify(moved.body));const match=moved.body.match;assert.equal(match.revision,game.revision+1);assert.equal(match.moves.length,2);assert.equal(match.moves[0],'e2e4');
   let state=parse(game.fen);for(const move of match.moves){const selected=legal(state).find(candidate=>uci(candidate)===move);assert.ok(selected,'engine response must remain legal');state=apply(state,selected);}assert.equal(fen(state),match.fen);
   if(difficulty!=='grandmaster'){assert.ok(match.adaptive.band>=0&&match.adaptive.band<=5);assert.equal(match.adaptive.revision,match.revision);assert.deepEqual(Object.keys(match.adaptive).sort(),['band','revision','style']);}else assert.equal(match.adaptive,undefined);
   const resumed=await f.rawRequest(f.a,base+'/matches/'+game.id);assert.equal(resumed.status,200);assert.deepEqual(resumed.body.match.moves,match.moves);assert.deepEqual(resumed.body.match.adaptive,match.adaptive);assert.equal(resumed.body.match.fen,match.fen);
   const stopped=await f.rawRequest(f.a,base+'/matches/'+game.id+'/leave','POST',{revision:match.revision});assert.equal(stopped.status,200);assert.equal(stopped.body.match.reason,'practice ended');
   const profile=await f.rawRequest(f.a,base+'/adaptive');assert.equal(profile.status,200);assert.equal(profile.body.profile.eligibleGames,0);assert.equal(profile.body.profile.rating,null);
   const other=await f.rawRequest(f.b,base+'/adaptive');assert.equal(other.body.profile.recentGames,0);assert.equal(JSON.stringify(profile.body.profile).includes(f.b.id),false);assert.equal(native.jobs.size,0);assert.equal(computer.active,0);
  });
  await t.test('shutdown leaves no native children',async()=>{f.learning.chess.close();await computer.drain();assert.equal(native.jobs.size,0);assert.equal(computer.workers.size,0);for(const pid of pids)assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});assert.equal(pids.size,4);});
 }finally{f.learning.chess.close();await computer.drain();await f.close();}
});
