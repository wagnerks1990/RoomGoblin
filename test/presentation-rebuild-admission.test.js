"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function fixture(){
 let handler;const h={jobs:[],saved:[]},records={deck:{id:"deck",conversionStatus:"ready",conversionError:null,slideCount:3},other:{id:"other",conversionStatus:"ready",conversionError:null,slideCount:2}};
 const ctx=vm.createContext({Date,app:{post:(_url,...handlers)=>handler=handlers.at(-1)},requireCapability:()=>()=>{},presentationLibrary:{presentations:records},presentationBuilds:new Map(),persistPresentationLibrary:()=>h.saved.push(structuredClone(records)),presentationPublicRecord:r=>r,buildPresentationSlidesUnlocked:async id=>{const g=gate();h.jobs.push({id,...g});await g.promise;records[id].conversionStatus="ready";return records[id]}});
 vm.runInContext(block("function buildPresentationSlides(id){","\nfunction defaultPresentationState(")+block('app.post("/api/v1/presentations/:id/rebuild"','\napp.put("/api/v1/presentations/:id"'),ctx);
 h.call=async(id="deck")=>{const r={status:200},res={status(n){r.status=n;return res},json(body){r.body=body;return res}};await handler({params:{id}},res);return r};h.ctx=ctx;h.records=records;return h;
}
test("overlapping failed rebuilds preserve the prior ready status with one accepted owner",async()=>{
 const h=fixture(),first=h.call(),second=await h.call();assert.equal(second.status,409);assert.match(second.body.error,/already in progress/);assert.equal(h.jobs.length,1);assert.equal(h.saved.length,1);h.jobs[0].reject(Error("controlled failure"));assert.equal((await first).status,500);assert.equal(h.records.deck.conversionStatus,"ready");assert.equal(h.records.deck.lastRebuildError,"controlled failure");assert.equal(h.ctx.presentationBuilds.size,0);
});
test("overlapping successful rebuilds do not start or persist another conversion",async()=>{
 const h=fixture(),first=h.call();assert.equal((await h.call()).status,409);assert.equal(h.jobs.length,1);assert.equal(h.saved.length,1);h.jobs[0].resolve();assert.equal((await first).status,200);assert.equal(h.records.deck.conversionStatus,"ready");assert.equal(h.ctx.presentationBuilds.size,0);
});
test("a rebuild cannot change an existing upload conversion's state or ownership",async()=>{
 const h=fixture();h.records.deck.conversionStatus="converting";h.records.deck.slideCount=0;const upload=h.ctx.buildPresentationSlides("deck"),owner=h.ctx.presentationBuilds.get("deck");assert.equal((await h.call()).status,409);assert.equal(h.ctx.presentationBuilds.get("deck"),owner);assert.equal(h.records.deck.conversionStatus,"converting");assert.equal(h.saved.length,0);h.jobs[0].resolve();await upload;assert.equal(h.ctx.presentationBuilds.size,0);
});
test("a completed failure permits a fresh rebuild attempt",async()=>{
 const h=fixture(),first=h.call();h.jobs[0].reject(Error("temporary failure"));assert.equal((await first).status,500);const retry=h.call();assert.equal(h.jobs.length,2);assert.equal(h.records.deck.conversionStatus,"converting");h.jobs[1].resolve();assert.equal((await retry).status,200);assert.equal(h.records.deck.conversionStatus,"ready");
});
test("independent decks retain separate concurrent conversion owners",async()=>{
 const h=fixture(),a=h.call("deck"),b=h.call("other");assert.equal(h.ctx.presentationBuilds.size,2);assert.deepEqual(h.jobs.map(j=>j.id),["deck","other"]);h.jobs[1].resolve();assert.equal((await b).status,200);assert.equal(h.ctx.presentationBuilds.size,1);h.jobs[0].resolve();assert.equal((await a).status,200);assert.equal(h.ctx.presentationBuilds.size,0);
});
