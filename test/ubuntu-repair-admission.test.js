'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {UbuntuDisplays,screenConfig,STORE}=require('../src/ubuntu-displays');
const privateKey=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs1',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
function fixture({holdProbe=false}={}){
 const prefs=new Map(),secrets=new Map(),tasks=[],calls=[],actions=[];
 const output={connector:'HDMI-1',connected:true,monitorId:'a'.repeat(64),modes:['1920x1080']};
 const probe={machineId:'b'.repeat(64),outputs:[output],graphics:'x11',distribution:'ubuntu',version:'24.04',architecture:'x86_64',identity:'fixture'};
 const input={id:'fixture',hubUrl:'http://10.0.0.2:3000',name:'Repaired',address:'10.0.0.8',username:'root',password:'synthetic',fingerprint:'SHA256:'+'A'.repeat(43),confirm:true,screens:[{...output,receiverId:'screen1',name:'Screen'}]};
 let resolve,reject,entered,failSave=false,probeEntered,resolveProbe,rejectProbe;const probeSent=new Promise(r=>probeEntered=r),probeGate=new Promise((a,b)=>{resolveProbe=a;rejectProbe=b});const sent=new Promise(r=>entered=r),gate=new Promise((a,b)=>{resolve=a;reject=b});
 const storage={getPreference:(k,d)=>structuredClone(prefs.get(k)??d),setPreference:(k,v)=>{if(failSave)throw Error("Synthetic persistence failure");prefs.set(k,structuredClone(v))},getSecret:k=>secrets.get(k),putSecret:(k,v)=>secrets.set(k,v),tx:f=>f(),displayCredentialPolicy:()=>({authenticationRequired:false})};
 const manager=new UbuntuDisplays({storage,autostart:false,track:p=>tasks.push(p),transport:async req=>{calls.push(req.command);if(req.command==="roomgoblin-display")actions.push(JSON.parse(req.input).action);if(req.command.endsWith('python3 -')){probeEntered();if(holdProbe)await probeGate;return probe}if(req.command.includes('python3 -c')){entered();return gate}return JSON.parse(req.input).action==='status'?probe:{ok:true}}});
 storage.setPreference(STORE,[{id:'fixture',name:'Before',address:input.address,port:22,fingerprint:input.fingerprint,machineId:probe.machineId,state:'ready',config:screenConfig(input,probe),scheduled:{id:'scheduled-fixture',state:'scheduled',operation:'update-browser',at:new Date(Date.now()+60000).toISOString()}}]);
 secrets.set('ubuntu-display.fixture.ssh',privateKey);
 return {manager,input,tasks,sent,resolve,reject,calls,actions,probeSent,resolveProbe,rejectProbe,failSave:()=>{failSave=true},key:()=>secrets.get("ubuntu-display.fixture.ssh"),row:()=>manager.record('fixture')};
}
test('repair rejects a computer already owned by another operation',async()=>{
 const h=fixture();h.manager.busy.add('fixture');
 try{await assert.rejects(h.manager.enroll(h.input),/busy/i)}finally{h.resolve({installed:true});await Promise.all(h.tasks)}
 assert.equal(h.calls.filter(c=>c.includes('python3 -c')).length,0);assert.equal(h.manager.busy.has('fixture'),true);
});
test('repair rejects an announcement lock before installing',async()=>{
 const h=fixture();h.manager.allowDisruption=()=>false;
 try{await assert.rejects(h.manager.enroll(h.input),/Announcements/i)}finally{h.resolve({installed:true});await Promise.all(h.tasks)}
 assert.equal(h.calls.filter(c=>c.includes('python3 -c')).length,0);
});
test('announcements that start during installation prevent follow-up screen configuration',async()=>{
 const h=fixture();const result=await h.manager.enroll(h.input);await h.sent;h.manager.allowDisruption=()=>false;h.resolve({installed:true});await Promise.all(h.tasks);
 assert.equal(h.manager.jobs.get(result.job.id).state,'failed');assert.match(h.manager.jobs.get(result.job.id).error,/Announcements/i);assert.equal(h.row().state,'attention');
});
test('repair protects newly selected receiver targets before any installation write',async()=>{
 const h=fixture();h.input.screens[0].receiverId='new-screen';h.manager.allowDisruption=d=>!d.config.screens.some(s=>s.receiverId==='new-screen');
 try{await assert.rejects(h.manager.enroll(h.input),/Announcements/i)}finally{h.resolve({installed:true});await Promise.all(h.tasks)}
 assert.equal(h.calls.filter(c=>c.includes('python3 -c')).length,0);
});
test('repair protects old receiver targets if announcements start before configuration dispatch',async()=>{
 const h=fixture();h.input.screens[0].receiverId='new-screen';let active=false;h.manager.allowDisruption=d=>!active||!d.config.screens.some(s=>s.receiverId==='screen1');
 const result=await h.manager.enroll(h.input);await h.sent;active=true;h.resolve({installed:true});await Promise.all(h.tasks);
 assert.equal(h.manager.jobs.get(result.job.id).state,'failed');assert.equal(h.actions.includes('configure'),false);
});
test('full recovery admission closing during installation prevents a new configuration write',async()=>{
 const h=fixture();const result=await h.manager.enroll(h.input);await h.sent;h.manager.canRun=()=>false;h.resolve({installed:true});await Promise.all(h.tasks);
 assert.equal(h.manager.jobs.get(result.job.id).state,'failed');assert.equal(h.actions.includes('configure'),false);assert.equal(h.manager.busy.size,0);
});
test('repair reserves its existing computer while the initial probe is pending',async()=>{
 const h=fixture({holdProbe:true}),pending=h.manager.enroll(h.input);await h.probeSent;
 try{await assert.rejects(h.manager.command('fixture',{action:'identify'}),/busy/i)}finally{h.resolveProbe();await pending;h.resolve({installed:true});await Promise.all(h.tasks)}
 assert.equal(h.actions.includes('identify'),false);assert.equal(h.manager.busy.size,0);
});
test('failed repair probing releases only its own reservation and retains management identity',async()=>{
 const h=fixture({holdProbe:true}),key=h.key(),pending=h.manager.enroll(h.input);await h.probeSent;h.rejectProbe(Error('Synthetic failed probe'));await assert.rejects(pending,/failed probe/);
 assert.equal(h.key(),key);assert.equal(h.row().state,'ready');assert.equal(h.manager.enrolling,false);assert.equal(h.manager.busy.size,0);assert.equal(h.calls.filter(c=>c.includes('python3 -c')).length,0);
});

