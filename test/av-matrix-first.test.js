"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const read=p=>fs.readFileSync(p,"utf8");

test("Displays & AV keeps routing ahead of topology configuration",()=>{
  const ui=read("public/shared/room-topology-ui.js");
  assert.match(ui,/Configure TVs, Displays & Sources/);
  assert.match(ui,/workspaceDisclosure/);
  assert.match(ui,/roomTopologyConfig/);
  assert.match(ui,/querySelector\("#av \.av40Summary"\)/);
  assert.match(ui,/after\(config\)/);
  assert.doesNotMatch(ui,/av\.before\(panel\)/);
});
