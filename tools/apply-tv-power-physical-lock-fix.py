"""One-use, hash-pinned work-branch repair; removed before final commit."""
from pathlib import Path
import subprocess
import sys
root=Path(__file__).resolve().parents[1]
server=root/'src/server.js'
if subprocess.check_output(['git','hash-object',str(server)],text=True).strip()!='31daa2cd4e96bc61b5a5622eed7d2104d396134b':
    raise SystemExit('Unexpected server revision')
if sys.argv[1]=='tests':
    file=root/'test/automation-tv-power-sequence.test.js'
    body=file.read_text()
    old='''  assert.ok(h.commands.length>0);
  assert.ok(h.commands.every(command=>command.action==="cecOutput"));'''
    if body.count(old)!=1: raise SystemExit('Unknown-receiver test anchor changed')
    body=body.replace(old,'''  assert.equal(h.commands.length,0);
  assert.equal((await h.run([power()])).steps[0].deferred,true);''',1)
    body+='''

test("a named announcement receiver protects its physical output during a sequence",async()=>{
  const devices=Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  devices.screen={enabled:true,avOutput:3};
  const h=harness({devices,locked:["screen"]});
  const result=await h.run([power()]);
  assert.equal(result.ok,true);
  assert.deepEqual(h.commands,outputs("hdbt",1,[3]));
  assert.equal(result.steps[0].deferred,true);
  assert.deepEqual(result.steps[0].lockedTargets,["screen"]);
});

test("a deduplicated locked receiver still protects its shared physical output",async()=>{
  const devices=Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  devices.tv2.avOutput=1;
  const h=harness({devices,locked:["tv2"]});
  const result=await h.run([power()]);
  assert.equal(result.ok,true);
  assert.deepEqual(h.commands,outputs("hdbt",1,[1,2]));
  assert.equal(result.steps[0].deferred,true);
  assert.deepEqual(result.steps[0].lockedTargets,["tv2"]);
});

test("an individual output override cannot bypass a physical announcement lock",async()=>{
  const h=harness({locked:["tv3"]});
  const result=await h.run([power(["tv1"],{state:"off",output:3})]);
  assert.equal(result.ok,true);
  assert.equal(result.steps[0].deferred,true);
  assert.equal(h.commands.length,0);
});

for(const avOutput of [null,"",0,-1,9,"invalid",true,[]]){
  test(`untrustworthy announcement output ${JSON.stringify(avOutput)} defers TV writes`,async()=>{
    const h=harness({devices:{tv1:{enabled:true},screen:{enabled:true,avOutput}},locked:["screen"]});
    const result=await h.run([power(),lighting()]);
    assert.equal(result.ok,true);
    assert.equal(result.steps[0].deferred,true);
    assert.equal(h.commands.length,0);
    assert.equal(h.otherCommands.length,1);
  });
}

test("physical announcement locks protect both transports conservatively",async()=>{
  const h=harness({devices:{tv1:{enabled:true,avOutput:3,avConnection:"hdmi"},screen:{enabled:true,avOutput:3,avConnection:"hdbt"}},locked:["screen"]});
  const result=await h.run([power(["tv1"],{state:"off",connection:"hdmi"})]);
  assert.equal(result.ok,true);
  assert.equal(result.steps[0].deferred,true);
  assert.equal(h.commands.length,0);
});

test("internal announcement bypass remains explicit for an aliased locked output",async()=>{
  const h=harness({devices:{tv1:{enabled:true,avOutput:1},screen:{enabled:true,avOutput:1}},locked:["screen"]});
  assert.equal((await h.run([power()],{bypassAnnouncementPriority:true})).ok,true);
  assert.deepEqual(h.commands,[{action:"cecAllOutputs",index:1}]);
});

test("a lock acquired between individual CEC writes protects subsequent outputs",async()=>{
  const locked=[];
  const h=harness({locked,reply:()=>{locked.push("tv3");return {ok:true};}});
  const result=await h.run([power(["tv1","tv3"])]);
  assert.equal(result.ok,true);
  assert.equal(result.steps[0].deferred,true);
  assert.deepEqual(h.commands,[{action:"cecOutput",output:1,connection:"hdbt",index:1}]);
});
'''
    file.write_text(body)
    file=root/'test/automation-tv-power-recovery.test.js'
    file.write_text(file.read_text()+'''

test("recovery protects the physical output of a named announcement receiver",async()=>{
  const devices=Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  devices.screen={enabled:true,avOutput:3};
  const h=harness({devices,locked:["screen"]});
  const result=await h.reconcile([event()]);
  assert.equal(result.ok,true);
  assert.deepEqual(h.commands,individual("hdbt",[],[3]));
  assert.equal(result.resources.find(row=>row.target==="tv3").deferred,true);
  assert.equal(h.musicTicks,1);
});

test("recovery protects a locked receiver omitted by physical-output deduplication",async()=>{
  const devices=Object.fromEntries(Array.from({length:8},(_,i)=>[`tv${i+1}`,{enabled:true,avOutput:i+1}]));
  devices.tv2.avOutput=1;
  const h=harness({devices,locked:["tv2"]});
  const result=await h.reconcile([event()]);
  assert.equal(result.ok,true);
  assert.deepEqual(h.commands,individual("hdbt",[],[1,2]));
  assert.equal(result.resources.find(row=>row.target==="tv1").deferred,true);
});

test("recovery defers physical TV commands when an announcement mapping is unknown",async()=>{
  const h=harness({devices:{screen:{enabled:true}},locked:["screen"]});
  const result=await h.reconcile([event()]);
  assert.equal(result.ok,true);
  assert.equal(h.commands.length,0);
  assert.ok(result.resources.every(row=>row.deferred));
  assert.equal(h.musicTicks,1);
});

test("recovery output overrides cannot target an announcement-owned physical output",async()=>{
  const h=harness({locked:["tv3"]});
  const result=await h.reconcile([event("individual","00:01",power(["tv1"],{state:"off",output:3}))]);
  assert.equal(result.ok,true);
  assert.equal(h.commands.length,0);
  assert.equal(result.resources[0].deferred,true);
});
''')
    raise SystemExit(0)
if sys.argv[1]!='source': raise SystemExit('Expected tests or source')
body=server.read_text()
def replace(old,new):
    global body
    if body.count(old)!=1: raise SystemExit('Source anchor changed: '+old[:100])
    body=body.replace(old,new,1)
replace('commandSource="automation",tvTargetsOverride=null}={}){','commandSource="automation",tvTargetsOverride=null,bypassAnnouncementPriority=false}={}){')
replace('''    const broadcastAction={all:"cecAllOutputs","hdmi-all":"cecAllHdmi","hdbt-all":"cecAllHdbt"}[broadcastTarget];''','''    let broadcastAction={all:"cecAllOutputs","hdmi-all":"cecAllHdmi","hdbt-all":"cecAllHdbt"}[broadcastTarget];''')
old='''    if(broadcastAction){
      // Match the proven Room controls path for the explicit all-TV selectors.
      outputs.results.push(await directPluto({action:broadcastAction,index:on?0:1}));
    }else{
      if(p.output!==undefined&&tvTargets.length===1){const output=Number(p.output);if(Number.isInteger(output)&&output>=1&&output<=8)tvTargets[0].output=output}
      for(const target of tvTargets){
        outputs.results.push(await directPluto({action:"cecOutput",output:target.output,connection:target.connection,index:on?0:1}));
      }
    }
    assertAdapterResults(outputs.results,{action:"TV power"});'''
new='''    const aggregate=requestedTargets.some(id=>["all","hdmi-all","hdbt-all"].includes(id));
    if(!aggregate&&p.output!==undefined&&tvTargets.length===1){const output=Number(p.output);if(Number.isInteger(output)&&output>=1&&output<=8)tvTargets[0].output=output}
    const initialLocks=bypassAnnouncementPriority?[]:announcementLockedDisplayTargets(["all"]);
    // Enforce physical ownership at the last shared dispatch boundary, after
    // individual output overrides and before any CEC write. An alias removed by
    // target deduplication must still protect its original physical output.
    if(initialLocks.length)broadcastAction=null;
    if(broadcastAction){
      outputs.results.push(await directPluto({action:broadcastAction,index:on?0:1}));
    }else{
      const deferred=new Set();
      for(const target of tvTargets){
        const locks=bypassAnnouncementPriority?[]:announcementLockedDisplayTargets(["all"]);
        const blocked=automationTvPowerPhysicalLocks(target,locks);
        if(blocked.length){for(const id of blocked)deferred.add(id);continue}
        outputs.results.push(await directPluto({action:"cecOutput",output:target.output,connection:target.connection,index:on?0:1}));
      }
      if(deferred.size){
        outputs.deferred=true;outputs.lockedTargets=[...deferred];
        if(!outputs.results.length){const error=new Error("TV power deferred for Morning Announcements physical output ownership");error.code="ANNOUNCEMENTS_PRIORITY_ACTIVE";error.targets=outputs.lockedTargets;throw error}
      }
    }
    assertAdapterResults(outputs.results,{action:"TV power"});'''
replace(old,new)
helper='''function automationTvPowerPhysicalLocks(target,lockedReceivers){
  const blocked=[];
  for(const rawId of lockedReceivers){
    const id=cleanId(rawId),receiver=devices[id];
    const explicit=receiver&&Object.prototype.hasOwnProperty.call(receiver,"avOutput");
    const value=explicit?receiver.avOutput:(/^tv[1-8]$/.test(id)?id.slice(2):null);
    const output=(typeof value==="number"||typeof value==="string"&&value.trim()!=="")?Number(value):NaN;
    // Do not guess an independent/named receiver's wiring. Unknown or invalid
    // mappings defer TV writes, and a known port protects both CEC transports.
    if(!Number.isInteger(output)||output<1||output>8||output===target.output)blocked.push(rawId);
  }
  return blocked;
}

'''
replace('function timerLinkedClassChain',helper+'function timerLinkedClassChain')
a=body.index('async function runClassroomAutomation')
b=body.index('function safeStoredName',a)
runner=body[a:b]
old='tvTargetsOverride:resolvedTvTargets?.filter(target=>resolvedTargets.includes(target.id))}'
if runner.count(old)!=2 or runner.count('pushResults(result.results);')!=2: raise SystemExit('Sequence dispatch sites changed')
runner=runner.replace(old,'tvTargetsOverride:resolvedTvTargets?.filter(target=>resolvedTargets.includes(target.id)),bypassAnnouncementPriority}')
runner=runner.replace('pushResults(result.results);','pushResults(result.results);\n            if(result.lockedTargets?.length)lockedTargets=[...new Set([...lockedTargets,...result.lockedTargets])];')
body=body[:a]+runner+body[b:]
old='''    try{const result=await runSingleAutomationAction(winner.event,{manual:false,skipOverlay:true,skipAudit:true,tvTargetsOverride:winner.tvTargetsOverride});resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,ok:true,result})}
    catch(error){resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,ok:false,error:error.message})}'''
new='''    try{const result=await runSingleAutomationAction(winner.event,{manual:false,skipOverlay:true,skipAudit:true,tvTargetsOverride:winner.tvTargetsOverride});resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,ok:true,result,...(result.deferred?{deferred:true,lockedTargets:result.lockedTargets}: {})})}
    catch(error){resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,...(error.code==="ANNOUNCEMENTS_PRIORITY_ACTIVE"?{ok:true,deferred:true,lockedTargets:error.targets||[]}:{ok:false,error:error.message})})}'''
replace(old,new)
server.write_text(body)
notes='''
Announcement TV-power protection is enforced again at the shared CEC dispatch
boundary using every locked receiver's physical `avOutput`, before deduplication
can hide aliases. Known legacy tv1..tv8 IDs may use their implicit same-number
port only when `avOutput` is absent. Explicit blank/invalid mappings and unmapped
named receivers fail closed: TV power is deferred, not guessed. A protected
physical port blocks both transports conservatively. Individual payload output
overrides are checked too, and locks are rechecked between individual writes.
Deferral is surfaced as priority ownership, not an adapter failure. Do not weaken
this boundary to an ID-only filter or automatically retry deferred CEC writes.
'''
for name in ['AGENTS.md','docs/AI-CONTEXT.md','docs/CONTROLLER.md','wiki/Automation-Display-Media.md']:
    file=root/name
    file.write_text(file.read_text().rstrip()+'\n'+notes)
file=root/'docs/TV-POWER-AUTOMATION.md'
body=file.read_text()
old='''This repair does not change the existing
receiver-to-physical-output priority mapping model, discover physical wiring, or
assert that a browser receiver's name identifies a particular physical panel.'''
new='''The last shared CEC dispatch boundary additionally
resolves all announcement receiver locks to their original physical outputs,
including named receivers and aliases discarded during target deduplication.
This uses configured mappings, not physical wiring discovery. It does not change
stored mappings or the per-target recovery winner scoring model.'''
if body.count(old)!=1: raise SystemExit('Priority documentation anchor changed')
body=body.replace(old,new,1)
body=body.replace('## Startup and Resume Scheduled State\n','## Physical announcement-output safety\n\n'+notes+'\n## Startup and Resume Scheduled State\n',1)
file.write_text(body)
file=root/'CHANGELOG.md'
body=file.read_text()
anchor='### Scheduled all-TV power handoff\n'
entry='''
- Guard actual CEC output ownership for announcement receivers, including named
  receivers, duplicate mappings and individual-output overrides. Unknown mappings
  defer TV writes safely; priority is rechecked between individual commands.
'''
if body.count(anchor)!=1: raise SystemExit('Changelog section changed')
file.write_text(body.replace(anchor,anchor+entry,1))
