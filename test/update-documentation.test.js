"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("operator update guides preserve image-first main updates and migration handoff", () => {
  for (const file of ["INSTALL.md", "GITHUB-MIGRATION.md", "docs/DEPLOYMENT.md",
    "docs/OPERATIONS.md", "docs/DEVELOPMENT.md", "wiki/Operations.md",
    "wiki/Installation-and-Deployment.md", "wiki/Development.md"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /deploy\/update-production\.sh/, file);
    assert.match(source, /PRODUCTION-UPDATES\.md|\]\(Production-Updates\)/, file);
    for (const block of source.matchAll(/```(?:bash|sh)?\n([\s\S]*?)```/g)) {
      assert.doesNotMatch(block[1], /^(?:sudo\s+)?git\s+pull\b/m, file);
    }
  }
});
