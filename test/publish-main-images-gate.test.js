"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const workflow=()=>fs.readFileSync(".github/workflows/publish-main-images.yml","utf8");

test("main image publisher starts directly for every main push",()=>{
  const source=workflow();
  assert.match(source,/on:\n  push:\n    branches: \[main\]/);
  assert.doesNotMatch(source,/workflow_run:/);
  assert.doesNotMatch(source,/github\.event\.workflow_run/);
});

test("main image publisher gates the exact pushed SHA on every required workflow",()=>{
  const source=workflow();
  assert.match(source,/VALIDATED_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(source,/actions\/runs\?head_sha=\$\{VALIDATED_SHA\}&event=push/);
  for(const name of ["Validate","Display browser regression","Security gates"])
    assert.ok(source.includes(`'${name}'`),`missing publication gate: ${name}`);
  assert.match(source,/ref: \$\{\{ github\.sha \}\}/);
  assert.match(source,/org\.opencontainers\.image\.revision=\$\{\{ github\.sha \}\}/);
  assert.match(source,/current_main_sha.*VALIDATED_SHA/);
});

test("main image publisher scans and smokes the exact local candidate before pushing it",()=>{
  const source=workflow();
  assert.match(source,/load: true/);
  assert.match(source,/push: false/);
  assert.match(source,/Scan exact publication candidate[\s\S]+Smoke exact publication candidate[\s\S]+Publish the scanned candidate without rebuilding/);
  assert.doesNotMatch(source,/Build exact publication candidate[\s\S]+push: true/);
});
