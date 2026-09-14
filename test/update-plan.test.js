'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const a='a'.repeat(40),b='b'.repeat(40),c='c'.repeat(40);
function plan(paths,options={}){
 const r=spawnSync('python3',['-c',`import json,runpy,sys
m=runpy.run_path('deploy/update-plan.py');j=json.load(sys.stdin)
def changed(old,target):
 if j.get('missing'): raise ValueError('missing history')
 return j['paths'].get(old,[])
print(json.dumps(m['plan'](j['target'],j['revisions'],changed,j.get('layout',True),j.get('force',False))))`],{encoding:'utf8',input:JSON.stringify({target:c,revisions:{hub:a,maintenance:a,host:a},paths:{[a]:paths},...options})});
 assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
test('selective planner leaves docs-only source and identical deployments running',()=>{
 for(const paths of [[],['README.md','docs/example.md','wiki/Guide.md','test/example.test.js']]){
  const p=plan(paths);for(const key of ['full','hub','maintenance','host'])assert.equal(p[key],false,key);
 }
});
test('selective planner separates Hub, maintenance/Android, and native host inputs',()=>{
 for(const [file,component] of [['public/controller/veyon.js','hub'],['src/veyon-transport.js','hub'],['maintenance-agent/server.js','maintenance'],['agents/android-tv/app/build.gradle','maintenance'],['host-agent/server.py','host'],['test/esphome_worker_test.py','hub']]){
  const p=plan([file]);assert.equal(p.full,false,file);for(const key of ['hub','maintenance','host'])assert.equal(p[key],key===component,file);
 }
});
test('deployment, schema, version, unknown inputs and configuration drift force full reconciliation',()=>{
 for(const paths of [['docker-compose.yml'],['src/storage.js'],['VERSION'],['config/devices.json'],['host-agent/app-update-runner.sh'],['unknown-input'],['.github/workflows/validate.yml']])assert.equal(plan(paths).full,true,paths[0]);
 for(const options of [{layout:false},{force:true},{missing:true},{revisions:{hub:'',maintenance:a,host:a}}])assert.equal(plan([] ,options).full,true);
});
test('mixed running revisions are compared individually, never just to source HEAD',()=>{
 const p=plan([], {revisions:{hub:b,maintenance:a,host:b},paths:{[a]:['maintenance-agent/server.js'],[b]:[]}});
 assert.equal(p.maintenance,true);assert.equal(p.hub,false);assert.equal(p.host,false);assert.equal(p.full,false);
});
