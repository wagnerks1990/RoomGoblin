'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {route}=require('../src/learning-direct');
const {allowedPath}=require('../src/learning-public');
test('finished review gateway exposes only exact private methods, never teacher reports',()=>{
 const id=crypto.randomUUID(),match=crypto.randomUUID(),base='/api/v1/learning/direct/activities/'+id+'/chess/';
 for(const [path,method]of [['review/history','GET'],['review/matches/'+match+'/replay','GET'],['review/matches/'+match+'/pgn','GET'],['review/matches/'+match+'/analyze','POST'],['review/matches/'+match+'/retry','POST'],['review/matches/'+match+'/retry/attempt','POST'],['training/review','GET'],['training/sequences','GET'],['events','GET'],['events/'+match+'/join','POST'],['events/'+match+'/withdraw','POST'],['studies','GET'],['studies/'+match,'GET'],['studies/'+match+'/branch','POST'],['studies/matches/'+match+'/feedback','GET']]){
  assert.deepEqual(route(method,base+path),{id,part:'chess'});assert.equal(allowedPath(method,base+path),true);
  for(const wrong of ['GET','POST','PUT','DELETE'].filter(v=>v!==method))assert.equal(route(wrong,base+path),null);
  for(const suffix of ['/','/extra'])assert.equal(route(method,base+path+suffix),null);
 }
 assert.equal(route('GET',base+'training/report'),null);assert.equal(route('POST',base+'training/sequences'),null);assert.equal(allowedPath('GET','/api/v1/learning/teacher/classes/'+id+'/chess/training/report'),false);
 for(const suffix of ['events','events/'+match+'/next','events/'+match+'/end','studies','studies/matches/'+match+'/feedback'])assert.equal(route('POST',base+suffix),null);
 for(const method of ['GET','POST'])assert.deepEqual(route(method,base+'review/matches/'+match+'/insights'),{id,part:'chess'});
 for(const method of ['PUT','DELETE'])assert.equal(route(method,base+'review/matches/'+match+'/insights'),null);
 for(const suffix of ['invite','preview-invite','accept-invite','rematch',match+'/accept',match+'/decline',match+'/cancel']){assert.deepEqual(route('POST',base+'challenges/'+suffix),{id,part:'chess'});assert.equal(route('GET',base+'challenges/'+suffix),null);}
 assert.deepEqual(route('GET',base+'challenges'),{id,part:'chess'});assert.equal(route('POST',base+'challenges'),null);
 assert.deepEqual(route('GET',base+'puzzle-runs'),{id,part:'chess'});assert.equal(route('POST',base+'puzzle-runs/daily'),null);
 for(const [suffix,method]of [['placement','GET'],['placement/start','POST'],['placement/'+match+'/attempt','POST'],['placement/'+match+'/hint','POST'],['placement/'+match+'/skip','POST'],['studies/'+match+'/demo-move','POST']]){
  assert.deepEqual(route(method,base+suffix),{id,part:'chess'});assert.equal(allowedPath(method,base+suffix),true);
  for(const other of ['GET','POST','PUT','DELETE'].filter(x=>x!==method))assert.equal(allowedPath(other,base+suffix),false);
  assert.equal(allowedPath(method,base+suffix+'/extra'),false);
 }
 for(const suffix of ['studies/import','studies/'+match+'/participants','studies/'+match+'/grant'])for(const method of ['GET','POST','PUT','DELETE'])assert.equal(allowedPath(method,base+suffix),false);
 for(const suffix of ['start',match+'/attempt',match+'/hint',match+'/stop']){assert.deepEqual(route('POST',base+'puzzle-runs/'+suffix),{id,part:'chess'});assert.equal(route('GET',base+'puzzle-runs/'+suffix),null);}
});
test('review HTTP pages and retry keep games immutable and scoped',async()=>{
 const f=await fixture();try{
  const id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic review',templateId:'scorm-connector-v1'}),c=f.learning.chess;
  let m=c.create(f.a,id,{mode:'solo'});m=await c.move(f.a,id,m.id,'e2e4',m.revision);m=await c.move(f.a,id,m.id,'e7e5',m.revision);
  const prefix='/api/v1/learning/activities/'+id+'/chess/review/',path=prefix+'matches/'+m.id+'/';
  assert.equal((await f.request(f.a,path+'replay')).status,404,'unfinished games never enter review');m=c.leave(f.a,id,m.id,m.revision);
  const before={...c.row(m.id)},progress=c.progress(f.a,id);
  const history=await f.request(f.a,prefix+'history?limit=1&mode=solo');assert.equal(history.status,200);assert.equal(history.body.matches[0].id,m.id);
  const replay=await f.request(f.a,path+'replay?offset=0&limit=2');assert.equal(replay.status,200);assert.equal(replay.body.positions.length,2);assert.equal(replay.body.nextOffset,2);
  const end=await f.request(f.a,path+'replay?offset=2&limit=2');assert.equal(end.body.positions[0].san,'e5');
  const pgn=await f.request(f.a,path+'pgn');assert.equal(pgn.status,200);assert.match(pgn.body.pgn,/1\. e4 e5/);
  assert.equal((await f.request(f.b,path+'replay')).status,404);
  const retry=await f.request(f.a,path+'retry','POST',{ply:0});assert.equal(retry.status,200);assert.ok(retry.body.legalMoves.includes('d2d4'));
  const attempt=await f.request(f.a,path+'retry/attempt','POST',{ply:0,move:'d2d4'});assert.equal(attempt.status,200);assert.equal(attempt.body.sameAsPlayed,false);
  assert.equal((await f.request(f.a,path+'retry/attempt','POST',{ply:0,move:'e2e5'})).status,409);
  for(const extra of [{signal:{}},{teacher:true},{fen:'forged'},{moves:[]}])assert.equal((await f.request(f.a,path+'analyze','POST',{ply:0,...extra})).status,400);
  assert.deepEqual({...c.row(m.id)},before);assert.equal(c.progress(f.a,id),progress);
  f.freeze(true);assert.equal((await f.request(f.a,path+'analyze','POST',{ply:0})).status,423);
 }finally{await f.close();}
});
