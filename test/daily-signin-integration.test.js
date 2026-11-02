"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {launch,linux}=require("./helpers/lifecycle-process.cjs");

test("daily sign-in works through the real Hub authorization, writer freeze and audit boundaries",linux,async t=>{
  const app=await launch(t),origin=`http://127.0.0.1:${app.control}`,base="/api/v1/admin/daily-signin";
  let response=await fetch(origin+base);assert.equal(response.status,403);await response.text();
  response=await fetch(origin+"/api/v1/setup/administrator",{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},
    body:JSON.stringify({username:"signin-fixture",password:"Synthetic-Fixture-Password!"})});
  assert.equal(response.status,201,await response.text());const cookie=response.headers.get("set-cookie").split(";")[0];
  const request=(url,body)=>fetch(origin+url,{method:body===undefined?"GET":"POST",headers:{cookie,"content-type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
  response=await request(base+"/groups",{name:"Isolated fixture",timeZone:"America/New_York"});
  assert.equal(response.status,201);const {group}=await response.json();
  response=await request(`${base}/groups/${group.id}/code`,{});assert.equal(response.status,200);const {code}=await response.json();assert.match(code,/^\d{8}$/);
  const passphrase="synthetic enrollment passphrase only";
  response=await request(`${base}/groups/${group.id}/enrollment`,{computerName:"TEST-PC",username:"esports",passphrase});
  assert.equal(response.status,200);const enrollment=await response.json();assert.equal(enrollment.enrollment.format,"roomgoblin-daily-signin-v1");
  const internal=(path,body)=>fetch(`${origin}/api/v1/internal/maintenance/${path}`,{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"},body:JSON.stringify(body)});
  response=await internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"});assert.equal(response.status,200);const {freezeToken}=await response.json();
  response=await request(`${base}/groups/${group.id}/enrollment`,{computerName:"TEST-PC",username:"esports",passphrase});assert.equal(response.status,423);await response.text();
  response=await internal("export-thaw",{freezeToken});assert.equal(response.status,200);await response.text();
  response=await request("/api/v1/database/audit");assert.equal(response.status,200);const audit=await response.text();
  assert.ok(audit.includes("daily-signin.enrollment.export"));assert.ok(!audit.includes(code));assert.ok(!audit.includes(passphrase));
  assert.ok(!app.output().includes(code));assert.ok(!app.output().includes(passphrase));
});
