"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const net=require("node:net");
const {once}=require("node:events");
const {setTimeout:delay}=require("node:timers/promises");

const root=path.resolve(__dirname,"..");
const start=require("../package.json").scripts.start;
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");

test("npm start and the container execute the same bootstrap",()=>{
  const launcher=fs.readFileSync(path.join(root,"tools/start-roomgoblin.sh"),"utf8");
  assert.equal(start,launcher.match(/^exec (.+)$/m)[1].trim());
});

test("canonical shutdown reports the media drain deadline and reaps the failed child",linux,async t=>{
  const app=await launch(t);
  let response=await fetch(`http://127.0.0.1:${app.control}/api/v1/internal/maintenance/config`);
  assert.equal(response.status,401);await response.arrayBuffer();
  response=await fetch(`http://127.0.0.1:${app.control}/api/v1/internal/maintenance/config`,{headers:{"x-maintenance-token":"lifecycle-test-maintenance"}});
  assert.equal(response.status,200);await response.arrayBuffer();
  // An incomplete HTTP request keeps the child's listener draining until its
  // own deadline, exposing a parent that exits before waiting for the child.
  const socket=net.connect(app.media,"127.0.0.1");socket.on("error",()=>{});t.after(()=>socket.destroy());
  await once(socket,"connect");socket.write("GET /health HTTP/1.1\r\n");await delay(60);
  app.child.kill("SIGTERM");
  const [code,signal]=await app.exited;
  assert.equal(code,1,app.output());assert.equal(signal,null);
  assert.match(app.output(),/media plane shutdown failed.*1/);
  assert.throws(()=>process.kill(app.mediaPid,0),{code:"ESRCH"},"media child must be reaped before the parent exits");
});

test("canonical shutdown succeeds after an active media connection drains normally",linux,async t=>{
  const app=await launch(t);
  const socket=net.connect(app.media,"127.0.0.1");socket.on("error",()=>{});t.after(()=>socket.destroy());
  await once(socket,"connect");socket.write("GET /health HTTP/1.1\r\n");await delay(60);
  app.child.kill("SIGTERM");await waitFor(()=>app.output().includes("received; draining"),"shutdown admission");
  await delay(100);assert.equal(app.child.exitCode,null,"shutdown still owns the active media connection");
  socket.destroy();assert.deepEqual(await app.exited,[0,null],app.output());
  assert.throws(()=>process.kill(app.mediaPid,0),{code:"ESRCH"});
});

test("unexpected media process death fails the canonical application",linux,async t=>{
  const app=await launch(t);process.kill(app.mediaPid,"SIGKILL");
  const [code,signal]=await app.exited;
  assert.equal(code,1,app.output());assert.equal(signal,null);
});
