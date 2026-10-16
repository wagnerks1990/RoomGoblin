"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {normalizeSchoolScheduleProfile,effectiveTimesForRule,specialDayRuleForDate} = require("../src/school-schedule");
const date = "2027-10-15";
function template() {return {id:"pep-rally",name:"Pep rally",dates:[date],classTimes:{
  p1:{startTime:"07:50",endTime:"08:54"},p2:{startTime:"09:02",endTime:"09:56"},
  p4:{startTime:"10:04",endTime:"10:58"},p3:{startTime:"11:06",endTime:"13:05"}
}}}
function profile(items=[template()]) {return normalizeSchoolScheduleProfile({specialDaySchedules:items})}
test("special templates survive JSON persistence and preserve period reorder by class ID",()=>{
  const p=profile(), restored=normalizeSchoolScheduleProfile(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(restored,p);
  const rule=specialDayRuleForDate(restored,date);
  assert.equal(rule.label,"Pep rally");
  assert.equal(effectiveTimesForRule(restored,{id:"p4",period:"4"},rule.type).startTime,"10:04");
  assert.equal(effectiveTimesForRule(restored,{id:"p3",period:"3"},rule.type).startTime,"11:06");
  assert.equal(effectiveTimesForRule(restored,{id:"omitted"},rule.type),null);
  assert.equal(effectiveTimesForRule(restored,{id:"toString"},rule.type),null);
  assert.equal(specialDayRuleForDate(restored,"2027-10-18"),null);
  assert.deepEqual(effectiveTimesForRule(restored,{id:"p3",startTime:"09:00",endTime:"10:00"},"normal"),{startTime:"09:00",endTime:"10:00"});
});
test("reject ambiguous assignments, malformed dates and invalid intervals before saving",()=>{
  for(const change of [t=>t.dates=["2027-02-29"],t=>t.classTimes.p1.endTime="07:50",t=>t.classTimes.p1.startTime="24:00",t=>t.name="",t=>t.classTimes={}]){
    const t=template();change(t);assert.throws(()=>profile([t]));
  }
  assert.throws(()=>profile([template(),{...template(),id:"assembly"}]),/Only one/);
  assert.throws(()=>profile([template(),{...template(),dates:[]}]),/unique/);
  assert.equal(profile([{...template(),dates:[]}]).specialDaySchedules.length,1);
  assert.deepEqual(normalizeSchoolScheduleProfile({}).specialDaySchedules,[]);
});
function runtime() {
  const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
  const functions=["calendarRuleForDate","isCalendarBlocked","isAutomationSuppressed","classScheduleMatchesDate","effectiveClassSegments","effectiveClassTimes","classStartDate","classEndDate","automationClassIds","resolveAutomationForClass","resolveAutomationOccurrences"];
  const classes=[{id:"p3",name:"P3",period:"3",startTime:"09:00",endTime:"10:00",days:[5],enabled:true},{id:"omitted",days:[5]}];
  const ctx=vm.createContext({Date,planningEngine:require("../src/planning"),localMinutesNow:d=>d.getHours()*60+d.getMinutes(),timeToMinutes:s=>Number(s.slice(0,2))*60+Number(s.slice(3)),schoolScheduleProfile:profile(),schedulerCalendar:{},specialDayRuleForDate,effectiveTimesForRule,validTime:require("../src/school-schedule").validTime,
    localDateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
    classScheduleById:id=>classes.find(c=>c.id===id),automationTargetDomain:()=>"display-content",schoolCycleAnchor:()=>date,
    periodDefaultCycleDays:()=>[],isTransitionClass:()=>false});
  for(const name of functions){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0);const end=source.indexOf("\nfunction ",start+1);vm.runInContext(source.slice(start,end),ctx)}
  return {ctx,classes};
}
test("real class-linked occurrence resolver moves offsets and deadlines, skips omitted classes and respects closures",()=>{
  const {ctx,classes}=runtime(),day=new Date(2027,9,15,12);
  const event={classIds:["p3","omitted"],classTimeOffsetMinutes:-5,targets:["tv1"]};
  const runs=ctx.resolveAutomationOccurrences(event,day);
  assert.equal(runs.length,1);assert.equal(runs[0].time,"11:01");
  assert.equal(new Date(runs[0]._classEndAt).getHours(),13);
  assert.equal(new Date(runs[0]._classEndAt).getMinutes(),5);
  assert.equal(ctx.resolveAutomationForClass({...event,classTimeReference:"end"},"p3",day).time,"13:00");
  classes[0].days=[1];assert.equal(ctx.resolveAutomationOccurrences(event,day).length,0);classes[0].days=[5];
  ctx.schedulerCalendar.halfDayDates=[date];assert.equal(ctx.calendarRuleForDate(day).type,"special:pep-rally");
  ctx.schedulerCalendar.remoteDates=[date];assert.equal(ctx.isAutomationSuppressed(day).blocked,true);
  ctx.schedulerCalendar.noSchoolDates=[date];assert.equal(ctx.resolveAutomationOccurrences(event,day).length,0);
});
