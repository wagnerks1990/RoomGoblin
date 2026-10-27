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
function harness({devices,locked=[],announcementActive=false,blocked=false,reply,goveeDevices={lamp:{},other:{},third:{}},goveeGroups={all:["lamp","other","third"],group:["lamp"],pair:["lamp","other"],rear:["other","third"]},now=new Date(2026,9,27,10)}={}){
  devices=devices||Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  const commands=[],audits=[],started=[],lightState=new Map();let ledgerState={version:1,runs:[]};
  const ledger=runtime.makeLedger({getPreference:()=>plain(ledgerState),setPreference:(_key,value)=>{ledgerState=plain(value)}});
  let musicTicks=0,announcementRestores=0;
  const ctx=vm.createContext({planningStudio:require("../src/planning-studio"),planningStudioConfig:{overlays:[]},
    ...schema,...runtime,devices,goveeDevices,goveeGroups,Date,Set,Map,
    schedulerClock:{now:()=>now,commandsAllowed:()=>true,status:()=>({active:false})},
    automationSchedulerEnabled:true,automationRunLedger:ledger,automationRunningOccurrences:new Map(),
    currentAutomationDisplayWinners:()=>[],localMinutesNow:date=>date.getHours()*60+date.getMinutes(),
    supersedeOverlappingAutomationRuns:()=>{},
    startOwnedAutomationOccurrence:id=>started.push(id),executeScheduledAutomationOccurrence:()=>{},
    cleanId:value=>String(value||"").trim().toLowerCase(),
    localDateKey:()=>"2026-10-27",
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
    goveePublish:async(alias,payload)=>{commands.push({alias,payload:plain(payload)});lightState.set(alias,payload.state);return {ok:true}},
    audit:entry=>audits.push(plain(entry))
  });
  vm.runInContext(
    section("function automationResourceKeys(","function automationConflictDiagnostics(")+"\n"+section("function goveeTargets(","async function goveeUdpTemperature(")+"\n"+section("async function directGoveeCommand(","function goveeInventory(")+"\n"+section("function resolveAutomationOccurrences","function resolveAutomationFromClass")+"\n"+
    section("async function runSingleAutomationAction","function timerLinkedClassChain")+"\n"+
    section("function currentAutomationNonDisplayWinners","function automationOccurrenceIsActiveForContinuousRecovery")+"\n"+
    section("function automationOccurrenceScheduledMinutes(","function automationOccurrenceIsCurrentlyApplicable(")+"\n"+
    section("function automationOccurrenceIsActiveForContinuousRecovery(","async function reconcileScheduledAutomationState(")+"\n"+
    section("async function reconcileScheduledAutomationState",'app.get("/api/v1/automation-control"'),ctx);
  return {
    ctx,commands,audits,started,ledger,lightState,
    get musicTicks(){return musicTicks;},
    get announcementRestores(){return announcementRestores;},
    async reconcile(events,reason="operator-resume"){
      ctx.classroomAutomations.events=events;
      return plain(await ctx.reconcileScheduledAutomationState(reason));
    },
    async recover(events){
      ctx.classroomAutomations.events=events;
      return plain(await ctx.recoverContinuousAutomationOccurrences("fixture-restart"));
    }
  };
}
function power(targets=["all"],payload={state:"off"}){
  return {id:"power",action:"tv.power",targets,payload,useEventTargets:false,executionMode:"once"};
}
function event(id="shutdown",time="00:01",step=power(),extra={}){
  return {id,name:id,enabled:true,time,actionSequence:[step],...extra};
}



function physical(commands){const states={};for(const c of commands){
 const channels=c.action==='cecAllOutputs'?['hdmi','hdbt']:[c.action==='cecAllHdmi'?'hdmi':c.action==='cecAllHdbt'?'hdbt':c.connection];
 for(const connection of channels)for(const output of c.action==='cecOutput'?[c.output]:[1,2,3,4,5,6,7,8])states[`${connection}:${output}`]=c.index;
}return states}
const allOff=()=>Object.fromEntries(['hdmi','hdbt'].flatMap(c=>[1,2,3,4,5,6,7,8].map(o=>[`${c}:${o}`,1])));
test('remapped TV aliases cannot overwrite the newer physical-output winner',async()=>{
 const h=harness({devices:{tv1:{avOutput:1},tv2:{avOutput:1}}});await h.reconcile([event('new','00:02',power(['tv1'],{state:'on'})),event('old','00:01',power(['tv2']))]);
 assert.deepEqual(h.commands,[{action:'cecOutput',output:1,connection:'hdbt',index:0}]);
});
test('individual HDMI and HDBT winners remain independent',async()=>{
 const h=harness();await h.reconcile([event('old','00:01',power(['tv1'],{state:'on',connection:'hdbt'})),event('new','00:02',power(['tv1'],{state:'off',connection:'hdmi'}))]);
 assert.deepEqual(physical(h.commands),{'hdbt:1':0,'hdmi:1':1});
});
test('a partial All-TVs winner still restores both eight-output transports',async()=>{
 const h=harness();await h.reconcile([event('new','00:02',power(['tv3'],{state:'on'})),event('old','00:01')]);
 assert.deepEqual(physical(h.commands),{...allOff(),'hdbt:3':0});assert.ok(h.commands.every(c=>c.action==='cecOutput'));
});
test('legacy individual output overrides participate in actual-port winner selection',async()=>{
 const h=harness();await h.reconcile([event('new','00:02',power(['tv3'],{state:'on'})),event('old','00:01',power(['tv1'],{state:'off',output:3}))]);
 assert.deepEqual(h.commands,[{action:'cecOutput',output:3,connection:'hdbt',index:0}]);
});
test('separate aggregate transports keep both desired states without crossing their scopes',async()=>{
 const h=harness();await h.reconcile([event('old','00:01',power(['hdbt-all'],{state:'on'})),event('new','00:02',power(['hdmi-all']))]);
 const expected=allOff();for(let i=1;i<=8;i++)expected['hdbt:'+i]=0;assert.deepEqual(physical(h.commands),expected);
});
test('uncontested All-TVs intent preserves one broadcast despite duplicate mappings',async()=>{
 const h=harness({devices:{tv1:{avOutput:8},tv2:{avOutput:8}}});await h.reconcile([event()]);assert.deepEqual(h.commands,[{action:'cecAllOutputs',index:1}]);assert.deepEqual(physical(h.commands),allOff());
});

const tvLoop=(id,time,targets,payload,delay=0)=>event(id,time,power(targets,payload),{actionSequence:[
 {...power(targets,payload),id:'first',executionMode:'loop',delaySeconds:delay,repeatDelaySeconds:30},
 {...power(targets,payload),id:'second',executionMode:'loop',repeatDelaySeconds:30}
]});
test('a delayed newer physical-output owner prevents an older alias loop from recovering',async()=>{
 const h=harness({devices:{tv1:{avOutput:8},tv8:{avOutput:8}}}),events=[tvLoop('old','09:58',['tv8'],{state:'off'}),tvLoop('new','09:59',['tv1'],{state:'on'},120)];
 assert.equal((await h.recover(events)).started,1);assert.deepEqual(h.started,[runtime.occurrenceId(events[1],'2026-10-27','09:59')]);
});
test('a stopped physical-output winner does not revive its older alias loop',async()=>{
 const h=harness({devices:{tv1:{avOutput:8},tv8:{avOutput:8}}}),events=[tvLoop('old','09:58',['tv8'],{state:'off'}),tvLoop('new','09:59',['tv1'],{state:'on'},120)];
 h.ledger.record({occurrenceId:runtime.occurrenceId(events[1],'2026-10-27','09:59'),status:'cancel-requested'});
 assert.equal((await h.recover(events)).started,0);assert.deepEqual(h.started,[]);
});
test('independent HDMI and HDBT continuous owners remain recoverable',async()=>{
 const h=harness(),events=[tvLoop('hdbt','09:58',['tv1'],{connection:'hdbt'}),tvLoop('hdmi','09:59',['tv1'],{connection:'hdmi'})];
 assert.equal((await h.recover(events)).started,2);assert.equal(h.started.length,2);
});
test('a stopped All-TVs owner protects both transports from older loop recovery',async()=>{
 const h=harness(),events=[tvLoop('old','09:58',['tv1'],{connection:'hdmi'}),tvLoop('new','09:59',['all'],{state:'off'})];
 h.ledger.record({occurrenceId:runtime.occurrenceId(events[1],'2026-10-27','09:59'),status:'cancel-requested'});
 assert.equal((await h.recover(events)).started,0);assert.deepEqual(h.started,[]);
});
