"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const display = fs.readFileSync(path.join(__dirname, "..", "public", "display", "index.html"), "utf8");
const androidActivity = fs.readFileSync(path.join(__dirname, "..", "agents", "android-tv", "app", "src", "main", "java", "org", "roomgoblin", "display", "MainActivity.java"), "utf8");

test("Sendspin browser fallback retains explicit user-gesture audio unlock", () => {
  assert.match(display, /async function unlockMusicAssistantAudio\(\)/);
  assert.match(display, /typeof player\.unlock!==['"]function['"]/);
  assert.match(display, /window\.roomGoblinUnlockMusicAssistantAudio=unlockMusicAssistantAudio/);
  for (const eventName of ["pointerdown", "touchstart", "keydown"]) {
    assert.match(display, new RegExp(eventName));
  }
  assert.match(display, /audioLocked:true,audioUnlocked:false/);
  assert.match(display, /audioLocked:!maAudioUnlocked,audioUnlocked:maAudioUnlocked/);
});

test("desired volume and mute are applied after Sendspin connect instead of before socket readiness", () => {
  const attachStart = display.indexOf("function attachMusicAssistant");
  const detachStart = display.indexOf("function detachMusicAssistant", attachStart);
  assert.ok(attachStart >= 0 && detachStart > attachStart);
  const attach = display.slice(attachStart, detachStart);
  const connectCall = attach.indexOf("maSendspinPlayer.connect().then");
  const volumeCall = attach.indexOf("setVolume(desiredVolume)");
  const muteCall = attach.indexOf("setMuted(desiredMuted)");
  assert.ok(connectCall >= 0, "Sendspin connect promise is missing");
  assert.ok(volumeCall > connectCall, "volume must not be sent before Sendspin connects");
  assert.ok(muteCall > connectCall, "mute must not be sent before Sendspin connects");
});

test("managed Android WebView keeps autoplay gesture exemption enabled", () => {
  assert.match(androidActivity, /setMediaPlaybackRequiresUserGesture\(false\)/);
});
