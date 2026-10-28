"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/managed-displays/ubuntu.js"),"utf8");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const requests=[],renders=[],status={textContent:""},initial={devices:[{id:"one",name:"Before"}],receivers:{}};
 const ctx=vm.createContext({base:"/fixture",inventory:initial,polling:false,inventoryVersion:0,inventoryWrites:0,loadAgain:false,
   $:()=>status,render(){renders.push(JSON.parse(JSON.stringify(ctx.inventory)))},
   fetch(url,options){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});requests.push({url,options,reply(value,code=200){resolve({ok:code<400,status:code,json:async()=>value})},reject});return promise}});
 vm.runInContext(block("async function request(","function message(")+block("async function load(","function render("),ctx);
 return {ctx,requests,renders,status,initial,reads:()=>requests.filter(r=>r.options.method==="GET")};
}
test("Ubuntu inventory reads predating a save cannot replace its fresh inventory",async()=>{
 const h=fixture(),read=h.ctx.load(),write=h.ctx.request("/one","PUT",{name:"After"});
 h.requests[1].reply({ok:true});await write;assert.equal(h.reads().length,1);
 h.requests[0].reply(h.initial);await flush();assert.equal(h.reads().length,2);
 h.reads()[1].reply({devices:[{id:"one",name:"After"}],receivers:{}});await read;
 assert.equal(h.ctx.inventory.devices[0].name,"After");assert.equal(h.renders.length,1);
});
test("obsolete Ubuntu inventory errors cannot replace a successful write with stale feedback",async()=>{
 const h=fixture(),read=h.ctx.load(),write=h.ctx.request("/one","PUT",{name:"After"});
 h.requests[1].reply({ok:true});await write;h.status.textContent="Saved";h.requests[0].reject(Error("obsolete read"));
 await flush();assert.equal(h.status.textContent,"Saved");assert.equal(h.reads().length,2);
 h.reads()[1].reply({devices:[],receivers:{}});await read;assert.equal(h.ctx.inventory.devices.length,0);
});
test("Ubuntu polling is deferred until every accepted inventory write settles",async()=>{
 const h=fixture(),one=h.ctx.request("/one","PUT",{}),two=h.ctx.request("/two","DELETE",{});
 const deferred=h.ctx.load();assert.equal(h.reads().length,0);assert.equal(await deferred,false);
 h.requests[0].reply({ok:true});await one;assert.equal(h.reads().length,0);
 h.requests[1].reply({ok:true});await two;assert.equal(h.reads().length,1);
 h.reads()[0].reply({devices:[],receivers:{}});await h.ctx.load();assert.equal(h.ctx.inventory.devices.length,0);
});
test("Ubuntu uncertain writes refresh inventory without automatically repeating the write",async()=>{
 const h=fixture(),write=h.ctx.request("/one/command","POST",{action:"reboot",confirm:true});
 const rejected=assert.rejects(write,/unconfirmed/);h.requests[0].reply({ok:false,error:"delivery unconfirmed"},503);await rejected;
 assert.equal(h.requests.filter(r=>r.options.method==="POST").length,1);assert.equal(h.reads().length,1);
 h.reads()[0].reply(h.initial);await h.ctx.load();assert.equal(h.ctx.inventory.devices[0].name,"Before");
});
test("a current Ubuntu read failure preserves inventory and reports stale status",async()=>{
 const h=fixture(),read=h.ctx.load();h.requests[0].reject(Error("unavailable"));
 assert.equal(await read,false);assert.equal(h.ctx.inventory,h.initial);assert.match(h.status.textContent,/last available inventory/i);
 const retry=h.ctx.load();h.requests[1].reply({devices:[],receivers:{}});assert.equal(await retry,true);assert.equal(h.ctx.inventory.devices.length,0);
});
test("Ubuntu probe and preview requests do not invalidate an unrelated inventory read",async()=>{
 const h=fixture(),read=h.ctx.load();
 for(const [url,body]of [["/host-key",{}],["/probe",{}],["/one/command",{action:"screenshot"}]]){
  const request=h.ctx.request(url,"POST",body);h.requests.at(-1).reply({ok:true});await request;
 }
 h.requests[0].reply(h.initial);await read;assert.equal(h.reads().length,1);assert.equal(h.renders.length,1);
});
test("overlapping Ubuntu refresh callers share one read and its accepted result",async()=>{
 const h=fixture(),one=h.ctx.load(),two=h.ctx.load();assert.equal(h.requests.length,1);
 h.requests[0].reply(h.initial);assert.equal(await one,true);assert.equal(await two,true);assert.equal(h.renders.length,1);
});
test("Ubuntu writes serialize their submitted payload before newer edits",async()=>{
 const h=fixture(),body={name:"Submitted"},write=h.ctx.request("/one","PUT",body);body.name="New draft";
 assert.equal(JSON.parse(h.requests[0].options.body).name,"Submitted");h.requests[0].reply({ok:true});await write;
 if(h.reads().length){h.reads()[0].reply(h.initial);await h.ctx.load()}
});
