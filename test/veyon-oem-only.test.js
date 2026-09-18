"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");

test("Veyon stays on the OEM-only source boundary",()=>{
  const absent=[
    "integrations/veyon-plugins",
    "integrations/veyon-ai",
    "src/veyon-free-features.js",
    "src/veyon-browser-sessions.js",
    "src/veyon-ai.js",
    "public/controller/veyon-free-features.js",
    "public/controller/veyon-community.js",
    "public/controller/veyon-terminal.js",
    "public/controller/veyon-control.js",
    "tools/package-veyon-pilot.sh",
    "tools/package-veyon-pilot-windows.sh",
    "tools/prepare-veyon-pilot.py",
    "deploy/test-veyon-windows-pilot.ps1"
  ];
  for(const rel of absent)assert.equal(fs.existsSync(path.join(root,rel)),false,rel+" must not return");

  const html=fs.readFileSync(path.join(root,"public/controller/veyon.html"),"utf8");
  assert.doesNotMatch(html,/freeFeatureTools|Free features and experimental tools|communityDialog|terminalDialog|startBrowserControl|controlCanvas/);

  const server=fs.readFileSync(path.join(root,"src/server.js"),"utf8");
  assert.doesNotMatch(server,/veyon-free-features|veyon-browser-sessions|\.\/veyon-ai|\/api\/v1\/veyon\/(?:wake|lesson-actions)|\/terminal\/:action|\/browser\/:action/);

  const workflow=fs.readFileSync(path.join(root,".github/workflows/validate.yml"),"utf8");
  assert.doesNotMatch(workflow,/^  veyon-(?:pilot|ai):/m);
});
