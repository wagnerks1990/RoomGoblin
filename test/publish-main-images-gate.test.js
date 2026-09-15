"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");

const workflow=()=>fs.readFileSync(".github/workflows/publish-main-images.yml","utf8");

test("main image publisher accepts successful Validate pushes without optional head_repository metadata",()=>{
  const source=workflow();
  assert.match(source,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(source,/github\.event\.workflow_run\.event == 'push'/);
  assert.match(source,/github\.event\.workflow_run\.head_branch == 'main'/);
  assert.doesNotMatch(source,/workflow_run\.head_repository/);
});

test("main image publisher still gates the exact validated SHA on every required workflow",()=>{
  const source=workflow();
  assert.match(source,/VALIDATED_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(source,/actions\/runs\?head_sha=\$\{VALIDATED_SHA\}&event=push/);
  for(const name of ["Validate","Display browser regression","Security gates"])
    assert.ok(source.includes(`'${name}'`),`missing publication gate: ${name}`);
  assert.match(source,/current_main_sha.*VALIDATED_SHA/);
});
