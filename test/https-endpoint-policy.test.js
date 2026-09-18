"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const server=fs.readFileSync(path.join(root,"src/server.js"),"utf8");
const workspace=fs.readFileSync(path.join(root,"public/controller/workspace.js"),"utf8");
const attribution=fs.readFileSync(path.join(root,"public/shared/attribution.js"),"utf8");
const veyonAi=fs.readFileSync(path.join(root,"src/veyon-ai.js"),"utf8");
const androidV2=fs.readFileSync(path.join(root,"maintenance-agent/android-tv-agent-v2.js"),"utf8");
const cloudflare=fs.readFileSync(path.join(root,"src/cloudflare.js"),"utf8");
const integrationSetup=fs.readFileSync(path.join(root,"public/shared/integration-setup.js"),"utf8");
const controller=fs.readFileSync(path.join(root,"public/controller/app.js"),"utf8");

test("new Windows enrollment prefers recorded Cloudflare HTTPS without removing request-origin fallback",()=>{
  assert.match(server,/function configuredPublicHubOrigin\(\)/);
  assert.match(server,/integrations\.cloudflare/);
  assert.match(server,/https:\/\/\$\{hostname\}/);
  assert.match(server,/preferredOrigin:preferred\.origin/);
  assert.match(server,/fallbackInstallCommand:fallback\?\.command\|\|null/);
  assert.match(workspace,/HTTPS \/ WSS preferred/);
  assert.match(workspace,/enrollment\.preferredOrigin/);
  assert.match(workspace,/enrollment\.fallbackInstallCommand/);
  assert.match(workspace,/automatically use <code>wss:\/\//);
});

test("private control surfaces remain private during public-origin migration",()=>{
  assert.match(server,/VEYON_WEBAPI_URL \|\| "http:\/\/127\.0\.0\.1:11080"/);
  assert.match(veyonAi,/http:\/\/127\.0\.0\.1:3025\/analyze/);
  assert.match(androidV2,/http:\/\/\$\{d\.host\}:\$\{cleanPort\(cfg\.port\|\|8765\)\}/);
});

test("physical display media migration remains gated because port 3020 routing is HTTP-origin specific",()=>{
  assert.match(attribution,/location\.protocol!==["']http:["']/);
  assert.match(attribution,/ROOMGOBLIN_MEDIA_PORT\|\|3020/);
});


test("Cloudflare ingress publishes only reviewed browser resources, never privileged local control ports",()=>{
  assert.match(cloudflare,/musicAssistantHostname,service:"http:\/\/127\.0\.0\.1:8095"/);
  assert.match(cloudflare,/settings\.hostname,service:this\.originUrl/);
  assert.match(cloudflare,/service:"http_status:404"/);
  for(const forbidden of ["11080","3010","3020","3025","8765","5555","1883","6053","11100"]){
    assert.doesNotMatch(cloudflare,new RegExp("127\\.0\\.0\\.1:"+forbidden));
  }
  assert.match(cloudflare,/Publishing Music Assistant requires an Access allowed email domain/);
});

test("Music Assistant browser opening requires an explicit HTTPS resource when Controller is HTTPS",()=>{
  assert.match(integrationSetup,/key:"browserUrl"/);
  assert.match(integrationSetup,/Music Assistant has no protected browser HTTPS URL/);
  assert.match(integrationSetup,/location\.protocol==="http:"/);
  assert.match(controller,/maBrowserUrl\.value/);
  assert.match(controller,/Enable it under Cloudflare Remote HTTPS or use the LAN HTTP fallback/);
  assert.doesNotMatch(controller,/u\.hostname=location\.hostname;window\.open\(u\.href/);
});

test("Veyon browser control stays behind RoomGoblin while native Veyon endpoints remain LAN-local",()=>{
  assert.match(server,/http:\/\/127\.0\.0\.1:11080/);
  assert.doesNotMatch(cloudflare,/11080/);
  assert.doesNotMatch(cloudflare,/11100/);
});
