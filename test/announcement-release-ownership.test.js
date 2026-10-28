"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
function extract(name){const a=source.search(new RegExp("(?:async )?function "+name+"\\(")),b=source.indexOf("\n}",a);assert.ok(a>0&&b>a,name);return source.slice(a,b+2)}
function fixture(){
 const state={active:true,mode:"automatic",targets:["old"]},holds=new Set(["old"]),pending=new Map(),displays={old:{audioContentId:"announcement-a"}},timers=[],calls=[],controls={resyncFailure:false,clearFailure:false,failAfterState:false,beforeDispatch:null,afterBroadcast:null,publish:null};let serial=0;
 const ctx=vm.createContext({Date,Map,Set,Promise,URL_BEARING_DISPLAY_COMMANDS:new Set(),morningAnnouncementsRuntime:state,morningAnnouncementsPriorityTargets:holds,morningAnnouncementsReleaseTargets:pending,
  persistentState:{displays},shutdownRequested:false,fullExportFreeze:{requested:false},morningAnnouncementsReleaseRetryTimer:null,morningAnnouncementsLifecycle:Promise.resolve(),morningAnnouncementsLifecycleBusy:0,
  commandId:()=>"clear-"+(++serial),setTimeout:fn=>{const t={fn,unref(){}};timers.push(t);return t},
  normalizeCommand:(command,source)=>({...command,source,payload:command.payload||{},id:command.id||"direct-clear"}),validateCommandForDispatch:value=>value,
  engageManualMediaPriority:async()=>{if(controls.beforeDispatch)await controls.beforeDispatch();return null},resolveDisplayTargets:ids=>(Array.isArray(ids)?ids:[ids]).filter(id=>displays[id]),announcementPriorityError:()=>null,
  updateStateFromCommand:(command,ids)=>{calls.push({type:"state",ids:[...ids],commandId:command.id});if(controls.clearFailure&&!controls.failAfterState)throw Error("fixture clear failure");for(const id of ids)displays[id].audioContentId=command.id;if(controls.clearFailure)throw Error("fixture clear failure")},
  broadcastDisplays:ids=>{calls.push({type:"websocket",ids:[...ids]});controls.afterBroadcast?.();return ids},broadcastDisplayPreviews:()=>{},broadcastControllers:()=>{},
  MQTT_JSON_BRIDGE:true,MQTT_LEGACY_BRIDGE:true,runtime:{mqtt:{connected:true}},devices:{},cleanId:String,toLegacyCommand:()=>"clear",
  mqttPublish:async(topic)=>{calls.push({type:"mqtt",topic});if(controls.publish)await controls.publish(topic)},
  backgroundMusicObserveDisplayCommand:command=>calls.push({type:"observe",ids:[...command.target]}),backgroundMusicReconcilePriority:async()=>{},backgroundMusicTick:async()=>calls.push({type:"music"}),
  consumeDeferredAnnouncementAutomations:()=>calls.push({type:"bookkeeping"}),resyncCurrentDisplayAutomationsAfterAnnouncements:async()=>{calls.push({type:"resync"});if(controls.resyncFailure)throw Error("fixture resync failure");return {winnerCount:0,results:[]}},diagnosticError:()=>{},audit:()=>{}});
 for(const name of ["executeCommand","serializeMorningAnnouncementsLifecycle","setMorningAnnouncementPriorityTargets","queueMorningAnnouncementsReleaseTargets","clearMorningAnnouncementsReleaseTargets","scheduleMorningAnnouncementsReleaseRetry","releaseMorningAnnouncements"])vm.runInContext(extract(name),ctx);
 return {ctx,state,holds,pending,displays,timers,calls,controls,async fire(){assert.ok(timers.length);timers.shift().fn();await ctx.morningAnnouncementsLifecycle;await Promise.resolve()},async successor(id="new"){displays[id]={audioContentId:"announcement-b"};state.active=true;state.targets=[id];await ctx.setMorningAnnouncementPriorityTargets([id],true)}};
}
test("successful successor release also retires an older failed reconciliation hold",async()=>{
 const h=fixture();h.controls.resyncFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/resync/);await h.successor();await h.fire();
 h.controls.resyncFailure=false;await h.ctx.releaseMorningAnnouncements();assert.equal(h.holds.size,0);assert.equal(h.pending.size,0);assert.equal(h.state.releaseReconcilePending,false);
});
test("a persistently failed clear keeps its hold through retry",async()=>{
 const h=fixture();h.controls.clearFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/clear/);await h.fire();
 assert.equal(h.holds.has("old"),true);assert.equal(h.state.releaseReconcilePending,true);assert.equal(h.timers.length,1);assert.equal(h.calls.filter(x=>x.type==="music").length,0);
});
for(const afterState of [false,true])test("clear retry succeeds after failure "+(afterState?"after":"before")+" state persistence",async()=>{
 const h=fixture();h.controls.clearFailure=true;h.controls.failAfterState=afterState;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/clear/);
 const id=h.pending.get("old").clearId;h.controls.clearFailure=false;await h.fire();assert.equal(h.displays.old.audioContentId,id);assert.equal(h.holds.size,0);assert.equal(h.pending.size,0);assert.equal(h.calls.at(-1).type,"music");
});
test("newer content replaces a pending clear without receiving a stale clear",async()=>{
 const h=fixture();h.controls.clearFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/clear/);h.displays.old.audioContentId="new-video";h.controls.clearFailure=false;h.calls.length=0;await h.fire();
 assert.equal(h.displays.old.audioContentId,"new-video");assert.equal(h.calls.some(x=>x.type==="websocket"||x.type==="mqtt"||x.type==="observe"),false);assert.equal(h.holds.size,0);
});
test("a successor on the same receiver owns the replacement clear",async()=>{
 const h=fixture();h.controls.clearFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/clear/);const oldId=h.pending.get("old").clearId;await h.successor("old");h.controls.clearFailure=false;await h.ctx.releaseMorningAnnouncements();
 assert.notEqual(h.displays.old.audioContentId,oldId);assert.equal(h.holds.size,0);assert.equal(h.pending.size,0);
});
test("an obsolete retry timer does not reconcile after a successor completed release",async()=>{
 const h=fixture();h.controls.resyncFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/resync/);await h.successor();h.controls.resyncFailure=false;await h.ctx.releaseMorningAnnouncements();h.calls.length=0;await h.fire();assert.deepEqual(h.calls,[]);
});
test("recovery freeze defers pending clears and resumes after thaw",async()=>{
 const h=fixture();h.controls.clearFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/clear/);h.controls.clearFailure=false;h.ctx.fullExportFreeze.requested=true;h.calls.length=0;await h.fire();assert.deepEqual(h.calls,[]);assert.equal(h.holds.size,1);assert.equal(h.timers.length,1);
 h.ctx.fullExportFreeze.requested=false;await h.fire();assert.equal(h.holds.size,0);
});
test("shutdown retires a pending release callback without dispatch",async()=>{
 const h=fixture();h.controls.clearFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/clear/);h.ctx.shutdownRequested=true;h.calls.length=0;await h.fire();assert.deepEqual(h.calls,[]);assert.equal(h.holds.size,1);assert.equal(h.timers.length,0);
});
test("removed receivers do not retain an impossible pending clear",async()=>{
 const h=fixture();h.controls.clearFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/clear/);delete h.displays.old;h.calls.length=0;await h.fire();assert.equal(h.calls.some(x=>x.type==="state"),false);assert.equal(h.holds.size,0);
});
test("conditional release checks ownership after an asynchronous router admission",async()=>{
 const h=fixture();h.controls.beforeDispatch=async()=>{h.displays.old.audioContentId="new-video"};await h.ctx.releaseMorningAnnouncements();assert.equal(h.displays.old.audioContentId,"new-video");assert.equal(h.calls.some(x=>x.type==="state"||x.type==="observe"),false);
});
test("conditional release filters changed targets individually",async()=>{
 const h=fixture();h.displays.other={audioContentId:"announcement-other"};h.state.targets.push("other");h.holds.add("other");h.controls.beforeDispatch=async()=>{h.displays.other.audioContentId="new-video"};await h.ctx.releaseMorningAnnouncements();
 assert.equal(h.displays.other.audioContentId,"new-video");assert.deepEqual(h.calls.find(x=>x.type==="websocket").ids,["old"]);
});
test("newer content during MQTT delivery prevents stale legacy writes and audio observation",async()=>{
 const h=fixture();h.controls.publish=async()=>{h.displays.old.audioContentId="new-video"};await h.ctx.releaseMorningAnnouncements();
 assert.equal(h.calls.filter(x=>x.type==="mqtt").length,1);assert.equal(h.calls.some(x=>x.type==="observe"),false);assert.equal(h.displays.old.audioContentId,"new-video");
});
test("newer content after WebSocket delivery prevents subsequent MQTT writes",async()=>{
 const h=fixture();h.controls.afterBroadcast=()=>{h.displays.old.audioContentId="new-video"};await h.ctx.releaseMorningAnnouncements();assert.equal(h.calls.some(x=>x.type==="mqtt"||x.type==="observe"),false);
});
test("ordinary clear commands retain normal dispatch and observation",async()=>{
 const h=fixture();await h.ctx.executeCommand({type:"display.clear",target:["old"],payload:{}},"api");assert.equal(h.calls.filter(x=>x.type==="mqtt").length,2);assert.equal(h.calls.at(-1).type,"observe");
});
test("conditional ownership cannot be used for an unrelated command source",async()=>{
 const h=fixture();await assert.rejects(h.ctx.executeCommand({type:"display.clear",target:["old"]},"http",{expectedDisplayContent:new Map()}),/only supported/);assert.deepEqual(h.calls,[]);
});
test("a changed second target is skipped between individual MQTT writes",async()=>{
 const h=fixture();h.displays.other={audioContentId:"announcement-other"};h.state.targets.push("other");h.holds.add("other");h.controls.publish=async()=>{h.displays.other.audioContentId="new-video"};await h.ctx.releaseMorningAnnouncements();
 assert.deepEqual(h.calls.filter(x=>x.type==="mqtt").map(x=>x.topic),["classroom/v2/display/old/command","classroom/old"]);assert.deepEqual(h.calls.find(x=>x.type==="observe").ids,["old"]);
});
test("a selected receiver's broadcast legacy alias fails closed without broadcasting",async()=>{
 const h=fixture();h.ctx.devices.old={legacyTopic:"classroom/all"};await assert.rejects(h.ctx.releaseMorningAnnouncements(),/shared legacy broadcast/);
 assert.equal(h.calls.some(x=>x.topic==="classroom/all"),false);assert.equal(h.holds.has("old"),true);assert.equal(h.state.releaseReconcilePending,true);
});
