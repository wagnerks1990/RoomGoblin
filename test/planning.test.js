"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),crypto=require("node:crypto");
const engine=require("../src/planning"),school=require("../src/school-schedule");
const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
const preset=engine.cyclePreset();
function profile(planning={}){return school.normalizeSchoolScheduleProfile({...preset,anchorDate:"2027-10-18",updatedAt:"baseline",planning:{enabled:true,...planning}})}
function classes(p=profile()){return Object.entries(p.periodCycleDays).map(([period,cycleDays])=>({id:`class-${period}`,name:period,period,scheduleMode:"schoolcycle",cycleDays,dayType:period.startsWith("BISON-")?"White":Number(period)<5?"Green":"White",enabled:true,startTime:"08:00",endTime:"09:00"}))}
function splitTable(){return {id:"split",name:"Split lunch",blocks:[
  {id:"first",kind:"class",period:"1",startTime:"08:00",endTime:"08:45"},
  {id:"lunch",kind:"break",label:"Lunch",startTime:"08:45",endTime:"09:15"},
  {id:"second",kind:"class",period:"1",startTime:"09:20",endTime:"10:00"}
]}}
test("A–H rotation resolves exact Green/White regular and Bison memberships",()=>{
  const p=profile(),cs=classes(p),keys=["2027-10-18","2027-10-19","2027-10-20","2027-10-21","2027-10-22","2027-10-25","2027-10-26","2027-10-27"];
  keys.forEach((key,index)=>{
    const cycle=engine.cycleForDate(p,{},key);assert.equal(cycle.cycleDay,"ABCDEFGH"[index]);
    const actual=cs.filter(c=>engine.classMatches(p,{},c,key)).map(c=>c.period);
    const expected=index%2===0?["1","2","3","4"]:["5","6","7",`BISON-${index}`,`BISON-${index+1}`];
    assert.deepEqual(actual,expected);assert.equal(cycle.dayColor,index%2===0?"Green":"White");assert.equal(cycle.dayGroup.label,cycle.dayColor);
  });
});
test("calendar closures shift calculated rotation; explicit imported cycles remain fixed",()=>{
  const p=profile({dates:{"2027-10-19":{status:"no-school"},"2027-10-21":{status:"school",cycleDay:"D"}}});
  assert.equal(engine.cycleForDate(p,{},"2027-10-20").cycleDay,"B");
  assert.equal(engine.cycleForDate(p,{},"2027-10-21").cycleDay,"D");
  assert.equal(engine.cycleForDate(p,{},"2027-10-22").cycleDay,"D");
  const remote=profile({dates:{"2027-10-19":{status:"remote"},"2027-10-23":{status:"school",cycleDay:"H"}}});
  assert.equal(engine.cycleForDate(remote,{},"2027-10-20").cycleDay,"C");
  assert.equal(engine.cycleForDate(remote,{},"2027-10-23").cycleDay,"H");
  assert.equal(engine.cycleForDate(remote,{},"2027-10-15").cycleDay,"H");
});
test("school year bounds and reopening a closure are explicit",()=>{
  const p=profile({startDate:"2027-10-18",endDate:"2028-06-01",dates:{"2027-10-19":{status:"school"}}});
  assert.equal(engine.schoolStatus(p,{},"2028-06-02"),"no-school");
  assert.equal(engine.schoolStatus(p,{noSchoolDates:["2027-10-19"]},"2027-10-19"),"school");
});
test("one class resolves separate lunch segments, automation offsets, omitted periods, and remote suppression",()=>{
  const p=profile({timetables:[splitTable()],dates:{"2027-10-18":{status:"school",timetableId:"split"},"2027-10-20":{status:"remote",timetableId:"split"}}}),events=[{id:"show",name:"Show class",classIds:["class-1"],classTimeOffsetMinutes:-5}];
  const day=engine.resolveDay(p,{},classes(p),events,"2027-10-18");
  assert.deepEqual(day.rows.map(row=>row.startTime),["08:00","08:45","09:20"]);
  assert.deepEqual(day.rows.filter(r=>r.kind==="class").map(row=>row.classId),["class-1","class-1"]);
  assert.deepEqual(day.rows.filter(r=>r.kind==="class").map(row=>row.automations[0].time),["07:55","09:15"]);
  assert.equal(engine.classSegments(p,{},classes(p)[1],"2027-10-18").length,0);
  assert.equal(engine.resolveDay(p,{},classes(p),events,"2027-10-20").rows[0].automations[0].suppressed,true);
  assert.equal(engine.classSegments(p,{},classes(p)[0],"2027-10-22"),null);
});
test("planning validation rejects missing references, bad clocks, same-class overlap, and invalid calendars",()=>{
  for(const change of [p=>p.defaultTimetableId="missing",p=>p.dates={"2027-02-29":{status:"school"}},p=>p.dates={"2027-10-18":{status:"school",cycleDay:"Z"}},p=>p.timetables[0].blocks[0].startTime="24:00",p=>p.timetables[0].blocks[2].startTime="08:15",p=>p.weekdays=[7],p=>p.startDate="2027-10-18"]){
    const value={enabled:true,timetables:[splitTable()]};change(value);assert.throws(()=>engine.normalizePlanning(value,preset.cycleDays));
  }
  const value=profile({timetables:[splitTable()]});assert.deepEqual(school.normalizeSchoolScheduleProfile(JSON.parse(JSON.stringify(value))),value);
});
function install(ctx,names){for(const name of names){const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);const end=source.indexOf("\nfunction ",start+1);vm.runInContext(source.slice(start,end),ctx)}}
function runtime(){
  const p=profile({timetables:[splitTable()],dates:{"2027-10-18":{status:"school",timetableId:"split"}}});
  const ctx=vm.createContext({planningStudio:require("../src/planning-studio"),planningStudioConfig:{overlays:[]},Date,planningEngine:engine,schoolScheduleProfile:p,schedulerCalendar:{},classScheduleStore:{classes:classes(p)},...school,
    localDateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
    localMinutesNow:d=>d.getHours()*60+d.getMinutes(),timeToMinutes:s=>Number(s.slice(0,2))*60+Number(s.slice(3)),automationTargetDomain:()=>"display-content",schoolCycleAnchor:()=>p.anchorDate,periodDefaultCycleDays:key=>p.periodCycleDays[key]||[],isTransitionClass:()=>false});
  install(ctx,["classScheduleById","calendarRuleForDate","classScheduleMatchesDate","effectiveClassSegments","effectiveClassTimes","classStartDate","classEndDate","activeClassAt","automationClassIds","resolveAutomationForClass","resolveAutomationOccurrences"]);return ctx;
}
test("real scheduler emits distinct split occurrences and timers, with no active class at lunch",()=>{
  const ctx=runtime(),date=new Date(2027,9,18,8,10),event={classIds:["class-1"],targets:["tv1"]};
  const runs=ctx.resolveAutomationOccurrences(event,date);
  assert.equal(runs.length,2);assert.deepEqual(Array.from(runs,r=>r.time),["08:00","09:20"]);
  assert.equal(new Date(runs[0]._classEndAt).getMinutes(),45);assert.equal(new Date(runs[1]._classEndAt).getHours(),10);
  assert.equal(ctx.activeClassAt(new Date(2027,9,18,9,0)),null);
  assert.equal(ctx.activeClassAt(new Date(2027,9,18,9,30)).id,"class-1");
});
function routes({store,persist}={}){
  const registered=new Map(),writes=[];
  const context=vm.createContext({planningStudio:require("../src/planning-studio"),planningStudioConfig:{overlays:[]},isAutomationSuppressed:()=>({blocked:false}),resolveAutomationOccurrences:e=>[e],automationMatchesDate:()=>({match:true}),schoolCycleForDate:()=>({cycleDay:"A"}),crypto,Date,JSON,schoolScheduleProfile:profile(),schedulerCalendar:{},classScheduleStore:{classes:classes()},classroomAutomations:{events:[]},planningEngine:engine,normalizeSchoolScheduleProfile:school.normalizeSchoolScheduleProfile,validDateKey:school.validDateKey,validTime:school.validTime,
    schedulerReadLimit:()=>{},schedulerMutationLimit:()=>{},requireCapability:name=>({capability:name}),localDateKey:d=>d.toISOString().slice(0,10),schedulerClock:{now:()=>new Date("2027-10-18T12:00:00Z")},dateFromKey:key=>new Date(`${key}T12:00:00Z`),
    planningMigration:require("../src/planning-migration"),planningStartupMigration:{report:{version:1,status:"imported",sourceHash:"private-internal-hash",counts:{classes:15,automations:0,timetables:1,dates:0}}},
    app:Object.fromEntries(["get","post","put"].map(method=>[method,(path,...handlers)=>registered.set(`${method} ${path}`,handlers)])),dbStore:store||{tx:fn=>fn(),setPreference:(key,value)=>writes.push([key,value])},persistJson:persist||((key,value)=>writes.push([key,value])),CLASS_SCHEDULES_FILE:"classes",audit:()=>{}});
  vm.runInContext(source.slice(source.indexOf("function planningClassesForProfile("),source.indexOf('app.get("/api/v1/school-cycle"')),context);
  function request(method,path,body={}){const result={status:200};registered.get(`${method} ${path}`).at(-1)({body},{status(code){result.status=code;return this},json(value){result.body=value;return this}});return result}
  return {context,registered,writes,request};
}
test("planning API requires capability, previews without writes, rejects stale saves, and commits identities together",()=>{
  const {context,registered,writes,request}=routes();
  for(const handlers of registered.values())assert.ok(handlers.some(handler=>handler.capability==="schedule.manage"));
  const saved=request("get","/api/v1/planning").body;assert.equal(saved.migration.status,"imported");assert.equal(saved.migration.sourceHash,undefined);assert.equal(saved.migration.profile,undefined);
  const next=JSON.parse(JSON.stringify(context.schoolScheduleProfile));next.planning.dates["2027-10-19"]={status:"no-school"};
  const preview=request("post","/api/v1/planning/preview",{scheduleProfile:next,date:"2027-10-19"});
  assert.equal(preview.status,200);assert.equal(writes.length,0);assert.ok(preview.body.changes.length);
  const body={scheduleProfile:next,expectedUpdatedAt:"baseline",previewHash:preview.body.previewHash};
  assert.equal(request("put","/api/v1/planning",{...body,expectedUpdatedAt:"stale"}).status,409);
  context.schedulerCalendar.noSchoolDates=["2027-10-21"];assert.equal(request("put","/api/v1/planning",body).status,409);context.schedulerCalendar={};
  context.classroomAutomations.events.push({id:"new"});assert.equal(request("put","/api/v1/planning",body).status,409);context.classroomAutomations.events=[];
  assert.equal(request("put","/api/v1/planning",body).status,200);assert.equal(writes.length,2);
  assert.equal(context.schoolScheduleProfile.planning.dates["2027-10-19"].status,"no-school");
});
test("membership adjustments retain IDs, targets and custom cycle selections",()=>{
  const {context}=routes(),next=JSON.parse(JSON.stringify(context.schoolScheduleProfile));
  next.periodCycleDays["1"]=["A"];next.dayGroups[0].label="Updated Green";
  context.classScheduleStore.classes.push({...context.classScheduleStore.classes[0],id:"custom",cycleDays:["C"],defaultTargets:["named-display"]});
  const updated=context.planningClassesForProfile(next);
  assert.deepEqual(Array.from(updated[0].cycleDays),["A"]);assert.equal(updated[0].id,"class-1");
  assert.equal(updated[0].dayType,"Updated Green");assert.deepEqual(Array.from(updated.at(-1).cycleDays),["C"]);
  assert.deepEqual(Array.from(updated.at(-1).defaultTargets),["named-display"]);
  assert.deepEqual(context.classScheduleStore.classes[0].cycleDays,["A","C","E","G"]);
});
test("failed planning transaction leaves both live profile and class state intact",()=>{
  const {context,request}=routes(),beforeProfile=context.schoolScheduleProfile,beforeClasses=context.classScheduleStore;
  const next=JSON.parse(JSON.stringify(beforeProfile));next.periodCycleDays["1"]=["A"];
  const preview=request("post","/api/v1/planning/preview",{scheduleProfile:next,date:"2027-10-18"});
  context.dbStore.tx=()=>{throw Error("Disk unavailable")};
  assert.equal(request("put","/api/v1/planning",{scheduleProfile:next,previewHash:preview.body.previewHash,expectedUpdatedAt:"baseline"}).status,400);
  assert.equal(context.schoolScheduleProfile,beforeProfile);assert.equal(context.classScheduleStore,beforeClasses);
});

function sqliteRoutes(t){
  const path=require("node:path"),os=require("node:os"),{ClassroomHubStorage}=require("../src/storage");
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"rg-planning-save-")),file=path.join(root,"class-schedules.json");
  const store=new ClassroomHubStorage({dataDir:root,dbFile:path.join(root,"test.db"),masterKeyFile:path.join(root,"missing")});
  t.after(()=>{store.db.close();fs.rmSync(root,{recursive:true,force:true})});
  const fixture=routes({store,persist:(_key,value)=>store.writeJson(file,value)});
  store.setPreference("school.schedule.profile",fixture.context.schoolScheduleProfile);
  store.writeJson(file,fixture.context.classScheduleStore);
  return {...fixture,store};
}

for(const enabled of [true,false])test("planning review and save reject missing class references while enabled="+enabled,()=>{
  const {context,writes,request}=routes(),next=JSON.parse(JSON.stringify(context.schoolScheduleProfile));
  next.planning.enabled=enabled;next.planning.timetables=[splitTable()];next.planning.timetables[0].blocks[0].classId="missing-class";
  const preview=request("post","/api/v1/planning/preview",{scheduleProfile:next,date:"2027-10-18"});
  assert.equal(preview.status,400);assert.match(preview.body.error,/Split lunch.*missing-class/);
  const hash=context.planningDraft({scheduleProfile:next}).hash;
  assert.equal(request("put","/api/v1/planning",{scheduleProfile:next,expectedUpdatedAt:"baseline",previewHash:hash}).status,400);
  assert.equal(writes.length,0);
});

test("a removed class invalidates an earlier planning review before any write",()=>{
  const {context,writes,request}=routes(),next=JSON.parse(JSON.stringify(context.schoolScheduleProfile));
  next.planning.timetables=[splitTable()];next.planning.timetables[0].blocks[0].classId="class-1";
  const preview=request("post","/api/v1/planning/preview",{scheduleProfile:next,date:"2027-10-18"});assert.equal(preview.status,200);
  context.classScheduleStore.classes=context.classScheduleStore.classes.filter(cls=>cls.id!=="class-1");
  assert.equal(request("put","/api/v1/planning",{scheduleProfile:next,expectedUpdatedAt:"baseline",previewHash:preview.body.previewHash}).status,409);
  assert.equal(writes.length,0);
});

test("disabled saved classes and period-only blocks remain valid planning references",()=>{
  const {context,writes,request}=routes(),next=JSON.parse(JSON.stringify(context.schoolScheduleProfile));
  context.classScheduleStore.classes.find(cls=>cls.id==="class-1").enabled=false;
  next.planning.timetables=[splitTable()];next.planning.timetables[0].blocks[0].classId="class-1";
  const preview=request("post","/api/v1/planning/preview",{scheduleProfile:next,date:"2027-10-18"});assert.equal(preview.status,200);
  assert.equal(request("put","/api/v1/planning",{scheduleProfile:next,expectedUpdatedAt:"baseline",previewHash:preview.body.previewHash}).status,200);
  assert.equal(writes.length,2);
});

test("Planning save commits profile and normalized class membership through real nested SQLite writers",t=>{
  const {context,request,store}=sqliteRoutes(t),next=JSON.parse(JSON.stringify(context.schoolScheduleProfile));
  next.periodCycleDays["1"]=["A"];next.planning.dates["2027-10-18"]={status:"school",timetableId:"",cycleDay:"G",note:"Special day"};
  const preview=request("post","/api/v1/planning/preview",{scheduleProfile:next,date:"2027-10-18"});
  const result=request("put","/api/v1/planning",{scheduleProfile:next,previewHash:preview.body.previewHash,expectedUpdatedAt:"baseline"});
  assert.equal(result.status,200,result.body.error);
  assert.equal(store.getPreference("school.schedule.profile").planning.dates["2027-10-18"].cycleDay,"G");
  assert.deepEqual(store.readNormalized("class-schedules").classes.find(cls=>cls.id==="class-1").cycleDays,["A"]);
  assert.equal(context.schoolScheduleProfile.updatedAt,result.body.scheduleProfile.updatedAt);
  assert.equal(store.transactionDepth,0);
});

test("nested class-write failure rolls back Planning profile and rows, then a fresh preview can save",t=>{
  const {context,request,store}=sqliteRoutes(t),beforeProfile=store.getPreference("school.schedule.profile"),beforeClasses=store.readNormalized("class-schedules");
  const liveProfile=context.schoolScheduleProfile,liveClasses=context.classScheduleStore,next=JSON.parse(JSON.stringify(beforeProfile));
  next.periodCycleDays["1"]=["A"];
  const preview=request("post","/api/v1/planning/preview",{scheduleProfile:next,date:"2027-10-18"});
  const body={scheduleProfile:next,previewHash:preview.body.previewHash,expectedUpdatedAt:"baseline"};
  const original=store.setSetting.bind(store);store.setSetting=(key,value)=>{if(key==="class-schedules.meta")throw Error("Injected class write failure");return original(key,value)};
  assert.equal(request("put","/api/v1/planning",body).status,400);
  assert.deepEqual(store.getPreference("school.schedule.profile"),beforeProfile);assert.deepEqual(store.readNormalized("class-schedules"),beforeClasses);
  assert.equal(context.schoolScheduleProfile,liveProfile);assert.equal(context.classScheduleStore,liveClasses);assert.equal(store.transactionDepth,0);
  store.setSetting=original;
  const retry=request("post","/api/v1/planning/preview",{scheduleProfile:next,date:"2027-10-18"});
  assert.equal(request("put","/api/v1/planning",{...body,previewHash:retry.body.previewHash}).status,200);
});

test("caught nested failure rolls back its savepoint without committing or losing outer work",t=>{
  const {store}=sqliteRoutes(t);
  store.tx(()=>{
    store.setPreference("test.outer",1);
    assert.throws(()=>store.tx(()=>{store.setPreference("test.inner",2);throw Error("Inner failure")}),/Inner failure/);
    assert.equal(store.getPreference("test.inner"),null);assert.equal(store.getPreference("test.outer"),1);
    store.tx(()=>store.setPreference("test.second",3));
  });
  assert.equal(store.getPreference("test.outer"),1);assert.equal(store.getPreference("test.second"),3);assert.equal(store.transactionDepth,0);
  assert.throws(()=>store.tx(()=>{store.tx(()=>store.setPreference("test.rolled-back",4));throw Error("Outer failure")}),/Outer failure/);
  assert.equal(store.getPreference("test.rolled-back"),null);assert.equal(store.transactionDepth,0);
});

test("shared-layer API requires both capabilities and rejects stale rules without writing",()=>{
 const {registered,writes,context,request}=routes(),config={overlays:[{id:"notice",name:"Notice",scene:{layers:[{id:"text",type:"text",text:"Notice"}]}}]};
 for(const [path,handlers]of registered)if(path.includes("/planning/studio")){assert.ok(handlers.some(h=>h.capability==="schedule.manage"));assert.ok(handlers.some(h=>h.capability==="automation.manage"))}
 const preview=request("post","/api/v1/planning/studio/preview",{config,date:"2027-10-18"});assert.equal(preview.status,200,JSON.stringify(preview.body));assert.equal(writes.length,0);
 context.classroomAutomations.events.push({id:"changed",name:"Changed"});assert.equal(request("put","/api/v1/planning/studio",{config,previewHash:preview.body.previewHash}).status,409);assert.equal(writes.length,0);
 const fresh=request("post","/api/v1/planning/studio/preview",{config,date:"2027-10-18"});assert.equal(request("put","/api/v1/planning/studio",{config,previewHash:fresh.body.previewHash}).status,200);assert.equal(writes[0][0],"school.planning.studio.v1");
 const draft=JSON.parse(JSON.stringify(context.schoolScheduleProfile));draft.planning.dates["2027-10-19"]={status:"no-school"};const month=request("post","/api/v1/planning/preview",{scheduleProfile:draft,date:"2027-10-18",includeMonth:true});assert.equal(month.body.monthDays.length,31);assert.equal(month.body.monthDays.find(d=>d.date==="2027-10-19").status,"no-school");
});

test("SQLite preserves new scene, block, temporary window and date-only class metadata",t=>{
 const {store}=sqliteRoutes(t),scene={version:1,layers:[{id:"notice",type:"text",text:"School notice"}]};
 const event={id:"block-event",name:"Lunch",enabled:true,time:"11:00",blockIds:["lunch"],scheduleWindow:{startDate:"2027-10-18",endDate:"2027-10-18"},overlayPolicy:"selected",overlayIds:["notice"],action:"display.text",targets:["all"],payload:{scene},timerOverlay:{enabled:true,source:"end-time",endTime:"11:28"}};
 store.writeNormalized("automations",{events:[event]});const saved=store.readNormalized("automations").events[0];assert.deepEqual(saved.blockIds,["lunch"]);assert.deepEqual(saved.payload.scene,scene);assert.equal(saved.timerOverlay.endTime,"11:28");assert.deepEqual(saved.overlayIds,["notice"]);
 store.writeNormalized("class-schedules",{classes:[{id:"homeroom",name:"Homeroom",scheduleMode:"dates",includeDates:["2027-10-18"],startTime:"13:13",endTime:"14:45",enabled:true}]});const cls=store.readNormalized("class-schedules").classes[0];assert.equal(cls.scheduleMode,"dates");assert.deepEqual(cls.includeDates,["2027-10-18"]);
});
