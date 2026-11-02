'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const lib=require(path.join(process.cwd(),'maintenance-agent/android-tv-lib.js')),source=fs.readFileSync(path.join(process.cwd(),'maintenance-agent/android-tv-agent-v2.js'),'utf8');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'rg-android-configuration-'));t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'rg-android-configuration-'));fs.rmSync(root,{recursive:true,force:true})});const STORE=new lib.JsonStore(root);STORE.upsertDevice({id:'one',host:'192.0.2.1',name:'Before',displayUrl:'http://display.invalid/display/one'});const calls=[],routes=new Map();const ctx=vm.createContext({...require(path.join(process.cwd(),'maintenance-agent/android-tv-configuration-owner.js')),STORE,cleanPackage:lib.cleanPackage,cleanPort:lib.cleanPort,requireManagementPort:lib.requireManagementPort,CURRENT_PACKAGE:'org.roomgoblin.display',token:()=> 'a'.repeat(64),adb:()=>new Promise((resolve,reject)=>calls.push({resolve,reject})),installed:false,startPolicyLoop(){},asyncRoute:f=>f,publicDevice:lib.publicDevice,findDevice:id=>STORE.getDevice(id)});vm.runInContext(source.slice(source.indexOf('async function configure('),source.indexOf('async function packageInstalled(')),ctx);const extension=fs.readFileSync(path.join(process.cwd(),'maintenance-agent/android-tv-extension.js'),'utf8');vm.runInContext(extension.slice(extension.indexOf('function installRoutes('),extension.indexOf('express.application.listen=')),ctx);ctx.installRoutes(Object.fromEntries(['get','post','put','delete'].map(method=>[method,(url,handler)=>routes.set(method+url,handler)])));return{ctx,STORE,calls,run:()=>ctx.configure(STORE.getDevice('one'),{rotateToken:true}),edit:body=>routes.get('put/android/devices/:id')({params:{id:'one'},body},{json:v=>v})}}
test('overlapping Agent configuration is rejected before a second credential dispatch',async t=>{const h=fixture(t),a=h.run();try{await assert.rejects(h.run(),isBusy);assert.equal(h.calls.length,1)}finally{h.calls[0].resolve({stdout:'fixture'});await a}});
test('assignment cannot change beneath a pending Agent configuration',async t=>{const h=fixture(t),run=h.run();try{await assert.rejects(h.edit({displayUrl:'http://display.invalid/display/new'}),e=>e.status===409)}finally{h.calls.forEach(c=>c.resolve({stdout:'fixture'}));await run}});
test('ordinary metadata remains editable during Agent configuration',async t=>{const h=fixture(t),run=h.run();await h.edit({name:'Newer name'});h.calls[0].resolve({stdout:'fixture'});await run;assert.equal(h.STORE.getDevice('one').name,'Newer name')});

const owner=require('../maintenance-agent/android-tv-configuration-owner');
const isBusy=e=>e.status===409&&e.code==='android_configuration_pending';
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function evaluate(ctx,name,begin,end){const text=fs.readFileSync(path.join(__dirname,'../maintenance-agent',name),'utf8');vm.runInContext(text.slice(text.indexOf(begin),text.indexOf(end)),ctx)}
test('failed configuration releases admission for an explicit retry',async t=>{
 const h=fixture(t),run=h.run();h.calls[0].reject(Error('Synthetic ADB failure'));await assert.rejects(run,/Synthetic ADB failure/);
 const retry=h.run();assert.equal(h.calls.length,2);h.calls[1].resolve({stdout:'fixture'});await retry;assert.equal(h.STORE.getDevice('one').agentV2.enabled,true);
});
test('validation failure releases admission without dispatch',async t=>{
 const h=fixture(t);await assert.rejects(h.ctx.configure(h.STORE.getDevice('one'),{displayUrl:'invalid'}));assert.equal(h.calls.length,0);
 const retry=h.run();h.calls[0].resolve({stdout:'fixture'});await retry;
});
for(const [field,value] of Object.entries({host:'192.0.2.2',port:6666,serial:'192.0.2.2:5555',androidId:'0123456789abcdef',agentPackage:'org.example.agent',agentV2:{token:'b'.repeat(64)},persistentAdb:{enabled:true}})){
 test(field+' cannot change beneath pending configuration but can change after completion',async t=>{
  const h=fixture(t),run=h.run();try{await assert.rejects(h.edit({[field]:value}),isBusy)}finally{h.calls[0].resolve({stdout:'fixture'});await run}
  await h.edit({[field]:value});assert.deepEqual(h.STORE.getDevice('one')[field],lib.normalizeDevice({...h.STORE.getDevice('one'),[field]:value})[field]);
 });
}
test('independent displays configure concurrently',async t=>{
 const h=fixture(t);h.STORE.upsertDevice({id:'two',host:'192.0.2.2',displayUrl:'http://display.invalid/display/two'});
 const first=h.run(),second=h.ctx.configure(h.STORE.getDevice('two'));assert.equal(h.calls.length,2);
 h.calls.forEach(call=>call.resolve({stdout:'fixture'}));await Promise.all([first,second]);
});
test('legacy configuration and Agent v2 share admission in both directions',async t=>{
 const h=fixture(t),routes=new Map();Object.assign(h.ctx,{installed:false,ensureDevice:async d=>({device:d})});h.ctx.installRoutes(Object.fromEntries(['get','post','put','delete'].map(method=>[method,(url,handler)=>routes.set(method+url,handler)])));
 const legacy=()=>routes.get('post/android/devices/:id/agent/configure')({params:{id:'one'},body:{}},{json:v=>v});
 const first=h.run();await assert.rejects(legacy(),isBusy);h.calls[0].resolve({stdout:'fixture'});await first;
 const second=legacy();await Promise.resolve();await assert.rejects(h.run(),isBusy);assert.equal(h.calls.length,2);h.calls[1].resolve({stdout:'fixture'});await second;
});
test('persistent ADB bootstrap and disable reject before probing when configuration is pending',async t=>{
 const h=fixture(t),run=h.run(),routes=new Map();let probed=0;
 const ctx=vm.createContext({...owner,STORE:h.STORE,installed:false,route:f=>f,device:id=>h.STORE.getDevice(id),requireOnline:async d=>{probed++;return d},cleanPort:lib.cleanPort,requireManagementPort:lib.requireManagementPort});
 evaluate(ctx,'android-tv-persistent-adb.js','async function bootstrap(','express.application.listen=');
 ctx.installRoutes({get:(p,f)=>routes.set(p,f),post:(p,f)=>routes.set(p,f)});
 try{await assert.rejects(ctx.bootstrap(h.STORE.getDevice('one'),5555),isBusy);await assert.rejects(routes.get('/android/devices/:id/persistent-adb/disable')({params:{id:'one'}},{}),isBusy);assert.equal(probed,0)}finally{h.calls[0].resolve({stdout:'fixture'});await run}
});
test('APK installation rejects before artifact or ADB work when configuration is pending',async t=>{
 const h=fixture(t),run=h.run();let inspected=0;const ctx=vm.createContext({...owner,STORE:h.STORE,artifact:()=>{inspected++;throw Error('must not run')}});
 evaluate(ctx,'android-tv-agent-artifact.js','async function installCurrent(','function route(');
 try{await assert.rejects(ctx.installCurrent(h.STORE.getDevice('one')),isBusy);assert.equal(inspected,0)}finally{h.calls[0].resolve({stdout:'fixture'});await run}
});
test('nested restoration retains outer ownership and rejects foreign or expired leases',async()=>{
 let lease;const gate=deferred();
 const running=owner.withConfiguration('lease-test',async current=>{lease=current;await owner.withConfiguration('lease-test',async inner=>assert.equal(inner,current),current);await gate.promise});
 await assert.rejects(owner.withConfiguration('lease-test',()=>{}),isBusy);
 await assert.rejects(owner.withConfiguration('lease-test',()=>{},{ }),isBusy);
 await assert.rejects(owner.withConfiguration('other-device',()=>{},lease),isBusy);
 gate.resolve();await running;
 await assert.rejects(owner.withConfiguration('lease-test',()=>{},lease),isBusy);
 await owner.withConfiguration('lease-test',async()=>{});
});
test('verified APK installation restores Agent v2 through the same owner and releases it',async t=>{
 const h=fixture(t);h.STORE.updateDevice(h.STORE.getDevice('one'),{agentV2:{token:'b'.repeat(64),enabled:true}});
 const install=deferred(),calls=[];Object.assign(h.ctx,{artifact:()=>({available:true,sha256:'fixture-sha',signerSha256:'fixture-signer'}),signingIdentityDigest:()=> 'fixture-signer',ensureSigningIdentity:()=>'',sha256:()=> 'fixture-sha',signerDigest:()=> 'fixture-signer',path,process:{pid:1},crypto:require('node:crypto'),SIGNING_ROOT:'fixture',APK:'fixture.apk',LEGACY_PACKAGE:'org.classroomhub.display',fs:{constants:{COPYFILE_EXCL:1},copyFileSync(){},chmodSync(){},rmSync(){}},packageInstalled:async()=>false,signatureMismatch:()=>false,restoreTrustedGrants:async()=>({}),restoreAdmin:async()=>({}),adb:async args=>{calls.push(args);if(args.includes('install'))return install.promise;return{stdout:'fixture'}}});
 evaluate(h.ctx,'android-tv-agent-artifact.js','async function restoreAgentConfiguration(','function signatureMismatch(');
 evaluate(h.ctx,'android-tv-agent-artifact.js','async function installCurrent(','function route(');
 const run=h.ctx.installCurrent(h.STORE.getDevice('one'));await Promise.resolve();await assert.rejects(h.run(),isBusy);install.resolve({stdout:'fixture'});
 assert.equal((await run).installed,true);assert.equal(calls.filter(args=>args.includes('agent_token')).length,1);assert.ok(calls.some(args=>args.includes('org.roomgoblin.display/.MainActivity')));
 await h.run();assert.equal(calls.filter(args=>args.includes('agent_token')).length,2);
});
