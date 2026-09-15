"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {spawnSync}=require("node:child_process");

const read=p=>fs.readFileSync(p,"utf8");

test("Displays & AV keeps routing ahead of topology configuration",()=>{
  const ui=read("public/shared/room-topology-ui.js");
  assert.match(ui,/Configure TVs, RoomGoblin Displays & AV Sources/);
  assert.match(ui,/workspaceDisclosure/);
  assert.match(ui,/roomTopologyConfig/);
  assert.match(ui,/querySelector\("#av \.av40Summary"\)/);
  assert.match(ui,/after\(config\)/);
  assert.doesNotMatch(ui,/av\.before\(panel\)/);
});

test("topology inventories keep stable hardware order independent of names",()=>{
  const branding=read("public/shared/branding.js"),order=read("public/shared/topology-order.js");
  assert.match(branding,/topology-order\.js/);
  assert.match(order,/numericField\(a,"output"\)-numericField\(b,"output"\)/);
  assert.match(order,/numericField\(a,"input"\)-numericField\(b,"input"\)/);
  assert.match(order,/natural\(cardId\(a\),cardId\(b\)\)/);
  const result=spawnSync(process.execPath,["--check","public/shared/topology-order.js"],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
