"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {spawnSync}=require("node:child_process");
const read=p=>fs.readFileSync(p,"utf8");

test("native Sendspin registers JsonOptional and Kotlin Moshi adapters",()=>{
  const manager=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/NativeSendspinManager.kt");
  const gradle=read("agents/android-tv/app/build.gradle.kts");
  assert.match(manager,/JsonOptionalAdapterFactory/);
  assert.match(manager,/KotlinJsonAdapterFactory/);
  assert.match(manager,/\.add\(JsonOptionalAdapterFactory\(\)\)/);
  assert.match(manager,/\.addLast\(KotlinJsonAdapterFactory\(\)\)/);
  assert.match(gradle,/moshi-kotlin:1\.15\.2/);
  assert.match(gradle,/versionCode = 5/);
  assert.match(gradle,/versionName = "0\.3\.1-agent-v2"/);
});

test("Managed Displays exposes a safe Device Admin removal helper",()=>{
  const bridge=read("maintenance-agent/android-tv-agent-v2.js");
  const ui=read("public/managed-displays/device-admin-ui.js");
  const html=read("public/managed-displays/index.html");
  assert.match(bridge,/device-admin\/deactivate/);
  assert.match(bridge,/com\.android\.tv\.settings\/\.deviceadmin\.DeviceAdminAdd/);
  assert.match(bridge,/LEGACY_PACKAGE="org\.classroomhub\.display"/);
  assert.match(bridge,/android\.app\.extra\.DEVICE_ADMIN/);
  assert.match(ui,/Remove Device Admin/);
  assert.match(ui,/requires confirmation on the TV|confirmation on the TV/i);
  assert.match(html,/device-admin-ui\.js/);
});

test("Device Admin removal UI parses and avoids descendant observer loops",()=>{
  const file="public/managed-displays/device-admin-ui.js";
  const r=spawnSync(process.execPath,["--check",file],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const ui=read(file);
  assert.match(ui,/observe\(root,\{childList:true\}\)/);
  assert.doesNotMatch(ui,/subtree:true/);
});
