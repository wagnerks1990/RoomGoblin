"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

test("existing-appliance migration guides enter the updater before source changes", () => {
  for (const file of ["docs/HOST-NETWORKING.md", "docs/MUSIC-ASSISTANT-SENDSPIN.md",
    "wiki/Host-Networking.md", "wiki/Music-Assistant-Sendspin.md"]) {
    const text = fs.readFileSync(file, "utf8");
    assert.match(text, /update-production\.sh --full/);
    assert.doesNotMatch(text, /Pull current main|updating the checkout to the approved commit/);
  }
});

test("native installer admission rejects incomplete, stale and unowned recovery evidence", () => {
  const result = spawnSync("python3", ["test/installer_transaction_test.py"], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /Ran 5 tests/);
});

test("manual reinstall routes before mutations and never bypasses the native transaction", t => {
  const source = fs.readFileSync("install.sh", "utf8");
  const start = source.indexOf("# Existing appliances have exactly one transaction owner.");
  const end = source.indexOf("# Confirm the exact validated image pair", start);
  assert.ok(start > 0 && end > start);
  const guard = source.slice(start, end);
  assert.ok(start < source.indexOf('mkdir -p "$BACKUP_ROOT"'));
  assert.ok(start < source.indexOf('rsync -a'));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "roomgoblin-reinstall-"));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const target = path.join(root, "appliance"), bin = path.join(root, "bin");
  fs.mkdirSync(target); fs.mkdirSync(bin);
  for (const name of ["docker", "git", "python3", "env"]) {
    fs.writeFileSync(path.join(bin, name), '#!/bin/sh\nprintf "%s\\n" "' + name + ' $*" >> "$COMMAND_LOG"\ncase "' + name + '" in docker) exit "$DOCKER_EXISTS";; git) printf "%040d\\n" 0;; python3) exit "$BASELINE_STATUS";; env) exit 0;; esac\n');
    fs.chmodSync(path.join(bin, name), 0o700);
  }
  const run = (mode, exists = '1', baseline = '0') => {
    const log = path.join(root, "commands"); fs.writeFileSync(log, "");
    const result = spawnSync("bash", ["-c", 'fail(){ echo "$*" >&2; exit 71; }; ' + guard], {
      encoding: "utf8", env: {...process.env, PATH: `${bin}:${process.env.PATH}`, TARGET: target,
        SOURCE: path.resolve('.'), INSTALL_MODE: mode, COMMAND_LOG: log, DOCKER_EXISTS: exists, BASELINE_STATUS: baseline}
    });
    return {...result, commands: fs.readFileSync(log, 'utf8')};
  };
  assert.equal(run('pull').status, 0, 'fresh bootstrap is unaffected');
  assert.equal(run('build-local').status, 0, 'isolated fresh local builds remain available');
  fs.writeFileSync(path.join(target, '.classroom-hub-installation'), 'synthetic');
  fs.writeFileSync(path.join(target, '.env'), 'synthetic=true');
  fs.mkdirSync(path.join(target, '.git'));
  const routed = run('pull');
  assert.equal(routed.status, 0, routed.stderr);
  assert.match(routed.commands, /python3 .*--baseline/);
  assert.match(routed.commands, /env CLASSROOM_HUB_DIR=.*update-production.sh --full/);
  const drifted = run('pull', '1', '1');
  assert.equal(drifted.status, 71);
  assert.ok(!drifted.commands.includes('env CLASSROOM_HUB_DIR='));
  const local = run('build-local');
  assert.equal(local.status, 71);
  assert.ok(!local.commands.includes('env CLASSROOM_HUB_DIR='));
});
