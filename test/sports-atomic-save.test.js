"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ClassroomHubStorage}=require('../src/storage'),model=require('../src/sports'),{createSportsService}=require('../src/sports-service');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'roomgoblin-sports-atomic-'));
 const store=new ClassroomHubStorage({dataDir:root,masterKeyFile:path.join(root,'missing')});
 t.after(()=>{store.db.close();assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));fs.rmSync(root,{recursive:true,force:true})});
 const service=createSportsService({store});service.save({...service.read(),school:'First'});service.save({...service.read(),school:'Second'});
 return {store,service};
}
for(const operation of ['save','undo'])for(const failedKey of [model.KEY,model.KEY+'.previous'])test(`${operation} preserves saved and undo identities when ${failedKey} fails`,t=>{
 const {store,service}=fixture(t),before=service.read(),previous=store.getPreference(model.KEY+'.previous');
 store.db.exec(`CREATE TRIGGER fail_sports_write BEFORE UPDATE ON system_preferences WHEN NEW.key='${failedKey}' BEGIN SELECT RAISE(ABORT,'fixture storage failure'); END`);
 assert.throws(()=>operation==='save'?service.save({...before,school:'Third'}):service.undo(before.revision),/fixture storage failure/);
 assert.deepEqual(service.read(),before);
 assert.deepEqual(store.getPreference(model.KEY),before);
 assert.deepEqual(store.getPreference(model.KEY+'.previous'),previous,'Failed operation replaced the recoverable undo snapshot');
 assert.deepEqual(createSportsService({store}).read(),before,'Restart must keep the same saved identity');
 store.db.exec('DROP TRIGGER fail_sports_write');
 assert.equal(service.undo(before.revision).school,'First');
});
test('successful saves and repeated undo swap both durable identities',t=>{
 const {store,service}=fixture(t);assert.equal(service.undo(2).school,'First');
 assert.equal(store.getPreference(model.KEY+'.previous').school,'Second');
 const restarted=createSportsService({store});assert.equal(restarted.undo(3).school,'Second');
 assert.equal(store.getPreference(model.KEY+'.previous').school,'First');
 assert.equal(restarted.read().revision,4);
});
for(const operation of ['save','undo'])test(`${operation} does not publish memory or replace undo when SQLite commit fails`,t=>{
 const {store,service}=fixture(t),before=service.read(),previous=store.getPreference(model.KEY+'.previous');
 store.db.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE fixture_parent(id INTEGER PRIMARY KEY);
  CREATE TABLE fixture_child(id INTEGER REFERENCES fixture_parent(id) DEFERRABLE INITIALLY DEFERRED);
  CREATE TRIGGER fail_sports_commit AFTER UPDATE ON system_preferences WHEN NEW.key='${model.KEY}' BEGIN INSERT INTO fixture_child VALUES(1); END`);
 assert.throws(()=>operation==='save'?service.save({...before,school:'Third'}):service.undo(before.revision),/FOREIGN KEY/);
 assert.deepEqual(service.read(),before,'A rejected commit must not publish memory');
 assert.deepEqual(store.getPreference(model.KEY),before);
 assert.deepEqual(store.getPreference(model.KEY+'.previous'),previous);
 assert.equal(store.db.prepare('SELECT count(*) n FROM fixture_child').get().n,0);
});
