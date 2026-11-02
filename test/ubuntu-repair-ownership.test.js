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
for(const success of [true,false])test(`repair ${success?'success':'failure'} retains a cancelled schedule and its history`,async()=>{
 const h=fixture();await h.manager.enroll(h.input);await h.sent;h.manager.cancelScheduled('fixture');const history=h.row().history;
 if(success)h.resolve({installed:true});else h.reject(Error('synthetic failure'));
 await Promise.all(h.tasks);assert.equal(h.row().scheduled.state,'cancelled');assert.deepEqual(h.row().history,history);assert.equal(h.row().state,success?'ready':'attention');assert.equal(h.manager.busy.size,0);
});
test('repair completion retains metadata updated while the installer was pending',async()=>{
 const h=fixture();await h.manager.enroll(h.input);await h.sent;h.manager.updateRecord('fixture',{notes:'New note',lastSeenAt:'2026-10-28T12:00:00Z'});h.resolve({installed:true});await Promise.all(h.tasks);
 assert.equal(h.row().notes,'New note');assert.equal(h.row().lastSeenAt,'2026-10-28T12:00:00Z');
});
test('repair keeps its saved management identity and releases ownership after success',async()=>{
 const h=fixture(),key=h.key();await h.manager.enroll(h.input);await h.sent;h.resolve({installed:true});await Promise.all(h.tasks);
 assert.equal(h.row().name,'Repaired');assert.equal(h.row().state,'ready');assert.equal(h.key(),key);assert.equal(h.manager.busy.size,0);assert.equal(h.manager.enrolling,false);assert.equal(h.calls.filter(c=>c.includes('python3 -c')).length,1);
});
test('uncertain installation fails visibly and never replays its remote write',async()=>{
 const h=fixture();const result=await h.manager.enroll(h.input);await h.sent;h.reject(Error('synthetic unconfirmed remote result'));await Promise.all(h.tasks);
 assert.equal(h.manager.jobs.get(result.job.id).state,'failed');assert.match(h.manager.jobs.get(result.job.id).error,/Installation failed/);assert.equal(h.calls.filter(c=>c.includes('python3 -c')).length,1);assert.equal(h.manager.busy.size,0);assert.equal(h.manager.enrolling,false);
});
test('repair completion persistence failure retains the durable cancellation and releases ownership',async()=>{
 const h=fixture();const result=await h.manager.enroll(h.input);await h.sent;h.manager.cancelScheduled('fixture');h.failSave();h.resolve({installed:true});await assert.rejects(Promise.all(h.tasks),/persistence failure/);
 assert.equal(h.row().scheduled.state,'cancelled');assert.equal(h.manager.jobs.get(result.job.id).state,'failed');assert.equal(h.manager.busy.size,0);assert.equal(h.manager.enrolling,false);assert.equal(h.calls.filter(c=>c.includes('python3 -c')).length,1);
});

