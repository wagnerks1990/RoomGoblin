"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("Windows lab-agent manifest has a defined public directory", () => {
  const server = read("src/server.js");

  assert.match(
    server,
    /const\s+APP_DIR\s*=\s*path\.resolve\(__dirname,\s*["']\.\.["']\);/
  );

  assert.match(
    server,
    /const\s+PUBLIC_DIR\s*=\s*path\.join\(APP_DIR,\s*["']public["']\);/,
    "PUBLIC_DIR must be defined before the lab-agent manifest route uses it"
  );

  assert.match(
    server,
    /path\.join\(PUBLIC_DIR,\s*["']lab-agent["'],\s*["']ClassroomHubAgent\.ps1["']\)/
  );
});

test("Windows lab-agent package exists and produces a SHA-256 manifest value", () => {
  const agentPath = path.join(
    ROOT,
    "public",
    "lab-agent",
    "ClassroomHubAgent.ps1"
  );

  assert.ok(fs.existsSync(agentPath), "Windows lab-agent package must exist");

  const hash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(agentPath))
    .digest("hex");

  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("Windows installer applies ACLs to agent and config separately", () => {
  const installer = read("public/lab-agent/Install-Agent.ps1");

  assert.doesNotMatch(
    installer,
    /icacls\.exe\s+\$agent\s+\$config\b/,
    "icacls must not receive the config path as a second target parameter"
  );

  assert.match(
    installer,
    /foreach\s*\(\$installedFile\s+in\s+@\(\$agent,\$config\)\)/
  );

  assert.match(
    installer,
    /icacls\.exe\s+\$installedFile\s+\/inheritance:r/
  );

  assert.match(
    installer,
    /Could not secure installed agent file:\s+\$installedFile/
  );
});
