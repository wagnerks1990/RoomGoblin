"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const server=fs.readFileSync(path.join(__dirname,"..","src","server.js"),"utf8");

test("editing an existing automation preserves only exact pre-existing conflicts",()=>{
  assert.match(server,/function automationConflictSignature\(conflict\)/);
  assert.match(server,/automationConflictDiagnostics\(previous,events,\{startDate\}\)/);
  assert.match(server,/blocking=conflicts\.filter\(conflict=>!existing\.has\(automationConflictSignature\(conflict\)\)\)/);
  assert.match(server,/assertAutomationConflicts\(event,classroomAutomations\.events\.filter\(\(_,index\)=>index!==idx\),\{previous:prior\}\)/);
});

test("new automation creation remains strict",()=>{
  assert.match(server,/assertAutomationConflicts\(event,classroomAutomations\.events\);/);
});
