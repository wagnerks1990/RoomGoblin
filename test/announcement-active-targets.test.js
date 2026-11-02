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
  updateStateFromCommand:(command,ids)=>{calls.push({type:"state",ids:[...ids],commandId:command.id});const failing=controls.clearFailure&&controls.failType===command.type;if(failing&&!controls.failAfterState)throw Error("fixture clear failure");if(["display.clear","display.web"].includes(command.type))for(const id of ids)displays[id].audioContentId=command.id;if(failing)throw Error("fixture clear failure")},
  broadcastDisplays:ids=>{calls.push({type:"websocket",ids:[...ids]});controls.afterBroadcast?.();return ids},broadcastDisplayPreviews:()=>{},broadcastControllers:()=>{},
  MQTT_JSON_BRIDGE:true,MQTT_LEGACY_BRIDGE:true,runtime:{mqtt:{connected:true}},devices:{},cleanId:String,toLegacyCommand:()=>"clear",
  mqttPublish:async(topic)=>{calls.push({type:"mqtt",topic});if(controls.publish)await controls.publish(topic)},
  backgroundMusicObserveDisplayCommand:command=>calls.push({type:"observe",ids:[...command.target]}),backgroundMusicReconcilePriority:async()=>{if(controls.priorityFailure)throw Error("fixture priority failure")},backgroundMusicTick:async()=>calls.push({type:"music"}),
  consumeDeferredAnnouncementAutomations:()=>calls.push({type:"bookkeeping"}),resyncCurrentDisplayAutomationsAfterAnnouncements:async()=>{calls.push({type:"resync"});if(controls.resyncFailure)throw Error("fixture resync failure");return {winnerCount:0,results:[]}},diagnosticError:()=>{},audit:()=>{}});
 for(const name of ["assertMorningAnnouncements","executeCommand","serializeMorningAnnouncementsLifecycle","setMorningAnnouncementPriorityTargets","queueMorningAnnouncementsReleaseTargets","clearMorningAnnouncementsReleaseTargets","scheduleMorningAnnouncementsReleaseRetry","releaseMorningAnnouncements"])vm.runInContext(extract(name),ctx);
 return {ctx,state,holds,pending,displays,timers,calls,controls,async fire(){assert.ok(timers.length);timers.shift().fn();await ctx.morningAnnouncementsLifecycle;await Promise.resolve()},async successor(id="new"){displays[id]={audioContentId:"announcement-b"};state.active=true;state.targets=[id];await ctx.setMorningAnnouncementPriorityTargets([id],true)}};
}
function fresh(){const h=fixture();h.state.active=false;h.state.mode=null;h.state.targets=[];h.holds.clear();h.displays.old.audioContentId="original-video";return h}
test("starting another selected receiver retains both active locks",async()=>{
 const h=fixture();h.displays.new={audioContentId:"other-video"};await h.ctx.assertMorningAnnouncements({mode:"manual",targetsOverride:["new"]});assert.deepEqual([...h.state.targets],["old","new"]);assert.equal(h.displays.old.audioContentId,"announcement-a");assert.ok(h.calls.filter(x=>x.type==="state").every(x=>x.ids.length===1&&x.ids[0]==="new"));
});
test("global Stop finishes every receiver after an additional selected start",async()=>{
 const h=fixture();h.displays.new={audioContentId:"other-video"};await h.ctx.assertMorningAnnouncements({mode:"manual",targetsOverride:["new"]});await h.ctx.releaseMorningAnnouncements();assert.equal(h.holds.size,0);assert.notEqual(h.displays.old.audioContentId,"announcement-a");assert.equal(h.pending.size,0);
});
test("partial failure on a new receiver retains the prior active lifecycle",async()=>{
 const h=fixture(),oldTargets=h.state.targets;h.displays.new={audioContentId:"other-video"};h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({mode:"manual",targetsOverride:["new"]}),/clear/);assert.equal(h.state.active,true);assert.equal(h.state.mode,"automatic");assert.deepEqual([...h.state.targets],["old","new"]);assert.notEqual(h.state.targets,oldTargets);assert.equal(h.displays.old.audioContentId,"announcement-a");assert.equal(h.pending.has("new"),true);
});
test("Stop can clean up a partial failed extension and its prior session",async()=>{
 const h=fixture();h.displays.new={audioContentId:"other-video"};h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["new"]}),/clear/);h.controls.clearFailure=false;await h.ctx.releaseMorningAnnouncements();assert.equal(h.state.active,false);assert.equal(h.holds.size,0);assert.equal(h.pending.size,0);assert.notEqual(h.displays.old.audioContentId,"announcement-a");
});
test("partial subset replacement retains untouched prior targets",async()=>{
 const h=fixture();h.displays.new={audioContentId:"announcement-b"};h.state.targets=["old","new"];h.holds.add("new");h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["new"]}),/clear/);assert.equal(h.state.active,true);assert.deepEqual([...h.state.targets],["old","new"]);assert.equal(h.displays.old.audioContentId,"announcement-a");assert.equal(h.holds.size,2);
});
test("pending cleanup cannot interrupt a continuing active session",async()=>{
 const h=fixture();h.displays.new={audioContentId:"other-video"};h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["new"]}),/clear/);h.controls.clearFailure=false;const count=h.calls.length;await h.fire();assert.equal(h.calls.length,count);assert.equal(h.state.active,true);assert.equal(h.pending.size,1);await h.ctx.releaseMorningAnnouncements("stream-ended");assert.equal(h.pending.size,0);assert.equal(h.holds.size,0);
});
test("a later global release includes older pending work and partial additions",async()=>{
 const h=fixture();h.controls.resyncFailure=true;await assert.rejects(h.ctx.releaseMorningAnnouncements(),/resync/);await h.successor("new");h.displays.third={audioContentId:"other-video"};h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["third"]}),/clear/);assert.deepEqual([...h.state.targets],["new","third"]);assert.equal(h.holds.size,3);
 h.controls.clearFailure=false;h.controls.resyncFailure=false;await h.ctx.releaseMorningAnnouncements();assert.equal(h.pending.size,0);assert.equal(h.holds.size,0);const count=h.calls.length;await h.fire();assert.equal(h.calls.length,count);
});
test("invalid selection and URL leave an extended session untouched",async()=>{
 const h=fixture();h.displays.new={audioContentId:"other-video"};await h.ctx.assertMorningAnnouncements({targetsOverride:["new"]});const targets=h.state.targets,count=h.calls.length;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:[]}),/target/);h.ctx.validateMorningAnnouncementsUrl=()=>{throw Error("invalid URL")};await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["old"]}),/invalid URL/);assert.equal(h.state.targets,targets);assert.equal(h.calls.length,count);assert.equal(h.holds.size,2);
});
test("a repeated same-target start keeps one owner per receiver",async()=>{
 const h=fixture();await h.ctx.assertMorningAnnouncements({targetsOverride:["old"]});await h.ctx.assertMorningAnnouncements({targetsOverride:["old"]});assert.deepEqual([...h.state.targets],["old"]);assert.equal(h.holds.size,1);await h.ctx.releaseMorningAnnouncements();assert.equal(h.holds.size,0);
});
test("a fresh partial start still uses inactive conditional recovery",async()=>{
 const h=fresh();h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements(),/clear/);assert.equal(h.state.active,false);assert.equal(h.pending.size,1);h.controls.clearFailure=false;await h.fire();assert.equal(h.pending.size,0);assert.equal(h.holds.size,0);
});
test("continuing delayed audio cannot control a partially added receiver",async()=>{
 const h=fixture(),tracked=[];h.state.live=true;h.ctx.trackFullExportMutation=promise=>{tracked.push(promise);return promise};vm.runInContext(extract("scheduleAnnouncementAudioRetries"),h.ctx);h.ctx.scheduleAnnouncementAudioRetries(h.state.targets);h.displays.new={audioContentId:"other-video"};h.controls.clearFailure=true;h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["new"]}),/clear/);const count=h.calls.length;for(const timer of h.timers.slice(0,4))timer.fn();await Promise.all(tracked);const audio=h.calls.slice(count).filter(c=>c.type==="state");assert.equal(audio.length,4);assert.ok(audio.every(c=>c.ids.length===1&&c.ids[0]==="old"));assert.equal(h.state.active,true);
});
test("operator Resume repairs every tracked receiver after a partial addition",async()=>{
 const h=fixture();h.displays.new={audioContentId:"other-video"};h.controls.clearFailure=true;h.controls.failType="display.web";h.controls.failAfterState=true;await assert.rejects(h.ctx.assertMorningAnnouncements({targetsOverride:["new"]}),/clear/);h.controls.clearFailure=false;h.ctx.schedulerClock={now:()=>new Date(),commandsAllowed:()=>true};h.ctx.isAutomationSuppressed=()=>({blocked:false});vm.runInContext(extract("reconcileScheduledAutomationState"),h.ctx);const before=h.calls.length;const result=await h.ctx.reconcileScheduledAutomationState();assert.equal(result.announcementResumed,true);const states=h.calls.slice(before).filter(x=>x.type==="state");assert.equal(states.length,2);for(const command of states)assert.deepEqual(command.ids,["old","new"]);assert.equal(h.state.active,true);await h.ctx.releaseMorningAnnouncements();assert.equal(h.holds.size,0);assert.equal(h.pending.size,0);
});
