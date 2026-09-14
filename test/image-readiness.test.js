"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawnSync}=require("node:child_process");
const revision="a".repeat(40),root=process.cwd();
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rg-publication-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const bin=path.join(dir,"bin");fs.mkdirSync(bin);return {dir,bin,write(name,body){fs.writeFileSync(path.join(bin,name),"#!/bin/bash\n"+body,{mode:0o755})}}}
test("CI diagnostics distinguish failed, pending, rerun, and unrelated workflows",()=>{
 const run=(name,conclusion,id=1,extra={})=>({name,head_sha:revision,event:name==="Publish Main Images"?"workflow_run":"push",status:"completed",conclusion,id,...extra});
 for(const [runs,code] of [
  [[run("Display browser regression","failure")],2],[[run("Publish Main Images","failure")],2],
  [[run("Validate","failure"),run("Validate",null,2,{status:"in_progress"})],0],
  [[run("Validate","failure",1,{head_sha:"b".repeat(40)})],0],[[run("Validate","failure",1,{event:"pull_request"})],0],
  [[run("Unrelated update","failure")],0],[[],0]
 ]){
  const result=spawnSync("python3",["-c",'import runpy,json,sys; m=runpy.run_path("deploy/image-readiness.py"); c,s=m["classify_runs"](json.load(sys.stdin),sys.argv[1]); print(s); sys.exit(c)',revision],{encoding:"utf8",input:JSON.stringify({workflow_runs:runs})});
  assert.equal(result.status,code,result.stderr);if(code===2)assert.match(result.stdout,/Publication blocked/);
 }
});
test("missing images are probed quietly; a failed CI gate never downloads or changes images",t=>{
 const f=fixture(t);f.write("docker",'echo "$*" >> "$EVENTS"\nif [[ "$1" == info ]]; then exit 0; fi\necho "manifest unknown private noise" >&2\nexit 1\n');
 f.write("python3",'echo "Publication blocked: Display browser regression failure."\nexit 2');
 const events=path.join(f.dir,"events"),r=spawnSync("bash",["-c",`. deploy/image-readiness.sh; roomgoblin_wait_image_pair ${revision} hub maint`],{encoding:"utf8",env:{...process.env,PATH:`${f.bin}:${process.env.PATH}`,EVENTS:events}});
 assert.notEqual(r.status,0);assert.match(r.stderr,/Publication blocked/);assert.doesNotMatch(r.stdout+r.stderr,/manifest unknown|private noise/);assert.doesNotMatch(fs.readFileSync(events,"utf8"),/pull/);
});
test("both manifests must exist before either pull, and both revisions are verified",t=>{
 const f=fixture(t);f.write("sleep",'exit 0');
 f.write("python3",'echo "Waiting for CI publication."');
 f.write("docker",`echo "$*" >> "$EVENTS"
if [[ "$1" == manifest && "$3" == maint && ! -f "$FIRST" ]]; then touch "$FIRST"; echo "not found" >&2; exit 1; fi
if [[ "$1" == image ]]; then echo "$REVISION"; fi
exit 0`);
 const env={...process.env,PATH:`${f.bin}:${process.env.PATH}`,EVENTS:path.join(f.dir,"events"),FIRST:path.join(f.dir,"first"),REVISION:revision};
 let r=spawnSync("bash",["-c",`. deploy/image-readiness.sh; roomgoblin_wait_image_pair ${revision} hub maint`],{encoding:"utf8",env});assert.equal(r.status,0,r.stderr);
 const events=fs.readFileSync(env.EVENTS,"utf8").trim().split("\n");assert.deepEqual(events.slice(0,5),["info","manifest inspect hub","manifest inspect maint","manifest inspect hub","manifest inspect maint"]);assert.equal(events.filter(x=>x.startsWith("pull")).length,2);assert.equal(events.filter(x=>x.startsWith("image inspect")).length,2);assert.doesNotMatch(r.stderr,/not found/);
 r=spawnSync("bash",["-c",`. deploy/image-readiness.sh; roomgoblin_wait_image_pair ${revision} hub maint`],{encoding:"utf8",env:{...env,REVISION:"b".repeat(40)}});assert.notEqual(r.status,0);assert.match(r.stderr,/source revision mismatch/);
});
function updateFixture(t){
 const f=fixture(t),origin=path.join(f.dir,"origin"),remote=path.join(f.dir,"remote.git"),local=path.join(f.dir,"local");
 function git(cwd,...args){const r=spawnSync("git",args,{cwd,encoding:"utf8",env:{...process.env,GIT_AUTHOR_NAME:"Fixture",GIT_AUTHOR_EMAIL:"fixture@example.invalid",GIT_COMMITTER_NAME:"Fixture",GIT_COMMITTER_EMAIL:"fixture@example.invalid"}});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 fs.mkdirSync(origin);git(origin,"init","-b","main");fs.writeFileSync(path.join(origin,"file"),"base");git(origin,"add",".");git(origin,"commit","-m","base");const base=git(origin,"rev-parse","HEAD");
 git(f.dir,"clone","--bare",origin,remote);git(f.dir,"clone",remote,local);
 fs.writeFileSync(path.join(origin,"file"),"published");git(origin,"commit","-am","published");const good=git(origin,"rev-parse","HEAD");git(origin,"push",remote,"HEAD:production");
 fs.writeFileSync(path.join(origin,"file"),"unpublished");git(origin,"commit","-am","unpublished");const bad=git(origin,"rev-parse","HEAD");git(origin,"push",remote,"main");
 fs.mkdirSync(path.join(local,"deploy"));fs.writeFileSync(path.join(local,"deploy/image-readiness.sh"),'roomgoblin_wait_image_pair(){ echo preflight >> "$EVENTS"; [[ "${FAIL_PREFLIGHT:-0}" == 0 ]]; }\n');fs.writeFileSync(path.join(local,"install.sh"),'echo installed >> "$EVENTS"\n');
 f.write("docker",'exit 0');const script=fs.readFileSync("deploy/update-production.sh","utf8").replace('[[ $EUID -eq 0 ]] || fail "run with sudo or as root"','');
 const events=path.join(f.dir,"events"),env={...process.env,PATH:`${f.bin}:${process.env.PATH}`,CLASSROOM_HUB_DIR:local,EVENTS:events};
 return {f,local,base,good,bad,git,events,run(extra={}){return spawnSync("bash",["-c",script],{encoding:"utf8",env:{...env,...extra}})}};
}
test("production updater selects the published source instead of newer main",t=>{
 const h=updateFixture(t),r=h.run();assert.equal(r.status,0,r.stderr);assert.equal(h.git(h.local,"rev-parse","HEAD"),h.good);assert.deepEqual(fs.readFileSync(h.events,"utf8").trim().split("\n"),["preflight","installed"]);
});
test("failed image preflight leaves source at its existing revision",t=>{
 const h=updateFixture(t),r=h.run({FAIL_PREFLIGHT:"1"});assert.notEqual(r.status,0);assert.equal(h.git(h.local,"rev-parse","HEAD"),h.base);assert.equal(fs.readFileSync(h.events,"utf8").trim(),"preflight");
});
test("an already advanced checkout is never silently downgraded",t=>{
 const h=updateFixture(t);h.git(h.local,"fetch","origin","main");h.git(h.local,"merge","--ff-only","origin/main");const r=h.run();assert.notEqual(r.status,0);assert.equal(h.git(h.local,"rev-parse","HEAD"),h.bad);assert.equal(fs.existsSync(h.events),false);assert.match(r.stderr,/refusing to downgrade/);
});
test("only successful pair promotion advances the production branch",()=>{
 const s=fs.readFileSync(".github/workflows/publish-main-images.yml","utf8"),promote=s.slice(s.indexOf("\n  promote:"));assert.match(promote,/needs: build/);assert.match(promote,/contents: write/);assert.ok(promote.indexOf('git/refs/heads/production')>promote.indexOf('docker buildx imagetools create'));assert.match(promote,/-F force=false/);assert.match(fs.readFileSync("deploy/bootstrap.sh","utf8"),/CLASSROOM_HUB_REF:-production/);
});
