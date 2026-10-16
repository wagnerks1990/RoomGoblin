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
[ "$GIT_ASKPASS" = /bin/false ] || exit 83
for argument do
  case "$argument" in credential.helper=/*) helper=$(printf '%s' "$argument" | cut -d= -f2-);; esac
done
response=$(printf 'protocol=https\\nhost=github.com\\npath=%s.wiki.git\\n\\n' "$GITHUB_REPOSITORY" | "$helper" get)
case "$response" in *"password=$GH_TOKEN"*) ;; *) exit 84;; esac
printf '%s' "$helper" > "$ASKPASS_RECORD"
printf '%s\\n' "$@" > "$ARGUMENT_RECORD"
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
          ASKPASS_RECORD: record, ARGUMENT_RECORD: path.join(root, "arguments"), MOCK_GIT_STATUS: String(status), MOCK_WIKI_ROOT: root}
      });
      assert.equal(result.status, status, result.stderr);
      assert.equal(fs.existsSync(fs.readFileSync(record, "utf8")), false, "credential helper is removed after success and failure");
      const argumentsText = fs.readFileSync(path.join(root, "arguments"), "utf8");
      assert.match(argumentsText, /credential.useHttpPath=true/);
      assert.match(argumentsText, /http.followRedirects=false/);
      assert.match(argumentsText, /https:\/\/github.com\/example\/synthetic.wiki.git/);
      if (name === "Clone Wiki") assert.match(argumentsText, /clone\n--no-checkout\n/);
      assert.ok(!result.stdout.includes("synthetic-wiki-token") && !result.stderr.includes("synthetic-wiki-token"));
    }
  }
  assert.ok(workflow.includes("persist-credentials: false"));
  assert.ok(!workflow.includes("https://x-access-token:"));
});

test("Wiki credentials are offered only to the exact HTTPS GitHub Wiki path", () => {
  const helper = path.resolve("scripts/wiki-credential-helper.sh");
  const env = {...process.env, GH_TOKEN: "synthetic-wiki-token", GITHUB_REPOSITORY: "example/synthetic",
    GIT_ASKPASS: "/bin/false", GIT_TERMINAL_PROMPT: "0"};
  for (const [protocol, host, credentialPath, accepted] of [
    ["https", "github.com", "example/synthetic.wiki.git", true],
    ["https", "attacker.invalid", "example/synthetic.wiki.git", false],
    ["http", "github.com", "example/synthetic.wiki.git", false],
    ["https", "github.com:444", "example/synthetic.wiki.git", false],
    ["https", "github.com.attacker.invalid", "example/synthetic.wiki.git", false],
    ["https", "github.com", "other/repository.wiki.git", false],
    ["https", "github.com", "example/synthetic.git", false],
    ["https", "github.com", "", false],
  ]) {
    const result = spawnSync("git", ["-c", "credential.helper=", "-c", `credential.helper=!sh "${helper}"`,
      "-c", "credential.useHttpPath=true", "credential", "fill"], {
      encoding: "utf8", env, input: `protocol=${protocol}\nhost=${host}\npath=${credentialPath}\n\n`
    });
    assert.equal(result.status === 0, accepted, `${protocol}://${host}/${credentialPath}`);
    assert.equal(result.stdout.includes(env.GH_TOKEN), accepted);
    assert.ok(!result.stderr.includes(env.GH_TOKEN));
  }
  for (const operation of ["store", "erase"]) {
    const result = spawnSync("sh", [helper, operation], {encoding: "utf8", env,
      input: "protocol=https\nhost=github.com\npath=example/synthetic.wiki.git\n\n"});
    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
  }
});
