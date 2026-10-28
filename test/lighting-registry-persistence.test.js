"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture({missing=false,legacyKey="lamp"}={}){
 let handler;const writes=[],h={fail:false,beforeWrite:null};
 const device={id:"0011223344556677",name:"Original",sku:"Fixture",ip:"127.0.0.1"};
 const entry={...device,alias:"lamp",groups:["front"],discovered:false,firstSeen:"2026-01-01T00:00:00Z",lastSeen:null,source:"configured"};
 const ctx=vm.createContext({goveeDevices:{lamp:device,other:{id:"1122334455667788",name:"Other"}},goveeGroups:{all:["lamp","other"],front:["lamp","other"],unassigned:["lamp"]},
  goveeDiscovery:{version:1,autoAdd:true,devices:missing?{}:{[legacyKey]:entry},lastDiscoveryAt:null},GOVEE_DISCOVERY_FILE:"fixture-discovery",
  persistJson:(file,value)=>{h.beforeWrite?.(value);if(h.fail)throw Error("controlled persistence failure");writes.push({file,value:plain(value)})},requireControl:()=>{},app:{put:(_url,...handlers)=>handler=handlers.at(-1)},goveeInventory:()=>({discovery:{autoAdd:ctx.goveeDiscovery.autoAdd}})});
 vm.runInContext(block("function cleanId(","function cookieValue(")+block("function persistGoveeDiscovery(","function goveeAliasForId(")+block("function applyGoveeRegistryEntry(","function bootstrapGoveeDiscovery(")+block("function updateGoveeDevice(","function makeDefaultPlutoSchedules(")+block('app.put("/api/v1/govee/discovery"','app.post("/api/v1/govee/discovery/reconcile"'),ctx);
 h.ctx=ctx;h.writes=writes;h.snapshot=()=>plain({devices:ctx.goveeDevices,groups:ctx.goveeGroups,discovery:ctx.goveeDiscovery});
 h.setting=body=>{let response;handler({body},{json:value=>response=value});return response};return h;
}
test("metadata persistence failure preserves live data and object identities",()=>{
 const h=fixture(),before=h.snapshot(),device=h.ctx.goveeDevices.lamp,groups=h.ctx.goveeGroups.front,registry=h.ctx.goveeDiscovery;
 h.fail=true;assert.throws(()=>h.ctx.updateGoveeDevice("lamp",{name:"Changed",groups:["rear"]}),/persistence failure/);
 assert.deepEqual(h.snapshot(),before);assert.equal(h.ctx.goveeDevices.lamp,device);assert.equal(h.ctx.goveeGroups.front,groups);assert.equal(h.ctx.goveeDiscovery,registry);assert.equal(h.writes.length,0);
});
test("a failed first metadata save does not register an overlay",()=>{
 const h=fixture({missing:true}),before=h.snapshot();h.fail=true;
 assert.throws(()=>h.ctx.updateGoveeDevice("lamp",{name:"Changed",groups:["rear"]}),/persistence failure/);assert.deepEqual(h.snapshot(),before);
});
for(const missing of [false,true])test(`invalid name leaves the ${missing?"new":"existing"} registry untouched`,()=>{
 const h=fixture({missing}),before=h.snapshot();assert.throws(()=>h.ctx.updateGoveeDevice("lamp",{name:"  ",groups:["rear"]}),/Name cannot be blank/);
 assert.deepEqual(h.snapshot(),before);assert.equal(h.writes.length,0);
});
for(const alias of ["unknown","__proto__","constructor"])test(`unknown device ${alias} cannot create a registry overlay`,()=>{
 const h=fixture(),before=h.snapshot();assert.throws(()=>h.ctx.updateGoveeDevice(alias,{name:"Changed"}),/Unknown Govee device/);
 assert.deepEqual(h.snapshot(),before);assert.equal(h.writes.length,0);
});
test("metadata is persisted before any live projection changes",()=>{
 const h=fixture(),before=h.snapshot();h.beforeWrite=candidate=>{assert.deepEqual(h.snapshot(),before);assert.equal(candidate.devices.lamp.name,"Changed");assert.deepEqual(plain(candidate.devices.lamp.groups),["rear"])};
 const result=h.ctx.updateGoveeDevice(" LAMP ",{name:" Changed ",groups:["Rear","rear","all",""]});
 assert.equal(h.writes.length,1);assert.equal(h.writes[0].file,"fixture-discovery");assert.equal(h.ctx.goveeDevices.lamp.name,"Changed");assert.equal(result.alias,"lamp");
 assert.deepEqual(plain(result.groups),["rear"]);assert.deepEqual(plain(h.ctx.goveeGroups.all),["lamp","other"]);assert.deepEqual(plain(h.ctx.goveeGroups.front),["other"]);assert.deepEqual(plain(h.ctx.goveeGroups.rear),["lamp"]);
 assert.equal(h.ctx.goveeGroups.unassigned,undefined);
});
test("legacy registry keys and physical identity survive a successful metadata save",()=>{
 const h=fixture({legacyKey:"historical-record"}),before=plain(h.ctx.goveeDiscovery.devices["historical-record"]);
 const result=h.ctx.updateGoveeDevice("lamp",{name:"Renamed"});assert.deepEqual(Object.keys(h.ctx.goveeDiscovery.devices),["historical-record"]);
 for(const key of ["id","alias","sku","ip","discovered","firstSeen","lastSeen","source"])assert.equal(h.ctx.goveeDiscovery.devices["historical-record"][key],before[key]);
 assert.deepEqual(plain(result.groups),["front"]);assert.deepEqual(plain(h.ctx.goveeGroups.front),["lamp","other"]);assert.equal(result.device.id,before.id);
});
test("a successful first overlay save preserves configured device identity",()=>{
 const h=fixture({missing:true}),result=h.ctx.updateGoveeDevice("lamp",{name:"New label"});
 assert.equal(h.writes.length,1);assert.equal(result.device.id,"0011223344556677");assert.equal(result.device.ip,"127.0.0.1");assert.equal(result.device.sku,"Fixture");assert.equal(h.ctx.goveeDiscovery.devices.lamp.discovered,false);
});
test("name normalization retains the existing trim and length policy",()=>{
 const h=fixture(),name="x".repeat(120);h.ctx.updateGoveeDevice("lamp",{name:" "+name+" "});assert.equal(h.ctx.goveeDevices.lamp.name,"x".repeat(100));assert.equal(h.writes[0].value.devices.lamp.name,"x".repeat(100));
});
test("group-only saves preserve names and historical group keys",()=>{
 const h=fixture(),group="display-long-historical-lighting-group-"+"a".repeat(30);h.ctx.updateGoveeDevice("lamp",{groups:[group]});
 assert.equal(h.ctx.goveeDevices.lamp.name,"Original");assert.deepEqual(plain(h.ctx.goveeGroups[group]),["lamp"]);assert.equal(h.writes[0].value.devices.lamp.groups[0],group);
});
test("prototype-shaped group names remain data without changing map prototypes",()=>{
 const h=fixture(),prototype=Object.getPrototypeOf(h.ctx.goveeGroups);h.ctx.updateGoveeDevice("lamp",{groups:["__proto__","constructor"]});
 assert.equal(Object.getPrototypeOf(h.ctx.goveeGroups),prototype);assert.ok(Object.hasOwn(h.ctx.goveeGroups,"__proto__"));assert.deepEqual(plain(h.ctx.goveeGroups.__proto__),["lamp"]);assert.deepEqual(plain(h.ctx.goveeGroups.constructor),["lamp"]);
});
test("persisted prototype-shaped groups rebuild as own data after restart",()=>{
 const h=fixture();h.ctx.updateGoveeDevice("lamp",{groups:["__proto__","constructor"]});
 h.ctx.goveeGroups={all:[]};const prototype=Object.getPrototypeOf(h.ctx.goveeGroups);
 h.ctx.applyGoveeRegistryEntry(h.writes[0].value.devices.lamp);
 assert.equal(Object.getPrototypeOf(h.ctx.goveeGroups),prototype);assert.ok(Object.hasOwn(h.ctx.goveeGroups,"__proto__"));assert.deepEqual(plain(h.ctx.goveeGroups.__proto__),["lamp"]);
});
test("discovery preference persistence failure preserves live policy and registry identity",()=>{
 const h=fixture(),before=h.snapshot(),registry=h.ctx.goveeDiscovery;h.fail=true;
 assert.throws(()=>h.setting({autoAdd:false}),/persistence failure/);assert.deepEqual(h.snapshot(),before);assert.equal(h.ctx.goveeDiscovery,registry);assert.equal(h.writes.length,0);
});
test("discovery preference persistence precedes publication and its response",()=>{
 const h=fixture();h.beforeWrite=candidate=>{assert.equal(h.ctx.goveeDiscovery.autoAdd,true);assert.equal(candidate.autoAdd,false)};
 const response=h.setting({autoAdd:false});assert.equal(h.writes.length,1);assert.equal(h.writes[0].value.autoAdd,false);assert.equal(h.ctx.goveeDiscovery.autoAdd,false);assert.equal(response.discovery.autoAdd,false);
});
test("omitted discovery policy retains the current setting and registry",()=>{
 const h=fixture(),before=h.snapshot();const response=h.setting({});assert.deepEqual(h.snapshot(),before);assert.equal(response.discovery.autoAdd,true);assert.equal(h.writes.length,1);
});
test("a persistence failure does not prevent a later explicit metadata retry",()=>{
 const h=fixture();h.fail=true;assert.throws(()=>h.ctx.updateGoveeDevice("lamp",{name:"Changed"}),/persistence failure/);h.fail=false;
 assert.equal(h.ctx.updateGoveeDevice("lamp",{name:"Changed"}).device.name,"Changed");assert.equal(h.writes.length,1);
});
