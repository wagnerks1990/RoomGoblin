"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../public/learn/scorm/bridge.js'),'utf8');
function launcher({name='Example, Alex',error='0',throws=false}={}){
 const elements={},listeners={},sent=[],reads=[];
 const popup={postMessage:(value,target)=>sent.push({value,target})};
 let last='0',opened;
 const api={LMSInitialize:()=>true,LMSGetValue:key=>{reads.push(key);if(key==='cmi.core.student_name'){last=error;if(throws)throw Error('Unsupported');return name;}return 'normal';},LMSGetLastError:()=>last,LMSFinish:()=>true};
 const window={LEARNING_CONFIG:{origin:'https://hub.example.edu',activityId:'activity-test'},API:api,addEventListener:(key,fn)=>{listeners[key]=fn;},open:url=>{opened=url;return popup;}};
 window.parent=window;
 vm.runInNewContext(script,{window,document:{getElementById:id=>elements[id]??={}},location:{origin:'https://lms.example.edu'},URL,Uint8Array,crypto:{getRandomValues:bytes=>bytes.fill(1)}});
 elements.open.onclick();const nonce=new URLSearchParams(new URL(opened).hash.slice(1)).get('bridge');
 const request={source:popup,origin:window.LEARNING_CONFIG.origin,data:{type:'roomgoblin.learner.request',nonce,activityId:'activity-test'}};
 return {elements,sent,reads,opened,request,send:event=>listeners.message(event)};
}
test('SCORM reads optional name only for the matching popup, origin, nonce, and activity',()=>{
 const f=launcher();
 for(const event of [{...f.request,source:{}},{...f.request,origin:'https://foreign.example.edu'},{...f.request,data:{...f.request.data,nonce:'wrong'}},{...f.request,data:{...f.request.data,activityId:'wrong'}}])f.send(event);
 assert.equal(f.sent.length,0);assert(!f.reads.includes('cmi.core.student_name'));
 f.send(f.request);assert.equal(f.sent.length,1);assert.equal(f.sent[0].target,'https://hub.example.edu');assert.equal(f.sent[0].value.name,'Example, Alex');
 assert(!f.opened.includes('Example'));assert(!f.reads.includes('cmi.core.student_id'));
});
test('absent, unsupported, overlong, or failed SCORM names preserve launcher availability',()=>{
 for(const options of [{name:''},{name:'   '},{name:null},{name:'x'.repeat(256)},{error:'401'},{throws:true}]){
  const f=launcher(options);f.send(f.request);assert.equal(f.sent.length,0);assert.equal(f.elements.open.disabled,false);
 }
});
