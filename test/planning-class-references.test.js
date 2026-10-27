"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function fixture({referenced=true,enabled=true,automations=[],continuation=false,failWrite=false}={}){
 const writes=[],routes=new Map(),original={classes:[{id:"kept",name:"Kept"},...(continuation?[{id:"next",name:"Next",continuationOf:"kept"}]:[])]};
 const ctx=vm.createContext({app:{delete:(route,...handlers)=>routes.set(route,handlers.at(-1))},schedulerMutationLimit:()=>{},requireCapability:()=>()=>{},
  classroomAutomations:{events:automations},automationClassIds:event=>event.classIds||[],classScheduleStore:original,
  schoolScheduleProfile:{planning:{enabled,timetables:[{id:"table",name:"Regular",blocks:referenced?[{id:"one",classId:"kept"},{id:"two",classId:"kept"}]:[]}]}},
  CLASS_SCHEDULES_FILE:"fixture",persistJson:(_file,value)=>{if(failWrite)throw Error("Storage unavailable");writes.push(value)}
 });
 vm.runInContext(section("function commitClassSchedules(","function normalizeClassSchedule(")+section('app.delete("/api/v1/class-schedules/:id"',"function evaluateAutomationAt("),ctx);
 function remove(id="kept"){let status=200,body;const res={status:value=>{status=value;return res},json:value=>{body=value;return res}};routes.get("/api/v1/class-schedules/:id")({params:{id}},res);return {status,body}}
 return {ctx,writes,original,remove};
}
for(const enabled of [true,false])test("class deletion protects timetable references while Planning is "+enabled,()=>{
 const h=fixture({enabled}),result=h.remove();assert.equal(result.status,409);assert.equal(h.writes.length,0);assert.equal(h.ctx.classScheduleStore,h.original);
 assert.deepEqual(JSON.parse(JSON.stringify(result.body.references)),[{type:"timetable",id:"table",name:"Regular"}]);
});
test("class deletion still protects existing automation and continuation references",()=>{
 const h=fixture({referenced:false,automations:[{id:"routine",name:"Routine",classIds:["kept"]}],continuation:true}),result=h.remove();
 assert.equal(result.status,409);assert.equal(h.writes.length,0);assert.deepEqual(Array.from(result.body.references,r=>r.type),["automation","continuation"]);
});
test("class deletion remains available after all timetable references are removed",()=>{
 const h=fixture({referenced:false}),result=h.remove();assert.equal(result.status,200);assert.equal(h.writes.length,1);assert.equal(h.ctx.classScheduleStore.classes.length,0);
});
test("missing class deletion and failed persistence never change the live class list",()=>{
 const missing=fixture({referenced:false});assert.equal(missing.remove("missing").status,404);assert.equal(missing.writes.length,0);
 const failed=fixture({referenced:false,failWrite:true});assert.equal(failed.remove().status,400);assert.equal(failed.writes.length,0);assert.equal(failed.ctx.classScheduleStore,failed.original);
});
