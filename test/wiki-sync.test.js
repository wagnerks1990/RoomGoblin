"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const workflow = fs.readFileSync(".github/workflows/sync-wiki.yml", "utf8");

function script(name) {
  const section = workflow.split(`      - name: ${name}\n`)[1].split("\n      - name:")[0];
  return section.split("        run: |\n")[1].split("\n").map(line => line.replace(/^          /, "")).join("\n");
}

test("hosted Wiki credentials are transient and never enter Git arguments or remotes", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "roomgoblin-wiki-auth-"));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.writeFileSync(path.join(root, "git"), `#!/bin/sh
case "$*" in *"$GH_TOKEN"*) exit 81;; esac
[ "$GIT_TERMINAL_PROMPT" = 0 ] || exit 82
[ "$($GIT_ASKPASS 'Username for https://github.com')" = x-access-token ] || exit 83
[ "$($GIT_ASKPASS 'Password for https://github.com')" = "$GH_TOKEN" ] || exit 84
printf '%s' "$GIT_ASKPASS" > "$ASKPASS_RECORD"
exit "$MOCK_GIT_STATUS"
`);
  fs.chmodSync(path.join(root, "git"), 0o700);
  for (const name of ["Clone Wiki", "Push Wiki"]) {
    const section = workflow.split(`      - name: ${name}\n`)[1].split("\n      - name:")[0];
    assert.ok(section.includes("secrets.WIKI_TOKEN || secrets.WIKI_PUSH_TOKEN || github.token"));
    for (const status of [0, 17]) {
      const record = path.join(root, "askpass-record");
      const result = spawnSync("bash", ["-c", script(name).replace("cd /tmp/wiki", 'cd "$MOCK_WIKI_ROOT"')], {
        encoding: "utf8", env: {...process.env, PATH: `${root}:${process.env.PATH}`,
          GH_TOKEN: "synthetic-wiki-token", GITHUB_REPOSITORY: "example/synthetic",
          ASKPASS_RECORD: record, MOCK_GIT_STATUS: String(status), MOCK_WIKI_ROOT: root}
      });
      assert.equal(result.status, status, result.stderr);
      assert.equal(fs.existsSync(fs.readFileSync(record, "utf8")), false, "askpass is removed after success and failure");
      assert.ok(!result.stdout.includes("synthetic-wiki-token") && !result.stderr.includes("synthetic-wiki-token"));
    }
  }
  assert.ok(workflow.includes("persist-credentials: false"));
  assert.ok(!workflow.includes("https://x-access-token:"));
});
