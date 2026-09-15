"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const display = fs.readFileSync(path.join(__dirname, "..", "public", "display", "index.html"), "utf8");
const androidActivity = fs.readFileSync(path.join(__dirname, "..", "agents", "android-tv", "app", "src", "main", "java", "org", "roomgoblin", "display", "MainActivity.java"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const dependabot = fs.readFileSync(path.join(__dirname, "..", ".github", "dependabot.yml"), "utf8");

test("browser Sendspin stays on the reviewed Music Assistant 2.9 protocol major", () => {
  assert.equal(packageJson.dependencies["@sendspin/sendspin-js"], "3.2.1");
  assert.match(dependabot, /dependency-name: "@sendspin\/sendspin-js"[\s\S]*version-update:semver-major/);
});

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

// Check the installed public API: 3.2.0 had the caller hook but no SDK unlock.
test("installed Sendspin SDK exposes the display gesture-unlock API", async () => {
  const { build } = require("esbuild");
  const bundle = await build({
    entryPoints: [path.join(__dirname, "..", "public", "display", "sendspin-entry.js")],
    bundle: true, format: "esm", target: "es2022", write: false, logLevel: "silent",
  });
  const source = Buffer.from(bundle.outputFiles[0].text).toString("base64");
  const { SendspinPlayer } = await import(`data:text/javascript;base64,${source}`);
  assert.equal(typeof SendspinPlayer.prototype.unlock, "function");
});
