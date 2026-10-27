"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{setTimeout:delay}=require("node:timers/promises");
const {DatabaseSync}=require("node:sqlite");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");
async function setup(t){
  const app=await launch(t,{preload:path.join(__dirname,"fixtures/veyon-cleanup-work.cjs")}),base=`http://127.0.0.1:${app.control}`;
  const setup=await fetch(base+"/api/v1/setup/administrator",{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"cleanup-admin",password:"test-only-long-password"})});assert.equal(setup.status,201);await setup.text();
  const cookie=setup.headers.get("set-cookie").split(";",1)[0];
  const request=(route,method="GET")=>fetch(base+route,{method,headers:{cookie}});
  const internal=(route,body)=>fetch(base+"/api/v1/internal/maintenance/"+route,{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"},body:JSON.stringify(body)});
  const features=await request("/api/v1/veyon/computers/192.168.50.253/features");assert.equal(features.status,200);await features.text();
  return {...app,request,internal};
}
function closedAudit(app){const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});try{return db.prepare("SELECT count(*) n FROM audit_events WHERE kind='service.action' AND json_extract(payload_json,'$.component')='veyon' AND json_extract(payload_json,'$.operation')='DELETE'").get().n}finally{db.close()}}

test("removing a Veyon computer drains its detached connection close before shutdown",linux,async t=>{
  const app=await setup(t);
  const removed=await app.request("/api/v1/veyon/computers/192.168.50.253","DELETE");assert.equal(removed.status,200);await removed.text();
  await waitFor(()=>fs.existsSync(path.join(app.dir,"veyon-close-entered")),"accepted Veyon connection close");
  app.child.kill("SIGTERM");await delay(150);assert.equal(app.child.exitCode,null,"shutdown discarded the accepted close/audit");
  fs.writeFileSync(path.join(app.dir,"release-veyon-close"),"");
  assert.deepEqual(await app.exited,[0,null],app.output());assert.equal(closedAudit(app),1);
});

test("export drains an accepted idle Veyon connection close and flushes its audit after thaw",{...linux,timeout:30000},async t=>{
  const app=await setup(t);fs.writeFileSync(path.join(app.dir,"age-veyon"),"");
  // The real 15-second pool timer runs; only its cached connection age changes.
  const end=Date.now()+18000;while(!fs.existsSync(path.join(app.dir,"veyon-close-entered"))&&Date.now()<end)await delay(40);
  assert.ok(fs.existsSync(path.join(app.dir,"veyon-close-entered")));
  let acknowledged=false;const freezing=app.internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"}).then(r=>{acknowledged=true;return r});
  await delay(150);assert.equal(acknowledged,false,"freeze discarded accepted idle cleanup ownership");
  fs.writeFileSync(path.join(app.dir,"release-veyon-close"),"");
  const frozen=await freezing;assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();assert.equal(closedAudit(app),0);
  const thaw=await app.internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();assert.equal(closedAudit(app),1);
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});

test("the idle Veyon timer cannot begin cleanup while export owns the freeze",{...linux,timeout:30000},async t=>{
  const app=await setup(t);
  const frozen=await app.internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  fs.writeFileSync(path.join(app.dir,"age-veyon"),"");await delay(15500);
  assert.equal(fs.existsSync(path.join(app.dir,"veyon-close-entered")),false,"idle timer started a close during freeze");
  const thaw=await app.internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});
