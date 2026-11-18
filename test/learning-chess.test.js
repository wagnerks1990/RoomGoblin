'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {START,parse,fen,legal,play}=require('../src/learning-chess');
const {route}=require('../src/learning-direct');

test('rules match standard perft counts and handle promotion, pins and automatic draws',()=>{
 const {apply,outcome}=require('../src/learning-chess');
 const perft=(s,depth)=>depth?legal(s).reduce((n,m)=>n+perft(apply(s,m),depth-1),0):1;
 assert.equal(perft(parse(),3),8902);
 const kiwipete=parse('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
 assert.equal(perft(kiwipete,2),2039);
 assert.match(play('7k/P7/8/8/8/8/8/7K w - - 0 1',[],'a7a8n').fen,/N6k/);
 assert.throws(()=>play('4r1k1/8/8/8/8/8/4R3/4K3 w - - 0 1',[],'e2d2'),{status:409});
 assert.equal(outcome([parse('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1')]).reason,'stalemate');
 assert.equal(outcome([parse('7k/8/8/8/8/8/8/K7 w - - 0 1')]).reason,'insufficient material');
 assert.equal(outcome([parse('7k/8/8/8/8/8/R7/K7 w - - 150 1')]).reason,'automatic draw');
});

test('teacher seats retain original activity after new assignments and chess assets require teacher access',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Original chess',templateId:'scorm-connector-v1'});
  const base='/api/v1/learning/teacher/classes/'+f.classId+'/chess';
  const game=(await f.request(f.admin,base,'POST',{mode:'solo'})).body.match;
  f.learning.createActivity(f.admin,f.classId,{title:'New chess',templateId:'scorm-connector-v1'});
  assert.equal((await f.request(f.admin,base+'/matches/'+game.id+'/move','POST',{move:'e2e4',revision:0})).status,200);
  assert.equal(f.learning.chess.row(game.id).activity_id,id);
  for(const path of ['/learn/chess','/learn/chess/index.html','/learn/chess/app.js','/learn/chess/sco/app.js']){
   assert.equal((await f.request(null,path)).status,403,path);
   assert.equal((await f.request(f.a,path)).status,403,path);
  }
  assert.equal((await f.request(f.admin,'/learn/chess')).status,200);
  for(const path of ['/learn//chess/index.html','/learn/%63hess/index.html','/learn/chess%2findex.html'])assert.equal((await f.request(null,path)).status,404,path);
 }finally{await f.close();}
});

test('both seats respect assignment pauses, closures and export freeze; queue retries resume',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Chess controls',templateId:'scorm-connector-v1'});
  const base='/api/v1/learning/activities/'+id+'/chess';
  const game=(await f.request(f.a,base,'POST',{})).body.match;
  assert.equal((await f.request(f.a,base,'POST',{})).body.match.id,game.id);
  await f.request(f.admin,'/api/v1/learning/teacher/activities/'+id+'/command','PUT',{paused:true,stage:1,hint:'',version:0});
  assert.equal((await f.request(f.b,base,'POST',{})).status,409);
  await f.request(f.admin,'/api/v1/learning/teacher/activities/'+id+'/command','PUT',{paused:false,stage:1,hint:'',version:1});
  assert.equal((await f.request(f.b,base,'POST',{})).body.match.id,game.id);
  assert.equal((await f.request(f.b,base,'POST',{})).body.match.id,game.id);
  f.freeze(true);
  assert.equal((await f.request(f.a,base+'/matches/'+game.id+'/move','POST',{move:'e2e4',revision:1})).status,423);
  assert.equal((await f.request(f.a,base+'/heartbeat','POST',{})).status,423);
  assert.equal((await f.request(f.a,base+'/leaderboard')).status,200);
  f.freeze(false);
  f.learning.settings(f.admin,id,{open:false});
  assert.equal((await f.request(f.a,base+'/matches/'+game.id+'/move','POST',{move:'e2e4',revision:1})).status,409);
  assert.equal(f.learning.chess.row(game.id).revision,1);
 }finally{await f.close();}
});

test('cross-class paused or revoked seats cannot be matched or moved through the other class',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Chess A',templateId:'scorm-connector-v1'});
  const second=f.learning.createClass(f.admin,'Chess B');f.learning.enroll(f.admin,second,{userId:f.outside.id,alias:'Private Family Name'});
  const other=f.learning.createActivity(f.admin,second,{title:'Chess B',templateId:'scorm-connector-v1'});
  const a='/api/v1/learning/activities/'+id+'/chess',b='/api/v1/learning/activities/'+other+'/chess';
  const game=(await f.request(f.a,a,'POST',{})).body.match;
  f.learning.settings(f.admin,id,{open:false});
  assert.equal((await f.request(f.outside,b+'/matches/'+game.id+'/join','POST',{})).status,409);
  f.learning.settings(f.admin,id,{open:true});
  assert.equal((await f.request(f.outside,b+'/matches/'+game.id+'/join','POST',{})).status,200);
  f.learning.settings(f.admin,other,{open:false});
  assert.equal((await f.request(f.a,a+'/matches/'+game.id+'/move','POST',{move:'e2e4',revision:1})).status,409);
  assert.equal(f.learning.chess.publicName(f.outside.id,other,'white'),'Private N.');
  assert.equal((await f.request(f.a,'/api/v1/learning/activities/'+f.activityId+'/chess')).status,409);
 }finally{await f.close();}
});

test('leaderboard includes authoritative checkmate and repetition draws without mixing practice',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Chess outcomes',templateId:'scorm-connector-v1'});
  const c=f.learning.chess;
  const finish=(mode,moves)=>{
   let m=c.create(f.a,id,{mode});if(mode==='multiplayer')m=c.join(f.b,id,m.id);
   for(const move of moves){const user=mode==='solo'||m.turn==='white'?f.a:f.b;m=c.move(user,id,m.id,move,m.revision);}
   return m;
  };
  const mate=['f2f3','e7e5','g2g4','d8h4'];
  assert.equal(finish('multiplayer',mate).reason,'checkmate');
  assert.equal(finish('solo',mate).result,'black');
  const repeat=Array(4).fill(['g1f3','g8f6','f3g1','f6g8']).flat();
  assert.equal(finish('multiplayer',repeat).result,'draw');
  const practice=c.create(f.a,id,{mode:'computer'});c.move(f.a,id,practice.id,'e2e4',0);
  const board=c.leaderboard(f.a,id),me=board.players.find(p=>p.me);
  assert.equal(me.games,2);assert.equal(me.losses,1);assert.equal(me.draws,1);assert.equal(me.winRate,0);
  assert.deepEqual(me.soloStats,{started:1,active:0,games:1,wins:0,losses:1,draws:0,stopped:0,winRate:0});
  assert.equal(me.computerStats.games,0);assert.equal(me.computerStats.active,1);
  assert.equal(c.progress(f.a,id),5);
  const other=c.leaderboard(f.b,id);
  assert.equal(other.players.find(p=>p.me).winRate,50);
  assert.equal(board.players.find(p=>p.me).rank,other.players.find(p=>!p.me).rank);
 }finally{await f.close();}
});

test('chess records do not prevent native user deletion or retain orphaned presence',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Chess cleanup',templateId:'scorm-connector-v1'});
  const m=f.learning.chess.create(f.a,id,{mode:'solo'});f.learning.chess.heartbeat(f.a,id);
  assert.equal(f.store.deleteUser(f.a.id),1);
  assert.equal(f.learning.chess.row(m.id),undefined);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_chess_presence WHERE user_id=?').get(f.a.id).n,0);
 }finally{await f.close();}
});

test('teacher monitoring masks full aliases outside assigned classes and page reads are rate limited',async()=>{
 const f=await fixture();try{
  const teacher=f.store.putUser({username:'limited-chess-teacher',displayName:'Limited Teacher',role:'operator',profileId:'teacher'},{password:'synthetic-test-password'});
  f.learning.createClass(teacher,'Teacher owned class');
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Private chess',templateId:'scorm-connector-v1'});
  let game=f.learning.chess.create(f.a,id);game=f.learning.chess.join(f.b,id,game.id);
  for(const move of ['f2f3','e7e5','g2g4','d8h4'])game=f.learning.chess.move(game.turn==='white'?f.a:f.b,id,game.id,move,game.revision);
  assert.equal(f.learning.chess.teacherList(teacher)[0].white.name,'Investigator A.');
  assert.ok(f.learning.chess.leaderboard(teacher,null,{teacher:true}).players.every(p=>/^Player-[A-F0-9]{8}$/.test(p.label)));
  assert.throws(()=>f.learning.chess.teacherActivity(teacher,f.classId),{status:404});
  for(let i=0;i<120;i++)assert.equal((await f.request(f.admin,'/learn/chess/app.js')).status,200);
  const limited=await f.request(f.admin,'/learn/chess/app.js');assert.equal(limited.status,429);assert.ok(limited.headers.get('retry-after'));
 }finally{await f.close();}
});

test('revoked direct participants cannot move and cannot be moved against by an authorized opponent',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Revocable chess',templateId:'scorm-connector-v1'});
  f.learning.platform.configure(f.admin,id,{points:20});
  const key=f.learning.direct.issue(f.admin,id),token=crypto.randomBytes(32).toString('hex');
  const user=f.learning.direct.enroll(id,key,{participantToken:token,reportedId:'synthetic-revocation',name:'Synthetic Name'});
  let game=f.learning.chess.create(f.a,id);game=f.learning.chess.join(user,id,game.id);
  f.store.db.prepare('UPDATE learning_direct_participants SET revoked=1 WHERE user_id=?').run(user.id);
  const base='/api/v1/learning/activities/'+id+'/chess';
  assert.equal((await f.request(f.a,base+'/matches/'+game.id+'/move','POST',{move:'e2e4',revision:game.revision})).status,409);
  const direct='/api/v1/learning/direct/activities/'+id+'/chess';
  assert.equal((await f.request(null,direct,'GET',undefined,{Authorization:'Bearer '+token})).status,401);
  assert.equal(f.learning.chess.row(game.id).moves_json,'[]');
  // An unavailable opponent does not trap the remaining authorized participant.
  assert.equal((await f.request(f.a,base+'/matches/'+game.id+'/leave','POST',{revision:game.revision})).status,200);
 }finally{await f.close();}
});

test('chess engine enforces legal turns, special moves, and checkmate',()=>{
 assert.equal(legal(parse(START)).length,20);
 const e4=play(START,[],'e2e4');assert.match(e4.fen,/ b KQkq e3 /);
 assert.equal(play(START,['f2f3','e7e5','g2g4'],'d8h4').outcome.reason,'checkmate');
 assert.match(play(START,['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'],'e1g1').fen,/RNBQ1RK1/);
 assert.match(play(START,['e2e4','a7a6','e4e5','d7d5'],'e5d6').fen,/p2P4/);
 assert.throws(()=>play(START,[],'e2e5'),{status:409});
 assert.throws(()=>play(START,[],'z9z1'),{status:400});
});
test('direct student gateway routes remain narrowly permitted',()=>{
 const activity='11111111-1111-4111-8111-111111111111',match='22222222-2222-4222-8222-222222222222';
 const prefix='/api/v1/learning/direct/activities/'+activity+'/chess';
 for(const path of [prefix,prefix+'/matches/'+match]){
  assert.ok(route('GET',path));assert.equal(route('DELETE',path),null);
 }
 for(const path of [prefix,prefix+'/heartbeat',prefix+'/matches/'+match+'/join',prefix+'/matches/'+match+'/move',prefix+'/matches/'+match+'/leave'])assert.ok(route('POST',path),path);
 assert.equal(route('GET',prefix+'/matches'),null);
 assert.equal(route('POST',prefix+'/matches'),null);
 assert.equal(route('GET',prefix+'/heartbeat'),null);
 assert.equal(route('GET',prefix+'/matches/'+match+'/move'),null);
 assert.equal(route('GET',prefix+'/matches/'+match+'/teacher'),null);
});
test('universal multiplayer across activities preserves authorization and teacher seats',async()=>{
 const f=await fixture();
 try{
  const id1=f.learning.createActivity(f.admin,f.classId,{title:'Chess A',templateId:'scorm-connector-v1'});
  const class2=f.learning.createClass(f.admin,'Synthetic other period');
  f.learning.enroll(f.admin,class2,{userId:f.outside.id,alias:'Guest from second class'});
  const id2=f.learning.createActivity(f.admin,class2,{title:'Chess B',templateId:'scorm-connector-v1'});
  const first='/api/v1/learning/activities/'+id1+'/chess',other='/api/v1/learning/activities/'+id2+'/chess';
  assert.equal((await f.request(f.outside,first)).status,404);
  let created=await f.request(f.a,first,'POST',{mode:'multiplayer'});
  assert.equal(created.status,200);const game=created.body.match;
  assert.equal(game.status,'waiting');assert.equal(game.mode,'multiplayer');
  let visible=await f.request(f.outside,other);
  assert.equal(visible.status,200);
  assert.ok(visible.body.matches.find(m=>m.id===game.id)?.canJoin);
  assert.equal(visible.body.matches.find(m=>m.id===game.id).white.name,'Investigator A.');
  assert.equal(visible.body.matches.find(m=>m.id===game.id).white.id,null);
  assert.equal((await f.request(f.outside,other+'/matches/'+game.id+'/move','POST',{move:'e7e5',revision:0})).status,404);
  let joined=await f.request(f.outside,other+'/matches/'+game.id+'/join','POST',{});
  assert.equal(joined.status,200);assert.equal(joined.body.match.status,'active');
  assert.equal((await f.request(f.a,first+'/matches/'+game.id+'/move','POST',{move:'e2e5',revision:1})).status,409);
  const white=await f.request(f.a,first+'/matches/'+game.id+'/move','POST',{move:'e2e4',revision:1});
  assert.equal(white.status,200);
  assert.equal(white.body.match.revision,2);
  assert.equal((await f.request(f.a,first+'/matches/'+game.id+'/move','POST',{move:'d2d4',revision:2})).status,403);
  assert.equal((await f.request(f.outside,other+'/matches/'+game.id+'/move','POST',{move:'e7e5',revision:1})).status,409);
  const black=await f.request(f.outside,other+'/matches/'+game.id+'/move','POST',{move:'e7e5',revision:2});
  assert.equal(black.status,200);assert.equal(black.body.match.moves.length,2);
  assert.equal((await f.request(f.b,first+'/matches/'+game.id)).status,404);
  const teacher=await f.request(f.admin,'/api/v1/learning/teacher/chess');
  assert.equal(teacher.status,200);assert.ok(teacher.body.matches.find(m=>m.id===game.id));
  assert.equal((await f.request(f.a,first+'/matches/'+game.id+'/leave','POST',{revision:3})).status,200);
  const teacherGame=await f.request(f.admin,'/api/v1/learning/teacher/classes/'+f.classId+'/chess','POST',{mode:'multiplayer'});
  assert.equal(teacherGame.status,200);
  assert.equal(teacherGame.body.match.white.id,f.admin.id);
  const studentJoin=await f.request(f.outside,other+'/matches/'+teacherGame.body.match.id+'/join','POST',{});
  assert.equal(studentJoin.status,200);
  const teacherMove=await f.request(f.admin,'/api/v1/learning/teacher/classes/'+f.classId+'/chess/matches/'+teacherGame.body.match.id+'/move','POST',{move:'e2e4',revision:1});
  assert.equal(teacherMove.status,200);
  const resign=await f.request(f.admin,'/api/v1/learning/teacher/classes/'+f.classId+'/chess/matches/'+teacherGame.body.match.id+'/leave','POST',{revision:2});
  assert.equal(resign.body.match.result,'black');
  assert.equal(resign.body.match.reason,'resignation');
 }finally{await f.close();}
});
test('solo and computer games accept legal moves and protect move revisions',async()=>{
 const f=await fixture();
 try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Chess Lab',templateId:'scorm-connector-v1'}),base='/api/v1/learning/activities/'+id+'/chess';
  let solo=await f.request(f.a,base,'POST',{mode:'solo'});
  assert.equal(solo.body.match.status,'active');
  let white=await f.request(f.a,base+'/matches/'+solo.body.match.id+'/move','POST',{move:'e2e4',revision:0});
  assert.equal(white.body.match.turn,'black');
  let black=await f.request(f.a,base+'/matches/'+solo.body.match.id+'/move','POST',{move:'e7e5',revision:1});
  assert.equal(black.body.match.moves.length,2);
  let computer=await f.request(f.a,base,'POST',{mode:'computer'});
  const move=await f.request(f.a,base+'/matches/'+computer.body.match.id+'/move','POST',{move:'e2e4',revision:0});
  assert.equal(move.status,200);assert.equal(move.body.match.moves.length,2);
  assert.equal(move.body.match.turn,'white');
  assert.equal((await f.request(f.a,base+'/matches/'+computer.body.match.id+'/move','POST',{move:'d2d4',revision:0})).status,409);
  let left=await f.request(f.a,base+'/matches/'+computer.body.match.id+'/leave','POST',{revision:1});
  assert.equal(left.body.match.status,'finished');
 }finally{await f.close();}
});
test('SCORM bearer enrolls passwordlessly and reaches global chess lobby without teacher access',async()=>{
 const f=await fixture();
 try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Chess SCORM',templateId:'scorm-connector-v1'});
  f.learning.platform.configure(f.admin,id,{points:20});
  const key=f.learning.direct.issue(f.admin,id),token=crypto.randomBytes(32).toString('hex');
  const entry='/api/v1/learning/direct/activities/'+id;
  const enroll=await f.request(null,entry+'/enroll','POST',{participantToken:token,reportedId:'synthetic-LMS-123',name:'Synthetic Guest'},{Authorization:'RoomGoblin-Assignment '+key});
  assert.equal(enroll.status,200);
  const h={Authorization:'Bearer '+token};
  const created=await f.request(null,entry+'/chess','POST',{mode:'multiplayer'},h);
  assert.equal(created.status,200);assert.equal(created.body.match.status,'waiting');
  assert.equal((await f.request(null,entry+'/chess', 'GET',undefined,{Authorization:'Bearer '+crypto.randomBytes(32).toString('hex')})).status,401);
  assert.equal((await f.request(null,'/api/v1/learning/teacher/chess','GET',undefined,h)).status,401);
  assert.equal((await f.request(null,entry+'/chess/heartbeat','POST',{},h)).status,200);
  const directName=f.learning.chess.alias(f.learning.direct.authorize(id,token).id,id);
  assert.equal(directName,'Synthetic Guest');
  const anotherToken=crypto.randomBytes(32).toString('hex');
  const second=await f.request(null,entry+'/enroll','POST',{participantToken:anotherToken,reportedId:'synthetic-LMS-456',name:'Doe, Jane'},{Authorization:'RoomGoblin-Assignment '+key});
  assert.equal(second.status,200);
  const another=f.learning.direct.authorize(id,anotherToken);
  assert.equal(f.learning.chess.alias(another.id,id),'Doe, Jane');
  assert.equal(f.learning.chess.publicName(another.id,id,'white'),'Jane D.');
  const teacherList=await f.request(f.admin,'/api/v1/learning/teacher/chess');
  assert.equal(teacherList.body.matches.find(m=>m.id===created.body.match.id).white.name,'Synthetic Guest');
 }finally{await f.close();}
});

test('chess SCORM ZIP contains offline assets and direct API configuration',async()=>{
 const f=await fixture();
 try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Chess SCORM package test',templateId:'scorm-connector-v1'});
  const key=f.learning.direct.issue(f.admin,id),activity=f.learning.activity(f.admin,id,true);
  const {createChessPackage}=require('../src/learning-chess-package');
  const AdmZip=require('adm-zip');
  const zip=new AdmZip(createChessPackage(activity,{origin:'https://synthetic-learning.example',enrollmentKey:key},require('node:path').join(__dirname,'../public/learn')));
  const names=zip.getEntries().map(e=>e.entryName);
  for(const filename of ['index.html','app.js','style.css','config.js','roomgoblin-scorm.js','imsmanifest.xml'])assert.ok(names.includes(filename),filename);
  const manifest=zip.readAsText('imsmanifest.xml');
  assert.ok(manifest.includes('<schemaversion>1.2</schemaversion>'));
  assert.ok(manifest.includes('href="index.html"'));
  const config=zip.readAsText('config.js');
  assert.ok(config.includes('"transport":"direct"'));
  assert.ok(config.includes('enrollmentKey'));
  assert.ok(!config.includes('password'));
 }finally{await f.close();}
});

test('queue action automatically matches a player from a different class',async()=>{
 const f=await fixture();
 try{
  const class2=f.learning.createClass(f.admin,'Second period');
  f.learning.enroll(f.admin,class2,{userId:f.outside.id,alias:'Second Period Student'});
  const a=f.learning.createActivity(f.admin,f.classId,{title:'First chess connection',templateId:'scorm-connector-v1'});
  const b=f.learning.createActivity(f.admin,class2,{title:'Second chess connection',templateId:'scorm-connector-v1'});
  const first=await f.request(f.a,'/api/v1/learning/activities/'+a+'/chess','POST',{mode:'multiplayer'});
  assert.equal(first.status,200);assert.equal(first.body.match.status,'waiting');
  const paired=await f.request(f.outside,'/api/v1/learning/activities/'+b+'/chess','POST',{mode:'multiplayer'});
  assert.equal(paired.status,200);assert.equal(paired.body.match.id,first.body.match.id);
  assert.equal(paired.body.match.status,'active');assert.equal(paired.body.match.myColor,'black');
  const whiteView=await f.request(f.a,'/api/v1/learning/activities/'+a+'/chess');
  assert.equal(whiteView.body.matches.find(m=>m.id===first.body.match.id).status,'active');
 }finally{await f.close();}
});

test('public student gateway denies admin chess pages and limits leaderboards to GET',()=>{
 const {allowedPath}=require('../src/learning-public');
 const id='11111111-1111-4111-8111-111111111111';
 assert.equal(allowedPath('GET','/learn/chess'),false);
 assert.equal(allowedPath('GET','/learn/chess/app.js'),false);
 assert.equal(allowedPath('GET','/api/v1/learning/teacher/chess'),false);
 assert.equal(allowedPath('GET','/api/v1/learning/teacher/chess/leaderboard'),false);
 assert.equal(allowedPath('GET','/api/v1/learning/direct/activities/'+id+'/chess/leaderboard'),true);
 assert.equal(allowedPath('POST','/api/v1/learning/direct/activities/'+id+'/chess/leaderboard'),false);
});

test('global leaderboard derives results once, separates practice, and masks other classes',async()=>{
 const f=await fixture();
 try{
  const class2=f.learning.createClass(f.admin,'Synthetic chess second class');
  f.learning.enroll(f.admin,class2,{userId:f.outside.id,alias:'Second Student'});
  const a=f.learning.createActivity(f.admin,f.classId,{title:'Chess ranking A',templateId:'scorm-connector-v1'});
  const b=f.learning.createActivity(f.admin,class2,{title:'Chess ranking B',templateId:'scorm-connector-v1'});
  const aUrl='/api/v1/learning/activities/'+a+'/chess',bUrl='/api/v1/learning/activities/'+b+'/chess';
  const created=await f.request(f.a,aUrl,'POST',{mode:'multiplayer'});
  const id=created.body.match.id;
  const paired=await f.request(f.outside,bUrl,'POST',{mode:'multiplayer'});
  assert.equal(paired.body.match.id,id);
  let revision=paired.body.match.revision;
  for(const [user,url,move] of [[f.a,aUrl,'e2e4'],[f.outside,bUrl,'e7e5'],[f.a,aUrl,'g1f3'],[f.outside,bUrl,'b8c6']]){
   const r=await f.request(user,url+'/matches/'+id+'/move','POST',{move,revision});
   assert.equal(r.status,200);revision=r.body.match.revision;
  }
  // The 4-half-move match counts once. A resignation cannot be resubmitted.
  const resignation=await f.request(f.a,aUrl+'/matches/'+id+'/leave','POST',{revision});
  assert.equal(resignation.status,200);
  assert.equal((await f.request(f.a,aUrl+'/matches/'+id+'/leave','POST',{revision})).status,409);
  const practice=await f.request(f.a,aUrl,'POST',{mode:'computer'});
  const practiceMove=await f.request(f.a,aUrl+'/matches/'+practice.body.match.id+'/move','POST',{move:'d2d4',revision:0});
  assert.equal(practiceMove.status,200);
  const publicResult=await f.request(f.outside,bUrl+'/leaderboard');
  assert.equal(publicResult.status,200);
  const items=publicResult.body.players;
  assert.equal(items.length,2);
  const winner=items.find(p=>p.me),loser=items.find(p=>!p.me);
  assert.equal(winner.wins,1);assert.equal(winner.games,1);
  assert.equal(winner.losses,0);assert.equal(winner.practice,0);
  assert.equal(loser.games,1);assert.equal(loser.losses,1);assert.equal(loser.wins,0);
  assert.equal(loser.practice,1);assert.equal(loser.computer,1);
  assert.match(loser.label,/^Player-[A-F0-9]{8}$/);
  assert.ok(!JSON.stringify(publicResult.body).includes('Investigator'));
  assert.ok(!JSON.stringify(publicResult.body).includes(f.a.id));
  const teacherBoard=await f.request(f.admin,'/api/v1/learning/teacher/chess/leaderboard');
  assert.equal(teacherBoard.status,200);
  assert.ok(teacherBoard.body.players.some(p=>p.label==='Investigator A'));
  assert.ok(teacherBoard.body.players.some(p=>p.label==='Second Student'));
  assert.equal((await f.request(f.a,'/api/v1/learning/teacher/chess/leaderboard')).status,403);
  assert.equal((await f.request(f.outside,aUrl+'/leaderboard')).status,404);
 }finally{await f.close();}
});

test('leaderboard excludes cancelled queues and unplayed forfeits',async()=>{
 const f=await fixture();
 try{
  const a=f.learning.createActivity(f.admin,f.classId,{title:'Chess queue only',templateId:'scorm-connector-v1'});
  const url='/api/v1/learning/activities/'+a+'/chess';
  const match=(await f.request(f.a,url,'POST',{mode:'multiplayer'})).body.match;
  const cancelled=await f.request(f.a,url+'/matches/'+match.id+'/leave','POST',{revision:match.revision});
  assert.equal(cancelled.status,200);
  const leaderboard=await f.request(f.a,url+'/leaderboard');
  assert.equal(leaderboard.status,200);
  assert.equal(leaderboard.body.totalPlayers,0);
  assert.deepEqual(leaderboard.body.players,[]);
 }finally{await f.close();}
});
