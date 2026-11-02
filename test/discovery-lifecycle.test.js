"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {DatabaseSync}=require("node:sqlite"),{setTimeout:delay}=require("node:timers/promises");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");
const preload=path.join(__dirname,"fixtures/esphome-discovery-work.cjs");
const maintenance={"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"};
function request(app,route,body){return fetch(`http://127.0.0.1:${app.control}/api/v1/internal/maintenance/${route}`,{method:"POST",headers:maintenance,body:JSON.stringify(body)})}
async function administrator(app){
  const r=await fetch(`http://127.0.0.1:${app.control}/api/v1/setup/administrator`,{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"discovery-admin",password:"test-only-long-password"})});
  assert.equal(r.status,201);await r.text();return {cookie:r.headers.get("set-cookie").split(";",1)[0]};
}
function discover(app,headers,force=false){return fetch(`http://127.0.0.1:${app.control}/api/v1/esphome/discovery${force?"?force=1":""}`,{headers})}
function auditCount(app){
  const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});
  try{return db.prepare("SELECT count(*) AS count FROM audit_events WHERE kind='esphome.discover'").get().count}finally{db.close()}
}
function release(app){fs.writeFileSync(path.join(app.dir,"release-discovery"),"")}
async function thaw(app,freezeToken){const r=await request(app,"export-thaw",{freezeToken});assert.equal(r.status,200);await r.text()}
async function stop(app){app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output())}

test("an active Full Recovery freeze rejects new and cached discovery instead of admitting more work",linux,async t=>{
  const app=await launch(t,{preload}),headers=await administrator(app);release(app);
  let frozen=await request(app,"export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);
  let {freezeToken}=await frozen.json();
  const first=await discover(app,headers);await first.text();
  assert.equal(auditCount(app),0,"discovery cannot append an audit record inside a frozen snapshot");
  assert.equal(first.status,423);assert.doesNotMatch(app.output(),/fixture-esphome-discovery-started/);
  await thaw(app,freezeToken);
  assert.equal(auditCount(app),0,"a rejected discovery must not queue a later success audit");
  const scan=await discover(app,headers);assert.equal(scan.status,200);assert.equal((await scan.json()).cached,false);assert.equal(auditCount(app),1);
  frozen=await request(app,"export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(frozen.status,200);({freezeToken}=await frozen.json());
  for(const force of [false,true]){const r=await discover(app,headers,force);await r.text();assert.equal(r.status,423);assert.equal(auditCount(app),1)}
  await thaw(app,freezeToken);
  const cached=await discover(app,headers);assert.equal(cached.status,200);assert.equal((await cached.json()).cached,true);assert.equal(auditCount(app),2);
  assert.equal(app.output().split("fixture-esphome-discovery-started").length-1,1);await stop(app);
});

test("Full Recovery waits for accepted discovery and flushes its deferred audit after thaw",linux,async t=>{
  const app=await launch(t,{preload}),headers=await administrator(app);
  const scan=discover(app,headers);
  await waitFor(()=>app.output().includes("fixture-esphome-discovery-started"),"discovery worker entry");
  const freeze=request(app,"export-freeze",{confirm:"FREEZE_FULL_EXPORT"});
  await waitFor(async()=>{const r=await request(app,"audit/prune",{confirm:false});await r.text();return r.status===423},"freeze admission lock");
  assert.equal(await Promise.race([freeze.then(()=>"frozen"),delay(150).then(()=>"waiting")]),"waiting");
  assert.equal(auditCount(app),0);release(app);
  const result=await scan;assert.equal(result.status,200);await result.text();
  const frozen=await freeze;assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
  assert.equal(auditCount(app),0,"the existing freeze policy defers audit persistence");
  await thaw(app,freezeToken);assert.equal(auditCount(app),1);await stop(app);
});

test("shutdown drains accepted discovery and preserves its final audit",linux,async t=>{
  const app=await launch(t,{preload}),headers=await administrator(app);
  const scan=discover(app,headers);
  await waitFor(()=>app.output().includes("fixture-esphome-discovery-started"),"discovery worker entry");
  app.child.kill("SIGTERM");await waitFor(()=>app.output().includes("received; draining"),"shutdown admission");
  await delay(150);assert.equal(app.child.exitCode,null);assert.equal(auditCount(app),0);release(app);
  const result=await scan;assert.equal(result.status,200);await result.text();
  assert.deepEqual(await app.exited,[0,null],app.output());assert.equal(auditCount(app),1);
});
