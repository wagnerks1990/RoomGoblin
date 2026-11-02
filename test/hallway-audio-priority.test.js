"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),{createRequire}=require("node:module");
const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
function extract(name){
  const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start>=0,name);
  const end=source.indexOf("\n}",start);
  return source.slice(start,end+2);
}
function fixture(){
  const commands=[],audits=[],r={playing:true,activePlayerId:"speaker",pausedForPriority:false,manualStopped:false};
  const ctx=vm.createContext({
    require:createRequire(require.resolve("../src/server")),Date,
    displayAudio:require("../src/display-audio"),persistentState:{displays:{}},
    devices:{room:{},hall:{audioScope:"independent"}},
    sportsRuntime:{service:{read:()=>({boards:[{id:"sports"}]})}},
    resolveDisplayTargets:target=>Array.isArray(target)?target:[target],
    backgroundMusicPriorityTargets:new Set(),morningAnnouncementsPriorityTargets:new Set(),backgroundMusicRuntime:r,
    morningAnnouncementsRuntime:{active:false,releaseReconcilePending:false,targets:[]},
    manualMediaPriorityRuntime:{active:false,targets:new Set(),pausedPlayers:new Set()},
    backgroundMusicSchedule:()=>({pauseForPriorityAudio:true,playerId:"speaker"}),
    backgroundMusicActualPlayerState:async()=>({playing:r.playing}),
    backgroundMusicRecovery:{retryAt:0,awaitingUntil:0},
    backgroundMusicPause:async()=>{commands.push("pause");r.playing=false;r.paused=true},
    backgroundMusicResume:async()=>{commands.push("resume");r.playing=true;r.pausedForPriority=false},
    automationSchedulerEnabled:true,
    setAutomationSchedulerEnabled:value=>{ctx.automationSchedulerEnabled=value;commands.push("scheduler:"+value)},
    pauseActiveAutomationRunsForManualMedia:()=>{commands.push("cancel-runs");return []},
    pausePlayingMusicAssistantPlayersForManualMedia:async()=>{commands.push("pause-players");return {}},
    trackFullExportMutation:task=>Promise.resolve(task),audit:event=>audits.push(event),diagnosticError:()=>{},
  });
  // Execute the actual dispatch and reconciliation functions, not a parallel model.
  vm.runInContext(source.slice(source.indexOf("function displaySharesRoomAudio("),source.indexOf("function publicDeviceConfig(")),ctx);
  for(const name of ["backgroundMusicPriorityState","backgroundMusicPriorityBlocked","backgroundMusicReconcilePriority","manualMediaPriorityCommand","engageManualMediaPriority","backgroundMusicObserveDisplayCommand","setMorningAnnouncementPriorityTargets"])vm.runInContext(extract(name),ctx);
  return {ctx,r,commands,audits};
}
const sports={type:"display.text",payload:{scene:{layers:[{type:"widget",widget:"sports-board",sportsBoardId:"sports",sportsAudio:true,sportsVolume:75}]}}};

test("hallway Sports is audible without claiming room music priority; mixed targets still pause",async()=>{
  const {ctx,commands}=fixture();
  ctx.backgroundMusicObserveDisplayCommand({...sports,target:["hall"]},"automation");
  await ctx.backgroundMusicReconcilePriority();
  assert.equal(ctx.backgroundMusicPriorityBlocked(),false);
  assert.deepEqual([...ctx.backgroundMusicPriorityState().independentTargets],["hall"]);
  assert.deepEqual(commands,[]);
  ctx.backgroundMusicObserveDisplayCommand({...sports,target:["hall","room"]},"automation");
  await ctx.backgroundMusicReconcilePriority();
  assert.deepEqual([...ctx.backgroundMusicPriorityState().targets],["room"]);
  assert.ok(commands.includes("pause"));
  ctx.backgroundMusicObserveDisplayCommand({type:"display.image",target:["room"],payload:{}},"automation");
  await ctx.backgroundMusicReconcilePriority();
  assert.ok(commands.includes("resume"));
});

test("manual hallway-only video/web/voice/SFX never pauses other players or the room scheduler",async()=>{
  for(const command of [{type:"display.video"},{type:"display.web",payload:{forceAudio:true}},{type:"voice.speak"},{type:"sfx.play"}]){
    const {ctx,commands}=fixture();
    assert.equal(await ctx.engageManualMediaPriority({...command,target:["hall"]},"http"),null);
    assert.equal(ctx.automationSchedulerEnabled,true);
    assert.equal(ctx.manualMediaPriorityRuntime.active,false);
    assert.deepEqual(commands,[]);
  }
});

test("mixed manual media retains classroom takeover and only records classroom ownership",async()=>{
  const {ctx,commands}=fixture();
  const result=await ctx.engageManualMediaPriority({type:"display.video",target:["hall","room"]},"media-library");
  await result.audioTask;
  assert.equal(ctx.automationSchedulerEnabled,false);
  assert.deepEqual([...ctx.manualMediaPriorityRuntime.targets],["room"]);
  assert.ok(commands.includes("pause-players"));assert.ok(commands.includes("cancel-runs"));
});

test("Morning Announcements and release reconciliation retain mandatory hallway priority",async()=>{
  const {ctx,commands}=fixture();ctx.backgroundMusicSchedule=()=>({pauseForPriorityAudio:false});
  Object.assign(ctx.morningAnnouncementsRuntime,{active:true,targets:["hall"]});
  await ctx.setMorningAnnouncementPriorityTargets(["hall"],true);
  assert.equal(ctx.backgroundMusicPriorityBlocked(),true);assert.ok(commands.includes("pause"));
  Object.assign(ctx.morningAnnouncementsRuntime,{active:false,releaseReconcilePending:true});
  assert.equal(ctx.backgroundMusicPriorityBlocked(),true);
  ctx.morningAnnouncementsRuntime.releaseReconcilePending=false;
  await ctx.setMorningAnnouncementPriorityTargets(["hall"],false);
  assert.ok(commands.includes("resume"));
});

test("changing receiver scope releases an existing scene without replay, but respects manual Stop",async()=>{
  for(const stopped of [false,true]){
    const {ctx,r,commands}=fixture();ctx.devices.hall.audioScope="room";
    ctx.backgroundMusicObserveDisplayCommand({...sports,target:["hall"]},"automation");
    await ctx.backgroundMusicReconcilePriority();assert.ok(commands.includes("pause"));
    r.manualStopped=stopped;ctx.devices.hall.audioScope="independent";
    await ctx.backgroundMusicReconcilePriority();assert.equal(commands.includes("resume"),!stopped);
    ctx.devices.hall.audioScope="room";assert.equal(ctx.backgroundMusicPriorityBlocked(),true);
  }
});

test("legacy and unknown scope stay shared; scope changes do not cancel an existing manual takeover",()=>{
  const {ctx}=fixture();ctx.devices.room.audioScope="invalid";
  ctx.backgroundMusicPriorityTargets.add("room");assert.equal(ctx.backgroundMusicPriorityBlocked(),true);
  ctx.backgroundMusicPriorityTargets.clear();ctx.backgroundMusicPriorityTargets.add("hall");
  Object.assign(ctx.manualMediaPriorityRuntime,{active:true,targets:new Set(["hall"])});
  assert.equal(ctx.backgroundMusicPriorityBlocked(),true);
});


test("live Sports audio releases and reacquires room priority while hallway controls stay independent",async()=>{
  const {ctx,r,commands}=fixture();
  const state=muted=>({textOptions:{scene:{layers:[{type:"widget",widget:"sports-board",sportsBoardId:"sports",sportsVolume:.5,sportsAudio:!muted}]}}});
  for(const id of ["hall","room"]){
    ctx.persistentState.displays[id]=state(false);
    ctx.backgroundMusicObserveDisplayCommand({type:"display.audio.control",target:[id]},"controller");
    await ctx.backgroundMusicReconcilePriority();
    assert.equal(ctx.backgroundMusicPriorityBlocked(),id==="room");
  }
  assert.ok(commands.includes("pause"));
  ctx.persistentState.displays.room=state(true);
  ctx.backgroundMusicObserveDisplayCommand({type:"display.audio.control",target:["room"]},"controller");
  await ctx.backgroundMusicReconcilePriority();assert.ok(commands.includes("resume"));
  r.manualStopped=true;ctx.persistentState.displays.room=state(false);
  ctx.backgroundMusicObserveDisplayCommand({type:"display.audio.control",target:["room"]},"controller");
  await ctx.backgroundMusicReconcilePriority();commands.length=0;
  ctx.persistentState.displays.room=state(true);
  ctx.backgroundMusicObserveDisplayCommand({type:"display.audio.control",target:["room"]},"controller");
  await ctx.backgroundMusicReconcilePriority();assert.equal(commands.includes("resume"),false);
});
