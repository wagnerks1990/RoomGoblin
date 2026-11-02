"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {ClassroomHubStorage}=require('../src/storage');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-legacy-import-')),key=path.join(dir,'master-key');fs.writeFileSync(key,crypto.randomBytes(32));
 const store=new ClassroomHubStorage({dataDir:dir,masterKeyFile:key});
 t.mock.method(console,'warn',()=>{});
 t.after(()=>{store.db.close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('rg-legacy-import-'));fs.rmSync(dir,{recursive:true,force:true})});
 return {dir,store};
}
const value={'scene-a':{name:'Fixture scene',title:'Original import'}};
for(const normalized of [true,false])test(`legacy JSON ${normalized?'normalized':'object'} import rolls back a failed migration marker`,t=>{
 const {dir,store}=fixture(t),namespace=normalized?'scenes':'fixture-settings',file=path.join(dir,namespace+'.json'),original=JSON.stringify(value),fallback={};fs.writeFileSync(file,original);
 store.db.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON migration_history BEGIN SELECT RAISE(ABORT,'fixture marker failure'); END");
 assert.deepEqual(store.readJson(file,fallback),fallback);
 assert.equal(normalized?store.hasNormalized(namespace):store.hasObject(namespace),false);
 assert.equal(fs.readFileSync(file,'utf8'),original);
 store.db.exec('DROP TRIGGER fixture_failure');assert.deepEqual(store.readJson(file,fallback),value);
 assert.equal(store.migrationDone(file,`sqlite:${normalized?'normalized':'object_store'}/${namespace}`),true);
 assert.deepEqual(store.readJson(file,fallback),value);
});
for(const failure of ['marker','source-removal'])test(`normalized object migration rolls back ${failure} failure without publishing partial state`,t=>{
 const {store}=fixture(t);store.putObject('scenes',value,'fixture-source');
 store.db.exec(failure==='marker'?"CREATE TRIGGER fixture_failure BEFORE INSERT ON migration_history BEGIN SELECT RAISE(ABORT,'fixture marker failure'); END":"CREATE TRIGGER fixture_failure BEFORE DELETE ON object_store WHEN OLD.namespace='scenes' BEGIN SELECT RAISE(ABORT,'fixture removal failure'); END");
 store.migrateNormalizedObjects();assert.equal(store.hasNormalized('scenes'),false);assert.deepEqual(store.getObject('scenes'),value);
 assert.equal(store.migrationDone('sqlite:object_store/scenes','sqlite:normalized/scenes'),false);
 store.db.exec('DROP TRIGGER fixture_failure');store.migrateNormalizedObjects();assert.equal(store.hasObject('scenes'),false);assert.deepEqual(store.readNormalized('scenes',{}),value);
 assert.equal(store.migrationDone('sqlite:object_store/scenes','sqlite:normalized/scenes'),true);
 store.migrateNormalizedObjects();assert.equal(store.db.prepare("SELECT count(*) n FROM migration_history WHERE target='sqlite:normalized/scenes'").get().n,1);
});
test('legacy secret import rolls back marker failure and retains its source for retry',t=>{
 const {dir,store}=fixture(t),file=path.join(dir,'legacy-secret');fs.writeFileSync(file,'fixture-value');
 store.db.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON migration_history BEGIN SELECT RAISE(ABORT,'fixture marker failure'); END");
 assert.throws(()=>store.importSecretFile('fixture-secret',file),/fixture marker failure/);assert.equal(store.hasSecret('fixture-secret'),false);assert.ok(fs.readFileSync(file,'utf8')==='fixture-value');
 store.db.exec('DROP TRIGGER fixture_failure');assert.equal(store.importSecretFile('fixture-secret',file),true);assert.ok(store.getSecret('fixture-secret')==='fixture-value');
 assert.equal(store.migrationDone(file,'sqlite:secret_store/fixture-secret'),true);assert.equal(store.importSecretFile('fixture-secret',file),false);
});
test('existing database configuration and disabled migration never import a legacy source',t=>{
 const {dir,store}=fixture(t),file=path.join(dir,'fixture-settings.json');fs.writeFileSync(file,JSON.stringify(value));
 assert.deepEqual(store.readJson(file,{fallback:true},{migrate:false}),{fallback:true});assert.equal(store.hasObject('fixture-settings'),false);
 store.putObject('fixture-settings',{current:true});assert.deepEqual(store.readJson(file,{}),{current:true});
 assert.equal(store.migrationDone(file,'sqlite:object_store/fixture-settings'),false);
});
for(const kind of ['normalized-json','object-json','normalized-object','secret'])test(`${kind} import rolls back a deferred COMMIT failure`,t=>{
 const {dir,store}=fixture(t),namespace=kind==='object-json'?'fixture-settings':'scenes',file=path.join(dir,namespace+'.json');
 fs.writeFileSync(file,kind==='secret'?'fixture-value':JSON.stringify(value));
 if(kind==='normalized-object')store.putObject(namespace,value);
 store.db.exec("CREATE TABLE fixture_parent(id INTEGER PRIMARY KEY);CREATE TABLE fixture_child(id INTEGER REFERENCES fixture_parent(id) DEFERRABLE INITIALLY DEFERRED);CREATE TRIGGER fixture_failure AFTER INSERT ON migration_history BEGIN INSERT INTO fixture_child VALUES(1); END");
 if(kind==='secret'){assert.throws(()=>store.importSecretFile('fixture-secret',file),/FOREIGN KEY/);assert.equal(store.hasSecret('fixture-secret'),false)}
 else if(kind==='normalized-object'){store.migrateNormalizedObjects();assert.equal(store.hasNormalized(namespace),false);assert.deepEqual(store.getObject(namespace),value)}
 else {assert.deepEqual(store.readJson(file,{}),{});assert.equal(kind==='object-json'?store.hasObject(namespace):store.hasNormalized(namespace),false)}
 assert.equal(store.db.prepare('SELECT count(*) n FROM fixture_child').get().n,0);
 assert.equal(store.db.prepare('SELECT count(*) n FROM migration_history').get().n,0);
 assert.equal(fs.existsSync(file),true);
});
