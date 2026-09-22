"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {
  AUTOMATION_SCHEMA_VERSION,
  automationActionSequence,
  actionEligibleOnPass,
  sequenceHasEligibleActions,
  sequenceNeedsAnotherPass,
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

test("receiver-native media loop does not create passes by itself",()=>{
  const mediaLoop={action:"display.media",executionMode:"loop",payload:{storedName:"loop.mp4"}};
  const once={action:"tv.power",executionMode:"once"};
  assert.equal(sequenceNeedsAnotherPass([mediaLoop,once],2),false);
});

test("two continual actions intentionally keep cycling",()=>{
  const first={action:"display.media",executionMode:"loop",payload:{storedName:"one.mp4"}};
  const second={action:"display.media",executionMode:"loop",payload:{storedName:"two.mp4"}};
  assert.equal(sequenceNeedsAnotherPass([first,second],2),true);
});

test("a sole continual survivor stops sequence processing",()=>{
  const once={action:"display.media",executionMode:"once",payload:{storedName:"intro.mp4"}};
  const loop={action:"govee.power",executionMode:"loop"};
  assert.equal(actionEligibleOnPass(once,2),false);
  assert.equal(actionEligibleOnPass(loop,2),true);
  assert.equal(sequenceNeedsAnotherPass([once,loop],2),false);
});

test("finite repeat may continue as the sole eligible action",()=>{
  const once={action:"tv.power",executionMode:"once"};
  const repeat={action:"govee.power",executionMode:"repeat",repeatCount:3};
  assert.equal(sequenceNeedsAnotherPass([once,repeat],2),true);
  assert.equal(sequenceNeedsAnotherPass([once,repeat],3),true);
  assert.equal(sequenceNeedsAnotherPass([once,repeat],4),false);
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
