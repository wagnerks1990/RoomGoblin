"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/controller/esphome.js"),"utf8");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function fixture(){const gate=deferred(),write=deferred(),nodes={espMessage:{textContent:""},espEnrollment:{open:false}},h={gate,write};let submit;
 const ctx=vm.createContext({inventoryRevision:0,authRevision:0,managementBusy:false,inventoryMessage:"",managementMessage:"",admin:()=>true,userCan:()=>true,devices:[{id:"node",enabled:true}],loading:false,stale:false,editing:null,saving:false,busy:new Set(),active:()=>true,render(){},resetEditor(){},scanDiscovery:async()=>{},confirm:()=>true,endpoint:id=>"/fixture/"+id,$:id=>nodes[id]||(nodes[id]={value:"",textContent:""}),api:()=>gate.promise,write:()=>write.promise});
 vm.runInContext(block("async function change(","async function send(")+block("async function refresh(){",'form.addEventListener("submit"'),ctx);
 h.ctx=ctx;h.nodes=nodes;return h;
}
test("an inventory read predating removal cannot restore the removed device",async()=>{
 const h=fixture(),read=h.ctx.refresh(),change=h.ctx.change(h.ctx.devices[0],false);h.write.resolve({devices:[]});await change;h.gate.resolve({devices:[{id:"node",enabled:true}]});await read;assert.equal(h.ctx.devices.length,0);
});
test("an old inventory error cannot replace successful management state",async()=>{
 const h=fixture(),read=h.ctx.refresh(),change=h.ctx.change(h.ctx.devices[0],false);h.write.resolve({devices:[{id:"node",enabled:false}]});await change;h.gate.reject(Error("old read failed"));await read;assert.equal(h.ctx.stale,false);
});
test("one management change cannot admit another while its first write is pending",async()=>{
 const h=fixture();let calls=0;h.ctx.write=()=>{calls++;return h.write.promise};const a=h.ctx.change({id:"one",enabled:true}),b=h.ctx.change({id:"two",enabled:true});h.write.resolve({devices:[]});await Promise.all([a,b]);assert.equal(calls,1);
});


test("a successful enrollment reply cannot erase a newer form draft",async()=>{
 const h=fixture(),nodes=h.nodes;let submit;
 Object.assign(nodes,{espName:{value:"Accepted"},espAddress:{value:"10.200.0.8"},espPort:{value:"6053"},espKey:{value:"fixture-key"},espSave:{disabled:false},espFormMessage:{textContent:""}});
 Object.assign(h.ctx,{admin:()=>true,form:{reportValidity:()=>true,addEventListener:(_event,handler)=>submit=handler},resetEditor:()=>{nodes.espName.value="";nodes.espAddress.value="";}});
 vm.runInContext(block('form.addEventListener("submit"','$("espCancel").addEventListener('),h.ctx);
 const run=submit({preventDefault(){}});nodes.espName.value="Newer draft";h.write.resolve({devices:[]});await run;assert.equal(nodes.espName.value,"Newer draft");
});
test("an accepted management reply cannot restore inventory after read access is removed",async()=>{
 const h=fixture();let auth;Object.assign(h.ctx,{window:{addEventListener:(_name,handler)=>auth=handler},userCan:()=>false});
 vm.runInContext(block('window.addEventListener("roomgoblin:authchange"','new MutationObserver('),h.ctx);
 const run=h.ctx.change({id:"node",enabled:true});h.ctx.active=()=>false;auth();assert.equal(h.ctx.devices.length,0);
 h.write.resolve({devices:[{id:"node",enabled:false}]});await run;assert.equal(h.ctx.devices.length,0);
});

const plain=value=>JSON.parse(JSON.stringify(value));
function form(h){let submit;const nodes=h.nodes;Object.assign(nodes,{espName:{value:"Accepted"},espAddress:{value:"10.200.0.8"},espPort:{value:"6053"},espKey:{value:"fixture-key"},espSave:{disabled:false},espFormMessage:{textContent:""}});
 Object.assign(h.ctx,{form:{reportValidity:()=>true,addEventListener:(_event,handler)=>submit=handler},resetEditor:()=>{h.resets=(h.resets||0)+1;h.ctx.editing=null;nodes.espName.value="";nodes.espAddress.value="";}});
 vm.runInContext(block('form.addEventListener("submit"','$("espCancel").addEventListener('),h.ctx);return()=>submit({preventDefault(){}});
}
test("management failure preserves inventory, releases admission and allows an explicit retry",async()=>{
 const h=fixture();h.ctx.active=()=>false;const before=plain(h.ctx.devices),run=h.ctx.change({id:"node",enabled:true});h.write.reject(Error("save failed"));await run;
 assert.deepEqual(plain(h.ctx.devices),before);assert.equal(h.ctx.managementBusy,false);assert.equal(h.ctx.busy.size,0);assert.equal(h.ctx.managementMessage,"save failed");
 h.ctx.write=async()=>({devices:[]});await h.ctx.change({id:"node",enabled:true});assert.equal(h.ctx.devices.length,0);assert.equal(h.ctx.managementMessage,"Device disabled.");
});
test("current read failures retain inventory and pause controls until a successful read",async()=>{
 const h=fixture(),before=plain(h.ctx.devices),read=h.ctx.refresh();h.gate.reject(Error("read failed"));await read;
 assert.deepEqual(plain(h.ctx.devices),before);assert.equal(h.ctx.stale,true);assert.match(h.ctx.inventoryMessage,/controls are paused/);
 h.ctx.api=async()=>({devices:before});await h.ctx.refresh();assert.equal(h.ctx.stale,false);assert.equal(h.ctx.inventoryMessage,"");
});
test("poll success does not erase a newer management failure",async()=>{
 const h=fixture();h.ctx.managementMessage="Management failure";h.gate.resolve({devices:[]});await h.ctx.refresh();assert.equal(h.ctx.managementMessage,"Management failure");
});
test("inventory refreshes remain single-flight and pause during management or enrollment",async()=>{
 const h=fixture();let calls=0;h.ctx.api=()=>{calls++;return h.gate.promise};h.ctx.managementBusy=true;await h.ctx.refresh();h.ctx.managementBusy=false;h.ctx.saving=true;await h.ctx.refresh();h.ctx.saving=false;
 const one=h.ctx.refresh();await h.ctx.refresh();assert.equal(calls,1);h.gate.resolve({devices:[]});await one;
});
test("changing permissions prevents an old failed inventory read from changing state",async()=>{
 const h=fixture(),read=h.ctx.refresh();h.ctx.authRevision++;h.ctx.inventoryRevision++;h.ctx.active=()=>false;h.ctx.stale=false;h.gate.reject(Error("obsolete"));await read;
 assert.equal(h.ctx.stale,false);assert.equal(h.ctx.inventoryMessage,"");assert.equal(h.ctx.loading,false);
});
test("an explicit cancelled removal leaves inventory and admission untouched",async()=>{
 const h=fixture();h.ctx.confirm=()=>false;let calls=0;h.ctx.api=async()=>{calls++};await h.ctx.change({id:"node"},true);assert.equal(calls,0);assert.equal(h.ctx.inventoryRevision,0);assert.equal(h.ctx.managementBusy,false);
});
test("non-administrators cannot issue management or enrollment requests",async()=>{
 const h=fixture(),submit=form(h);h.ctx.admin=()=>false;let calls=0;h.ctx.write=async()=>{calls++};await h.ctx.change({id:"node"});await submit();assert.equal(calls,0);
});
test("enrollment and device changes share one admission boundary",async()=>{
 const h=fixture(),submit=form(h);h.ctx.active=()=>false;let calls=0;h.ctx.write=()=>{calls++;return h.write.promise};
 const change=h.ctx.change({id:"node",enabled:true});await submit();assert.equal(calls,1);h.write.resolve({devices:[]});await change;
});
test("an enrollment blocks device changes while retaining the accepted target and secret lifetime",async()=>{
 const h=fixture(),submit=form(h);h.ctx.active=()=>false;h.ctx.editing="accepted-node";let args;h.ctx.write=(...values)=>{args=values;return h.write.promise};
 const run=submit();assert.equal(h.nodes.espKey.value,"");await h.ctx.change({id:"other",enabled:true});assert.equal(args[0],"/fixture/accepted-node");assert.equal(args[2],"PUT");assert.equal(args[1].key,"fixture-key");
 h.write.resolve({devices:[]});await run;assert.equal(args[1].key,"");assert.equal(h.ctx.saving,false);assert.equal(h.resets,1);
});
test("newer enrollment drafts keep the newly saved identity for the next edit",async()=>{
 const h=fixture(),submit=form(h);h.ctx.active=()=>false;const run=submit();h.nodes.espName.value="Newer name";h.nodes.espKey.value="next-fixture-key";
 h.write.resolve({devices:[{id:"created-node",address:"10.200.0.8",port:6053}]});await run;
 assert.equal(h.ctx.editing,"created-node");assert.equal(h.nodes.espName.value,"Newer name");assert.equal(h.nodes.espKey.value,"next-fixture-key");assert.equal(h.nodes.espSave.textContent,"Verify & save changes");assert.match(h.nodes.espFormMessage.textContent,/newer edits remain/);
});
test("an old enrollment reply cannot repopulate inventory or replace another permission context's editor",async()=>{
 const h=fixture(),submit=form(h);h.ctx.active=()=>false;const run=submit();h.ctx.authRevision++;h.ctx.inventoryRevision++;h.ctx.devices=[];h.nodes.espName.value="Different user draft";
 h.write.resolve({devices:[{id:"obsolete"}]});await run;assert.equal(h.ctx.devices.length,0);assert.equal(h.nodes.espName.value,"Different user draft");assert.equal(h.ctx.saving,false);
});
test("enrollment rejection preserves form fields and clears its submitted key",async()=>{
 const h=fixture(),submit=form(h);h.ctx.active=()=>false;let payload;h.ctx.write=(_url,body)=>{payload=body;return h.write.promise};const run=submit();h.write.reject(Error("encryption-failed"));await run;
 assert.equal(payload.key,"");assert.equal(h.nodes.espKey.value,"");assert.equal(h.nodes.espName.value,"Accepted");assert.match(h.nodes.espFormMessage.textContent,/existing api.encryption.key/);assert.equal(h.ctx.saving,false);
});
function discovery(h){Object.assign(h.ctx,{discovering:false,discovered:[],lastDiscovery:0,renderDiscovery(){},discoveryStatus:{textContent:""}});vm.runInContext(block("async function scanDiscovery(","async function change("),h.ctx)}
test("discovery responses predating management cannot restore old adoption status",async()=>{
 const h=fixture();discovery(h);const scan=h.ctx.scanDiscovery(true);h.ctx.inventoryRevision++;h.gate.resolve({devices:[{name:"Obsolete"}]});await scan;
 assert.equal(h.ctx.discovered.length,0);assert.equal(h.ctx.lastDiscovery,0);assert.equal(h.ctx.discovering,false);
});
test("discovery ignores replies and errors after administrator access is removed",async()=>{
 for(const fail of [false,true]){const h=fixture();discovery(h);const scan=h.ctx.scanDiscovery(true);h.ctx.admin=()=>false;h.ctx.authRevision++;fail?h.gate.reject(Error("obsolete")):h.gate.resolve({devices:[{name:"Obsolete"}]});await scan;
 assert.equal(h.ctx.discovered.length,0);assert.equal(h.ctx.discoveryStatus.textContent,"");assert.equal(h.ctx.discovering,false);}
});
test("discovery stays read-only, single-flight and cached while management is idle",async()=>{
 const h=fixture();discovery(h);let calls=0;h.ctx.api=()=>{calls++;return h.gate.promise};const one=h.ctx.scanDiscovery(true);await h.ctx.scanDiscovery(true);h.gate.resolve({devices:[{name:"Fixture"}]});await one;await h.ctx.scanDiscovery();
 assert.equal(calls,1);assert.equal(h.ctx.discovered.length,1);assert.match(h.ctx.discoveryStatus.textContent,/1 ESPHome/);
});
test("management replies preserve an unsaved editor when only enabling or disabling",async()=>{
 const h=fixture();h.ctx.active=()=>false;h.ctx.editing="node";let resets=0;h.ctx.resetEditor=()=>resets++;const run=h.ctx.change({id:"node",enabled:true});h.write.resolve({devices:[]});await run;assert.equal(resets,0);
});
