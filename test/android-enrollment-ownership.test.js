"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/managed-displays/app.js"),"utf8");
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const calls=[],opened=[],nodes={},values={name:"Submitted",host:"192.0.2.50",pairingPort:"37125",pairingCode:"123456",connectPort:"5555"};let submit,resets=0;
 const button={disabled:false,title:""},form={elements:{},querySelector:()=>button,reset(){resets++;for(const key of Object.keys(values))values[key]=""},addEventListener:(_name,handler)=>submit=handler};
 for(const key of Object.keys(values))Object.defineProperty(form.elements,key,{value:{get value(){return values[key]},set value(v){values[key]=v}}});
 nodes.enroll=form;nodes.editDialog={open:false};nodes.enrollMsg={textContent:""};nodes.devices={querySelectorAll:()=>[]};
 const $=id=>nodes[id]??=( {value:"",disabled:false,textContent:"",addEventListener(){}} );
 const ctx=vm.createContext({$,state:{adbAvailable:true},enrollmentBusy:false,editVersion:0,
  FormData:class{constructor(target){if(target!==form)throw Error("event form unavailable");this.entries=Object.entries(values)}[Symbol.iterator](){return this.entries[Symbol.iterator]()}},
  api(url,options){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});calls.push({url,options,resolve,reject});return promise},
  load:async()=>{},deviceById:()=>({id:"new-display"}),openEdit:id=>opened.push(id)});
 const begin=source.includes("function enrollmentDraft(")?source.indexOf("function enrollmentDraft("):source.indexOf('$("enroll").addEventListener');
 vm.runInContext(source.slice(source.indexOf("function applyBridgeAvailability("),source.indexOf("function filterDisplayInventory("))+source.slice(begin,source.indexOf('$("editForm").addEventListener')),ctx);
 return {ctx,values,nodes,button,calls,opened,resets:()=>resets,submit(){const event={currentTarget:form,preventDefault(){}};const pending=submit(event);event.currentTarget=null;return pending}};
}
const accepted={ok:true,device:{id:"new-display",name:"Accepted display"}};
test("accepted Android enrollment retains its form owner after the DOM event returns",async()=>{
 const h=fixture(),run=h.submit();h.calls[0].resolve(accepted);await run;
 assert.equal(h.resets(),1);assert.equal(h.values.host,"");assert.equal(h.values.connectPort,"5555");assert.deepEqual(h.opened,["new-display"]);assert.doesNotMatch(h.nodes.enrollMsg.textContent,/null|reset/);
});
test("pending Android enrollment clears the submitted pairing code and blocks duplicate submissions",async()=>{
 const h=fixture(),one=h.submit(),two=h.submit();assert.equal(h.calls.length,1);assert.equal(h.values.pairingCode,"");assert.equal(JSON.parse(h.calls[0].options.body).pairingCode,"123456");
 h.ctx.applyBridgeAvailability();assert.equal(h.button.disabled,true);h.calls[0].resolve(accepted);await Promise.all([one,two]);assert.equal(h.button.disabled,false);
});
test("Android enrollment completion preserves a newer draft and pairing code",async()=>{
 const h=fixture(),run=h.submit();h.values.host="192.0.2.51";h.values.pairingCode="654321";h.calls[0].resolve(accepted);await run;
 assert.equal(h.values.host,"192.0.2.51");assert.equal(h.values.pairingCode,"654321");assert.equal(h.resets(),0);assert.equal(h.opened.length,0);assert.match(h.nodes.enrollMsg.textContent,/newer.*draft/i);
});
test("new Android enrollment edits made during the follow-up inventory read are preserved",async()=>{
 const h=fixture();let finish;h.ctx.load=()=>new Promise(resolve=>finish=resolve);const run=h.submit();h.calls[0].resolve(accepted);await flush();assert.equal(typeof finish,"function");h.values.name="Next display";finish();await run;
 assert.equal(h.values.name,"Next display");assert.equal(h.resets(),0);assert.equal(h.opened.length,0);
});
test("Android enrollment does not replace an editor opened while its request was pending",async()=>{
 const h=fixture(),run=h.submit();h.ctx.editVersion++;h.nodes.editDialog.open=true;h.calls[0].resolve(accepted);await run;
 assert.equal(h.opened.length,0);assert.equal(h.resets(),1);
});
test("failed Android enrollment preserves fields, clears its old pairing code and permits an explicit retry",async()=>{
 const h=fixture(),one=h.submit();h.calls[0].reject(Error("fixture failure"));await one;
 assert.equal(h.values.host,"192.0.2.50");assert.equal(h.values.pairingCode,"");assert.equal(h.button.disabled,false);assert.match(h.nodes.enrollMsg.textContent,/fixture failure/);
 h.values.pairingCode="654321";const two=h.submit();assert.equal(h.calls.length,2);h.calls[1].resolve(accepted);await two;
});
test("unconfirmed Android enrollment replies preserve the draft and never repeat enrollment",async()=>{
 const h=fixture(),run=h.submit();h.calls[0].resolve({ok:true});await run;
 assert.equal(h.calls.length,1);assert.equal(h.resets(),0);assert.match(h.nodes.enrollMsg.textContent,/not be confirmed|unconfirmed/i);assert.equal(h.opened.length,0);
});
test("an unavailable ADB bridge rejects programmatic enrollment admission",async()=>{
 const h=fixture();h.ctx.state.adbAvailable=false;const run=h.submit();assert.equal(h.calls.length,0);await run;assert.equal(h.resets(),0);
});
test("an accepted Android enrollment survives a failed inventory follow-up",async()=>{
 const h=fixture();h.ctx.load=async()=>{throw Error("inventory unavailable")};const run=h.submit();h.calls[0].resolve(accepted);await run;
 assert.match(h.nodes.enrollMsg.textContent,/Enrolled Accepted display/);assert.match(h.nodes.enrollMsg.textContent,/Refresh inventory/);assert.equal(h.opened.length,0);assert.equal(h.calls.length,1);
});
test("Android enrollment completion honors current bridge availability",async()=>{
 const h=fixture(),run=h.submit();h.ctx.state.adbAvailable=false;h.calls[0].reject(Error("bridge unavailable"));await run;
 assert.equal(h.button.disabled,true);assert.equal(h.ctx.enrollmentBusy,false);
});
