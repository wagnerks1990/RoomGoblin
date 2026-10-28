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
  updateStateFromCommand:(command,ids)=>{calls.push({type:"state",ids:[...ids],commandId:command.id,commandType:command.type});const failing=controls.clearFailure&&controls.failType===command.type;if(failing&&!controls.failAfterState)throw Error("fixture clear failure");if(["display.clear","display.web"].includes(command.type))for(const id of ids)displays[id].audioContentId=command.id;if(failing)throw Error("fixture clear failure")},
  broadcastDisplays:ids=>{calls.push({type:"websocket",ids:[...ids]});controls.afterBroadcast?.();return ids},broadcastDisplayPreviews:()=>{},broadcastControllers:()=>{},
  MQTT_JSON_BRIDGE:true,MQTT_LEGACY_BRIDGE:true,runtime:{mqtt:{connected:true}},devices:{},cleanId:String,toLegacyCommand:()=>"clear",
  mqttPublish:async(topic)=>{calls.push({type:"mqtt",topic});if(controls.publish)await controls.publish(topic)},
  backgroundMusicObserveDisplayCommand:command=>calls.push({type:"observe",ids:[...command.target]}),backgroundMusicReconcilePriority:async()=>{if(controls.priorityFailure)throw Error("fixture priority failure")},backgroundMusicTick:async()=>calls.push({type:"music"}),
  consumeDeferredAnnouncementAutomations:()=>calls.push({type:"bookkeeping"}),resyncCurrentDisplayAutomationsAfterAnnouncements:async()=>{calls.push({type:"resync"});if(controls.resyncFailure)throw Error("fixture resync failure");return {winnerCount:0,results:[]}},diagnosticError:()=>{},audit:()=>{}});
 for(const name of ["assertMorningAnnouncements","executeCommand","serializeMorningAnnouncementsLifecycle","setMorningAnnouncementPriorityTargets","queueMorningAnnouncementsReleaseTargets","clearMorningAnnouncementsReleaseTargets","scheduleMorningAnnouncementsReleaseRetry","releaseMorningAnnouncements"])vm.runInContext(extract(name),ctx);
 return {ctx,state,holds,pending,displays,timers,calls,controls,async fire(){assert.ok(timers.length);timers.shift().fn();await ctx.morningAnnouncementsLifecycle;await Promise.resolve()},async successor(id="new"){displays[id]={audioContentId:"announcement-b"};state.active=true;state.targets=[id];await ctx.setMorningAnnouncementPriorityTargets([id],true)}};
}
function audioFixture(){const h=fixture();h.state.live=true;h.tracked=[];h.ctx.trackFullExportMutation=p=>{h.tracked.push(p);return p};vm.runInContext(extract("scheduleAnnouncementAudioRetries"),h.ctx);vm.runInContext(extract("applyMorningAnnouncementVolume"),h.ctx);return h}
async function fireAudio(h,timers=h.timers){for(const t of timers)t.fn();await Promise.all(h.tracked)}
function audioStates(h){return h.calls.filter(c=>c.type==="state"&&c.commandType==="display.web.audio")}
test("adding a receiver preserves needed delayed audio for the continuing receiver",async()=>{
 const h=audioFixture();await h.ctx.assertMorningAnnouncements({targetsOverride:["old"]});h.displays.new={audioContentId:"other-content"};await h.ctx.assertMorningAnnouncements({targetsOverride:["new"]});await fireAudio(h);assert.deepEqual([...new Set(audioStates(h).flatMap(c=>c.ids))].sort(),["new","old"]);
});
test("partial addition preserves delayed audio for an untouched continuing receiver",async()=>{
 const h=audioFixture();await h.ctx.assertMorningAnnouncements({targetsOverride:["old"]});h.displays.new={audioContentId:"other-content"};h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["new"]}));await fireAudio(h,h.timers.slice(0,4));assert.equal(audioStates(h).length,4);assert.ok(audioStates(h).every(c=>c.ids.length===1&&c.ids[0]==="old"));
});
test("same-lifecycle content replacement retires the previous content audio retry",async()=>{
 const h=audioFixture();await h.ctx.assertMorningAnnouncements();h.displays.old.audioContentId="new-operator-content";await fireAudio(h);assert.equal(audioStates(h).length,0);
});
test("same-target takeover retires prior content retries and keeps the new retries",async()=>{
 const h=audioFixture();await h.ctx.assertMorningAnnouncements();await h.ctx.assertMorningAnnouncements();await fireAudio(h,h.timers.slice(0,4));assert.equal(audioStates(h).length,0);await fireAudio(h,h.timers.slice(4));assert.equal(audioStates(h).length,4);
});
test("audio ownership is rechecked after asynchronous router admission",async()=>{
 const h=audioFixture();await h.ctx.assertMorningAnnouncements();const count=h.calls.length;h.controls.beforeDispatch=async()=>{h.displays.old.audioContentId="new-video"};await fireAudio(h,[h.timers[0]]);assert.equal(h.calls.slice(count).some(c=>["state","websocket","mqtt","observe"].includes(c.type)),false);
});
test("audio dispatch filters changed targets independently after admission",async()=>{
 const h=audioFixture();h.displays.new={audioContentId:"other"};await h.ctx.assertMorningAnnouncements({targetsOverride:["old","new"]});h.controls.beforeDispatch=async()=>{h.displays.new.audioContentId="new-video"};await fireAudio(h,[h.timers[0]]);assert.deepEqual(audioStates(h)[0].ids,["old"]);assert.equal(h.displays.new.audioContentId,"new-video");
});
test("replacement after audio WebSocket delivery blocks remaining transports and observation",async()=>{
 const h=audioFixture();await h.ctx.assertMorningAnnouncements();const count=h.calls.length;h.controls.afterBroadcast=()=>{h.displays.old.audioContentId="new-video"};await fireAudio(h,[h.timers[0]]);assert.equal(h.calls.slice(count).some(c=>c.type==="mqtt"||c.type==="observe"),false);
});
test("replacement during audio MQTT delivery blocks later legacy writes and observation",async()=>{
 const h=audioFixture();await h.ctx.assertMorningAnnouncements();const count=h.calls.length;h.controls.publish=async()=>{h.displays.old.audioContentId="new-video"};await fireAudio(h,[h.timers[0]]);assert.equal(h.calls.slice(count).filter(c=>c.type==="mqtt").length,1);assert.equal(h.calls.slice(count).some(c=>c.type==="observe"),false);
});
test("a second target changed during audio delivery receives no later transport writes",async()=>{
 const h=audioFixture();h.displays.new={audioContentId:"other"};await h.ctx.assertMorningAnnouncements({targetsOverride:["old","new"]});const count=h.calls.length;h.controls.publish=async()=>{h.displays.new.audioContentId="new-video"};await fireAudio(h,[h.timers[0]]);assert.deepEqual(h.calls.slice(count).filter(c=>c.type==="mqtt").map(c=>c.topic),["classroom/v2/display/old/command","classroom/old"]);assert.deepEqual(h.calls.at(-1).ids,["old"]);
});
test("removed or no-longer-owned receivers do not receive delayed audio",async()=>{
 for(const removed of [true,false]){const h=audioFixture();await h.ctx.assertMorningAnnouncements();if(removed)delete h.displays.old;else h.state.targets=[];await fireAudio(h);assert.equal(audioStates(h).length,0)}
});
test("live volume excludes replacement content while preserving active announcement targets",async()=>{
 const h=audioFixture();h.displays.old.media={type:"web",contentKind:"morning-announcements"};h.displays.new={audioContentId:"operator-web",media:{type:"web"}};h.state.targets.push("new");const r=await h.ctx.applyMorningAnnouncementVolume();assert.equal(r.applied,true);assert.deepEqual([...r.targets],["old"]);assert.deepEqual(audioStates(h)[0].ids,["old"]);
});
test("live volume reports no application after all content changed during admission",async()=>{
 const h=audioFixture();h.displays.old.media={type:"web",contentKind:"morning-announcements"};h.controls.beforeDispatch=async()=>{h.displays.old.audioContentId="new-video"};const r=await h.ctx.applyMorningAnnouncementVolume();assert.equal(r.applied,false);assert.equal(r.targets.length,0);assert.equal(audioStates(h).length,0);
});
test("live volume with no announcement content leaves the active lifecycle unchanged",async()=>{
 const h=audioFixture();h.displays.old.media={type:"web"};const r=await h.ctx.applyMorningAnnouncementVolume();assert.equal(r.active,true);assert.equal(r.applied,false);assert.equal(h.state.active,true);assert.equal(h.calls.length,0);
});
test("conditional audio rejects other sources or unrelated audio kinds",async()=>{
 const h=audioFixture(),options={expectedDisplayContent:new Map([["old",["announcement-a"]]])};await assert.rejects(h.ctx.executeCommand({type:"display.web.audio",target:["old"],payload:{contentKind:"morning-announcements"}},"http",options),/only supported/);await assert.rejects(h.ctx.executeCommand({type:"display.web.audio",target:["old"],payload:{}},"morning-announcements",options),/only supported/);assert.equal(h.calls.length,0);
});
test("conditional audio never expands a selected legacy alias to classroom broadcast",async()=>{
 const h=audioFixture();h.displays.old.media={type:"web",contentKind:"morning-announcements"};h.ctx.devices.old={legacyTopic:"classroom/all"};await assert.rejects(h.ctx.applyMorningAnnouncementVolume(),/shared legacy broadcast/);assert.equal(h.calls.some(c=>c.topic==="classroom/all"),false);
});
