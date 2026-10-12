"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),crypto=require("node:crypto");
const server=fs.readFileSync(require.resolve("../src/server.js"),"utf8");
const app=fs.readFileSync(require.resolve("../public/controller/app.js"),"utf8");
const editor=fs.readFileSync(require.resolve("../public/controller/automation-v2.js"),"utf8");
const day=new Date(2026,8,25,12);
function fixture(){
  const prior={id:"lesson",name:"Lesson",enabled:true,time:"08:58",targets:["tv1"],dates:["2026-12-23"]};
  const other={...prior,id:"transition",name:"AM transition",targets:[...prior.targets]};
  let simulate;
  const context=vm.createContext({crypto,calendarRuleForDate:()=>({type:"normal",label:"Normal Schedule"}),isAutomationSuppressed:()=>({blocked:false}),cleanId:x=>String(x||"").trim(),
    automationClassIds:()=>[],automationMatchesDate:(e,d)=>({match:e.dates.includes(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`)}),
    automationResourceKeys:e=>e.targets.map(id=>`display-content:${id}`),
    localDateKey:d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
    classroomAutomations:{events:[prior,other]},normalizeAutomation:(input,previous)=>({...previous,...input}),
    resolveAutomationForManualTest:e=>e,automationActionSequence:()=>[{action:"display.text"}],
    evaluateAutomationAt:()=>({}),schedulerClock:{now:()=>day},schedulerReadLimit(){},requireClassroomRead(){},
    app:{post:(url,...handlers)=>{simulate=handlers.at(-1)}}});
  // Freeze the route's default horizon at a known date without changing host time.
  vm.runInContext(`const NativeDate=Date;Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[${day.getTime()}]))}}`,context);
  vm.runInContext(server.slice(server.indexOf("function automationConflictDiagnostics("),server.indexOf('app.get("/api/v1/displays/:id/media/status"')),context);
  function request(body){let result,status=200;simulate({body},{status:n=>{status=n;return {json:x=>{result=x}}},json:x=>{result=x}});return {status,result}}
  return {context,prior,other,request};
}
test("simulation and saving both allow unchanged existing future overlaps",()=>{
  const {context,prior,request}=fixture();
  const {result}=request({...prior,name:"Edited lesson"});
  assert.equal(result.ok,true);assert.equal(result.conflicts.length,0);assert.equal(result.existingConflicts.length,1);
  assert.equal(result.existingConflicts[0].date,"2026-12-23");
  assert.doesNotThrow(()=>context.assertAutomationConflicts({...prior,name:"Edited lesson"},context.classroomAutomations.events,{previous:prior,startDate:day}));
});
test("new conflicts remain blocking even when another overlap already existed",()=>{
  const {context,prior,request}=fixture();
  context.classroomAutomations.events.push({...prior,id:"new-transition",targets:["tv2"]});
  const changed={...prior,targets:["tv1","tv2"]};const {result}=request(changed);
  assert.equal(result.ok,false);assert.equal(result.conflicts.length,1);assert.equal(result.existingConflicts.length,1);
  assert.equal(result.conflicts[0].otherId,"new-transition");
  assert.throws(()=>context.assertAutomationConflicts(changed,context.classroomAutomations.events,{previous:prior,startDate:day}),/new-transition|Lesson/);
});
test("changed shared resource sets are not grandfathered",()=>{
  const {prior,other,request}=fixture();other.targets.push("tv2");
  const {result}=request({...prior,targets:["tv1","tv2"]});
  assert.equal(result.ok,false);assert.equal(result.conflicts.length,1);assert.equal(result.existingConflicts.length,0);
});
test("disabled baselines, unknown IDs and new events cannot claim an existing overlap",()=>{
  for(const variant of ["disabled","unknown","new"]){
    const {prior,request}=fixture();const body={...prior,enabled:true};
    if(variant==="disabled")prior.enabled=false;
    if(variant==="unknown")body.id="unknown";
    if(variant==="new")delete body.id;
    body.previous={...prior,enabled:true};
    const {result}=request(body);assert.equal(result.ok,false,variant);assert.equal(result.existingConflicts.length,0,variant);
  }
});
test("disabled drafts have no blocking conflicts and draft simulation does not mutate saved state",()=>{
  const {prior,request}=fixture();const before=JSON.stringify(prior);
  assert.equal(request({...prior,enabled:false}).result.ok,true);assert.equal(JSON.stringify(prior),before);
});
function uiFixture(result){
  let saves=0;const context=vm.createContext({autoEnabled:{value:"0"},autoEditorMsg:{textContent:""},autoSteps:[{}],simulate:async()=>result,save:async()=>{saves++;return {ok:true}},window:{}});
  const start=app.indexOf("function automationValidationMessage("),end=app.indexOf("async function simulateAutomationEditor(",start);
  vm.runInContext(app.slice(start,end),context);
  const assignment=editor.slice(editor.indexOf("window.validateEnableAutomation=async()=>"),editor.indexOf("\n    window.RoomGoblinAutomationV2="));
  vm.runInContext(assignment,context);return {context,saves:()=>saves};
}
test("Save & Enable saves a warning-only simulation and retains actionable warning details",async()=>{
  const {prior,request}=fixture();const {result}=request(prior);const f=uiFixture(result);
  await f.context.window.validateEnableAutomation();assert.equal(f.saves(),1);
  assert.match(f.context.autoEditorMsg.textContent,/Saved & enabled.*Existing overlaps unchanged.*AM transition.*08:58.*2026-12-23.*tv1/);
});
test("Save & Enable never saves a blocking simulation and reports the conflicting schedule",async()=>{
  const {prior,request}=fixture();const {result}=request({...prior,id:"new"});const f=uiFixture(result);
  await assert.rejects(f.context.window.validateEnableAutomation(),/Resolve new schedule conflicts.*2026-12-23/);assert.equal(f.saves(),0);
});
test("save routes continue to enforce server-side create and edit validation",()=>{
  assert.match(server,/assertAutomationConflicts\(event,classroomAutomations\.events\);/);
  assert.match(server,/assertAutomationConflicts\(event,classroomAutomations\.events\.filter\(\(_,index\)=>index!==idx\),\{previous:prior\}\)/);
});

for(const type of ["half-day","1-hour-delay","2-hour-delay"]){
  test(`${type} overlaps never block new, edited or newly enabled automations`,async()=>{
    for(const kind of ["new","edit","enable"]){
      const {context,prior,request}=fixture();context.calendarRuleForDate=()=>({type,label:type});
      const candidate={...prior,enabled:true};
      if(kind==="new")candidate.id="new";
      if(kind==="enable")prior.enabled=false;
      const {result}=request(candidate);
      assert.equal(result.ok,true,kind);assert.equal(result.conflicts.length,0);
      assert.ok(result.specialDayConflicts.length>0);assert.equal(result.specialDayConflicts[0].calendarRule,type);
      assert.doesNotThrow(()=>context.assertAutomationConflicts(candidate,context.classroomAutomations.events,{previous:kind==="new"?null:prior,startDate:day}));
      const ui=uiFixture(result);await ui.context.window.validateEnableAutomation();assert.equal(ui.saves(),1);
      assert.match(ui.context.autoEditorMsg.textContent,/Special-day overlaps \(do not block saving\)/);
    }
  });
}
test("a full special-day warning list cannot hide a later normal-day conflict",()=>{
  const {context,prior,other,request}=fixture();
  const dates=Array.from({length:25},(_,i)=>{const d=new Date(day);d.setDate(d.getDate()+i);return context.localDateKey(d)});
  prior.dates=dates;other.dates=dates;
  context.calendarRuleForDate=d=>({type:context.localDateKey(d)===dates.at(-1)?"normal":"half-day"});
  const {result}=request({...prior,id:"new"});
  assert.equal(result.ok,false);assert.equal(result.specialDayConflicts.length,20);
  assert.equal(result.conflicts.length,2);assert.equal(result.conflicts[0].date,dates.at(-1));
});
test("no-school and remote days produce neither blockers nor special-day warnings",()=>{
  for(const type of ["no-school","remote"]){
    const {context,prior,request}=fixture();context.calendarRuleForDate=()=>({type});context.isAutomationSuppressed=()=>({blocked:true});
    const {result}=request({...prior,id:"new"});assert.equal(result.ok,true);
    assert.equal(result.conflicts.length,0);assert.equal(result.specialDayConflicts.length,0);
  }
});
test("a draft cannot label a normal date special to bypass validation",()=>{
  const {prior,request}=fixture();const {result}=request({...prior,id:"new",calendarRule:"half-day",specialDayConflicts:[]});
  assert.equal(result.ok,false);assert.equal(result.specialDayConflicts.length,0);
});
