"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/controller/app.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function fixture(){
 const h={requests:[],commands:[],timers:[],renders:[],nodes:{goveeMessage:{textContent:""},edit_lamp_name:{value:"Lamp",dataset:{dirty:"true"}},edit_lamp_groups:{value:"front",dataset:{dirty:"true"}}}};
 const ctx=vm.createContext({S:{govee:{revision:0}},api:(url,options)=>{const g=gate();h.requests.push({url,options,...g});return g.promise},jpost:(url,body)=>{const g=gate();h.commands.push({url,body,...g});return g.promise},setTimeout:fn=>h.timers.push(fn),document:{getElementById:id=>h.nodes[id],querySelectorAll:()=>[]},renderGovee:()=>h.renders.push(ctx.S.govee),fetchMediaLibrary:async()=>[],populateAutomationClassSelect:()=>{},selectedAutomationClassIds:()=>[],renderSchedulerClock:()=>{},renderSchedulerCalendar:()=>{},renderAutomationList:()=>{},loadMorningWatch:()=>{},autoId:{value:"existing"},automationList:{},esc:String,alert:e=>assert.fail(e)});
 vm.runInContext(block("let goveeInventoryRequest=","\nfunction colorToHex(")+block("async function loadSchedules(){","\nfunction diagBadge("),ctx);h.ctx=ctx;h.message=()=>h.nodes.goveeMessage.textContent;return h;
}
test("older lighting reads cannot replace the latest inventory or render",async()=>{
 const h=fixture(),a=h.ctx.loadGovee(),b=h.ctx.loadGovee();h.requests[1].resolve({revision:2});await b;h.requests[0].resolve({revision:1});await a;assert.equal(h.ctx.S.govee.revision,2);assert.deepEqual(h.renders.map(r=>r.revision),[2]);
});
test("an obsolete lighting error follows newer success",async()=>{
 const h=fixture(),a=h.ctx.loadGovee(),b=h.ctx.loadGovee();h.requests[1].resolve({revision:2});await b;h.requests[0].reject(Error("old failure"));await a;assert.equal(h.message(),"");assert.equal(h.ctx.S.govee.revision,2);
});
test("the latest lighting error remains visible instead of reviving older success",async()=>{
 const h=fixture(),a=h.ctx.loadGovee(),b=h.ctx.loadGovee();h.requests[1].reject(Error("current failure"));await b;h.requests[0].resolve({revision:1});await a;assert.match(h.message(),/current failure/);assert.equal(h.ctx.S.govee.revision,0);assert.equal(h.renders.length,0);
});
test("lighting view follows a newer pending shared inventory read",async()=>{
 const h=fixture(),a=h.ctx.loadGovee(),b=h.ctx.fetchGoveeInventory();h.requests[0].resolve({revision:1});await Promise.resolve();assert.equal(h.renders.length,0);h.requests[1].resolve({revision:2});await Promise.all([a,b]);assert.equal(h.ctx.S.govee.revision,2);assert.deepEqual(h.renders.map(r=>r.revision),[2]);
});
test("slow schedule dependencies cannot overwrite newer lighting inventory",async()=>{
 const h=fixture(),schedules=h.ctx.loadSchedules(),old=h.requests.find(r=>r.url==="/api/v1/govee");old.resolve({revision:1});await Promise.resolve();const fresh=h.ctx.loadGovee();h.requests.at(-1).resolve({revision:2});await fresh;for(const r of h.requests.slice(0,4))if(r!==old)r.resolve({});await schedules;assert.equal(h.ctx.S.govee.revision,2);
});
test("an older lighting refresh cannot erase a newer command failure",async()=>{
 const h=fixture(),read=h.ctx.loadGovee(),command=h.ctx.goveeCmd("lamp","on");h.commands[0].reject(Error("command failed"));await command;h.requests[0].resolve({revision:1});await read;assert.match(h.message(),/command failed/);assert.equal(h.ctx.S.govee.revision,1);
});
test("an older lighting refresh error cannot replace a newer command success",async()=>{
 const h=fixture(),read=h.ctx.loadGovee(),command=h.ctx.goveeCmd("lamp","on");h.commands[0].resolve({ok:true});await command;h.requests[0].reject(Error("old refresh failed"));await read;assert.equal(h.message(),"lamp: on command sent.");
});
for(const failed of [false,true])test(`an older command ${failed?"failure":"success"} cannot replace the latest action result`,async()=>{
 const h=fixture(),a=h.ctx.goveeCmd("lamp","on"),b=h.ctx.goveeCmd("other","off");h.commands[1].resolve({ok:true});await b;if(failed)h.commands[0].reject(Error("old failure"));else h.commands[0].resolve({ok:true});await a;assert.equal(h.message(),"other: off command sent.");
});
test("an older delayed refresh cannot erase a newer command failure",async()=>{
 const h=fixture(),a=h.ctx.goveeCmd("lamp","on");h.commands[0].resolve({ok:true});await a;const b=h.ctx.goveeCmd("lamp","off");h.commands[1].reject(Error("latest failure"));await b;for(const timer of h.timers)timer();assert.equal(h.requests.length,0);assert.match(h.message(),/latest failure/);
});
test("an admitted delayed refresh retains its command's message identity",async()=>{
 const h=fixture(),a=h.ctx.goveeCmd("lamp","on");h.commands[0].resolve({ok:true});await a;h.timers[0]();const b=h.ctx.goveeCmd("lamp","off");h.commands[1].reject(Error("latest failure"));await b;h.requests[0].resolve({revision:2});await new Promise(r=>setImmediate(r));assert.match(h.message(),/latest failure/);assert.equal(h.ctx.S.govee.revision,2);
});
test("a successful device save reports failed refresh without claiming the save failed",async()=>{
 const h=fixture(),save=h.ctx.saveGoveeDevice("lamp");h.requests[0].resolve({ok:true});await new Promise(r=>setImmediate(r));h.requests[1].reject(Error("inventory unavailable"));await save;assert.match(h.message(),/^Device saved\. Lighting refresh failed: inventory unavailable/);assert.equal(h.ctx.S.govee.revision,0);
});
test("late device save and refresh cannot erase a newer command failure",async()=>{
 const h=fixture(),save=h.ctx.saveGoveeDevice("lamp"),command=h.ctx.goveeCmd("other","on");h.commands[0].reject(Error("latest command failed"));await command;h.requests[0].resolve({ok:true});await new Promise(r=>setImmediate(r));h.requests[1].resolve({revision:2});await save;assert.match(h.message(),/latest command failed/);assert.equal(h.ctx.S.govee.revision,2);
});
test("a failed device save remains visible after an earlier read completes",async()=>{
 const h=fixture(),read=h.ctx.loadGovee(),save=h.ctx.saveGoveeDevice("lamp");h.requests[1].reject(Error("save unavailable"));await save;h.requests[0].resolve({revision:1});await read;assert.match(h.message(),/^Device save failed: save unavailable/);assert.equal(h.nodes.edit_lamp_name.dataset.dirty,"true");
});
test("successful save acknowledgments preserve newer device drafts",async()=>{
 const h=fixture(),save=h.ctx.saveGoveeDevice("lamp");h.nodes.edit_lamp_name.value="New draft";h.requests[0].resolve({ok:true});await new Promise(r=>setImmediate(r));h.requests[1].resolve({revision:2});await save;assert.equal(h.nodes.edit_lamp_name.dataset.dirty,"true");assert.equal(h.nodes.edit_lamp_groups.dataset.dirty,undefined);assert.equal(h.message(),"Device saved.");
});
