"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {DatabaseSync}=require("node:sqlite"),{ClassroomHubStorage}=require("../src/storage");
const {launch,linux}=require("./helpers/lifecycle-process.cjs");
const old="2020-01-01T00:00:00.000Z";
function storeFixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-auth-freeze-"));let allowed=true;
  const store=new ClassroomHubStorage({dataDir:dir,dbFile:path.join(dir,"hub.db"),masterKeyFile:path.join(dir,"missing"),canMaintainAuth:()=>allowed});
  t.after(()=>{store.db.close();fs.rmSync(dir,{recursive:true,force:true})});
  return {store,pause(){allowed=false;store.db.exec("PRAGMA query_only=ON")},resume(){store.db.exec("PRAGMA query_only=OFF");allowed=true}};
}
test("paused session housekeeping stays read-only while expiry and revocation remain enforced",t=>{
  const h=storeFixture(t),s=h.store;
  const admin=s.createFirstAdministrator({username:"fixture-admin"},{password:"test-only-long-password"});
  const active=s.createSession(admin),expired=s.createSession(admin),revoked=s.createSession(admin);
  s.deleteSession(revoked.token);
  s.db.prepare("UPDATE user_sessions SET expires_at=? WHERE token_hash=?").run(old,s.tokenHash(expired.token));
  s.db.prepare("UPDATE user_sessions SET last_seen_at=?").run(old);s.lastSessionCleanupAt=0;
  h.pause();
  assert.equal(s.sessionUser(active.token).id,admin.id);
  assert.equal(s.sessionUser(expired.token),null);assert.equal(s.sessionUser(revoked.token),null);assert.equal(s.sessionUser("wrong"),null);
  assert.equal(s.listUserSessions(admin.id).length,1);assert.equal(s.listAllUserSessions().length,1);
  assert.equal(s.cleanupSessions({force:true}),0);assert.equal(s.lastSessionCleanupAt,0);
  assert.equal(s.db.prepare("SELECT count(*) n FROM user_sessions").get().n,2);
  assert.equal(s.db.prepare("SELECT last_seen_at value FROM user_sessions WHERE token_hash=?").get(s.tokenHash(active.token)).value,old);
  h.resume();assert.equal(s.sessionUser(active.token).id,admin.id);
  assert.equal(s.db.prepare("SELECT count(*) n FROM user_sessions").get().n,1);
  assert.notEqual(s.db.prepare("SELECT last_seen_at value FROM user_sessions").get().value,old);
  s.deleteSession(active.token);assert.equal(s.sessionUser(active.token),null);
});

for(const kind of ["Display","LabAgent"])test(`paused ${kind} credential reads do not write activity or accept revoked credentials`,t=>{
  const h=storeFixture(t),s=h.store,id=kind==="Display"?"tv1":"fixture-agent";
  if(kind==="Display")s.writeNormalized("devices",{devices:{tv1:{name:"Fixture",enabled:true}},displayGroups:{}});
  const issue=()=>{const e=s[`create${kind}Enrollment`](id);return s[`consume${kind}Enrollment`](id,e.token)};
  const active=issue(),revoked=issue();s[`revoke${kind}Credential`](revoked.id);
  const table=kind==="Display"?"display_credentials":"lab_agent_credentials";
  s.db.prepare(`UPDATE ${table} SET last_used_at=? WHERE id=?`).run(old,active.id);
  h.pause();
  assert.equal(s[`authenticate${kind}`](id,active.credential).lastUsedAt,old);
  assert.equal(s[`authenticate${kind}`](id,revoked.credential),null);assert.equal(s[`authenticate${kind}`](id,"wrong"),null);
  h.resume();assert.notEqual(s[`authenticate${kind}`](id,active.credential).lastUsedAt,old);
  if(kind==="Display"){
    s.db.prepare("UPDATE display_devices SET enabled=0 WHERE id=?").run(id);h.pause();
    assert.equal(s.authenticateDisplay(id,active.credential),null);
  }
});

test("authenticated reads preserve session activity throughout a canonical export freeze",linux,async t=>{
  const app=await launch(t);
  const setup=await fetch(`http://127.0.0.1:${app.control}/api/v1/setup/administrator`,{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"freeze-admin",password:"test-only-long-password"})});
  assert.equal(setup.status,201);await setup.text();const cookie=setup.headers.get("set-cookie").split(";",1)[0];
  const db=new DatabaseSync(path.join(app.dir,"hub.db"));t.after(()=>db.close());
  db.prepare("UPDATE user_sessions SET last_seen_at=?").run(old);
  const internal=(route,body)=>fetch(`http://127.0.0.1:${app.control}/api/v1/internal/maintenance/${route}`,{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"},body:JSON.stringify(body)});
  const frozen=await internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  for(const route of ["auth/me","auth/sessions","admin/users","admin/health"]){
    const r=await fetch(`http://127.0.0.1:${app.control}/api/v1/${route}`,{headers:{cookie}});assert.equal(r.status,200);await r.text();
    assert.equal(db.prepare("SELECT last_seen_at value FROM user_sessions").get().value,old,route+" wrote inside the freeze");
  }
  const thaw=await internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();
  const normal=await fetch(`http://127.0.0.1:${app.control}/api/v1/auth/me`,{headers:{cookie}});assert.equal(normal.status,200);await normal.text();
  assert.notEqual(db.prepare("SELECT last_seen_at value FROM user_sessions").get().value,old);
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});

test("update status finishing during a freeze defers history writes until a later unfrozen read",linux,async t=>{
  const http=require("node:http"),{once}=require("node:events");let accept;
  const entered=new Promise(resolve=>accept=resolve);
  const job={phase:"completed",ok:true,updatedAt:"2026-10-19T20:00:00Z",targetCommit:"a".repeat(40)};
  let release,first=true;
  const maintenance=http.createServer((req,res)=>{
    assert.equal(req.headers["x-maintenance-token"],"lifecycle-test-maintenance");
    if(req.url!=="/app-updates/job"){res.writeHead(404);res.end();return}
    const send=()=>{res.setHeader("Content-Type","application/json");res.end(JSON.stringify(job))};
    if(first){first=false;release=send;accept()}else send();
  }).listen(0,"127.0.0.1");
  await once(maintenance,"listening");t.after(()=>{maintenance.closeAllConnections();maintenance.close()});
  const app=await launch(t,{maintenanceUrl:`http://127.0.0.1:${maintenance.address().port}`});
  const setup=await fetch(`http://127.0.0.1:${app.control}/api/v1/setup/administrator`,{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"status-admin",password:"test-only-long-password"})});
  assert.equal(setup.status,201);await setup.text();const cookie=setup.headers.get("set-cookie").split(";",1)[0];
  const status=()=>fetch(`http://127.0.0.1:${app.control}/api/v1/admin/app-updates/job`,{headers:{cookie}});
  const pending=status();await entered;
  const internal=(route,body)=>fetch(`http://127.0.0.1:${app.control}/api/v1/internal/maintenance/${route}`,{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"},body:JSON.stringify(body)});
  const frozen=await internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();release();
  for(const response of [await pending,await status()]){assert.equal(response.status,200);const result=await response.json();assert.equal(result.phase,"completed");assert.deepEqual(result.history,[])}
  const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});
  try{assert.equal(db.prepare("SELECT value_json FROM system_preferences WHERE key='updates.history'").get(),undefined)}finally{db.close()}
  const thaw=await internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();
  const after=await status();assert.equal(after.status,200);assert.equal((await after.json()).history.length,1);
  const again=await status();assert.equal(again.status,200);assert.equal((await again.json()).history.length,1);
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});
