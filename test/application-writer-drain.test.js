"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),http=require("node:http");
const {setTimeout:delay}=require("node:timers/promises"),{DatabaseSync}=require("node:sqlite");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");
const {WebSocket}=require("ws"),{once}=require("node:events");
const preload=path.join(__dirname,"fixtures/shutdown-work.cjs");
function preference(app,key){
  const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});
  try{const row=db.prepare("SELECT value_json FROM system_preferences WHERE key=?").get(key);return row?JSON.parse(row.value_json):null}finally{db.close()}
}
function runs(app){return preference(app,"automation.run-ledger")?.runs||[]}
async function request(app,url,body,headers={}){
  return fetch(`http://127.0.0.1:${app.control}${url}`,{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify(body)});
}
async function administrator(app){
  const response=await request(app,"/api/v1/setup/administrator",{username:"lifecycle-admin",password:"test-only-long-password"},{"x-setup-token":"lifecycle-test-setup"});
  assert.equal(response.status,201,await response.text());
  return {cookie:response.headers.get("set-cookie").split(";",1)[0]};
}
async function stop(app){app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output())}
const maintenance={"x-maintenance-token":"lifecycle-test-maintenance"};
const loop={name:"Shutdown loop fixture",time:"00:00",days:[0,1,2,3,4,5,6],actionSequence:[
  {id:"first",action:"display.clear",targets:["tv1"],executionMode:"loop",repeatDelaySeconds:30},
  {id:"second",action:"display.clear",targets:["tv1"],executionMode:"loop",repeatDelaySeconds:30}
]};

for(const early of [false,true])test(`canonical shutdown persists a handler's final SQLite write after ${early?"response finish":"client disconnect"}`,linux,async t=>{
  const app=await launch(t,{preload});
  const req=http.request(`http://127.0.0.1:${app.control}/fixture/pending-write?early=${early}`,{method:"POST"});
  req.on("error",()=>{});req.on("response",res=>res.resume());req.end();
  await waitFor(()=>app.output().includes("fixture-writer-started"),"handler entry");
  if(!early)req.destroy();
  await stop(app);assert.equal(preference(app,"shutdown.fixture.completed"),true);
});

test("a stuck detached handler fails the fixed shutdown deadline",linux,async t=>{
  const app=await launch(t,{preload});
  const response=await request(app,"/fixture/pending-write?early=true&stuck=true",{});await response.text();
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[1,null],app.output());
  assert.match(app.output(),/ten-second drain deadline/);
  assert.equal(preference(app,"shutdown.fixture.completed"),null);
});

test("a busy SQLite checkpoint reports failure while preserving the completed write",linux,async t=>{
  const app=await launch(t,{preload});
  const reader=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});
  try{
    reader.exec("BEGIN");reader.prepare("SELECT count(*) FROM system_preferences").get();
    const response=await request(app,"/fixture/pending-write?early=true",{});await response.text();
    app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[1,null],app.output());
    assert.match(app.output(),/SQLite checkpoint is busy/);
  }finally{reader.close()}
  assert.equal(preference(app,"shutdown.fixture.completed"),true);
});

test("shutdown preserves an active export freeze and admits only authenticated thaw",linux,async t=>{
  const app=await launch(t,{gateway:true});
  const frozen=await request(app,"/api/v1/internal/maintenance/export-freeze",{confirm:"FREEZE_FULL_EXPORT"},maintenance);
  assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  app.child.kill("SIGTERM");await waitFor(()=>app.output().includes("received; draining"),"shutdown request");
  let response=await fetch(`http://127.0.0.1:${app.control}/health`);assert.equal(response.status,503);await response.text();
  response=await fetch(`http://127.0.0.1:${app.control}/display-gateway/https/example.invalid/`);assert.equal(response.status,503);await response.text();
  response=await request(app,"/api/v1/internal/maintenance/export-thaw",{freezeToken});assert.equal(response.status,401);await response.text();
  response=await request(app,"/api/v1/internal/maintenance/export-thaw",{freezeToken:"wrong"},maintenance);assert.equal(response.status,409);await response.text();
  assert.equal(app.child.exitCode,null,"the active freeze must still own its snapshot");
  response=await request(app,"/api/v1/internal/maintenance/export-thaw",{freezeToken},maintenance);assert.equal(response.status,200);await response.text();
  assert.deepEqual(await app.exited,[0,null],app.output());
});

test("shutdown aborts freeze acquisition and records a manual loop as interrupted",linux,async t=>{
  const app=await launch(t,{receivers:true}),headers=await administrator(app);
  const response=await request(app,"/api/v1/automations/draft/run",loop,headers);assert.equal(response.status,200);
  const started=await response.json();assert.equal(started.started,true);
  const freeze=request(app,"/api/v1/internal/maintenance/export-freeze",{confirm:"FREEZE_FULL_EXPORT"},maintenance);
  await waitFor(async()=>{const r=await request(app,"/api/v1/internal/maintenance/audit/prune",{confirm:false},maintenance);await r.text();return r.status===423},"freeze acquisition");
  app.child.kill("SIGTERM");const result=await freeze;assert.equal(result.status,503);await result.text();
  assert.deepEqual(await app.exited,[0,null],app.output());
  const final=runs(app).filter(row=>row.occurrenceId===started.occurrenceId).at(-1);
  assert.equal(final.status,"interrupted");assert.equal(final.reason,"server-shutdown");
});

test("scheduled shutdown interruption recovers on restart while operator cancellation stays terminal",{...linux,timeout:40000},async t=>{
  let app=await launch(t,{receivers:true});const headers=await administrator(app);
  let response=await request(app,"/api/v1/automations",{...loop,id:"shutdown-schedule"},headers);assert.equal(response.status,200,await response.text());
  response=await request(app,"/api/v1/automation-control/resume",{},headers);const resumed=await response.json();
  assert.equal(response.status,200,JSON.stringify(resumed));assert.equal(resumed.continuousRecovery.started,1,JSON.stringify(resumed));
  await waitFor(()=>runs(app).some(row=>row.automationId==="shutdown-schedule"&&row.status==="running"),"scheduled run");
  await stop(app);
  const id=runs(app).findLast(row=>row.automationId==="shutdown-schedule").occurrenceId;
  assert.equal(runs(app).filter(row=>row.occurrenceId===id).at(-1).status,"interrupted");
  app=await launch(t,{directory:app.dir});
  await waitFor(()=>runs(app).filter(row=>row.occurrenceId===id).at(-1)?.status==="running","restart recovery");
  response=await request(app,`/api/v1/automation-control/runs/${encodeURIComponent(id)}/cancel`,{},headers);assert.equal(response.status,200);await response.text();
  await waitFor(()=>runs(app).filter(row=>row.occurrenceId===id).at(-1)?.status==="cancelled","operator cancellation");
  await stop(app);app=await launch(t,{directory:app.dir});
  await delay(5600);
  assert.equal(runs(app).filter(row=>row.occurrenceId===id).at(-1).status,"cancelled");await stop(app);
});

test("shutdown waits for an accepted WebSocket command's final audit after disconnect",linux,async t=>{
  const app=await launch(t,{preload,receivers:true,mockMqtt:true}),headers=await administrator(app);
  const ws=new WebSocket(`ws://127.0.0.1:${app.control}/ws`,{headers:{...headers,origin:`http://127.0.0.1:${app.control}`}});
  t.after(()=>ws.terminate());await once(ws,"open");
  const hello=once(ws,"message");ws.send(JSON.stringify({type:"hello",role:"controller"}));
  assert.equal(JSON.parse(String((await hello)[0])).type,"hello.ack");
  ws.send(JSON.stringify({type:"command",command:{id:"shutdown-ws-command",type:"display.clear",target:["tv1"],payload:{}}}));
  await waitFor(()=>app.output().includes("fixture-mqtt-started"),"pending WebSocket command");
  ws.terminate();await stop(app);
  const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});
  try{
    const entries=db.prepare("SELECT payload_json FROM audit_events WHERE kind='command'").all().map(row=>JSON.parse(row.payload_json));
    assert.ok(entries.some(entry=>entry.commandId==="shutdown-ws-command"&&entry.source==="websocket"),app.output());
  }finally{db.close()}
});
