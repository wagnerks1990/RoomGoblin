"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");

const nativeFiles = [
  "windows-agent/RoomGoblin.Agent.Service/RoomGoblin.Agent.Service.csproj",
  "windows-agent/RoomGoblin.Agent.Service/Program.cs",
  "windows-agent/RoomGoblin.Agent.Service/AgentWorker.cs",
  "windows-agent/RoomGoblin.Agent.Service/AgentWorker.Commands.cs",
  "windows-agent/RoomGoblin.Agent.Service/AgentWorker.Connection.cs",
  "windows-agent/RoomGoblin.Agent.Service/AgentWorker.Transport.cs",
  "windows-agent/RoomGoblin.Agent.Service/InteractiveSession.cs",
  "windows-agent/RoomGoblin.Agent.Service/SessionBridge.cs",
  "windows-agent/RoomGoblin.Agent.Service/BrowserHistoryCollector.cs",
  "windows-agent/RoomGoblin.Agent.Service/NativeUpdateClient.cs",
  "windows-agent/RoomGoblin.Agent.Service/AuthenticodeVerifier.cs",
  "windows-agent/RoomGoblin.Agent.Session/RoomGoblin.Agent.Session.csproj",
  "windows-agent/RoomGoblin.Agent.Session/Program.cs",
  "windows-agent/RoomGoblin.Agent.Bootstrap/RoomGoblin.Agent.Bootstrap.csproj",
  "windows-agent/RoomGoblin.Agent.Bootstrap/Program.cs",
  "windows-agent/RoomGoblin.Agent.Updater/RoomGoblin.Agent.Updater.csproj",
  "windows-agent/RoomGoblin.Agent.Updater/Program.cs",
  "windows-agent/scripts/Build-Native-Agent.ps1"
];

test("native Windows agent source surface is complete", () => {
  for (const relative of nativeFiles) {
    assert.ok(fs.existsSync(path.join(ROOT, relative)), `missing ${relative}`);
    assert.ok(fs.statSync(path.join(ROOT, relative)).size > 0, `empty ${relative}`);
  }
});

test("native agent version is repository driven", () => {
  const worker = read("windows-agent/RoomGoblin.Agent.Service/AgentWorker.cs");
  const build = read("windows-agent/scripts/Build-Native-Agent.ps1");
  assert.doesNotMatch(worker, /1\.0\.0-alpha\.\d+/);
  assert.match(worker, /AssemblyInformationalVersionAttribute/);
  assert.match(build, /\.\.\\\.\.\\VERSION/);
  assert.match(build, /-p:InformationalVersion=\$roomGoblinVersion/);
});

test("native interactive helper keeps one-use authenticated pipe boundary", () => {
  const bridge = read("windows-agent/RoomGoblin.Agent.Service/SessionBridge.cs");
  assert.match(bridge, /NamedPipeServerStreamAcl\.Create/);
  assert.match(bridge, /RandomNumberGenerator\.GetBytes\(32\)/);
  assert.match(bridge, /WellKnownSidType\.LocalSystemSid/);
  assert.match(bridge, /session\.UserSid/);
  assert.match(bridge, /CryptographicOperations\.FixedTimeEquals/);
  assert.match(bridge, /CreateProcessAsUser/);
  assert.match(bridge, /winsta0\\default/);
});

test("native update path is allowlisted, hashed, optionally signed, and rollback capable", () => {
  const client = read("windows-agent/RoomGoblin.Agent.Service/NativeUpdateClient.cs");
  const updater = read("windows-agent/RoomGoblin.Agent.Updater/Program.cs");
  assert.match(client, /\/lab-agent\/native\/manifest\.json/);
  assert.match(client, /AllowedFiles/);
  assert.match(client, /SHA256\.HashData/);
  assert.match(client, /AuthenticodeVerifier\.Verify/);
  assert.match(updater, /rollback-/);
  assert.match(updater, /WaitForHealth/);
  assert.match(updater, /expectedVersion/);
});

test("appliance Docker image cross-builds and packages native agent", () => {
  const docker = read("Dockerfile");
  assert.match(docker, /mcr\.microsoft\.com\/dotnet\/sdk:8\.0-bookworm-slim AS native-agent-build/);
  assert.match(docker, /-r win-x64/);
  assert.match(docker, /-p:EnableWindowsTargeting=true/);
  assert.match(docker, /public\/lab-agent\/native\/RoomGoblinAgent\.exe/);
  assert.match(docker, /manifest\.json/);
  assert.match(docker, /createHash\("sha256"\)/);
});

test("native command compatibility and deliberate safety refusals are preserved", () => {
  const commands = read("windows-agent/RoomGoblin.Agent.Service/AgentWorker.Commands.cs");
  for (const action of [
    "message", "restart", "shutdown", "cancel-shutdown", "logoff",
    "lock", "instructor-lock", "screenshot", "run-preset",
    "refresh-history", "browser-history", "update-agent"
  ]) assert.match(commands, new RegExp(`case \\\"${action}\\\"`));
  assert.match(commands, /instructor-unlock/);
  assert.match(commands, /cannot be remotely unlocked safely/);
  assert.match(commands, /app-lock/);
  assert.match(commands, /AppLocker/);
});
