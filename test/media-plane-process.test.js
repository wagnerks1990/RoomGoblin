"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter,once}=require("node:events");
const {createMediaPlaneSupervisor}=require("../src/media-plane-process");

function fixture(options={}){
  const child=new EventEmitter(),owner=new EventEmitter(),signals=[],exits=[],messages=[];
  child.kill=signal=>{signals.push(signal);child.emit("signal",signal);return true};
  owner.exit=code=>{exits.push(code);owner.emit("exit",code)};
  const supervisor=createMediaPlaneSupervisor({spawnProcess:()=>child,owner,report:message=>messages.push(message),...options});
  supervisor.start();
  return {supervisor,child,owner,signals,exits,messages};
}

test("media stop is idempotent and waits for the actual child exit",async()=>{
  const f=fixture();let stopped=false;
  const pending=f.supervisor.stop();pending.then(()=>{stopped=true});
  assert.equal(f.supervisor.stop(),pending);
  await Promise.resolve();assert.equal(stopped,false);
  assert.deepEqual(f.signals,["SIGTERM"]);
  f.child.emit("exit",0,null);await pending;
  assert.equal(stopped,true);assert.deepEqual(f.exits,[]);
  assert.equal(f.owner.listenerCount("exit"),0);
});

test("media stop escalates a stuck child and still waits for reaping",async()=>{
  const f=fixture({gracefulTimeoutMs:10});
  const pending=f.supervisor.stop();
  const keepAlive=setTimeout(()=>{},1000);
  try{
    const [signal]=await once(f.child,"signal");assert.equal(signal,"SIGKILL");
    f.child.emit("exit",null,"SIGKILL");await pending;
    assert.deepEqual(f.signals,["SIGTERM","SIGKILL"]);assert.deepEqual(f.exits,[]);
  }finally{clearTimeout(keepAlive)}
});

test("even a clean unexpected media exit fails the application",()=>{
  const f=fixture();f.child.emit("exit",0,null);
  assert.deepEqual(f.exits,[1]);assert.match(f.messages.join("\n"),/status: 0/);
  assert.equal(f.owner.listenerCount("exit"),0);
});

test("media spawn errors fail the application without leaking exit listeners",()=>{
  const f=fixture();f.child.emit("error",new Error("spawn failed"));
  assert.deepEqual(f.exits,[1]);assert.match(f.messages.join("\n"),/failed to start/);
  assert.equal(f.owner.listenerCount("exit"),0);
});

test("an abrupt owner exit synchronously terminates its media child",()=>{
  const f=fixture();f.owner.emit("exit",1);
  assert.deepEqual(f.signals,["SIGKILL"]);
});

test("control-only test entry points can stop without a media child",async()=>{
  const supervisor=createMediaPlaneSupervisor();await supervisor.stop();
});
