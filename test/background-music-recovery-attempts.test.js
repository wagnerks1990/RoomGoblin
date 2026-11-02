"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {PlaybackRecovery,mediaSelection}=require("../src/background-music"),source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const start=source.indexOf("async function backgroundMusicStart("),end=source.indexOf("\nasync function backgroundMusicReconcilePriority",start);assert.ok(start>0&&end>start);
function fixture({stage="play",uncertain=false}={}){
 const recovery=new PlaybackRecovery({now:()=>100000}),r={sessionGeneration:0},calls=[];
 const error=Object.assign(Error("fixture rejected playback"),{mayHaveExecuted:uncertain});
 const ctx=vm.createContext({Date,backgroundMusicStartBusy:false,backgroundMusicRuntime:r,backgroundMusicRecovery:recovery,
  backgroundMusicPriorityBlocked:()=>false,backgroundMusicSchedule:()=>({playerId:"A",favoriteId:"station",volume:20}),
  backgroundMusicFavoriteById:()=>({id:"station",uri:"radio://A",name:"Station"}),mediaSelection,
  backgroundMusicActualPlayerState:async()=>({found:stage!=="unavailable",available:stage!=="unavailable"}),backgroundMusicPlayerProbe:{at:0},
  musicAssistantCommand:async command=>{calls.push(command);if(command===(stage==="volume"?"players/cmd/volume_set":"player_queues/play_media"))throw error}});
 vm.runInContext(source.slice(start,end),ctx);return {ctx,r,recovery,calls,error};
}
test("one explicitly rejected start owns one recovery attempt and initial backoff",async()=>{
 const h=fixture();await assert.rejects(h.ctx.backgroundMusicStart(),/fixture rejected/);assert.equal(h.recovery.attempts,1);assert.equal(h.recovery.retryAt,115000);assert.equal(h.recovery.awaitingUntil,0);assert.equal(h.ctx.backgroundMusicStartBusy,false);assert.equal(h.calls.filter(x=>x==="player_queues/play_media").length,1);
});
test("uncertain playback waits for observation without replay or duplicate bookkeeping",async()=>{
 const h=fixture({uncertain:true});await assert.rejects(h.ctx.backgroundMusicStart(),e=>e===h.error);assert.equal(h.recovery.attempts,1);assert.equal(h.recovery.awaitingUntil,130000);assert.equal(h.recovery.retryAt,115000);assert.equal(h.calls.filter(x=>x==="player_queues/play_media").length,1);
});
test("each later recovery request advances the bounded backoff exactly once",async()=>{
 const h=fixture();await assert.rejects(h.ctx.backgroundMusicStart({recover:true}));await assert.rejects(h.ctx.backgroundMusicStart({recover:true}));assert.equal(h.recovery.attempts,2);assert.equal(h.recovery.retryAt,130000);assert.equal(h.calls.filter(x=>x==="player_queues/play_media").length,2);
});
test("readiness rejection still records one failure and sends no playback command",async()=>{
 const h=fixture({stage:"unavailable"});await assert.rejects(h.ctx.backgroundMusicStart(),/unavailable/);assert.equal(h.recovery.attempts,1);assert.equal(h.recovery.retryAt,115000);assert.equal(h.calls.length,0);
});
test("pre-play control failure retains one current recovery transition",async()=>{
 const h=fixture({stage:"volume"});await assert.rejects(h.ctx.backgroundMusicStart(),/fixture rejected/);assert.equal(h.recovery.attempts,1);assert.equal(h.recovery.awaitingUntil,0);assert.equal(h.calls.includes("player_queues/play_media"),false);
});
test("a retired start failure leaves successor recovery untouched",async()=>{
 const h=fixture();h.ctx.musicAssistantCommand=async command=>{if(command==="player_queues/play_media"){h.r.sessionGeneration++;h.recovery.reset();throw h.error}};
 await assert.rejects(h.ctx.backgroundMusicStart(),/fixture rejected/);assert.equal(h.recovery.attempts,0);assert.equal(h.recovery.retryAt,0);assert.equal(h.recovery.state,"idle");
});
