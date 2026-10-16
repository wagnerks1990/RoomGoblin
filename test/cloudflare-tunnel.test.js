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

test("connector readiness retries transient starts and fails within its deadline",()=>{
  const script=read(scriptPath);
  const start=script.indexOf("wait_for_hub_health() {");
  const end=script.indexOf("\ninstall_cloudflared()",start);
  assert.ok(start>=0 && end>start);
  const helper=script.slice(start,end);
  const result=spawnSync("bash",["-c",`set -euo pipefail
${helper}
HUB_PORT=3000
attempts=0
curl(){ attempts=$((attempts+1)); [[ $attempts -ge 3 ]]; }
sleep(){ :; }
wait_for_hub_health 5
[[ $attempts -eq 3 ]]
attempts=0
if wait_for_hub_health 0; then exit 91; fi
[[ $attempts -eq 0 ]]
curl(){ return 1; }
unset -f sleep
if wait_for_hub_health 1; then exit 92; fi
`],{encoding:"utf8",timeout:5000});
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.match(script,/wait_for_hub_health 10/);
  assert.match(script,/wait_for_hub_health 90/);
  assert.doesNotMatch(script,/docker logs/);
});
