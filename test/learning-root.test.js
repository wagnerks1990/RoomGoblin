'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/learning-fixture');
const {allowedPath}=require('../src/learning-public');
const {inventory,reset}=require('../tools/reset-learning.cjs');
test('the root learning workspace serves directly and removed app paths do not redirect',async t=>{
 const f=await fixture();t.after(f.close);
 for(const path of ['/learn','/learn/','/learn/index.html']){
  const r=await f.request(null,path);assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);assert.match(r.body.toString(),/Teacher portal/);assert.match(r.body.toString(),/src="\/learn\/app.js"/);
 }
 for(const path of ['/learn/teacher','/learn/teacher/','/learn/teacher/app.js','/learn/platform','/learn/platform/','/learn/platform/app.js','/learn/connect/','/learn/presence/','/learn/scorm/bridge.js']){
  const r=await f.request(null,path);assert.equal(r.status,404,path);assert.equal(r.headers.get('location'),null);
 }
 for(const path of ['/learn','/learn/','/learn/index.html','/learn/app.js','/learn/style.css','/learn/setup.mjs'])assert.equal(allowedPath('GET',path),false,path);
 assert.equal(allowedPath('GET','/learn/sdk/roomgoblin-scorm.js'),true);
 for(let i=0;i<117;i++)assert.equal((await f.request(null,'/learn')).status,200);
 assert.equal((await f.request(null,'/learn')).status,429);
 assert.equal((await f.request(null,'/learn/sdk/roomgoblin-scorm.js')).status,200);
});
test('offline fresh-start reset clears learning records and credentials while retaining unrelated state and working connections',async t=>{
 const f=await fixture({reviewOptions:{intervalMs:0}});t.after(f.close);const db=f.store.db;
 f.learning.post(f.a,f.activityId,{kind:'initial',body:'Synthetic old learning evidence.'});
 f.learning.direct.issue(f.admin,f.activityId);
 f.store.setPreference('learning.schedule',{enabled:true,ownerId:f.admin.id});
 f.store.setPreference('learning.bridgeOrigins',['https://old.example.test']);
 f.store.setPreference('learning.platform',{publicOrigin:'https://learn.example.test',publicEnabled:true,embeddedEnabled:true,insightsEnabled:true});
 f.store.setPreference('room.unrelated',{keep:true});f.store.putSecret('unrelated.secret','synthetic-only');
 const ai=f.store.getPreference('learning.ai'),admin=f.store.listUsers().find(u=>u.id===f.admin.id);
 assert.throws(()=>reset(db),/confirmation/);assert(inventory(db).tables.learning_classes);
 const result=reset(db,{confirm:'RESET_LEARNING_DATA'});
 assert(Object.values(result.after.tables).every(n=>n===0));assert.equal(result.after.learnerAccounts,0);
 assert.deepEqual(f.store.getPreference('learning.ai'),ai);assert.equal(f.store.getPreference('learning.platform').publicEnabled,true);assert.equal(f.store.getPreference('learning.platform').embeddedEnabled,false);
 assert.deepEqual(f.store.getPreference('room.unrelated'),{keep:true});assert.equal(f.store.getSecret('unrelated.secret'),'synthetic-only');assert(f.store.getSecret('learning.openai.key'));
 assert.equal(f.store.getPreference('learning.schedule'),null);assert.equal(f.store.getPreference('learning.bridgeOrigins'),null);assert.equal(f.store.hasSecret(f.learning.direct.key(f.activityId)),false);
 assert.deepEqual(f.store.listUsers().find(u=>u.id===f.admin.id),admin);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
 const fresh=f.learning.createClass(f.admin,'New class');assert(fresh);assert.equal(f.learning.portal.catalog(f.admin).length,1);
});
test('fresh-start reset rolls back instead of removing unrelated references or partially deleting records',async t=>{
 const f=await fixture({reviewOptions:{intervalMs:0}});t.after(f.close);const db=f.store.db;
 db.exec('CREATE TABLE unrelated_owner(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE)');
 db.prepare('INSERT INTO unrelated_owner VALUES(?,?)').run('keep',f.a.id);
 const before=inventory(db);assert.throws(()=>reset(db,{confirm:'RESET_LEARNING_DATA'}),/unrelated/);assert.deepEqual(inventory(db),before);assert.equal(db.prepare('SELECT COUNT(*) n FROM unrelated_owner').get().n,1);
 db.exec('DROP TABLE unrelated_owner; CREATE TABLE unrelated_owner(id TEXT PRIMARY KEY, username TEXT REFERENCES USERS(username) ON DELETE CASCADE)');db.prepare('INSERT INTO unrelated_owner VALUES(?,?)').run('keep',f.a.username);assert.throws(()=>reset(db,{confirm:'RESET_LEARNING_DATA'}),/unrelated/);assert.deepEqual(inventory(db),before);
 db.exec('DROP TABLE unrelated_owner; CREATE TRIGGER reset_failure BEFORE DELETE ON learning_activities BEGIN SELECT RAISE(ABORT, "synthetic failure"); END');
 assert.throws(()=>reset(db,{confirm:'RESET_LEARNING_DATA'}),/synthetic failure/);assert.deepEqual(inventory(db),before);
});
