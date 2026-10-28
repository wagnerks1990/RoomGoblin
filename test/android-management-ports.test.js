'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const lib=require('../maintenance-agent/android-tv-lib'),owner=require('../maintenance-agent/android-tv-configuration-owner');

function fixture(){
  const device=lib.normalizeDevice({id:'fixture',host:'192.0.2.10',displayUrl:'http://display.invalid/display/one'}),calls=[],routes=new Map();
  const ctx=vm.createContext({...lib,...owner,STORE:{list:()=>({devices:[device]}),requireCurrentDevice:()=>device,updateDevice:(_,changes)=>Object.assign(device,changes)},CURRENT_PACKAGE:'org.roomgoblin.display',token:()=> 'a'.repeat(64),adb:async args=>{calls.push(args);return{stdout:'package:fixture.apk'}},requireOnline:async d=>{calls.push(['probe']);return d},broadcastPolicy:async(...args)=>calls.push(['policy',...args]),setTimeout:(fn,ms)=>{if(ms===2500)fn();return 1},clearTimeout(){},AbortController,fetch:async url=>{calls.push(['fetch',url]);return{ok:true,status:200,text:async()=>'{"ok":true}'}},installed:false,route:f=>f,device:()=>device});
  for(const [file,start,end] of [['android-tv-agent-v2.js','function agentSettings(','async function packageInstalled('],['android-tv-persistent-adb.js','async function bootstrap(','express.application.listen=']]){
    const source=fs.readFileSync(path.join(__dirname,'../maintenance-agent',file),'utf8');
    vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),ctx);
  }
  ctx.installRoutes({get:(p,f)=>routes.set(p,f),post:(p,f)=>routes.set(p,f)});
  return{device,calls,ctx,bootstrapRoute:async value=>{let result;await routes.get('/android/devices/:id/persistent-adb/bootstrap')({params:{id:'fixture'},body:{targetPort:value}},{json:v=>{result=v}});return result}};
}

for(const port of [80,70000,1234.5,0,'','not-a-port',true,[]]){
  test('Agent rejects unsupported port '+JSON.stringify(port)+' before dispatch',async()=>{
    const h=fixture();await assert.rejects(h.ctx.configure(h.device,{port}),e=>e.status===400);assert.equal(h.calls.length,0);assert.equal(h.device.agentV2,null);
  });
  test('bootstrap rejects unsupported port '+JSON.stringify(port)+' before device work',async()=>{
    const h=fixture();await assert.rejects(h.ctx.bootstrap(h.device,port),e=>e.status===400);assert.equal(h.calls.length,0);assert.equal(h.device.persistentAdb.enabled,false);
  });
}

for(const port of [1024,8765,'8766',65535])test('accepted Agent port '+port+' matches dispatch and storage',async()=>{
  const h=fixture(),d=await h.ctx.configure(h.device,{port});assert.equal(d.agentV2.port,Number(port));
  const args=h.calls[0];assert.equal(args[args.indexOf('agent_port')+1],String(Number(port)));
});

test('default Agent configuration uses 8765',async()=>{const h=fixture();assert.equal((await h.ctx.configure(h.device)).agentV2.port,8765)});
test('failed validation releases configuration admission for a corrected retry',async()=>{
  const h=fixture();await assert.rejects(h.ctx.configure(h.device,{port:80}),e=>e.status===400);
  assert.equal((await h.ctx.configure(h.device,{port:8765})).agentV2.port,8765);assert.equal(h.calls.length,1);
});
test('an invalid active persistent target is rejected before Agent configuration',async()=>{
  const h=fixture();h.device.persistentAdb={enabled:true,targetPort:80};await assert.rejects(h.ctx.configure(h.device),e=>e.status===400);assert.equal(h.calls.length,0);
});
test('inactive legacy persistent settings do not block Agent configuration or change ADB enrollment',async()=>{
  const h=fixture();h.device.persistentAdb={enabled:false,targetPort:80};const before=h.device.serial;
  const d=await h.ctx.configure(h.device);assert.equal(d.serial,before);assert.equal(d.persistentAdb.targetPort,80);
  const args=h.calls[0];assert.equal(args[args.indexOf('target_adb_port')+1],'5555');
});
test('existing inventory normalization preserves general ADB endpoints and legacy records',()=>{
  const d=lib.normalizeDevice({id:'old',host:'192.0.2.20',port:80,agentV2:{token:'a'.repeat(64),port:80}});
  assert.equal(d.port,80);assert.equal(d.agentV2.port,80);assert.equal(d.serial,'192.0.2.20:80');
});
test('Agent read refuses an unsupported saved endpoint before fetch',async()=>{
  const h=fixture();h.device.agentV2={port:80,token:'a'.repeat(64)};
  await assert.rejects(h.ctx.agentFetch(h.device,'/v1/status'),e=>e.status===400);assert.equal(h.calls.length,0);
});
test('Agent read retains the enrolled private HTTP endpoint',async()=>{
  const h=fixture();h.device.agentV2={port:8765,token:'a'.repeat(64)};
  assert.equal((await h.ctx.agentFetch(h.device,'/v1/status')).ok,true);
  assert.equal(h.calls.length,1);assert.equal(h.calls[0][1],'http://192.0.2.10:8765/v1/status');
});
test('bootstrap route returns and persists the same accepted numeric target',async()=>{
  const h=fixture(),response=await h.bootstrapRoute('5556');assert.equal(response.targetPort,5556);assert.equal(response.device.port,5556);assert.equal(response.device.persistentAdb.targetPort,5556);
  assert.ok(h.calls.some(args=>args[0]==='policy'&&args[3]===5556));assert.ok(h.calls.some(args=>args.includes('tcpip')&&args.at(-1)==='5556'));
});
test('bootstrap route defaults to 5555 and rejects explicit zero',async()=>{
  const h=fixture();await assert.rejects(h.bootstrapRoute(0),e=>e.status===400);assert.equal(h.calls.length,0);
  const response=await h.bootstrapRoute(undefined);assert.equal(response.targetPort,5555);assert.equal(response.device.port,5555);
});
