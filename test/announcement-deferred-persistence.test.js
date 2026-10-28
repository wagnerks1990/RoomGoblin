"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
function extract(name){const a=source.search(new RegExp("(?:async )?function "+name+"\\(")),b=source.indexOf("\n}",a);assert.ok(a>0&&b>a,name);return source.slice(a,b+2)}
function fixture({existing=true}={}){
 const event=existing?{id:"lesson",lastExec:"old",lastExecByClass:{base:"old"},lastRun:{ok:false},updatedAt:"before"}:{id:"lesson"};
 const item={storedEventId:"lesson",occurrenceKey:"base",scheduledMinuteKey:"2026-10-27 08:00",dateKey:"2026-10-27",event:{time:"08:00",classId:"base"}},queue=new Map([["one",item]]),writes=[],timers=[],calls=[];
 const ctx=vm.createContext({Date,Map,Promise,persistentState:{displays:{screen:{audioContentId:"announcement"}}},morningAnnouncementsReleaseTargets:new Map([["screen",{contentId:"announcement",clearId:"release-clear",cleared:false}]]),resolveDisplayTargets:ids=>ids,executeCommand:async command=>{ctx.persistentState.displays.screen.audioContentId=command.id},deferredAnnouncementAutomations:queue,classroomAutomations:{events:[event]},persistAutomations:()=>writes.push(JSON.parse(JSON.stringify(event))),
  shutdownRequested:false,fullExportFreeze:{requested:false},morningAnnouncementsReleaseRetryTimer:null,morningAnnouncementsLifecycle:Promise.resolve(),morningAnnouncementsLifecycleBusy:0,morningAnnouncementsRuntime:{active:false,releaseReconcilePending:true},
  setTimeout:fn=>{const t={fn,unref(){}};timers.push(t);return t},resyncCurrentDisplayAutomationsAfterAnnouncements:async()=>{calls.push("resync");return {results:[]}},
  setMorningAnnouncementPriorityTargets:async()=>calls.push("release"),backgroundMusicTick:async()=>calls.push("music")});
 for(const name of ["clearMorningAnnouncementsReleaseTargets","consumeDeferredAnnouncementAutomations","serializeMorningAnnouncementsLifecycle","scheduleMorningAnnouncementsReleaseRetry"])vm.runInContext(extract(name),ctx);
 return {ctx,event,item,queue,writes,timers,calls,async fire(){assert.ok(timers.length);timers.shift().fn();await ctx.morningAnnouncementsLifecycle;await Promise.resolve()}};
}
test("successful deferred bookkeeping preserves event identity and all occurrence markers",()=>{
 const h=fixture();h.queue.set("two",{...h.item,occurrenceKey:"other",scheduledMinuteKey:"2026-10-27 08:05"});
 assert.equal(h.ctx.consumeDeferredAnnouncementAutomations(),2);assert.equal(h.queue.size,0);assert.equal(h.writes.length,1);assert.equal(h.ctx.classroomAutomations.events[0],h.event);
 assert.deepEqual(JSON.parse(JSON.stringify(h.event.lastExecByClass)),{base:"2026-10-27 08:00",other:"2026-10-27 08:05"});assert.equal(h.event.lastExec,"2026-10-27 08:05");
});
for(const existing of [true,false])test("failed persistence restores "+(existing?"existing":"absent")+" markers and retains queued occurrences",()=>{
 const h=fixture({existing}),before=JSON.parse(JSON.stringify(h.event)),aliases=h.event.lastExecByClass;
 h.ctx.persistAutomations=()=>{throw Error("fixture database failure")};
 assert.throws(()=>h.ctx.consumeDeferredAnnouncementAutomations(),/fixture database failure/);
 assert.deepEqual(h.event,before);assert.equal(h.event.lastExecByClass,aliases);assert.equal(h.queue.size,1);assert.equal(h.queue.get("one"),h.item);
});
test("a failed bookkeeping transaction can be retried without losing the occurrence",()=>{
 const h=fixture();let attempts=0;h.ctx.persistAutomations=()=>{attempts++;if(attempts===1)throw Error("fixture database failure");h.writes.push(JSON.parse(JSON.stringify(h.event)))};
 assert.throws(()=>h.ctx.consumeDeferredAnnouncementAutomations(),/fixture/);assert.equal(h.ctx.consumeDeferredAnnouncementAutomations(),1);
 assert.equal(attempts,2);assert.equal(h.queue.size,0);assert.equal(h.writes[0].lastExecByClass.base,h.item.scheduledMinuteKey);
});
test("bookkeeping consumption does not discard a replacement queued during persistence",()=>{
 const h=fixture(),replacement={...h.item,scheduledMinuteKey:"2026-10-27 09:00"};h.ctx.persistAutomations=()=>h.queue.set("one",replacement);
 assert.equal(h.ctx.consumeDeferredAnnouncementAutomations(),1);assert.equal(h.queue.get("one"),replacement);
});
test("release retry persists deferred bookkeeping before resync and music release",async()=>{
 const h=fixture();let attempts=0;h.ctx.persistAutomations=()=>{attempts++;if(attempts===1)throw Error("fixture database failure")};
 h.ctx.scheduleMorningAnnouncementsReleaseRetry(["screen"],"stop");await h.fire();
 assert.equal(attempts,1);assert.equal(h.queue.size,1);assert.deepEqual(h.calls,[]);assert.equal(h.ctx.morningAnnouncementsRuntime.releaseReconcilePending,true);assert.equal(h.timers.length,1);
 await h.fire();assert.equal(attempts,2);assert.equal(h.queue.size,0);assert.deepEqual(h.calls,["resync","release","music"]);assert.equal(h.ctx.morningAnnouncementsRuntime.releaseReconcilePending,false);
});
