"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const ROOT=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(ROOT,"public/controller/workspace.js"),"utf8");

test("controller prefers the verified native Windows service enrollment path",()=>{
  assert.match(source,/window\.createLabAgentEnrollment=async function/);
  assert.match(source,/Recommended: native Windows service installer/);
  assert.match(source,/\/lab-agent\/native\/manifest\.json/);
  assert.match(source,/RoomGoblinAgent\.exe/);
  assert.match(source,/RoomGoblinSessionAgent\.exe/);
  assert.match(source,/RoomGoblinAgentUpdater\.exe/);
  assert.match(source,/RoomGoblinAgentBootstrap\.exe/);
  assert.match(source,/Get-FileHash -Path \$Path -Algorithm SHA256/);
  assert.match(source,/SHA-256 verification failed/);
  assert.match(source,/RoomGoblinAgentBootstrap\.exe'\) install --hub-url/);
});

test("controller preserves legacy enrollment as an explicit fallback",()=>{
  assert.match(source,/Legacy PowerShell scheduled-task installer/);
  assert.match(source,/enrollment\.installCommand/);
  assert.match(source,/Compatibility fallback only/);
});

test("HTTP native enrollment requires the bootstrap opt-in",()=>{
  assert.match(source,/protocol==='http:'\?' --allow-http':''/);
});
