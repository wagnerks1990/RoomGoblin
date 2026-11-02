'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const source=fs.readFileSync(require.resolve('../public/learn/sdk/roomgoblin-scorm.js'),'utf8');
function setup({opener=false,config={}}={}){
 const listeners={},saved=new Map(),messages=[],native=[],elements=[];let commit='true';const activityId=crypto.randomUUID(),learner=crypto.randomUUID();
 const node=()=>({style:{},setAttribute(){},append(){},prepend(){},textContent:''});const document={readyState:'complete',body:node(),createElement(){const n=node();elements.push(n);return n;}};
 const api={LMSSetValue(...args){native.push(['set',this===api,...args]);return 'true';},LMSGetValue(){throw Error('The connector must not introduce extra LMS reads.');},LMSCommit(...args){native.push(['commit',this===api,...args]);return commit;},LMSFinish(...args){native.push(['finish',this===api,...args]);return 'true';}};
 const popup={closed:false,postMessage:(message,origin)=>messages.push({message,origin})};let opened;
 const root={crypto,location:{origin:'https://lms.example.test'},sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},ROOMGOBLIN_SCORM:{origin:'https://learn.example.test',activityId,...config},API:opener?undefined:api,opener:opener?{API:api}:null,addEventListener:(type,fn)=>listeners[type]=fn,open:url=>{opened=url;return popup;},setInterval(){}};root.parent=root;
 vm.runInNewContext(source,{window:root,document,URL,URLSearchParams,Uint8Array,Date,TextEncoder});root.RoomGoblinSCORM.connect();
 const nonce=new URLSearchParams(new URL(opened).hash.slice(1)).get('nonce');
 const send=(data,extra={})=>listeners.message({source:popup,origin:'https://learn.example.test',data:{activityId,nonce,...data},...extra});
 const ready=(id=learner,seq=0)=>send({type:'roomgoblin.connector.ready',state:{learnerKey:id,firstName:'Alex',sequence:seq}});
 return {root,api,native,messages,ready,send,learner,saved,activityId,failCommit:()=>commit='false'};
}
test('SCORM telemetry preserves native return values and this, waits for success, and makes no extra LMS calls',()=>{
 const f=setup();f.ready();assert.equal(f.api.LMSSetValue('cmi.core.score.raw','40'),'true');f.api.LMSSetValue('cmi.core.score.min','0');f.api.LMSSetValue('cmi.core.score.max','50');assert.equal(f.api.LMSCommit(''),'true');
 assert.equal(f.messages.length,1);assert.equal(f.messages[0].message.event.raw,80);assert.equal(f.messages[0].origin,'https://learn.example.test');assert.ok(f.native.every(x=>x[1]));
 f.send({type:'roomgoblin.connector.saved',id:f.messages[0].message.event.id});f.api.LMSSetValue('cmi.core.score.raw','50');f.failCommit();assert.equal(f.api.LMSCommit(''),'false');assert.equal(f.messages.length,1);f.api.LMSSetValue('cmi.core.lesson_status','passed');assert.equal(f.api.LMSFinish(''),'true');assert.equal(f.messages.at(-1).message.event.kind,'completed');
});
test('forged channel messages cannot bind an identity or acknowledge a queued event',()=>{
 const f=setup();f.root.RoomGoblinSCORM.progress(1,50);f.send({type:'roomgoblin.connector.ready',state:{learnerKey:f.learner,sequence:0}},{origin:'https://evil.example.test'});assert.equal(f.messages.length,0);f.ready();assert.equal(f.messages.length,1);
 const event=f.messages[0].message.event;f.send({type:'roomgoblin.connector.saved',id:event.id},{source:{}});assert.ok([...f.saved.values()][0].includes(event.id));
});
test('reconnection cannot rebind a previous learner queue to another Schoology identity',()=>{
 const f=setup();f.ready();f.root.RoomGoblinSCORM.progress(1,50);const old=f.messages[0].message.event;f.ready(crypto.randomUUID(),5);const data=JSON.parse([...f.saved.values()][0]);assert.equal(data.queue.length,0);assert.notEqual(data.learner,old.learnerKey);
});

test('popup-hosted SCORM records progress and opted-in resume only after successful commits',()=>{
 const f=setup({opener:true,config:{progressTotal:50,locationFormat:'run:step',captureResume:true}});f.ready();f.api.LMSSetValue('cmi.core.lesson_location','2:7');f.api.LMSSetValue('cmi.suspend_data','{"a":[1,2]}');f.failCommit();f.api.LMSCommit('');assert.equal(f.messages.length,0);f.api.LMSFinish('');assert.equal(f.messages[0].message.event.kind,'progress');assert.equal(f.messages[0].message.event.current,7);f.send({type:'roomgoblin.connector.saved',id:f.messages[0].message.event.id});assert.equal(f.messages[1].message.event.kind,'checkpoint');assert.equal(f.messages[1].message.event.state,'{"a":[1,2]}');
});
