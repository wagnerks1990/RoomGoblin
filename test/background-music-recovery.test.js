"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {PlaybackRecovery,mediaSelection,sleepDeadline}=require("../src/background-music");
const player=(elapsed,state="playing",extra={})=>({found:true,available:true,playing:state==="playing",paused:state==="paused",player:{elapsed_time:elapsed,current_media:{title:"Music",duration:180},...extra}});

test("acknowledged playback waits for confirmation, then backs off reloads",()=>{
 let now=1000;const recovery=new PlaybackRecovery({now:()=>now});recovery.requested();
 assert.equal(recovery.observe(player(0,"idle")).action,"wait");
 now+=21000;assert.equal(recovery.observe(player(0,"idle")).action,"reload");
 recovery.requested();recovery.failed();now+=20000;assert.equal(recovery.observe(player(0,"idle")).action,"wait");
 now+=11000;assert.equal(recovery.observe(player(0,"idle")).action,"reload");
});
test("missing and unavailable players never receive a restart decision",()=>{
 const recovery=new PlaybackRecovery();
 for(const state of [null,{found:false}, {...player(10),available:false}])assert.equal(recovery.observe(state).action,"wait");
 assert.equal(recovery.state,"waiting");
});
test("stalled reported playback is distinguished from absent progress telemetry",()=>{
 let now=1000;const recovery=new PlaybackRecovery({now:()=>now});recovery.observe(player(30));now+=121000;
 assert.equal(recovery.observe(player(30)).action,"resume");assert.equal(recovery.state,"stalled");
 recovery.requested();assert.equal(recovery.observe(player(30)).action,"wait");
 assert.equal(recovery.observe(player(31)).action,"none");
 const unknown=new PlaybackRecovery({now:()=>now});unknown.observe(player(null));now+=1000000;assert.equal(unknown.observe(player(null)).action,"none");
});
test("normal track completion does not restart a manual song, while a radio interruption recovers",()=>{
 let now=1000;const recovery=new PlaybackRecovery({now:()=>now});recovery.observe(player(179));now+=2000;
 assert.equal(recovery.observe(player(null,"idle",{current_media:null}),{finiteTrack:true}).action,"complete");
 recovery.reset();recovery.observe(player(179));now+=2000;assert.equal(recovery.observe(player(180,"idle"),{finiteTrack:false}).action,"wait");now+=9000;assert.equal(recovery.observe(player(180,"idle")).action,"resume");
});

test("unchanged Music Assistant position anchors keep playing beyond the stall timeout",()=>{
 let now=1800000000000;const started=now,recovery=new PlaybackRecovery({now:()=>now});
 const actual=player(12,"playing",{elapsed_time_last_updated:now/1000,current_media:{uri:"demo://radio/1",duration:0}});
 for(let i=0;i<=120;i++){
  now=started+i*8000;assert.equal(recovery.observe(actual).action,"none");
 }
 assert.equal(recovery.state,"playing");assert.equal(recovery.lastElapsed,972);
 assert.equal(recovery.snapshot().lastProgressAt,started,"clock interpolation must not claim new reported progress");
 assert.match(recovery.reason,/estimated/);
});

test("fresh timestamps reporting a frozen position still trigger bounded recovery",()=>{
 let now=1800000000000;const recovery=new PlaybackRecovery({now:()=>now});
 const actual=()=>player(30,"playing",{elapsed_time_last_updated:now/1000});
 recovery.observe(actual());now+=121000;
 assert.equal(recovery.observe(actual()).action,"resume");assert.equal(recovery.state,"stalled");
 recovery.requested();assert.equal(recovery.observe(actual()).action,"wait");
 now+=21000;assert.equal(recovery.observe(actual()).action,"reload");
});

test("invalid anchors retain raw-progress detection and missing elapsed remains unknown",()=>{
 for(const anchor of [undefined,null,0,-1,NaN,Infinity,"bad",true]){
  let now=1800000000000;const recovery=new PlaybackRecovery({now:()=>now});
  const actual=player(30,"playing",{elapsed_time_last_updated:anchor});
  recovery.observe(actual);now+=121000;assert.equal(recovery.observe(actual).action,"resume",String(anchor));
 }
 let now=1800000000000;const recovery=new PlaybackRecovery({now:()=>now});
 const actual=player(null,"playing",{elapsed_time_last_updated:now/1000});
 recovery.observe(actual);now+=121000;assert.equal(recovery.observe(actual).action,"none");
 assert.equal(recovery.snapshot().lastProgressAt,null);assert.doesNotMatch(recovery.reason,/estimated|confirmed/);
});

test("anchored playback still recovers a stopped radio and respects finite completion",()=>{
 let now=1800000000000;const started=now,recovery=new PlaybackRecovery({now:()=>now});
 const actual=player(0,"playing",{elapsed_time_last_updated:started/1000});
 recovery.observe(actual);now+=179000;recovery.observe(actual);now+=1000;
 assert.equal(recovery.observe(player(null,"idle",{current_media:null}),{finiteTrack:true}).action,"complete");
 recovery.reset();recovery.observe(actual);now+=1000;
 assert.equal(recovery.observe(player(0,"paused",{elapsed_time_last_updated:started/1000})).action,"wait");
 now+=9000;assert.equal(recovery.observe(player(0,"paused",{elapsed_time_last_updated:started/1000})).action,"resume");
 const paused=new PlaybackRecovery({now:()=>now});
 assert.equal(paused.observe(player(0,"paused",{elapsed_time_last_updated:started/1000}),{finiteTrack:true}).action,"wait","paused time must not be extrapolated into track completion");
});
test("recovery attempts reset only after sustained reported playback",()=>{
 let now=1000;const recovery=new PlaybackRecovery({now:()=>now});recovery.requested();recovery.observe(player(10));assert.equal(recovery.attempts,1);
 now+=31000;recovery.observe(player(41));assert.equal(recovery.attempts,0);
});
test("media selections and sleep deadlines reject unsafe or unbounded values",()=>{
 assert.equal(mediaSelection({uri:"provider://track/1",name:"Song",mediaType:"track"}).mediaType,"track");
 for(const uri of ["javascript://evil","data://bad","file:///etc/passwd","https://user:pass@example.test/radio","x".repeat(2001)])assert.throws(()=>mediaSelection({uri}));
 assert.equal(sleepDeadline(15,1000),901000);assert.equal(sleepDeadline(0),null);
 for(const n of [-1,241,NaN,1.5])assert.throws(()=>sleepDeadline(n));
});

const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
test("real Background Music routes share explicit read/write quotas and save a changed schedule",async t=>{
 const express=require("express"),{rateLimit}=require("express-rate-limit"),app=express();app.use(express.json());
 let authorized=0,ticks=0;const saved=[],audits=[],favorites=[];
 const prior={enabled:false,playerId:"old-output",favoriteId:"station"};
 const ctx=vm.createContext({app,rateLimit,requireControl:(_q,_r,next)=>{authorized++;next()},
  maApiGeneration:0,backgroundMusicRuntime:{sessionGeneration:0,activePlayerId:"old-output",playing:true},backgroundMusicRecovery:{snapshot:()=>({})},
  backgroundMusicSchedule:()=>prior,normalizeBackgroundMusicSchedule:body=>body,
  backgroundMusicActualPlayerState:async()=>({found:true,playing:false}),backgroundMusicFavorites:()=>favorites,
  backgroundMusicPriorityState:()=>({}),backgroundMusicPlayerProbe:{},
  backgroundMusicStop:async reason=>{assert.equal(reason,"schedule-identity-changed")},
  dbStore:{setPreference:(key,value)=>saved.push({key,value})},audit:event=>audits.push(event),
  backgroundMusicTick:async()=>{ticks++}});
 const start=source.indexOf("// Appliance-wide budgets keep polling separate"),end=source.indexOf('app.get("/api/v1/music-assistant/status"',start);
 vm.runInContext(source.slice(start,end),ctx);
 const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const base=`http://127.0.0.1:${server.address().port}/api/v1/music-assistant/background`;
 const schedule=await fetch(base+"/schedule",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({enabled:true,playerId:"new-output",favoriteId:"station"})});
 assert.equal(schedule.status,200);assert.equal((await schedule.json()).ok,true);assert.equal(ticks,1);
 assert.equal(ctx.backgroundMusicRuntime.manualStopped,false);assert.equal(saved[0].value.playerId,"new-output");assert.equal(audits[0].kind,"musicassistant.background.schedule.update");
 for(let i=0;i<29;i++){const response=await fetch(base+"/favorites/missing",{method:"DELETE"});assert.equal(response.status,200);await response.text()}
 const before=authorized,limited=await fetch(base+"/control",{method:"POST",headers:{"content-type":"application/json"},body:'{"action":"pause"}'});
 assert.equal(limited.status,429);assert.ok(limited.headers.get("retry-after"));await limited.text();assert.equal(authorized,before);
 for(let i=0;i<120;i++){const response=await fetch(base);assert.equal(response.status,200);await response.text()}
 const readLimited=await fetch(base);assert.equal(readLimited.status,429);await readLimited.text();
});
function extract(name){const at=source.indexOf(`async function ${name}(`);assert.ok(at>=0,name);return source.slice(at,Math.min(...[source.indexOf("\nasync function ",at+1),source.indexOf("\nfunction ",at+1),source.indexOf("\napp.",at+1),source.indexOf("\nconst ",at+1)].filter(n=>n>=0)))}
function runtime(){
 const commands=[],r={playing:true,paused:false,manualSession:true,manualStopped:false,startedKey:"today",activePlayerId:"apollo",activeMedia:{uri:"radio://station/1",name:"Station",mediaType:"radio"},sessionGeneration:0},recovery=new PlaybackRecovery(),ctx=vm.createContext({Date,shutdownRequested:false,fullExportFreeze:{requested:false},backgroundMusicTickBusy:false,backgroundMusicStartBusy:false,backgroundMusicRuntime:r,backgroundMusicRecovery:recovery,backgroundMusicSchedule:()=>({enabled:false,playerId:"other",favoriteId:"default"}),backgroundMusicWindowActive:()=>false,backgroundMusicWindowKey:()=>"today",backgroundMusicPriorityBlocked:()=>false,backgroundMusicActualPlayerState:async cfg=>{assert.equal(cfg.playerId,"apollo");return {found:false}},backgroundMusicPlayerProbe:{},musicAssistantCommand:async(command,args)=>{commands.push({command,args})},diagnosticError:()=>{},backgroundMusicStop:async()=>{commands.push({command:"stop"})}});
 vm.runInContext(extract("backgroundMusicTick"),ctx);return {ctx,r,recovery,commands};
}
test("real tick observes a manual output outside schedule and clears a stale playing flag when it disappears",async()=>{
 const {ctx,r,commands}=runtime();await ctx.backgroundMusicTick();assert.equal(r.playing,false);assert.equal(r.recovery.state,"waiting");assert.equal(commands.length,0);
});

test("real tick never resumes or reloads healthy timestamp-anchored playback",async()=>{
 let now=1800000000000;const {ctx,r,commands}=runtime(),started=now;
 const recovery=new PlaybackRecovery({now:()=>now});ctx.backgroundMusicRecovery=recovery;
 ctx.backgroundMusicActualPlayerState=async()=>player(12,"playing",{elapsed_time_last_updated:started/1000});
 ctx.backgroundMusicResume=async()=>commands.push({command:"resume"});
 ctx.backgroundMusicStart=async()=>commands.push({command:"reload"});
 for(let i=0;i<=120;i++){now=started+i*8000;await ctx.backgroundMusicTick()}
 assert.equal(commands.length,0);assert.equal(r.playing,true);assert.equal(r.recovery.state,"playing");
});
test("real tick never recovers after manual stop or during priority audio",async()=>{
 const {ctx,r,commands}=runtime();r.manualStopped=true;await ctx.backgroundMusicTick();assert.equal(commands.length,0);
 r.manualStopped=false;ctx.backgroundMusicPriorityBlocked=()=>true;let reconciled=0;ctx.backgroundMusicReconcilePriority=async()=>{reconciled++};await ctx.backgroundMusicTick();assert.equal(reconciled,1);assert.equal(commands.length,0);
});
test("real sleep deadline stops the owned session and prevents immediate scheduled restart",async()=>{
 const {ctx,r,commands}=runtime();r.sleepUntil=Date.now()-100;await ctx.backgroundMusicTick();assert.equal(commands[0].command,"stop");assert.equal(r.manualStopped,true);
});

function startRuntime(){
 const commands=[],r={sessionGeneration:0},ctx=vm.createContext({Date,mediaSelection,backgroundMusicStartBusy:false,backgroundMusicResumeBusy:false,backgroundMusicRuntime:r,backgroundMusicRecovery:new PlaybackRecovery(),backgroundMusicPlayerProbe:{at:10},backgroundMusicPriorityBlocked:()=>false,backgroundMusicSchedule:()=>({playerId:"apollo",favoriteId:"station",volume:25}),backgroundMusicFavoriteById:()=>({id:"station",uri:"demo://radio/1",name:"Radio",mediaType:"radio"}),backgroundMusicActualPlayerState:async()=>player(10),musicAssistantCommand:async(command,args)=>{commands.push({command,args});return null}});
 vm.runInContext(extract("backgroundMusicStart"),ctx);return {ctx,r,commands};
}
test("real start keeps the selected manual song and waits for confirmation instead of claiming it is playing",async()=>{
 const {ctx,r,commands}=startRuntime();await ctx.backgroundMusicStart({uri:"demo://track/2",name:"Song",mediaType:"track"});
 assert.equal(r.activeMedia.uri,"demo://track/2");assert.equal(r.manualSession,true);assert.equal(r.playing,false);assert.equal(r.activePlayerId,"apollo");assert.equal(commands.at(-1).args.media,"demo://track/2");
});
test("real start sends no mutation to an unavailable player or during priority audio",async()=>{
 const {ctx,commands}=startRuntime();ctx.backgroundMusicActualPlayerState=async()=>({found:true,available:false});await assert.rejects(()=>ctx.backgroundMusicStart(),/unavailable/);assert.equal(commands.length,0);
 ctx.backgroundMusicPriorityBlocked=()=>true;await assert.rejects(()=>ctx.backgroundMusicStart(),/priority audio/);assert.equal(commands.length,0);
});
test("recovery reload preserves volume and a priority takeover during a submitted play is paused",async()=>{
 const {ctx,commands}=startRuntime();let priority=false;ctx.backgroundMusicPriorityBlocked=()=>priority;
 ctx.musicAssistantCommand=async(command,args)=>{commands.push({command,args});if(command==="player_queues/play_media")priority=true};
 await ctx.backgroundMusicStart({recover:true});assert.deepEqual(commands.map(c=>c.command),["player_queues/play_media","players/cmd/pause"]);
});
test("an operator stop while play is pending is reasserted after the late acknowledgement",async()=>{
 const {ctx,r,commands}=startRuntime();ctx.musicAssistantCommand=async(command,args)=>{commands.push({command,args});if(command==="player_queues/play_media"){r.sessionGeneration++;r.manualStopped=true;r.activePlayerId=null}};
 await ctx.backgroundMusicStart();assert.equal(commands.at(-1).command,"players/cmd/stop");assert.equal(r.manualStopped,true);
});
test("real resume reasserts priority or Stop if ownership changes during its command",async()=>{
 for(const mode of ["priority","stop"]){
  const {ctx,r,commands}=startRuntime();r.activePlayerId="apollo";let priority=false;ctx.backgroundMusicPriorityBlocked=()=>priority;
  ctx.musicAssistantCommand=async(command,args)=>{commands.push({command,args});if(command==="players/cmd/play"){r.sessionGeneration++;if(mode==="priority")priority=true;else{r.manualStopped=true;r.activePlayerId=null}}};
  vm.runInContext(extract("backgroundMusicResume"),ctx);await ctx.backgroundMusicResume();assert.deepEqual(commands.map(c=>c.command),["players/cmd/play",mode==="priority"?"players/cmd/pause":"players/cmd/stop"]);
 }
});
test("resume is single-flight and uncertain failures wait before another attempt",async()=>{
 const {ctx,r,commands}=startRuntime();r.activePlayerId="apollo";let release;
 ctx.musicAssistantCommand=async(command,args)=>{commands.push({command,args});await new Promise(resolve=>{release=resolve})};vm.runInContext(extract("backgroundMusicResume"),ctx);
 const pending=ctx.backgroundMusicResume();assert.equal(await ctx.backgroundMusicResume(),false);assert.equal(commands.length,1);release();await pending;
 ctx.musicAssistantCommand=async()=>{const error=Error("Response lost");error.mayHaveExecuted=true;throw error};await assert.rejects(()=>ctx.backgroundMusicResume(),/Response lost/);
 assert.ok(ctx.backgroundMusicRecovery.awaitingUntil>Date.now()+20000);assert.equal(ctx.backgroundMusicRecovery.state,"retrying");
});

test("real queue route projects bounded safe metadata and priority blocks playback commands",async t=>{
 const express=require("express"),app=express();app.use(express.json());const calls=[];
 const ctx=vm.createContext({app,maApiGeneration:0,releaseMusicAssistantTvAudioWrite:write=>assert.equal(write,null),musicAssistantStatusLimit:(_q,_r,next)=>next(),musicAssistantMutationLimit:(_q,_r,next)=>next(),requireControl:(_q,_r,next)=>next(),backgroundMusicRuntime:{activePlayerId:"speaker"},backgroundMusicSchedule:()=>({}),backgroundMusicPriorityBlocked:()=>true,
  musicAssistantCommand:async(command,args)=>{calls.push({command,args});return command==="player_queues/get_active_queue"?{queue_id:"speaker",state:"playing",current_index:0,current_item:{name:"Song",duration:180,stream_details:{url:"private-fixture-stream"}}}:Array.from({length:70},(_,i)=>({queue_item_id:String(i),name:`Song ${i}`,stream_details:{url:"private-fixture-stream"}}))}});
 const start=source.indexOf('app.get("/api/v1/music-assistant/background/queue"'),end=source.indexOf("\nconst musicAssistantProxyTickets",start);vm.runInContext(source.slice(start,end),ctx);
 const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(base+"/api/v1/music-assistant/background/queue?playerId=speaker"),data=await response.json();assert.equal(response.status,200);assert.equal(data.items.length,50);assert.ok(!JSON.stringify(data).includes("private-fixture-stream"));
 const prior=calls.length,blocked=await fetch(base+"/api/v1/music-assistant/command",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({command:"player_queues/next",args:{queue_id:"speaker"}})});assert.equal(blocked.status,409);await blocked.text();assert.equal(calls.length,prior);
});
