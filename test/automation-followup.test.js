"use strict";
const test=require("node:test");const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const server=fs.readFileSync(path.join(__dirname,"..","src","server.js"),"utf8"),controller=fs.readFileSync(path.join(__dirname,"..","public","controller","app.js"),"utf8"),html=fs.readFileSync(path.join(__dirname,"..","public","controller","index.html"),"utf8");
test("class includes cannot bypass global closure and enabled class writes validate overlap",()=>{const fn=server.slice(server.indexOf("function classScheduleMatchesDate"),server.indexOf("function classStartDate"));assert.ok(fn.indexOf("isCalendarBlocked(date).blocked")<fn.indexOf("includeDates"));assert.match(server,/assertClassScheduleConflicts\(cls/);assert.match(server,/CLASS_SCHEDULE_CONFLICT/)});
test("duplicates are drafts and class deletion protects continuation dependencies",()=>{const classDup=server.slice(server.indexOf('class-schedules/:id/duplicate'),server.indexOf('app.delete("/api/v1/class-schedules'));assert.match(classDup,/enabled:false/);assert.match(server,/type:\"continuation\"/)});
test("automation saves validate conflicts and configuration revisions",()=>{assert.match(server,/AUTOMATION_CONFLICT/);assert.match(server,/revision:Math.max\(1,Number\(prior.revision\|\|1\)\+1\)/);assert.match(server,/AUTOMATION_CONFIGURATION_CHANGED/)});
test("operator can cancel waiting work without pretending prior hardware was undone",()=>{assert.match(server,/automationCancelledOccurrences/);assert.match(server,/Cancellation requested\. Already-dispatched hardware actions are not undone/)});
test("draft simulation is side-effect free and draft live run is explicit",()=>{assert.match(server,/automations\/draft\/simulate/);const sim=server.slice(server.indexOf('automations/draft/simulate'),server.indexOf('automations/draft/run'));assert.doesNotMatch(sim,/runClassroomAutomation/);assert.match(controller,/simulateAutomationEditor/);assert.match(controller,/Run the current unsaved editor values on real classroom devices/)});
test("Today and Automation expose the same scheduler pause/resume control",()=>{assert.match(html,/todayAutomationToggle/);assert.match(html,/Resume Schedule/);assert.match(html,/automationToggleBtn/);assert.match(controller,/todayAutomationState/)});
test("Morning Announcement advanced values and timer gap round trip instead of hardcoding",()=>{assert.match(html,/morningWatchOfflineConfirmations/);assert.match(html,/morningWatchCheckInterval/);assert.match(html,/morningWatchTargets/);assert.doesNotMatch(controller,/targets:\['all'\],offlineConfirmations:2,checkIntervalSeconds:15/);assert.match(controller,/autoTimerOverlayFollowGap/)});
test("startup and operator resume share desired-state reconciliation including TV and lighting winners",()=>{assert.match(server,/currentAutomationNonDisplayWinners/);assert.match(server,/startup-reconcile/);assert.match(server,/resourceWinners/)});
test("recovery winner priority is deterministic and independent of updatedAt",()=>{const fn=server.slice(server.indexOf("function currentAutomationDisplayWinners"),server.indexOf("function runDisplayAutomationResync"));assert.match(fn,/storedEvent.priority/);assert.doesNotMatch(fn,/storedEvent.updatedAt/)});

test("additional action target defaults are serialized instead of only shown in the editor",()=>{
  const defaults=controller.slice(controller.indexOf("function defaultStepTargets"),controller.indexOf("function populateTimerOverlayClassSelect"));
  assert.match(defaults,/const first=stepTargetValues\(step\)\[0\]\?\.\[0\]/);
  assert.match(defaults,/\(!useEventTargets\?defaultStepTargets\(x\):\[\]\)/);
  const picker=controller.slice(controller.indexOf("function stepTargetOptions"),controller.indexOf("function updateAutomationStepTargets"));
  assert.match(picker,/defaultStepTargets\(step\)/);
});


test("server backfills saved cross-domain step defaults as well as the editor",()=>{
  const normalizer=server.slice(server.indexOf("function normalizeAutomation"),server.indexOf("function automationTargetDomain"));
  assert.match(normalizer,/defaultAutomationActionTargets\(stepAction\)/);
  assert.match(normalizer,/item\?\.useEventTargets!==false/);
});
