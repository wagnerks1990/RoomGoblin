"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/controller/veyon.js"),"utf8"),between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
function fixture(){
 const requests=[],elements=new Map(),alerts=[];let loads=0,confirmations=0;
 const c={computers:[{id:"a",name:"A"},{id:"b",name:"B"}],esc:String,alert:x=>alerts.push(x),confirm:()=>{confirmations++;return true},load:async()=>{loads++},
 $:id=>{if(!elements.has(id)){const classes=new Set();elements.set(id,{textContent:"",innerHTML:"",disabled:false,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}})}return elements.get(id)},
 api:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))};
 vm.createContext(c);vm.runInContext(between("let infoGeneration=","$('closeInfo')")+between("async function showDeviceFeatures(","let veyonLoginTargets="),c);
 return{c,requests,elements,alerts,loads:()=>loads,confirmations:()=>confirmations};
}
const catalog=label=>({features:[{label,detail:"fixture",advertised:true}]});
test("late feature response cannot overwrite another computer dialog",async()=>{
 const h=fixture(),first=h.c.showDeviceFeatures("a"),second=h.c.showDeviceFeatures("b");h.requests[1].resolve(catalog("New B"));await second;h.requests[0].resolve(catalog("Old A"));await first;assert.match(h.c.$("infoBody").innerHTML,/New B/);assert.doesNotMatch(h.c.$("infoBody").innerHTML,/Old A/);assert.match(h.c.$("infoTitle").textContent,/B/);
});
test("closed information dialog stays cleared after a late error",async()=>{
 const h=fixture(),pending=h.c.showDeviceFeatures("a");h.c.closeInfo();h.requests[0].reject(Error("old result"));await pending;assert.equal(h.c.$("infoBody").innerHTML,"");assert.equal(h.c.$("infoModal").classList.contains("open"),false);
});
test("a late feature failure cannot replace current details",async()=>{
 const h=fixture(),first=h.c.showDeviceFeatures("a"),second=h.c.showDeviceFeatures("b");h.requests[1].resolve(catalog("Current"));await second;h.requests[0].reject(Error("Old failure"));await first;assert.match(h.c.$("infoBody").innerHTML,/Current/);assert.doesNotMatch(h.c.$("infoBody").innerHTML,/Old failure/);
});
test("obsolete pool replies cannot replace a feature dialog or install its action",async()=>{
 const h=fixture(),pool=h.c.showPool(),features=h.c.showDeviceFeatures("a");h.requests[1].resolve(catalog("Current"));await features;h.requests[0].resolve({size:2,max:4,connections:[]});await pool;assert.match(h.c.$("infoBody").innerHTML,/Current/);assert.equal(h.elements.has("closePool"),false);
});
test("obsolete features cannot replace a current pool dialog",async()=>{
 const h=fixture(),features=h.c.showDeviceFeatures("a"),pool=h.c.showPool();h.requests[1].resolve({size:2,max:4,connections:[]});await pool;h.requests[0].resolve(catalog("Old"));await features;assert.match(h.c.$("infoBody").innerHTML,/2 \/ 4 cached connections/);assert.doesNotMatch(h.c.$("infoBody").innerHTML,/Old/);
});
test("closed pool stays empty after either success or failure",async()=>{
 for(const ok of [true,false]){const h=fixture(),pending=h.c.showPool();h.c.closeInfo();ok?h.requests[0].resolve({size:0,max:4,connections:[]}):h.requests[0].reject(Error("old"));await pending;assert.equal(h.c.$("infoBody").innerHTML,"");assert.equal(h.elements.has("closePool"),false)}
});
async function poolFixture(){const h=fixture(),pending=h.c.showPool();h.requests[0].resolve({size:2,max:4,connections:[]});await pending;return h}
test("accepted pool close refreshes inventory without closing a newer dialog",async()=>{
 const h=await poolFixture(),close=h.c.$("closePool").onclick(),features=h.c.showDeviceFeatures("b");h.requests[2].resolve(catalog("Current B"));await features;h.requests[1].resolve({ok:true});await close;assert.equal(h.c.$("infoModal").classList.contains("open"),true);assert.match(h.c.$("infoBody").innerHTML,/Current B/);assert.equal(h.loads(),1);
});
test("pool close has one pending owner and confirms once",async()=>{
 const h=await poolFixture(),button=h.c.$("closePool"),first=button.onclick();await button.onclick();assert.equal(h.requests.length,2);assert.equal(h.confirmations(),1);assert.equal(button.disabled,true);h.requests[1].resolve({ok:true});await first;assert.equal(button.disabled,false);assert.equal(h.c.$("infoModal").classList.contains("open"),false);assert.equal(h.loads(),1);
});
test("a detached pool action cannot close connections from a different dialog",async()=>{
 const h=await poolFixture(),oldAction=h.c.$("closePool").onclick(); // accepted work remains tracked
 h.requests[1].resolve({ok:true});await oldAction;
 const oldHandler=h.c.$("closePool").onclick;h.c.openInfo("New","Current");await oldHandler();assert.equal(h.requests.length,2);assert.equal(h.confirmations(),1);assert.equal(h.c.$("infoBody").innerHTML,"Current");
});
test("declining pool confirmation leaves connections and dialog intact",async()=>{
 const h=await poolFixture();h.c.confirm=()=>false;await h.c.$("closePool").onclick();assert.equal(h.requests.length,1);assert.equal(h.c.$("infoModal").classList.contains("open"),true);assert.equal(h.c.$("closePool").disabled,false);
});
test("a current pool close error stays visible and releases manual retry",async()=>{
 const h=await poolFixture(),button=h.c.$("closePool"),first=button.onclick();h.requests[1].reject(Error("Close failed"));await first;assert.deepEqual(h.alerts,["Close failed"]);assert.equal(button.disabled,false);assert.equal(h.c.$("infoModal").classList.contains("open"),true);const retry=button.onclick();h.requests[2].resolve({ok:true});await retry;assert.equal(h.requests.length,3);
});
test("obsolete close errors cannot interrupt a newer dialog",async()=>{
 const h=await poolFixture(),pending=h.c.$("closePool").onclick();h.c.openInfo("New","Current");h.requests[1].reject(Error("Old close failed"));await pending;assert.deepEqual(h.alerts,[]);assert.equal(h.c.$("infoBody").innerHTML,"Current");assert.equal(h.loads(),0);
});
