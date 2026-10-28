"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {waitFor}=require("./helpers/lifecycle-process.cjs");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{EventEmitter,once}=require("node:events");
const source=fs.readFileSync(path.join(__dirname,"helpers/lifecycle-process.cjs"),"utf8");

function allocator(failSecond=false){
  const occupied=new Set();let created=0;
  const net={createServer(){const server=new EventEmitter(),number=++created;let bound;
    server.listen=()=>{if(failSecond&&number===2){queueMicrotask(()=>server.emit("error",Error("fixture listen failure")));return server}
      bound=41000;while(occupied.has(bound))bound++;occupied.add(bound);queueMicrotask(()=>server.emit("listening"));return server};
    server.address=()=>({port:bound});server.close=callback=>{occupied.delete(bound);queueMicrotask(callback);return server};return server;
  }};
  const ctx=vm.createContext({net,once});
  vm.runInContext(source.slice(source.indexOf("async function port"),source.indexOf("async function waitFor")),ctx);
  const allocation=source.match(/  const (?:control|\[control)[^\n]+/)[0];
  return {occupied,run:()=>vm.runInContext(`(async()=>{${allocation}return [control,media]})()`,ctx)};
}

test("lifecycle listeners retain separate reservations even when the OS reuses released ports",async()=>{
  const h=allocator(),ports=await h.run();assert.notEqual(ports[0],ports[1]);assert.equal(h.occupied.size,0);
});
test("lifecycle port reservation failures release every test-owned listener",async()=>{
  const h=allocator(true);await assert.rejects(h.run(),/fixture listen failure/);assert.equal(h.occupied.size,0);
});
function healthy(response){
  const ctx=vm.createContext({fetch:async()=>response,AbortSignal});
  vm.runInContext(source.slice(source.indexOf("  const healthy="),source.indexOf("  await waitFor(async()=>"))+"globalThis.check=healthy;",ctx);return ctx.check;
}
test("lifecycle readiness rejects the media listener on the control port",async()=>{
  const check=healthy({ok:true,json:async()=>({ok:true,service:"roomgoblin-media-plane"}),arrayBuffer:async()=>new ArrayBuffer(0)});
  assert.equal(await check(41000,"classroom-hub-backend"),false);
});
test("lifecycle readiness accepts only a healthy expected service",async()=>{
  for(const service of ["classroom-hub-backend","roomgoblin-media-plane"]){
    assert.equal(await healthy({ok:true,json:async()=>({ok:true,service}),arrayBuffer:async()=>new ArrayBuffer(0)})(41000,service),true);
    assert.equal(await healthy({ok:false,json:async()=>({ok:false,service}),arrayBuffer:async()=>new ArrayBuffer(0)})(41000,service),false);
  }
});

test("lifecycle readiness budgets survive wall-clock corrections",async()=>{
  const original=Date.now;
  let clock=original(),checks=0;
  Date.now=()=>{clock+=20000;return clock};
  try{
    await waitFor(()=>++checks===3,"fixture readiness");
    assert.equal(checks,3);
  }finally{Date.now=original}
});
