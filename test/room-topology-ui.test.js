"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {spawnSync}=require("node:child_process");
const read=p=>fs.readFileSync(p,"utf8");

test("topology UI is loaded on operator surfaces and parses",()=>{
  const branding=read("public/shared/branding.js"),ui=read("public/shared/room-topology-ui.js");
  assert.match(branding,/room-topology-ui\.js/);
  assert.match(branding,/data-roomgoblin-topology|roomgoblinTopology/);
  const result=spawnSync(process.execPath,["--check","public/shared/room-topology-ui.js"],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.doesNotMatch(ui,/!window\.S/);
});

test("setup separates TVs, RoomGoblin displays, and AV sources",()=>{
  const ui=read("public/shared/room-topology-ui.js");
  assert.match(ui,/>TVs</);
  assert.match(ui,/RoomGoblin Displays/);
  assert.match(ui,/AV Sources/);
  assert.match(ui,/display-setup/);
  assert.match(ui,/admin\/displays/);
  assert.match(ui,/pluto\/labels/);
});

test("controller target pickers use topology domains instead of display inventory",()=>{
  const ui=read("public/shared/room-topology-ui.js");
  assert.match(ui,/All Physical TVs/);
  assert.match(ui,/configuredDisplayTargets=function/);
  assert.match(ui,/autoTargetValues=function/);
  assert.match(ui,/stepTargetValues=function/);
  assert.match(ui,/Room topology/);
});

test("AV label saves synchronize topology editor while direct topology remains editable",()=>{
  const ui=read("public/shared/room-topology-ui.js");
  assert.match(ui,/url===\"\/api\/v1\/pluto\/labels\"/);
  assert.match(ui,/renderEditors\(\)/);
  assert.match(ui,/savingTopology/);
  assert.match(ui,/Save Changes/);
  assert.match(ui,/TV names and AV source names sync automatically/);
});

test("admin compatibility bridge persists canonical topology and projects legacy state",()=>{
  const bridge=read("src/maintenance-route-bridge.js");
  assert.match(bridge,/room\.topology/);
  assert.match(bridge,/normalizeTopology/);
  assert.match(bridge,/legacyProjection/);
  assert.match(bridge,/wrapAdminConfigHandler/);
  assert.match(bridge,/wrapAdminDisplaysHandler/);
  assert.match(bridge,/wrapAvLabelsHandler/);
  assert.match(bridge,/system_preferences/);
});
