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

function productionFunction(start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from);
  assert.ok(from>=0&&to>from,`Missing production function boundary: ${start}`);
  return source.slice(from,to);
}

// Execute both real production layers. Mock only the appliance dependencies;
// stubbing runSingleAutomationAction would hide the aggregate-selector regression.
function harness({devices,locked=[],reply,enabled=true}={}){
  devices=devices||Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  const commands=[],otherCommands=[],audits=[];
  const cancelled=new Set();
  const context=vm.createContext({
    ...schema,...runtime,devices,Date,Set,Map,setTimeout,clearTimeout,
    schedulerClock:{now:()=>new Date("2026-10-08T19:00:00Z")},
    automationTargetDomain:runtime.actionResourceDomain,
    normalizeTimerOverlay:()=>null,
    expandAutomationPayload:payload=>plain(payload),
    cleanId:value=>String(value||"").trim().toLowerCase(),
    AUTOMATION_ACTIONS:new Set(["tv.power","govee.power","display.clear"]),
    automationDisplayTargets:targets=>runtime.expandDisplayTargets(targets,{devices}),
    requireAutomationTargets:targets=>targets,
    defaultAutomationActionTargets:()=>["all"],
    announcementLockedDisplayTargets:targets=>runtime.expandDisplayTargets(targets,{devices}).filter(id=>locked.includes(id)),
    automationSchedulerEnabled:enabled,
    automationCancelledOccurrences:cancelled,
    automationCancellationReasons:new Map(),
    classroomAutomations:{events:[]},
    isAutomationSuppressed:()=>({blocked:false}),
    directPluto:async command=>{commands.push(plain(command));return reply?reply(command):{ok:true};},
    directGoveeCommand:async(...args)=>{otherCommands.push(plain(args));return {ok:true};},
    executeCommand:async command=>{otherCommands.push(plain(command));return {ok:true};},
    audit:entry=>audits.push(plain(entry)),
    diagnosticError:()=>{}
  });
  vm.runInContext(
    productionFunction("async function runSingleAutomationAction","function timerLinkedClassChain")+"\n"+
    productionFunction("async function runClassroomAutomation","function safeStoredName"),context);
  return {
    commands,otherCommands,audits,cancelled,
    async run(sequence,options={},extra={}){
      const event={id:"test-end-of-day",name:"End of day fixture",enabled:true,revision:1,actionSequence:sequence,...extra};
      context.classroomAutomations.events=[event];
      return plain(await context.runClassroomAutomation(event,options));
    }
  };
}
function power(targets=["all"],payload={state:"off"},extra={}){
  return {id:"power",action:"tv.power",targets,payload,executionMode:"once",useEventTargets:false,...extra};
}
function lighting(extra={}){
  return {id:"lights",action:"govee.power",targets:["all"],payload:{state:"off"},executionMode:"once",useEventTargets:false,...extra};
}
const outputs=(connection="hdbt",index=1,except=[])=>Array.from({length:8},(_,i)=>i+1).filter(output=>!except.includes(output)).map(output=>({action:"cecOutput",output,connection,index}));

test("scheduled All TVs off preserves the manual broadcast command",async()=>{
  const h=harness();
  const result=await h.run([power()]);
  assert.equal(result.ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
  assert.equal(h.otherCommands.length,0);
  assert.equal(result.totalStepExecutions,1);
});

for(const [selector,action] of [["all","cecAllOutputs"],["hdmi-all","cecAllHdmi"],["hdbt-all","cecAllHdbt"]]){
  for(const state of ["on","off"]){
    test(`${selector} ${state} keeps its transport through scheduled and manual sequences`,async()=>{
      for(const manual of [false,true]){
        const h=harness();
        assert.equal((await h.run([power([selector],{state})],{manual})).ok,true);
        assert.deepEqual(h.commands,[{action,index:state==="on"?0:1}]);
      }
    });
  }
}

test("legacy single-action events retain the All TVs broadcast",async()=>{
  const h=harness();
  assert.equal((await h.run(undefined,{}, {action:"tv.power",targets:["all"],payload:{state:"off"}})).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
});

test("cross-domain empty TV targets use All TVs rather than the lighting target",async()=>{
  const h=harness();
  assert.equal((await h.run([lighting(),power([],{state:"off"},{useEventTargets:true})])).ok,true);
  assert.equal(h.otherCommands.length,1);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
});

test("same-domain inherited targets retain their aggregate selector",async()=>{
  const h=harness();
  assert.equal((await h.run([power(["hdmi-all"],{state:"on"}),power(["tv3"],{state:"off"},{id:"second",useEventTargets:true})])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllHdmi",index:0},{action:"cecAllHdmi",index:1}]);
});

test("All TVs cannot collapse to remapped or duplicate browser receiver outputs",async()=>{
  const h=harness({devices:{tv1:{enabled:true,avOutput:1},tv2:{enabled:true,avOutput:2},tv3:{enabled:true,avOutput:8}}});
  assert.equal((await h.run([power()])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
});

test("explicit individual targets keep their mapping and never broaden to all",async()=>{
  const h=harness({devices:{tv3:{enabled:true,avOutput:7,avConnection:"hdmi"}}});
  assert.equal((await h.run([power(["tv3"])] )).ok,true);
  assert.deepEqual(h.commands,[{action:"cecOutput",output:7,connection:"hdmi",index:1}]);
});

test("an explicit individual output override remains compatible",async()=>{
  const h=harness();
  assert.equal((await h.run([power(["tv3"],{state:"off",output:6})])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecOutput",output:6,connection:"hdbt",index:1}]);
});

test("All dominates redundant selections and ignores stale individual output metadata",async()=>{
  for(const targets of [["all"],["all","all"],["all","tv3"],["tv3","hdmi-all","all"]]){
    const h=harness();
    assert.equal((await h.run([power(targets,{state:"off",output:3})])).ok,true);
    assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
  }
});

test("partial announcement locks prevent broadcast and protect the locked TV",async()=>{
  const h=harness({locked:["tv3"]});
  const result=await h.run([power()]);
  assert.equal(result.ok,true);
  assert.equal(result.steps[0].deferred,true);
  assert.deepEqual(result.steps[0].lockedTargets,["tv3"]);
  assert.deepEqual(h.commands,outputs("hdbt",1,[3]));
});

for(const [selector,connection,configured] of [["hdmi-all","hdmi","hdbt"],["hdbt-all","hdbt","hdmi"]]){
  test(`${selector} retains forced transport after announcement filtering`,async()=>{
    const devices=Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1,avConnection:configured}]));
    const h=harness({devices,locked:["tv3"]});
    assert.equal((await h.run([power([selector])])).ok,true);
    assert.deepEqual(h.commands,outputs(connection,1,[3]));
  });
}

test("a filtered aggregate cannot redirect its last output onto a locked TV",async()=>{
  const h=harness({locked:["tv1","tv3","tv4","tv5","tv6","tv7","tv8"]});
  assert.equal((await h.run([power(["all"],{state:"off",output:3})])).ok,true);
  assert.deepEqual(h.commands,[{action:"cecOutput",output:2,connection:"hdbt",index:1}]);
});

test("full announcement ownership defers TV power without sending commands",async()=>{
  const h=harness({locked:Array.from({length:8},(_,i)=>`tv${i+1}`)});
  const result=await h.run([power(),lighting()]);
  assert.equal(result.ok,true);
  assert.equal(result.steps[0].deferred,true);
  assert.equal(h.commands.length,0);
  assert.equal(h.otherCommands.length,1);
});

test("an announcement on a non-tvN receiver still prohibits aggregate broadcast",async()=>{
  const h=harness({devices:{screen:{enabled:true}},locked:["screen"]});
  assert.equal((await h.run([power()])).ok,true);
  assert.ok(h.commands.length>0);
  assert.ok(h.commands.every(command=>command.action==="cecOutput"));
});

test("the internal announcement bypass retains explicit aggregate semantics",async()=>{
  const h=harness({locked:["tv3"]});
  assert.equal((await h.run([power()],{bypassAnnouncementPriority:true})).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
});

for(const [name,reply] of [
  ["rejected",()=>({ok:false,error:"fixture rejection"})],
  ["unverified",()=>({ok:true,pendingVerify:true})],
  ["transport failure",()=>{throw new Error("fixture transport failure");}]
]){
  test(`${name} is reported without retry while continue-on-error still advances`,async()=>{
    const h=harness({reply});
    const result=await h.run([power(),lighting()]);
    assert.equal(result.ok,false);
    assert.equal(result.steps[0].ok,false);
    assert.equal(result.steps[1].ok,true);
    assert.equal(h.commands.length,1);
    assert.equal(h.otherCommands.length,1);
    assert.equal(h.audits.at(-1).ok,false);
  });
}

test("stop-on-error stops the sequence after a failed broadcast",async()=>{
  const h=harness({reply:()=>({ok:false,error:"fixture rejection"})});
  const result=await h.run([power(["all"],{state:"off"},{continueOnError:false}),lighting()]);
  assert.equal(result.ok,false);
  assert.equal(h.commands.length,1);
  assert.equal(h.otherCommands.length,0);
});

test("Run once power is not repeated when a later action has finite repeats",async()=>{
  const h=harness();
  const result=await h.run([power(),lighting({executionMode:"repeat",repeatCount:3})]);
  assert.equal(result.ok,true);
  assert.equal(result.passes,3);
  assert.equal(h.commands.length,1);
  assert.equal(h.otherCommands.length,3);
});

test("invalid targets remain failures and do not fall back to a broadcast",async()=>{
  const h=harness();
  assert.equal((await h.run([power(["not-a-tv"])])).ok,false);
  assert.equal(h.commands.length,0);
});

test("scheduler pause and occurrence cancellation still prevent power writes",async()=>{
  const paused=harness({enabled:false});
  await assert.rejects(()=>paused.run([power()]),/scheduler paused/);
  assert.equal(paused.commands.length,0);
  const cancelled=harness();cancelled.cancelled.add("cancelled-fixture");
  await assert.rejects(()=>cancelled.run([power()],{}, {_occurrenceId:"cancelled-fixture"}),/cancelled/);
  assert.equal(cancelled.commands.length,0);
});

test("a class-ended occurrence sends no power command",async()=>{
  const h=harness();
  const result=await h.run([power()],{}, {_classEndAt:new Date("2026-10-08T18:59:00Z").getTime()});
  assert.equal(result.endedReason,"class-ended");
  assert.equal(h.commands.length,0);
});
