"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../public/learn/scorm/bridge.js'),'utf8');
function launcher({name='Example, Alex',error='0',throws=false,mode='normal',failCommit=false}={}){
 const elements={},listeners={},sent=[],reads=[],values={},timers=[];let commits=0,attempts=0;
 const popup={postMessage:(value,target)=>sent.push({value,target})};
 let last='0',opened;
 const api={LMSInitialize:()=>true,LMSGetValue:key=>{reads.push(key);if(key==='cmi.core.student_name'){last=error;if(throws)throw Error('Unsupported');return name;}return mode;},LMSGetLastError:()=>last,LMSSetValue:(k,v)=>{values[k]=v;last='0';return true;},LMSCommit:()=>{attempts++;if(failCommit)return false;commits++;return true;},LMSFinish:()=>true};
 const window={LEARNING_CONFIG:{origin:'https://hub.example.edu',activityId:'activity-test'},API:api,addEventListener:(key,fn)=>{listeners[key]=fn;},open:url=>{opened=url;return popup;}};
 window.parent=window;
 vm.runInNewContext(script,{window,document:{getElementById:id=>elements[id]??={}},location:{origin:'https://lms.example.edu'},URL,Uint8Array,crypto:{getRandomValues:bytes=>bytes.fill(1)},setInterval:fn=>(timers.push(fn),timers.length),clearInterval:()=>{}});
 if(elements.open.disabled===false)elements.open.onclick();const nonce=opened?new URLSearchParams(new URL(opened).hash.slice(1)).get('bridge'):null;
 const request={source:popup,origin:window.LEARNING_CONFIG.origin,data:{type:'roomgoblin.learner.request',nonce,activityId:'activity-test'}};
 return {elements,sent,reads,opened,request,values,send:event=>listeners.message(event),tick:()=>timers.forEach(fn=>fn()),finish:()=>listeners.pagehide(),setFailure:v=>{failCommit=v;},counts:()=>({commits,attempts})};
}
test('SCORM reads optional name only for the matching popup, origin, nonce, and activity',()=>{
 const f=launcher();
 for(const event of [{...f.request,source:{}},{...f.request,origin:'https://foreign.example.edu'},{...f.request,data:{...f.request.data,nonce:'wrong'}},{...f.request,data:{...f.request.data,activityId:'wrong'}}])f.send(event);
 assert.equal(f.sent.length,0);assert(!f.reads.includes('cmi.core.student_name'));
 f.send(f.request);assert.equal(f.sent.length,1);assert.equal(f.sent[0].target,'https://hub.example.edu');assert.equal(f.sent[0].value.name,'Example, Alex');
 assert(!f.opened.includes('Example'));assert(!f.reads.includes('cmi.core.student_id'));
});
const gradeEvent=(f,extra={})=>({...f.request,data:{...f.request.data,type:'roomgoblin.grade',score:14,possible:20,raw:70,reviewId:'review-test',approvedAt:'2026-11-02T12:00:00.000Z',...extra}});
test('SCORM commits published grades automatically, acknowledges success, and replaces corrected scores without duplicate commits',()=>{
 const f=launcher(),event=gradeEvent(f);f.send(event);
 assert.equal(f.values['cmi.core.score.raw'],'70');assert.equal(f.values['cmi.core.lesson_status'],'completed');assert.equal(f.counts().commits,1);
 assert.equal(f.sent.at(-1).value.type,'roomgoblin.grade.result');assert.equal(f.sent.at(-1).value.saved,true);
 f.send(event);f.tick();assert.equal(f.counts().commits,1);
 f.send(gradeEvent(f,{score:17,raw:85,approvedAt:'2026-11-02T12:01:00.000Z'}));
 assert.equal(f.values['cmi.core.score.raw'],'85');assert.equal(f.counts().commits,2);assert.equal(f.sent.at(-1).value.raw,85);
});
test('SCORM retries an unconfirmed commit automatically and stops writing after finish',()=>{
 const f=launcher({failCommit:true});f.send(gradeEvent(f));assert.equal(f.counts().commits,0);assert.equal(f.elements.retry.hidden,false);assert.equal(f.sent.at(-1).value.saved,false);
 f.setFailure(false);f.tick();assert.equal(f.counts().commits,1);assert.equal(f.elements.retry.hidden,true);assert.equal(f.sent.at(-1).value.saved,true);
 f.finish();f.send(gradeEvent(f,{score:20,raw:100}));f.tick();assert.equal(f.counts().commits,1);
});
test('SCORM rejects forged or malformed grades and read-only launches never save',()=>{
 const f=launcher(),event=gradeEvent(f);
 for(const wrong of [{...event,source:{}},{...event,origin:'https://foreign.example.edu'},gradeEvent(f,{nonce:'wrong'}),gradeEvent(f,{activityId:'other'}),gradeEvent(f,{raw:100}),gradeEvent(f,{score:21,raw:105}),gradeEvent(f,{approvedAt:'invalid'}),gradeEvent(f,{reviewId:''})])f.send(wrong);
 assert.equal(f.counts().attempts,0);
 for(const mode of ['review','browse']){const readOnly=launcher({mode});readOnly.send(gradeEvent(readOnly));readOnly.tick();assert.equal(readOnly.counts().attempts,0);}
});
test('absent, unsupported, overlong, or failed SCORM names preserve launcher availability',()=>{
 for(const options of [{name:''},{name:'   '},{name:null},{name:'x'.repeat(256)},{error:'401'},{throws:true}]){
  const f=launcher(options);f.send(f.request);assert.equal(f.sent.length,0);assert.equal(f.elements.open.disabled,false);
 }
});
