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
 const runnerSource='#!/bin/bash\nset -e\nROOMGOBLIN_UPDATE_SOURCE=main\nsource "$CLASSROOM_HUB_DIR/deploy/image-readiness.sh"\nroomgoblin_wait_image_pair || exit 1\nif [[ "${3:-}" == --full ]]; then echo migration-full >> "$EVENTS"; fi\ngit merge --ff-only "$2"\nbash install.sh\n';
 fs.mkdirSync(origin);git(origin,"init","-b","main");
 fs.mkdirSync(path.join(origin,"host-agent"));fs.writeFileSync(path.join(origin,"host-agent/app-update-runner.sh"),runnerSource);
 fs.writeFileSync(path.join(origin,"file"),"base");git(origin,"add",".");git(origin,"commit","-m","base");const base=git(origin,"rev-parse","HEAD");
 git(f.dir,"clone","--bare",origin,remote);git(f.dir,"clone",remote,local);
 fs.writeFileSync(path.join(origin,"file"),"previous");git(origin,"commit","-am","previous");const previous=git(origin,"rev-parse","HEAD");git(origin,"push",remote,"HEAD:production");
 fs.writeFileSync(path.join(origin,"file"),"latest main");git(origin,"commit","-am","latest main");const latest=git(origin,"rev-parse","HEAD");git(origin,"push",remote,"main");
 fs.mkdirSync(path.join(local,"deploy"));
 fs.writeFileSync(path.join(local,"deploy/image-readiness.sh"),'roomgoblin_wait_image_pair(){ echo preflight >> "$EVENTS"; [[ "${FAIL_PREFLIGHT:-0}" == 0 ]]; }\n');
 fs.writeFileSync(path.join(local,"deploy/update-plan.py"),'import json,sys\nprint(json.dumps({"target":sys.argv[1]}))\n');
 fs.writeFileSync(path.join(local,"install.sh"),'echo installed >> "$EVENTS"\n');
 const realGit=spawnSync("which",["git"],{encoding:"utf8"}).stdout.trim();
 // Keep real local Git transport while substituting only the trusted origin metadata.
 f.write("git",`if [[ "$1 $2 $3" == 'remote get-url origin' ]]; then echo "${'${ORIGIN_RESULT:-https://github.com/wagnerks1990/RoomGoblin.git}'}"; exit 0; fi\nif [[ "$1" == fetch ]]; then echo "$*" >> "$GIT_EVENTS"; fi\nexec ${realGit} "$@"\n`);
 f.write("docker",'exit 0');
 const runner=path.join(f.dir,'runner.sh');fs.writeFileSync(runner,runnerSource);
 const script=fs.readFileSync("deploy/update-production.sh","utf8")
   .replaceAll('/usr/local/libexec/classroom-control-hub/app-update-runner.sh',runner)
   .replace('/run/roomgoblin-main-runner.',f.dir+'/candidate.')
   .replace('[[ $EUID -eq 0 ]] || fail "run with sudo or as root"','');
 const events=path.join(f.dir,"events"),gitEvents=path.join(f.dir,"git-events");
 const env={...process.env,PATH:`${f.bin}:${process.env.PATH}`,CLASSROOM_HUB_DIR:local,EVENTS:events,GIT_EVENTS:gitEvents};
 return {f,origin,remote,local,base,previous,latest,runner,git,events,gitEvents,run(extra={},mode){return spawnSync("bash",["-c",script,"fixture-updater",...(mode?[mode]:[])],{encoding:"utf8",env:{...env,...extra}})}};
}
test("main updater selects latest main rather than the stale production branch",t=>{
 const h=updateFixture(t),r=h.run();assert.equal(r.status,0,r.stderr);assert.equal(h.git(h.local,"rev-parse","HEAD"),h.latest);
 assert.deepEqual(fs.readFileSync(h.events,"utf8").trim().split("\n"),["preflight","installed"]);
 assert.doesNotMatch(fs.readFileSync(h.gitEvents,"utf8"),/production/);
});
test("main updates do not require a production branch to exist",t=>{
 const h=updateFixture(t);h.git(h.remote,"branch","-D","production");const r=h.run();
 assert.equal(r.status,0,r.stderr);assert.equal(h.git(h.local,"rev-parse","HEAD"),h.latest);
});
test("failed image preflight leaves main source at its existing revision",t=>{
 const h=updateFixture(t),r=h.run({FAIL_PREFLIGHT:"1"});assert.notEqual(r.status,0);assert.equal(h.git(h.local,"rev-parse","HEAD"),h.base);assert.equal(fs.readFileSync(h.events,"utf8").trim(),"preflight");
});
test("locally ahead or divergent commits are never silently downgraded",t=>{
 const h=updateFixture(t);fs.writeFileSync(path.join(h.local,"file"),"local change");h.git(h.local,"commit","-am","local change");const current=h.git(h.local,"rev-parse","HEAD");
 const r=h.run();assert.notEqual(r.status,0);assert.equal(h.git(h.local,"rev-parse","HEAD"),current);assert.equal(fs.existsSync(h.events),false);assert.match(r.stderr,/refusing to downgrade/);
});
test("dirty tracked source and unrelated work branches are rejected before fetch",t=>{
 const h=updateFixture(t);fs.writeFileSync(path.join(h.local,"file"),"dirty");let r=h.run();assert.notEqual(r.status,0);assert.equal(fs.existsSync(h.gitEvents),false);
 h.git(h.local,"restore","file");h.git(h.local,"switch","-c","feature/unrelated");r=h.run();assert.notEqual(r.status,0);assert.equal(fs.existsSync(h.gitEvents),false);assert.equal(fs.existsSync(h.events),false);
});
test("unexpected origins cannot reach target-runner execution",t=>{
 const h=updateFixture(t),r=h.run({ORIGIN_RESULT:"https://example.invalid/untrusted.git"});
 assert.notEqual(r.status,0);assert.match(r.stderr,/unexpected origin/);assert.equal(fs.existsSync(h.gitEvents),false);assert.equal(fs.existsSync(h.events),false);
});
test("plan selects main without changing source or invoking any runner",t=>{
 const h=updateFixture(t),r=h.run({},"--plan");assert.equal(r.status,0,r.stderr);assert.match(r.stdout,new RegExp(h.latest));assert.equal(h.git(h.local,"rev-parse","HEAD"),h.base);assert.equal(fs.existsSync(h.events),false);
});
test("legacy installed runner is bridged after image preflight with full reconciliation",t=>{
 const h=updateFixture(t);fs.writeFileSync(h.runner,'echo legacy-runner-must-not-execute >&2\nexit 77\n');const r=h.run();
 assert.equal(r.status,0,r.stderr);assert.equal(h.git(h.local,"rev-parse","HEAD"),h.latest);
 assert.deepEqual(fs.readFileSync(h.events,"utf8").trim().split("\n"),["preflight","preflight","migration-full","installed"]);
 assert.doesNotMatch(r.stderr,/legacy-runner-must-not-execute/);assert.equal(fs.readdirSync(h.f.dir).some(x=>x.startsWith("candidate.")),false);
});
test("legacy bridge stops before candidate execution when main images are unavailable",t=>{
 const h=updateFixture(t);fs.writeFileSync(h.runner,'exit 77\n');const r=h.run({FAIL_PREFLIGHT:"1"});
 assert.notEqual(r.status,0);assert.equal(h.git(h.local,"rev-parse","HEAD"),h.base);assert.equal(fs.readFileSync(h.events,"utf8").trim(),"preflight");assert.equal(fs.readdirSync(h.f.dir).some(x=>x.startsWith("candidate.")),false);
});
test("main publisher promotes only package aliases without a deployment branch or environment",()=>{
 const s=fs.readFileSync(".github/workflows/publish-main-images.yml","utf8"),promote=s.slice(s.indexOf("\n  promote:"));
 assert.match(promote,/needs: build/);assert.match(promote,/contents: read/);assert.match(promote,/packages: write/);
 assert.match(promote,/docker buildx imagetools create/);assert.doesNotMatch(s,/contents: write|heads\/production|refs\/heads\/staging|refs\/heads\/development|environment:/);
 assert.match(fs.readFileSync("deploy/bootstrap.sh","utf8"),/CLASSROOM_HUB_REF:-main/);
});
