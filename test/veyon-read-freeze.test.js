"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),fs=require("node:fs");
const {setTimeout:delay}=require("node:timers/promises");
const {DatabaseSync}=require("node:sqlite");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");

async function setup(t,options){
  const app=await launch(t,options),base=`http://127.0.0.1:${app.control}`;
  const response=await fetch(base+"/api/v1/setup/administrator",{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"veyon-freeze-admin",password:"test-only-long-password"})});
  assert.equal(response.status,201);await response.text();
  const cookie=response.headers.get("set-cookie").split(";",1)[0];
  const get=(route,method="GET")=>fetch(base+route,{method,headers:{cookie}});
  const internal=(route,body)=>fetch(base+"/api/v1/internal/maintenance/"+route,{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"},body:JSON.stringify(body)});
  return {...app,get,internal};
}

test("Veyon inventory cannot persist identity mappings inside an acknowledged export freeze",linux,async t=>{
  const app=await setup(t),db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});t.after(()=>db.close());
  const mapping=()=>db.prepare("SELECT value_json FROM system_preferences WHERE key='veyon.inventory-hostmap.v2'").get();
  assert.equal(mapping(),undefined);
  const frozen=await app.internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  const response=await app.get("/api/v1/veyon/computers?info=0");await response.text();
  assert.equal(mapping(),undefined,"inventory wrote identity mapping after the freeze acknowledged");
  assert.equal(response.status,423);
  const thaw=await app.internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();
  const normal=await app.get("/api/v1/veyon/computers?info=0");assert.equal(normal.status,200);assert.deepEqual((await normal.json()).computers,[]);
  assert.ok(mapping(),"normal inventory persists authoritative identity before responding");
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});

test("Veyon freeze admission covers preview, metadata, maintenance inventory and HEAD aliases",linux,async t=>{
  const app=await setup(t);
  const frozen=await app.internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  for(const route of ["/api/v1/veyon/computers","/API/V1/VEYON/COMPUTERS/","/api/v1/veyon/computers/192.168.50.254/info","/api/v1/veyon/computers/192.168.50.254/framebuffer","/api/v1/veyon/computers/192.168.50.254/features","/api/v1/veyon/computers/192.168.50.254/feature/screenLock","/api/v1/admin/config","/api/v1/admin/veyon-keys","/api/v1/internal/maintenance/veyon/computers"]){
    for(const method of ["GET","HEAD"]){const r=await app.get(route,method);await r.text();assert.equal(r.status,423,method+" "+route)}
  }
  // The actual configuration mirror has no keyring projection and must remain
  // available to the snapshot owner, with its own token guard intact.
  const base=`http://127.0.0.1:${app.control}`;
  for(const [headers,expected] of [[{},401],[{"x-maintenance-token":"lifecycle-test-maintenance"},200]]){
    const r=await fetch(base+"/api/v1/internal/maintenance/config",{headers});await r.text();assert.equal(r.status,expected);
  }
  const ordinary=await app.get("/api/v1/auth/me");assert.equal(ordinary.status,200);await ordinary.text();
  const thaw=await app.internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();
  for(const route of ["/api/v1/admin/config","/api/v1/admin/veyon-keys","/API/V1/VEYON/COMPUTERS/"]){const r=await app.get(route);assert.equal(r.status,200);await r.text()}
  const unauthorized=await fetch(base+"/api/v1/veyon/computers");assert.equal(unauthorized.status,401);await unauthorized.text();
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});

test("export waits for accepted Veyon inventory and its final stable identity write",linux,async t=>{
  const app=await setup(t,{preload:path.join(__dirname,"fixtures/veyon-lifecycle-read.cjs")});
  const pending=app.get("/api/v1/veyon/computers?info=0");
  await waitFor(()=>fs.existsSync(path.join(app.dir,"probe-entered")),"accepted Veyon probe");
  let acknowledged=false;
  const freezing=app.internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"}).then(r=>{acknowledged=true;return r});
  await delay(150);assert.equal(acknowledged,false,"freeze acknowledged before the accepted inventory finished");
  const blocked=await app.get("/api/v1/veyon/computers?info=0");assert.equal(blocked.status,423);await blocked.text();
  fs.writeFileSync(path.join(app.dir,"release-probe"),"");
  const accepted=await pending;assert.equal(accepted.status,200);const {computers}=await accepted.json();assert.equal(computers.length,1);
  const frozen=await freezing;assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});
  try{const row=db.prepare("SELECT value_json FROM system_preferences WHERE key='veyon.inventory-hostmap.v2'").get();assert.ok(row);const entry=JSON.parse(row.value_json)["lifecycle-fixture"];assert.equal(entry.stableId,computers[0].id);assert.equal(entry.backendId,"192.168.50.254");assert.equal(entry.stale,false)}finally{db.close()}
  const thaw=await app.internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();
  const again=await app.get("/api/v1/veyon/computers?info=0");assert.equal(again.status,200);assert.equal((await again.json()).computers[0].id,computers[0].id);
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});
