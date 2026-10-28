"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
function section(a,b){const x=source.indexOf(a),y=source.indexOf(b,x);assert.ok(x>0&&y>x,a);return source.slice(x,y)}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const flush=()=>new Promise(setImmediate),players=(id,state="playing")=>[{player_id:id,state,available:true}];
function fixture(){
  const calls=[];let now=100000;
  const ctx=vm.createContext({Date:class extends Date{static now(){return now}},maApiGeneration:0,backgroundMusicSchedule:()=>({playerId:"A"}),
    musicAssistantCommand:(command,args)=>{const d=deferred();calls.push({command,args,...d});return d.promise}});
  vm.runInContext(section("let backgroundMusicPlayerProbe=","async function backgroundMusicPause("),ctx);
  return {ctx,calls,advance:ms=>{now+=ms},probe:()=>vm.runInContext("backgroundMusicPlayerProbe",ctx),read:(id="A",force=true)=>ctx.backgroundMusicActualPlayerState({playerId:id},force)};
}
test("late output success does not replace the newer output cache",async()=>{
  const h=fixture(),a=h.read("A"),b=h.read("B");h.calls[1].resolve(players("B"));await b;h.calls[0].resolve(players("A"));
  assert.equal((await a).player.player_id,"A");assert.equal(h.probe().playerId,"B");assert.equal(h.probe().error,null);
});
test("late output failure cannot replace a newer success",async()=>{
  const h=fixture(),a=h.read("A"),b=h.read("B");h.calls[1].resolve(players("B"));await b;h.calls[0].reject(Error("old protocol failure"));await flush();
  h.calls[2].reject(Error("old fallback failure"));assert.equal(await a,null);assert.equal(h.probe().playerId,"B");assert.equal(h.probe().error,null);
});
test("late success cannot erase the current output failure",async()=>{
  const h=fixture(),a=h.read("A"),b=h.read("B");h.calls[1].reject(Error("current protocol"));await flush();h.calls[2].reject(Error("current fallback"));await b;
  h.calls[0].resolve(players("A"));await a;assert.equal(h.probe().playerId,"B");assert.equal(h.probe().error,"current fallback");
});
test("a new connection does not share an older pending probe of the same player",async()=>{
  const h=fixture(),a=h.read();h.ctx.maApiGeneration++;const b=h.read();assert.equal(h.calls.length,2);
  h.calls[1].resolve(players("A","paused"));await b;h.calls[0].resolve(players("A"));assert.equal(await a,null);assert.equal(h.probe().generation,1);assert.equal(h.probe().state.paused,true);
});
test("connection reset invalidates the prior player cache",async()=>{
  const h=fixture(),a=h.read();h.calls[0].resolve(players("A"));await a;h.ctx.maApiGeneration++;const b=h.read("A",false);assert.equal(h.calls.length,2);h.calls[1].resolve(players("A","paused"));assert.equal((await b).paused,true);
});
test("retired connection errors cannot retry a player lookup against the replacement",async()=>{
  const h=fixture(),a=h.read();h.ctx.maApiGeneration++;h.calls[0].reject(Error("retired connection"));assert.equal(await a,null);assert.equal(h.calls.length,1);assert.equal(h.probe().at,0);
});
test("connection retirement during legacy fallback cannot publish its response",async()=>{
  const h=fixture(),a=h.read();h.calls[0].reject(Error("old protocol"));await flush();h.ctx.maApiGeneration++;h.calls[1].resolve(players("A"));assert.equal(await a,null);assert.equal(h.probe().at,0);
});
test("current same-player probes share one pending lookup even when forced",async()=>{
  const h=fixture(),a=h.read(),b=h.read();assert.equal(h.calls.length,1);h.calls[0].resolve(players("A"));assert.equal((await a).playing,true);assert.equal((await b).playing,true);
});
test("an old probe finishing cannot clear another player's pending ownership",async()=>{
  const h=fixture(),a=h.read("A"),b=h.read("B");h.calls[0].resolve(players("A"));await a;const again=h.read("B");assert.equal(h.calls.length,2);h.calls[1].resolve(players("B"));await Promise.all([b,again]);
});
test("the current four-second cache expires and explicit force refreshes it",async()=>{
  const h=fixture(),a=h.read();h.calls[0].resolve(players("A"));await a;assert.equal((await h.read("A",false)).playing,true);assert.equal(h.calls.length,1);
  const forced=h.read();h.calls[1].resolve(players("A","paused"));await forced;h.advance(4000);const expired=h.read("A",false);assert.equal(h.calls.length,3);h.calls[2].resolve(players("A"));await expired;
});
test("current legacy player-list fallback preserves aliases and unavailable state",async()=>{
  const h=fixture(),p=h.read("provider");h.calls[0].reject(Error("unsupported argument"));await flush();assert.deepEqual(Object.keys(h.calls[1].args),[]);
  h.calls[1].resolve([{provider_id:"provider",playback_state:"paused",available:false}]);const result=await p;assert.equal(result.found,true);assert.equal(result.paused,true);assert.equal(result.available,false);assert.equal(h.probe().error,null);
});
test("current missing player and transport failure remain distinct",async()=>{
  const h=fixture(),missing=h.read();h.calls[0].resolve([]);assert.equal((await missing).found,false);assert.equal(h.probe().error,null);
  const failed=h.read();h.calls[1].reject(Error("primary"));await flush();h.calls[2].reject(Error("fallback unavailable"));assert.equal(await failed,null);assert.equal(h.probe().error,"fallback unavailable");
});
test("an empty output does not issue a player request",async()=>{
  const h=fixture();assert.equal(await h.read(""),null);assert.equal(h.calls.length,0);
});
function statusFixture(){
  let route,cfg={playerId:"A"};const d=deferred(),r={sessionGeneration:0,activePlayerId:"A"},probe={playerId:"A",generation:0,error:null};
  const ctx=vm.createContext({app:{get:(_p,...handlers)=>{route=handlers.at(-1)}},musicAssistantStatusLimit(){},requireControl(){},
    maApiGeneration:0,backgroundMusicSchedule:()=>cfg,backgroundMusicRuntime:r,backgroundMusicActualPlayerState:()=>d.promise,
    backgroundMusicFavorites:()=>[],backgroundMusicRecovery:{snapshot:()=>({})},backgroundMusicPriorityState:()=>({active:false}),backgroundMusicPlayerProbe:probe});
  vm.runInContext(section('app.get("/api/v1/music-assistant/background"',"let backgroundMusicScheduleWrites="),ctx);
  return {r,probe,ctx,d,config:value=>{cfg=value},async get(){let result;await route({}, {json:value=>{result=JSON.parse(JSON.stringify(value))}});return result}};
}
for(const same of [false,true])test("status retires telemetry after a "+(same?"same":"different")+"-player successor",async()=>{
  const h=statusFixture(),p=h.get();Object.assign(h.r,{sessionGeneration:1,activePlayerId:same?"A":"B"});h.config({playerId:same?"A":"B"});h.d.resolve({found:true,player:{player_id:"A"}});
  const result=await p;assert.equal(result.runtime.actualPlayer,null);assert.equal(result.schedule.playerId,same?"A":"B");assert.match(result.runtime.playerProbeError,/changed/);
});
test("status does not attach a previous connection's telemetry to current runtime",async()=>{
  const h=statusFixture(),p=h.get();h.ctx.maApiGeneration++;h.d.resolve({found:true,player:{player_id:"A"}});const result=await p;assert.equal(result.runtime.actualPlayer,null);assert.match(result.runtime.playerProbeError,/changed/);
});
test("status notices an idle configured-output change without a session increment",async()=>{
  const h=statusFixture();h.r.activePlayerId=null;const p=h.get();h.config({playerId:"B"});h.d.resolve({found:true,player:{player_id:"A"}});const result=await p;assert.equal(result.runtime.actualPlayer,null);assert.equal(result.schedule.playerId,"B");
});
test("successful current status does not inherit another output's failure",async()=>{
  const h=statusFixture(),p=h.get();h.probe.playerId="B";h.probe.error="B unavailable";h.d.resolve({found:true,player:{player_id:"A"}});const result=await p;assert.equal(result.runtime.actualPlayer.player.player_id,"A");assert.equal(result.runtime.playerProbeError,null);
});
test("current probe failure stays visible only for its matching connection and player",async()=>{
  const h=statusFixture(),p=h.get();h.probe.error="current probe failed";h.d.resolve(null);assert.equal((await p).runtime.playerProbeError,"current probe failed");
  const other=statusFixture(),q=other.get();other.probe.generation=-1;other.probe.error="old connection";other.d.resolve(null);assert.equal((await q).runtime.playerProbeError,null);
});
test("current status reports fresh schedule fields and matching successful telemetry",async()=>{
  const h=statusFixture(),p=h.get();h.config({playerId:"A",volume:35});h.d.resolve({found:true,playing:true,player:{player_id:"A"}});const result=await p;assert.equal(result.schedule.volume,35);assert.equal(result.runtime.actualPlayer.playing,true);assert.equal(result.runtime.playerProbeError,null);
});
