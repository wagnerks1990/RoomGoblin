"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),{setTimeout:delay}=require("node:timers/promises");
const {DatabaseSync}=require("node:sqlite");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");
function ledger(app){const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});try{const row=db.prepare("SELECT value_json FROM system_preferences WHERE key='automation.run-ledger'").get();return row?JSON.parse(row.value_json).runs:[]}finally{db.close()}}
test("startup recovery waits for snapshot thaw and then resumes its current winner once",{...linux,timeout:30000},async t=>{
  const app=await launch(t,{receivers:true}),base=`http://127.0.0.1:${app.control}`;
  const post=(route,body,headers={})=>fetch(base+route,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)});
  const admin=await post("/api/v1/setup/administrator",{username:"startup-admin",password:"test-only-long-password"},{"x-setup-token":"lifecycle-test-setup"});assert.equal(admin.status,201);await admin.text();
  const cookie=admin.headers.get("set-cookie").split(";",1)[0];
  const created=await post("/api/v1/automations",{id:"frozen-startup",name:"Startup recovery fixture",time:"00:00",days:[0,1,2,3,4,5,6],actionSequence:[
    {id:"first",action:"display.clear",targets:["tv1"],executionMode:"loop",repeatDelaySeconds:30},
    {id:"second",action:"display.clear",targets:["tv1"],executionMode:"loop",repeatDelaySeconds:30}
  ]},{cookie});assert.equal(created.status,200);await created.text();
  const maintenance={"x-maintenance-token":"lifecycle-test-maintenance"};
  const frozen=await post("/api/v1/internal/maintenance/export-freeze",{confirm:"FREEZE_FULL_EXPORT"},maintenance);assert.equal(frozen.status,200);const {freezeToken}=await frozen.json(),before=ledger(app);
  await delay(5600);assert.deepEqual(ledger(app),before,"startup recovery wrote into the acknowledged snapshot");
  const thaw=await post("/api/v1/internal/maintenance/export-thaw",{freezeToken},maintenance);assert.equal(thaw.status,200);await thaw.text();
  await waitFor(()=>ledger(app).some(x=>x.automationId==="frozen-startup"&&x.status==="recovered-running"),"deferred current-winner recovery");
  assert.equal(ledger(app).filter(x=>x.automationId==="frozen-startup"&&x.status==="recovered-running").length,1);
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});
