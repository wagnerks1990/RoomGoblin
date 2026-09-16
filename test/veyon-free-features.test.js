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
  const context={...helpers,veyonFreeReadLimit:()=>{},veyonFreeWriteLimit:()=>{},app:Object.fromEntries(['get','post','put'].map(method=>[method,(path,_limit,cap,fn)=>registered.set(method+' '+path,{cap,fn})])),requireCapability:c=>c,veyonComputerStore:{computers},veyonComputerId:String,dbStore:{getPreference:(k,f)=>prefs.get(k)||f,setPreference:(k,v)=>prefs.set(k,v)},audit:()=>{},mapLimit:async(items,_limit,fn)=>Promise.all(items.map(fn)),wakeComputer:async mac=>{packets.push(mac);return {accepted:true,verified:false}},veyonAvailableFeatures:async()=>[{name:'RemoteControl'}],safeVeyonFailure:()=>({ok:false,error:'Unavailable'})};
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

test('Free-tool budgets reject write floods across forwarded addresses without starving cleanup',async()=>{
  const express=require('express'),{rateLimit}=require('express-rate-limit');
  const source=fs.readFileSync('src/server.js','utf8'),defs=source.slice(source.indexOf('const veyonFreeReadLimit='),source.indexOf('app.get("/api/v1/veyon/computers/:id/catalog"'));
  const context={rateLimit};vm.runInNewContext(defs+';globalThis.limits={read:veyonFreeReadLimit,write:veyonFreeWriteLimit,cleanup:veyonFreeCleanupLimit}',context);
  const app=express();for(const [name,limiter] of Object.entries(context.limits))app.get('/'+name,limiter,(_req,res)=>res.json({ok:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  try{
    const base='http://127.0.0.1:'+server.address().port;
    for(let i=0;i<30;i++)assert.equal((await fetch(base+'/write',{headers:{'X-Forwarded-For':`192.0.2.${i+1}`}})).status,200);
    const blocked=await fetch(base+'/write',{headers:{'X-Forwarded-For':'198.51.100.1'}});assert.equal(blocked.status,429);assert.ok(blocked.headers.get('retry-after'));
    assert.equal((await fetch(base+'/cleanup')).status,200);assert.equal((await fetch(base+'/read')).status,200);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));for(const limit of Object.values(context.limits))limit.resetKey('unused')}
});

test('feature discovery retains new appliance features without old-version assumptions',()=>{
  const rows=helpers.featureCatalog([{name:'FileCollect'},{name:'NewPluginFeature'}]);
  assert.equal(rows.find(x=>x.name==='FileCollect').advertised,true);
  assert.equal(rows.find(x=>x.name==='NewPluginFeature').provider,'unmapped');
  assert.equal(rows.find(x=>x.name==='NewPluginFeature').endpointVerified,false);
  assert.ok(rows.every(x=>!x.detail.includes('4.9.7')));
});

test('Clipboard requires an exact native bridge identity and bounds UTF-8 content',()=>{
  const valid={name:'RoomGoblinClipboardWrite',uid:helpers.CLIPBOARD_FEATURE};
  assert.equal(helpers.clipboardAdvertised([valid]),true);
  assert.equal(helpers.clipboardAdvertised([{name:valid.name,uid:'wrong'}]),false);
  assert.equal(helpers.clipboardAdvertised([{name:'ClipboardExchange',uid:valid.uid}]),false);
  assert.equal(helpers.featureCatalog([{name:valid.name,uid:'wrong'}]).find(f=>f.name===valid.name).advertised,false);
  assert.deepEqual(helpers.clipboardArguments({clipboardText:'  hello\n',extra:'ignored'}),{clipboardText:'  hello\n'});
  assert.equal(helpers.clipboardArguments({clipboardText:'é'.repeat(4096)}).clipboardText.length,4096);
  for(const text of ['',null,4,{},'x\0y','é'.repeat(4097)])assert.throws(()=>helpers.clipboardArguments({clipboardText:text}));
  assert.throws(()=>helpers.clipboardArguments({clipboardText:'text'},false));
});
test('Clipboard command route requires control capability, one saved target and strips extra arguments',()=>{
  const source=fs.readFileSync('src/server.js','utf8'),start=source.indexOf('app.post("/api/v1/veyon/feature"'),end=source.indexOf('app.get("/api/v1/lab/computers"',start);
  let handler,cap,limit;const queued=[];
  const context={...helpers,Buffer,app:{post(_path,l,c,fn){limit=l;cap=c;handler=fn}},veyonFreeWriteLimit:'bounded',requireCapability:c=>c,VEYON_FEATURES:{clipboardWrite:helpers.CLIPBOARD_FEATURE,keySequence:helpers.INPUT_FEATURE_UID},veyonComputerStore:{computers:{one:{id:'one',ip:'192.0.2.1'}}},veyonComputerId:String,requestUser:()=>({id:'teacher'}),veyonCommandQueue:{enqueue:job=>{queued.push(job);return {id:'job'}}}};
  vm.runInNewContext(source.slice(start,end),context);
  const call=body=>{const res={code:200,status(c){this.code=c;return this},json(v){this.body=v;return this}};handler({body},res);return res};
  assert.equal(cap,'lab.control');assert.equal(limit,'bounded');
  for(const targets of [['all'],['one','one'],['constructor'],['missing']])assert.equal(call({feature:'clipboardWrite',targets,arguments:{clipboardText:'x'}}).code,400);
  assert.equal(queued.length,0);
  assert.equal(call({feature:'clipboardWrite',targets:['one'],arguments:{clipboardText:'x',privateKey:'discard'}}).code,202);
  assert.equal(call({feature:'keySequence',targets:['one'],arguments:{sequence:'Ctrl+V'}}).code,202);
  assert.ok(queued[1].expiresAt>Date.now()&&queued[1].expiresAt<=Date.now()+5000);
  assert.equal(call({feature:'keySequence',targets:['all'],arguments:{sequence:'Enter'}}).code,400);
  assert.equal(queued[0].owner,'teacher');assert.deepEqual(JSON.parse(JSON.stringify(queued[0].args)),{clipboardText:'x'});
});

test('Clipboard dialog pins its named target and clears text before submitting',async()=>{
  const elements=new Map(),sent=[],alerts=[];let selected=['one'],closed=false,advertised=true;
  const $=id=>{if(!elements.has(id))elements.set(id,{disabled:false,value:'',focus(){}});return elements.get(id)};
  const context={$ ,targetIds:()=>selected,computers:[{id:'one',name:'Test <PC>'}],TextEncoder,
    api:async()=>({features:[{name:'RoomGoblinClipboardWrite',advertised}]}),esc:v=>String(v).replaceAll('<','&lt;'),
    openInfo:(_title,html)=>{assert.match(html,/Test &lt;PC>/);closed=false},closeInfo:()=>{closed=true},
    feature:async(...args)=>{assert.equal($('clipboardText').value,'');assert.equal(closed,true);sent.push(args)},
    alert:message=>alerts.push(message),document:{addEventListener(){}},window:{addEventListener(){}}};
  vm.runInNewContext(fs.readFileSync('public/controller/veyon-free-features.js','utf8'),context);
  await $('sendClipboard').onclick();selected=['other'];$('clipboardText').value='multi\nline é';
  await $('clipboardForm').onsubmit({preventDefault(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(sent)),[[['one'],'clipboardWrite',true,{clipboardText:'multi\nline é'}]]);
  selected=['one'];advertised=false;await $('sendClipboard').onclick();assert.match(alerts[0],/requires the RoomGoblinWebBridge/);
  assert.equal(sent.length,1);assert.equal($('sendClipboard').disabled,false);
});

test('Keyboard bridge allows only complete fixed key sequences and exact advertisement',()=>{
  assert.equal(helpers.keyAdvertised([{name:'RoomGoblinKeySequence',uid:helpers.INPUT_FEATURE_UID}]),true);
  assert.equal(helpers.keyAdvertised([{name:'RoomGoblinKeySequence',uid:helpers.CLIPBOARD_FEATURE}]),false);
  for(const sequence of helpers.KEY_SEQUENCES)assert.deepEqual(helpers.keyArguments({sequence,held:true}),{sequence});
  for(const sequence of ['Ctrl+Alt+Delete','Win+R','',null,4,'a','0xff0d'])assert.throws(()=>helpers.keyArguments({sequence}));
  assert.throws(()=>helpers.keyArguments({sequence:'Enter'},false));
  const native=fs.readFileSync('integrations/veyon-plugins/webbridge/RoomGoblinWebBridge.cpp','utf8');
  for(const sequence of helpers.KEY_SEQUENCES)assert.ok(native.includes(`QStringLiteral("${sequence}")`));
});
