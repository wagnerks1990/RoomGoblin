"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),{EventEmitter}=require("node:events");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
function fixture({autoAdd=true}={}){
 const h={fail:false,writes:[],audits:[],broadcasts:[],diagnostics:[],beforeWrite:null},ctx=vm.createContext({Date,goveeDevices:{lamp:{id:"0011223344556677",name:"Configured"}},goveeGroups:{all:["lamp"]},
 goveeStates:{},goveePresence:{},goveeLiveConfigs:{},goveeDiscovery:{version:1,autoAdd,devices:{},lastDiscoveryAt:null},GOVEE_DISCOVERY_FILE:"fixture",GOVEE_RECONCILE_GRACE_MS:600000,
 persistJson:(_file,value)=>{h.beforeWrite?.(value);if(h.fail)throw Error("persist failed");h.writes.push(JSON.parse(JSON.stringify(value)))},audit:value=>h.audits.push(value),broadcastControllers:value=>h.broadcasts.push(value),diagnosticError:(error,context)=>h.diagnostics.push({error,context})});
 vm.runInContext(block("function cleanId(","function cookieValue(")+block("function persistGoveeDiscovery(","function makeDefaultPlutoSchedules("),ctx);
 h.ctx=ctx;h.snapshot=()=>JSON.stringify({devices:ctx.goveeDevices,groups:ctx.goveeGroups,registry:ctx.goveeDiscovery,states:ctx.goveeStates,presence:ctx.goveePresence});return h;
}
test("disabled auto-enrollment never registers an unknown physical device",()=>{
 const h=fixture({autoAdd:false}),before=h.snapshot();const result=h.ctx.enrollGoveeDevice("8899AABBCCDDEEFF",{name:"New fixture light"});assert.equal(result,null);assert.equal(h.snapshot(),before);
});
test("saving disabled auto-enrollment cannot make an ignored device appear after restart",()=>{
 const h=fixture({autoAdd:false});h.ctx.enrollGoveeDevice("8899AABBCCDDEEFF",{name:"New fixture light"});h.ctx.persistGoveeDiscovery();h.ctx.bootstrapGoveeDiscovery();assert.deepEqual(Object.keys(h.ctx.goveeDevices),["lamp"]);
});
test("failed enrollment persistence leaves inventory and registry unchanged",()=>{
 const h=fixture(),before=h.snapshot();h.fail=true;assert.throws(()=>h.ctx.enrollGoveeDevice("8899AABBCCDDEEFF",{name:"New fixture light"}),/persist failed/);assert.equal(h.snapshot(),before);
});
test("failed cleanup persistence retains devices, group references and last state",()=>{
 const h=fixture();h.ctx.goveeDiscovery.devices.old={id:"8899AABBCCDDEEFF",alias:"old",name:"Old",discovered:true,lastSeen:"2020-01-01T00:00:00Z",groups:["front"]};h.ctx.applyGoveeRegistryEntry(h.ctx.goveeDiscovery.devices.old);h.ctx.goveeStates["8899AABBCCDDEEFF"]={state:"ON"};h.ctx.goveePresence["8899AABBCCDDEEFF"]={status:"online",lastSeen:"2020-01-01T00:00:00Z"};const before=h.snapshot();h.fail=true;
 assert.throws(()=>h.ctx.reconcileGoveeDiscovery(Date.now(),{force:true}),/persist failed/);assert.equal(h.snapshot(),before);
});
test("failed synthetic-entry migration retains its prior registry and projection",()=>{
 const h=fixture();h.ctx.goveeDiscovery.devices.old={id:"synthetic-1",alias:"old",name:"Old",discovered:true,groups:["front"]};h.ctx.applyGoveeRegistryEntry(h.ctx.goveeDiscovery.devices.old);const before=h.snapshot();h.fail=true;
 assert.throws(()=>h.ctx.migrateGoveeDiscoveryRegistry(),/persist failed/);assert.equal(h.snapshot(),before);
});

const plain=value=>JSON.parse(JSON.stringify(value));
function seed(h,{alias="old",key=alias,id="8899AABBCCDDEEFF",age=700000,discovered=true}={}){
 const entry={id,alias,name:"Saved name",sku:"Fixture",ip:"127.0.0.1",discovered,firstSeen:"2020-01-01T00:00:00Z",lastSeen:new Date(Date.now()-age).toISOString(),groups:["front"]};
 h.ctx.goveeDiscovery.devices[key]=entry;h.ctx.applyGoveeRegistryEntry(entry);
 h.ctx.goveeStates[id]={state:"ON"};h.ctx.goveePresence[id]={status:"online",lastSeen:entry.lastSeen};return entry;
}
test("disabled enrollment retains known hardware and discovered identities without metadata writes",()=>{
 const h=fixture({autoAdd:false}),entry=seed(h),before=h.snapshot();
 assert.equal(h.ctx.enrollGoveeDevice(entry.id,{name:"Unwanted replacement"}),"old");
 assert.equal(h.ctx.enrollGoveeDevice("0011223344556677",{name:"Changed"}),"lamp");
 assert.equal(h.snapshot(),before);assert.equal(h.writes.length,0);assert.equal(h.audits.length,0);
 h.ctx.touchGoveePresence(entry.id,"offline");assert.equal(h.ctx.goveeDeviceOnline(entry.id),false);
});
test("new enrollment persists before inventory publication or notification",()=>{
 const h=fixture(),before=h.snapshot();h.beforeWrite=next=>{assert.equal(h.snapshot(),before);assert.equal(next.devices["govee-ddeeff"].name,"New");assert.equal(h.broadcasts.length,0)};
 assert.equal(h.ctx.enrollGoveeDevice("88:99:aa:bb:cc:dd:ee:ff",{name:"New"}),"govee-ddeeff");
 assert.equal(h.writes.length,1);assert.equal(h.ctx.goveeDevices["govee-ddeeff"].id,"8899AABBCCDDEEFF");assert.equal(h.audits.length,1);assert.equal(h.broadcasts.length,1);
});
test("existing enrollment failure preserves identity, metadata, timestamps and notifications",()=>{
 const h=fixture(),entry=seed(h,{key:"historical-record"}),before=h.snapshot(),registry=h.ctx.goveeDiscovery;h.fail=true;
 assert.throws(()=>h.ctx.enrollGoveeDevice(entry.id,{name:"Replacement"},"new-source"),/persist failed/);
 assert.equal(h.snapshot(),before);assert.equal(h.ctx.goveeDiscovery,registry);assert.equal(h.audits.length,0);assert.equal(h.broadcasts.length,0);
});
test("successful rediscovery preserves friendly name, registry key, groups and physical metadata",()=>{
 const h=fixture(),entry=seed(h,{key:"historical-record"});h.ctx.enrollGoveeDevice(entry.id,{name:"Replacement",sku:"Other",ip:"127.0.0.2"},"attributes");
 assert.deepEqual(Object.keys(h.ctx.goveeDiscovery.devices),["historical-record"]);
 const saved=h.ctx.goveeDiscovery.devices["historical-record"];
 for(const key of ["id","alias","name","sku","ip","firstSeen"])assert.equal(saved[key],entry[key]);
 assert.deepEqual(plain(saved.groups),["front"]);assert.equal(saved.source,"attributes");assert.notEqual(saved.lastSeen,entry.lastSeen);
});
test("discovery fills missing default metadata without replacing operator overrides",()=>{
 const h=fixture(),entry=seed(h);entry.name="Govee ddeeff";entry.sku="";entry.ip="";
 h.ctx.enrollGoveeDevice(entry.id,{name:"Detected",model:"Model",ip:"127.0.0.2"});const saved=h.ctx.goveeDiscovery.devices.old;
 assert.equal(saved.name,"Detected");assert.equal(saved.sku,"Model");assert.equal(saved.ip,"127.0.0.2");
});
for(const id of ["synthetic-1","12345678","8899AABBCCDDEEFF-1"])test(`synthetic discovery ${id} never writes or publishes`,()=>{
 const h=fixture(),before=h.snapshot();assert.equal(h.ctx.enrollGoveeDevice(id,{name:"Segment 1"}),null);assert.equal(h.snapshot(),before);assert.equal(h.writes.length,0);
});
test("cleanup persists its complete removal set before changing live projections",()=>{
 const h=fixture(),a=seed(h,{key:"legacy-key"}),b=seed(h,{alias:"other",id:"1122334455667788"}),before=h.snapshot();
 h.beforeWrite=next=>{assert.equal(h.snapshot(),before);assert.deepEqual(Object.keys(next.devices),[])};
 const result=h.ctx.reconcileGoveeDiscovery(Date.now(),{force:true});assert.equal(result.removed,2);assert.equal(h.writes.length,1);
 assert.deepEqual(Object.keys(h.ctx.goveeDevices),["lamp"]);assert.deepEqual(plain(h.ctx.goveeGroups.all),["lamp"]);assert.equal(h.ctx.goveeGroups.front,undefined);
 for(const id of [a.id,b.id]){assert.equal(h.ctx.goveeStates[id],undefined);assert.equal(h.ctx.goveePresence[id],undefined)}
 assert.equal(h.broadcasts.length,1);assert.equal(h.audits.length,1);
});
test("a failed cleanup also preserves unrelated pending offline transitions",()=>{
 const h=fixture();seed(h);seed(h,{alias:"recent",id:"1122334455667788",age:90000});const before=h.snapshot();h.fail=true;
 assert.throws(()=>h.ctx.reconcileGoveeDiscovery(),/persist failed/);assert.equal(h.snapshot(),before);assert.equal(h.broadcasts.length,0);
});
test("periodic cleanup retains grace, configured entries and unknown timestamps",()=>{
 const h=fixture(),recent=seed(h,{age:90000}),configured=seed(h,{alias:"configured",id:"1122334455667788",discovered:false});
 const unknown=seed(h,{alias:"unknown",id:"AABBCCDDEEFF0011"});unknown.lastSeen="invalid";delete h.ctx.goveePresence[unknown.id];
 const result=h.ctx.reconcileGoveeDiscovery();assert.equal(result.removed,0);assert.equal(result.offline,1);assert.equal(h.writes.length,0);
 assert.equal(h.ctx.goveePresence[recent.id].status,"offline");assert.ok(h.ctx.goveeDevices.configured);assert.ok(h.ctx.goveeDevices.unknown);assert.equal(h.ctx.goveePresence[configured.id].status,"online");
});
test("manual cleanup combines synthetic migration and stale removal in one write",()=>{
 const h=fixture();seed(h);seed(h,{alias:"synthetic",id:"synthetic-1"});let route,response;
 Object.assign(h.ctx,{app:{post:(_path,...handlers)=>route=handlers.at(-1)},requireControl:()=>{},goveeInventory:()=>({devices:plain(h.ctx.goveeDevices)})});
 vm.runInContext(block('app.post("/api/v1/govee/discovery/reconcile"','app.put("/api/v1/govee/device/:target"'),h.ctx);
 h.fail=true;const before=h.snapshot();assert.throws(()=>route({body:{}},{json:value=>response=value}),/persist failed/);assert.equal(h.snapshot(),before);assert.equal(response,undefined);
 h.fail=false;route({body:{}},{json:value=>response=value});assert.equal(h.writes.length,1);assert.equal(response.migrated,1);assert.equal(response.removed,1);assert.equal(response.ok,true);assert.equal(response.removedSynthetic,undefined);
});
function background(h){
 const client=new EventEmitter();client.connected=true;client.subscribe=()=>{};
 Object.assign(h.ctx,{runtime:{mqtt:{connected:true},displays:{}},devices:{screen:{}},publicDisplayStatus:()=>({online:true}),MQTT_URL:"mqtt://127.0.0.1",MQTT_USERNAME:"",MQTT_PASSWORD:"",crypto:require("node:crypto"),endpointForLog:()=>"fixture",shutdownRequested:false,fullExportFreeze:{requested:false},console:{log(){},error(){}},mqtt:{connect:()=>client},setTimeout,clearTimeout});
 vm.runInContext(block("let mqttClient = null;","// Direct hardware integrations"),h.ctx);h.ctx.connectMqtt();
 return client;
}
for(const topic of ["homeassistant/light/gv2mqtt-8899AABBCCDDEEFF/config","gv2mqtt/light/8899AABBCCDDEEFF/state","gv2mqtt/light/8899AABBCCDDEEFF/availability","gv2mqtt/sensor/sensor-8899AABBCCDDEEFF-gv2mqtt-status/state","gv2mqtt/sensor/sensor-8899AABBCCDDEEFF-gv2mqtt-status/attributes"])test(`MQTT persistence errors stay diagnostic for ${topic}`,()=>{
 const h=fixture(),client=background(h),before=h.snapshot();h.fail=true;
 assert.doesNotThrow(()=>client.emit("message",topic,Buffer.from('{"name":"New"}')));
 assert.equal(h.snapshot(),before);assert.equal(h.diagnostics.length,1);assert.equal(h.diagnostics[0].context.component,"govee");assert.equal(h.ctx.runtime.mqtt.connected,true);
 client.emit("message","classroom/v2/display/screen/presence",Buffer.from('{}'));assert.equal(h.ctx.runtime.displays.screen.source,"mqtt");
 h.fail=false;client.emit("message",topic,Buffer.from('{}'));assert.equal(h.writes.length,1);
});
test("freeze and shutdown still prevent MQTT discovery writes",()=>{
 const h=fixture(),client=background(h);for(const stop of ["freeze","shutdown"]){h.ctx.fullExportFreeze.requested=stop==="freeze";h.ctx.shutdownRequested=stop==="shutdown";client.emit("message","homeassistant/light/gv2mqtt-8899AABBCCDDEEFF/config",Buffer.from('{}'))}
 assert.equal(h.writes.length,0);assert.equal(h.diagnostics.length,0);
});
test("periodic cleanup contains persistence failure and observes freeze/shutdown",()=>{
 const h=fixture();seed(h);let tick;Object.assign(h.ctx,{shutdownRequested:false,fullExportFreeze:{requested:false},setInterval:fn=>{tick=fn}});
 vm.runInContext(block("const goveeReconcileTimer=","function applicationWritersDrained("),h.ctx);
 h.fail=true;assert.doesNotThrow(tick);assert.equal(h.diagnostics.length,1);assert.equal(h.diagnostics[0].context.operation,"periodic-reconcile");
 h.ctx.fullExportFreeze.requested=true;tick();h.ctx.fullExportFreeze.requested=false;h.ctx.shutdownRequested=true;tick();assert.equal(h.diagnostics.length,1);
 h.ctx.shutdownRequested=false;h.fail=false;tick();assert.equal(h.writes.length,1);assert.equal(h.ctx.goveeDevices.old,undefined);
});
test("startup migration runs after audit initialization and contains failed saves",()=>{
 const h=fixture();seed(h,{id:"synthetic-1"});const before=h.snapshot();h.fail=true;
 const startup=block("// Discovery cleanup needs the initialized audit owner",'process.on("unhandledRejection"');
 assert.ok(source.indexOf("const recentEvents = [];")<source.indexOf(startup));
 assert.doesNotThrow(()=>vm.runInContext(startup,h.ctx));assert.equal(h.snapshot(),before);assert.equal(h.diagnostics[0].context.operation,"startup-migration");
 h.fail=false;vm.runInContext(startup,h.ctx);assert.equal(h.writes.length,1);assert.equal(h.ctx.goveeDevices.old,undefined);assert.equal(h.audits[0].kind,"govee.discovery.migrate");
});
