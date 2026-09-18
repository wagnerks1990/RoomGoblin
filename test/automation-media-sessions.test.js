"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const server=fs.readFileSync(path.join(root,"src/server.js"),"utf8");
const display=fs.readFileSync(path.join(root,"public/display/index.html"),"utf8");
const editor=fs.readFileSync(path.join(root,"public/controller/automation-v2.js"),"utf8");

test("automation actions persist pass-based execution policy",()=>{
  assert.match(server,/automationActionSequence\(event\)/);
  assert.match(server,/actionEligibleOnPass\(step,pass\)/);
  assert.match(server,/sequenceHasEligibleActions\(steps,pass\+1\)/);
  assert.match(editor,/Loop continually/);
  assert.match(editor,/repeatDelaySeconds/);
});

test("video renderer keeps a stable media session and supports live control",()=>{
  assert.match(display,/activeMediaSession/);
  assert.match(display,/display\.media\.control/);
  assert.match(display,/video\.currentTime/);
  assert.match(display,/display\.media\.status/);
  assert.match(server,/\/api\/v1\/displays\/:id\/media\/control/);
  assert.match(server,/\/api\/v1\/displays\/:id\/media\/status/);
  assert.doesNotMatch(server,/displayDevices\[id\]/);
  assert.match(display,/rgMediaSessionBound/);
});

test("automation video payload supports clip boundaries volume and rate",()=>{
  for(const token of ["startAtSeconds","endAtSeconds","playbackRate","volume","sessionId"])assert.ok(server.includes(token),token);
  assert.match(editor,/Start at \(seconds\)/);
  assert.match(editor,/Mute video/);
});
