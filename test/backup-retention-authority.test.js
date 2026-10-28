"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../maintenance-agent/server'),'utf8');
const start=source.indexOf('app.post("/backups/retention"'),end=source.indexOf('\napp.get("/backup/:name"',start);
assert.ok(start>=0&&end>start);
function fixture(t,job,{duringStatus,automaticKeep=3}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-retention-authority-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const automatic=Array.from({length:5},(_,i)=>`auto-operational-fixture-${i}.zip`);
 const pre=['pre-fixture-0.zip','pre-fixture-1.zip'];
 for(const [i,name] of [...automatic,...pre,'manual-operational-fixture.zip','fixture.rgbak'].entries()){
  const file=path.join(dir,name);fs.writeFileSync(file,'fixture backup');const date=new Date(Date.UTC(2026,0,i+1));fs.utimesSync(file,date,date);
 }
 let route;
 const ctx=vm.createContext({fs,path,BACKUP_DIR:dir,app:{post:(_path,handler)=>route=handler},
  hostAgentRequest:async()=>{if(duringStatus)await duringStatus(dir);if(job instanceof Error)throw job;return job},
  statInfo:file=>{const s=fs.statSync(file);return {name:path.basename(file),size:s.size,modifiedAt:s.mtime.toISOString()}}});
 vm.runInContext(source.slice(start,end),ctx);
 return {dir,automatic,pre,names:()=>fs.readdirSync(dir).sort(),async prune(){let status=200,body;const res={status(n){status=n;return res},json(value){body=value;return res}};await route({body:{automaticKeep,preKeep:1,confirm:'PRUNE_AUTOMATIC_BACKUPS'}},res);return {status,body}}};
}
for(const [name,job] of [
 ['unreachable host',Error('fixture host unavailable')],
 ['unreadable journal',{phase:'idle',stateReadError:'fixture parse error'}],
 ['missing response',null],
 ['missing rollback status',{phase:'completed'}],
 ['missing pinned name',{phase:'completed',revertAvailable:true}],
 ['missing pinned archive',{phase:'completed',revertAvailable:true,backupName:'auto-operational-missing.zip'}],
 ['invalid pinned path',{phase:'completed',revertAvailable:true,backupName:'../auto-operational-fixture-0.zip'}]
])test(`automatic retention preserves every backup when authority is uncertain: ${name}`,async t=>{
 const h=fixture(t,job),before=h.names(),result=await h.prune();assert.equal(result.status,503);assert.deepEqual(h.names(),before);
});
test('verified rollback pin is retained inside the automatic limit',async t=>{
 const h=fixture(t,{phase:'completed',revertAvailable:true,backupName:'auto-operational-fixture-0.zip'}),result=await h.prune();assert.equal(result.status,200);
 assert.deepEqual(h.names().filter(n=>n.startsWith('auto-')),['auto-operational-fixture-0.zip','auto-operational-fixture-3.zip','auto-operational-fixture-4.zip']);
 assert.equal(h.names().filter(n=>n.startsWith('pre-')).length,1);assert.ok(h.names().includes('manual-operational-fixture.zip'));assert.ok(h.names().includes('fixture.rgbak'));
});
for(const job of [{phase:'idle'},{phase:'completed',revertAvailable:false}])test(`confirmed ${job.phase} state without a rollback point permits bounded cleanup`,async t=>{
 const h=fixture(t,job),result=await h.prune();assert.equal(result.status,200);assert.equal(h.names().filter(n=>n.startsWith('auto-')).length,3);assert.equal(h.names().filter(n=>n.startsWith('pre-')).length,1);
});

test('retention cannot delete an update backup created during its status read',async t=>{
 const fresh='auto-operational-concurrent-update.zip';
 const h=fixture(t,{phase:'completed',revertAvailable:true,backupName:'auto-operational-fixture-0.zip'},{automaticKeep:1,duringStatus:async dir=>{fs.writeFileSync(path.join(dir,fresh),'new update safety backup')}});
 const result=await h.prune();assert.equal(result.status,200);assert.ok(h.names().includes(fresh));assert.ok(h.names().includes('auto-operational-fixture-0.zip'));assert.equal(result.body.remainingAutomatic,2);
});
test('retention cannot delete an archive replaced while status is pending',async t=>{
 const replaced='auto-operational-fixture-1.zip';
 const h=fixture(t,{phase:'completed',revertAvailable:false},{duringStatus:async dir=>{const p=path.join(dir,replaced);fs.unlinkSync(p);fs.writeFileSync(p,'replacement safety snapshot');const old=new Date(Date.UTC(2020,0,1));fs.utimesSync(p,old,old)}});
 const result=await h.prune();assert.equal(result.status,200);assert.equal(fs.readFileSync(path.join(h.dir,replaced),'utf8'),'replacement safety snapshot');
});
for(const job of [{phase:'backup',running:true,revertAvailable:true,backupName:'auto-operational-fixture-0.zip'},
 {phase:'backup',running:false,revertAvailable:true,backupName:'auto-operational-fixture-0.zip'},
 {phase:'completed',running:true,revertAvailable:false},
 {phase:'verifying',running:true,revertAvailable:true,backupName:'auto-operational-fixture-0.zip',activeCommit:'a'.repeat(40),targetCommit:'b'.repeat(40)}])test(`retention waits for authoritative update completion: ${job.phase}/${job.running}`,async t=>{
 const h=fixture(t,job),before=h.names(),result=await h.prune();assert.equal(result.status,503);assert.deepEqual(h.names(),before);
});
test('the verified updater can prune before releasing its existing appliance lock',async t=>{
 const h=fixture(t,{phase:'verifying',running:true,revertAvailable:true,backupName:'auto-operational-fixture-0.zip',activeCommit:'a'.repeat(40),targetCommit:'a'.repeat(40)}),result=await h.prune();
 assert.equal(result.status,200);assert.equal(result.body.remainingAutomatic,3);assert.ok(h.names().includes('auto-operational-fixture-0.zip'));
});
test('an update without a published rollback pin cannot prune during verification',async t=>{
 const h=fixture(t,{phase:'verifying',running:true,revertAvailable:false,activeCommit:'a'.repeat(40),targetCommit:'a'.repeat(40)}),before=h.names(),result=await h.prune();
 assert.equal(result.status,503);assert.deepEqual(h.names(),before);
});
test('a verified revert can prune after explicitly clearing its spent rollback identity',async t=>{
 const h=fixture(t,{phase:'verifying',running:true,action:'revert',revertAvailable:false,backupName:'',activeCommit:'a'.repeat(40),targetCommit:'a'.repeat(40)}),result=await h.prune();
 assert.equal(result.status,200);assert.equal(result.body.remainingAutomatic,3);
});
