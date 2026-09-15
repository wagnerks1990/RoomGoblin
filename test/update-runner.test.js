'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=process.cwd(),oldId='sha256:'+'1'.repeat(64),newId='sha256:'+'2'.repeat(64);
function fixture(t,files=['public/change.js']){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-runner-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const hub=path.join(dir,'hub'),bin=path.join(dir,'bin'),state=path.join(dir,'state');for(const d of [hub,bin,state])fs.mkdirSync(d);
 function git(...args){const r=spawnSync('git',args,{cwd:hub,encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'}});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 git('init','-b','main');git('remote','add','origin','https://github.com/wagnerks1990/RoomGoblin.git');
 for(const name of ['deploy/image-identity.sh','deploy/image-readiness.sh','deploy/update-plan.py']){
  fs.mkdirSync(path.dirname(path.join(hub,name)),{recursive:true});fs.writeFileSync(path.join(hub,name),fs.readFileSync(path.join(root,name),'utf8').replace("Path('/var/lib/classroom-hub/deployment.json')",`Path(${JSON.stringify(path.join(state,'deployment.json'))})`));
 }
 fs.writeFileSync(path.join(hub,'VERSION'),'1.0.0-alpha.82\n');fs.writeFileSync(path.join(hub,'.gitignore'),'.env\ndata/\n');fs.writeFileSync(path.join(hub,'install.sh'),'echo full-installer >> "$EVENTS"\ntouch "$FIXTURE/hub-new" "$FIXTURE/maintenance-new"\n');
 git('add','.');git('commit','-m','baseline');const base=git('rev-parse','HEAD');
 for(const name of files){fs.mkdirSync(path.dirname(path.join(hub,name)),{recursive:true});fs.writeFileSync(path.join(hub,name),'changed\n')}
 git('add','.');git('commit','-m','target');const target=git('rev-parse','HEAD');git('update-ref','refs/remotes/origin/main',target);git('reset','--hard',base);
 fs.writeFileSync(path.join(hub,'.env'),'CLASSROOM_CONTROL_HUB_TAG=alpha\n');fs.mkdirSync(path.join(hub,'data/backups'),{recursive:true});const backup='fixture.zip';fs.writeFileSync(path.join(hub,'data/backups',backup),'snapshot');const sha=crypto.createHash('sha256').update('snapshot').digest('hex');
 const config={services:{'classroom-hub':{image:'hub'},'maintenance-agent':{image:'maintenance'}}};
 const digest=spawnSync('python3',['-c','import json,hashlib;print(hashlib.sha256(json.dumps({"services":{"classroom-hub":{"image":"hub"},"maintenance-agent":{"image":"maintenance"}}},sort_keys=True).encode()).hexdigest())'],{encoding:'utf8'}).stdout.trim();
 fs.writeFileSync(path.join(state,'deployment.json'),JSON.stringify({host:base,layout:digest}));
 const realGit=spawnSync('which',['git'],{encoding:'utf8'}).stdout.trim();
 function command(name,body){fs.writeFileSync(path.join(bin,name),'#!/bin/bash\n'+body,{mode:0o755})}
 command('git',`if [[ "$1" == fetch ]]; then exit 0; fi\nexec ${realGit} "$@"`);
 command('docker',`echo "$*" >> "$EVENTS"
if [[ "$1" == pull && "$FAIL_PULL" == 1 ]]; then exit 1; fi
if [[ "$1 $2 $3" == "compose stop classroom-hub" && "$FAIL_STOP" == 1 ]]; then exit 1; fi
if [[ "$1" == inspect ]]; then
 if [[ "$*" == *classroom-control-hub-maintenance* ]]; then key=maintenance; else key=hub; fi
 if [[ -f "$FIXTURE/$key-new" ]]; then echo '${newId}'; else echo '${oldId}'; fi
elif [[ "$1 $2" == 'image inspect' ]]; then
 if [[ "$*" == *'{{.Id}}'* ]]; then echo '${newId}'
 elif [[ "$*" == *'${oldId}'* ]]; then echo '$BASE'
 else echo '$TARGET'; fi
elif [[ "$1 $2 $3" == 'compose config --format' ]]; then
 echo '${JSON.stringify(config)}'
elif [[ "$1 $2" == 'compose ps' ]]; then printf 'classroom-hub\\nmaintenance-agent\\n'
elif [[ "$1 $2" == 'compose exec' && "$*" == *'/backup/create'* ]]; then echo '{"name":"${backup}","sha256":"${sha}"}'
elif [[ "$1 $2" == 'compose up' ]]; then
 if [[ "$KILL_DEPLOY" == 1 ]]; then kill -KILL "$PPID"; exit 1; fi
 if [[ "$FAIL_DEPLOY" == 1 && ! -f "$FIXTURE/failed" ]]; then touch "$FIXTURE/failed"; exit 1; fi
 if [[ "$*" == *'--no-start'* ]]; then exit 0; fi
 if [[ "$*" == *maintenance-agent* ]]; then if grep -q "^ROOMGOBLIN_MAINTENANCE_TAG=recovery-" .env; then rm -f "$FIXTURE/maintenance-new"; else touch "$FIXTURE/maintenance-new"; fi; fi
 if [[ "$*" == *classroom-hub* ]]; then if grep -q "^ROOMGOBLIN_HUB_TAG=recovery-" .env; then rm -f "$FIXTURE/hub-new"; else touch "$FIXTURE/hub-new"; fi; fi
elif [[ "$1 $2" == 'volume inspect' && "$*" == *Mountpoint* ]]; then echo "$FIXTURE/volumes/classroom-control-hub-android-adb/_data"
fi
exit 0`.replace('$BASE',base).replace('$TARGET',target));
 for(const name of ['systemctl','install','sleep'])command(name,'echo "'+name+' $*" >> "$EVENTS"\nexit 0');
 command('chown','exit 0');
 fs.mkdirSync(path.join(dir,'volumes/classroom-control-hub-android-adb/_data'),{recursive:true});
 let script=fs.readFileSync(path.join(root,'host-agent/app-update-runner.sh'),'utf8').replace('STATE_DIR=/var/lib/classroom-hub',`STATE_DIR=${state}`).replace('LOCK_FILE=/run/classroom-control-hub-appliance-mutation.lock',`LOCK_FILE=${dir}/lock`);
 // Redirect host writes in the actual runner's reconciliation functions into the fixture.
 script=script.replace('[[ $EUID -eq 0 &&','[[').replace('/run/classroom-hub-updater.',dir+'/runner-copy.');
 script=script.replaceAll('/etc/classroom-control-hub',dir+'/etc/classroom-control-hub').replaceAll('/etc/systemd/system',dir+'/systemd');
 fs.mkdirSync(dir+'/etc/classroom-control-hub',{recursive:true});fs.writeFileSync(dir+'/etc/classroom-control-hub/master.key','fixture');
 // Existing unit is harmless fixture data; install is logged, never touches the host.
 fs.mkdirSync(dir+'/systemd');fs.writeFileSync(dir+'/systemd/classroom-hub-host-agent.service','fixture');fs.mkdirSync(hub+'/host-agent');fs.writeFileSync(hub+'/host-agent/server.py','');
 const runner=path.join(dir,'runner.sh');fs.writeFileSync(runner,script);
 const env={...process.env,PATH:bin+':'+process.env.PATH,CLASSROOM_HUB_DIR:hub,EVENTS:dir+'/events',FIXTURE:dir,DOCKER_VOLUMES_ROOT:dir+'/volumes'};
 return {dir,hub,state,base,target,git,run(extra={},resume=false){const r=spawnSync('bash',[runner,...(resume?[]:['--published',target])],{env:{...env,...extra},encoding:'utf8',timeout:45000});assert.ifError(r.error);return {...r,events:fs.readFileSync(env.EVENTS,'utf8')}}};
}
test('native runner pulls/recreates only Hub and journals a verified rollback point',t=>{
 const f=fixture(t),r=f.run();assert.equal(r.status,0,r.stderr+'\n'+r.stdout);assert.equal(f.git('rev-parse','HEAD'),f.target);
 const up=r.events.split('\n').filter(x=>x.startsWith('compose up'));assert.equal(up.length,1);assert.match(up[0],/--no-deps --force-recreate classroom-hub$/);
 assert.equal(r.events.split('\n').filter(x=>x.startsWith('pull ')).length,1);assert.doesNotMatch(r.events,/systemctl restart/);
 const status=JSON.parse(fs.readFileSync(f.state+'/app-update-status.json'));assert.equal(status.revertAvailable,true);assert.equal(status.previousCommit,f.base);assert.equal(status.phase,'completed');assert.equal(fs.existsSync(f.state+'/app-update-request.json'),false);
});
test('docs-only native update performs no image download, backup or restart',t=>{
 const f=fixture(t,['docs/change.md']),r=f.run();assert.equal(r.status,0,r.stderr+'\n'+r.stdout);assert.equal(f.git('rev-parse','HEAD'),f.target);assert.doesNotMatch(r.events,/^pull |^compose up|\/backup\/create|systemctl restart/m);
});
test('failed native deployment restores source and snapshot through prior maintenance',t=>{
 const f=fixture(t),r=f.run({FAIL_DEPLOY:'1'});assert.notEqual(r.status,0);assert.equal(f.git('rev-parse','HEAD'),f.base);
 assert.match(r.events,/BACKUP_NAME=fixture.zip/);assert.doesNotMatch(r.events,/-e PORT=/);assert.match(fs.readFileSync(f.hub+'/.env','utf8'),/ROOMGOBLIN_HUB_TAG=recovery-/);assert.ok(r.events.indexOf('compose up -d --no-build --no-deps --force-recreate maintenance-agent')<r.events.indexOf('BACKUP_NAME=fixture.zip'));
 const status=JSON.parse(fs.readFileSync(f.state+'/app-update-status.json'));assert.equal(status.phase,'rolled-back');assert.equal(fs.existsSync(f.state+'/deployment.json'),false);
});

test('native maintenance-only update leaves Hub running',t=>{
 const f=fixture(t,['maintenance-agent/change.js']),r=f.run();assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 const up=r.events.split('\n').filter(x=>x.startsWith('compose up'));assert.equal(up.length,1);assert.match(up[0],/--no-deps --force-recreate maintenance-agent$/);
});
test('native host-only update refreshes the service without container pulls/recreation',t=>{
 const f=fixture(t,['host-agent/change.py']),r=f.run();assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 assert.match(r.events,/systemctl restart classroom-hub-host-agent/);assert.doesNotMatch(r.events,/^pull |^compose up|systemctl daemon-reload|install -D -m 0644/m);
});
test('deployment input changes invoke full installer reconciliation',t=>{
 const f=fixture(t,['docker-compose.yml']),r=f.run();assert.equal(r.status,0,r.stderr+'\n'+r.stdout);assert.match(r.events,/full-installer/);
});
test('image download failure never switches source or starts rollback',t=>{
 const f=fixture(t),r=f.run({FAIL_PULL:'1'});assert.notEqual(r.status,0);assert.equal(f.git('rev-parse','HEAD'),f.base);assert.doesNotMatch(r.events,/^compose up|BACKUP_NAME=/m);assert.equal(fs.existsSync(f.state+'/app-update-request.json'),false);
});
test('interrupted deployment rolls back its durable journal before any new pull',t=>{
 const f=fixture(t),first=f.run({KILL_DEPLOY:'1'});assert.equal(first.signal,'SIGKILL');assert.equal(f.git('rev-parse','HEAD'),f.target);
 assert.equal(JSON.parse(fs.readFileSync(f.state+'/app-update-request.json')).mutationStarted,'true');
 const second=f.run({},true);assert.notEqual(second.status,0);assert.equal(f.git('rev-parse','HEAD'),f.base);assert.doesNotMatch(second.events.slice(first.events.length),/^pull /m);
 assert.equal(JSON.parse(fs.readFileSync(f.state+'/app-update-status.json')).phase,'rolled-back');
});

test('rollback refuses data restoration when the application writer cannot stop',t=>{
 const f=fixture(t),r=f.run({FAIL_DEPLOY:'1',FAIL_STOP:'1'});assert.notEqual(r.status,0);assert.doesNotMatch(r.events,/BACKUP_NAME=/);
 assert.equal(JSON.parse(fs.readFileSync(f.state+'/app-update-status.json')).phase,'rollback-failed');assert.equal(fs.existsSync(f.state+'/app-update-request.json'),true);
});


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
