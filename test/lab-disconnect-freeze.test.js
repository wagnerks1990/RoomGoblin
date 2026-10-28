"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{once}=require("node:events"),{setTimeout:delay}=require("node:timers/promises");
const {DatabaseSync}=require("node:sqlite"),WebSocket=require("ws");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");
async function setup(t,options={}){
  const app=await launch(t,options),base=`http://127.0.0.1:${app.control}`;
  const admin=await fetch(base+"/api/v1/setup/administrator",{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"lab-admin",password:"test-only-long-password"})});assert.equal(admin.status,201);await admin.text();
  const cookie=admin.headers.get("set-cookie").split(";",1)[0];
  const request=(route,body,internal=false)=>fetch(base+route,{method:body===undefined?"GET":"POST",headers:{"content-type":"application/json",...(internal?{"x-maintenance-token":"lifecycle-test-maintenance"}:{cookie})},body:body===undefined?undefined:JSON.stringify(body)});
  const enrollment=await request("/api/v1/admin/lab-agents/lifecycle-lab/enrollment",{});assert.equal(enrollment.status,201);const {enrollment:{token}}=await enrollment.json();
  async function hello(payload={enrollmentToken:token}){
    const ws=new WebSocket(`ws://127.0.0.1:${app.control}/ws`);t.after(()=>ws.terminate());await once(ws,"open");
    const ack=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error("Lab hello timed out")),3000);ws.on("message",raw=>{const msg=JSON.parse(String(raw));if(msg.type==="hello.ack"||msg.type==="error"){clearTimeout(timer);msg.type==="error"?reject(Error(msg.error)):resolve(msg)}})});
    ws.send(JSON.stringify({type:"hello",role:"lab-agent",agentId:"lifecycle-lab",hostname:"LIFECYCLE-LAB",...payload}));return {ws,ack:await ack};
  }
  const inventory=async()=>{const r=await request("/api/v1/lab/computers");assert.equal(r.status,200);return (await r.json()).computers.find(x=>x.id==="lifecycle-lab")};
  const internal=(route,body)=>request("/api/v1/internal/maintenance/"+route,body,true);
  return {...app,hello,inventory,internal};
}
function saved(app){const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});try{return JSON.parse(db.prepare("SELECT value_json FROM object_store WHERE namespace='lab-computers'").get().value_json).computers["lifecycle-lab"]}finally{db.close()}}
async function close(ws){const closed=once(ws,"close");ws.close();await closed}

test("lab disconnect metadata stays outside the frozen snapshot and persists after thaw",linux,async t=>{
  const app=await setup(t),agent=await app.hello(),before=saved(app);
  const frozen=await app.internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  await close(agent.ws);await waitFor(async()=>(await app.inventory()).online===false,"live offline state during freeze");
  assert.deepEqual(saved(app),before,"peer close wrote inventory after freeze acknowledgment");
  const thaw=await app.internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();
  assert.ok(saved(app).disconnectedAt);assert.equal(saved(app).disconnectedAt,(await app.inventory()).disconnectedAt);
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});

test("aborted freeze acquisition flushes deferred lab disconnect metadata",linux,async t=>{
  const app=await setup(t,{preload:path.join(__dirname,"fixtures/export-writer.cjs")}),agent=await app.hello(),before=saved(app);
  await (await fetch(`http://127.0.0.1:${app.control}/fixture/export-write?early=true`,{method:"POST"})).text();
  const freezing=app.internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});
  await waitFor(async()=>{const r=await app.internal("audit/prune",{confirm:false});await r.text();return r.status===423},"freeze acquisition");
  await close(agent.ws);await waitFor(async()=>(await app.inventory()).online===false,"disconnect during acquisition");assert.deepEqual(saved(app),before);
  app.child.kill("SIGTERM");const result=await freezing;assert.equal(result.status,503);await result.text();
  assert.ok(saved(app).disconnectedAt);fs.writeFileSync(path.join(app.dir,"release-writer"),"");
  assert.deepEqual(await app.exited,[0,null],app.output());
});

for(const recover of [true,false])test(`deferred lab persistence ${recover?"retries":"fails honestly"} at shutdown`,linux,async t=>{
  const app=await setup(t),agent=await app.hello(),before=saved(app);
  const db=new DatabaseSync(path.join(app.dir,"hub.db"));
  db.exec("PRAGMA busy_timeout=5000");
  try{db.exec("CREATE TRIGGER fixture_reject_lab BEFORE UPDATE ON object_store WHEN NEW.namespace='lab-computers' BEGIN SELECT RAISE(FAIL,'fixture lab write failure'); END")}finally{db.close()}
  const frozen=await app.internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  await close(agent.ws);await waitFor(async()=>(await app.inventory()).online===false,"deferred disconnect");
  const thaw=await app.internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();assert.deepEqual(saved(app),before);
  if(recover){const db=new DatabaseSync(path.join(app.dir,"hub.db"));try{db.exec("PRAGMA busy_timeout=5000; DROP TRIGGER fixture_reject_lab")}finally{db.close()}}
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[recover?0:1,null],app.output());
  if(recover)assert.ok(saved(app).disconnectedAt);else assert.match(app.output(),/Shutdown lab disconnect writes are still pending/);
});

test("an old lab socket closing cannot mark its replacement disconnected",linux,async t=>{
  const app=await setup(t),first=await app.hello(),closed=once(first.ws,"close"),second=await app.hello({credential:first.ack.credential});await closed;await delay(80);
  const current=await app.inventory();assert.equal(current.online,true);assert.equal(current.disconnectedAt,undefined,"replaced socket stamped the live connection");
  assert.equal(saved(app).disconnectedAt,undefined);
  await close(second.ws);await waitFor(()=>Boolean(saved(app).disconnectedAt),"current socket disconnect persistence");
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});
