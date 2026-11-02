"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {EventEmitter,once}=require("node:events");
const {createMediaPlaneSupervisor}=require("../src/media-plane-process");

function fixture(options={}){
  const child=new EventEmitter(),owner=new EventEmitter(),signals=[],exits=[],messages=[];
  child.pid=123; // A running test-owned process identity; kill remains a fake.
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

for(const [code,signal] of [[null,"SIGKILL"],[0,null]])test(`forced media stop fails after reaping even with exit ${signal??code}`,async()=>{
  const f=fixture({gracefulTimeoutMs:10});
  const pending=f.supervisor.stop();
  const failed=assert.rejects(pending,/forced termination/);
  let settled=false;pending.then(()=>{settled=true},()=>{settled=true});
  const keepAlive=setTimeout(()=>{},1000);
  try{
    const [sent]=await once(f.child,"signal");assert.equal(sent,"SIGKILL");
    assert.equal(settled,false,"sending SIGKILL is not proof of child exit");
    f.child.emit("exit",code,signal);await failed;
    assert.deepEqual(f.signals,["SIGTERM","SIGKILL"]);assert.deepEqual(f.exits,[]);
  }finally{clearTimeout(keepAlive)}
});

for(const [code,signal] of [[2,null],[null,"SIGTERM"]])test(`media stop reports unsuccessful child exit ${signal??code}`,async()=>{
  const f=fixture(),pending=f.supervisor.stop();
  const failed=assert.rejects(pending,new RegExp(`shutdown failed.*${signal??code}`));
  f.child.emit("exit",code,signal);await failed;
  assert.equal(f.supervisor.stop(),pending);assert.deepEqual(f.exits,[]);
  assert.equal(f.owner.listenerCount("exit"),0);
});

for(const mode of ["event","throw"])test(`signaling error (${mode}) retains child ownership until exit`,async()=>{
  const f=fixture({gracefulTimeoutMs:10});
  f.child.kill=signal=>{
    f.signals.push(signal);
    if(signal==="SIGTERM"){
      const error=Error("signal denied");
      if(mode==="throw")throw error;
      f.child.emit("error",error);return false;
    }
    f.child.emit("signal",signal);return true;
  };
  const pending=f.supervisor.stop(),failed=assert.rejects(pending,/signal denied/);
  let settled=false;pending.then(()=>{settled=true},()=>{settled=true});
  const keepAlive=setTimeout(()=>{},1000);
  try{
    await Promise.resolve();assert.equal(settled,false);
    assert.equal(f.owner.listenerCount("exit"),1,"a signaling error does not prove the child exited");
    const [signal]=await once(f.child,"signal");assert.equal(signal,"SIGKILL");
    f.child.emit("exit",null,"SIGKILL");await failed;
    assert.equal(f.owner.listenerCount("exit"),0);
  }finally{clearTimeout(keepAlive)}
});

test("even a clean unexpected media exit fails the application",()=>{
  const f=fixture();f.child.emit("exit",0,null);
  assert.deepEqual(f.exits,[1]);assert.match(f.messages.join("\n"),/status: 0/);
  assert.equal(f.owner.listenerCount("exit"),0);
});

test("media spawn errors fail the application without leaking exit listeners",()=>{
  const f=fixture();delete f.child.pid;f.child.emit("error",new Error("spawn failed"));
  assert.deepEqual(f.exits,[1]);assert.match(f.messages.join("\n"),/failed to start/);
  assert.equal(f.owner.listenerCount("exit"),0);
});

test("an unexpected running-child error retains the abrupt-owner kill fallback",()=>{
  const f=fixture();f.child.emit("error",new Error("child failure"));
  assert.deepEqual(f.exits,[1]);assert.deepEqual(f.signals,["SIGKILL"]);
  assert.match(f.messages.join("\n"),/child failure/);
});

test("an abrupt owner exit synchronously terminates its media child",()=>{
  const f=fixture();f.owner.emit("exit",1);
  assert.deepEqual(f.signals,["SIGKILL"]);
});

test("control-only test entry points can stop without a media child",async()=>{
  const supervisor=createMediaPlaneSupervisor();await supervisor.stop();
});
