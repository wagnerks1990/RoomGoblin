"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("controller loads the unified scheduled automation editor",()=>{
  const branding=read("public/shared/branding.js");
  const editor=read("public/controller/automation-v2.js");
  const html=read("public/controller/index.html");
  assert.match(branding,/automation-v2\.js/);
  assert.match(editor,/Build one ordered action sequence/);
  assert.match(editor,/starts another pass only while multiple actions remain eligible/);
  assert.match(editor,/ACTION \$\{i\+1\}/);
  assert.match(html,/automationEventSelect/);
  assert.doesNotMatch(html,/automationEditorEventSelect/);
  assert.match(html,/autoClassPicker/);
  assert.match(html,/multiSelectOptions/);
});

test("every action exposes pass participation controls",()=>{
  const editor=read("public/controller/automation-v2.js");
  assert.match(editor,/Execution<select/);
  assert.match(editor,/Run once/);
  assert.match(editor,/Loop X times/);
  assert.match(editor,/Loop continually/);
  assert.match(editor,/Total Passes/);
  assert.match(editor,/Wait Before Next Loop/);
});

test("media controls are content-aware",()=>{
  const editor=read("public/controller/automation-v2.js");
  assert.match(editor,/selectedMediaType/);
  assert.match(editor,/isVideo/);
  assert.match(editor,/isPaged/);
  assert.match(editor,/isImage/);
  for(const field of ["storedName","fit","autoAdvanceMs","startAtSeconds","endAtSeconds","volume","playbackRate","muted"]){
    assert.match(editor,new RegExp(field));
  }
  assert.match(editor,/Media-specific controls appear only when they apply/);
});

test("canonical event persists one ordered sequence",()=>{
  const editor=read("public/controller/automation-v2.js");
  assert.match(editor,/const SCHEMA_VERSION=3/);
  assert.match(editor,/automationSchemaVersion:SCHEMA_VERSION/);
  assert.match(editor,/actionSequence:canonical/);
});

test("legacy primary widgets are hidden rather than exposed as a second editor",()=>{
  const editor=read("public/controller/automation-v2.js");
  assert.match(editor,/autoAction/);
  assert.match(editor,/autoTargets/);
  assert.match(editor,/autoPayload/);
  assert.match(editor,/style\.display="none"/);
});

test("class schedule links use a compact checkbox dropdown with save and cancel",()=>{
  const app=read("public/controller/app.js");
  const html=read("public/controller/index.html");
  assert.match(html,/Linked Class Schedule\(s\)/);
  assert.match(html,/id="autoClassPicker" class="multiSelect"/);
  assert.match(html,/autoClassSummary/);
  assert.match(html,/id="autoClassIds" class="multiSelectOptions"/);
  assert.match(html,/Save Class Links/);
  assert.match(html,/Clear All/);
  assert.match(html,/Cancel/);
  assert.doesNotMatch(html,/id="autoClassModal"/);
  assert.match(app,/openAutomationClassLinker/);
  assert.match(app,/closeAutomationClassLinker/);
  assert.match(app,/handleAutomationClassPickerToggle/);
  assert.match(app,/automationClassSelectionSnapshot/);
  assert.match(app,/updateAutomationClassLinkSummary/);
});

test("automation editor exposes only Save & Enable and Cancel / New commit controls",()=>{
  const html=read("public/controller/index.html");
  assert.match(html,/Save &amp; Enable/);
  assert.match(html,/Cancel \/ New/);
  assert.doesNotMatch(html,/Save Draft \/ Changes/);
  assert.doesNotMatch(html,/Simulate Draft/);
  assert.doesNotMatch(html,/Run Draft on Real Devices/);
});
