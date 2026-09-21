"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const server=fs.readFileSync("src/server.js","utf8");
const controller=fs.readFileSync("public/controller/app.js","utf8");

test("manual automation tests do not weaken scheduled class-date enforcement",()=>{
  assert.match(server,/async function runAutomationTimerOverlay\(event,\{manual=false,commandSource="automation",targetsOverride=null,endAtOverride=null\}=\{\}\)/);
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

test("scheduled runner treats per-action repeat delay as dwell before advancing",()=>{
  assert.match(server,/const steps=automationActionSequence\(event\)/);
  assert.match(server,/repeatDelaySeconds is the dwell\/hold/);
  assert.match(server,/hasLaterEligibleAction\(i,pass\)/);
  assert.match(server,/const dwell=Math\.max\(0,Number\(step\.repeatDelaySeconds\|\|0\)\)/);
  assert.match(server,/await waitSeconds\(dwell\)/);
  assert.match(server,/sequenceHasEligibleActions\(steps,pass\+1\)/);
  assert.match(server,/sequenceHasContinuousActions\(steps\)/);
});

test("timer overlay can persist across every display action without resetting duration",()=>{
  assert.match(server,/coverage:String\(merged\.coverage\|\|"all-display-actions"\)/);
  assert.match(server,/overlayCoverage=event\.timerOverlay\?\.coverage==="action-1-only"\?"action-1-only":"all-display-actions"/);
  assert.match(server,/manualOverlayEndAt=event\.timerOverlay\?\.enabled&&event\.timerOverlay\?\.source!=="class-end"/);
  assert.match(server,/runAutomationTimerOverlay\(event,\{manual,targetsOverride:sourceTargets,endAtOverride:manualOverlayEndAt\}\)/);
  assert.match(server,/overlayCoverage==="all-display-actions"&&stepDomain==="display-content"/);
  assert.match(controller,/autoTimerOverlayCoverage/);
  assert.match(controller,/coverage:window\.autoTimerOverlayCoverage\?\.value==='action-1-only'\?'action-1-only':'all-display-actions'/);
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

test("automation trace recording appends without recursive helper calls",()=>{
  assert.match(server,/const pushStep=entry=>\{combined\.totalStepExecutions\+\+;combined\.steps\.push\(entry\)/);
  assert.doesNotMatch(server,/const pushStep=entry=>\{combined\.totalStepExecutions\+\+;pushStep\(entry\)/);
});
