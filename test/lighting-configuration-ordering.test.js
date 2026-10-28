"use strict";
const nodeTest=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const test=(name,run)=>nodeTest(name,{timeout:3000},run);
const source=fs.readFileSync(path.join(__dirname,"../public/controller/app.js"),"utf8");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const inventory={devices:{lamp:{name:"Initial"},old:{name:"Old"}},discovery:{autoAdd:true},revision:0};
 const h={inventory,requests:[],reads:0,writeHook:null,readHook:null,commandHook:null,nodes:{goveeMessage:{textContent:""},edit_lamp_name:{value:"First",dataset:{dirty:"true"}},edit_lamp_groups:{value:"front",dataset:{dirty:"true"}}}};
 const ctx=vm.createContext({S:{govee:structuredClone(inventory)},goveeAutoAdd:{checked:true},document:{getElementById:id=>h.nodes[id],querySelectorAll:()=>[]},setTimeout:()=>{},alert:()=>assert.fail("settings feedback must remain inline"),
  api:async(url,options)=>{
   const call={url,method:options?.method||"GET",body:options?.body?JSON.parse(options.body):null};h.requests.push(call);
   if(!options){const snapshot=structuredClone(inventory),index=++h.reads;return h.readHook?h.readHook(snapshot,index):snapshot}
   await h.writeHook?.(call);
   if(url.endsWith("/reconcile")){delete inventory.devices.old;inventory.revision++;return{inventory:structuredClone(inventory),removed:1}}
   if(url.endsWith("/discovery")){inventory.discovery.autoAdd=call.body.autoAdd;inventory.revision++;return{discovery:structuredClone(inventory.discovery)}}
   inventory.devices.lamp.name=call.body.name;inventory.revision++;return{ok:true};
  },jpost:async()=>{if(h.commandHook)return h.commandHook();return{ok:true}},renderGovee:()=>ctx.renderGoveeDiscovery()});
 vm.runInContext(block("let goveeInventoryRequest=","function colorToHex(")+block("function renderGoveeDiscovery(","function updateGoveeCard("),ctx);
 h.ctx=ctx;h.message=()=>h.nodes.goveeMessage.textContent;h.writes=()=>h.requests.filter(r=>r.method!=="GET");return h;
}
test("overlapping auto-enrollment changes persist the last accepted selection",async()=>{
 const h=fixture(),first=gate();h.writeHook=call=>call.body.autoAdd===false?first.promise:undefined;
 const a=h.ctx.setGoveeAutoAdd(false),b=h.ctx.setGoveeAutoAdd(true);await flush();assert.equal(h.writes().length,1);
 first.resolve();await Promise.all([a,b]);assert.equal(h.inventory.discovery.autoAdd,true);assert.equal(h.ctx.goveeAutoAdd.checked,true);assert.equal(h.message(),"Discovery setting saved.");
});
test("queued device saves capture click-time values and preserve later unsaved drafts",async()=>{
 const h=fixture(),first=gate();h.writeHook=call=>call.body.name==="First"?first.promise:undefined;
 const a=h.ctx.saveGoveeDevice("lamp");h.nodes.edit_lamp_name.value="Second";const b=h.ctx.saveGoveeDevice("lamp");h.nodes.edit_lamp_name.value="Third draft";
 await flush();assert.equal(h.writes().length,1);first.resolve();await Promise.all([a,b]);
 assert.deepEqual(h.writes().map(r=>r.body.name),["First","Second"]);assert.equal(h.inventory.devices.lamp.name,"Second");assert.equal(h.nodes.edit_lamp_name.value,"Third draft");assert.equal(h.nodes.edit_lamp_name.dataset.dirty,"true");
});
test("a failed configuration write releases the next accepted save",async()=>{
 const h=fixture(),first=gate();h.writeHook=call=>call.body.name==="First"?first.promise:undefined;
 const a=h.ctx.saveGoveeDevice("lamp");h.nodes.edit_lamp_name.value="Second";const b=h.ctx.saveGoveeDevice("lamp");first.reject(Error("first failed"));await Promise.all([a,b]);
 assert.equal(h.inventory.devices.lamp.name,"Second");assert.equal(h.writes().length,2);assert.equal(h.message(),"Device saved.");
});
test("metadata, discovery settings and cleanup share configuration write order",async()=>{
 const h=fixture(),first=gate();let writes=0;h.writeHook=()=>++writes===1?first.promise:undefined;
 const a=h.ctx.saveGoveeDevice("lamp"),b=h.ctx.setGoveeAutoAdd(false),c=h.ctx.reconcileGoveeNow();await flush();assert.equal(h.writes().length,1);
 first.resolve();await Promise.all([a,b,c]);assert.deepEqual(h.writes().map(r=>r.url),["/api/v1/govee/device/lamp","/api/v1/govee/discovery","/api/v1/govee/discovery/reconcile"]);
 assert.equal(h.inventory.discovery.autoAdd,false);assert.equal(h.inventory.devices.old,undefined);assert.match(h.message(),/cleanup complete/);
});
test("an inventory read admitted during a save waits for that write",async()=>{
 const h=fixture(),write=gate();h.writeHook=()=>write.promise;const save=h.ctx.saveGoveeDevice("lamp"),read=h.ctx.loadGovee();await flush();assert.equal(h.reads,0);
 write.resolve();await Promise.all([save,read]);assert.equal(h.ctx.S.govee.devices.lamp.name,"First");
});
test("a response predating an admitted save cannot publish while it is pending",async()=>{
 const h=fixture(),old=gate(),write=gate();h.readHook=(snapshot,index)=>index===1?old.promise:snapshot;h.writeHook=()=>write.promise;
 const read=h.ctx.loadGovee(),save=h.ctx.saveGoveeDevice("lamp");old.resolve({devices:{lamp:{name:"Stale"}},discovery:{autoAdd:true}});await flush();
 assert.equal(h.ctx.S.govee.devices.lamp.name,"Initial");assert.equal(h.reads,1);write.resolve();await Promise.all([read,save]);assert.equal(h.ctx.S.govee.devices.lamp.name,"First");
});
test("a pre-cleanup inventory response cannot restore a removed device",async()=>{
 const h=fixture(),old=gate();h.readHook=(snapshot,index)=>index===1?old.promise:snapshot;
 const read=h.ctx.loadGovee();await h.ctx.reconcileGoveeNow();old.resolve({devices:{old:{name:"Stale"}},discovery:{autoAdd:true}});await read;
 assert.equal(h.ctx.S.govee.devices.old,undefined);assert.match(h.message(),/cleanup complete/);
});
test("a pre-save read failure follows fresh post-save inventory without replacing feedback",async()=>{
 const h=fixture(),old=gate();h.readHook=(snapshot,index)=>index===1?old.promise:snapshot;
 const read=h.ctx.loadGovee();await h.ctx.saveGoveeDevice("lamp");old.reject(Error("obsolete read failure"));await read;
 assert.equal(h.ctx.S.govee.devices.lamp.name,"First");assert.equal(h.message(),"Device saved.");
});
test("queued auto-enrollment draft survives intermediate acknowledgment and rendering",async()=>{
 const h=fixture(),first=gate(),second=gate();h.writeHook=call=>call.body.autoAdd===false?first.promise:second.promise;
 const a=h.ctx.setGoveeAutoAdd(false),b=h.ctx.setGoveeAutoAdd(true);assert.equal(h.ctx.goveeAutoAdd.checked,true);
 first.resolve();await flush();h.ctx.renderGoveeDiscovery();assert.equal(h.ctx.goveeAutoAdd.checked,true);assert.equal(h.inventory.discovery.autoAdd,false);
 second.resolve();await Promise.all([a,b]);assert.equal(h.ctx.goveeAutoAdd.checked,true);
});
test("saved discovery setting remains acknowledged when its refresh fails",async()=>{
 const h=fixture();h.readHook=()=>{throw Error("read failed")};await h.ctx.setGoveeAutoAdd(false);
 assert.equal(h.inventory.discovery.autoAdd,false);assert.equal(h.ctx.goveeAutoAdd.checked,false);assert.match(h.message(),/^Discovery setting saved\. Lighting refresh failed: read failed/);
});
test("failed discovery save recovers the actual checkbox state and visible failure",async()=>{
 const h=fixture();h.writeHook=()=>{throw Error("save failed")};await h.ctx.setGoveeAutoAdd(false);
 assert.equal(h.ctx.goveeAutoAdd.checked,true);assert.equal(h.inventory.discovery.autoAdd,true);assert.match(h.message(),/^Discovery save failed: save failed/);assert.equal(h.writes().length,1);
});
test("discovery failure plus failed refresh retains both the failure and stale warning",async()=>{
 const h=fixture();h.writeHook=()=>{throw Error("save failed")};h.readHook=()=>{throw Error("read failed")};await h.ctx.setGoveeAutoAdd(false);
 assert.match(h.message(),/Discovery save failed: save failed.*Existing readings may be stale/);assert.equal(h.writes().length,1);
});
test("successful cleanup with failed refresh reports both outcomes without retrying",async()=>{
 const h=fixture();h.readHook=()=>{throw Error("read failed")};await h.ctx.reconcileGoveeNow();
 assert.match(h.message(),/^Govee cleanup complete.*Lighting refresh failed: read failed/);assert.equal(h.writes().length,1);assert.ok(h.ctx.S.govee.devices.old);
});
test("failed cleanup retains cached inventory and visible failure",async()=>{
 const h=fixture();h.writeHook=()=>{throw Error("cleanup failed")};await h.ctx.reconcileGoveeNow();
 assert.match(h.message(),/^Govee cleanup failed: cleanup failed/);assert.ok(h.ctx.S.govee.devices.old);assert.equal(h.writes().length,1);
});
for(const kind of ["discovery","cleanup"])test(`late ${kind} completion cannot replace a newer physical command failure`,async()=>{
 const h=fixture(),write=gate();h.writeHook=()=>write.promise;h.commandHook=()=>{throw Error("new command failed")};
 const pending=kind==="discovery"?h.ctx.setGoveeAutoAdd(false):h.ctx.reconcileGoveeNow();await h.ctx.goveeCmd("lamp","on");write.resolve();await pending;
 assert.match(h.message(),/new command failed/);
});
test("new inventory reads wait for every configuration write accepted before them",async()=>{
 const h=fixture(),first=gate(),second=gate();let writes=0;h.writeHook=()=>++writes===1?first.promise:second.promise;
 const a=h.ctx.setGoveeAutoAdd(false),b=h.ctx.saveGoveeDevice("lamp"),read=h.ctx.loadGovee();first.resolve();await flush();assert.equal(h.reads,0);
 second.resolve();await Promise.all([a,b,read]);assert.equal(h.ctx.S.govee.discovery.autoAdd,false);assert.equal(h.ctx.S.govee.devices.lamp.name,"First");
});
