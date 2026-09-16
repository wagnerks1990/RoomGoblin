'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {EventEmitter}=require('node:events');
const helpers=require('../src/veyon-free-features');

test('Wake packet contains exactly the selected unicast MAC, repeated sixteen times',()=>{
  assert.equal(helpers.normalizeMac('02-aB-12-34-56-78'),'02:AB:12:34:56:78');
  const p=helpers.magicPacket('02ab12345678');assert.equal(p.length,102);assert.equal(p.subarray(0,6).toString('hex'),'ffffffffffff');
  for(let n=0;n<16;n++)assert.equal(p.subarray(6+n*6,12+n*6).toString('hex'),'02ab12345678');
  for(const bad of ['','00:00:00:00:00:00','ff:ff:ff:ff:ff:ff','01:12:34:56:78:90','02:12:34:56:78:90;id','02:12-34:56:78:90'])assert.throws(()=>helpers.magicPacket(bad));
});
test('Wake transport closes on success and synchronous bind failure, with no fake verification',async()=>{
  let closed=0;
  const socket=Object.assign(new EventEmitter(),{bind(_port,cb){cb()},setBroadcast(v){assert.equal(v,true)},send(packet,port,host,cb){assert.equal(packet.length,102);assert.equal(port,9);assert.equal(host,'255.255.255.255');cb()},close(){closed++}});
  assert.deepEqual(await helpers.wakeComputer('02:12:34:56:78:90',()=>socket),{accepted:true,verified:false});assert.equal(closed,1);
  socket.bind=()=>{throw Error('internal path/private context')};await assert.rejects(helpers.wakeComputer('02:12:34:56:78:90',()=>socket),/^Error: Wake-on-LAN packet could not be sent\.$/);assert.equal(closed,2);
});
test('Shutdown arguments are bounded and cannot imply a cancellation',()=>{
  assert.deepEqual(helpers.powerArguments('powerDownDelayed',{shutdownTimeout:120,untrusted:'ignored'}),{shutdownTimeout:120});
  for(const v of [undefined,0,29,3601,Infinity,2.5])assert.throws(()=>helpers.powerArguments('powerDownDelayed',{shutdownTimeout:v}));
  for(const feature of Object.keys(helpers.POWER_FEATURES))assert.throws(()=>helpers.powerArguments(feature,{},false),/cannot be cancelled/);
  assert.deepEqual(helpers.powerArguments('powerDownNow',{shutdownTimeout:55,password:'not-forwarded'}),{});
});
test('Native launchers cannot inject hostnames, commands or computer metadata into PowerShell',()=>{
  const script=helpers.nativeLauncher([{ip:'192.0.2.4',name:"'; Write-Host injected; #",privateKey:'secret'}],'control');
  assert.match(script,/'remoteaccess','control',\$target/);assert.doesNotMatch(script,/injected|secret|ExecutionPolicy|Invoke-Expression/);
  for(const ip of ['host.example','192.0.2.4;whoami','::1'])assert.throws(()=>helpers.nativeLauncher([{ip}],'view'));
  assert.throws(()=>helpers.nativeLauncher([{ip:'192.0.2.1'}],'shell'));
  assert.throws(()=>helpers.nativeLauncher(Array(17).fill({ip:'192.0.2.1'}),'view'));
});
test('Catalog never treats local plugin advertisement as endpoint verification',()=>{
  const rows=helpers.featureCatalog([{name:'FileTransfer'}]);const file=rows.find(r=>r.name==='FileTransfer');
  assert.equal(file.advertised,true);assert.equal(file.provider,'desktop');assert.equal(rows.some(r=>r.endpointVerified),false);
  assert.equal(rows.find(r=>r.name==='PowerOn').advertised,false);
});
test('Lesson actions allow only bounded app/message/http presets and reject URL credentials',()=>{
  assert.deepEqual(helpers.normalizeLessonAction({name:' Example ',feature:'openWebsite',value:' https://example.com '}),{name:'Example',feature:'openWebsite',value:'https://example.com'});
  for(const value of ['javascript:alert(1)','file:///tmp/file','https://username:password@example.com'])assert.throws(()=>helpers.normalizeLessonAction({name:'X',feature:'openWebsite',value}));
  assert.throws(()=>helpers.normalizeLessonAction({name:'X',feature:'powerDownNow',value:'x'}));
  assert.throws(()=>helpers.normalizeLessonAction({name:'X',feature:'textMessage',value:'x'.repeat(2001)}));
});
function routes(){
  const registered=new Map(),prefs=new Map(),packets=[];
  const computers={one:{id:'one',ip:'192.0.2.1',hostname:'PC-A',macHostname:'pc-a',mac:'02:12:34:56:78:90'}};
  const source=fs.readFileSync('src/server.js','utf8');
  const region=source.slice(source.indexOf('app.get("/api/v1/veyon/computers/:id/catalog"'),source.indexOf('app.get("/api/v1/veyon/computers/:id/feature/:feature"'));
  const context={...helpers,app:Object.fromEntries(['get','post','put'].map(method=>[method,(path,cap,fn)=>registered.set(method+' '+path,{cap,fn})])),requireCapability:c=>c,veyonComputerStore:{computers},veyonComputerId:String,dbStore:{getPreference:(k,f)=>prefs.get(k)||f,setPreference:(k,v)=>prefs.set(k,v)},audit:()=>{},mapLimit:async(items,_limit,fn)=>Promise.all(items.map(fn)),wakeComputer:async mac=>{packets.push(mac);return {accepted:true,verified:false}},veyonAvailableFeatures:async()=>[{name:'RemoteControl'}],safeVeyonFailure:()=>({ok:false,error:'Unavailable'})};
  vm.runInNewContext(region,context);
  async function call(method,path,body={},params={}){const {cap,fn}=registered.get(method+' '+path),res={statusCode:200,status(n){this.statusCode=n;return this},json(v){this.body=JSON.parse(JSON.stringify(v));return this},set(){return this},type(){return this},send(v){this.body=v;return this}};await fn({body,params},res);return {...res,cap}}
  return {call,computers,packets};
}
test('Protected routes reject arbitrary targets and stale MAC identity, and store no failed presets',async()=>{
  const h=routes();let r=await h.call('post','/api/v1/veyon/desktop-launcher',{targets:['missing'],mode:'view'});assert.equal(r.statusCode,400);assert.equal(r.cap,'lab.control');
  r=await h.call('post','/api/v1/veyon/wake',{targets:['constructor']});assert.equal(r.statusCode,400);assert.equal(h.packets.length,0);
  r=await h.call('post','/api/v1/veyon/wake',{targets:['one','one']});assert.equal(r.body.results.length,1);assert.equal(h.packets.length,1);assert.equal(r.body.results[0].verified,false);
  h.computers.one.hostname='OTHER';r=await h.call('post','/api/v1/veyon/wake',{targets:['one']});assert.equal(r.body.ok,false);assert.equal(h.packets.length,1);
  r=await h.call('put','/api/v1/veyon/lesson-actions',{actions:[{name:'a',feature:'textMessage',value:'x'},{name:'A',feature:'textMessage',value:'y'}]});assert.equal(r.statusCode,400);
  assert.deepEqual((await h.call('get','/api/v1/veyon/lesson-actions')).body.actions,[]);
  r=await h.call('get','/api/v1/veyon/computers/:id/catalog',{}, {id:'one'});assert.equal(r.cap,'lab.read');assert.equal(r.body.verification,'proxy-advertisement-only');
});

function recorderHarness(){
  const elements=new Map(),timers=new Map(),listeners=new Map(),recorders=[],state={visible:true,stoppedTracks:0,signal:null};let timerId=0;
  const $=id=>{if(!elements.has(id))elements.set(id,{disabled:false,textContent:''});return elements.get(id)};
  class Canvas {getContext(){return {fillRect(){}}}captureStream(){return {getTracks:()=>[{stop:()=>state.stoppedTracks++}]}}}
  class Recorder {static isTypeSupported(){return true}constructor(){this.state='inactive';recorders.push(this)}start(){this.state='recording'}stop(){this.state='inactive';this.onstop()}}
  const context={$ ,targetIds:()=>['one'],previewSurfaceVisible:()=>state.visible,HTMLCanvasElement:Canvas,MediaRecorder:Recorder,AbortController,Blob,Date,
    document:{hidden:false,createElement:()=>new Canvas(),addEventListener:(event,fn)=>listeners.set('document:'+event,fn)},window:{addEventListener:(event,fn)=>listeners.set(event,fn)},
    setTimeout:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId},clearTimeout:id=>timers.delete(id),confirm:()=>true,alert:message=>{throw Error(message)},
    imageFrame:(_url,controller)=>{state.signal=controller.signal;return new Promise(()=>{})}};
  vm.runInNewContext(fs.readFileSync('public/controller/veyon-free-features.js','utf8'),context);
  return {$,timers,listeners,recorders,state};
}
test('Recording hard deadline and embedded hide stop tracks even when capture is stalled',async()=>{
  for(const event of ['deadline','roomgoblin:viewport']){
    const h=recorderHarness();await h.$('startRecording').onclick();assert.equal(h.$('startRecording').disabled,true);
    if(event==='deadline') [...h.timers.values()].find(t=>t.delay===300000).fn();
    else {h.state.visible=false;h.listeners.get(event)()}
    assert.equal(h.state.stoppedTracks,1);assert.equal(h.state.signal.aborted,true);
    assert.equal(h.$('startRecording').disabled,false);assert.equal(h.$('stopRecording').disabled,true);assert.equal(h.timers.size,0);
  }
});
test('Recording discards a chunk that would exceed its hard memory/output limit',async()=>{
  const h=recorderHarness();await h.$('startRecording').onclick();h.recorders[0].ondataavailable({data:{size:32*1024*1024+1}});
  assert.match(h.$('recordingStatus').textContent,/Size limit exceeded; recording discarded/);
  assert.equal(h.$('downloadRecording').disabled,true);assert.equal(h.state.stoppedTracks,1);
});
