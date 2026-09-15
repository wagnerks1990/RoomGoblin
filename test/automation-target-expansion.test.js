"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {expandTvTargets}=require("../src/automation-runtime");

test("All TVs uses physical TV inventory rather than content display inventory",()=>{
  const topology={tvs:Object.fromEntries(Array.from({length:8},(_,i)=>[`physical-${i+1}`,{id:`physical-${i+1}`,enabled:true,transport:{adapter:"pluto",connection:"hdbt",output:i+1}}]))};
  const devices={display1:{enabled:true,avOutput:1},display2:{enabled:true,avOutput:2},display3:{enabled:true,avOutput:3}};
  assert.deepEqual(expandTvTargets(["all"],{topology,devices}),Array.from({length:8},(_,i)=>({id:`physical-${i+1}`,output:i+1,connection:"hdbt"})));
});

test("legacy systems still expand all eight physical outputs until topology migration completes",()=>{
  const devices={tv1:{enabled:true,avOutput:1},tv2:{enabled:true,avOutput:2},tv3:{enabled:true,avOutput:3}};
  assert.deepEqual(expandTvTargets(["all"],{devices}),Array.from({length:8},(_,i)=>({id:`tv${i+1}`,output:i+1,connection:"hdbt"})));
});

test("typed TV groups resolve independently of display groups",()=>{
  const topology={
    tvs:{front:{enabled:true,transport:{output:1,connection:"hdbt"}},rear:{enabled:true,transport:{output:8,connection:"hdbt"}}},
    groups:{pair:{type:"tv",members:["front","rear"]},displaypair:{type:"display",members:["front","rear"]}}
  };
  assert.deepEqual(expandTvTargets(["pair"],{topology}),[{id:"front",output:1,connection:"hdbt"},{id:"rear",output:8,connection:"hdbt"}]);
  assert.deepEqual(expandTvTargets(["displaypair"],{topology}),[]);
});

test("transport selectors preserve topology output count rather than assuming display count",()=>{
  const topology={tvs:{a:{enabled:true,transport:{output:2,connection:"hdbt"}},b:{enabled:true,transport:{output:11,connection:"hdbt"}}}};
  assert.deepEqual(expandTvTargets(["hdmi-all"],{topology}),[{id:"a",output:2,connection:"hdmi"},{id:"b",output:11,connection:"hdmi"}]);
});
