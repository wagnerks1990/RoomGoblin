"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),{EventEmitter}=require("node:events"),{PassThrough}=require("node:stream");
const {ESPHomeManager}=require("../src/esphome");
function fixture(t){const child=new EventEmitter();child.stdout=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{child.killed=true};const manager=new ESPHomeManager({storage:{getPreference:()=>[]},autostart:false,spawnProcess:()=>child});t.after(()=>manager.close());return{child,manager}}
test("non-object IPC fails the worker without escaping into the Hub",async t=>{
 const h=fixture(t),pending=h.manager.rpc("probe",{});const rejected=assert.rejects(pending,/not be replayed/);assert.doesNotThrow(()=>h.child.stdout.write("null\n"));assert.equal(h.manager.pending.size,0);await rejected;
});
test("synchronous stdin failure releases every pending RPC immediately",async t=>{
 const h=fixture(t);h.child.stdin.write=()=>{throw Error("write failed")};await assert.rejects(h.manager.rpc("probe",{}));assert.equal(h.manager.pending.size,0);assert.equal(h.manager.child,null);
});
test("a second child error after failure stays contained",async t=>{
 const h=fixture(t),pending=h.manager.rpc("probe",{});const rejected=assert.rejects(pending,/not be replayed/);h.child.emit("error",Error("first"));await rejected;assert.doesNotThrow(()=>h.child.emit("error",Error("late")));
});


test("worker stdout errors are contained and release pending RPCs",async t=>{
 const h=fixture(t),pending=h.manager.rpc("probe",{}),rejected=assert.rejects(pending,/not be replayed/);
 assert.doesNotThrow(()=>h.child.stdout.emit("error",Error("pipe failed")));await rejected;
});
test("discovery waits for stdout completion after process exit",async t=>{
 const h=fixture(t);let settled=false;const pending=h.manager.discover({force:true});pending.then(()=>settled=true,()=>settled=true);h.child.stdout.write('{"devices":[');h.child.emit("exit",0);await Promise.resolve();
 assert.equal(settled,false);h.child.stdout.write('{"name":"Fixture","addresses":["10.200.0.8"]}]}');h.child.emit("close",0);const result=await pending;assert.equal(result.devices.length,1);
});
test("discovery stdout errors are contained",async t=>{
 const h=fixture(t),pending=h.manager.discover({force:true});pending.catch(()=>{});assert.doesNotThrow(()=>h.child.stdout.emit("error",Error("pipe failed")));
 h.child.emit("close",1);await assert.rejects(pending);
});

for(const value of [false,42,"text",[]])test(`worker rejects non-object IPC ${JSON.stringify(value)} without retaining owners`,async t=>{
 const h=fixture(t),pending=h.manager.rpc("command",{}),rejected=assert.rejects(pending,/not be replayed/);
 assert.doesNotThrow(()=>h.child.stdout.write(JSON.stringify(value)+"\n"));await rejected;assert.equal(h.manager.pending.size,0);assert.equal(h.manager.child,null);assert.equal(h.child.killed,true);
});
test("a synchronous pipe failure settles existing RPCs as uncertain without exposing its raw error",async t=>{
 const h=fixture(t),first=h.manager.rpc("probe",{}),rejected=assert.rejects(first,/not be replayed/);
 h.child.stdin.write=()=>{throw Error("private upstream detail")};await assert.rejects(h.manager.rpc("command",{}),error=>/not be replayed/.test(error.message)&&!error.message.includes("private upstream detail"));await rejected;
 assert.equal(h.manager.pending.size,0);assert.equal(h.manager.workerFailures,1);
});
test("late errors from a failed child cannot fail a replacement worker",async t=>{
 const h=fixture(t),first=h.manager.rpc("probe",{}),rejected=assert.rejects(first,/not be replayed/);h.child.emit("error",Error("first"));await rejected;
 const next=new EventEmitter();next.stdout=new PassThrough();next.stdin=new PassThrough();next.kill=()=>{next.killed=true};h.manager.nextWorkerAt=0;h.manager.spawnProcess=()=>next;
 const second=h.manager.rpc("probe",{});assert.doesNotThrow(()=>{h.child.emit("error",Error("late"));h.child.stdout.emit("error",Error("late pipe"));h.child.emit("exit",1)});
 assert.equal(h.manager.child,next);assert.equal(h.manager.pending.size,1);next.stdout.write('{"requestId":"2","ok":true}\n');assert.equal((await second).ok,true);assert.equal(next.killed,undefined);
});
test("valid worker replies settle once and unknown late responses do not affect current RPCs",async t=>{
 const h=fixture(t),first=h.manager.rpc("probe",{});h.child.stdout.write('{"requestId":"1","ok":true}\n');await first;const second=h.manager.rpc("probe",{});
 h.child.stdout.write('{"requestId":"1","ok":true}\n');assert.equal(h.manager.pending.size,1);h.child.stdout.write('{"requestId":"2","ok":true}\n');await second;assert.equal(h.manager.pending.size,0);
});
test("worker stream and process errors settle once without multiplying restart backoff",async t=>{
 const h=fixture(t),pending=h.manager.rpc("probe",{}),rejected=assert.rejects(pending,/not be replayed/);
 h.child.stdout.emit("error",Error("first"));h.child.stdin.emit("error",Error("late"));h.child.emit("error",Error("late process"));h.child.emit("exit",1);await rejected;assert.equal(h.manager.workerFailures,1);
});
test("discovery process errors are contained once and retain no cached success",async t=>{
 const h=fixture(t),pending=h.manager.discover({force:true}),rejected=assert.rejects(pending,{status:503});
 assert.doesNotThrow(()=>{h.child.emit("error",Error("start"));h.child.emit("error",Error("late"));h.child.stdout.emit("error",Error("late pipe"));h.child.emit("close",1)});await rejected;
 assert.equal(h.manager.discoveryPromise,null);assert.equal(h.manager.discoveryCache.at,0);assert.equal(h.child.killed,true);
});
test("late discovery output and errors cannot replace an already completed scan",async t=>{
 const h=fixture(t),pending=h.manager.discover({force:true});h.child.stdout.write('{"devices":[]}');h.child.emit("close",0);await pending;const cache=h.manager.discoveryCache;
 assert.doesNotThrow(()=>{h.child.emit("error",Error("late"));h.child.stdout.emit("error",Error("late"));h.child.stdout.write("x".repeat(1024*1024+1));h.child.emit("close",1)});
 assert.equal(h.manager.discoveryCache,cache);assert.equal(h.child.killed,undefined);
});
test("discovery nonzero close rejects complete-looking output",async t=>{
 const h=fixture(t),pending=h.manager.discover({force:true});h.child.stdout.write('{"devices":[]}');h.child.emit("exit",1);h.child.emit("close",1);await assert.rejects(pending,{status:502});assert.equal(h.manager.discoveryCache.at,0);
});
test("oversized discovery output kills the child and late close cannot publish a cache",async t=>{
 const h=fixture(t),pending=h.manager.discover({force:true});h.child.stdout.write("x".repeat(1024*1024+1));h.child.emit("close",0);await assert.rejects(pending,{status:502});assert.equal(h.child.killed,true);assert.equal(h.manager.discoveryCache.at,0);
});
test("accepted discovery drains after manager close while new discovery is rejected",async t=>{
 const h=fixture(t),pending=h.manager.discover({force:true});h.manager.close();await assert.rejects(h.manager.discover(),{status:423});
 assert.equal(h.child.killed,undefined);h.child.stdout.write('{"devices":[]}');h.child.emit("close",0);assert.equal((await pending).ok,true);assert.equal(h.manager.discoveryPromise,null);
});
test("discovery parses a real child stdout stream after closure without network access",{timeout:10000},async t=>{
 const {spawn}=require("node:child_process");let child;
 const manager=new ESPHomeManager({storage:{getPreference:()=>[]},autostart:false,spawnProcess:()=>child=spawn(process.execPath,["-e","process.stdout.write(JSON.stringify({devices:Array.from({length:180},(_,i)=>({name:'Fixture '+i,addresses:['10.200.0.8'],port:6053}))}))"],{stdio:["ignore","pipe","ignore"]})});
 t.after(()=>{manager.close();if(child&&!child.killed)child.kill()});const result=await manager.discover({force:true});assert.equal(result.devices.length,128);assert.equal(result.devices[0].name,"Fixture 0");assert.equal(manager.discoveryPromise,null);
});
