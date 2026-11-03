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

test("resuming a selected queue transfers priority ownership without changing its media or volume",async()=>{
 const h=fixture();h.r.sleepUntil=123;
 await h.ctx.backgroundMusicResume("manual","B");
 assert.equal(h.r.activePlayerId,"B");assert.equal(h.r.queueOnly,true);assert.equal(h.r.manualSession,true);
 assert.equal(h.r.activeMedia,null);assert.equal(h.r.activeFavoriteId,null);assert.equal(h.r.sleepUntil,null);
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls.filter(x=>x.command))),[
  {command:"players/cmd/stop",args:{player_id:"A"}}, {command:"players/cmd/play",args:{player_id:"B"}}
 ]);
 h.calls.length=0;h.ctx.backgroundMusicPriorityState=()=>({active:true});h.ctx.backgroundMusicPriorityBlocked=()=>true;
 await h.ctx.backgroundMusicReconcilePriority({force:true});
 assert.equal(h.calls[0].args.player_id,"B");assert.equal(h.calls[0].command,"players/cmd/pause");assert.equal(h.r.pausedForPriority,true);
 h.calls.length=0;h.ctx.backgroundMusicPriorityState=()=>({active:false});h.ctx.backgroundMusicPriorityBlocked=()=>false;
 await h.ctx.backgroundMusicReconcilePriority({force:true});
 assert.equal(h.calls.at(-1).args.player_id,"B");assert.equal(h.calls.at(-1).command,"players/cmd/play");assert.equal(h.r.queueOnly,true);
});

test("resuming an unowned configured output adopts its queue without stopping another player",async()=>{
 const h=fixture();Object.assign(h.r,{activePlayerId:null,manualSession:false,manualStopped:true});
 await h.ctx.backgroundMusicResume("manual","A");
 assert.equal(h.r.activePlayerId,"A");assert.equal(h.r.queueOnly,true);assert.equal(h.r.manualStopped,false);
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls.filter(x=>x.command))),[{command:"players/cmd/play",args:{player_id:"A"}}]);
});

test("resuming the current managed source preserves recovery identity and sleep",async()=>{
 const h=fixture();h.r.sleepUntil=123;const media=h.r.activeMedia;
 await h.ctx.backgroundMusicResume("manual","A");
 assert.equal(h.r.activeMedia,media);assert.equal(h.r.sleepUntil,123);assert.notEqual(h.r.queueOnly,true);
 assert.equal(h.calls.filter(x=>x.command).length,1);
});

for(const actual of [null,{found:false},{found:true,available:false}])test(`unavailable selected queue preserves the prior managed output: ${JSON.stringify(actual)}`,async()=>{
 const h=fixture();h.ctx.backgroundMusicActualPlayerState=async()=>actual;
 await assert.rejects(h.ctx.backgroundMusicResume("manual","B"),/unavailable/);
 assert.equal(h.r.activePlayerId,"A");assert.equal(h.calls.some(x=>x.command),false);assert.equal(h.calls.includes("recovery-failed"),false);
});

for(const change of ["stop","priority","successor"])test(`queue adoption rechecks ${change} after player lookup`,async()=>{
 const h=fixture(),d=deferred();h.ctx.backgroundMusicActualPlayerState=()=>d.promise;
 const pending=h.ctx.backgroundMusicResume("manual","B"),rejected=assert.rejects(pending,/playback changed/);
 if(change==="stop"){h.r.manualStopped=true;await h.ctx.backgroundMusicStop()}
 if(change==="priority")h.ctx.backgroundMusicPriorityBlocked=()=>true;
 if(change==="successor")h.successor("C");
 const expected=JSON.stringify(h.r);h.calls.length=0;d.resolve({found:true,available:true});await rejected;
 assert.equal(JSON.stringify(h.r),expected);assert.equal(h.calls.some(x=>x.command),false);assert.equal(h.calls.includes("recovery-failed"),false);
});

test("late queue Play acknowledges an intervening manual Stop with another Stop",async()=>{
 const h=fixture(),d=deferred(),entered=deferred();
 h.ctx.musicAssistantCommand=async(command,args)=>{h.calls.push({command,args});if(command==="players/cmd/play"){entered.resolve();await d.promise}};
 const pending=h.ctx.backgroundMusicResume("manual","B");await entered.promise;
 h.r.manualStopped=true;await h.ctx.backgroundMusicStop();d.resolve();await pending;
 assert.equal(h.r.activePlayerId,null);assert.equal(h.calls.at(-1).command,"players/cmd/stop");assert.equal(h.calls.at(-1).args.player_id,"B");
});

for(const action of ["resume","reload"])test(`existing queue watchdog never replaces or replays media on ${action}`,async()=>{
 const h=fixture();Object.assign(h.r,{queueOnly:true,activeMedia:null});h.recovery.observe=()=>({action});
 h.ctx.backgroundMusicActualPlayerState=async()=>({found:true,available:true,playing:false,paused:false});
 await h.ctx.backgroundMusicTick();
 assert.equal(h.calls.some(x=>x.command),false);assert.equal(h.r.activePlayerId,"A");assert.equal(h.recovery.state,"idle");
 assert.match(h.recovery.reason,/queue/i);
});

for(const helper of ["backgroundMusicStop","backgroundMusicStart"])test(`${helper} clears existing-queue mode`,async()=>{
 const h=fixture();h.r.queueOnly=true;await h.ctx[helper]();assert.equal(h.r.queueOnly,false);
});

test("a successor while the old output stops prevents queue adoption",async()=>{
 const h=fixture(),d=deferred(),entered=deferred();
 h.ctx.musicAssistantCommand=async(command,args)=>{h.calls.push({command,args});entered.resolve();await d.promise};
 const pending=h.ctx.backgroundMusicResume("manual","B"),rejected=assert.rejects(pending,/playback changed/);
 await entered.promise;h.successor("C");const expected=JSON.stringify(h.r);d.resolve();await rejected;
 assert.equal(JSON.stringify(h.r),expected);assert.equal(h.calls.filter(x=>x.command).length,1);
});

test("an uncertain queue resume remains owned for priority and is not replayed by the watchdog",async()=>{
 const h=fixture();h.ctx.musicAssistantCommand=async command=>{if(command==="players/cmd/play"){const e=Error("Response lost");e.mayHaveExecuted=true;throw e}};
 await assert.rejects(h.ctx.backgroundMusicResume("manual","B"),/Response lost/);
 assert.equal(h.r.activePlayerId,"B");assert.equal(h.r.queueOnly,true);assert.equal(h.r.lastError,"Response lost");
 h.recovery.observe=()=>({action:"reload"});h.ctx.backgroundMusicActualPlayerState=async()=>({found:true,available:true,playing:false});
 h.calls.length=0;await h.ctx.backgroundMusicTick();assert.equal(h.calls.some(x=>x.command),false);
});

test("the real control route selects queue ownership and retries only its existing queue",async()=>{
 const h=fixture();let handler;
 Object.assign(h.ctx,{app:{post(path,...handlers){assert.equal(path,"/api/v1/music-assistant/background/control");handler=handlers.at(-1)}},musicAssistantMutationLimit(){},requireControl(){}});
 const start=source.indexOf('app.post("/api/v1/music-assistant/background/control"'),end=source.indexOf('app.get("/api/v1/music-assistant/status"',start);assert.ok(end>start);
 vm.runInContext(source.slice(start,end),h.ctx);
 const result={},res={status(code){result.status=code;return this},json(body){result.body=body;return this}};
 await handler({body:{action:"resume",playerId:"B"}},res);
 assert.equal(result.body.ok,true);assert.equal(h.r.activePlayerId,"B");assert.equal(h.r.queueOnly,true);
 h.r.manualStopped=true;h.calls.length=0;await handler({body:{action:"retry"}},res);
 assert.equal(result.body.ok,true);assert.equal(h.r.manualStopped,false);
 assert.deepEqual(JSON.parse(JSON.stringify(h.calls.filter(x=>x.command))),[{command:"players/cmd/play",args:{player_id:"B"}}]);
 h.r.manualStopped=true;h.ctx.backgroundMusicActualPlayerState=async()=>null;h.calls.length=0;
 await handler({body:{action:"resume",playerId:"C"}},res);
 assert.equal(result.status,502);assert.equal(result.body.ok,false);assert.equal(h.r.manualStopped,true);assert.equal(h.r.activePlayerId,"B");
 assert.equal(h.calls.some(x=>x.command),false);
});

test("a track boundary in an existing queue retains priority ownership without replay",async()=>{
 const h=fixture();let now=10000,playing=true,elapsed=99;
 h.ctx.backgroundMusicRecovery=new (require("../src/background-music").PlaybackRecovery)({now:()=>now});
 Object.assign(h.r,{queueOnly:true,activeMedia:null});
 h.ctx.backgroundMusicActualPlayerState=async()=>({found:true,available:true,playing,player:{elapsed_time:elapsed,current_media:{uri:"demo://track/1",duration:100}}});
 await h.ctx.backgroundMusicTick();playing=false;elapsed=100;now+=10000;await h.ctx.backgroundMusicTick();now+=10000;await h.ctx.backgroundMusicTick();
 assert.equal(h.r.manualStopped,false);assert.equal(h.r.manualSession,true);assert.equal(h.r.activePlayerId,"A");
 assert.equal(h.calls.some(x=>x.command),false);
 playing=true;elapsed=1;now+=10000;await h.ctx.backgroundMusicTick();assert.equal(h.r.playing,true);assert.equal(h.r.queueOnly,true);
});
