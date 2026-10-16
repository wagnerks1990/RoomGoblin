"use strict";

const crypto = require("node:crypto");
const {normalizeSchoolScheduleProfile, effectiveTimesForRule, validDateKey} = require("./school-schedule");

const MIGRATION_KEY = "school.planning.import.v1";
const BACKUP_KEY = "school.planning.import.v1.original";
const PROFILE_KEY = "school.schedule.profile";
const VERSION = 1;
const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
const CATEGORIES = ["noSchoolDates", "excludedDates", "remoteDates", "halfDayDates", "oneHourDelayDates", "twoHourDelayDates"];

function hasPlanningConfiguration(planning) {
  return !!planning && (planning.enabled || planning.startDate || planning.endDate || planning.defaultTimetableId ||
    (planning.timetables || []).length || Object.keys(planning.dates || {}).length ||
    JSON.stringify(planning.weekdays || DEFAULT_WEEKDAYS) !== JSON.stringify(DEFAULT_WEEKDAYS));
}

function convertLegacyPlanning(profile, calendar, classes) {
  const timetables = [], dates = Object.create(null), tableForRule = new Map();
  let retainedEmptyTemplates = 0;
  function addTable(id, name, entries) {
    if (!entries.length) {retainedEmptyTemplates++; return ""}
    timetables.push({id, name, blocks:entries.map(([classId, times], index) => ({
      id:`entry-${index + 1}`, kind:"class", classId,
      period:classes.find(cls => cls.id === classId)?.period || "",
      label:classes.find(cls => cls.id === classId)?.name || "Saved class",
      startTime:times.startTime, endTime:times.endTime, cycleDays:[]
    }))});
    return id;
  }
  const regularId = addTable("imported-regular", "Imported regular schedule", classes.map(cls => [cls.id, cls]));
  const ruleNames = {"half-day":"Imported half day", "1-hour-delay":"Imported one-hour delay", "2-hour-delay":"Imported two-hour delay"};
  const rules = new Set(Object.keys(profile.exceptionRules || {}));
  for (const [field, rule] of [["halfDayDates","half-day"],["oneHourDelayDates","1-hour-delay"],["twoHourDelayDates","2-hour-delay"]]) {
    if ((calendar[field] || []).length) rules.add(rule);
  }
  for (const [index, rule] of [...rules].entries()) {
    const entries = classes.map(cls => [cls.id, effectiveTimesForRule(profile, cls, rule)]).filter(([,times]) => times);
    tableForRule.set(rule, addTable(`imported-rule-${index + 1}`, ruleNames[rule] || `Imported ${rule}`, entries));
  }
  for (const [index, schedule] of (profile.specialDaySchedules || []).entries()) {
    tableForRule.set(`special:${schedule.id}`, addTable(`imported-special-${index + 1}`, schedule.name, Object.entries(schedule.classTimes)));
  }
  const allDates = new Set(CATEGORIES.flatMap(field => calendar[field] || []));
  for (const schedule of profile.specialDaySchedules || []) for (const date of schedule.dates) allDates.add(date);
  for (const date of [...allDates].sort()) {
    if (!validDateKey(date)) throw Error("Invalid saved calendar date");
    const closed = (calendar.noSchoolDates || calendar.excludedDates || []).includes(date);
    const remote = (calendar.remoteDates || []).includes(date);
    const special = (profile.specialDaySchedules || []).find(schedule => schedule.dates.includes(date));
    const type = special ? `special:${special.id}` : (calendar.halfDayDates || []).includes(date) ? "half-day" :
      (calendar.twoHourDelayDates || []).includes(date) ? "2-hour-delay" : (calendar.oneHourDelayDates || []).includes(date) ? "1-hour-delay" : "normal";
    dates[date] = {status:closed ? "no-school" : remote ? "remote" : "school", cycleDay:"", timetableId:tableForRule.get(type) || "", note:"Imported from existing calendar"};
  }
  const next = normalizeSchoolScheduleProfile({...profile, planning:{
    version:1, enabled:false, startDate:"", endDate:"", weekdays:DEFAULT_WEEKDAYS,
    defaultTimetableId:regularId, timetables, dates
  }}, profile);
  return {profile:next, retainedEmptyTemplates};
}

// Startup only: no device calls, class writes, automation writes or scheduler toggle.
// SQLite owns the original snapshot, converted profile and completion record together.
function migrateLegacyPlanning({store, profile, calendar, classes, events = [], now = () => new Date().toISOString()}) {
  let current = profile;
  try {
    return store.tx(() => {
      const completed = store.getPreference(MIGRATION_KEY, null);
      const original = store.getPreference(PROFILE_KEY, null);
      current = normalizeSchoolScheduleProfile(original || profile, profile);
      if (["imported", "preserved"].includes(completed?.status)) return {profile:current, report:completed, changed:false};
      const sourceHash = crypto.createHash("sha256").update(JSON.stringify({profile:original || profile, calendar, classes, automationIds:events.map(event => event.id)})).digest("hex");
      if (completed?.status === "blocked" && completed.sourceHash === sourceHash) return {profile:current, report:completed, changed:false};
      if (hasPlanningConfiguration(current.planning)) {
        const report = {version:VERSION, status:"preserved", completedAt:now(), sourceHash};
        store.setPreference(MIGRATION_KEY, report);
        return {profile:current, report, changed:false};
      }
      if (!classes.length && !events.length && !CATEGORIES.some(field => calendar[field]?.length) && !current.specialDaySchedules.length && !Object.keys(current.exceptionRules).length) {
        return {profile:current, report:{version:VERSION,status:"empty"}, changed:false};
      }
      let converted;
      try {converted = convertLegacyPlanning(current, calendar, classes)}
      catch {
        const report = {version:VERSION, status:"blocked", completedAt:now(), sourceHash, code:"SOURCE_REQUIRES_REVIEW"};
        store.setPreference(MIGRATION_KEY, report);
        return {profile:current, report, changed:false};
      }
      const timestamp = now();
      converted.profile.updatedAt = timestamp;
      const report = {version:VERSION, status:"imported", completedAt:timestamp, sourceHash,
        counts:{classes:classes.length, automations:events.length, timetables:converted.profile.planning.timetables.length, dates:Object.keys(converted.profile.planning.dates).length},
        retainedEmptyTemplates:converted.retainedEmptyTemplates};
      if (!store.getPreference(BACKUP_KEY, null)) store.setPreference(BACKUP_KEY, {version:VERSION, savedAt:timestamp, profile:original || profile, calendar});
      store.setPreference(PROFILE_KEY, converted.profile);
      store.setPreference(MIGRATION_KEY, report);
      return {profile:converted.profile, report, changed:true};
    });
  } catch {
    // A failed transaction must not change in-memory scheduling or prevent the
    // existing scheduler from starting. A later startup can retry the import.
    return {profile, report:{version:VERSION,status:"failed",code:"IMPORT_NOT_COMMITTED"}, changed:false};
  }
}

function publicMigrationReport(report = {}) {
  return {version:report.version, status:report.status, completedAt:report.completedAt,
    counts:report.counts, retainedEmptyTemplates:report.retainedEmptyTemplates, code:report.code};
}
module.exports = {MIGRATION_KEY, BACKUP_KEY, migrateLegacyPlanning, convertLegacyPlanning, publicMigrationReport};
