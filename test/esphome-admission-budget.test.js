"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path");
const express=require("express");
const {registerESPHomeRoutes}=require("../src/esphome");
for(const [kind,limit,method,suffix] of [["inventory",600,"GET","/devices"],["discovery",12,"GET","/discovery"],["management",60,"POST","/devices"],["commands",240,"POST","/devices/node/entities/0:1/command"]])test("denied callers cannot consume the "+kind+" budget",async t=>{
 const app=express();app.use(express.json());const permitted=req=>req.get("x-fixture")==="yes";
 const guard=(req,res,next)=>permitted(req)?next():res.status(403).json({ok:false});
 const manager={list:()=>({ok:true}),discover:async()=>({ok:true}),save:async()=>({ok:true}),command:async()=>({ok:true})};
 registerESPHomeRoutes(app,{manager,requireRead:guard,requireControl:guard,requireAdmin:guard,canRead:permitted,canControl:permitted,isAdmin:permitted,owner:()=>"fixture"});
 const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));t.after(()=>{server.closeAllConnections();server.close()});
 async function request(allowed){const r=await fetch("http://127.0.0.1:"+server.address().port+"/api/v1/esphome"+suffix,{method,headers:{"x-fixture":allowed?"yes":"no","content-type":"application/json"},...(method==="GET"?{}:{body:"{}"})});await r.json();return r.status}
 for(let i=0;i<limit+5;i++)assert.equal(await request(false),403);
 for(let i=0;i<limit;i++)assert.equal(await request(true),200);
 assert.equal(await request(true),429);assert.equal(await request(false),403);
});


test("ESPHome production admission uses the administrator guard in token mode",()=>{
 const fs=require("node:fs"),vm=require("node:vm"),source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8"),start=source.indexOf("registerESPHomeRoutes(app,{"),end=source.indexOf("const ubuntuDisplays=",start);let options;
 const ctx=vm.createContext({app:{},esphomeManager:{},registerESPHomeRoutes:(_app,value)=>options=value,requireClassroomRead(){},requireCapability:()=>()=>{},requireAdmin(){},dbStore:{authEnabled:()=>false},requestUser:()=>null,hasRole:()=>false,hasCapability:()=>false,administratorAccessAllowed:()=>false,capabilityAccessAllowed:()=>false,trackFullExportMutation:fn=>fn,audit(){}});
 vm.runInContext(source.slice(start,end),ctx);assert.equal(options.isAdmin({}),false);
});

function productionOptions({enabled=true,token="fixture-control"}={}){
 const fs=require("node:fs"),vm=require("node:vm"),source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");let options;
 function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
 const ctx=vm.createContext({app:{},esphomeManager:{},registerESPHomeRoutes:(_app,value)=>options=value,CONTROL_TOKEN:token,dbStore:{authEnabled:()=>enabled,userCount:()=>1},requestUser:req=>req.user,
  hasRole:(user,role)=>user?.role===role,hasCapability:(user,cap)=>!!user?.capabilities?.some(value=>value===cap||value==="*"),secureTokenEqual:(a,b)=>a===b,trackFullExportMutation:fn=>fn,audit(){}});
 vm.runInContext(block("function authenticationUnavailable(","function requireMaintenanceAgent(")+block("registerESPHomeRoutes(app,{","const ubuntuDisplays="),ctx);
 return options;
}
function permittedBy(guard,req){let accepted=false;const res={status(){return res},json(){}};guard(req,res,()=>accepted=true);return accepted}
test("production predicates agree with all three guards for users and capabilities",()=>{
 const options=productionOptions();
 for(const user of [null,{role:"viewer",capabilities:["classroom.read"]},{role:"operator",capabilities:["classroom.read","integrations.control"]},{role:"admin",capabilities:["classroom.read"]},{role:"admin",capabilities:["*"]},{role:"operator",capabilities:[]}]){
  const req={user,get:()=>""};
  assert.equal(options.canRead(req),permittedBy(options.requireRead,req));assert.equal(options.canControl(req),permittedBy(options.requireControl,req));assert.equal(options.isAdmin(req),permittedBy(options.requireAdmin,req));
 }
});
test("production token-mode predicates agree with guards for correct, rejected and unconfigured tokens",()=>{
 for(const token of ["fixture-control",""]){const options=productionOptions({enabled:false,token});for(const supplied of ["fixture-control","wrong",""]){
  const req={get:()=>supplied};for(const [predicate,guard] of [["canRead","requireRead"],["canControl","requireControl"],["isAdmin","requireAdmin"]])assert.equal(options[predicate](req),permittedBy(options[guard],req));
 }}
});
test("route registration requires explicit shared predicates",()=>{
 for(const missing of ["canRead","canControl","isAdmin"]){const predicates={canRead:()=>true,canControl:()=>true,isAdmin:()=>true};delete predicates[missing];assert.throws(()=>registerESPHomeRoutes(express(),{...predicates}),/shared authorization predicates/)}
});
test("rejected legacy tokens do not exhaust the real administrator discovery guard",async t=>{
 const app=express(),options=productionOptions({enabled:false});let jobs=0;
 registerESPHomeRoutes(app,{...options,manager:{discover:async()=>{jobs++;return{ok:true}}},owner:()=>"fixture"});
 const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));t.after(()=>{server.closeAllConnections();server.close()});
 async function request(token){const response=await fetch("http://127.0.0.1:"+server.address().port+"/api/v1/esphome/discovery",{headers:{"x-control-token":token}});await response.json();return response}
 for(let i=0;i<20;i++)assert.equal((await request("wrong")).status,401);
 for(let i=0;i<12;i++)assert.equal((await request("fixture-control")).status,200);
 const limited=await request("fixture-control");assert.equal(limited.status,429);assert.ok(Number(limited.headers.get("retry-after"))>0);assert.ok(limited.headers.get("ratelimit"));
 assert.equal((await request("wrong")).status,401);assert.equal(jobs,12);
});
