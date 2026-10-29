"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),express=require("express");
const {once}=require("node:events");
const {ClassroomHubStorage}=require("../src/storage");
const {DailySignIn,registerDailySignInRoutes,dailyCode,dayAt,FORMAT,ITERATIONS,secretName}=require("../src/daily-signin");
function harness(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-signin-"));
  const key=path.join(dir,"master.key");fs.writeFileSync(key,crypto.randomBytes(32).toString("hex"));
  const storage=new ClassroomHubStorage({dataDir:dir,dbFile:path.join(dir,"hub.db"),masterKeyFile:key});
  t.after(()=>{storage.db.close();fs.rmSync(dir,{recursive:true,force:true});});
  return {storage,manager:new DailySignIn(storage,{now:()=>new Date("2026-10-29T15:00:00Z")})};
}
test("daily codes use the selected calendar date across midnight and daylight saving",()=>{
  assert.equal(dayAt("America/New_York",new Date("2026-10-29T03:59:59Z")),"2026-10-28");
  assert.equal(dayAt("America/New_York",new Date("2026-10-29T04:00:00Z")),"2026-10-29");
  assert.equal(dayAt("America/New_York",new Date("2026-11-01T05:30:00Z")),"2026-11-01");
  assert.equal(dayAt("America/New_York",new Date("2026-11-01T06:30:00Z")),"2026-11-01");
  const seed=Buffer.alloc(32,17),id="00000000-0000-4000-8000-000000000001";
  const code=dailyCode(seed,id,"2026-10-29");assert.match(code,/^\d{8}$/);
  assert.equal(code,dailyCode(seed,id,"2026-10-29"));
  assert.notEqual(code,dailyCode(seed,id,"2026-10-30"));
  assert.notEqual(code,dailyCode(seed,"00000000-0000-4000-8000-000000000002","2026-10-29"));
});
test("group creation is transactional and lists never expose seeds or codes",t=>{
  const {storage,manager}=harness(t),group=manager.create({name:"Esports fixture",timeZone:"America/New_York"});
  assert.equal(storage.getSecret(secretName(group.id),{asBuffer:true}).length,32);
  assert.equal(manager.list().length,1);assert.equal(manager.code(group.id).day,"2026-10-29");
  assert.ok(!JSON.stringify(manager.list()).includes('seed'));
  assert.throws(()=>manager.create({name:"Esports fixture",timeZone:"UTC"}),/already exists/);
  assert.throws(()=>manager.create({name:"Other",timeZone:"Invalid/Time"}),/timezone/);
  const original=storage.setPreference.bind(storage);storage.setPreference=()=>{throw Error("fixture persistence failure");};
  const secrets=storage.listSecrets().length;
  assert.throws(()=>manager.create({name:"Rollback",timeZone:"UTC"}),/persistence/);
  storage.setPreference=original;assert.equal(storage.listSecrets().length,secrets);assert.equal(manager.list().length,1);
});
test("enrollment is authenticated, encrypted, computer-bound and has a one-day install expiry",async t=>{
  const {manager}=harness(t),group=manager.create({name:"Fixture",timeZone:"UTC"});
  const passphrase="synthetic test passphrase only";
  const envelope=await manager.provision(group.id,{computerName:"TEST-PC",username:"esports",passphrase});
  assert.equal(envelope.iterations,ITERATIONS);assert.ok(!JSON.stringify(envelope).includes("esports"));
  const key=crypto.pbkdf2Sync(passphrase,Buffer.from(envelope.salt,"base64"),ITERATIONS,32,"sha256");
  function decrypt(value){const cipher=crypto.createDecipheriv("aes-256-gcm",key,Buffer.from(value.nonce,"base64"));cipher.setAAD(Buffer.from(FORMAT));cipher.setAuthTag(Buffer.from(value.tag,"base64"));return Buffer.concat([cipher.update(Buffer.from(value.ciphertext,"base64")),cipher.final()]);}
  const policy=JSON.parse(decrypt(envelope));
  assert.equal(policy.computerName,"TEST-PC");assert.equal(policy.username,"esports");assert.equal(policy.expiresAt,"2026-10-30T15:00:00.000Z");
  assert.equal(dailyCode(Buffer.from(policy.seed,"base64"),group.id,"2026-10-29"),manager.code(group.id).code);
  const changed=Buffer.from(envelope.ciphertext,"base64");changed[0]^=1;
  assert.throws(()=>decrypt({...envelope,ciphertext:changed.toString("base64")}));
  for(const input of [{computerName:"other/path",username:"esports",passphrase},{computerName:"PC",username:"domain\\student",passphrase},{computerName:"PC",username:"esports",passphrase:"short"}])await assert.rejects(manager.provision(group.id,input));
});
test("administrator routes reject spoofed transport and rejected callers cannot exhaust the admin quota",async t=>{
  const {storage}=harness(t),app=express(),events=[];let allowed=true;
  app.use(express.json());
  const isAdmin=req=>req.get("x-test-admin")==="yes";
  registerDailySignInRoutes(app,{storage,isAdmin,requireAdmin:(req,res,next)=>isAdmin(req)?next():res.status(403).json({ok:false}),canRun:()=>allowed,audit:e=>events.push(e)});
  const server=app.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>server.close());
  const base=`http://127.0.0.1:${server.address().port}/api/v1/admin/daily-signin`;
  for(let n=0;n<35;n++){const r=await fetch(base);assert.equal(r.status,403);await r.text();}
  let r=await fetch(base,{headers:{"x-test-admin":"yes","x-forwarded-proto":"https"}});assert.equal(r.status,426);await r.text();
  r=await fetch(`${base}/groups`,{method:"POST",headers:{"x-test-admin":"yes","content-type":"application/json"},body:JSON.stringify({name:"Test",timeZone:"UTC"})});
  assert.equal(r.status,201);assert.equal(r.headers.get("cache-control"),"no-store");const {group}=await r.json();
  r=await fetch(`${base}/groups/${group.id}/code`,{method:"POST",headers:{"x-test-admin":"yes"}});assert.equal(r.status,200);const result=await r.json();assert.match(result.code,/^\d{8}$/);
  assert.ok(!JSON.stringify(events).includes(result.code));
  allowed=false;r=await fetch(`${base}/groups/${group.id}/code`,{method:"POST",headers:{"x-test-admin":"yes"}});assert.equal(r.status,423);await r.text();
});
