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
  assert.ok(a>=0&&b>a,`Missing production boundary: ${start}`);return source.slice(a,b);
}
function harness({devices={tv1:{enabled:true,avOutput:1},tv2:{enabled:true,avOutput:2}},displayGroups={}}={}){
  const commands=[],lights=[],display=[];
  const ctx=vm.createContext({
    ...schema,...runtime,Date,performance,Set,Map,setTimeout,clearTimeout,devices,displayGroups,
    goveeDevices:{front:{id:"fixture-front"},rear:{id:"fixture-rear"}},goveeGroups:{all:["front","rear"],frontonly:["front"]},
    cleanId:value=>String(value||"").trim().toLowerCase(),
    schedulerClock:{now:()=>new Date(),commandsAllowed:()=>true},
    classroomAutomations:{events:[]},automationSchedulerEnabled:true,shuttingDown:false,
    automationCancelledOccurrences:new Set(),automationCancellationReasons:new Map(),automationRunningOccurrenceMeta:new Map(),
    automationRunLedger:{record:()=>{}},
    morningAnnouncementsRuntime:{active:false},isAutomationSuppressed:()=>({blocked:false}),
    normalizeTimerOverlay:value=>value||null,expandAutomationPayload:payload=>payload,
    AUTOMATION_ACTIONS:new Set(["tv.power","display.clear","govee.power"]),
    planningStudio:{matchingOverlays:()=>[]},planningStudioConfig:{},persistentState:{displays:{}},
    localDateKey:()=>"2026-10-27",schoolCycleForDate:()=>({}),
    resolveAutomationOccurrences:event=>[event],automationMatchesDate:()=>({match:true}),calendarRuleForDate:()=>({type:"normal"}),
    directPluto:async command=>{commands.push(plain(command));return {ok:true}},
    goveePublish:async alias=>{lights.push(alias);return {ok:true}},
    executeCommand:async command=>{display.push(plain(command));return {ok:true}},
    audit:()=>{},diagnosticError:()=>{}
  });
  vm.runInContext(section("function automationTargetDomain(","function automationVariableContext(")+"\n"+
    section("function goveeTargets(","async function goveeUdpTemperature(")+"\n"+
    section("async function directGoveeCommand(","function goveeInventory(")+"\n"+
    section("async function runSingleAutomationAction(","function timerLinkedClassChain(")+"\n"+
    section("async function runClassroomAutomation(","function safeStoredName(")+"\n"+
    section("function automationResourceKeys(","function automationConflictSignature(")+"\n"+
    section("function supersedeOverlappingAutomationRuns(","async function cancelActiveManualAutomationRuns("),ctx);
  return {ctx,commands,lights,display,keys:event=>plain(ctx.automationResourceKeys(event)).sort(),async run(event){
    ctx.classroomAutomations.events=[event];return ctx.runClassroomAutomation(event,{maxPasses:1});
  }};
}
function event(action,targets,payload={},extra={}){
  return {id:"resource-fixture",name:"Resource fixture",revision:1,enabled:true,time:"10:00",actionSequence:[
    {id:"one",action,targets,payload,useEventTargets:false,executionMode:"once"}
  ],...extra};
}
function sentTvKeys(commands){
  const keys=[];
  for(const command of commands){
    if(command.action==="cecOutput")keys.push(`tv-power:${command.connection}:${command.output}`);
    else{
      const connections=command.action==="cecAllOutputs"?["hdmi","hdbt"]:[command.action==="cecAllHdmi"?"hdmi":"hdbt"];
      for(const connection of connections)for(let output=1;output<=8;output++)keys.push(`tv-power:${connection}:${output}`);
    }
  }
  return [...new Set(keys)].sort();
}

test("empty primary display targets reserve the same enabled defaults the runner dispatches",async()=>{
  const h=harness(),e=event("display.clear",[]);await h.run(e);
  assert.deepEqual(h.display[0].target,["tv1","tv2"]);
  assert.deepEqual(h.keys(e),["display-content:tv1","display-content:tv2"]);
});

test("empty primary TV targets reserve both transports of the actual all-output command",async()=>{
  const h=harness(),e=event("tv.power",[],{state:"off"});await h.run(e);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
  assert.deepEqual(h.keys(e),sentTvKeys(h.commands));
});

test("TV resources follow the payload connection used for individual dispatch",async()=>{
  const h=harness(),e=event("tv.power",["tv1"],{connection:"hdmi"});await h.run(e);
  assert.deepEqual(h.commands,[{action:"cecOutput",output:1,connection:"hdmi",index:0}]);
  assert.deepEqual(h.keys(e),sentTvKeys(h.commands));
});

test("explicit receiver transport still wins over the fallback payload connection",async()=>{
  const h=harness({devices:{tv1:{avOutput:1,avConnection:"hdbt"}}}),e=event("tv.power",["tv1"],{connection:"hdmi"});
  await h.run(e);assert.deepEqual(h.keys(e),sentTvKeys(h.commands));assert.deepEqual(h.keys(e),["tv-power:hdbt:1"]);
});

test("legacy individual output overrides reserve the output actually sent",async()=>{
  const h=harness(),e=event("tv.power",["tv1"],{output:8});await h.run(e);
  assert.equal(h.commands[0].output,8);assert.deepEqual(h.keys(e),sentTvKeys(h.commands));
});

test("aggregate resources cover every physical output despite remapped or duplicated receiver aliases",async()=>{
  for(const selector of ["all","hdmi-all","hdbt-all"]){
    const h=harness({devices:{tv1:{avOutput:8},tv2:{avOutput:8}}}),e=event("tv.power",[selector],{output:2});
    await h.run(e);assert.equal(h.commands.length,1);assert.notEqual(h.commands[0].action,"cecOutput");
    assert.deepEqual(h.keys(e),sentTvKeys(h.commands));
  }
});

test("mixed transport selectors retain their individual dispatch resource set",async()=>{
  const h=harness(),e=event("tv.power",["hdmi-all","tv1"]);await h.run(e);
  assert.equal(h.commands.length,9);assert.deepEqual(h.keys(e),sentTvKeys(h.commands));
});

test("lighting groups and default all resolve to the devices the real Govee handler sends",async()=>{
  for(const targets of [[],["all"],["frontonly"]]){
    const h=harness(),e=event("govee.power",targets);await h.run(e);
    assert.ok(h.lights.length);assert.deepEqual(h.keys(e),h.lights.map(id=>`lighting:${id}`).sort());
  }
});

test("device identity takes precedence over a same-name lighting group",async()=>{
  const h=harness();h.ctx.goveeGroups.front=["rear"];
  const e=event("govee.power",["front"]);await h.run(e);assert.deepEqual(h.lights,["front"]);
  assert.deepEqual(h.keys(e),["lighting:front"]);
});

test("compatible inherited display targets and class defaults preserve domain isolation",async()=>{
  const h=harness({displayGroups:{pair:["tv1","tv2"]}}),e=event("display.clear",["pair"],{},
    {_classDefaultTargets:["tv2"],actionSequence:[
      {id:"one",action:"display.clear",targets:["pair"]},
      {id:"two",action:"display.clear",targets:["tv1"],useEventTargets:true},
      {id:"three",action:"govee.power",targets:["front"],useEventTargets:true}
    ]});
  await h.run(e);assert.deepEqual(h.display.map(row=>row.target),[["tv2"],["tv2"]]);
  assert.deepEqual(h.lights,["front"]);assert.deepEqual(h.keys(e),["display-content:tv2","lighting:front"]);
});

test("conflict diagnostics detect group-member and broadcast-transport collisions",()=>{
  for(const [first,second,key] of [
    [event("govee.power",["all"]),event("govee.power",["front"],{},{id:"other"}),"lighting:front"],
    [event("tv.power",["all"]),event("tv.power",["tv1"],{connection:"hdmi"},{id:"other"}),"tv-power:hdmi:1"]
  ]){
    const h=harness(),conflicts=h.ctx.automationConflictDiagnostics(first,[second],{horizonDays:1});
    assert.equal(conflicts.length,1);assert.ok(conflicts[0].resources.includes(key));
  }
});

test("overlapping group membership cancels an older loop while unrelated resources remain active",()=>{
  const h=harness(),old=event("govee.power",["all"]),next=event("govee.power",["front"]);
  h.ctx.automationRunningOccurrenceMeta.set("old",{resources:h.keys(old)});
  h.ctx.automationRunningOccurrenceMeta.set("unrelated",{resources:["display-content:tv1"]});
  assert.deepEqual(plain(h.ctx.supersedeOverlappingAutomationRuns(next,"new")),["old"]);
  assert.equal(h.ctx.automationCancelledOccurrences.has("old"),true);
  assert.equal(h.ctx.automationCancelledOccurrences.has("unrelated"),false);
});

test("individual HDMI and HDBT resources do not create a false same-transport conflict",()=>{
  const h=harness(),hdmi=event("tv.power",["tv1"],{connection:"hdmi"}),hdbt=event("tv.power",["tv1"],{connection:"hdbt"},{id:"other"});
  assert.equal(h.ctx.automationConflictDiagnostics(hdmi,[hdbt],{horizonDays:1}).length,0);
});
