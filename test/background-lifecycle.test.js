"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {DatabaseSync}=require("node:sqlite"),{setTimeout:delay}=require("node:timers/promises");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");
const fixture=name=>path.join(__dirname,`fixtures/${name}-lifecycle-work.cjs`);
function read(app,sql,...args){const db=new DatabaseSync(path.join(app.dir,"hub.db"),{readOnly:true});try{return db.prepare(sql).get(...args)}finally{db.close()}}
function preference(app,key){const row=read(app,"SELECT value_json FROM system_preferences WHERE key=?",key);return row?JSON.parse(row.value_json):null}
function auditCount(app,kind){return read(app,"SELECT count(*) AS count FROM audit_events WHERE kind=?",kind).count}
function release(app,name){fs.writeFileSync(path.join(app.dir,`release-${name}`),"")}
function internal(app,route,body){return fetch(`http://127.0.0.1:${app.control}/api/v1/internal/maintenance/${route}`,{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"},body:JSON.stringify(body)})}
async function freezeHeld(app){
  const promise=internal(app,"export-freeze",{confirm:"FREEZE_FULL_EXPORT"});
  await waitFor(async()=>{const r=await internal(app,"audit/prune",{confirm:false});await r.text();return r.status===423},"freeze admission lock");
  assert.equal(await Promise.race([promise.then(()=>"frozen"),delay(150).then(()=>"waiting")]),"waiting");
  return {promise};
}
async function thaw(app,promise){const r=await promise;assert.equal(r.status,200);const {freezeToken}=await r.json();const released=await internal(app,"export-thaw",{freezeToken});assert.equal(released.status,200);await released.text()}
async function shuttingDown(app){app.child.kill("SIGTERM");await waitFor(()=>app.output().includes("received; draining"),"shutdown admission");await delay(150);assert.equal(app.child.exitCode,null)}
async function stopped(app){assert.deepEqual(await app.exited,[0,null],app.output())}
async function stop(app){app.child.kill("SIGTERM");await stopped(app)}

for(const boundary of ["shutdown","freeze"])test(`scheduled Sports refresh persists its final result before ${boundary} completes`,{...linux,timeout:35000},async t=>{
  const app=await launch(t,{preload:fixture("sports")});
  // Let the real 15-second initial timer fire; no test-only scheduler shortcut.
  await delay(10000);await waitFor(()=>app.output().includes("fixture-sports-fetch-started"),"scheduled Sports fetch");
  assert.equal(preference(app,"sports.workspace.v1.sources"),null);
  const freeze=boundary==="freeze"?await freezeHeld(app):null;
  if(!freeze)await shuttingDown(app);
  release(app,"sports");
  if(freeze){const response=await freeze.promise;assert.equal(response.status,200)}else await stopped(app);
  const config=preference(app,"sports.workspace.v1"),sources=preference(app,"sports.workspace.v1.sources");
  assert.equal(config.events.length,1);assert.equal(config.events[0].score,1);assert.equal(sources["team:feed"].state,"ready");
  if(freeze){await thaw(app,freeze.promise);await stop(app)}
});

for(const boundary of ["shutdown","freeze"])test(`scheduled Ubuntu acknowledgment drains across ${boundary} without replay on restart`,linux,async t=>{
  const app=await launch(t,{preload:fixture("ubuntu")});
  await waitFor(()=>app.output().includes("fixture-ubuntu-dispatch-started"),"scheduled Ubuntu dispatch");
  assert.equal(preference(app,"ubuntu-displays.v1")[0].scheduled.state,"dispatched");
  assert.equal(auditCount(app,"ubuntu-display.maintenance"),0);
  const freeze=boundary==="freeze"?await freezeHeld(app):null;
  if(!freeze)await shuttingDown(app);
  release(app,"ubuntu");
  if(freeze){const response=await freeze.promise;assert.equal(response.status,200)}else await stopped(app);
  const record=preference(app,"ubuntu-displays.v1")[0];
  assert.equal(record.scheduled.state,"dispatched");
  assert.equal(record.history.find(e=>e.kind==="maintenance").jobId,"scheduled-fixture");
  if(freeze){assert.equal(auditCount(app,"ubuntu-display.maintenance"),0);await thaw(app,freeze.promise);await stop(app)}
  assert.equal(auditCount(app,"ubuntu-display.maintenance"),1);
  const restarted=await launch(t,{preload:fixture("ubuntu"),directory:app.dir});
  await waitFor(()=>restarted.output().includes("fixture-ubuntu-status"),"restarted fleet poll");
  await delay(150);await stop(restarted);
  assert.doesNotMatch(restarted.output(),/fixture-ubuntu-dispatch-started/);
  assert.equal(auditCount(restarted,"ubuntu-display.maintenance"),1);
});

async function presentationUpload(app){
  const setup=await fetch(`http://127.0.0.1:${app.control}/api/v1/setup/administrator`,{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"presentation-admin",password:"test-only-long-password"})});
  assert.equal(setup.status,201);await setup.text();const cookie=setup.headers.get("set-cookie").split(";",1)[0];
  const form=new FormData();form.append("presentation",new Blob(["%PDF-1.4\nfixture"],{type:"application/pdf"}),"Fixture.pdf");
  const upload=fetch(`http://127.0.0.1:${app.control}/api/v1/presentations/upload`,{method:"POST",headers:{cookie},body:form});
  // A deadline test deliberately loses its connection when the Hub exits.
  upload.catch(()=>{});
  return {upload,cookie};
}
for(const boundary of ["shutdown","freeze"])test(`presentation upload publishes assets and its final record before ${boundary} completes`,linux,async t=>{
  const app=await launch(t,{preload:fixture("presentation")}),{upload,cookie}=await presentationUpload(app);
  await waitFor(()=>app.output().includes("fixture-presentation-conversion-started"),"accepted conversion");
  const freeze=boundary==="freeze"?await freezeHeld(app):null;
  if(!freeze)await shuttingDown(app);
  assert.equal(auditCount(app,"presentation.upload"),0);release(app,"presentation");
  const response=await upload;assert.equal(response.status,200);const {presentation}=await response.json();
  if(freeze){assert.equal(auditCount(app,"presentation.upload"),0);await thaw(app,freeze.promise);await stop(app)}else await stopped(app);
  assert.equal(presentation.conversionStatus,"ready");assert.equal(presentation.slideCount,1);assert.equal(auditCount(app,"presentation.upload"),1);
  assert.equal(fs.readFileSync(path.join(app.dir,"presentations",presentation.id,"slides/slide-001.jpg"),"utf8"),"test-only-slide");
  assert.deepEqual(fs.readdirSync(path.join(app.dir,"presentation-upload-tmp")),[]);
  const restarted=await launch(t,{preload:fixture("presentation"),directory:app.dir});
  const library=await fetch(`http://127.0.0.1:${restarted.control}/api/v1/presentations`,{headers:{cookie}});
  assert.equal(library.status,200);const saved=await library.json();
  assert.equal(saved.presentations.find(p=>p.id===presentation.id).conversionStatus,"ready");await stop(restarted);
});

test("a conversion exceeding shutdown's deadline retains its source and recovers as rebuildable",linux,async t=>{
  const app=await launch(t,{preload:fixture("presentation")}),{upload,cookie}=await presentationUpload(app);
  await waitFor(()=>app.output().includes("fixture-presentation-conversion-started"),"accepted conversion");
  app.child.kill("SIGTERM");assert.deepEqual(await app.exited,[1,null],app.output());await assert.rejects(upload);
  assert.equal(auditCount(app,"presentation.upload"),0);assert.match(app.output(),/ten-second drain deadline/);
  assert.ok(fs.readdirSync(path.join(app.dir,"presentation-upload-tmp")).some(name=>name.startsWith("render-")),"deadline left conversion staging for startup recovery");
  const restarted=await launch(t,{preload:fixture("presentation"),directory:app.dir});
  assert.deepEqual(fs.readdirSync(path.join(app.dir,"presentation-upload-tmp")),[],"startup must reclaim interrupted render staging");
  const library=await fetch(`http://127.0.0.1:${restarted.control}/api/v1/presentations`,{headers:{cookie}});
  assert.equal(library.status,200);const {presentations}=await library.json();assert.equal(presentations.length,1);
  const saved=presentations[0];assert.equal(saved.conversionStatus,"failed");assert.match(saved.conversionError,/interrupted/);
  assert.equal(fs.readFileSync(path.join(app.dir,"presentations",saved.id,"original.pdf"),"utf8"),"%PDF-1.4\nfixture");
  release(restarted,"presentation");
  const rebuilt=await fetch(`http://127.0.0.1:${restarted.control}/api/v1/presentations/${saved.id}/rebuild`,{method:"POST",headers:{cookie}});
  assert.equal(rebuilt.status,200);assert.equal((await rebuilt.json()).presentation.conversionStatus,"ready");await stop(restarted);
});
