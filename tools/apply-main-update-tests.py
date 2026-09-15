from pathlib import Path
root=Path('.')
p=root/'test/image-readiness.test.js'
s=p.read_text().split('function updateFixture(t){')[0]
s+=r'''function updateFixture(t){
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
'''
p.write_text(s)
p=root/'test/update-runner.test.js';s=p.read_text();s+=r'''

test('legacy production checkout moves to main and preserves its previous branch',t=>{
 const f=fixture(t);f.git('branch','-m','production');
 f.git('config','remote.origin.fetch','+refs/heads/production:refs/remotes/origin/production');
 const r=f.run();assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 assert.equal(f.git('symbolic-ref','--short','HEAD'),'main');assert.equal(f.git('rev-parse','main'),f.target);assert.equal(f.git('rev-parse','production'),f.base);
 assert.equal(f.git('config','remote.origin.fetch'),'+refs/heads/main:refs/remotes/origin/main');assert.equal(f.git('config','branch.main.merge'),'refs/heads/main');
});
test('verified detached recovery checkout rejoins main without a reset',t=>{
 const f=fixture(t);f.git('checkout','--detach',f.base);const r=f.run();assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 assert.equal(f.git('symbolic-ref','--short','HEAD'),'main');assert.equal(f.git('rev-parse','HEAD'),f.target);
});
test('legacy migration refuses to overwrite divergent local main commits',t=>{
 const f=fixture(t);f.git('branch','-m','production');f.git('switch','-c','main');
 fs.writeFileSync(path.join(f.hub,'local-main.txt'),'preserve');f.git('add','local-main.txt');f.git('commit','-m','local work');const local=f.git('rev-parse','HEAD');f.git('switch','production');
 const r=f.run();assert.notEqual(r.status,0);assert.equal(f.git('rev-parse','HEAD'),f.base);assert.equal(f.git('rev-parse','main'),local);assert.doesNotMatch(r.events,/^pull |^compose up|\/backup\/create/m);assert.match(r.stderr,/Local main diverges/);
});
test('pending journal is preserved when a new main update is requested',t=>{
 const f=fixture(t);const pending=JSON.stringify({action:'published',targetCommit:f.base,mutationStarted:'true'});fs.writeFileSync(f.state+'/app-update-request.json',pending);fs.writeFileSync(f.dir+'/events','');
 const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/journal is pending/);assert.equal(fs.readFileSync(f.state+'/app-update-request.json','utf8'),pending);assert.equal(f.git('rev-parse','HEAD'),f.base);assert.equal(r.events,'');
});
''';p.write_text(s)
# Complete AI-context updates without touching compatibility identifiers.
p=root/'docs/AI-CONTEXT.md';s=p.read_text();s=s.replace('## Selective published-source updates and CI','## Selective main updates and CI').replace('Normal CLI updates use `deploy/update-plan.py` and the journaled native runner.','Normal CLI updates select origin/main and use `deploy/update-plan.py` and the journaled native runner. An old installed runner is migrated only after the exact main image pair is verified; the candidate runner forces one full reconciliation and preserves pending-journal recovery. Legacy/deferred branch names are not active update sources.');p.write_text(s)
