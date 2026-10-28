"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require.resolve("../src/server.js"),"utf8");
function extract(name){const a=source.indexOf("async function "+name+"("),b=source.indexOf("\n}",a);assert.ok(a>0&&b>a);return source.slice(a,b+2)}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function fixture(){const calls=[],cfg={playerId:"A",favoriteId:"station",volume:20,pauseForPriorityAudio:true},r={sessionGeneration:0,playing:true,paused:false,pausedForPriority:false,activePlayerId:"A",activeMedia:{uri:"radio://A"},manualSession:true,manualStopped:false,startedKey:"today",lastError:null},recovery={awaitingUntil:0,retryAt:0,requested(){calls.push("requested")},failed(){calls.push("recovery-failed")},reset(){calls.push("recovery-reset")},observe(){calls.push("observed");return {action:"none"}},snapshot(){return {}}},ctx=vm.createContext({Date,backgroundMusicRuntime:r,backgroundMusicRecovery:recovery,backgroundMusicSchedule:()=>cfg,backgroundMusicFavoriteById:()=>({id:"station",uri:"radio://A"}),mediaSelection:value=>value,backgroundMusicActualPlayerState:async()=>({found:true,available:true,playing:true}),backgroundMusicPriorityBlocked:()=>false,backgroundMusicPriorityState:()=>({active:false}),backgroundMusicResumeBusy:false,backgroundMusicStartBusy:false,backgroundMusicTickBusy:false,shutdownRequested:false,fullExportFreeze:{requested:false},backgroundMusicWindowActive:()=>false,backgroundMusicWindowKey:()=>"today",backgroundMusicPlayerProbe:{at:12},diagnosticError(){},musicAssistantCommand:async(c,args)=>{calls.push({command:c,args})}});
for(const n of ["backgroundMusicPause","backgroundMusicStop","backgroundMusicResume","backgroundMusicStart","backgroundMusicReconcilePriority","backgroundMusicTick"])vm.runInContext(extract(n),ctx);
return {ctx,r,calls,recovery,cfg,successor(playerId="B"){Object.assign(r,{sessionGeneration:r.sessionGeneration+1,playing:true,paused:false,pausedForPriority:false,activePlayerId:playerId,activeMedia:{uri:"radio://"+playerId},manualSession:true,lastAction:"new-play",lastError:null})}}}
for(const name of ["backgroundMusicPause","backgroundMusicStop"])test(`late ${name} does not overwrite the successor session`,async()=>{const h=fixture(),d=deferred();h.ctx.musicAssistantCommand=()=>d.promise;const p=h.ctx[name]();h.successor();const expected=JSON.stringify(h.r);d.resolve();await p;assert.equal(JSON.stringify(h.r),expected);});
test("late resume failure does not change successor error or recovery",async()=>{const h=fixture(),d=deferred();h.ctx.musicAssistantCommand=()=>d.promise;const p=h.ctx.backgroundMusicResume(),rejected=assert.rejects(p,/old error/);h.successor();d.reject(Error("old error"));await rejected;assert.equal(h.r.lastError,null);assert.equal(h.calls.includes("recovery-failed"),false);});
test("priority ending during a player probe does not trigger the old pause",async()=>{const h=fixture(),d=deferred();let priority=true;h.r.playing=false;h.ctx.backgroundMusicPriorityState=()=>({active:priority});h.ctx.backgroundMusicActualPlayerState=()=>d.promise;const p=h.ctx.backgroundMusicReconcilePriority({force:true});priority=false;d.resolve({playing:true});await p;assert.equal(h.calls.filter(x=>x.command).length,0);});
test("an old player probe cannot mark a successor as missing",async()=>{const h=fixture(),d=deferred();h.ctx.backgroundMusicActualPlayerState=()=>d.promise;const p=h.ctx.backgroundMusicTick();h.successor();d.resolve({found:false});await p;assert.equal(h.r.playing,true);assert.equal(h.r.lastError,null);});

for(const name of ["backgroundMusicPause","backgroundMusicStop"])test(`late ${name} preserves a successor on the same player`,async()=>{
 const h=fixture(),d=deferred();h.ctx.musicAssistantCommand=()=>d.promise;const p=h.ctx[name]();h.successor("A");const expected=JSON.stringify(h.r);d.resolve();assert.equal(await p,false);assert.equal(JSON.stringify(h.r),expected);
});
test("current pause updates its own state and clears recovery waits",async()=>{
 const h=fixture();h.recovery.awaitingUntil=100;h.recovery.retryAt=100;assert.equal(await h.ctx.backgroundMusicPause(),true);assert.equal(h.r.paused,true);assert.equal(h.r.playing,false);assert.equal(h.recovery.awaitingUntil,0);assert.equal(h.recovery.retryAt,0);assert.equal(h.calls[0].args.player_id,"A");
});
test("current stop clears its own managed source and recovery",async()=>{
 const h=fixture();h.r.sleepUntil=100;assert.equal(await h.ctx.backgroundMusicStop(),true);assert.equal(h.r.activePlayerId,null);assert.equal(h.r.activeMedia,null);assert.equal(h.r.sleepUntil,null);assert.equal(h.r.manualSession,false);assert.equal(h.calls.filter(x=>x==="recovery-reset").length,1);
});
for(const name of ["backgroundMusicPause","backgroundMusicStop"])test(`${name} ignores completion after an idle configured output changes`,async()=>{
 const h=fixture(),d=deferred();h.r.activePlayerId=null;h.ctx.musicAssistantCommand=()=>d.promise;const p=h.ctx[name]();h.cfg.playerId="B";const expected=JSON.stringify(h.r);d.resolve();assert.equal(await p,false);assert.equal(JSON.stringify(h.r),expected);
});
for(const name of ["backgroundMusicPause","backgroundMusicStop"])test(`current ${name} failure remains visible without success state`,async()=>{
 const h=fixture();h.ctx.musicAssistantCommand=async()=>{throw Error("current failure")};await assert.rejects(h.ctx[name](),/current failure/);assert.equal(h.r.playing,true);assert.equal(h.r.activePlayerId,"A");assert.equal(h.calls.includes("recovery-reset"),false);
});
test("current resume error retains recovery feedback and releases single flight",async()=>{
 const h=fixture();h.ctx.musicAssistantCommand=async()=>{throw Error("current failure")};await assert.rejects(h.ctx.backgroundMusicResume(),/current failure/);assert.equal(h.r.lastError,"current failure");assert.equal(h.calls.includes("recovery-failed"),true);assert.equal(h.ctx.backgroundMusicResumeBusy,false);
});
test("start retired during its probe leaves the successor recovery untouched",async()=>{
 const h=fixture(),d=deferred();h.ctx.backgroundMusicActualPlayerState=()=>d.promise;const p=h.ctx.backgroundMusicStart(),rejected=assert.rejects(p,/playback changed/);h.successor();d.resolve({found:true,available:true});await rejected;assert.equal(h.calls.includes("recovery-failed"),false);assert.equal(h.calls.some(x=>x.command),false);assert.equal(h.r.activePlayerId,"B");
});
test("late start delivery failure does not change successor recovery",async()=>{
 const h=fixture(),d=deferred(),entered=deferred();h.ctx.musicAssistantCommand=async c=>{if(c==="player_queues/play_media"){entered.resolve();return d.promise}};const p=h.ctx.backgroundMusicStart(),rejected=assert.rejects(p,/old play failure/);await entered.promise;h.successor();h.calls.length=0;d.reject(Error("old play failure"));await rejected;assert.equal(h.calls.includes("recovery-failed"),false);assert.equal(h.r.lastError,null);assert.equal(h.r.activePlayerId,"B");assert.equal(h.ctx.backgroundMusicStartBusy,false);
});
test("priority probe completion cannot change or pause a successor",async()=>{
 const h=fixture(),d=deferred();h.r.playing=false;h.ctx.backgroundMusicPriorityState=()=>({active:true});h.ctx.backgroundMusicActualPlayerState=()=>d.promise;const p=h.ctx.backgroundMusicReconcilePriority({force:true});h.successor();d.resolve({playing:true});await p;assert.equal(h.calls.some(x=>x.command),false);assert.equal(h.r.lastAction,"new-play");
});
test("priority reconciliation probes the active output before pausing after restart",async()=>{
 const h=fixture();h.r.activePlayerId="B";h.r.playing=false;h.ctx.backgroundMusicPriorityState=()=>({active:true});let probes=0;h.ctx.backgroundMusicActualPlayerState=async(cfg,force)=>{probes++;assert.equal(cfg.playerId,"B");assert.equal(force,true);return {playing:true}};await h.ctx.backgroundMusicReconcilePriority({force:true});assert.equal(probes,1);assert.equal(h.calls[0].command,"players/cmd/pause");assert.equal(h.calls[0].args.player_id,"B");assert.equal(h.r.pausedForPriority,true);
});
test("a late priority pause cannot mark the successor priority-paused",async()=>{
 const h=fixture(),d=deferred();h.ctx.backgroundMusicPriorityState=()=>({active:true});h.ctx.musicAssistantCommand=()=>d.promise;const p=h.ctx.backgroundMusicReconcilePriority({force:true});h.successor();d.resolve();await p;assert.equal(h.r.pausedForPriority,false);assert.equal(h.r.playing,true);
});
test("priority ending during its accepted pause still permits later resume",async()=>{
 const h=fixture(),d=deferred();let priority=true;h.ctx.backgroundMusicPriorityState=()=>({active:priority});h.ctx.musicAssistantCommand=()=>d.promise;const p=h.ctx.backgroundMusicReconcilePriority({force:true});priority=false;d.resolve();await p;assert.equal(h.r.pausedForPriority,true);h.ctx.musicAssistantCommand=async c=>h.calls.push({command:c});await h.ctx.backgroundMusicReconcilePriority({force:true});assert.equal(h.calls.at(-1).command,"players/cmd/play");assert.equal(h.r.pausedForPriority,false);
});
for(const stale of [true,false])test(`priority pause error belongs to ${stale?"retired":"current"} session`,async()=>{
 const h=fixture(),d=deferred();h.ctx.backgroundMusicPriorityState=()=>({active:true});h.ctx.musicAssistantCommand=()=>d.promise;const p=h.ctx.backgroundMusicReconcilePriority({force:true});if(stale)h.successor();d.reject(Error("pause failed"));await p;assert.equal(h.r.lastError,stale?null:"pause failed");
});
test("old same-player probe cannot overwrite a new session's playing state",async()=>{
 const h=fixture(),d=deferred();h.ctx.backgroundMusicActualPlayerState=()=>d.promise;const p=h.ctx.backgroundMusicTick();h.successor("A");d.resolve({found:true,available:true,playing:false,paused:true});await p;assert.equal(h.r.playing,true);assert.equal(h.r.paused,false);assert.equal(h.calls.includes("observed"),false);
});
test("priority arriving during a tick probe is reconciled before recovery observation",async()=>{
 const h=fixture(),d=deferred();let priority=false;h.ctx.backgroundMusicPriorityState=()=>({active:priority});h.ctx.backgroundMusicPriorityBlocked=()=>priority;h.ctx.backgroundMusicActualPlayerState=()=>d.promise;const p=h.ctx.backgroundMusicTick();priority=true;d.resolve({found:true,available:true,playing:true});await p;assert.equal(h.calls.includes("observed"),false);assert.equal(h.r.pausedForPriority,true);assert.equal(h.calls[0].command,"players/cmd/pause");
});
test("an obsolete tick probe error does not replace the successor error state",async()=>{
 const h=fixture(),d=deferred();h.ctx.backgroundMusicActualPlayerState=()=>d.promise;const p=h.ctx.backgroundMusicTick();h.successor();d.reject(Error("old probe failed"));await p;assert.equal(h.r.lastError,null);assert.equal(h.ctx.backgroundMusicTickBusy,false);
});
for(const reason of ["sleep","schedule-end"])test(`late ${reason} stop completion preserves successor intent`,async()=>{
 const h=fixture(),d=deferred();if(reason==="sleep")h.r.sleepUntil=Date.now()-1;else{h.r.manualSession=false;h.r.scheduleActive=true}h.ctx.musicAssistantCommand=()=>d.promise;const p=h.ctx.backgroundMusicTick();h.successor();h.r.startedKey="new-window";d.resolve();await p;assert.equal(h.r.manualStopped,false);assert.equal(h.r.startedKey,"new-window");assert.equal(h.r.activePlayerId,"B");
});
test("late recovery resume cannot overwrite the successor action",async()=>{
 const h=fixture(),d=deferred(),entered=deferred();h.recovery.observe=()=>({action:"resume"});h.ctx.musicAssistantCommand=()=>{entered.resolve();return d.promise};const p=h.ctx.backgroundMusicTick();await entered.promise;h.successor();d.resolve();await p;assert.equal(h.r.lastAction,"new-play");assert.equal(h.r.activePlayerId,"B");
});
test("late recovery start failure cannot change the successor error or backoff",async()=>{
 const h=fixture(),d=deferred(),entered=deferred();h.recovery.observe=()=>({action:"reload"});h.ctx.musicAssistantCommand=async c=>{if(c==="player_queues/play_media"){entered.resolve();return d.promise}};const p=h.ctx.backgroundMusicTick();await entered.promise;h.successor();h.calls.length=0;d.reject(Error("old recovery failed"));await p;assert.equal(h.r.lastError,null);assert.equal(h.calls.includes("recovery-failed"),false);
});
