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
