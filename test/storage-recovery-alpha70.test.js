"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {ClassroomHubStorage}=require("../src/storage");

function withStore(fn){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"hub-storage-recovery-"));
  const store=new ClassroomHubStorage({dataDir:dir,dbFile:path.join(dir,"hub.db"),masterKeyFile:path.join(dir,"missing")});
  try{return fn(store,dir)}finally{store.db.close();fs.rmSync(dir,{recursive:true,force:true})}
}

test("database storage is group-shared, database files exclude other users, and migration history is ordered",()=>withStore((store,dir)=>{
  assert.equal(fs.statSync(dir).mode&0o777,0o770);
  assert.equal(fs.statSync(store.dbFile).mode&0o777,0o660);
  assert.deepEqual(store.validateSchemaMigrations(),{ok:true,version:10,count:10});
  store.db.prepare("UPDATE schema_migrations SET name='tampered' WHERE version=3").run();
  assert.throws(()=>store.validateSchemaMigrations(),/Invalid or incomplete/);
}));

test("first administrator setup is atomic and the final effective administrator is protected",()=>withStore(store=>{
  const admin=store.createFirstAdministrator({username:"teacher-admin",displayName:"Teacher Admin"},{password:"correct-horse-battery"});
  assert.equal(admin.role,"admin");
  assert.equal(store.setupCompleted(),true);
  assert.equal(store.effectiveAdministrators().length,1);
  assert.throws(()=>store.putUser({...admin,role:"viewer",profileId:"read-only"}),/effective administrator/);
  assert.equal(store.listUsers()[0].role,"admin");
  assert.throws(()=>store.putAccessProfile({id:"administrator",name:"Administrator",role:"admin",enabled:false,config:{capabilities:["*"]}}),/effective administrator/);
  assert.equal(store.listAccessProfiles().find(x=>x.id==="administrator").enabled,true);
  assert.throws(()=>store.deleteUser(admin.id),/effective administrator/);
  assert.equal(store.userCount(),1);
}));

test("lab computer removal can revoke credentials and pending enrollment atomically",()=>withStore(store=>{
  const pending=store.createLabAgentEnrollment("student-pc-01");
  const enrolled=store.consumeLabAgentEnrollment("student-pc-01",pending.token);
  assert.ok(enrolled?.credential);
  store.createLabAgentEnrollment("student-pc-01");
  const result=store.revokeLabAgentAccess("student-pc-01");
  assert.deepEqual(result,{credentials:1,enrollments:1});
  assert.equal(store.authenticateLabAgent("student-pc-01",enrolled.credential),null);
  assert.equal(store.listLabAgentCredentials().pending.length,0);
}));

test("session validation remains immediate while routine maintenance writes are coalesced",()=>withStore(store=>{
  const admin=store.createFirstAdministrator({username:"session-admin",displayName:"Session Admin"},{password:"correct-horse-battery"});
  const issued=store.createSession(admin);
  const hash=require("node:crypto").createHash("sha256").update(issued.token).digest("hex");
  store.db.prepare("UPDATE user_sessions SET last_seen_at=? WHERE token_hash=?").run("2020-01-01T00:00:00.000Z",hash);

  const first=store.sessionUser(issued.token);
  assert.equal(first.id,admin.id);
  const touched=store.db.prepare("SELECT last_seen_at value FROM user_sessions WHERE token_hash=?").get(hash).value;
  assert.notEqual(touched,"2020-01-01T00:00:00.000Z");

  store.sessionUser(issued.token);
  assert.equal(store.db.prepare("SELECT last_seen_at value FROM user_sessions WHERE token_hash=?").get(hash).value,touched);

  const expired="expired-session";
  store.db.prepare("INSERT INTO user_sessions(id,user_id,token_hash,created_at,expires_at,last_seen_at) VALUES(?,?,?,?,?,?)")
    .run(expired,admin.id,"expired-token-hash","2020-01-01T00:00:00.000Z","2020-01-01T01:00:00.000Z","2020-01-01T00:00:00.000Z");
  assert.equal(store.listUserSessions(admin.id).some(row=>row.id===expired),false,"expired sessions stay hidden while cleanup is throttled");
  assert.equal(store.cleanupSessions({force:true}),1);

  store.deleteSession(issued.token);
  assert.equal(store.sessionUser(issued.token),null,"revocation is checked on every request");
}));

test("maintenance backups and restores enforce private files and reject link traversal",()=>{
  const source=fs.readFileSync(path.join(__dirname,"..","maintenance-agent","server.js"),"utf8");
  assert.match(source,/process\.umask\(0o077\)/);
  assert.match(source,/ent\.isSymbolicLink\(\)\)throw Error\(`Symbolic links are not permitted in recovery sources/);
  assert.match(source,/Special files are not permitted in restore archives/);
  assert.match(source,/fs\.chmodSync\(dest,0o600\)/);
  assert.match(source,/restoreModes/);
  assert.match(source,/restore-journal\.json/);
  assert.match(source,/Symbolic links are not permitted in recovery targets/);
  assert.match(source,/\/recovery\/normalize-data/);
  assert.doesNotMatch(source,/zip\.writeZip\(dest\)/);
});
