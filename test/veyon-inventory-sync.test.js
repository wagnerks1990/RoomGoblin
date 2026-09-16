"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {hostKey,identitySnapshot,reconciliationPlan,dedupeInventory}=require("../public/controller/veyon-inventory-sync");

test("Veyon inventory identity follows hostname instead of DHCP address",()=>{
  const before=[
    {id:"192.0.2.10",ip:"192.0.2.10",hostname:"STUDENT-01",name:"STUDENT-01",role:"student",online:true},
    {id:"192.0.2.11",ip:"192.0.2.11",hostname:"STUDENT-02",name:"Teacher Desk",role:"teacher",online:true}
  ];
  const identity=identitySnapshot(before,{});
  const discovered=[
    {id:"192.0.2.11",ip:"192.0.2.11",hostname:"STUDENT-01",name:"Teacher Desk",role:"teacher",online:true},
    {id:"192.0.2.10",ip:"192.0.2.10",hostname:"STUDENT-02",name:"STUDENT-01",role:"student",online:true}
  ];
  assert.deepEqual(reconciliationPlan(identity,discovered),[
    {id:"192.0.2.11",hostname:"student-01",patch:{role:"student",name:"STUDENT-01"}},
    {id:"192.0.2.10",hostname:"student-02",patch:{role:"teacher",name:"Teacher Desk"}}
  ]);
});

test("cached hostname identity survives status refresh observing a lease swap before discovery",()=>{
  const cached={
    "student-01":{id:"192.0.2.10",hostname:"STUDENT-01",name:"Seat 1",role:"student"},
    "student-02":{id:"192.0.2.11",hostname:"STUDENT-02",name:"Instructor",role:"teacher"}
  };
  const alreadyObserved=[
    {id:"192.0.2.10",ip:"192.0.2.10",hostname:"STUDENT-02",name:"Seat 1",role:"student"},
    {id:"192.0.2.11",ip:"192.0.2.11",hostname:"STUDENT-01",name:"Instructor",role:"teacher"}
  ];
  const identity=identitySnapshot(alreadyObserved,cached);
  assert.equal(identity["student-01"].id,"192.0.2.10");
  assert.equal(identity["student-01"].name,"Seat 1");
  assert.equal(identity["student-02"].id,"192.0.2.11");
  assert.equal(identity["student-02"].role,"teacher");
  assert.deepEqual(reconciliationPlan(identity,alreadyObserved),[
    {id:"192.0.2.10",hostname:"student-02",patch:{role:"teacher",name:"Instructor"}},
    {id:"192.0.2.11",hostname:"student-01",patch:{role:"student",name:"Seat 1"}}
  ]);
});

test("hostname normalization rejects raw IP addresses and ignores case/trailing dots",()=>{
  assert.equal(hostKey({hostname:"STUDENT-01."}),"student-01");
  assert.equal(hostKey({hostname:"student-01"}),"student-01");
  assert.equal(hostKey({hostname:"192.0.2.10"}),"");
});

test("client inventory hides only an offline duplicate when the same hostname has one online record",()=>{
  const rows=[
    {id:"old",hostname:"STUDENT-01",online:false},
    {id:"new",hostname:"student-01",online:true},
    {id:"other",hostname:"STUDENT-02",online:false}
  ];
  assert.deepEqual(dedupeInventory(rows).map(row=>row.id),["new","other"]);
});

test("duplicate hostnames are preserved when more than one record is online",()=>{
  const rows=[
    {id:"a",hostname:"DUPLICATE",online:true},
    {id:"b",hostname:"duplicate",online:true}
  ];
  assert.deepEqual(dedupeInventory(rows).map(row=>row.id),["a","b"]);
});

test("browser discovery no longer writes DHCP identity patches",()=>{
  const source=fs.readFileSync("public/controller/veyon-inventory-sync.js","utf8");
  const start=source.indexOf("async function runDiscovery");
  const end=source.indexOf("const refresh=",start);
  const region=source.slice(start,end);
  assert.match(region,/\/api\/v1\/veyon\/status/);
  assert.match(region,/scan subnet prefix is configured/);
  assert.match(region,/\/api\/v1\/veyon\/discover/);
  assert.doesNotMatch(region,/method:'PUT'/);
  assert.doesNotMatch(region,/reconciliationPlan\(/);
});
