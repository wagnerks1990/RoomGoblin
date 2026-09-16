"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("fs");
const path=require("path");
const {spawnSync}=require("child_process");

const root=path.resolve(__dirname,"..");
const scriptPath=path.join(root,"deploy","configure-cloudflare-tunnel.sh");
const docPath=path.join(root,"docs","CLOUDFLARE-TUNNEL.md");
const wikiPath=path.join(root,"wiki","Cloudflare-Tunnel.md");
const aiPath=path.join(root,"docs","ai","CLOUDFLARE-TUNNEL.md");

function read(file){return fs.readFileSync(file,"utf8")}

test("Cloudflare Tunnel installer has valid bash syntax",()=>{
  const result=spawnSync("bash",["-n",scriptPath],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
});

test("Cloudflare Tunnel keeps credentials out of RoomGoblin env and command arguments",()=>{
  const script=read(scriptPath);
  assert.match(script,/TOKEN_PATH="\/etc\/cloudflared\/roomgoblin\.token"/);
  assert.match(script,/chmod 0600 "\$TOKEN_PATH"/);
  assert.match(script,/--token-file \$\{TOKEN_PATH\}/);
  assert.doesNotMatch(script,/--token[ =]"?\$token/i);
  assert.doesNotMatch(script,/set_env_value\s+(?:CLOUDFLARE|TUNNEL).*TOKEN/i);
});

test("Cloudflare Tunnel uses the reviewed loopback proxy topology",()=>{
  const script=read(scriptPath);
  const docs=[read(docPath),read(wikiPath),read(aiPath)].join("\n");
  assert.match(script,/http:\/\/127\.0\.0\.1:\$\{HUB_PORT\}\/health/);
  assert.match(script,/set_env_value TRUST_PROXY_HOPS 1/);
  assert.match(docs,/http:\/\/127\.0\.0\.1:3000/);
  assert.match(docs,/TRUST_PROXY_HOPS=1/);
  assert.match(docs,/3010/);
  assert.match(docs,/optional/i);
});
