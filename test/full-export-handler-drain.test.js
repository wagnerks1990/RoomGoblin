"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {setTimeout:delay}=require("node:timers/promises"),{DatabaseSync}=require("node:sqlite");
const {once}=require("node:events");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");
const preload=path.join(__dirname,"fixtures/export-writer.cjs");
const headers={"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"};
function request(app,route,body){return fetch(`http://127.0.0.1:${app.control}/api/v1/internal/maintenance/${route}`,{method:"POST",headers,body:JSON.stringify(body)})}
function completed(app){
  const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});
  try{return db.prepare("SELECT value_json FROM system_preferences WHERE key='export.fixture.completed'").get()?.value_json}finally{db.close()}
}

for(const mode of ["disconnect","response-finish","rejection"])test(`Full Recovery freeze retains HTTP writer ownership after ${mode}`,linux,async t=>{
  const app=await launch(t,{preload});
  const req=http.request(`http://127.0.0.1:${app.control}/fixture/export-write?early=${mode!=="disconnect"}&reject=${mode==="rejection"}`,{method:"POST"});
  req.on("error",()=>{});req.on("response",res=>res.resume());req.end();
  t.after(()=>req.destroy());
  await waitFor(()=>app.output().includes("fixture-export-writer-started"),"writer entry");
  if(mode==="disconnect")req.destroy();
  const freeze=request(app,"export-freeze",{confirm:"FREEZE_FULL_EXPORT"});
  await waitFor(async()=>{const r=await request(app,"audit/prune",{confirm:false});await r.text();return r.status===423},"freeze admission lock");
  assert.equal(await Promise.race([freeze.then(()=>"released"),delay(200).then(()=>"waiting")]),"waiting","freeze must not acknowledge a snapshot while the accepted handler can still write");
  assert.equal(completed(app),undefined);
  fs.writeFileSync(path.join(app.dir,"release-writer"),"");
  const response=await freeze;assert.equal(response.status,200,app.output());
  const {freezeToken}=await response.json();
  assert.equal(completed(app),"true","the snapshot boundary includes the final SQLite write");
  let thaw=await request(app,"export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();
  thaw=await request(app,"export-thaw",{freezeToken});assert.equal(thaw.status,409);await thaw.text();
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});

test("a stuck HTTP writer fails freeze acquisition without issuing a token or losing later writes",{...linux,timeout:40000},async t=>{
  const app=await launch(t,{preload});
  await (await fetch(`http://127.0.0.1:${app.control}/fixture/export-write?early=true`,{method:"POST"})).text();
  const response=await request(app,"export-freeze",{confirm:"FREEZE_FULL_EXPORT"});
  assert.equal(response.status,503);const result=await response.json();
  assert.match(result.error,/Timed out waiting for active application mutations/);assert.equal(result.freezeToken,undefined);
  let probe=await request(app,"audit/prune",{confirm:false});assert.equal(probe.status,400);await probe.text();
  fs.writeFileSync(path.join(app.dir,"release-writer"),"");await waitFor(()=>completed(app)==="true","late writer completion");
  probe=await request(app,"export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(probe.status,200);
  const {freezeToken}=await probe.json();probe=await request(app,"export-thaw",{freezeToken});assert.equal(probe.status,200);await probe.text();
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});

test("the administrator export proxy can acquire and thaw its own freeze without deadlock",linux,async t=>{
  let app,upstreamError;
  const upstream=http.createServer(async(req,res)=>{
    res.setHeader("Content-Type","text/plain; charset=utf-8");
    try{
      assert.equal(req.url,"/backup/create");assert.equal(req.headers["x-maintenance-token"],headers["x-maintenance-token"]);
      req.resume();
      const frozen=await request(app,"export-freeze",{confirm:"FREEZE_FULL_EXPORT"});
      assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();
      const thawed=await request(app,"export-thaw",{freezeToken});assert.equal(thawed.status,200);await thawed.text();
      res.end("export completed");
    }catch(error){upstreamError=error;res.statusCode=500;res.end("Fixture request failed")}
  });
  upstream.listen(0,"127.0.0.1");await once(upstream,"listening");
  t.after(()=>{upstream.closeAllConnections();upstream.close()});
  app=await launch(t,{maintenanceUrl:`http://127.0.0.1:${upstream.address().port}`});
  const base=`http://127.0.0.1:${app.control}`;
  const admin=await fetch(base+"/api/v1/setup/administrator",{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"export-admin",password:"test-only-long-password"})});
  assert.equal(admin.status,201);await admin.text();
  const result=await fetch(base+"/api/v1/maintenance/backup/create",{method:"POST",headers:{"content-type":"application/json",cookie:admin.headers.get("set-cookie").split(";",1)[0]},body:JSON.stringify({scope:"full"}),signal:AbortSignal.timeout(5000)});
  assert.ifError(upstreamError);assert.equal(result.status,200);assert.equal(await result.text(),"export completed");
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[0,null],app.output());
});
