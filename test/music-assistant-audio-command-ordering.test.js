"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n"),a=source.indexOf('app.post("/api/v1/music-assistant/command"'),b=source.indexOf("\nconst musicAssistantProxyTickets",a),d=source.indexOf("const MUSIC_ASSISTANT_TV_DEFAULT_VOLUME="),e=source.indexOf("\nfunction musicAssistantTvAttachPayload",d);assert.ok(a>0&&b>a&&d>0&&e>d);
const flush=()=>new Promise(setImmediate);
function fixture(){
 let route,blocked=false,failWrite=false;const calls=[],prefs=new Map(),audits=[];
 const c=vm.createContext({app:{post:(_p,...args)=>route=args.at(-1)},musicAssistantMutationLimit(){},requireControl(){},devices:{tv1:{enabled:true},"front-screen":{enabled:true}},maApiGeneration:0,
  dbStore:{getPreference:(k,f)=>prefs.has(k)?prefs.get(k):f,setPreference:(k,v)=>{if(failWrite)throw Error("storage unavailable");prefs.set(k,v)}},
  backgroundMusicRuntime:{},backgroundMusicPriorityBlocked:()=>blocked,audit:v=>audits.push(v),
  musicAssistantCommand:(command,args)=>new Promise((resolve,reject)=>calls.push({command,args,resolve,reject}))});
 vm.runInContext(source.slice(d,e)+source.slice(a,b),c);
 return {c,calls,prefs,audits,block:()=>{blocked=true},failWrites:()=>{failWrite=true},
  count:()=>vm.runInContext("musicAssistantTvAudioWrites.size",c),
  state:(id="tv1")=>c.musicAssistantTvAudioState(id),
  async send(command,args={}){let status=200,body;const res={status(n){status=n;return res},json(v){body=JSON.parse(JSON.stringify(v));return res}};await route({body:{command,args:{player_id:"classroom-hub-tv1",...args}}},res);return {status,body}}};
}
for(const [command,key,first,last,stateKey]of [["players/cmd/volume_set","volume_level",30,80,"volume"],["players/cmd/volume_mute","muted",true,false,"muted"]])test("older acknowledged "+stateKey+" cannot replace a newer successful write",async()=>{
 const h=fixture(),p=h.send(command,{[key]:first}),q=h.send(command,{[key]:last});assert.equal(h.count(),1);h.calls[1].resolve(null);assert.equal((await q).status,200);h.calls[0].resolve(null);assert.equal((await p).status,200);assert.equal(h.state()[stateKey],last);assert.equal(h.count(),0);
});
test("newer known failure preserves the older confirmed audio setting",async()=>{
 const h=fixture(),p=h.send("players/cmd/volume_set",{volume_level:30}),q=h.send("players/cmd/volume_set",{volume_level:80});h.calls[1].reject(Error("rejected"));assert.equal((await q).status,502);h.calls[0].resolve(null);await p;assert.equal(h.state().volume,30);assert.equal(h.count(),0);
});
test("volume and mute retain independent acknowledgment order",async()=>{
 const h=fixture(),p=h.send("players/cmd/volume_set",{volume_level:70}),q=h.send("players/cmd/volume_mute",{muted:true});assert.equal(h.count(),2);h.calls[1].resolve(null);await q;h.calls[0].resolve(null);await p;assert.equal(h.state().volume,70);assert.equal(h.state().muted,true);assert.equal(h.count(),0);
});
test("different configured receivers retain independent write owners",async()=>{
 const h=fixture(),p=h.send("players/cmd/volume_set",{volume_level:30}),q=h.send("players/cmd/volume_set",{player_id:"classroom-hub-front-screen",volume_level:80});h.calls[1].resolve(null);await q;h.calls[0].resolve(null);await p;assert.equal(h.state().volume,30);assert.equal(h.state("front-screen").volume,80);assert.equal(h.count(),0);
});
for(const failed of [false,true])test("connection retirement prevents "+(failed?"failure":"success")+" from publishing saved audio",async()=>{
 const h=fixture(),p=h.send("players/cmd/volume_set",{volume_level:70});h.c.maApiGeneration++;
 if(failed)h.calls[0].reject(Error("retired failure"));else h.calls[0].resolve(null);
 const r=await p;assert.equal(r.status,409);assert.match(r.body.error,/Refresh/);assert.equal(h.state().volume,20);assert.equal(h.audits.length,0);assert.equal(h.count(),0);
});
test("retired play cannot compensate priority against a replacement connection",async()=>{
 const h=fixture(),p=h.send("players/cmd/play");h.block();h.c.maApiGeneration++;h.calls[0].resolve(null);assert.equal((await p).status,409);assert.equal(h.calls.length,1);assert.equal(h.count(),0);
});
test("retirement during priority compensation cannot claim current success",async()=>{
 const h=fixture(),p=h.send("players/cmd/play");h.block();h.calls[0].resolve(null);await flush();assert.equal(h.calls[1].command,"players/cmd/pause");h.c.maApiGeneration++;h.calls[1].resolve(null);assert.equal((await p).status,409);assert.equal(h.audits.length,0);
});
test("current priority compensation remains intact",async()=>{
 const h=fixture(),p=h.send("players/cmd/play");h.block();h.calls[0].resolve(null);await flush();h.calls[1].resolve(null);assert.equal((await p).status,200);assert.equal(h.calls[1].args.player_id,"classroom-hub-tv1");assert.equal(h.audits.length,1);
});
test("unrelated Music Assistant output does not create receiver preferences",async()=>{
 const h=fixture(),p=h.send("players/cmd/volume_set",{player_id:"external-speaker",volume_level:70});assert.equal(h.count(),0);h.calls[0].resolve(null);assert.equal((await p).status,200);assert.equal(h.prefs.size,0);
});
test("removed receiver cannot receive a late persisted audio setting",async()=>{
 const h=fixture(),p=h.send("players/cmd/volume_set",{volume_level:70});delete h.c.devices.tv1;h.calls[0].resolve(null);await p;assert.equal(h.prefs.size,0);assert.equal(h.count(),0);
});
test("failed persistence releases ownership and stays visible",async()=>{
 const h=fixture(),p=h.send("players/cmd/volume_set",{volume_level:70});h.failWrites();h.calls[0].resolve(null);const r=await p;assert.equal(r.status,502);assert.match(r.body.error,/storage unavailable/);assert.equal(h.count(),0);assert.equal(h.audits.length,0);
});
test("serial successful controls clear their temporary owner records",async()=>{
 const h=fixture();for(const value of [30,40,50]){const p=h.send("players/cmd/volume_set",{volume_level:value});h.calls.at(-1).resolve(null);await p;assert.equal(h.state().volume,value);assert.equal(h.count(),0)}
});
test("unapproved commands create no write owner or upstream request",async()=>{
 const h=fixture(),r=await h.send("arbitrary/command");assert.equal(r.status,400);assert.equal(h.calls.length,0);assert.equal(h.count(),0);
});
test("priority admission rejects playback before any owner or request",async()=>{
 const h=fixture();h.block();const r=await h.send("players/cmd/play");assert.equal(r.status,409);assert.equal(h.calls.length,0);assert.equal(h.count(),0);
});
test("uncertain audio failure is reported once without persistence or replay",async()=>{
 const h=fixture(),p=h.send("players/cmd/volume_set",{volume_level:70});h.calls[0].reject(Object.assign(Error("reply lost"),{mayHaveExecuted:true}));assert.equal((await p).status,502);assert.equal(h.calls.length,1);assert.equal(h.prefs.size,0);assert.equal(h.count(),0);
});
