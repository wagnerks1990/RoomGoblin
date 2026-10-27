"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto");
const {cleanupPresentationStaging}=require("../src/presentation-staging");
const linux={skip:process.platform!=="linux"?"Linux link/ownership policy":false};
function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-presentation-staging-")),root=path.join(dir,"presentation-upload-tmp");fs.mkdirSync(root);
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const render=()=>{const target=path.join(root,`render-${crypto.randomUUID()}`);fs.mkdirSync(target);return target};
  return {dir,root,render};
}

test("startup cleanup reclaims render output while preserving originals and unknown entries",t=>{
  const {dir,root,render}=fixture(t),stage=render();
  fs.mkdirSync(path.join(stage,"slides"));fs.writeFileSync(path.join(stage,"slides/raw-1.jpg"),"partial slide");fs.writeFileSync(path.join(stage,"presentation.pdf"),"copied PDF");
  const original=path.join(dir,"presentations/pres-fixture/original.pdf");fs.mkdirSync(path.dirname(original),{recursive:true});fs.writeFileSync(original,"original");
  fs.writeFileSync(path.join(root,"incoming.pdf"),"upload");fs.mkdirSync(path.join(root,"render-unknown"));
  const sameNamedFile=path.join(root,`render-${crypto.randomUUID()}`);fs.writeFileSync(sameNamedFile,"unknown");
  const result=cleanupPresentationStaging(root);
  assert.equal(result.removed,1);assert.equal(result.skipped,1);assert.equal(result.errors,0);
  assert.equal(fs.existsSync(stage),false);assert.equal(fs.readFileSync(original,"utf8"),"original");
  assert.equal(fs.readFileSync(path.join(root,"incoming.pdf"),"utf8"),"upload");assert.ok(fs.existsSync(path.join(root,"render-unknown")));assert.ok(fs.existsSync(sameNamedFile));
  assert.equal(cleanupPresentationStaging(root).removed,0);
});

test("cleanup never follows linked roots or render directories",linux,t=>{
  const {dir,root}=fixture(t),outside=path.join(dir,"outside");fs.mkdirSync(outside);fs.writeFileSync(path.join(outside,"keep"),"keep");
  const linkedRoot=path.join(dir,"linked-root");fs.symlinkSync(outside,linkedRoot,"dir");
  assert.equal(cleanupPresentationStaging(linkedRoot).skipped,1);
  fs.symlinkSync(outside,path.join(root,`render-${crypto.randomUUID()}`),"dir");
  assert.equal(cleanupPresentationStaging(root).skipped,1);assert.equal(fs.readFileSync(path.join(outside,"keep"),"utf8"),"keep");
});

test("unsafe nested links and hard links preserve their whole candidate tree",linux,t=>{
  const {dir,root,render}=fixture(t),outside=path.join(dir,"keep");fs.writeFileSync(outside,"keep");
  for(const type of ["symbolic","hard"]){
    const stage=render();fs.writeFileSync(path.join(stage,"partial.pdf"),"partial");
    if(type==="symbolic")fs.symlinkSync(outside,path.join(stage,"linked"));else fs.linkSync(outside,path.join(stage,"linked"));
  }
  const result=cleanupPresentationStaging(root);assert.equal(result.removed,0);assert.equal(result.skipped,2);
  for(const name of fs.readdirSync(root))assert.equal(fs.readFileSync(path.join(root,name,"partial.pdf"),"utf8"),"partial");
  assert.equal(fs.readFileSync(outside,"utf8"),"keep");
});

test("node budget validates a complete tree before deleting any files",t=>{
  const {root,render}=fixture(t),stage=render();for(let i=0;i<3;i++)fs.writeFileSync(path.join(stage,String(i)),"partial");
  const result=cleanupPresentationStaging(root,{maxNodes:2});assert.equal(result.removed,0);assert.equal(result.limited,true);
  assert.equal(fs.readdirSync(stage).length,3);assert.equal(cleanupPresentationStaging(root).removed,1);
});

test("directory and scan budgets bound a startup pass without broad cleanup",t=>{
  const {root,render}=fixture(t);for(let i=0;i<3;i++)render();
  const result=cleanupPresentationStaging(root,{maxDirectories:1});assert.equal(result.removed,1);assert.equal(result.limited,true);assert.equal(fs.readdirSync(root).length,2);
  assert.equal(cleanupPresentationStaging(root,{maxEntries:1}).removed,1);assert.equal(fs.readdirSync(root).length,1);
  assert.equal(cleanupPresentationStaging(root).removed,1);
});
