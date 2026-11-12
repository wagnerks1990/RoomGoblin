'use strict';
// Explicit offline operator tool. Never invoked by startup, updates or HTTP routes.
const {DatabaseSync}=require('node:sqlite');
const {parseArgs}=require('node:util');
const KEEP_PREFERENCES=new Set(['learning.ai','learning.platform','learning.publicRoute','learning.publicRoute.previous']);
const KEEP_SECRETS=new Set(['learning.openai.key','learning.local.key']);
const quote=name=>'"'+String(name).replaceAll('"','""')+'"';
function inventory(db){
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name GLOB 'learning_*' ORDER BY name").all().map(r=>r.name);
 if(names.some(n=>!/^learning_[a-z_]+$/.test(n)))throw Error('Unexpected learning table name; reset refused.');
 return {tables:Object.fromEntries(names.map(n=>[n,db.prepare('SELECT COUNT(*) n FROM '+quote(n)).get().n])),
  learnerAccounts:db.prepare("SELECT COUNT(*) n FROM users WHERE profile_id='learning-student'").get().n,
  preferences:db.prepare("SELECT key FROM system_preferences WHERE key LIKE 'learning.%'").all().filter(r=>!KEEP_PREFERENCES.has(r.key)).length,
  secrets:db.prepare("SELECT name FROM secret_store WHERE name LIKE 'learning.%'").all().filter(r=>!KEEP_SECRETS.has(r.name)).length};
}
function reset(db,{confirm}={}){
 if(confirm!=='RESET_LEARNING_DATA')throw Error('Explicit RESET_LEARNING_DATA confirmation required.');
 if(db.prepare('PRAGMA foreign_keys').get().foreign_keys!==1)throw Error('Foreign-key enforcement is required.');
 if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Database integrity check failed.');
 db.exec('BEGIN IMMEDIATE; PRAGMA defer_foreign_keys=ON');
 try{
  const before=inventory(db),names=Object.keys(before.tables),learning=new Set(names);
  // Fail closed rather than cascading into unrelated application records.
  for(const {name} of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
   if(learning.has(name)||name==='user_sessions')continue;
   for(const fk of db.prepare('PRAGMA foreign_key_list('+quote(name)+')').all()){
    if(learning.has(fk.table.toLowerCase())&&db.prepare('SELECT 1 FROM '+quote(name)+' LIMIT 1').get())throw Error('An unrelated table references learning data; reset refused.');
    if(fk.table.toLowerCase()==='users'&&db.prepare('SELECT 1 FROM '+quote(name)+' WHERE '+quote(fk.from)+" IN (SELECT "+quote(fk.to||'id')+" FROM users WHERE profile_id='learning-student') LIMIT 1").get())throw Error('A learner account owns unrelated data; reset refused.');
   }
  }
  const remaining=new Set(names),references=new Map(names.map(n=>[n,db.prepare('PRAGMA foreign_key_list('+quote(n)+')').all().map(f=>f.table.toLowerCase()).filter(p=>p!==n)]));
  while(remaining.size){const next=[...remaining].find(n=>![...remaining].some(child=>references.get(child).includes(n)))||[...remaining][0];db.exec('DELETE FROM '+quote(next));remaining.delete(next);}
  db.exec("DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE profile_id='learning-student'); DELETE FROM users WHERE profile_id='learning-student'");
  for(const {key} of db.prepare("SELECT key FROM system_preferences WHERE key LIKE 'learning.%'").all())if(!KEEP_PREFERENCES.has(key))db.prepare('DELETE FROM system_preferences WHERE key=?').run(key);
  for(const {name} of db.prepare("SELECT name FROM secret_store WHERE name LIKE 'learning.%'").all())if(!KEEP_SECRETS.has(name))db.prepare('DELETE FROM secret_store WHERE name=?').run(name);
  const platform=db.prepare("SELECT value_json FROM system_preferences WHERE key='learning.platform'").get();
  if(platform){const cfg=JSON.parse(platform.value_json);cfg.embeddedEnabled=false;cfg.insightsEnabled=false;db.prepare("UPDATE system_preferences SET value_json=?,updated_at=? WHERE key='learning.platform'").run(JSON.stringify(cfg),new Date().toISOString());}
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign-key validation failed.');
  const after=inventory(db);if(Object.values(after.tables).some(Boolean)||after.learnerAccounts||after.preferences||after.secrets)throw Error('Learning reset verification failed.');
  db.exec('COMMIT');return {before,after,connectionsRetained:true};
 }catch(error){db.exec('ROLLBACK');throw error;}
}
if(require.main===module){
 try{
  const {values}=parseArgs({options:{database:{type:'string'},apply:{type:'boolean'},confirm:{type:'string'}},allowPositionals:false});
  const file=values.database||process.env.DATABASE_FILE;if(!file)throw Error('Use the authoritative DATABASE_FILE.');
  if(values.apply&&process.env.ROOMGOBLIN_LEARNING_RESET_OFFLINE!=='1')throw Error('Stop the Hub and use the documented offline reset procedure first.');
  const stat=require('node:fs').lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('The authoritative database must be an existing regular file.');
  const db=new DatabaseSync(file,{readOnly:!values.apply});try{db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');console.log(JSON.stringify(values.apply?reset(db,{confirm:values.confirm}):{preview:inventory(db)}));}finally{db.close();}
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={inventory,reset};
