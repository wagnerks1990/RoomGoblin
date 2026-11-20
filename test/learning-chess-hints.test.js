'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {route}=require('../src/learning-direct');
const {legal,uci}=require('../src/learning-chess');
async function setup(){const f=await fixture();f.id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic practice hints',templateId:'scorm-connector-v1'});f.url=m=>'/api/v1/learning/activities/'+f.id+'/chess/matches/'+m.id+'/hint';return f;}
test('practice hints describe only the server position without changing a game or participation',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{mode:'solo'});const before={row:{...c.row(m.id)},progress:c.progress(f.a,f.id),board:c.standings(f.a)};
  let r=await f.request(f.a,f.url(m),'POST',{revision:m.revision});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.body.matchId,m.id);assert.equal(r.body.revision,m.revision);
  assert.ok(r.body.hint.suggestions.length>0&&r.body.hint.suggestions.length<=3);const allowed=legal(c.state(c.row(m.id))).map(uci);for(const h of r.body.hint.suggestions)assert.ok(allowed.includes(h.move));
  assert.deepEqual({...c.row(m.id)},before.row);assert.equal(c.progress(f.a,f.id),before.progress);assert.deepEqual(c.standings(f.a),before.board);
  m=c.move(f.a,f.id,m.id,'e2e4',m.revision);r=await f.request(f.a,f.url(m),'POST',{revision:m.revision});assert.equal(r.status,200);assert.equal(r.body.hint.turn,'black','solo practice may explain either side');
 }finally{await f.close();}
});
test('hint payload rejects caller position, identity, mode and stale or finished positions',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{mode:'solo'});
  assert.throws(()=>c.hint(f.a,f.id,m.id,null),{status:400});
  for(const body of [[],{}, {revision:-1},{revision:'0'},{revision:0,fen:'forged'},{revision:0,mode:'solo'},{revision:0,userId:f.a.id}])assert.equal((await f.request(f.a,f.url(m),'POST',body)).status,400);
  assert.equal((await f.request(f.b,f.url(m),'POST',{revision:0})).status,404);assert.equal((await f.request(null,f.url(m),'POST',{revision:0})).status,401);
  m=c.move(f.a,f.id,m.id,'e2e4',m.revision);assert.equal((await f.request(f.a,f.url(m),'POST',{revision:0})).status,409);
  m=c.leave(f.a,f.id,m.id,m.revision);assert.equal((await f.request(f.a,f.url(m),'POST',{revision:m.revision})).status,409);
 }finally{await f.close();}
});
test('multiplayer cannot obtain hints through student or teacher authority',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{});m=c.join(f.admin,f.id,m.id,{teacher:true});
  assert.equal((await f.request(f.a,f.url(m),'POST',{revision:m.revision})).status,403);
  const teacherUrl='/api/v1/learning/teacher/classes/'+f.classId+'/chess/matches/'+m.id+'/hint';assert.equal((await f.request(f.admin,teacherUrl,'POST',{revision:m.revision})).status,403);
  const own=c.create(f.admin,f.id,{teacher:true,mode:'solo'}),ownUrl=teacherUrl.replace(m.id,own.id);assert.equal((await f.request(f.admin,ownUrl,'POST',{revision:own.revision})).status,200);
 }finally{await f.close();}
});
test('unavailable assignments, disabled seats and writer freeze deny practice hints',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{mode:'solo'}),body={revision:m.revision};
  f.freeze(true);assert.equal((await f.request(f.a,f.url(m),'POST',body)).status,423);f.freeze(false);
  await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.id+'/command','PUT',{paused:true,stage:1,hint:'',version:0});assert.equal((await f.request(f.a,f.url(m),'POST',body)).status,409);
  await f.request(f.admin,'/api/v1/learning/teacher/activities/'+f.id+'/command','PUT',{paused:false,stage:1,hint:'',version:1});
  f.store.putUser({...f.a,enabled:false});assert.throws(()=>c.hint(f.a,f.id,m.id,body),{status:409});f.store.putUser({...f.a,enabled:true});
  f.learning.settings(f.admin,f.id,{open:false});assert.equal((await f.request(f.a,f.url(m),'POST',body)).status,409);
 }finally{await f.close();}
});
test('computer hints require the human turn and cannot run during a pending computer move',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{mode:'computer'}),body={revision:m.revision};assert.equal(c.hint(f.a,f.id,m.id,body).hint.turn,'white');
  c.pendingSearch.set(m.id+':'+m.revision,{});assert.throws(()=>c.hint(f.a,f.id,m.id,body),{status:409});c.pendingSearch.clear();
  f.store.db.prepare('UPDATE learning_chess_matches SET moves_json=?,revision=revision+1 WHERE id=?').run('["e2e4"]',m.id);assert.throws(()=>c.hint(f.a,f.id,m.id,{revision:m.revision+1}),{status:409});
 }finally{await f.close();}
});
test('hint budget is shared across a learner practice games',async()=>{
 const f=await setup();try{const c=f.learning.chess,a=c.create(f.a,f.id,{mode:'solo',requestId:crypto.randomUUID()}),b=c.create(f.a,f.id,{mode:'solo',requestId:crypto.randomUUID()});
  for(let i=0;i<12;i++)assert.equal((await f.request(f.a,f.url(i%2?a:b),'POST',{revision:0})).status,200);
  assert.equal((await f.request(f.a,f.url(a),'POST',{revision:0})).status,429);assert.equal(c.row(a.id).revision,0);assert.equal(c.progress(f.a,f.id),0);
  const other=c.create(f.b,f.id,{mode:'solo'});assert.equal((await f.request(f.b,f.url(other),'POST',{revision:0})).status,200);
 }finally{await f.close();}
});
test('direct hint extension is exact POST-only and retains original private bearer scope',async()=>{
 const f=await setup();try{f.learning.platform.configure(f.admin,f.id,{points:20});const c=f.learning.chess,key=f.learning.direct.issue(f.admin,f.id),token=crypto.randomBytes(32).toString('hex'),user=f.learning.direct.enroll(f.id,key,{participantToken:token,reportedId:'synthetic',name:'Synthetic Learner'}),m=c.create(user,f.id,{mode:'solo'}),url='/api/v1/learning/direct/activities/'+f.id+'/chess/matches/'+m.id+'/hint',h={Authorization:'Bearer '+token};
  assert.ok(route('POST',url));for(const method of ['GET','HEAD','PUT','PATCH','DELETE'])assert.equal(route(method,url),null);for(const suffix of ['/','/extra','%2fextra'])assert.equal(route('POST',url+suffix),null);
  assert.equal((await f.request(null,url,'POST',{revision:0},h)).status,200);assert.equal((await f.request(f.admin,url,'POST',{revision:0})).status,401,'native teacher cookie cannot replace bearer');
  const other=f.learning.createActivity(f.admin,f.classId,{title:'Other practice',templateId:'scorm-connector-v1'});f.learning.platform.configure(f.admin,other,{points:20});const otherKey=f.learning.direct.issue(f.admin,other),otherToken=crypto.randomBytes(32).toString('hex');f.learning.direct.enroll(other,otherKey,{participantToken:otherToken,reportedId:'synthetic',name:'Synthetic Learner'});
  assert.equal((await f.request(null,url,'POST',{revision:0},{Authorization:'Bearer '+otherToken})).status,401);
  f.store.db.prepare('UPDATE learning_direct_participants SET revoked=1 WHERE user_id=?').run(user.id);assert.equal((await f.request(null,url,'POST',{revision:0},h)).status,401);
 }finally{await f.close();}
});
