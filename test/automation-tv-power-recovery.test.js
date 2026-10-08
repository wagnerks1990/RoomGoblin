"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const schema=require("../src/automation-schema");
const runtime=require("../src/automation-runtime");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing production boundary: ${start}`);
  return source.slice(a,b);
}

// Exercise winner selection, dispatch planning, reconciliation and the real TV
// handler together. No appliance, network, persistent database or credentials.
function harness({devices,locked=[],announcementActive=false,blocked=false,reply}={}){
  devices=devices||Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  const commands=[],audits=[];
  let musicTicks=0,announcementRestores=0;
  const ctx=vm.createContext({
    ...schema,...runtime,devices,Date,Set,Map,
    schedulerClock:{now:()=>new Date("2026-10-08T19:00:00Z")},
    cleanId:value=>String(value||"").trim().toLowerCase(),
    localDateKey:()=>"2026-10-08",
    automationClassIds:()=>[],
    automationMatchesDate:event=>({match:event.matchDate!==false}),
    automationTargetDomain:runtime.actionResourceDomain,
    defaultAutomationActionTargets:()=>["all"],
    expandAutomationPayload:payload=>plain(payload),
    AUTOMATION_ACTIONS:new Set(["tv.power","govee.power"]),
    classroomAutomations:{events:[]},
    isAutomationSuppressed:()=>({blocked,reason:blocked?"no-school":null}),
    morningAnnouncementsRuntime:{active:announcementActive,targets:locked,mode:"automatic"},
    announcementLockedDisplayTargets:targets=>runtime.expandDisplayTargets(targets,{devices}).filter(id=>locked.includes(id)),
    assertMorningAnnouncements:async()=>{announcementRestores++;return {ok:true};},
    resyncCurrentDisplayAutomationsAfterAnnouncements:async()=>({results:[],winnerCount:0}),
    backgroundMusicRuntime:{playing:false,paused:false},
    backgroundMusicTick:async()=>{musicTicks++;},
    directPluto:async command=>{commands.push(plain(command));return reply?reply(command):{ok:true};},
    directGoveeCommand:async()=>({ok:true}),
    audit:entry=>audits.push(plain(entry))
  });
  vm.runInContext(
    section("async function runSingleAutomationAction","function timerLinkedClassChain")+"\n"+
    section("function currentAutomationNonDisplayWinners","function automationOccurrenceIsActiveForContinuousRecovery")+"\n"+
    section("async function reconcileScheduledAutomationState",'app.get("/api/v1/automation-control"'),ctx);
  return {
    commands,audits,
    get musicTicks(){return musicTicks;},
    get announcementRestores(){return announcementRestores;},
    async reconcile(events,reason="operator-resume"){
      ctx.classroomAutomations.events=events;
      return plain(await ctx.reconcileScheduledAutomationState(reason));
    }
  };
}
function power(targets=["all"],payload={state:"off"}){
  return {id:"power",action:"tv.power",targets,payload,useEventTargets:false,executionMode:"once"};
}
function event(id="shutdown",time="00:01",step=power(),extra={}){
  return {id,name:id,enabled:true,time,actionSequence:[step],...extra};
}
const individual=(connection="hdbt",on=[],except=[])=>Array.from({length:8},(_,i)=>i+1).filter(output=>!except.includes(output)).map(output=>({action:"cecOutput",output,connection,index:on.includes(output)?0:1}));

test("recovered All TVs off preserves its broadcast when it owns every TV winner",async()=>{
  for(const reason of ["startup","operator-resume"]){
    const h=harness();
    assert.equal((await h.reconcile([event()],reason)).ok,true);
    assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
    assert.equal(h.musicTicks,1);
  }
});

for(const [selector,action] of [["hdmi-all","cecAllHdmi"],["hdbt-all","cecAllHdbt"]]){
  test(`recovery preserves ${selector} aggregate transport`,async()=>{
    const h=harness();
    assert.equal((await h.reconcile([event("transport","00:01",power([selector]))])).ok,true);
    assert.deepEqual(h.commands,[{action,index:1}]);
  });
}

test("recovery broadcasts despite duplicate receiver-to-output mappings",async()=>{
  const h=harness({devices:{tv1:{enabled:true,avOutput:1},tv2:{enabled:true,avOutput:2},tv3:{enabled:true,avOutput:8}}});
  assert.equal((await h.reconcile([event()])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
});

test("a newer individual winner prevents a broad shutdown during recovery",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([event(),event("override","00:02",power(["tv3"],{state:"on"}))])).ok,true);
  assert.deepEqual(h.commands,individual("hdbt",[3]));
});

test("same-minute winner priority remains authoritative",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([event(),event("override","00:01",power(["tv3"],{state:"on"}),{priority:10})])).ok,true);
  assert.deepEqual(h.commands,individual("hdbt",[3]));
});

test("a later aggregate that replaces every individual winner can broadcast",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([event("old","00:01",power(["tv3"],{state:"on"})),event("shutdown","00:02")])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
});

test("different aggregate actions are not mixed into one recovery command",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([event("old","00:01",power(["hdbt-all"],{state:"on"})),event("new","00:02",power(["hdmi-all"]))])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllHdmi",index:1}]);
});

test("partial aggregate winners retain forced HDMI transport",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([event("base","00:01",power(["hdmi-all"])),event("override","00:02",power(["tv3"],{state:"on",connection:"hdmi"}))])).ok,true);
  assert.deepEqual(h.commands,individual("hdmi",[3]));
});

test("stale aggregate output metadata cannot redirect every partial winner",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([event("base","00:01",power(["all"],{state:"off",output:3})),event("override","00:02",power(["tv3"],{state:"on"}))])).ok,true);
  assert.deepEqual(h.commands,individual("hdbt",[3]));
});

test("explicit individual selections never become a broadcast during recovery",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([event("explicit","00:01",power(Array.from({length:8},(_,i)=>`tv${i+1}`)))])).ok,true);
  assert.deepEqual(h.commands,individual());
});

test("legacy single-action All events retain aggregate recovery intent",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([{id:"legacy",name:"legacy",enabled:true,time:"00:01",action:"tv.power",targets:["all"],payload:{state:"off"}}])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
});

test("explicit individual output overrides remain compatible during recovery",async()=>{
  const h=harness();
  assert.equal((await h.reconcile([event("individual","00:01",power(["tv3"],{state:"off",output:6}))])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecOutput",output:6,connection:"hdbt",index:1}]);
});

test("Morning Announcements are restored instead of shutdown state",async()=>{
  const h=harness({locked:["tv3"],announcementActive:true});
  const result=await h.reconcile([event()]);
  assert.equal(result.announcementResumed,true);
  assert.equal(h.commands.length,0);
  assert.equal(h.announcementRestores,1);
  assert.equal(h.musicTicks,0);
});

test("receiver locks also prevent a broadcast and defer individual recovery writes",async()=>{
  const h=harness({locked:["tv3"]});
  const result=await h.reconcile([event()]);
  assert.equal(result.ok,true);
  assert.deepEqual(h.commands,individual("hdbt",[],[3]));
  assert.equal(result.resources.find(row=>row.target==="tv3").deferred,true);
});

test("full receiver locks defer all TV recovery writes",async()=>{
  const h=harness({locked:Array.from({length:8},(_,i)=>`tv${i+1}`)});
  const result=await h.reconcile([event()]);
  assert.equal(result.ok,true);
  assert.equal(h.commands.length,0);
  assert.ok(result.resources.every(row=>row.deferred));
});

test("failed recovery broadcast remains a failure without replaying writes",async()=>{
  for(const reply of [()=>({ok:false,error:"fixture rejection"}),()=>({ok:true,pendingVerify:true}),()=>{throw new Error("fixture failure");}]){
    const h=harness({reply});
    assert.equal((await h.reconcile([event()])).ok,false);
    assert.equal(h.commands.length,1);
    assert.equal(h.musicTicks,1);
    assert.equal(h.audits.at(-1).ok,false);
  }
});

test("disabled, future and unmatched overrides do not steal aggregate ownership",async()=>{
  for(const [time,extra] of [["00:02",{enabled:false}],["23:59",{}],["00:02",{matchDate:false}]]){
    const h=harness();
    assert.equal((await h.reconcile([event(),event("ignored",time,power(["tv3"],{state:"on"}),extra)])).ok,true);
    assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
  }
});

test("school-calendar suppression prevents all recovery commands",async()=>{
  const h=harness({blocked:true});
  const result=await h.reconcile([event()]);
  assert.equal(result.skipped,true);
  assert.equal(h.commands.length,0);
  assert.equal(h.musicTicks,0);
});
