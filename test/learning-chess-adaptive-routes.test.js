'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {route}=require('../src/learning-direct');
test('new computer games default to live adaptation, persist confirmed decisions and retain legacy games',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Adaptive synthetic',templateId:'scorm-connector-v1'}),c=f.learning.chess,base='/api/v1/learning/activities/'+id+'/chess';
  let captured;c.computer={choose:async(position,difficulty,options)=>{captured={position,difficulty,options};return 'e7e5';}};
  const created=await f.request(f.a,base,'POST',{mode:'computer',requestId:crypto.randomUUID(),adaptive:{band:5,style:'attacking'}});assert.equal(created.status,200);assert.equal(created.body.match.difficulty,'adaptive');
  const moved=await f.request(f.a,base+'/matches/'+created.body.match.id+'/move','POST',{move:'e2e4',revision:0,adaptive:{band:5}});assert.equal(moved.status,200);
  assert.equal(captured.difficulty,'adaptive');assert.deepEqual(captured.options.moves,['e2e4']);assert.equal(captured.options.adaptive.band,1);
  assert.deepEqual(moved.body.match.adaptive,{band:1,style:'balanced',revision:1});assert.deepEqual(moved.body.match.moves,['e2e4','e7e5']);
  assert.equal((await f.request(f.a,base+'/matches/'+created.body.match.id+'/move','POST',{move:'e2e4',revision:0})).status,409);
  assert.equal(f.store.db.prepare('SELECT band_turns FROM learning_chess_adaptive_provenance WHERE match_id=?').get(created.body.match.id).band_turns,1);
  const old=c.create(f.a,id,{mode:'computer',difficulty:'standard',requestId:crypto.randomUUID()});assert.equal(c.row(old.id).difficulty,'standard');
  const teacher=await f.request(f.admin,'/api/v1/learning/teacher/chess');assert.equal(teacher.status,200);assert.equal(Object.hasOwn(teacher.body.matches.find(m=>m.id===created.body.match.id),'adaptive'),false);
 }finally{await f.close();}
});
test('failed adaptive reply or audit never commits a move, decision or strength evidence',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Adaptive atomic',templateId:'scorm-connector-v1'}),c=f.learning.chess,m=c.create(f.a,id,{mode:'computer'});
  c.computer={choose:async()=>{throw Object.assign(Error('Unavailable'),{status:503});}};await assert.rejects(c.move(f.a,id,m.id,'e2e4',0),{status:503});
  assert.equal(c.row(m.id).revision,0);assert.equal(c.pendingSearch.size,0);assert.equal(f.learning.adaptive.lastDecision(f.a,id,m.id),null);
  c.computer={choose:async()=> 'e7e5'};const original=f.learning.event;f.learning.event=()=>{throw Error('Synthetic audit failure');};await assert.rejects(c.move(f.a,id,m.id,'e2e4',0));f.learning.event=original;
  assert.equal(c.row(m.id).revision,0);assert.equal(f.learning.adaptive.lastDecision(f.a,id,m.id),null);assert.equal(c.pendingSearch.size,0);
 }finally{await f.close();}
});
test('adaptive profile gateway remains exact, private and read-only',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Private adaptive',templateId:'scorm-connector-v1'}),path='/api/v1/learning/direct/activities/'+id+'/chess/adaptive';
  assert.deepEqual(route('GET',path),{id,part:'chess'});for(const method of ['POST','PUT','DELETE'])assert.equal(route(method,path),null);assert.equal(route('GET',path+'/'),null);
  const own=await f.request(f.a,path.replace('/direct/','/'));assert.equal(own.status,200);assert.equal(own.body.profile.rating,null);assert.equal(own.body.profile.eligibleGames,0);
  assert.equal(JSON.stringify(own.body).includes(f.b.id),false);assert.equal((await f.request(f.outside,path.replace('/direct/','/'))).status,404);
 }finally{await f.close();}
});
test('lost original class authority omits a private decision without breaking teacher monitoring',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Old teacher practice',templateId:'scorm-connector-v1'}),c=f.learning.chess,m=c.create(f.admin,id,{mode:'computer',teacher:true});
  f.store.db.prepare('DELETE FROM learning_members WHERE class_id=? AND user_id=?').run(f.classId,f.admin.id);
  assert.throws(()=>f.learning.adaptive.lastDecision(f.admin,id,m.id,{teacher:true}),{status:404});
  const list=c.teacherList(f.admin);assert.ok(list.find(x=>x.id===m.id));assert.equal(Object.hasOwn(list.find(x=>x.id===m.id),'adaptive'),false);
 }finally{await f.close();}
});
