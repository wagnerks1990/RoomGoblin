"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");

const source=fs.readFileSync(require.resolve("../src/server"),"utf8");

function region(start,end,context={}){
  const from=source.indexOf(start),to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,`source region not found: ${start}`);
  const sandbox=vm.createContext(context);
  vm.runInContext(source.slice(from,to),sandbox);
  return sandbox;
}

test("environment integers reject malformed, fractional, and out-of-range values",()=>{
  const context=region("function environmentInteger(","const PORT",{process:{env:{}}});
  assert.equal(context.environmentInteger("LIMIT",7,1,10),7);
  for(const value of ["NaN","1.5","0","11"]){
    context.process.env.LIMIT=value;
    assert.throws(()=>context.environmentInteger("LIMIT",7,1,10),/whole number/);
  }
  context.process.env.LIMIT="10";
  assert.equal(context.environmentInteger("LIMIT",7,1,10),10);
});

test("media command validation happens before dispatch and rejects credentialed or non-finite input",()=>{
  const context=region("function safeMediaUrl(","// -----------------------------------------------------------------------------\n// Legacy MQTT translator",{
    URL,Buffer,
    validateGoveeCommand(){},plutoActionForCommand(){return {action:"route"}},plutoBuild(){}
  });
  assert.equal(context.safeMediaUrl("/media/example.mp4"),"/media/example.mp4");
  assert.equal(context.safeMediaUrl("/test-images/tv1.svg"),"/test-images/tv1.svg");
  assert.equal(context.safeMediaUrl("/test-images/tv8.svg"),"/test-images/tv8.svg");
  assert.throws(()=>context.safeMediaUrl("/test-images/tv9.svg"),/Media URL/);
  assert.throws(()=>context.safeMediaUrl("/test-images/../secret.svg"),/Media URL/);
  assert.equal(context.safeMediaUrl("https://display.example/video.mp4"),"https://display.example/video.mp4");
  assert.throws(()=>context.safeMediaUrl("https://user:secret@display.example/video.mp4"),/Media URL/);
  assert.throws(()=>context.safeMediaUrl("/media/..\\secret"),/backslashes/);
  assert.throws(()=>context.validateCommandForDispatch({type:"display.video",target:"all",payload:{url:"https://display.example/v.mp4",volume:"NaN"}}),/volume/);
  const command={type:"display.video",target:"all",payload:{url:"https://display.example/v.mp4",volume:"0.5"}};
  context.validateCommandForDispatch(command);
  assert.equal(command.payload.volume,0.5);
});

test("Veyon targets accept only canonical RFC1918 IPv4 addresses",()=>{
  const context=region("function validatedVeyonHost(","function veyonComputerId(");
  assert.equal(context.validatedVeyonHost("192.168.001.010"),"192.168.1.10");
  assert.equal(context.validatedVeyonHost("172.31.4.5"),"172.31.4.5");
  for(const value of ["127.0.0.1","169.254.1.1","172.32.0.1","8.8.8.8","host.local"])
    assert.throws(()=>context.validatedVeyonHost(value),/RFC1918|private IPv4/);
});

test("class weekday normalization excludes fractional indexes",()=>{
  assert.match(source,/filter\(x=>Number\.isInteger\(x\)&&x>=0&&x<=6\)/);
});

test("Govee telemetry canonicalizes physical IDs before state indexing",()=>{
  assert.match(source,/const deviceId=normalizeGoveePhysicalId\(sm\[1\]\)/);
  assert.match(source,/const id=normalizeGoveePhysicalId\(deviceId\);/);
  assert.match(source,/newDevice\}\);/);
});
