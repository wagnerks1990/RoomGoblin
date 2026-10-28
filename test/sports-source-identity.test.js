"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const model=require("../src/sports"),{createSportsService}=require("../src/sports-service");
function fixture(fetchImpl=async()=>({body:Buffer.from('{"events":[]}')})){
 const config=model.normalize({teams:[{id:"team",name:"Example team",sport:"Soccer",category:"girls",season:"2026",level:"varsity",sources:[{id:"feed",url:"https://school.example/original",kind:"json",enabled:true,approved:true}]}],boards:[{id:"board",teamIds:["team"]}]});
 const values=new Map([[model.KEY,config]]),options={store:require('./helpers/preference-store.cjs')(values),now:()=>1000000,fetchImpl};
 return {service:createSportsService(options),options,values};
}
function unchecked(service){
 assert.equal(service.status()["team:feed"],undefined,"Retired source status remains visible");
 const update=model.project(service.read(),"board",{sourceStatus:service.status()}).updates;
 assert.equal(update.pending,1);assert.equal(update.lastCheckedAt,null);assert.equal(update.lastSuccessAt,null);
}
for(const [name,change]of [
 ["URL",team=>team.sources[0].url="https://school.example/replacement"],
 ["sport",team=>team.sport="Basketball"],
 ["category",team=>team.category="boys"],
 ["level",team=>team.level="jv"],
 ["season",team=>team.season="2027"]
])test(`changed ${name} retires source success before the next refresh`,async()=>{
 const {service}=fixture();await service.refresh();assert.equal(service.status()["team:feed"].lastSuccessAt,1000000);
 const next=service.read();change(next.teams[0]);service.save(next);unchecked(service);
});
test("removed sources disappear from status immediately",async()=>{
 const {service}=fixture();await service.refresh();const next=service.read();next.teams[0].sources=[];service.save(next);
 assert.deepEqual(service.status(),{});
});
test("late old-source completion cannot publish current source health",async()=>{
 let finish;const {service}=fixture(()=>new Promise(resolve=>{finish=resolve}));
 const pending=service.refresh(),next=service.read();next.teams[0].sources[0].url="https://school.example/replacement";service.save(next);
 finish({body:Buffer.from('{"events":[]}')});const result=await pending;
 unchecked(service);assert.equal(result.status["team:feed"],undefined);
});
test("restarting with retired persisted status leaves replacement source unchecked",async()=>{
 const {service,options}=fixture();await service.refresh();const next=service.read();next.teams[0].sources[0].url="https://school.example/replacement";service.save(next);
 unchecked(createSportsService(options));
});
test("friendly team names preserve the same source's successful check",async()=>{
 const {service}=fixture();await service.refresh();const next=service.read();next.teams[0].name="Renamed team";service.save(next);
 assert.equal(service.status()["team:feed"].lastSuccessAt,1000000);
 assert.equal(model.project(service.read(),"board",{sourceStatus:service.status()}).updates.pending,0);
});

test("save and undo HTTP responses include the current source-status snapshot",async t=>{
 const express=require("express"),multer=require("multer"),{rateLimit}=require("express-rate-limit"),{registerSportsRoutes}=require("../src/sports-routes");
 const {service,options}=fixture();await service.refresh();const app=express();app.use(express.json());
 const guard=(_q,_r,next)=>next(),runtime=registerSportsRoutes(app,{store:options.store,readGuard:guard,writeGuard:[guard],adminGuard:guard,canManageSources:()=>true,canRead:()=>true,canWrite:()=>true,canReadAssets:()=>true,assetGuard:guard,rateLimit,multer,canRun:()=>false});
 const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));
 t.after(()=>new Promise(resolve=>{runtime.close();server.closeAllConnections();server.close(resolve)}));
 const root=`http://127.0.0.1:${server.address().port}/api/v1/sports`;
 const next=runtime.service.read();next.teams[0].sources[0].url="https://school.example/replacement";
 const saved=await fetch(root,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(next)});assert.equal(saved.status,200);
 const result=await saved.json();assert.deepEqual(result.sources,{});
 const undo=await fetch(root+"/undo",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({revision:result.config.revision})});assert.equal(undo.status,200);
 assert.equal((await undo.json()).sources["team:feed"].lastSuccessAt,1000000);
});
