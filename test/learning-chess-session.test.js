'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {route}=require('../src/learning-direct');
async function setup(){const f=await fixture();f.id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic sessions',templateId:'scorm-connector-v1'});return f;}
test('distinct create intents persist several games while identical retries deduplicate',async()=>{
 const f=await setup();try{const c=f.learning.chess,requestId=randomUUID(),one=c.create(f.a,f.id,{mode:'solo',requestId}),two=c.create(f.a,f.id,{mode:'solo',requestId:randomUUID()});
  assert.notEqual(one.id,two.id);assert.equal(c.create(f.a,f.id,{mode:'solo',requestId}).id,one.id);
  assert.throws(()=>c.create(f.a,f.id,{mode:'computer',requestId}),{status:409});
  c.move(f.a,f.id,one.id,'e2e4',one.revision);
  assert.equal(JSON.parse(c.row(two.id).moves_json).length,0);
  f.store.db.prepare("UPDATE learning_chess_matches SET updated_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(one.id);
  c.expireClocks();assert.equal(c.row(one.id).status,'active');
 }finally{await f.close();}
});
test('draw agreements require two played moves, opponent acceptance and current revisions',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{requestId:randomUUID()});m=c.join(f.b,f.id,m.id);
  assert.throws(()=>c.draw(f.a,f.id,m.id,{action:'offer',revision:m.revision}),{status:409});
  m=c.move(f.a,f.id,m.id,'e2e4',m.revision);m=c.move(f.b,f.id,m.id,'e7e5',m.revision);
  const before=m.revision;m=c.draw(f.a,f.id,m.id,{action:'offer',revision:m.revision});assert.equal(m.drawOffer,'you');
  assert.throws(()=>c.draw(f.b,f.id,m.id,{action:'accept',revision:before}),{status:409});
  assert.throws(()=>c.draw(f.a,f.id,m.id,{action:'accept',revision:m.revision}),{status:409});
  m=c.draw(f.b,f.id,m.id,{action:'accept',revision:m.revision});assert.equal(m.status,'finished');assert.equal(m.result,'draw');assert.equal(m.reason,'agreement');
 }finally{await f.close();}
});
test('a draw offer survives the offerer move until an opponent legal move or terminal result',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{requestId:randomUUID()});m=c.join(f.b,f.id,m.id);
  m=c.move(f.a,f.id,m.id,'e2e4',m.revision);m=c.move(f.b,f.id,m.id,'e7e5',m.revision);
  m=c.draw(f.a,f.id,m.id,{action:'offer',revision:m.revision});m=c.move(f.a,f.id,m.id,'g1f3',m.revision);
  assert.equal(m.drawOffer,'you');assert.equal(c.row(m.id).draw_offer,f.a.id);
  assert.equal(c.render(c.row(m.id),f.b).drawOffer,'opponent');
  assert.throws(()=>c.move(f.b,f.id,m.id,'e7e6',m.revision),{status:409});assert.equal(c.row(m.id).draw_offer,f.a.id,'a rejected move cannot decline an offer');
  m=c.move(f.b,f.id,m.id,'b8c6',m.revision);assert.equal(m.drawOffer,null);assert.equal(c.row(m.id).draw_offer,null);
  let mate=c.create(f.a,f.id,{requestId:randomUUID()});mate=c.join(f.b,f.id,mate.id);
  for(const [user,move] of [[f.a,'f2f3'],[f.b,'e7e5'],[f.a,'g2g4']])mate=c.move(user,f.id,mate.id,move,mate.revision);
  mate=c.draw(f.b,f.id,mate.id,{action:'offer',revision:mate.revision});mate=c.move(f.b,f.id,mate.id,'d8h4',mate.revision);
  assert.equal(mate.reason,'checkmate');assert.equal(mate.drawOffer,null);assert.equal(c.row(mate.id).draw_offer,null);
 }finally{await f.close();}
});
test('a legal intended move can establish a threefold claim without committing that move',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{mode:'solo',requestId:randomUUID()});
  for(const move of ['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1'])m=c.move(f.a,f.id,m.id,move,m.revision);
  assert.equal(m.drawClaims.repetition,false);
  assert.throws(()=>c.draw(f.a,f.id,m.id,{action:'claim',kind:'repetition',move:'f6f8',revision:m.revision}),{status:409});
  m=c.draw(f.a,f.id,m.id,{action:'claim',kind:'repetition',move:'f6g8',revision:m.revision});
  assert.equal(m.reason,'threefold repetition');assert.equal(m.moves.length,7);
 }finally{await f.close();}
});
test('server expires the running clock once and preserves forfeit/timeout attribution',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{timeControl:'5+3',requestId:randomUUID()});m=c.join(f.b,f.id,m.id);
  const start=c.row(m.id).turn_started_at;assert.equal(c.clock(c.row(m.id),start).white,300000);assert.equal(m.clocks.increment,3000);
  c.expireClocks(start+300001);const row=c.row(m.id);assert.equal(row.status,'finished');assert.equal(row.result,'black');assert.equal(row.reason,'timeout');
  const revision=row.revision;c.expireClocks(start+600000);assert.equal(c.row(m.id).revision,revision);
  assert.throws(()=>c.move(f.a,f.id,m.id,'e2e4',revision),{status:404});
  const publicBoard=(await f.request(null,'/api/v1/chess/leaderboard')).body;
  const a=publicBoard.players.find(p=>p.label==='Investigator A.'),b=publicBoard.players.find(p=>p.label==='Investigator B.');
  assert.equal(a.losses,1);assert.equal(b.wins,1);assert.equal(b.winRate,100);
  for(const p of publicBoard.players){assert.equal('id' in p,false);assert.equal('activityId' in p,false);}
 }finally{await f.close();}
});
test('leaderboard distinguishes checkmates, forfeits and own-move averages from separate solo practice',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{requestId:randomUUID()});m=c.join(f.b,f.id,m.id);
  for(const [user,move] of [[f.a,'f2f3'],[f.b,'e7e5'],[f.a,'g2g4'],[f.b,'d8h4']])m=c.move(user,f.id,m.id,move,m.revision);
  assert.equal(m.reason,'checkmate');
  let next=c.create(f.a,f.id,{requestId:randomUUID()});next=c.join(f.b,f.id,next.id);c.leave(f.a,f.id,next.id,next.revision);
  let practice=c.create(f.b,f.id,{mode:'solo',requestId:randomUUID()});practice=c.move(f.b,f.id,practice.id,'e2e4',practice.revision);c.leave(f.b,f.id,practice.id,practice.revision);
  const board=c.standings(f.b),winner=board.players.find(p=>p.me);
  assert.equal(winner.games,2);assert.equal(winner.wins,2);assert.equal(winner.mateWins,1);assert.equal(winner.forfeitWins,1);assert.equal(winner.timeoutWins,0);
  assert.equal(winner.avgGameMoves,1);assert.equal(winner.avgMovesPerWin,1);assert.equal(winner.avgMovesToMate,2);assert.equal(winner.fastestMate,2);assert.equal(winner.soloStats.started,1);assert.equal(winner.soloStats.stopped,1);assert.equal(winner.soloStats.games,0);
 }finally{await f.close();}
});
test('direct draw HTTP extension is exact and private while the public projection is allowlisted',async()=>{
 const f=await setup();try{f.learning.platform.configure(f.admin,f.id,{points:20});const entry='/api/v1/learning/direct/activities/'+f.id,key=f.learning.direct.issue(f.admin,f.id),tokens=[randomUUID().replaceAll('-','')+randomUUID().replaceAll('-',''),randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','')];
  for(let i=0;i<2;i++)assert.equal((await f.request(null,entry+'/enroll','POST',{participantToken:tokens[i],reportedId:'synthetic-'+i,name:i?'Private, Bailey':'Family, Alex'},{Authorization:'RoomGoblin-Assignment '+key})).status,200);
  const h=i=>({Authorization:'Bearer '+tokens[i]});
  let r=await f.request(null,entry+'/chess','POST',{requestId:randomUUID()},h(0)),m=r.body.match;
  r=await f.request(null,entry+'/chess/matches/'+m.id+'/join','POST',{},h(1));m=r.body.match;
  for(const [who,move] of [[0,'e2e4'],[1,'e7e5']]){r=await f.request(null,entry+'/chess/matches/'+m.id+'/move','POST',{move,revision:m.revision},h(who));assert.equal(r.status,200);m=r.body.match;}
  const draw=entry+'/chess/matches/'+m.id+'/draw';assert.ok(route('POST',draw));
  for(const method of ['GET','PUT','DELETE','PATCH','HEAD'])assert.equal(route(method,draw),null);
  for(const suffix of ['/','/extra','%2Fextra'])assert.equal(route('POST',draw+suffix),null);
  assert.equal((await f.request(null,draw,'POST',{action:'offer',revision:m.revision})).status,401);
  r=await f.request(null,draw,'POST',{action:'offer',revision:m.revision},h(0));assert.equal(r.status,200);m=r.body.match;
  r=await f.request(null,draw,'POST',{action:'accept',revision:m.revision},h(1));assert.equal(r.status,200);assert.equal(r.body.match.reason,'agreement');
  const publicBoard=await f.request(null,'/api/v1/chess/leaderboard');assert.equal(publicBoard.status,200);
  assert.equal(publicBoard.headers.get('cache-control'),'no-store');assert.equal(publicBoard.headers.get('referrer-policy'),'no-referrer');
  const fields=['rank','playerKey','label','games','wins','losses','draws','winRate','mateWins','forfeitWins','timeoutWins','mateLosses','forfeitLosses','timeoutLosses','avgGameMoves','avgMovesPerWin','avgMovesToMate','fastestMate','currentWinStreak','bestWinStreak'].sort();
  assert.deepEqual(publicBoard.body.players.map(p=>p.label).sort(),['Alex F.','Bailey P.']);for(const p of publicBoard.body.players)assert.deepEqual(Object.keys(p).sort(),fields);
  assert.equal((await f.request(null,'/api/v1/chess/leaderboard','POST',{})).status,404);
 }finally{await f.close();}
});
test('an explicitly selected stale queue cannot join until its owner reconnects',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{requestId:randomUUID()});
  f.store.db.prepare("UPDATE learning_chess_matches SET updated_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(m.id);
  f.store.db.prepare('DELETE FROM learning_chess_presence WHERE activity_id=? AND user_id=?').run(f.id,f.a.id);
  assert.throws(()=>c.join(f.b,f.id,m.id),{status:409});assert.equal(c.row(m.id).black_id,null);
  c.heartbeat(f.a,f.id);assert.equal(c.join(f.b,f.id,m.id).status,'active');
 }finally{await f.close();}
});
test('a disabled seat pauses its server clock and re-enabling starts from the saved balance',async()=>{
 const f=await setup();try{const c=f.learning.chess;c.close();let m=c.create(f.a,f.id,{timeControl:'5+3',requestId:randomUUID()});m=c.join(f.b,f.id,m.id);const start=c.row(m.id).turn_started_at;
  f.store.putUser({...f.a,enabled:false});c.expireClocks(start+1000);let row=c.row(m.id);
  assert.equal(row.status,'active');assert.equal(row.turn_started_at,null);assert.equal(row.white_ms,299000);
  c.expireClocks(start+900000);assert.equal(c.row(m.id).white_ms,299000);assert.equal(c.row(m.id).status,'active');
  f.store.putUser({...f.a,enabled:true});c.expireClocks(start+900001);row=c.row(m.id);
  assert.equal(row.turn_started_at,start+900001);assert.equal(row.white_ms,299000);assert.equal(c.clock(row,start+900101).white,298900);assert.equal(row.status,'active');
 }finally{await f.close();}
});
