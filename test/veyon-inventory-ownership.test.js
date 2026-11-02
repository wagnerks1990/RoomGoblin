"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/controller/veyon.js"),"utf8");
const between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
async function flush(){for(let n=0;n<12;n++)await Promise.resolve()}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function fixture(){
 const requests=[],elements=new Map(),alerts=[],revoked=[];const c={loadBusy:false,computers:[{id:"a",name:"Before",role:"student"}],selected:new Set(["a"]),thumbState:new Map(),URL:{revokeObjectURL:url=>revoked.push(url)},render(){},status(){},alert:x=>alerts.push(x),prompt:()=>"After",JSON,Set,Map,Promise,
 $:id=>{if(!elements.has(id))elements.set(id,{textContent:"",disabled:false});return elements.get(id)},
 api:(url,options)=>{const d=deferred();requests.push({url,options,...d});return d.promise}};
 vm.createContext(c);vm.runInContext(between("let inventoryRevision=","let liveController=")+between("function queueInventoryMutation(","const commandJobs=")+between("async function setRole(","function openInfo(")+between("async function renameComputer(","function thumbnailUrl("),c);
 c.$("inventoryStatus");return{c,requests,elements,alerts,revoked,writes:()=>requests.filter(r=>r.options?.method),reads:()=>requests.filter(r=>!r.options?.method)};
}
test("pre-role inventory cannot restore the former role",async()=>{
 const h=fixture(),read=h.c.load(),write=h.c.setRole(["a"],"teacher");await flush();h.writes()[0].resolve({ok:true});await write;assert.equal(h.c.computers[0].role,"teacher");h.reads()[0].resolve({computers:[{id:"a",role:"student"}]});await read;assert.equal(h.c.computers[0].role,"teacher");assert.equal(h.reads().length,2);
});
test("rename requests a post-write inventory even while an older read is pending",async()=>{
 const h=fixture(),read=h.c.load(),write=h.c.renameComputer("a");await flush();h.writes()[0].resolve({ok:true});await write;h.reads()[0].resolve({computers:[{id:"a",name:"Before",role:"student"}]});await read;assert.equal(h.reads().length,2);h.reads()[1].resolve({computers:[{id:"a",name:"After",role:"student"}]});await flush();assert.equal(h.c.computers[0].name,"After");
});
test("late inventory error cannot replace a successful metadata update",async()=>{
 const h=fixture(),read=h.c.load(),write=h.c.setRole(["a"],"teacher");await flush();h.writes()[0].resolve({ok:true});await write;h.reads()[0].reject(Error("old read"));await read;assert.equal(h.elements.get("inventoryStatus").textContent,"");
});
test("role writes are serialized in accepted order",async()=>{
 const h=fixture(),first=h.c.setRole(["a"],"teacher"),second=h.c.setRole(["a"],"student");await flush();assert.equal(h.writes().length,1);assert.equal(h.reads().length,0);h.writes()[0].resolve({ok:true});await first;await flush();assert.equal(h.writes().length,2);assert.equal(h.reads().length,0);h.writes()[1].resolve({ok:true});await second;assert.equal(h.c.computers[0].role,"student");assert.equal(h.reads().length,1);
});
test("accepted role targets are captured before a caller changes its selection array",async()=>{
 const h=fixture(),ids=["a"],pending=h.c.setRole(ids,"teacher");ids[0]="other";await flush();assert.deepEqual(JSON.parse(h.writes()[0].options.body).ids,["a"]);h.writes()[0].resolve({ok:true});await pending;assert.equal(h.c.computers[0].role,"teacher");
});
test("a failed save releases the next accepted save without retrying the failure",async()=>{
 const h=fixture(),first=h.c.setRole(["a"],"teacher"),second=h.c.renameComputer("a");await flush();h.writes()[0].reject(Error("Save failed"));await first;await flush();assert.equal(h.writes().length,2);assert.equal(h.c.computers[0].role,"student");assert.deepEqual(h.alerts,["Save failed"]);h.writes()[1].resolve({ok:true});await second;assert.equal(h.writes().length,2);
});
test("polling during queued writes coalesces into one final inventory read",async()=>{
 const h=fixture(),pending=h.c.setRole(["a"],"teacher");await flush();await h.c.load();await h.c.load();assert.equal(h.reads().length,0);h.writes()[0].resolve({ok:true});await pending;assert.equal(h.reads().length,1);
});
test("overlapping ordinary reads coalesce into one follow-up without parallel requests",async()=>{
 const h=fixture(),pending=h.c.load();await h.c.load();await h.c.load();assert.equal(h.reads().length,1);h.reads()[0].resolve({computers:h.c.computers});await pending;assert.equal(h.reads().length,2);h.reads()[1].resolve({computers:h.c.computers});await flush();assert.equal(h.reads().length,2);
});
test("obsolete inventory cannot drop hidden selections or release their previews",async()=>{
 const h=fixture();h.c.thumbState.set("a",{url:"blob:current",controller:{abort(){throw Error("Current preview must survive")}}});const read=h.c.load(),write=h.c.setRole(["a"],"teacher");await flush();h.writes()[0].resolve({ok:true});await write;h.reads()[0].resolve({computers:[]});await read;assert.equal(h.c.selected.has("a"),true);assert.equal(h.c.thumbState.has("a"),true);assert.deepEqual(h.revoked,[]);
});
test("a current read failure preserves inventory and reports its stale state",async()=>{
 const h=fixture(),old=h.c.computers,pending=h.c.load();h.reads()[0].reject(Error("Unavailable"));await pending;assert.equal(h.c.computers,old);assert.match(h.elements.get("inventoryStatus").textContent,/Unavailable.*last available inventory/);assert.equal(h.c.selected.has("a"),true);
});
test("a current successful read prunes removed selections and their preview resources",async()=>{
 const h=fixture();let aborted=0;h.c.thumbState.set("a",{url:"blob:old",controller:{abort(){aborted++}}});const pending=h.c.load();h.reads()[0].resolve({computers:[]});await pending;assert.equal(h.c.selected.size,0);assert.equal(h.c.thumbState.size,0);assert.equal(aborted,1);assert.deepEqual(h.revoked,["blob:old"]);
});
test("discovery shares the metadata queue and restores its button after failure",async()=>{
 const h=fixture(),first=h.c.setRole(["a"],"teacher"),scan=h.c.discover();await flush();assert.equal(h.writes().length,1);assert.equal(h.c.$("discover").disabled,true);h.writes()[0].resolve({ok:true});await first;await flush();assert.equal(h.writes()[1].url,"/api/v1/veyon/discover");h.writes()[1].reject(Error("Scan unavailable"));await scan;assert.equal(h.c.$("discover").disabled,false);assert.equal(h.c.$("discover").textContent,"Discover computers");assert.deepEqual(h.alerts,["Scan unavailable"]);
});
test("queued rename retains its accepted name and computer",async()=>{
 const h=fixture(),first=h.c.setRole(["a"],"teacher"),rename=h.c.renameComputer("a");h.c.prompt=()=>"Different";await flush();h.writes()[0].resolve({ok:true});await first;await flush();assert.equal(h.writes()[1].url,"/api/v1/veyon/computers/a");assert.deepEqual(JSON.parse(h.writes()[1].options.body),{name:"After"});h.writes()[1].resolve({ok:true});await rename;
});
test("metadata queue bounds admission and does not dispatch a rejected seventeenth save",async()=>{
 const h=fixture(),pending=Array.from({length:16},()=>h.c.setRole(["a"],"teacher"));await h.c.setRole(["a"],"student");await flush();assert.equal(h.alerts.length,1);assert.match(h.alerts[0],/still pending/);
 for(let n=0;n<16;n++){assert.equal(h.writes().length,n+1);h.writes()[n].resolve({ok:true});await pending[n];await flush()}assert.equal(h.writes().length,16);assert.equal(h.c.computers[0].role,"teacher");assert.equal(h.reads().length,1);
});
