'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const revision='a'.repeat(40),primary=`fixture/current:sha-${revision}`,legacy=`fixture/legacy:sha-${revision}`;
function run(t,mode){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-publish-candidate-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const log=path.join(dir,'calls.jsonl');
 fs.writeFileSync(path.join(dir,'docker'),`#!/usr/bin/env node
const fs=require('node:fs'),args=process.argv.slice(2),log=process.env.FIXTURE_LOG,mode=process.env.FIXTURE_MODE;
const calls=fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\\n').filter(Boolean).map(JSON.parse):[];
fs.appendFileSync(log,JSON.stringify(args)+'\\n');
if(args[0]==='image'){
 const changed=mode==='changed'&&calls.some(x=>x[0]==='push');
 console.log(args[3]==='{{.Id}}'?(changed||mode==='alias-mismatch'&&args.at(-1).includes('/legacy:')?'sha256:other':'sha256:fixture'):(mode==='wrong-revision'?'b'.repeat(40):'a'.repeat(40)));
}else if(args[0]==='push'){
 const prior=calls.filter(x=>x[0]==='push'&&x[1]===args[1]).length;
 if(mode==='permanent'||mode==='changed'||mode==='transient'&&args[1].includes('/current:')&&prior===0)process.exit(1);
}else process.exit(2);
`,{mode:0o755});
 fs.writeFileSync(path.join(dir,'sleep'),'#!/usr/bin/env node\nrequire("node:fs").appendFileSync(process.env.FIXTURE_LOG,JSON.stringify(["sleep",...process.argv.slice(2)])+"\\n");\n',{mode:0o755});
 const result=spawnSync('bash',['tools/publish-scanned-candidate.sh',revision,primary,legacy],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',env:{...process.env,PATH:dir+path.delimiter+process.env.PATH,FIXTURE_LOG:log,FIXTURE_MODE:mode},timeout:15000});
 assert.ifError(result.error);const calls=fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
 return {...result,calls,pushes:calls.filter(x=>x[0]==='push'),sleeps:calls.filter(x=>x[0]==='sleep')};
}
test('successful publication pushes each verified alias once',t=>{
 const r=run(t,'success');assert.equal(r.status,0,r.stderr);assert.deepEqual(r.pushes,[['push',primary],['push',legacy]]);assert.equal(r.sleeps.length,0);
});
test('a transient registry failure retries the same candidate without rebuilding',t=>{
 const r=run(t,'transient');assert.equal(r.status,0,r.stderr);assert.deepEqual(r.pushes,[['push',primary],['push',primary],['push',legacy]]);assert.deepEqual(r.sleeps,[['sleep','5']]);assert.ok(r.calls.every(x=>['image','push','sleep'].includes(x[0])));
});
test('permanent publication failure stops after three attempts',t=>{
 const r=run(t,'permanent');assert.equal(r.status,1);assert.equal(r.pushes.length,3);assert.ok(r.pushes.every(x=>x[1]===primary));assert.deepEqual(r.sleeps,[['sleep','5'],['sleep','10']]);
});
for(const mode of ['wrong-revision','alias-mismatch'])test(`publication refuses ${mode} before pushing`,t=>{
 const r=run(t,mode);assert.equal(r.status,1);assert.equal(r.pushes.length,0);
});
test('candidate replacement after failure prevents the retry',t=>{
 const r=run(t,'changed');assert.equal(r.status,1);assert.equal(r.pushes.length,1);assert.match(r.stderr,/candidate changed/);
});
