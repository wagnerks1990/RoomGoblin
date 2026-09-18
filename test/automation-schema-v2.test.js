"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {
  AUTOMATION_SCHEMA_VERSION,
  automationActionSequence,
  actionEligibleOnPass,
  sequenceHasEligibleActions,
  sequenceHasContinuousActions,
  normalizeAutomationEvent,
  migrateAutomationStore,
  eventFromActionSequence
}=require("../src/automation-schema");

test("legacy primary plus additional actions migrates into one ordered sequence",()=>{
  const legacy={
    id:"morning",name:"Morning",action:"tv.power",targets:["tv1"],payload:{state:"on"},
    actions:[{id:"step-media",action:"display.media",targets:["tv1"],useEventTargets:false,payload:{storedName:"clip.mp4"},delaySeconds:3,executionMode:"loop"}]
  };
  const migrated=normalizeAutomationEvent(legacy);
  assert.equal(AUTOMATION_SCHEMA_VERSION,3);
  assert.equal(migrated.automationSchemaVersion,AUTOMATION_SCHEMA_VERSION);
  assert.equal(migrated.actionSequence.length,2);
  assert.equal(migrated.actionSequence[0].action,"tv.power");
  assert.equal(migrated.actionSequence[0].executionMode,"once");
  assert.equal(migrated.actionSequence[1].executionMode,"loop");
});

test("migration is idempotent",()=>{
  const first=migrateAutomationStore({version:1,events:[{id:"x",action:"display.clear",targets:["all"],payload:{}}]});
  assert.equal(first.changed,true);
  assert.equal(first.store.version,3);
  const second=migrateAutomationStore(first.store);
  assert.equal(second.changed,false);
  assert.deepEqual(second.store,first.store);
});

test("actions decide participation independently on each sequence pass",()=>{
  const event=eventFromActionSequence({id:"x"},[
    {action:"tv.power",executionMode:"once"},
    {action:"govee.power",executionMode:"repeat",repeatCount:3},
    {action:"display.media",executionMode:"loop",payload:{storedName:"a.mp4"}}
  ]);
  const [once,finite,continuous]=automationActionSequence(event);
  assert.equal(actionEligibleOnPass(once,1),true);
  assert.equal(actionEligibleOnPass(once,2),false);
  assert.equal(actionEligibleOnPass(finite,3),true);
  assert.equal(actionEligibleOnPass(finite,4),false);
  assert.equal(actionEligibleOnPass(continuous,1000),true);
  assert.equal(sequenceHasEligibleActions([once,finite],4),false);
  assert.equal(sequenceHasContinuousActions([once,finite,continuous]),true);
});

test("continuous loop is available to every action type",()=>{
  const event=eventFromActionSequence({id:"x"},[{action:"tv.power",executionMode:"loop"}]);
  assert.equal(automationActionSequence(event)[0].executionMode,"loop");
});

test("media payload loop follows execution mode",()=>{
  const event=eventFromActionSequence({id:"x"},[
    {action:"display.media",targets:["all"],payload:{storedName:"lesson.mp4",loop:true},executionMode:"once"}
  ]);
  assert.equal(automationActionSequence(event)[0].payload.loop,false);
});
