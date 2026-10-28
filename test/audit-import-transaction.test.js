"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {ClassroomHubStorage}=require('../src/storage');
function fixture(t,lines=null){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-audit-import-')),file=path.join(dir,'audit.jsonl');
 const original=(lines||[JSON.stringify({kind:'fixture.before'}),'{invalid',JSON.stringify({kind:'fixture.fail'}),'null',JSON.stringify({kind:'fixture.after'})]).join('\n')+'\n';
 fs.writeFileSync(file,original);
 const open=()=>new ClassroomHubStorage({dataDir:dir,masterKeyFile:path.join(dir,'missing')});let store=open();
 t.after(()=>{store.db.close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('rg-audit-import-'));fs.rmSync(dir,{recursive:true,force:true})});
 return {dir,file,original,get store(){return store},reopen(){store.db.close();store=open()},
  count(){return store.db.prepare('SELECT count(*) n FROM audit_events').get().n},
  unchanged(){assert.equal(this.count(),0);assert.equal(store.migrationDone(file,'sqlite:audit_events'),false);assert.equal(fs.readFileSync(file,'utf8'),original);assert.equal(fs.existsSync(path.join(dir,'legacy')),false)}
 };
}
test('audit import retains valid records, ignores malformed lines and archives only after a recorded commit',t=>{
 const h=fixture(t);assert.deepEqual(h.store.importAuditJsonl(h.file),{imported:3,skipped:false});assert.equal(h.count(),3);
 assert.equal(h.store.db.prepare('SELECT records FROM migration_history WHERE source=? AND target=?').get(h.file,'sqlite:audit_events').records,3);
 assert.equal(fs.existsSync(h.file),false);const archived=fs.readdirSync(path.join(h.dir,'legacy'));assert.equal(archived.length,1);assert.equal(fs.readFileSync(path.join(h.dir,'legacy',archived[0]),'utf8'),h.original);
 h.reopen();assert.deepEqual(h.store.importAuditJsonl(h.file),{imported:0,skipped:true});assert.equal(h.count(),3);
});
for(const failure of ['audit-row','migration-record'])test(`audit import rolls back ${failure} failure and retries after restart without loss or duplicates`,t=>{
 const h=fixture(t);
 h.store.db.exec(failure==='audit-row'?"CREATE TRIGGER fixture_failure BEFORE INSERT ON audit_events WHEN NEW.kind='fixture.fail' BEGIN SELECT RAISE(ABORT,'fixture audit write failure'); END":"CREATE TRIGGER fixture_failure BEFORE INSERT ON migration_history WHEN NEW.target='sqlite:audit_events' BEGIN SELECT RAISE(ABORT,'fixture migration write failure'); END");
 assert.throws(()=>h.store.importAuditJsonl(h.file),/fixture .* write failure/);h.unchanged();h.reopen();h.unchanged();
 h.store.db.exec('DROP TRIGGER fixture_failure');assert.deepEqual(h.store.importAuditJsonl(h.file),{imported:3,skipped:false});assert.equal(h.count(),3);
});
test('audit import rejects a deferred commit failure without a marker or archive',t=>{
 const h=fixture(t);h.store.db.exec("CREATE TABLE fixture_parent(id INTEGER PRIMARY KEY);CREATE TABLE fixture_child(id INTEGER REFERENCES fixture_parent(id) DEFERRABLE INITIALLY DEFERRED);CREATE TRIGGER fixture_failure AFTER INSERT ON audit_events WHEN NEW.kind='fixture.fail' BEGIN INSERT INTO fixture_child VALUES(1); END");
 assert.throws(()=>h.store.importAuditJsonl(h.file),/FOREIGN KEY/);h.unchanged();assert.equal(h.store.db.prepare('SELECT count(*) n FROM fixture_child').get().n,0);
});
test('audit import with archive disabled retains the source but remains idempotent',t=>{
 const h=fixture(t);assert.deepEqual(h.store.importAuditJsonl(h.file,{archive:false}),{imported:3,skipped:false});assert.equal(fs.readFileSync(h.file,'utf8'),h.original);
 h.reopen();assert.deepEqual(h.store.importAuditJsonl(h.file,{archive:false}),{imported:0,skipped:true});assert.equal(h.count(),3);
});
test('an all-malformed audit source records zero imported rows and is not archived',t=>{
 const h=fixture(t,['{invalid','null','  ']);assert.deepEqual(h.store.importAuditJsonl(h.file),{imported:0,skipped:false});assert.equal(h.count(),0);
 assert.equal(fs.readFileSync(h.file,'utf8'),h.original);assert.equal(fs.existsSync(path.join(h.dir,'legacy')),false);
 assert.equal(h.store.migrationDone(h.file,'sqlite:audit_events'),true);
});
