'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {START,parse,fen,legal,play}=require('../src/learning-chess');
const {route}=require('../src/learning-direct');

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
