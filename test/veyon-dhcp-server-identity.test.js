"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {reconcileMappings,projectRows,resolveBackendId,stableIdForBackend,stableIdForHostname}=require("../src/veyon-inventory-identity");
const {VeyonKeyring,HOST_KEY_PREF}=require("../src/veyon-keyring");

function row(id,ip,hostname,extra={}){return {id,ip,hostname,name:hostname,role:"student",online:true,authenticated:true,...extra}}

test("same Veyon hostname keeps a stable GUI id when DHCP changes its address",()=>{
  const first=reconcileMappings({},[row("192.0.2.10","192.0.2.10","STUDENT-01")],{now:"2026-01-01T00:00:00.000Z"});
  const stable=stableIdForHostname("student-01");
  assert.equal(projectRows(first.mapping,[row("192.0.2.10","192.0.2.10","STUDENT-01")])[0].id,stable);
  const second=reconcileMappings(first.mapping,[row("192.0.2.44","192.0.2.44","student-01")],{now:"2026-01-01T00:01:00.000Z"});
  assert.equal(second.moves.length,1);
  assert.deepEqual(second.moves[0],{hostname:"student-01",stableId:stable,fromIp:"192.0.2.10",toIp:"192.0.2.44",fromBackendId:"192.0.2.10",toBackendId:"192.0.2.44"});
  const projected=projectRows(second.mapping,[row("192.0.2.44","192.0.2.44","STUDENT-01")]);
  assert.equal(projected[0].id,stable);
  assert.equal(resolveBackendId(second.mapping,stable),"192.0.2.44");
  assert.equal(stableIdForBackend(second.mapping,"192.0.2.44"),stable);
});

test("a reused DHCP address never leaves the previous workstation mapped to the new machine",()=>{
  const first=reconcileMappings({},[row("192.0.2.10","192.0.2.10","STUDENT-01")]);
  const reused=reconcileMappings(first.mapping,[row("192.0.2.10","192.0.2.10","STUDENT-02")]);
  assert.equal(reused.mapping["student-01"].stale,true);
  assert.equal(reused.mapping["student-01"].backendId,"");
  assert.equal(resolveBackendId(reused.mapping,stableIdForHostname("student-01")),stableIdForHostname("student-01"));
  assert.equal(resolveBackendId(reused.mapping,stableIdForHostname("student-02")),"192.0.2.10");
  assert.equal(stableIdForBackend(reused.mapping,"192.0.2.10"),stableIdForHostname("student-02"));
});

test("two computers can swap DHCP addresses while both stable identities survive",()=>{
  let state=reconcileMappings({},[
    row("192.0.2.10","192.0.2.10","STUDENT-01"),
    row("192.0.2.11","192.0.2.11","STUDENT-02")
  ]).mapping;
  const result=reconcileMappings(state,[
    row("192.0.2.11","192.0.2.11","STUDENT-01"),
    row("192.0.2.10","192.0.2.10","STUDENT-02")
  ]);
  assert.equal(resolveBackendId(result.mapping,stableIdForHostname("STUDENT-01")),"192.0.2.11");
  assert.equal(resolveBackendId(result.mapping,stableIdForHostname("STUDENT-02")),"192.0.2.10");
  assert.equal(stableIdForBackend(result.mapping,"192.0.2.11"),stableIdForHostname("STUDENT-01"));
  assert.equal(stableIdForBackend(result.mapping,"192.0.2.10"),stableIdForHostname("STUDENT-02"));
  assert.deepEqual(new Set(result.moves.map(x=>`${x.hostname}:${x.fromIp}->${x.toIp}`)),new Set([
    "student-01:192.0.2.10->192.0.2.11",
    "student-02:192.0.2.11->192.0.2.10"
  ]));
});

test("projection suppresses stale duplicate rows and prefers the live current record",()=>{
  const rows=[
    row("192.0.2.10","192.0.2.10","STUDENT-01",{online:false,authenticated:false,updatedAt:"2026-01-01T00:00:00Z"}),
    row("192.0.2.44","192.0.2.44","STUDENT-01",{online:true,authenticated:true,updatedAt:"2026-01-01T00:01:00Z"})
  ];
  const reconciled=reconcileMappings({},rows);
  const projected=projectRows(reconciled.mapping,rows);
  assert.equal(projected.length,1);
  assert.equal(projected[0].ip,"192.0.2.44");
  assert.equal(projected[0].id,stableIdForHostname("STUDENT-01"));
});

test("Veyon key affinity moves to a computer's new DHCP address",()=>{
  const prefs={[HOST_KEY_PREF]:{"192.0.2.10":"secondary"}};
  const storage={
    getPreference:(name,fallback)=>prefs[name]??fallback,
    setPreference:(name,value)=>{prefs[name]=JSON.parse(JSON.stringify(value))},
    getSecret:()=>"",
    putSecret:()=>{},deleteSecret:()=>{}
  };
  const keyring=new VeyonKeyring({storage});
  assert.equal(keyring.moveHostPreference("192.0.2.10","192.0.2.44"),true);
  assert.equal(keyring.hostPreferred("192.0.2.10"),"");
  assert.equal(keyring.hostPreferred("192.0.2.44"),"secondary");
});
