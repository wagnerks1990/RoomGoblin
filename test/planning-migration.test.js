"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {ClassroomHubStorage}=require("../src/storage");
const school=require("../src/school-schedule"),planning=require("../src/planning");
const {migrateLegacyPlanning,convertLegacyPlanning,MIGRATION_KEY,BACKUP_KEY,publicMigrationReport}=require("../src/planning-migration");
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"rg-planning-import-"));
  const store=new ClassroomHubStorage({dataDir:root,dbFile:path.join(root,"test.db"),masterKeyFile:path.join(root,"missing")});
  t.after(()=>{store.db.close();fs.rmSync(root,{recursive:true,force:true})});
  const calendar={anchorDate:"2027-08-23",noSchoolDates:["2027-09-06"],excludedDates:["2027-09-06"],remoteDates:["2027-10-21"],halfDayDates:["2027-10-22"],oneHourDelayDates:["2027-10-26"],twoHourDelayDates:["2027-10-22","2027-10-27"]};
  const profile=school.normalizeSchoolScheduleProfile({...school.legacySchoolScheduleProfile(calendar),...planning.cyclePreset(),name:"Existing custom schedule",updatedAt:"saved",specialDaySchedules:[{id:"assembly",name:"Existing assembly",dates:["2027-10-25"],classTimes:{"teaching":{startTime:"10:00",endTime:"11:00"},"future-class":{startTime:"11:10",endTime:"11:30"}}}]});
  const classes=[
    {id:"opening",name:"Opening",period:"",scheduleMode:"weekly",days:[1,2,3,4,5],startTime:"07:00",endTime:"07:45",defaultTargets:["all"]},
    {id:"teaching",name:"Teaching",period:"1",scheduleMode:"schoolcycle",cycleDays:["A","C","E","G"],dayType:"Green",startTime:"07:45",endTime:"09:00",defaultTargets:["tv1","tv2"]},
    {id:"transition",name:"P1 transition",period:"1",scheduleMode:"schoolcycle",cycleDays:["A","C","E","G"],dayType:"Green",startTime:"09:00",endTime:"09:07",defaultTargets:["all"]},
    {id:"bison",name:"Bison continuation",period:"BISON-1",scheduleMode:"schoolcycle",cycleDays:["B"],dayType:"White",continuationOf:"teaching",startTime:"13:00",endTime:"13:35",defaultTargets:["tv1"]},
    {id:"closing",name:"Closing",period:"",scheduleMode:"weekly",days:[1,2,3,4,5],startTime:"14:30",endTime:"15:00",defaultTargets:["all"]},
    {id:"custom",name:"Custom weekly class",period:"Advisory",scheduleMode:"weekly",days:[5],includeDates:["2027-10-23"],excludedDates:["2027-10-22"],startTime:"15:00",endTime:"15:10",enabled:false,notes:"Retain this note",defaultTargets:["named-receiver"]}
  ];
  const events=[{id:"linked",name:"Linked content",enabled:true,classIds:["teaching","bison"],action:"display.text",targets:["tv1"],payload:{text:"Example"},timerOverlay:{enabled:true,followLinkedClasses:true}},
    {id:"weekly",name:"Weekend command",enabled:true,scheduleMode:"weekly",days:[6],time:"10:00",action:"tv.power",targets:["all"],payload:{state:"off"}}];
  store.setPreference("school.schedule.profile",profile);
  store.writeNormalized("class-schedules",{version:1,classes});
  store.writeNormalized("automations",{version:3,events});
  return {store,profile,calendar,classes,events,now:()=>"2027-10-18T10:00:00.000Z"};
}
test("upgrade imports regular/exception/special timetables and calendar with original group/cycle identity",t=>{
  const f=fixture(t),source=JSON.stringify(f.profile),beforeClasses=f.store.readNormalized("class-schedules"),beforeEvents=f.store.readNormalized("automations");
  const result=migrateLegacyPlanning(f),p=result.profile.planning;
  assert.equal(result.report.status,"imported");assert.equal(result.changed,true);assert.equal(p.enabled,false);
  assert.equal(p.timetables.find(table=>table.id===p.defaultTimetableId).blocks.length,f.classes.length);
  assert.deepEqual(result.profile.cycleDays,f.profile.cycleDays);assert.deepEqual(result.profile.dayGroups,f.profile.dayGroups);
  assert.deepEqual(result.profile.periodCycleDays,f.profile.periodCycleDays);assert.equal(result.profile.anchorDate,f.profile.anchorDate);
  assert.equal(p.dates["2027-09-06"].status,"no-school");assert.equal(p.dates["2027-10-21"].status,"remote");
  assert.equal(p.timetables.find(table=>table.id===p.dates["2027-10-22"].timetableId).name,"Imported half day");
  assert.equal(p.timetables.find(table=>table.id===p.dates["2027-10-25"].timetableId).name,"Existing assembly");
  assert.deepEqual(f.store.readNormalized("class-schedules"),beforeClasses);assert.deepEqual(f.store.readNormalized("automations"),beforeEvents);
  assert.equal(JSON.stringify(f.profile),source);assert.deepEqual(f.store.getPreference(BACKUP_KEY).profile,JSON.parse(source));
  assert.deepEqual(f.store.getPreference(BACKUP_KEY).calendar,f.calendar);
  assert.equal(publicMigrationReport(result.report).sourceHash,undefined);
});
test("converted timing stays keyed to each class, including shared period transitions and disabled/weekly blocks",t=>{
  const f=fixture(t),next=convertLegacyPlanning(f.profile,f.calendar,f.classes).profile;
  next.planning.enabled=true; // Inspect the imported drafts without activating saved runtime.
  for(const [date,rule] of [["2027-10-18","normal"],["2027-10-22","half-day"],["2027-10-26","1-hour-delay"],["2027-10-27","2-hour-delay"],["2027-10-25","special:assembly"]]){
    for(const cls of f.classes){
      const expected=school.effectiveTimesForRule(f.profile,cls,rule);
      const actual=planning.classSegments(next,f.calendar,cls,date);
      assert.deepEqual(actual.map(({startTime,endTime})=>({startTime,endTime})),expected?[expected]:[],`${date}/${cls.id}`);
    }
  }
  const regular=next.planning.timetables.find(table=>table.id===next.planning.defaultTimetableId);
  assert.notEqual(regular.blocks.find(block=>block.classId==="teaching").startTime,regular.blocks.find(block=>block.classId==="transition").startTime);
  assert.ok(next.planning.timetables.some(table=>table.blocks.some(block=>block.classId==="future-class")));
});
test("restart never reimports or overwrites later Planning edits or the original snapshot",t=>{
  const f=fixture(t);migrateLegacyPlanning(f);
  const backup=f.store.getPreference(BACKUP_KEY),profile=f.store.getPreference("school.schedule.profile");
  profile.planning.timetables[0].name="Operator revision";profile.planning.enabled=true;
  f.store.setPreference("school.schedule.profile",profile);
  const before=f.store.db.prepare("SELECT key,value_json,updated_at FROM system_preferences ORDER BY key").all();
  const result=migrateLegacyPlanning({...f,now:()=>"2099-01-01T00:00:00Z"});
  assert.equal(result.changed,false);assert.equal(result.profile.planning.timetables[0].name,"Operator revision");assert.equal(result.profile.planning.enabled,true);
  assert.deepEqual(f.store.getPreference(BACKUP_KEY),backup);assert.deepEqual(f.store.db.prepare("SELECT key,value_json,updated_at FROM system_preferences ORDER BY key").all(),before);
});
test("preexisting Planning configuration is preserved even when its resolver is off",t=>{
  const f=fixture(t);f.profile.planning.startDate="2027-08-23";f.profile.planning.endDate="2028-06-01";f.store.setPreference("school.schedule.profile",f.profile);
  const result=migrateLegacyPlanning(f);assert.equal(result.report.status,"preserved");assert.equal(result.changed,false);
  assert.deepEqual(f.store.getPreference("school.schedule.profile"),JSON.parse(JSON.stringify(f.profile)));assert.equal(f.store.getPreference(BACKUP_KEY),null);
});
test("transaction failure rolls back snapshot, profile and completion, and a later startup retries",t=>{
  const f=fixture(t),original=f.store.setPreference.bind(f.store),before=f.store.getPreference("school.schedule.profile");
  f.store.setPreference=(key,value)=>{if(key===MIGRATION_KEY)throw Error("Injected write failure");original(key,value)};
  const failed=migrateLegacyPlanning(f);assert.equal(failed.report.status,"failed");assert.equal(failed.profile,f.profile);
  assert.deepEqual(f.store.getPreference("school.schedule.profile"),before);assert.equal(f.store.getPreference(BACKUP_KEY),null);assert.equal(f.store.getPreference(MIGRATION_KEY),null);
  f.store.setPreference=original;assert.equal(migrateLegacyPlanning(f).report.status,"imported");
});
test("invalid legacy data leaves the active profile unchanged and reports a bounded review status",t=>{
  const f=fixture(t);f.classes[0].startTime="bad saved value";
  const result=migrateLegacyPlanning(f);assert.equal(result.report.status,"blocked");assert.equal(result.report.code,"SOURCE_REQUIRES_REVIEW");
  assert.deepEqual(f.store.getPreference("school.schedule.profile"),JSON.parse(JSON.stringify(f.profile)));assert.equal(f.store.getPreference(BACKUP_KEY),null);
  assert.equal(JSON.stringify(result.report).includes("bad saved value"),false);
  f.classes[0].startTime="07:00";assert.equal(migrateLegacyPlanning(f).report.status,"imported");
});
test("fresh empty installations do not create a migration marker or invent a school calendar",t=>{
  const f=fixture(t),profile=school.normalizeSchoolScheduleProfile(school.defaultSchoolScheduleProfile());f.store.setPreference("school.schedule.profile",profile);
  const result=migrateLegacyPlanning({...f,profile,calendar:{},classes:[],events:[]});assert.equal(result.report.status,"empty");assert.equal(f.store.getPreference(MIGRATION_KEY),null);assert.equal(f.store.getPreference(BACKUP_KEY),null);
});
