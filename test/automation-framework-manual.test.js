"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const server=fs.readFileSync("src/server.js","utf8");
const controller=fs.readFileSync("public/controller/app.js","utf8");

test("manual automation tests do not weaken scheduled class-date enforcement",()=>{
  assert.match(server,/async function runAutomationTimerOverlay\(event,\{manual=false,commandSource="automation"\}=\{\}\)/);
  assert.match(server,/if\(!manual&&!classScheduleMatchesDate\(cls,now\)\)/);
  assert.match(server,/runAutomationTimerOverlay\(event,\{manual\}\)/);
  assert.match(server,/resolveAutomationForManualTest\(event\)/);
});

test("class default display targets remain domain-aware",()=>{
  assert.match(server,/_classDefaultTargets:\[\.\.\.\(cls\.defaultTargets\|\|\[\]\)\]/);
  assert.match(server,/event\.useClassTargets!==false&&Array\.isArray\(event\._classDefaultTargets\)/);
  assert.match(controller,/useClassTargets:autoUseClassTargets\.checked/);
  assert.match(controller,/autoUseClassTargets\.checked=e\.useClassTargets!==false/);
});

test("scheduled runner executes canonical sequence passes",()=>{
  assert.match(server,/const steps=automationActionSequence\(event\)/);
  assert.match(server,/while\(sequenceHasEligibleActions\(steps,pass\)\)/);
  assert.match(server,/if\(!actionEligibleOnPass\(step,pass\)\)continue/);
  assert.match(server,/sequenceHasContinuousActions\(steps\)/);
  assert.match(server,/Cap the fastest complete cycle at 1 Hz/);
});

test("Test Now and persisted run summaries expose action-level failures",()=>{
  assert.match(server,/function automationRunFailures\(result=\{\}\)/);
  assert.match(server,/failures:automationRunFailures\(result\)/);
  assert.match(server,/failures:automationRunFailures\(runResult\)/);
  assert.match(controller,/function automationRunFailureSummary\(result=\{\}\)/);
});

test("continuous scheduled automations recover after restart or operator resume",()=>{
  assert.match(server,/function recoverContinuousAutomationOccurrences\(reason="scheduler-recovery"\)/);
  assert.match(server,/sequenceHasContinuousActions\(automationActionSequence\(event\)\)/);
  assert.match(server,/continuousRecovery=await recoverContinuousAutomationOccurrences\("operator-resume"\)/);
  assert.match(server,/recoverContinuousAutomationOccurrences\("startup-reconcile"\)/);
  assert.match(server,/latest\?\.status==="cancelled"/);
  assert.match(server,/status:cancelled\?"cancelled":"failed"/);
});
