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
test("a fresh start failing before dispatch leaves prior content unchanged",async()=>{
 const h=fresh();h.controls.clearFailure=true;await assert.rejects(h.ctx.assertMorningAnnouncements(),/clear/);assert.equal(h.displays.old.audioContentId,"original-video");assert.equal(h.holds.size,0);assert.equal(h.pending.size,0);assert.equal(h.timers.length,0);
});
for(const type of ["display.clear","display.web"])test("a failed start cleans up its owned "+type+" state before releasing music",async()=>{
 const h=fresh();h.controls.clearFailure=true;h.controls.failType=type;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements(),/clear/);
 assert.equal(h.state.active,false);assert.equal(h.holds.has("old"),true);assert.equal(h.pending.size,1);assert.equal(h.state.releaseReconcilePending,true);assert.equal(h.timers.length,1);
 h.controls.clearFailure=false;await h.fire();assert.equal(h.pending.size,0);assert.equal(h.holds.size,0);assert.equal(h.calls.at(-1).type,"music");
});
test("a failed priority pause does not leave partially started announcement content unmanaged",async()=>{
 const h=fresh();h.controls.priorityFailure=true;await assert.rejects(h.ctx.assertMorningAnnouncements(),/priority/);assert.equal(h.holds.has("old"),true);assert.equal(h.pending.size,1);assert.equal(h.timers.length,1);
 h.controls.priorityFailure=false;await h.fire();assert.equal(h.holds.size,0);assert.equal(h.pending.size,0);
});
for(const target of ["old","new"])test("a failed start retains older pending ownership on "+target,async()=>{
 const h=fixture();h.controls.resyncFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/resync/);if(target==="new")h.displays.new={audioContentId:"original-video"};
 h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:[target]}),/clear/);assert.equal(h.holds.has("old"),true);assert.equal(h.holds.has(target),true);assert.equal(h.timers.length,1);
 h.controls.clearFailure=false;h.controls.resyncFailure=false;await h.fire();assert.equal(h.holds.size,0);assert.equal(h.pending.size,0);
});
test("an invalid replacement URL leaves the active announcement untouched",async()=>{
 const h=fixture(),targets=h.state.targets;h.ctx.validateMorningAnnouncementsUrl=()=>{throw Error("fixture invalid URL")};await assert.rejects(h.ctx.assertMorningAnnouncements(),/invalid URL/);assert.equal(h.state.active,true);assert.equal(h.state.targets,targets);assert.equal(h.holds.has("old"),true);assert.deepEqual(h.calls,[]);
});
test("a cleanup priority error does not hide the original start failure",async()=>{
 const h=fresh();h.controls.clearFailure=true;h.controls.priorityFailure=true;await assert.rejects(h.ctx.assertMorningAnnouncements(),/fixture clear failure/);assert.equal(h.state.active,false);assert.equal(h.displays.old.audioContentId,"original-video");
});
test("failed takeover cleanup excludes content replaced during delivery",async()=>{
 const h=fresh();h.controls.afterBroadcast=()=>{h.displays.old.audioContentId="newer-video";throw Error("fixture delivery failure")};
 await assert.rejects(h.ctx.assertMorningAnnouncements(),/delivery failure/);assert.equal(h.displays.old.audioContentId,"newer-video");assert.equal(h.pending.size,0);assert.equal(h.holds.size,0);assert.equal(h.timers.length,0);
});
test("partial takeover cleanup retains only the targets it still owns",async()=>{
 const h=fresh();h.displays.new={audioContentId:"original-video"};h.controls.afterBroadcast=()=>{h.displays.old.audioContentId="newer-video";throw Error("fixture delivery failure")};
 await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["old","new"]}),/delivery failure/);assert.deepEqual([...h.pending.keys()],["new"]);assert.deepEqual([...h.holds],["new"]);
 h.controls.afterBroadcast=null;await h.fire();assert.equal(h.displays.old.audioContentId,"newer-video");assert.equal(h.pending.size,0);assert.equal(h.holds.size,0);
});
test("failure before a successor dispatch preserves older pending release ownership",async()=>{
 const h=fixture();h.controls.resyncFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/resync/);const original=h.pending.get("old");
 h.controls.clearFailure=true;await assert.rejects(h.ctx.assertMorningAnnouncements(),/clear/);assert.equal(h.pending.get("old"),original);assert.equal(h.holds.has("old"),true);assert.equal(h.timers.length,1);
 h.controls.clearFailure=false;h.controls.resyncFailure=false;await h.fire();assert.equal(h.pending.size,0);assert.equal(h.holds.size,0);
});
test("successful start keeps its hold and schedules audio without release cleanup",async()=>{
 const h=fresh();await h.ctx.assertMorningAnnouncements();assert.equal(h.state.active,true);assert.equal(h.holds.has("old"),true);assert.equal(h.pending.size,0);assert.equal(h.timers.length,0);assert.equal(h.calls.at(-1).type,"audioRetry");
 const ids=h.calls.filter(x=>x.type==="state").map(x=>x.commandId);assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);assert.equal(h.displays.old.audioContentId,ids[1]);
});
