'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {UbuntuDisplays,screenConfig,STORE}=require('../src/ubuntu-displays');
const privateKey=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
function fixture(){
 const prefs=new Map(),secrets=new Map(),tasks=[],calls=[];
 const output={connector:'HDMI-1',connected:true,monitorId:'a'.repeat(64),modes:['1920x1080']};
 const probe={machineId:'b'.repeat(64),outputs:[output],graphics:'x11',distribution:'ubuntu',version:'24.04',architecture:'x86_64',identity:'fixture'};
 const input={id:'fixture',hubUrl:'http://10.0.0.2:3000',name:'Repaired',address:'10.0.0.8',username:'root',password:'synthetic',fingerprint:'SHA256:'+'A'.repeat(43),confirm:true,screens:[{...output,receiverId:'screen1',name:'Screen'}]};
 let resolve,reject,entered,failSave=false;const sent=new Promise(r=>entered=r),gate=new Promise((a,b)=>{resolve=a;reject=b});
 const storage={getPreference:(k,d)=>structuredClone(prefs.get(k)??d),setPreference:(k,v)=>{if(failSave)throw Error("Synthetic persistence failure");prefs.set(k,structuredClone(v))},getSecret:k=>secrets.get(k),putSecret:(k,v)=>secrets.set(k,v),tx:f=>f(),displayCredentialPolicy:()=>({authenticationRequired:false})};
 const manager=new UbuntuDisplays({storage,autostart:false,track:p=>tasks.push(p),transport:async req=>{calls.push(req.command);if(req.command.endsWith('python3 -'))return probe;if(req.command.includes('python3 -c')){entered();return gate}return JSON.parse(req.input).action==='status'?probe:{ok:true}}});
 storage.setPreference(STORE,[{id:'fixture',name:'Before',address:input.address,port:22,fingerprint:input.fingerprint,machineId:probe.machineId,state:'ready',config:screenConfig(input,probe),scheduled:{id:'scheduled-fixture',state:'scheduled',operation:'update-browser',at:new Date(Date.now()+60000).toISOString()}}]);
 secrets.set('ubuntu-display.fixture.ssh',privateKey);
 return {manager,input,tasks,sent,resolve,reject,calls,failSave:()=>{failSave=true},key:()=>secrets.get("ubuntu-display.fixture.ssh"),row:()=>manager.record('fixture')};
}
test('pending repair does not replace the last confirmed screen mapping',async()=>{
 const h=fixture(),before=h.row().config;h.input.screens[0].receiverId='new-screen';await h.manager.enroll(h.input);await h.sent;
 try{assert.deepEqual(h.row().config,before)}finally{h.resolve({installed:true});await Promise.all(h.tasks)}
});
test('failed repair keeps the last confirmed mapping',async()=>{
 const h=fixture(),before=h.row().config;h.input.screens[0].receiverId='new-screen';await h.manager.enroll(h.input);await h.sent;h.reject(Error('Synthetic install failure'));await Promise.all(h.tasks);
 assert.deepEqual(h.row().config,before);assert.equal(h.row().state,'attention');
});
test('successful repair promotes the accepted screen configuration',async()=>{
 const h=fixture();h.input.screens[0].receiverId='new-screen';await h.manager.enroll(h.input);await h.sent;h.resolve({installed:true});await Promise.all(h.tasks);
 assert.equal(h.row().config.screens[0].receiverId,'new-screen');assert.equal(h.row().state,'ready');
});
test('an uncertain configuration keeps old mapping and protects both receiver targets after restart',async()=>{
 const h=fixture(),before=h.row().config,transport=h.manager.transport;h.input.screens[0].receiverId='new-screen';
 h.manager.transport=async request=>{if(request.command==='roomgoblin-display'&&JSON.parse(request.input).action==='configure')throw Error('Synthetic uncertain configuration');return transport(request)};
 await h.manager.enroll(h.input);await h.sent;h.resolve({installed:true});await Promise.all(h.tasks);
 assert.deepEqual(h.row().config,before);
 const restarted=new UbuntuDisplays({storage:h.manager.storage,autostart:false,transport:async()=>{throw Error('Unexpected dispatch')},allowDisruption:d=>!d.config.screens.some(s=>s.receiverId==='new-screen')});
 await assert.rejects(restarted.command('fixture',{action:'identify'}),/Announcements/);
});
test('a later repair preserves previous uncertain receiver targets until configuration is acknowledged',async()=>{
 const h=fixture();h.manager.updateRecord('fixture',{state:'attention',pendingReceiverIds:['earlier-screen']});h.input.screens[0].receiverId='new-screen';let active=false;
 h.manager.allowDisruption=d=>!active||!d.config.screens.some(s=>s.receiverId==='earlier-screen');
 const result=await h.manager.enroll(h.input);await h.sent;active=true;h.resolve({installed:true});await Promise.all(h.tasks);
 assert.equal(h.manager.jobs.get(result.job.id).state,'failed');assert.ok(h.row().pendingReceiverIds.includes('earlier-screen'));assert.equal(h.row().config.screens[0].receiverId,'screen1');
});
test('acknowledged repair clears uncertain targets and promotes only the accepted configuration',async()=>{
 const h=fixture();h.manager.updateRecord('fixture',{state:'attention',pendingReceiverIds:['earlier-screen']});h.input.screens[0].receiverId='new-screen';await h.manager.enroll(h.input);await h.sent;h.resolve({installed:true});await Promise.all(h.tasks);
 assert.deepEqual(h.row().pendingReceiverIds,[]);assert.equal(h.row().config.screens[0].receiverId,'new-screen');assert.equal(h.row().state,'ready');
});
test('pending mapping health remains visible even when the current receiver is online',()=>{
 const {health}=require('../src/ubuntu-display-health');const h=fixture(),row=h.row();row.pendingReceiverIds=['new-screen'];
 const status=health(row,{online:true,status:{session:{online:true,screens:[{receiverId:'screen1',browserRunning:true}]}}},()=>true);
 assert.equal(status.state,'attention');assert.equal(status.alerts.filter(a=>a.code==='configuration').length,1);
});
test('malformed pending targets fail closed before another command',async()=>{
 const h=fixture();h.manager.updateRecord('fixture',{pendingReceiverIds:'invalid'});await assert.rejects(h.manager.command('fixture',{action:'identify'}),/could not be read/);assert.equal(h.calls.length,0);
});

