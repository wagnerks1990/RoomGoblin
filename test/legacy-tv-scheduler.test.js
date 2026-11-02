"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {expandDisplayTargets,assertAdapterResults}=require("../src/automation-runtime");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const copy=value=>JSON.parse(JSON.stringify(value));
function section(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing production boundary: ${start}`);
  return source.slice(a,b);
}
function schedule(index=1,type="hdbt"){
  return {type,index,enabled:true,onTime:"10:00",offTime:"18:00",days:[2],lastExec:{},lastRun:{}};
}
function harness({devices,locked=[],schedules={one:schedule()},failPersistAt=0,reply}={}){
  devices=devices||Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{avOutput:i+1,enabled:true}]));
  const commands=[],atSend=[],errors=[];
  let saved=copy(schedules),persists=0,tick;
  const ctx=vm.createContext({
    Date,Object,Array,Number,String,devices,plutoSchedules:copy(schedules),
    shutdownRequested:false,fullExportFreeze:{requested:false,activeHttpMutations:0,activeWsMutations:0,activeAsyncMutations:0},automationSchedulerEnabled:true,
    httpHandlers:{pending:0},morningAnnouncementsLifecycleBusy:false,morningAnnouncementsTickBusy:false,
    presentationAutoAdvanceBusy:false,presentationBuilds:new Set(),sessionEffectBusy:false,backgroundMusicTickBusy:false,
    automationSchedulerBusy:false,automaticUpdateBusy:false,updateJobSyncBusy:false,automationRunningOccurrences:new Map(),veyonCommandQueue:{running:0},
    schedulerClock:{now:()=>new Date(2026,9,27,10),status:()=>({active:false}),commandsAllowed:()=>true},
    morningAnnouncementsRuntime:{active:locked.length>0},isAutomationSuppressed:()=>({blocked:false}),
    cleanId:value=>String(value||"").trim().toLowerCase(),assertAdapterResults,
    announcementLockedDisplayTargets:targets=>ctx.morningAnnouncementsRuntime.active?expandDisplayTargets(targets,{devices}).filter(id=>locked.includes(id)):[],
    persistPlutoSchedules:()=>{if(++persists===failPersistAt)throw new Error("fixture schedule persistence failed");saved=copy(ctx.plutoSchedules)},
    directPluto:async command=>{commands.push(copy(command));atSend.push(copy(saved));return reply?reply(command,{ctx,locked}):{ok:true}},
    diagnosticError:(error,context)=>errors.push({message:error.message,context}),
    setInterval:callback=>{tick=callback;return {unref(){}}}
  });
  vm.runInContext(section("function configuredDisplayId(","function cookieValue(")+"\n"+ section("function automationTvPowerPhysicalLocks(","function timerLinkedClassChain(")+"\n"+
    section("// Legacy per-output Pluto schedules","connectMqtt();")+"\n"+
    section("function applicationWritersDrained(){","async function gracefulShutdown("),ctx);
  return {ctx,commands,atSend,errors,locked,tick:()=>tick(),get saved(){return copy(saved)},
    get persists(){return persists},get busy(){return vm.runInContext("legacyPlutoSchedulerBusy",ctx)}};
}

test("legacy TV schedules protect a locked physical-output alias behind an unlocked receiver",async()=>{
  const h=harness({devices:{tv1:{avOutput:1},announcement:{avOutput:1}},locked:["announcement"]});
  await h.tick();assert.equal(h.commands.length,0);
  assert.equal(h.ctx.plutoSchedules.one.lastRun.deferred,true);
  assert.equal(h.ctx.plutoSchedules.one.lastExec.on,undefined);
});

test("an unmapped announcement receiver defers legacy TV power without guessing wiring",async()=>{
  const h=harness({devices:{tv1:{avOutput:1},announcement:{}},locked:["announcement"]});
  await h.tick();assert.equal(h.commands.length,0);
  assert.equal(h.ctx.plutoSchedules.one.lastRun.deferred,true);
});

test("physical announcement ownership protects both legacy CEC transports",async()=>{
  const h=harness({devices:{tv1:{avOutput:1},announcement:{avOutput:1}},locked:["announcement"],
    schedules:{hdmi:schedule(1,"hdmi"),hdbt:schedule(1,"hdbt")}});
  await h.tick();assert.equal(h.commands.length,0);
});

test("unlocked legacy outputs retain their exact configured transport",async()=>{
  for(const type of ["hdmi","hdbt"]){
    const h=harness({schedules:{one:schedule(1,type)},locked:["tv2"]});
    await h.tick();assert.deepEqual(h.commands,[{action:"cecOutput",output:1,connection:type,index:0}]);
  }
});

test("legacy physical locks are rechecked before a later output is dispatched",async()=>{
  const h=harness({devices:{tv1:{avOutput:1},tv2:{avOutput:2},announcement:{avOutput:2}},
    schedules:{one:schedule(1),two:schedule(2)},reply:(_command,{ctx,locked})=>{
      locked.push("announcement");ctx.morningAnnouncementsRuntime.active=true;return {ok:true};
    }});
  await h.tick();assert.equal(h.commands.length,1);
  assert.equal(h.ctx.plutoSchedules.two.lastRun.deferred,true);
});

test("legacy occurrence claim is durable before the first CEC write",async()=>{
  const h=harness();await h.tick();
  assert.equal(h.commands.length,1);
  assert.equal(h.atSend[0].one.lastExec.on,"2026-10-27 10:00");
  assert.equal(h.atSend[0].one.lastRun.pending,true);
  const restarted=harness({schedules:h.atSend[0]});await restarted.tick();
  assert.equal(restarted.commands.length,0,"an uncertain sent command must not replay after restart");
});

test("a failed legacy claim save prevents dispatch and releases scheduler ownership",async()=>{
  const h=harness({failPersistAt:1});
  await assert.doesNotReject(h.tick());
  assert.equal(h.commands.length,0);assert.equal(h.busy,false);
  assert.ok(h.errors.some(row=>/persistence failed/.test(row.message)));
  assert.equal(h.ctx.plutoSchedules.one.lastExec.on,undefined);
  await h.tick();assert.equal(h.commands.length,1,"a recovered admission save may send the previously unsent command once");
});

test("failed final status persistence preserves the claim and does not retry uncertain writes",async()=>{
  const h=harness({failPersistAt:2,reply:()=>{throw new Error("fixture delivery uncertain")}});
  await assert.doesNotReject(h.tick());
  assert.equal(h.commands.length,1);assert.equal(h.busy,false);
  assert.equal(h.saved.one.lastExec.on,"2026-10-27 10:00");
  assert.equal(h.saved.one.lastRun.pending,true);
  assert.ok(h.errors.some(row=>/persistence failed/.test(row.message)));
  const restarted=harness({schedules:h.saved});await restarted.tick();
  assert.equal(restarted.commands.length,0);
});

test("legacy rejected and unverified power acknowledgements remain failures without replay",async()=>{
  for(const reply of [{ok:false,error:"fixture rejection"},{ok:true,pendingVerify:true}]){
    const h=harness({reply:()=>reply});await h.tick();await h.tick();
    assert.equal(h.commands.length,1);assert.equal(h.ctx.plutoSchedules.one.lastRun.ok,false);
  }
});

test("legacy scheduler admission preserves shutdown, freeze, pause, simulation and calendar policies",async()=>{
  const cases=[ctx=>{ctx.shutdownRequested=true},ctx=>{ctx.fullExportFreeze.requested=true},
    ctx=>{ctx.automationSchedulerEnabled=false},ctx=>{ctx.schedulerClock.status=()=>({active:true});ctx.schedulerClock.commandsAllowed=()=>false},
    ctx=>{ctx.isAutomationSuppressed=()=>({blocked:true})},ctx=>{ctx.plutoSchedules.one.days=[1]}];
  for(const change of cases){const h=harness();change(h.ctx);await h.tick();assert.equal(h.commands.length,0);assert.equal(h.persists,0);assert.equal(h.busy,false)}
});

test("an accepted legacy write remains busy and excludes overlapping ticks until settled",async()=>{
  let release;const gate=new Promise(resolve=>{release=resolve});
  const h=harness({reply:async()=>{await gate;return {ok:true}}});
  const first=h.tick();assert.equal(h.busy,true);assert.equal(h.ctx.applicationWritersDrained(),false);await h.tick();assert.equal(h.commands.length,1);
  release();await first;assert.equal(h.busy,false);assert.equal(h.ctx.applicationWritersDrained(),true);await h.tick();assert.equal(h.commands.length,1);
});
