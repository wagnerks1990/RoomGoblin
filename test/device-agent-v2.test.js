"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {spawnSync}=require("node:child_process");

const read=p=>fs.readFileSync(p,"utf8");

test("Device Agent v2 maintenance bridge parses",()=>{
  const r=spawnSync(process.execPath,["--check","maintenance-agent/android-tv-agent-v2.js"],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr||r.stdout);
});

test("maintenance image loads Device Agent v2 bridge",()=>{
  const docker=read("maintenance-agent/Dockerfile");
  assert.match(docker,/COPY (?:maintenance-agent\/)?android-tv-agent-v2\.js/);
  assert.match(docker,/--require=\/app\/android-tv-agent-v2\.js/);
});

test("Device Agent v2 keeps the existing package identity and advances native-player version",()=>{
  const gradle=read("agents/android-tv/app/build.gradle.kts");
  assert.match(gradle,/applicationId = "org\.roomgoblin\.display"/);
  assert.match(gradle,/versionCode = 5/);
  assert.match(gradle,/versionName = "0\.3\.1-agent-v2"/);
});

test("Device Agent v2 declares durable boot, management and media playback foreground service",()=>{
  const manifest=read("agents/android-tv/app/src/main/AndroidManifest.xml");
  assert.match(manifest,/android\.intent\.action\.LOCKED_BOOT_COMPLETED/);
  assert.match(manifest,/android\.intent\.action\.BOOT_COMPLETED/);
  assert.match(manifest,/android:name="\.AgentService"/);
  assert.match(manifest,/foregroundServiceType="specialUse\|mediaPlayback"/);
  assert.match(manifest,/FOREGROUND_SERVICE_MEDIA_PLAYBACK/);
});

test("Device Agent v2 control channel requires per-device authentication",()=>{
  const service=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentService.java");
  assert.match(service,/x-classroom-hub-agent-token/);
  assert.match(service,/MessageDigest\.isEqual/);
  assert.doesNotMatch(service,/authorized\([^)]*\)\s*\{[^}]*return true;\s*\}/s);
});

test("Device Agent v2 exposes stock, accessibility, device-owner, local ADB, kiosk and native audio tiers",()=>{
  const caps=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentCapabilities.java");
  for(const capability of ["bootAutoStart","agentHttpApi","globalNavigation","navigationHome","navigationBack","navigationRecents","deviceOwnerProvisioning","localAdbPairing","wirelessAdbDiscovery","legacyAdbPortSwitch","rootProbe","kioskAlwaysOn","kioskSelfHeal","nativeSendspin"]){
    assert.match(caps,new RegExp(`\\"${capability}\\"`));
  }
});

test("Accessibility global actions do not claim arbitrary input support",()=>{
  const caps=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentCapabilities.java");
  assert.match(caps,/inputInjection",cap\(false,"not-implemented"/);
  assert.doesNotMatch(caps,/inputInjection",cap\(accessibilityEnabled/);
  assert.match(caps,/navigationHome",cap\(accessibilityEnabled,"accessibility"/);
  assert.match(caps,/navigationBack",cap\(accessibilityEnabled,"accessibility"/);
  assert.match(caps,/navigationRecents",cap\(accessibilityEnabled,"accessibility-oem"/);
});

test("Managed Displays capability UI parses and gates optional controls",()=>{
  const ui="public/managed-displays/agent-capability-ui.js";
  const r=spawnSync(process.execPath,["--check",ui],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const source=read(ui);
  const html=read("public/managed-displays/index.html");
  assert.match(html,/agent-capability-ui\.js/);
  assert.match(source,/navigationHome/);
  assert.match(source,/navigationBack/);
  assert.match(source,/navigationRecents/);
  assert.match(source,/inputInjection/);
  assert.match(source,/Device Admin enabled/);
  assert.match(source,/Accessibility enabled/);
  assert.match(source,/OEM launcher/);
});

test("Managed Displays polling does not observe its own descendant mutations",()=>{
  const capsUi=read("public/managed-displays/agent-capability-ui.js");
  const v2Ui=read("public/managed-displays/agent-v2-ui.js");
  assert.match(capsUi,/observe\(root,\{childList:true\}\)/);
  assert.match(v2Ui,/observe\(root,\{childList:true\}\)/);
  assert.doesNotMatch(capsUi,/subtree:true/);
  assert.doesNotMatch(v2Ui,/subtree:true/);
  assert.match(capsUi,/const REFRESH_MS=30000/);
  assert.match(v2Ui,/const PROBE_MS=30000/);
  assert.match(capsUi,/box\.replaceChildren\(/);
  assert.doesNotMatch(capsUi,/\.innerHTML\s*=/);
});

test("always-on kiosk recovery is process-level and bounded below thirty seconds",()=>{
  const watchdog=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/KioskWatchdog.java");
  const activity=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/MainActivity.java");
  const service=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentService.java");
  assert.match(watchdog,/RELAUNCH_AFTER_MS=20_000L/);
  assert.match(watchdog,/CHECK_SECONDS=10/);
  assert.match(watchdog,/SCREEN_BRIGHT_WAKE_LOCK/);
  assert.match(watchdog,/MainActivity\.launch/);
  assert.match(activity,/KioskWatchdog\.markDisplayPaused/);
  assert.match(activity,/FLAG_KEEP_SCREEN_ON/);
  assert.match(service,/KioskWatchdog\.start/);
});

test("Accessibility activation is guided by a foreground helper activity",()=>{
  const manifest=read("agents/android-tv/app/src/main/AndroidManifest.xml");
  const helper=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AccessibilityActivationActivity.java");
  const service=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentService.java");
  const ui=read("public/managed-displays/agent-v2-ui.js");
  assert.match(manifest,/\.AccessibilityActivationActivity/);
  assert.match(helper,/ACTION_ACCESSIBILITY_SETTINGS/);
  assert.match(service,/open-accessibility-settings/);
  assert.match(ui,/Enable Accessibility/);
});

test("native Sendspin player is independent of the WebView and constrained to PCM baseline",()=>{
  const gradle=read("agents/android-tv/app/build.gradle.kts");
  const manager=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/NativeSendspinManager.kt");
  const player=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AndroidPcmSendspinPlayer.kt");
  const service=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentService.java");
  assert.match(gradle,/sendspin-jvm:v0\.3\.4/);
  assert.match(manager,/SendSpinClient/);
  assert.match(manager,/AudioFormat\("pcm", 2, 48_000, 16\)/);
  assert.match(manager,/OptionalRole\.PLAYER/);
  assert.match(player,/AudioTrack/);
  assert.match(player,/ENCODING_PCM_16BIT/);
  assert.match(service,/sendspin-configure/);
  assert.match(service,/sendspin-reconnect/);
  assert.match(service,/o\.put\("sendspin"/);
});

test("local ADB recovery is first-party and root is policy gated",()=>{
  const service=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/AgentService.java");
  const root=read("agents/android-tv/app/src/main/java/org/roomgoblin/display/RootTools.java");
  assert.match(service,/local-adb-pair/);
  assert.match(service,/local-adb-connect/);
  assert.match(service,/local-adb-self-grant/);
  assert.match(service,/local-adb-switch-port/);
  assert.match(root,/allow_root_tools/);
  assert.match(root,/Root tools are disabled by RoomGoblin policy/);
});

test("browser receives redacted Agent v2 configuration",()=>{
  const bridge=read("maintenance-agent/android-tv-agent-v2.js");
  const library=read("maintenance-agent/android-tv-lib.js");
  assert.match(bridge,/device:publicDevice\(updated\)/);
  assert.match(library,/const \{token,\.\.\.agentV2\}=device\.agentV2/);
  assert.match(library,/tokenConfigured:Boolean\(token\)/);
  assert.doesNotMatch(bridge,/res\.json\([^\n]*agentToken/);
});

test("Device Agent v2 architecture and hardware validation are documented",()=>{
  const docs=read("docs/DEVICE-AGENT-V2.md");
  const wiki=read("wiki/Device-Agent-v2.md");
  const validation=read("docs/ANDROID-TV-HARDWARE-VALIDATION.md");
  const aiValidation=read("docs/ai/ANDROID-TV-HARDWARE-VALIDATION.md");
  const wikiValidation=read("wiki/Android-TV-Hardware-Validation.md");
  assert.match(docs,/capability-discovery build/i);
  assert.match(docs,/Root is \*\*not\*\* a production requirement/);
  assert.match(docs,/libadb-android/);
  assert.match(wiki,/dual-channel design/);
  assert.match(validation,/Device Administrator.*physically validated/is);
  assert.match(validation,/GLOBAL_ACTION_RECENTS.*no visible/is);
  assert.match(aiValidation,/inputInjection.*false/is);
  assert.match(wikiValidation,/Home.*validated/is);
});
