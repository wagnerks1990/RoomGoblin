"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {parseVersion,compareVersions,parseAptVeyon}=require("../src/veyon-update-policy");

const root=path.join(__dirname,"..");

test("Veyon release versions compare semantically",()=>{
  assert.equal(parseVersion("v4.11.2").text,"4.11.2");
  assert.equal(compareVersions("4.11.2","4.11.0")>0,true);
  assert.equal(compareVersions("4.10.4","4.11.0")<0,true);
  assert.equal(compareVersions("4.11.2","4.11.2"),0);
});

test("apt update rows identify installed and candidate Veyon versions",()=>{
  const result=parseAptVeyon([
    {name:"openssl",raw:"openssl/noble-updates 3.0.13 amd64 [upgradable from: 3.0.12]"},
    {name:"veyon",raw:"veyon/stable 4.11.2 amd64 [upgradable from: 4.9.7]"},
    {name:"veyon-plugins",raw:"veyon-plugins/stable 4.11.2 amd64 [upgradable from: 4.9.7]"}
  ]);
  assert.equal(result.packages.length,2);
  assert.equal(result.installedVersion,"4.9.7");
  assert.equal(result.candidateVersion,"4.11.2");
});

test("Veyon lifecycle GUI uses guarded same-origin administration routes",()=>{
  const ui=fs.readFileSync(path.join(root,"public","controller","veyon-update-ui.js"),"utf8");
  const bridge=fs.readFileSync(path.join(root,"src","veyon-update-bridge.js"),"utf8");
  assert.match(ui,/\/api\/v1\/admin\/veyon-update-status/);
  assert.match(ui,/UPDATE_VEYON_AND_HOST/);
  assert.match(bridge,/INSTALL_UPDATES/);
  assert.match(bridge,/requireAdmin/);
  assert.doesNotMatch(ui,/api\.github\.com/);
});

test("startup loads DHCP identity and lifecycle bridges before the server",()=>{
  const source=fs.readFileSync(path.join(root,"src","startup-recovery.js"),"utf8");
  const dhcp=source.indexOf('require("./veyon-dhcp-identity-bridge")');
  const lifecycle=source.indexOf('require("./veyon-update-bridge")');
  const server=source.indexOf('require("./server")');
  assert.ok(dhcp>=0&&lifecycle>dhcp&&server>lifecycle);
});
