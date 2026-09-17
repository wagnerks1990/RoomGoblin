"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("controller loads the unified automation v2 editor",()=>{
  const branding=read("public/shared/branding.js");
  const editor=read("public/controller/automation-v2.js");
  assert.match(branding,/automation-v2\.js/);
  assert.match(editor,/Build one ordered action sequence/);
  assert.match(editor,/Every action uses the same schema/);
  assert.match(editor,/ACTION \$\{i\+1\}/);
});

test("every action exposes execution controls",()=>{
  const editor=read("public/controller/automation-v2.js");
  assert.match(editor,/Execution<select/);
  assert.match(editor,/Run once/);
  assert.match(editor,/Repeat N times/);
  assert.match(editor,/Loop media continuously/);
  assert.match(editor,/repeatDelaySeconds/);
});

test("every media action exposes the complete playback payload",()=>{
  const editor=read("public/controller/automation-v2.js");
  for(const field of ["storedName","fit","autoAdvanceMs","startAtSeconds","endAtSeconds","volume","playbackRate","muted"]){
    assert.match(editor,new RegExp(field));
  }
  assert.match(editor,/Continuous video looping is controlled by the Execution setting/);
});

test("v2 event keeps canonical sequence and transition compatibility fields",()=>{
  const editor=read("public/controller/automation-v2.js");
  assert.match(editor,/automationSchemaVersion:SCHEMA_VERSION/);
  assert.match(editor,/actionSequence:canonical/);
  assert.match(editor,/PRIMARY|primary/i);
  assert.match(editor,/TAIL_SUFFIX/);
});

test("legacy primary widgets are hidden rather than used as a second editor",()=>{
  const editor=read("public/controller/automation-v2.js");
  assert.match(editor,/autoAction/);
  assert.match(editor,/autoTargets/);
  assert.match(editor,/autoPayload/);
  assert.match(editor,/style\.display="none"/);
});
