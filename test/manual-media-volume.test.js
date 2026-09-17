"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("manual display media exposes persistent playback controls",()=>{
  const helper=read("public/shared/manual-media-volume.js");
  const attribution=read("public/shared/attribution.js");
  const receiver=read("public/display/index.html");
  const controller=read("public/controller/display.html");
  assert.match(attribution,/manual-media-volume\.js/);
  assert.match(helper,/id=\"mediaVolume\"/);
  assert.match(helper,/id=\"manualMediaSessionControls\"/);
  assert.match(helper,/Live Video Playback/);
  assert.match(helper,/manualMediaStart/);
  assert.match(helper,/manualMediaEnd/);
  assert.match(helper,/manualMediaRate/);
  assert.match(helper,/\/media\/control/);
  assert.match(helper,/\/media\/status/);
  assert.match(helper,/startAtSeconds/);
  assert.match(helper,/endAtSeconds/);
  assert.match(helper,/playbackRate/);
  assert.match(helper,/sessionId/);
  assert.match(helper,/disablePreviewLoader\(\)/);
  assert.match(helper,/window\.loadPreview=\(\)=>/);
  assert.match(helper,/setAttribute\(\"src\",\"about:blank\"\)/);
  assert.match(helper,/controller never loads the receiver video locally/);
  assert.match(helper,/muted:muted\.checked\|\|volume<=0/);
  assert.match(helper,/window\.controllerDisplayCommand\(type,window\.controllerDisplayTargetArg\(\),payload\)/);
  assert.match(controller,/window\.controllerDisplayCommand=cmd/);
  assert.match(controller,/window\.controllerDisplayTargetArg=targetArg/);
  assert.match(receiver,/n\.volume=Math\.max\(0,Math\.min\(1,Number\(m\.volume\?\?1\)\)\)/);
});

test("controller overview does not keep receiver preview clients alive",()=>{
  const embedded=read("public/controller/embedded-workspaces.js");
  assert.match(embedded,/iframe\[data-overview-preview\]/);
  assert.match(embedded,/Live preview disabled in controller/);
  assert.match(embedded,/frame\.src='about:blank'/);
  assert.match(embedded,/frame\.remove\(\)/);
  assert.match(embedded,/window\.refreshOverviewDisplayPreviews=\(\)=>/);
});
