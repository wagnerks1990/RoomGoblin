"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
function extract(name){const a=source.search(new RegExp("(?:async )?function "+name+"\\(")),b=source.indexOf("\n}",a);assert.ok(a>0&&b>a,name);return source.slice(a,b+2)}
function fixture(){
 const state={active:true,mode:"automatic",targets:["old"]},holds=new Set(["old"]),pending=new Map(),displays={old:{audioContentId:"announcement-a"}},timers=[],calls=[],controls={resyncFailure:false,clearFailure:false,failAfterState:false,beforeDispatch:null,afterBroadcast:null,publish:null,priorityFailure:false,failType:"display.clear"};let serial=0;
 const ctx=vm.createContext({Date,Map,Set,Promise,morningAnnouncements:{volumePercent:50},announcementTargets:()=>["old"],automationDisplayTargets:ids=>ids,announcementsPlaybackUrl:()=>"https://stream.example.test/play",validateMorningAnnouncementsUrl:value=>value,scheduleAnnouncementAudioRetries:()=>calls.push({type:"audioRetry"}),URL_BEARING_DISPLAY_COMMANDS:new Set(),morningAnnouncementsRuntime:state,morningAnnouncementsPriorityTargets:holds,morningAnnouncementsReleaseTargets:pending,
  persistentState:{displays},shutdownRequested:false,fullExportFreeze:{requested:false},morningAnnouncementsReleaseRetryTimer:null,morningAnnouncementsLifecycle:Promise.resolve(),morningAnnouncementsLifecycleBusy:0,
  commandId:()=>"clear-"+(++serial),setTimeout:fn=>{const t={fn,unref(){}};timers.push(t);return t},
  normalizeCommand:(command,source)=>({...command,source,payload:command.payload||{},id:command.id||"command-"+(++serial)}),validateCommandForDispatch:value=>value,
  engageManualMediaPriority:async()=>{if(controls.beforeDispatch)await controls.beforeDispatch();return null},resolveDisplayTargets:ids=>(Array.isArray(ids)?ids:[ids]).filter(id=>displays[id]),announcementPriorityError:()=>null,
  updateStateFromCommand:(command,ids)=>{calls.push({type:"state",ids:[...ids],commandId:command.id});const failing=controls.clearFailure&&controls.failType===command.type;if(failing&&!controls.failAfterState)throw Error("fixture clear failure");for(const id of ids)displays[id].audioContentId=command.id;if(failing)throw Error("fixture clear failure")},
  broadcastDisplays:ids=>{calls.push({type:"websocket",ids:[...ids]});controls.afterBroadcast?.();return ids},broadcastDisplayPreviews:()=>{},broadcastControllers:()=>{},
  MQTT_JSON_BRIDGE:true,MQTT_LEGACY_BRIDGE:true,runtime:{mqtt:{connected:true}},devices:{},cleanId:String,toLegacyCommand:()=>"clear",
  mqttPublish:async(topic)=>{calls.push({type:"mqtt",topic});if(controls.publish)await controls.publish(topic)},
  backgroundMusicObserveDisplayCommand:command=>calls.push({type:"observe",ids:[...command.target]}),backgroundMusicReconcilePriority:async()=>{if(controls.priorityFailure)throw Error("fixture priority failure")},backgroundMusicTick:async()=>calls.push({type:"music"}),
  consumeDeferredAnnouncementAutomations:()=>calls.push({type:"bookkeeping"}),resyncCurrentDisplayAutomationsAfterAnnouncements:async()=>{calls.push({type:"resync"});if(controls.resyncFailure)throw Error("fixture resync failure");return {winnerCount:0,results:[]}},diagnosticError:()=>{},audit:()=>{}});
 for(const name of ["assertMorningAnnouncements","executeCommand","serializeMorningAnnouncementsLifecycle","setMorningAnnouncementPriorityTargets","queueMorningAnnouncementsReleaseTargets","clearMorningAnnouncementsReleaseTargets","scheduleMorningAnnouncementsReleaseRetry","releaseMorningAnnouncements"])vm.runInContext(extract(name),ctx);
 return {ctx,state,holds,pending,displays,timers,calls,controls,async fire(){assert.ok(timers.length);timers.shift().fn();await ctx.morningAnnouncementsLifecycle;await Promise.resolve()},async successor(id="new"){displays[id]={audioContentId:"announcement-b"};state.active=true;state.targets=[id];await ctx.setMorningAnnouncementPriorityTargets([id],true)}};
}
function fresh(){const h=fixture();h.state.active=false;h.state.mode=null;h.state.targets=[];h.holds.clear();h.displays.old.audioContentId="original-video";return h}
test("an explicit empty target override never falls back to configured receivers",async()=>{
 const h=fresh();await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:[]}),/target/i);assert.equal(h.calls.length,0);assert.equal(h.state.active,false);
});
test("an explicit unknown target override reports that no receiver resolved",async()=>{
 const h=fresh();h.ctx.automationDisplayTargets=ids=>ids.filter(id=>h.displays[id]);await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["missing"]}),/target/i);assert.equal(h.calls.length,0);
});
for(const target of ["old","new"])test("failed replacement before dispatch preserves the existing session when selecting "+target,async()=>{
 const h=fixture(),targets=h.state.targets;h.displays.new={audioContentId:"other-content"};h.state.lastAssertAt=123;h.state.lastLiveAt="prior-live";h.controls.clearFailure=true;
 await assert.rejects(h.ctx.assertMorningAnnouncements({mode:"manual",targetsOverride:[target]}),/clear/);assert.equal(h.state.active,true);assert.equal(h.state.mode,"automatic");assert.equal(h.state.targets,targets);assert.equal(h.state.lastAssertAt,123);assert.equal(h.state.lastLiveAt,"prior-live");assert.deepEqual([...h.holds],["old"]);assert.equal(h.displays.old.audioContentId,"announcement-a");assert.equal(h.displays.new.audioContentId,"other-content");assert.equal(h.pending.size,0);
});
test("automatic start with no configured receivers remains a no-op",async()=>{
 const h=fresh();h.ctx.announcementTargets=()=>[];await h.ctx.assertMorningAnnouncements();assert.equal(h.calls.length,0);assert.equal(h.holds.size,0);
});
test("a valid explicit selection dispatches only its selected receiver",async()=>{
 const h=fresh();h.displays.new={audioContentId:"other-content"};await h.ctx.assertMorningAnnouncements({targetsOverride:["new"]});assert.equal(h.displays.old.audioContentId,"original-video");assert.deepEqual([...h.state.targets],["new"]);assert.deepEqual([...h.holds],["new"]);
});
test("a successful replacement keeps its new session identity and mode",async()=>{
 const h=fixture(),targets=h.state.targets;await h.ctx.assertMorningAnnouncements({mode:"manual",targetsOverride:["old"]});assert.equal(h.state.active,true);assert.equal(h.state.mode,"manual");assert.notEqual(h.state.targets,targets);assert.notEqual(h.displays.old.audioContentId,"announcement-a");assert.equal(h.pending.size,0);
});
test("a partial replacement does not falsely restore the overwritten prior session",async()=>{
 const h=fixture(),targets=h.state.targets;h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements(),/clear/);assert.equal(h.state.active,false);assert.notEqual(h.state.targets,targets);assert.equal(h.pending.size,1);assert.equal(h.holds.has("old"),true);
});
