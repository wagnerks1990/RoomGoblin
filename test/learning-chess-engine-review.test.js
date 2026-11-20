'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {route}=require('../src/learning-direct');
async function setup(){const f=await fixture();f.id=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic engine review',templateId:'scorm-connector-v1'});return f;}
function clone(f,source,changes){const row={...source,...changes},keys=Object.keys(row);f.store.db.prepare('INSERT INTO learning_chess_matches('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));return row;}
test('automatic cleanup expires only day-old unjoined queues and preserves history, heartbeat and active games',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{requestId:randomUUID()}),now=Date.now(),old=new Date(now-86400001).toISOString();
  f.store.db.prepare('UPDATE learning_chess_matches SET updated_at=? WHERE id=?').run(old,m.id);
  const source=c.row(m.id),active=clone(f,source,{id:randomUUID(),status:'active',black_id:f.b.id}),fresh=clone(f,source,{id:randomUUID(),white_id:f.b.id}),moved=clone(f,source,{id:randomUUID(),moves_json:'["e2e4"]'});
  c.heartbeat(f.b,f.id);const before=c.standings(f.a);
  assert.equal(c.expireWaiting(now),1);const expired=c.row(m.id);assert.equal(expired.status,'finished');assert.equal(expired.reason,'queue expired');assert.equal(expired.result,null);assert.equal(expired.revision,m.revision+1);
  assert.equal(c.row(active.id).status,'active');assert.equal(c.row(fresh.id).status,'waiting');assert.equal(c.row(moved.id).status,'waiting');assert.deepEqual(c.standings(f.a),before);
  assert.equal(c.expireWaiting(now),0);const event=f.store.db.prepare("SELECT * FROM learning_events WHERE kind='chess.queue.expire'").get();assert.equal(event.actor_id,null);assert.equal(event.record_id,m.id);
 }finally{await f.close();}
});
test('automatic queue cleanup rolls back failed audits and respects freeze and sweep interval',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{}),now=Date.now(),event=f.learning.event;
  f.store.db.prepare("UPDATE learning_chess_matches SET updated_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(m.id);
  c.tick(()=>false,now);assert.equal(c.row(m.id).status,'waiting');assert.equal(c.lastQueueSweep,undefined);
  f.learning.event=function(...args){if(args[2]==='chess.queue.expire')throw Error('Synthetic expiry audit failure');return event.apply(this,args);};
  c.tick(()=>true,now);assert.equal(c.clockError,true);assert.equal(c.lastQueueSweep,undefined);assert.equal(c.row(m.id).revision,m.revision);
  f.learning.event=event;c.tick(()=>true,now);assert.equal(c.clockError,false);assert.equal(c.row(m.id).status,'finished');
  const next=clone(f,c.row(m.id),{id:randomUUID(),status:'waiting',result:null,updated_at:'2000-01-01T00:00:00.000Z'});
  c.tick(()=>true,now+59999);assert.equal(c.row(next.id).status,'waiting');c.tick(()=>true,now+60000);assert.equal(c.row(next.id).status,'finished');
 }finally{await f.close();}
});
test('assignment history is scoped before applying its bounded result limit',async()=>{
 const f=await setup();try{const c=f.learning.chess,other=f.learning.createActivity(f.admin,f.classId,{title:'Other assignment',templateId:'scorm-connector-v1'});let m=c.create(f.a,f.id,{mode:'solo'});m=c.leave(f.a,f.id,m.id,m.revision);const original=c.row(m.id);
  f.store.db.prepare("UPDATE learning_chess_matches SET updated_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(m.id);
  for(let i=0;i<105;i++)clone(f,original,{id:randomUUID(),activity_id:other});
  assert.ok(c.list(f.a,f.id).some(x=>x.id===m.id),'newer games from other assignments must not hide this assignment history');
 }finally{await f.close();}
});
test('teacher monitoring keeps older active games ahead of recent completed games',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{mode:'solo'}),original=c.row(m.id);
  f.store.db.prepare("UPDATE learning_chess_matches SET updated_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(m.id);
  for(let i=0;i<205;i++)clone(f,original,{id:randomUUID(),status:'finished',result:'draw',reason:'practice ended'});
  assert.ok(c.teacherList(f.admin).some(x=>x.id===m.id),'an active game remains visible to monitoring');
 }finally{await f.close();}
});
test('a recently reconnected queue is discoverable behind newer stale queues',async()=>{
 const f=await setup();try{const c=f.learning.chess,other=f.learning.createActivity(f.admin,f.classId,{title:'Other queue',templateId:'scorm-connector-v1'}),m=c.create(f.a,f.id,{}),original=c.row(m.id);
  f.store.db.prepare("UPDATE learning_chess_matches SET updated_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(m.id);
  for(let i=0;i<105;i++)clone(f,original,{id:randomUUID(),activity_id:other,updated_at:new Date(Date.now()-60000).toISOString()});
  c.heartbeat(f.a,f.id);assert.ok(c.list(f.b,f.id).some(x=>x.id===m.id),'fresh heartbeat is authoritative even when the queue record is old');
 }finally{await f.close();}
});
test('draw actions cannot finish or mutate a match whose other assignment is unavailable',async()=>{
 const f=await setup();try{const c=f.learning.chess,otherClass=f.learning.createClass(f.admin,'Other synthetic class');f.learning.enroll(f.admin,otherClass,{userId:f.outside.id,alias:'Synthetic Outside'});const other=f.learning.createActivity(f.admin,otherClass,{title:'Other seat',templateId:'scorm-connector-v1'});let m=c.create(f.a,f.id,{});m=c.join(f.outside,other,m.id);m=c.move(f.a,f.id,m.id,'e2e4',m.revision);m=c.move(f.outside,other,m.id,'e7e5',m.revision);
  f.learning.settings(f.admin,other,{open:false});assert.throws(()=>c.draw(f.a,f.id,m.id,{action:'offer',revision:m.revision}),{status:409});assert.equal(c.row(m.id).draw_offer,null);
  f.learning.settings(f.admin,other,{open:true});m=c.draw(f.outside,other,m.id,{action:'offer',revision:m.revision});f.learning.settings(f.admin,other,{open:false});assert.throws(()=>c.draw(f.a,f.id,m.id,{action:'accept',revision:m.revision}),{status:409});assert.equal(c.row(m.id).status,'active');
 }finally{await f.close();}
});
test('rule projection cache follows exact moves while clock and draw revisions reuse safe state',async()=>{
 const f=await setup();try{const c=f.learning.chess;let m=c.create(f.a,f.id,{mode:'solo'}),row=c.row(m.id),before=c.position(row);
  f.store.db.prepare('UPDATE learning_chess_matches SET revision=revision+1,draw_offer=? WHERE id=?').run(f.a.id,m.id);row=c.row(m.id);assert.equal(c.position(row),before);
  f.learning.enroll(f.admin,f.classId,{userId:f.a.id,alias:'Updated Synthetic Name'});assert.equal(c.render(row,f.admin).white.name,'Updated Synthetic Name','names and class authorization are always projected fresh');
  f.store.db.prepare('UPDATE learning_chess_matches SET moves_json=? WHERE id=?').run('["e2e4"]',m.id);const after=c.position(c.row(m.id));assert.notEqual(after,before);assert.equal(after.state.t,-1);
  assert.deepEqual(Object.keys(after).sort(),['claims','moves','plies','state']);
 }finally{await f.close();}
});
test('rule projection cache bounds both entry count and total retained move text',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{mode:'solo'}),source=c.row(m.id);
  for(let i=0;i<405;i++)c.position({...source,id:randomUUID()});assert.ok(c.positions.size<=400);
  // Synthetic legal knight cycles exercise cache memory independent of outcomes.
  const moves=JSON.stringify(Array.from({length:250},()=>['g1f3','g8f6','f3g1','f6g8']).flat());
  for(let i=0;i<101;i++)c.position({...source,id:randomUUID(),moves_json:moves});
  assert.ok(c.positions.size<=400);assert.ok(c.positionPlies<=100000);assert.equal([...c.positions.values()].reduce((n,p)=>n+p.plies,0),c.positionPlies);
  assert.throws(()=>c.position({...source,id:randomUUID(),moves_json:JSON.stringify(Array(20001).fill('g1f3'))}),{status:409});
 }finally{await f.close();}
});
test('one full bounded monitoring response fits the rule cache without entry thrashing',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{mode:'solo'}),source=c.row(m.id),moves=JSON.stringify(Array.from({length:50},()=>['g1f3','g8f6','f3g1','f6g8']).flat()),rows=Array.from({length:350},()=>({...source,id:randomUUID(),moves_json:moves})),projections=rows.map(row=>c.position(row));
  for(let i=0;i<rows.length;i++)assert.equal(c.position(rows[i]),projections[i]);assert.ok(c.positionPlies<=100000);
 }finally{await f.close();}
});
test('a delayed computer result cannot overwrite an explicitly stopped game',async()=>{
 const f=await setup();try{const c=f.learning.chess;let complete;c.computer={choose:()=>new Promise(resolve=>{complete=resolve;})};let m=c.create(f.a,f.id,{mode:'computer'});const pending=c.move(f.a,f.id,m.id,'e2e4',m.revision);m=c.leave(f.a,f.id,m.id,m.revision);complete('e7e5');await assert.rejects(pending,{status:404});
  assert.equal(c.row(m.id).status,'finished');assert.equal(c.row(m.id).reason,'practice ended');assert.equal(c.row(m.id).moves_json,'[]');assert.equal(c.pendingSearch.size,0);
 }finally{await f.close();}
});
test('computer commit rechecks seat availability after asynchronous search',async()=>{
 const f=await setup();try{const c=f.learning.chess;let complete;c.computer={choose:()=>new Promise(resolve=>{complete=resolve;})};const m=c.create(f.a,f.id,{mode:'computer'}),pending=c.move(f.a,f.id,m.id,'e2e4',m.revision);f.store.putUser({...f.a,enabled:false});complete('e7e5');await assert.rejects(pending,{status:409});
  assert.equal(c.row(m.id).moves_json,'[]');assert.equal(c.row(m.id).revision,0);assert.equal(c.progress(f.a,f.id),0);assert.equal(c.pendingSearch.size,0);
 }finally{await f.close();}
});
test('an illegal computer reply never commits the player half of an atomic turn',async()=>{
 const f=await setup();try{const c=f.learning.chess;c.computer={choose:async()=> 'e7e4'};const m=c.create(f.a,f.id,{mode:'computer'});await assert.rejects(c.move(f.a,f.id,m.id,'e2e4',m.revision),{status:409});
  assert.equal(c.row(m.id).moves_json,'[]');assert.equal(c.row(m.id).revision,0);assert.equal(c.progress(f.a,f.id),0);assert.equal(c.pendingSearch.size,0);
 }finally{await f.close();}
});
test('teacher waiting-only cleanup is revisioned, audited and preserves noncompetitive history',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{}),url='/api/v1/learning/teacher/classes/'+f.classId+'/chess/matches/'+m.id+'/cancel-queue';
  assert.equal(c.render(c.row(m.id),f.admin).canCancelQueue,true);assert.equal(c.render(c.row(m.id),f.admin).cleanupClassId,f.classId);
  assert.equal((await f.request(f.a,url,'POST',{revision:m.revision})).status,403);
  assert.equal(route('POST','/api/v1/learning/direct/activities/'+f.id+'/chess/matches/'+m.id+'/cancel-queue'),null);
  f.freeze(true);assert.equal((await f.request(f.admin,url,'POST',{revision:m.revision})).status,423);f.freeze(false);
  assert.equal((await f.request(f.admin,url,'POST',{revision:m.revision,status:'finished'})).status,400);
  f.learning.settings(f.admin,f.id,{open:false});const r=await f.request(f.admin,url,'POST',{revision:m.revision});assert.equal(r.status,200);assert.equal(r.body.match.reason,'queue cancelled');assert.equal(r.body.match.status,'finished');assert.equal(r.body.match.revision,m.revision+1);
  assert.equal(c.row(m.id).moves_json,'[]');assert.equal(c.standings(f.a).players.length,0);assert.equal(c.progress(f.a,f.id),0);
  assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM learning_events WHERE kind='chess.queue.cancel' AND record_id=?").get(m.id).n,1);
  assert.equal((await f.request(f.admin,url,'POST',{revision:m.revision})).status,409);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM learning_events WHERE kind='chess.queue.cancel' AND record_id=?").get(m.id).n,1);
 }finally{await f.close();}
});
test('queue cleanup cannot cross teacher classes or race past a newly joined game',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{}),otherTeacher=f.store.putUser({username:'review-teacher',displayName:'Synthetic Teacher',role:'operator',profileId:'teacher'},{password:'synthetic-test-password'}),otherClass=f.learning.createClass(otherTeacher,'Separate review class');f.learning.enroll(otherTeacher,otherClass,{userId:f.outside.id,alias:'Synthetic Other'});const other=f.learning.createActivity(otherTeacher,otherClass,{title:'Other review queue',templateId:'scorm-connector-v1'}),foreign=clone(f,c.row(m.id),{id:randomUUID(),activity_id:other,white_id:f.outside.id});
  assert.equal(c.render(foreign,f.admin).canCancelQueue,false);assert.equal(c.render(foreign,f.admin).cleanupClassId,null);
  assert.throws(()=>c.cancelQueue(f.admin,f.classId,foreign.id,{revision:0}),{status:404});assert.throws(()=>c.cancelQueue(f.a,f.classId,m.id,{revision:0}),{status:403});
  const joined=c.join(f.b,f.id,m.id);assert.throws(()=>c.cancelQueue(f.admin,f.classId,m.id,{revision:0}),{status:409});assert.throws(()=>c.cancelQueue(f.admin,f.classId,m.id,{revision:joined.revision}),{status:409});assert.equal(c.row(m.id).status,'active');
  const cancelled=c.cancelQueue(otherTeacher,otherClass,foreign.id,{revision:foreign.revision});assert.equal(cancelled.status,'finished');assert.throws(()=>c.join(f.a,f.id,foreign.id),{status:409});
 }finally{await f.close();}
});
test('teacher totals distinguish all retained games from bounded recent result cards',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.admin,f.id,{teacher:true,mode:'solo'}),source=c.row(m.id);
  for(let i=0;i<105;i++)clone(f,source,{id:randomUUID(),white_id:f.a.id,black_id:f.a.id,status:'finished',result:'draw',reason:'practice ended'});
  const r=await f.request(f.admin,'/api/v1/learning/teacher/chess');assert.equal(r.status,200);assert.deepEqual(r.body.totals,{waiting:0,active:1,finished:105,mineWaiting:0,mineActive:1,mineFinished:0});assert.deepEqual(r.body.history,{limit:100,returned:100,total:105});assert.equal(r.body.matches.length,101);
 }finally{await f.close();}
});
test('offline age never ends an untimed active game or permits waiting-only cleanup',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{mode:'solo'});f.store.db.prepare("UPDATE learning_chess_matches SET created_at='2000-01-01T00:00:00.000Z',updated_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(m.id);c.expireClocks(Date.now()+86400000*30);
  assert.equal(c.row(m.id).status,'active');assert.throws(()=>c.cancelQueue(f.admin,f.classId,m.id,{revision:m.revision}),{status:409});assert.ok(c.list(f.a,f.id).some(x=>x.id===m.id));
 }finally{await f.close();}
});
test('queue cancellation rolls back when its audit cannot be saved',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{}),event=f.learning.event;f.learning.event=function(...args){if(args[2]==='chess.queue.cancel')throw Error('Synthetic audit persistence failure');return event.apply(this,args);};
  assert.throws(()=>c.cancelQueue(f.admin,f.classId,m.id,{revision:m.revision}),/Synthetic audit persistence failure/);f.learning.event=event;
  assert.equal(c.row(m.id).status,'waiting');assert.equal(c.row(m.id).revision,m.revision);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM learning_events WHERE kind='chess.queue.cancel' AND record_id=?").get(m.id).n,0);
 }finally{await f.close();}
});
test('monitoring does not advertise joining a stale or unavailable waiting seat',async()=>{
 const f=await setup();try{const c=f.learning.chess,m=c.create(f.a,f.id,{});f.store.db.prepare("UPDATE learning_chess_matches SET updated_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(m.id);
  assert.equal(c.render(c.row(m.id),f.admin).canJoin,false);c.heartbeat(f.a,f.id);assert.equal(c.render(c.row(m.id),f.admin).canJoin,true);
  f.learning.settings(f.admin,f.id,{open:false});const row=c.render(c.row(m.id),f.admin);assert.equal(row.canJoin,false);assert.equal(row.canCancelQueue,true);
 }finally{await f.close();}
});
test('direct owner lookup stays fresh across account disable and class revocation',async()=>{
 const f=await setup();try{const owner=f.store.putUser({username:'review-direct-owner',displayName:'Synthetic Owner',role:'operator',profileId:'teacher'},{password:'synthetic-test-password'}),classId=f.learning.createClass(owner,'Owned review class'),id=f.learning.createActivity(owner,classId,{title:'Owned review activity',templateId:'scorm-connector-v1'}),d=f.learning.direct;d.issue(owner,id);assert.equal(d.available(id),true);
  f.store.putUser({...owner,enabled:false});assert.equal(d.available(id),false);f.store.putUser({...owner,enabled:true});assert.equal(d.available(id),true);
  f.store.db.prepare('DELETE FROM learning_members WHERE class_id=? AND user_id=?').run(classId,owner.id);assert.equal(d.available(id),false);
  f.store.setPreference(d.key(id),{enabled:true,ownerId:{invalid:true}});assert.equal(d.available(id),false);
 }finally{await f.close();}
});
