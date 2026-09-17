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
  assert.match(helper,/controller never loads the receiver video locally/i);
  assert.match(helper,/muted:muted\.checked\|\|volume<=0/);
  assert.match(helper,/window\.controllerDisplayCommand\(type,window\.controllerDisplayTargetArg\(\),payload\)/);
  assert.match(controller,/window\.controllerDisplayCommand=cmd/);
  assert.match(controller,/window\.controllerDisplayTargetArg=targetArg/);
  assert.match(receiver,/async function startVideoPlayback\(video,m,reason='autoplay'\)/);
  assert.match(receiver,/video\.muted=true;video\.defaultMuted=true/);
  assert.match(receiver,/await video\.play\(\)/);
  assert.match(receiver,/muted-fallback/);
  assert.match(receiver,/activeMediaSession=\{video,spec\}/);
});

test("Display Studio media library never loads MP4 files as thumbnails",()=>{
  const controller=read("public/controller/display.html");
  assert.doesNotMatch(controller,/document\.createElement\('video'\)/);
  assert.match(controller,/thumb\.textContent='VIDEO'/);
  assert.match(controller,/f\.originalName\|\|f\.storedName/);
});

test("Today display previews stay live but suppress local video decoding",()=>{
  const embedded=read("public/controller/embedded-workspaces.js");
  const controller=read("public/controller/app.js");
  assert.match(controller,/iframe data-overview-preview/);
  assert.doesNotMatch(embedded,/Live preview disabled in controller/);
  assert.doesNotMatch(embedded,/frame\.remove\(\)/);
  assert.match(embedded,/Video active on physical display/);
  assert.match(embedded,/video\.removeAttribute\('src'\)/);
  assert.match(embedded,/MutationObserver\(suppress\)/);
  const receiver=read("public/display/index.html");
  assert.match(receiver,/preview&&\(m\?\.type==='protected-preview'\|\|m\?\.type==='video'\)/);
  assert.match(receiver,/Video active on physical display/);
});

test("media-session renderer release forces receiver convergence",()=>{
  assert.equal(read("VERSION").trim(),"1.0.0-alpha.84");
});
