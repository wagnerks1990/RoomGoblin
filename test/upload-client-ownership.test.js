"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/shared/resumable-upload.js"),"utf8"),tick=()=>new Promise(setImmediate);
const response=(status,body={})=>({ok:status>=200&&status<300,status,json:async()=>body});
function fixture({saved=true}={}){
 const bytes=Buffer.from("%PDF-1.7"),file={name:"lesson.pdf",size:bytes.length,lastModified:1,type:"application/pdf",slice:(a,b)=>({arrayBuffer:async()=>new Uint8Array(bytes.subarray(a,b)).buffer})},key="roomgoblin-upload:lesson.pdf:8:1",cache=new Map(saved?[[key,JSON.stringify({id:"old"})]]:[]),calls=[],pending=[];
 const c=vm.createContext({TextEncoder,DOMException,window:{},localStorage:{getItem:k=>cache.get(k),setItem:(k,v)=>cache.set(k,v),removeItem:k=>cache.delete(k)},fetch:(url,options={})=>new Promise((resolve,reject)=>{calls.push({url,options});pending.push({resolve,reject})})});
 vm.runInContext(source,c);
 return{file,key,cache,calls,pending,api:c.window.RoomGoblinUpload,session:(id="old")=>({id,chunkBytes:8,totalChunks:1,received:[0]})};
}
for(const status of [401,403,429,503]){
 test("cancel HTTP "+status+" stays visible and preserves the resume identity",async()=>{
  const h=fixture(),p=h.api.cancel(h.file);h.pending[0].resolve(response(status,{error:"not cancelled"}));await assert.rejects(p,/not cancelled/);assert.equal(JSON.parse(h.cache.get(h.key)).id,"old");assert.equal(h.calls[0].options.method,"DELETE");
 });
 test("resume HTTP "+status+" does not discard identity or create another session",async()=>{
  const h=fixture(),p=h.api.upload(h.file);h.pending[0].resolve(response(status,{error:"lookup unavailable"}));await assert.rejects(p,/lookup unavailable/);assert.equal(JSON.parse(h.cache.get(h.key)).id,"old");assert.equal(h.calls.length,1);
 });
}
test("cancel returns saved-file evidence after completion wins",async()=>{
 const h=fixture(),p=h.api.cancel(h.file);h.pending[0].resolve(response(200,{ok:true,completed:true,file:{storedName:"saved.pdf"}}));const r=await p;assert.equal(r.completed,true);assert.equal(r.file.storedName,"saved.pdf");assert.equal(h.cache.has(h.key),false);
});
test("missing receipt and missing local identity leave cancellation outcome unknown",async()=>{
 const h=fixture(),p=h.api.cancel(h.file);h.pending[0].resolve(response(404));assert.equal((await p).completed,null);assert.equal((await h.api.cancel(h.file)).completed,null);assert.equal(h.calls.length,1);
});
test("confirmed incomplete-session cancellation returns false completion",async()=>{
 const h=fixture(),p=h.api.cancel(h.file);h.pending[0].resolve(response(200,{ok:true,completed:false}));assert.equal((await p).completed,false);assert.equal(h.cache.has(h.key),false);
});
test("network cancellation failure preserves its session and permits an explicit retry",async()=>{
 const h=fixture(),p=h.api.cancel(h.file);h.pending[0].reject(Error("offline"));await assert.rejects(p,/offline/);assert.ok(h.cache.has(h.key));const q=h.api.cancel(h.file);h.pending[1].resolve(response(200,{ok:true}));await q;assert.equal(h.cache.has(h.key),false);
});
test("confirmed cancellation and already-missing sessions clear only their own identity",async()=>{
 for(const status of [200,404]){const h=fixture();h.cache.set("unrelated","keep");const p=h.api.cancel(h.file);h.pending[0].resolve(response(status));await p;assert.equal(h.cache.has(h.key),false);assert.equal(h.cache.get("unrelated"),"keep");await h.api.cancel(h.file);assert.equal(h.calls.length,1)}
});
test("cancel success cannot erase a successor cache entry",async()=>{
 const h=fixture(),p=h.api.cancel(h.file);h.cache.set(h.key,JSON.stringify({id:"successor"}));h.pending[0].resolve(response(200));await p;assert.equal(JSON.parse(h.cache.get(h.key)).id,"successor");
});
test("lookup 404 permits a new upload while existing chunks remain idempotent",async()=>{
 const h=fixture(),p=h.api.upload(h.file);h.pending[0].resolve(response(404));await tick();assert.equal(h.calls[1].options.method,"POST");h.pending[1].resolve(response(201,{upload:h.session("new")}));await tick();assert.match(h.calls[2].url,/new\/complete$/);h.pending[2].resolve(response(200,{file:{storedName:"file.pdf"}}));assert.equal((await p).file.storedName,"file.pdf");assert.equal(h.cache.has(h.key),false);
});
test("failed completion keeps the existing resume identity",async()=>{
 const h=fixture(),p=h.api.upload(h.file);h.pending[0].resolve(response(200,{upload:h.session()}));await tick();h.pending[1].resolve(response(503,{error:"completion unavailable"}));await assert.rejects(p,/completion unavailable/);assert.equal(JSON.parse(h.cache.get(h.key)).id,"old");assert.equal(h.calls.length,2);
});
test("late completion cannot erase a successor cache entry",async()=>{
 const h=fixture(),p=h.api.upload(h.file);h.pending[0].resolve(response(200,{upload:h.session()}));await tick();h.cache.set(h.key,JSON.stringify({id:"successor"}));h.pending[1].resolve(response(200,{file:{}}));await p;assert.equal(JSON.parse(h.cache.get(h.key)).id,"successor");
});
test("concurrent startup shares one request and both paused callers retain the new session",async()=>{
 const h=fixture({saved:false}),signal={aborted:true},p=h.api.upload(h.file,{signal}),q=h.api.upload(h.file,{signal});p.catch(()=>{});q.catch(()=>{});assert.equal(h.calls.length,1);h.pending[0].resolve(response(201,{upload:h.session("new")}));await assert.rejects(p,{name:"AbortError"});await assert.rejects(q,{name:"AbortError"});assert.equal(h.calls.length,1);assert.equal(JSON.parse(h.cache.get(h.key)).id,"new");
});
test("cancellation waits for accepted startup and concurrent cancel shares its result",async()=>{
 const h=fixture({saved:false}),p=h.api.upload(h.file,{signal:{aborted:true}});p.catch(()=>{});const a=h.api.cancel(h.file),b=h.api.cancel(h.file);assert.equal(h.calls.length,1);h.pending[0].resolve(response(201,{upload:h.session("new")}));await assert.rejects(p,{name:"AbortError"});await tick();assert.equal(h.calls.length,2);assert.match(h.calls[1].url,/new$/);h.pending[1].resolve(response(200));await Promise.all([a,b]);assert.equal(h.cache.has(h.key),false);
});
test("new startup waits for same-file cancellation before creating its successor",async()=>{
 const h=fixture(),cancel=h.api.cancel(h.file),p=h.api.upload(h.file,{signal:{aborted:true}});p.catch(()=>{});assert.equal(h.calls.length,1);h.pending[0].resolve(response(200));await cancel;await tick();assert.equal(h.calls.length,2);assert.equal(h.calls[1].options.method,"POST");h.pending[1].resolve(response(201,{upload:h.session("new")}));await assert.rejects(p,{name:"AbortError"});assert.equal(JSON.parse(h.cache.get(h.key)).id,"new");
});
