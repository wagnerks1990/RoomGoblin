#!/usr/bin/env python3
from pathlib import Path

root=Path(__file__).resolve().parents[1]
p=root/'test/backend-production-regressions.test.js'
s=p.read_text()
old='''  const run=server.slice(server.indexOf("async function runClassroomAutomation"),server.indexOf("function safeStoredName"));
  assert.ok(run.indexOf("normalizeTimerOverlay")<run.indexOf("displayScope"));
'''
new='''  const run=server.slice(server.indexOf("async function runClassroomAutomation"),server.indexOf("function safeStoredName"));
  assert.match(run,/timerOverlay:normalizeTimerOverlay/);
  assert.doesNotMatch(run,/displayScope/);
  assert.doesNotMatch(run,/Pure non-display events.*clear all/s);
'''
if old not in s: raise SystemExit('backend regression timer/pre-clear expectation not found')
s=s.replace(old,new,1)
insert='''
test("automation resource isolation removes global pre-clear and uses per-output TV power",()=>{
  const run=server.slice(server.indexOf("async function runClassroomAutomation"),server.indexOf("function safeStoredName"));
  assert.doesNotMatch(run,/id:\"pre-clear\"/);
  assert.match(run,/no automation implicitly clears display content/);
  const single=server.slice(server.indexOf("async function runSingleAutomationAction"),server.indexOf("function timerLinkedClassChain"));
  assert.match(single,/expandTvTargets\(event\.targets/);
  assert.match(single,/action:\"cecOutput\"/);
  assert.doesNotMatch(single,/cecAllOutputs/);
  assert.match(single,/assertAdapterResults\(outputs\.results,\{action:\"TV power\"\}\)/);
});

test("scheduler discovery is non-blocking and class occurrences still honor global suppression",()=>{
  const scheduler=server.slice(server.indexOf("// Unified Classroom Automation scheduler"),server.indexOf("// Legacy per-output Pluto schedules"));
  assert.match(scheduler,/automationRunLedger\.claim/);
  assert.match(scheduler,/automationRunningOccurrences\.set/);
  assert.match(scheduler,/isAutomationSuppressed\(now\)\.blocked/);
  assert.doesNotMatch(scheduler,/await runClassroomAutomation\(event\)/);
});
'''
marker='test("Morning Announcements probes use the display allowlist and validate every redirect",()=>{'
if insert.strip() not in s:
    if marker not in s: raise SystemExit('backend regression insertion point not found')
    s=s.replace(marker,insert+'\n'+marker,1)
p.write_text(s)

p=root/'test/school-schedule.test.js'
s=p.read_text()
extra='''

test("exception transforms reject inverted and zero-length school days",()=>{
  assert.throws(()=>normalizeSchoolScheduleProfile({
    cycleDays:["A"],dayGroups:[{id:"a",label:"A",cycleDays:["A"]}],
    exceptionRules:{delay:{transform:{normalStart:"08:00",normalEnd:"15:00",delayedStart:"15:00"}}}
  }),/delayed start must be before normal end/);
  assert.throws(()=>normalizeSchoolScheduleProfile({
    cycleDays:["A"],dayGroups:[{id:"a",label:"A",cycleDays:["A"]}],
    exceptionRules:{delay:{transform:{normalStart:"15:00",normalEnd:"08:00",delayedStart:"07:00"}}}
  }),/normal start must be before normal end/);
});
'''
if 'exception transforms reject inverted and zero-length school days' not in s:s+=extra
p.write_text(s)
