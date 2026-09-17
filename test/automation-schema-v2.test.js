"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {
  AUTOMATION_SCHEMA_VERSION,
  automationActionSequence,
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
  assert.equal(migrated.automationSchemaVersion,AUTOMATION_SCHEMA_VERSION);
  assert.equal(migrated.actionSequence.length,2);
  assert.equal(migrated.actionSequence[0].action,"tv.power");
  assert.deepEqual(migrated.actionSequence[0].targets,["tv1"]);
  assert.equal(migrated.actionSequence[0].executionMode,"once");
  assert.equal(migrated.actionSequence[1].action,"display.media");
  assert.equal(migrated.actionSequence[1].executionMode,"loop");
  // Legacy mirrors remain available during the compatibility release.
  assert.equal(migrated.action,"tv.power");
  assert.equal(migrated.actions.length,1);
});

test("migration is idempotent",()=>{
  const first=migrateAutomationStore({version:1,events:[{id:"x",action:"display.clear",targets:["all"],payload:{}}]});
  assert.equal(first.changed,true);
  assert.equal(first.store.version,2);
  const second=migrateAutomationStore(first.store);
  assert.equal(second.changed,false);
  assert.deepEqual(second.store,first.store);
});

test("every action receives execution policy including action one",()=>{
  const event=eventFromActionSequence({id:"x"},[
    {action:"display.media",targets:["tv1"],payload:{storedName:"a.mp4"},executionMode:"loop"},
    {action:"govee.power",targets:["lights"],payload:{state:"on"},executionMode:"repeat",repeatCount:3,repeatDelaySeconds:2}
  ]);
  const sequence=automationActionSequence(event);
  assert.equal(sequence[0].executionMode,"loop");
  assert.equal(sequence[1].executionMode,"repeat");
  assert.equal(sequence[1].repeatCount,3);
  assert.equal(sequence[1].repeatDelaySeconds,2);
});

test("unbounded loop is media-only",()=>{
  const event=eventFromActionSequence({id:"x"},[{action:"tv.power",executionMode:"loop",repeatCount:4}]);
  assert.equal(automationActionSequence(event)[0].executionMode,"repeat");
});

test("media payload survives legacy conversion without losing clip controls",()=>{
  const payload={storedName:"lesson.mp4",fit:"contain",startAtSeconds:12.5,endAtSeconds:42,volume:.7,playbackRate:1.25,loop:true,muted:false};
  const event=normalizeAutomationEvent({action:"display.media",targets:["all"],payload});
  assert.deepEqual(event.actionSequence[0].payload,payload);
});
