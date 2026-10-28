"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/controller/lab.html"),"utf8"),between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
const snapshot=(name="Before")=>({configured:true,computers:[{id:"a",name,groups:[]}],summary:{total:1,online:1,offline:0}});
async function flush(){for(let n=0;n<12;n++)await Promise.resolve()}
async function fixture({loaded=true}={}){
 const requests=[],alerts=[];let summaries=0;
 const c={inventory:snapshot(),computerGrid:{innerHTML:"Loading…"},labInventoryStatus:{textContent:""},esc:String,JSON,Promise,alert:x=>alerts.push(x),prompt:label=>label.startsWith("Friendly")?"After":"group",refreshAiSummary(){summaries++},render(){c.computerGrid.innerHTML=c.inventory.computers.map(x=>x.name).join(",")||"No agents"},api:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))};
 vm.createContext(c);vm.runInContext(between("let labInventoryRevision=","function visibleComputers(")+between("async function editComputer(","let aiLoadTimer="),c);
 if(loaded){const first=c.loadAll();requests[0].resolve(snapshot());await first;requests.length=0;summaries=0}
 return{c,requests,alerts,summaries:()=>summaries,reads:()=>requests.filter(x=>!x.options?.method),writes:()=>requests.filter(x=>x.options?.method)};
}
test("lab inventory coalesces overlapping polls without parallel reads",async()=>{
 const h=await fixture(),first=h.c.loadAll();await h.c.loadAll();await h.c.loadAll();assert.equal(h.reads().length,1);h.reads()[0].resolve(snapshot());await first;assert.equal(h.reads().length,2);h.reads()[1].resolve(snapshot());await flush();assert.equal(h.reads().length,2);
});
test("a failed read retains visible last known inventory and shows stale feedback",async()=>{
 const h=await fixture(),first=h.c.loadAll();h.reads()[0].reject(Error("Offline"));await first;assert.equal(h.c.computerGrid.innerHTML,"Before");assert.match(h.c.labInventoryStatus.textContent,/Offline.*last available inventory/);assert.equal(h.c.inventory.computers[0].name,"Before");
});
test("pre-edit inventory cannot overwrite the post-save inventory",async()=>{
 const h=await fixture(),read=h.c.loadAll(),save=h.c.editComputer("a");await flush();h.writes()[0].resolve({ok:true});await save;assert.equal(h.reads().length,1);h.reads()[0].resolve(snapshot("Obsolete"));await read;assert.equal(h.c.inventory.computers[0].name,"Before");assert.equal(h.reads().length,2);h.reads()[1].resolve(snapshot("After"));await flush();assert.equal(h.c.computerGrid.innerHTML,"After");
});
test("pre-edit read failure cannot replace current inventory feedback",async()=>{
 const h=await fixture(),read=h.c.loadAll(),save=h.c.editComputer("a");await flush();h.writes()[0].resolve({ok:true});await save;h.reads()[0].reject(Error("old read"));await read;assert.equal(h.c.labInventoryStatus.textContent,"");assert.equal(h.c.computerGrid.innerHTML,"Before");h.reads()[1].resolve(snapshot("After"));await flush();assert.equal(h.c.computerGrid.innerHTML,"After");
});
test("an initial read failure replaces loading with explicit unavailable state",async()=>{
 const h=await fixture({loaded:false}),pending=h.c.loadAll();h.reads()[0].reject(Error("Unavailable"));await pending;assert.match(h.c.computerGrid.innerHTML,/inventory is unavailable/);assert.match(h.c.labInventoryStatus.textContent,/Use Refresh/);assert.doesNotMatch(h.c.labInventoryStatus.textContent,/last available/);
});
test("a later successful read clears failure feedback",async()=>{
 const h=await fixture(),first=h.c.loadAll();h.reads()[0].reject(Error("Offline"));await first;const next=h.c.loadAll();h.reads()[1].resolve(snapshot("Recovered"));await next;assert.equal(h.c.labInventoryStatus.textContent,"");assert.equal(h.c.computerGrid.innerHTML,"Recovered");assert.equal(h.summaries(),1);
});
test("metadata writes serialize accepted names and groups and defer polling",async()=>{
 const h=await fixture(),first=h.c.editComputer("a");h.c.prompt=label=>label.startsWith("Friendly")?"Second":"two, three";const second=h.c.editComputer("a");h.c.prompt=()=>"Changed later";await flush();assert.equal(h.writes().length,1);assert.deepEqual(JSON.parse(h.writes()[0].options.body),{name:"After",groups:["group"]});await h.c.loadAll();assert.equal(h.reads().length,0);h.writes()[0].resolve({ok:true});await first;await flush();assert.deepEqual(JSON.parse(h.writes()[1].options.body),{name:"Second",groups:["two","three"]});assert.equal(h.reads().length,0);h.writes()[1].resolve({ok:true});await second;assert.equal(h.reads().length,1);
});
test("failed metadata releases subsequent accepted work without replay",async()=>{
 const h=await fixture(),first=h.c.editComputer("a"),second=h.c.editComputer("a");await flush();h.writes()[0].reject(Error("Save failed"));await first;await flush();assert.deepEqual(h.alerts,["Save failed"]);assert.equal(h.writes().length,2);h.writes()[1].resolve({ok:true});await second;assert.equal(h.writes().length,2);assert.equal(h.reads().length,1);
});
test("metadata admission is bounded and rejected work never reaches the API",async()=>{
 const h=await fixture(),pending=Array.from({length:16},()=>h.c.editComputer("a"));await h.c.editComputer("a");await flush();assert.equal(h.alerts.length,1);assert.match(h.alerts[0],/still pending/);
 for(let n=0;n<16;n++){assert.equal(h.writes().length,n+1);h.writes()[n].resolve({ok:true});await pending[n];await flush()}assert.equal(h.writes().length,16);assert.equal(h.reads().length,1);
});
test("cancelled metadata prompts never queue a write",async()=>{
 for(const cancel of ["name","groups"]){const h=await fixture();h.c.prompt=label=>(label.startsWith("Friendly")?cancel==="name":cancel==="groups")?null:"fixture";await h.c.editComputer("a");assert.equal(h.requests.length,0)}
});
test("an accepted empty inventory is distinct from an unavailable read",async()=>{
 const h=await fixture(),pending=h.c.loadAll();h.reads()[0].resolve({computers:[],summary:{total:0,online:0,offline:0}});await pending;assert.equal(h.c.computerGrid.innerHTML,"No agents");assert.equal(h.c.labInventoryStatus.textContent,"");
});
test("discarded inventory cannot start a new AI summary read",async()=>{
 const h=await fixture(),read=h.c.loadAll(),save=h.c.editComputer("a");await flush();h.writes()[0].resolve({ok:true});await save;h.reads()[0].resolve(snapshot("Old"));await read;assert.equal(h.summaries(),0);h.reads()[1].resolve(snapshot("Current"));await flush();assert.equal(h.summaries(),1);
});
