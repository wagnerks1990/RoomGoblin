"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs");
const {spawnSync} = require("node:child_process");

test("CI selection fails closed for main, unknown paths, renames and unavailable changes", () => {
  const result = spawnSync("python3", ["test/ci_scope_test.py"], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Ran 5 tests/);
});

test("native artifact qualification lives in the required Windows job without duplicate compilation", () => {
  const source = fs.readFileSync(".github/workflows/validate.yml", "utf8");
  const windows = source.split("\n  windows-agent:")[1].split("\n  android-agent:")[0];
  assert.equal((windows.match(/Build-Native-Agent\.ps1/g) || []).length, 1);
  for (const name of ["RoomGoblinAgent.exe", "RoomGoblinSessionAgent.exe", "RoomGoblinAgentBootstrap.exe", "RoomGoblinAgentUpdater.exe"])
    assert.ok(windows.includes(name));
  assert.match(windows, /ProductVersion/);
  assert.match(windows, /RoomGoblin-native-agent-win-x64/);
  assert.match(windows, /if-no-files-found: error/);
  assert.equal(fs.existsSync(".github/workflows/windows-native-agent.yml"), false);
  assert.equal(fs.existsSync(".github/workflows/apply-automation-convergence.yml"), false);
});

test("documentation selection preserves workflow identities and fail-closed step defaults", () => {
  for (const file of ["validate.yml", "display-browser.yml"]) {
    const source = fs.readFileSync(`.github/workflows/${file}`, "utf8");
    assert.match(source, /CI_EVENT_NAME: \$\{\{ github.event_name \}\}/);
    assert.match(source, /CI_BASE_SHA: \$\{\{ github.event.pull_request.base.sha \}\}/);
    assert.match(source, /if: steps.scope.outputs.full != 'false'/);
    assert.doesNotMatch(source, /paths-ignore:/);
  }
  const source = fs.readFileSync(".github/workflows/validate.yml", "utf8");
  for (const name of ["Run stabilization regression tests", "Audit production dependencies", "Audit maintenance production dependencies"])
    assert.ok(!source.split(`      - name: ${name}`)[1].split("      - name:")[0].includes("if: steps.scope"));
});
