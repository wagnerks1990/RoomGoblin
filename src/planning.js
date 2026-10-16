"use strict";

const {validDateKey, validTime, groupForCycleDay} = require("./school-schedule");
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const own = (object, key) => Object.hasOwn(object || {}, key);
const idPattern = /^[a-zA-Z0-9._-]{1,80}$/;
function normalizePlanning(input = {}, cycleDays = ["A", "B"]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Error("Planning must be an object");
  const startDate = String(input.startDate || ""), endDate = String(input.endDate || "");
  if ((startDate || endDate) && (!validDateKey(startDate) || !validDateKey(endDate) || startDate > endDate)) throw Error("School year requires valid start and end dates in order");
  const weekdays = [...new Set(input.weekdays ?? [1, 2, 3, 4, 5])];
  if (!weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw Error("Choose valid school weekdays");
  const ids = new Set();
  if (!Array.isArray(input.timetables ?? []) || (input.timetables || []).length > 50) throw Error("At most 50 timetables are supported");
  const timetables = (input.timetables || []).map(table => {
    const id = String(table?.id || ""), name = String(table?.name || "").trim();
    if (!idPattern.test(id) || ids.has(id) || !name || name.length > 120) throw Error("Timetables require unique IDs and names");
    ids.add(id);
    if (!Array.isArray(table.blocks) || !table.blocks.length || table.blocks.length > 200) throw Error(`${name}: include 1–200 timetable blocks`);
    const blockIds = new Set();
    const blocks = table.blocks.map(block => {
      const bid = String(block?.id || ""), kind = block?.kind || "class";
      const period = String(block?.period || "").trim(), classId = String(block?.classId || "");
      const label = String(block?.label || period || "Block").trim().slice(0, 120);
      if (!idPattern.test(bid) || blockIds.has(bid)) throw Error(`${name}: block IDs must be unique`);
      blockIds.add(bid);
      if (!["class", "break", "event"].includes(kind) || (kind === "class" && !period && !classId) || period.length > 40 || (classId && !idPattern.test(classId))) throw Error(`${name}: invalid block identity`);
      if (!validTime(block.startTime) || !validTime(block.endTime) || minutes(block.startTime) >= minutes(block.endTime)) throw Error(`${name}: ${label} requires start before end`);
      const days = [...new Set(block.cycleDays || [])];
      if (days.some(day => !cycleDays.includes(day))) throw Error(`${name}: unknown cycle day`);
      return {id:bid, kind, period, classId, label, startTime:block.startTime, endTime:block.endTime, cycleDays:days};
    });
    for (const block of blocks.filter(b => b.kind === "class")) {
      for (const other of blocks.filter(b => b.kind === "class" && b.id !== block.id)) {
        if ((block.classId ? block.classId === other.classId : !other.classId && block.period === other.period) &&
            (!block.cycleDays.length || !other.cycleDays.length || block.cycleDays.some(day => other.cycleDays.includes(day))) &&
            block.startTime < other.endTime && other.startTime < block.endTime) throw Error(`${name}: overlapping segments for ${block.label}`);
      }
    }
    return {id, name, blocks};
  });
  const defaultTimetableId = String(input.defaultTimetableId || "");
  if (defaultTimetableId && !ids.has(defaultTimetableId)) throw Error("Regular timetable no longer exists");
  if (!input.dates || typeof input.dates !== "object" || Array.isArray(input.dates)) {
    if (input.dates !== undefined) throw Error("Calendar dates must be an object");
  }
  const dates = Object.create(null), entries = Object.entries(input.dates || {});
  if (entries.length > 2000) throw Error("At most 2000 calendar date overrides are supported");
  for (const [date, value] of entries) {
    if (!validDateKey(date) || !value || !["school", "no-school", "remote"].includes(value.status)) throw Error(`Invalid calendar date/status: ${date}`);
    const cycleDay = String(value.cycleDay || ""), timetableId = String(value.timetableId || "");
    if (cycleDay && !cycleDays.includes(cycleDay)) throw Error(`${date}: unknown cycle day`);
    if (timetableId && !ids.has(timetableId)) throw Error(`${date}: unknown timetable`);
    dates[date] = {status:value.status, cycleDay, timetableId, note:String(value.note || "").slice(0, 240)};
  }
  return {version:1, enabled:input.enabled === true, startDate, endDate, weekdays, defaultTimetableId, timetables, dates};
}

function schoolStatus(profile, calendar, key) {
  const p = profile.planning;
  if (p?.enabled && own(p.dates, key)) return p.dates[key].status;
  if ((calendar.noSchoolDates || calendar.excludedDates || []).includes(key)) return "no-school";
  if ((calendar.remoteDates || []).includes(key)) return "remote";
  if (p?.enabled && ((p.startDate && key < p.startDate) || (p.endDate && key > p.endDate))) return "no-school";
  const dow = new Date(`${key}T12:00:00Z`).getUTCDay();
  return (p?.enabled ? p.weekdays : [1,2,3,4,5]).includes(dow) ? "school" : "no-school";
}

function cycleForDate(profile, calendar, key) {
  const anchor = profile.anchorDate || calendar.anchorDate;
  const status = schoolStatus(profile, calendar, key), letters = profile.cycleDays;
  if (!validDateKey(key) || !validDateKey(anchor) || !letters?.length) return {cycleDay:null, dayColor:null, isStudentSchoolDay:false, reason:"Configure a cycle anchor"};
  const cursor = new Date(`${anchor}T12:00:00Z`), target = new Date(`${key}T12:00:00Z`);
  if (Math.abs(target-cursor) > 3660 * 86400000) throw Error("Planning dates must be within ten years of the cycle anchor");
  const step = target >= cursor ? 1 : -1;
  let offset = 0;
  while (cursor.getTime() !== target.getTime()) {
    if (step < 0 && schoolStatus(profile, calendar, cursor.toISOString().slice(0,10)) !== "no-school") offset--;
    cursor.setUTCDate(cursor.getUTCDate() + step);
    if (step > 0 && schoolStatus(profile, calendar, cursor.toISOString().slice(0,10)) !== "no-school") offset++;
  }
  const projected = letters[((offset % letters.length) + letters.length) % letters.length];
  const cycleDay = status === "no-school" ? null : (profile.planning?.enabled && profile.planning.dates[key]?.cycleDay || projected);
  return {date:key, anchorDate:anchor, isStudentSchoolDay:status !== "no-school", cycleDay,
    dayColor:cycleDay ? groupForCycleDay(profile, cycleDay)?.label || cycleDay : null,
    dayGroup:groupForCycleDay(profile, cycleDay || projected), projectedCycleDay:projected, projectedDayColor:groupForCycleDay(profile, projected)?.label || projected,
    index:letters.indexOf(cycleDay), reason:status === "no-school" ? "No school" : null};
}

function timetableForDate(profile, calendar, key) {
  const p = profile.planning;
  if (!p?.enabled) return null;
  const assigned = p.dates[key]?.timetableId;
  // Legacy exceptions remain authoritative unless a date explicitly selects a timetable.
  if (!assigned && (["halfDayDates", "oneHourDelayDates", "twoHourDelayDates"].some(field => (calendar[field] || []).includes(key)) || (profile.specialDaySchedules || []).some(table => table.dates.includes(key)))) return null;
  return p.timetables.find(table => table.id === (assigned || p.defaultTimetableId)) || null;
}

function classSegments(profile, calendar, cls, key) {
  const table = timetableForDate(profile, calendar, key);
  if (!table) return null;
  const cycle = cycleForDate(profile, calendar, key).cycleDay;
  const eligible = table.blocks.filter(block => block.kind === "class" && (!block.cycleDays.length || block.cycleDays.includes(cycle)));
  const exact = eligible.filter(block => block.classId === cls.id);
  return (exact.length ? exact : eligible.filter(block => !block.classId && block.period === cls.period))
    .map(block => ({startTime:block.startTime, endTime:block.endTime, segmentId:block.id}))
    .sort((a,b) => a.startTime.localeCompare(b.startTime));
}

function cyclePreset() {
  const green = ["A","C","E","G"], white = ["B","D","F","H"], periodCycleDays = {};
  for (const period of [1,2,3,4]) periodCycleDays[period] = green;
  for (const period of [5,6,7]) periodCycleDays[period] = white;
  for (let i=1;i<=8;i++) periodCycleDays[`BISON-${i}`] = [white[Math.floor((i-1)/2)]];
  return {cycleDays:["A","B","C","D","E","F","G","H"],
    dayGroups:[{id:"green",label:"Green",cycleDays:green,color:"#2aa866"},{id:"white",label:"White",cycleDays:white,color:"#eef4f8"}],periodCycleDays};
}

function classMatches(profile, calendar, cls, key) {
  if (cls.enabled === false || schoolStatus(profile, calendar, key) === "no-school" || (cls.excludedDates || []).includes(key)) return false;
  if ((cls.includeDates || []).includes(key)) return true;
  const cycle = cycleForDate(profile, calendar, key);
  if (cls.scheduleMode === "schoolcycle") {
    const days = cls.cycleDays?.length ? cls.cycleDays : profile.periodCycleDays[cls.period] || [];
    return (!days.length || days.includes(cycle.cycleDay)) && (!cls.dayType || ["Any","Mixed",cycle.dayColor].includes(cls.dayType));
  }
  if (!(cls.days || []).includes(new Date(`${key}T12:00:00Z`).getUTCDay())) return false;
  if (cls.scheduleMode !== "alternating") return true;
  return alternateCycle(profile, calendar, cls.anchorDate, key) === (cls.alternatePhase || "A");
}

function alternateCycle(profile, calendar, anchor, key) {
  return cycleForDate({...profile, anchorDate:anchor || profile.anchorDate, cycleDays:["A","B"], planning:{...profile.planning, dates:Object.fromEntries(Object.entries(profile.planning?.dates || {}).map(([date,value])=>[date,{...value,cycleDay:""}]))}}, calendar, key).cycleDay;
}

function resolveDay(profile, calendar, classes, events, key) {
  const cycle = cycleForDate(profile, calendar, key), status = schoolStatus(profile, calendar, key);
  const table = timetableForDate(profile, calendar, key);
  const {effectiveTimesForRule, specialDayRuleForDate} = require("./school-schedule");
  const legacyRule = specialDayRuleForDate(profile, key)?.type ||
    ((calendar.halfDayDates || []).includes(key) ? "half-day" : (calendar.twoHourDelayDates || []).includes(key) ? "2-hour-delay" : (calendar.oneHourDelayDates || []).includes(key) ? "1-hour-delay" : "normal");
  const rows = [];
  for (const cls of classes) {
    if (!classMatches(profile, calendar, cls, key)) continue;
    const times = classSegments(profile, calendar, cls, key) ?? [effectiveTimesForRule(profile, cls, legacyRule)].filter(Boolean);
    for (const segment of times) {
      const automations = events.filter(event => event.enabled !== false && (event.classIds?.length ? event.classIds : [event.classId]).includes(cls.id)).map(event => {
        const base = event.classTimeReference === "end" ? segment.endTime : segment.startTime;
        const offset = minutes(base) + Number(event.classTimeOffsetMinutes || 0);
        return {id:event.id, name:event.name, time:`${String(Math.floor(((offset%1440)+1440)%1440/60)).padStart(2,"0")}:${String(((offset%60)+60)%60).padStart(2,"0")}`, dayOffset:Math.floor(offset/1440), suppressed:status !== "school"};
      });
      rows.push({...segment, classId:cls.id, period:cls.period, name:cls.name, kind:"class", automations});
    }
  }
  if (status !== "no-school" && table) rows.push(...table.blocks.filter(block => block.kind !== "class" && (!block.cycleDays.length || block.cycleDays.includes(cycle.cycleDay))).map(block => ({...block, name:block.label, automations:[]})));
  rows.sort((a,b) => a.startTime.localeCompare(b.startTime));
  const warnings = [];
  for (let i=0;i<rows.length;i++) for (let j=i+1;j<rows.length;j++) {
    const a=rows[i], b=rows[j];
    if (a.startTime < b.endTime && b.startTime < a.endTime) warnings.push(`${a.name} overlaps ${b.name}`);
  }
  const fixedAutomations = events.filter(event => event.enabled !== false && !event.classIds?.length && !event.classId && (event.scheduleMode === "dates" ? (event.includeDates || []).includes(key) : classMatches(profile, calendar, event, key)))
    .map(event => ({id:event.id,name:event.name,time:event.time,suppressed:status !== "school"}));
  const legacyName = legacyRule.startsWith("special:") ? (profile.specialDaySchedules || []).find(item => `special:${item.id}` === legacyRule)?.name : {"half-day":"Half day","1-hour-delay":"One-hour delay","2-hour-delay":"Two-hour delay"}[legacyRule];
  return {date:key, status, cycle, timetable:table ? {id:table.id, name:table.name} : legacyName ? {id:`legacy:${legacyRule}`,name:legacyName} : null, rows, warnings, fixedAutomations,
    automationSuppressed:status !== "school", note:profile.planning?.dates[key]?.note || ""};
}
module.exports = {normalizePlanning, schoolStatus, cycleForDate, timetableForDate, classSegments, cyclePreset, classMatches, resolveDay, alternateCycle};
