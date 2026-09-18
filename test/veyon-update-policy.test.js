"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {parseVersion,compareVersions,parseAptVeyon,selectOfficialUbuntuAsset}=require("../src/veyon-update-policy");

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


test("official Ubuntu asset selection requires exact upstream name, URL and digest",()=>{
  const release={tag_name:"v4.11.3",assets:[{name:"veyon_4.11.3.0-ubuntu.26.04_amd64.deb",browser_download_url:"https://github.com/veyon/veyon/releases/download/v4.11.3/veyon_4.11.3.0-ubuntu.26.04_amd64.deb",digest:"sha256:"+"a".repeat(64)}]};
  const asset=selectOfficialUbuntuAsset(release,{osRelease:{versionId:"26.04"},architecture:"amd64"});
  assert.equal(asset.version,"4.11.3");assert.equal(asset.versionId,"26.04");assert.equal(asset.sha256,"a".repeat(64));
  assert.equal(selectOfficialUbuntuAsset({...release,assets:[{...release.assets[0],browser_download_url:"https://example.invalid/veyon.deb"}]},{osRelease:{versionId:"26.04"},architecture:"amd64"}),null);
  assert.equal(selectOfficialUbuntuAsset(release,{osRelease:{versionId:"24.04"},architecture:"amd64"}),null);
  assert.equal(selectOfficialUbuntuAsset(release,{osRelease:{versionId:"26.04"},architecture:"arm64"}),null);
});

test("Veyon lifecycle GUI uses guarded same-origin administration routes",()=>{
  const ui=fs.readFileSync(path.join(root,"public","controller","veyon-update-ui.js"),"utf8");
  const bridge=fs.readFileSync(path.join(root,"src","veyon-update-bridge.js"),"utf8");
  assert.match(ui,/\/api\/v1\/admin\/veyon-update-status/);
  assert.match(ui,/UPDATE_VEYON_AND_HOST/);
  assert.match(bridge,/\/host\/updates\/apply/);
  assert.match(bridge,/\/host\/veyon\/update/);
  assert.match(bridge,/INSTALL_UPDATES/);
  assert.match(bridge,/INSTALL_VEYON_RELEASE/);
  assert.match(bridge,/requireAdmin/);
  assert.doesNotMatch(ui,/api\.github\.com/);
  const maintenance=fs.readFileSync(path.join(root,"maintenance-agent","server.js"),"utf8");
  const host=fs.readFileSync(path.join(root,"host-agent","server.py"),"utf8");
  const runner=fs.readFileSync(path.join(root,"host-agent","update-runner.sh"),"utf8");
  assert.match(maintenance,/\/host\/veyon\/update/);assert.match(maintenance,/pre-veyon-update/);
  assert.match(host,/\/veyon\/update/);assert.match(host,/VEYON_UPDATE_REQUEST_FILE/);
  assert.match(runner,/github\.com\/veyon\/veyon\/releases\/download/);
  assert.match(runner,/sha256sum -c/);assert.match(runner,/dpkg-deb --field/);
});

test("startup loads DHCP identity and lifecycle bridges before the server",()=>{
  const source=fs.readFileSync(path.join(root,"src","startup-recovery.js"),"utf8");
  const dhcp=source.indexOf('require("./veyon-dhcp-identity-bridge")');
  const lifecycle=source.indexOf('require("./veyon-update-bridge")');
  const server=source.indexOf('require("./server")');
  assert.ok(dhcp>=0&&lifecycle>dhcp&&server>lifecycle);
});

test("installed Veyon version survives an empty apt upgrade list",()=>{
  const {installedVeyonVersion}=require('../src/veyon-update-policy');
  assert.equal(parseAptVeyon([]).installedVersion,'');
  assert.deepEqual(installedVeyonVersion([{name:'veyon',version:'4.11.2-1'}]),{installedVersion:'4.11.2',mixedInstalledVersions:false,installedVersions:['4.11.2']});
  assert.equal(installedVeyonVersion([{name:'veyon-service',version:'4.11.2'},{name:'veyon-master',version:'4.9.7'}]).mixedInstalledVersions,true);
  assert.equal(installedVeyonVersion([]).installedVersion,null);
  assert.equal(installedVeyonVersion([{name:'unrelated',version:'4.9.7'}]).installedVersion,null);
});
