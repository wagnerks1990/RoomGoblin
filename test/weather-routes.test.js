"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),{createRequire}=require("node:module"),express=require("express"),{rateLimit}=require("express-rate-limit");
test("real weather HTTP routes require authorization, preserve shared rules, and project receiver-safe data",async t=>{
 const source=fs.readFileSync(require.resolve("../src/server"),"utf8"),app=express();app.use(express.json());
 const cfg={enabled:true,latitude:40,longitude:-77,unit:"fahrenheit",label:"Test school"},weather={text:"76°F",widgets:{"weather-temperature":"76°F"},source:"Weather data: Open-Meteo",updatedAt:Date.now(),latitude:40,private:"must-not-reach-receiver"};
 const requireControl=(q,r,n)=>q.headers["x-test-role"]?n():r.status(401).json({error:"unauthorized"});
 const requireCapability=()=>((q,r,n)=>q.headers["x-test-role"]==="admin"?n():r.status(403).json({error:"forbidden"}));
 const ctx=vm.createContext({app,rateLimit,requireControl,requireCapability,requireAssetAccess:requireControl,Date,URL,URLSearchParams,AbortSignal,fetch:async()=>new Response('{}'),require:createRequire(require.resolve("../src/server")),planningStudio:require("../src/planning-studio"),planningStudioConfig:{weather:cfg,overlays:[]},planningWeather:{read:()=>weather,settled:async()=>{},status:()=>({})},dbStore:{setPreference:()=>{}},audit:()=>{}});
 const start=source.indexOf("const weatherReadLimit="),end=source.indexOf('function planningClassesForProfile(',start);vm.runInContext(source.slice(start,end),ctx);
 const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const base=`http://127.0.0.1:${server.address().port}/api/v1/weather`;
 for(const path of ["","/display"]){const r=await fetch(base+path);assert.equal(r.status,401);await r.text()}
 const read=await fetch(base+"/display",{headers:{"x-test-role":"reader"}});const projection=await read.json();assert.equal(projection.weather.latitude,undefined);assert.ok(!JSON.stringify(projection).includes("must-not-reach-receiver"));
 const forbidden=await fetch(base+"/config",{method:"PUT",headers:{"x-test-role":"reader","content-type":"application/json"},body:JSON.stringify(cfg)});assert.equal(forbidden.status,403);await forbidden.text();
 const rule={id:"existing",name:"Existing shared layer",scene:{layers:[]}};ctx.planningStudioConfig.overlays.push(rule);
 const save=await fetch(base+"/config",{method:"PUT",headers:{"x-test-role":"admin","content-type":"application/json"},body:JSON.stringify({...cfg,unit:"celsius"})});assert.equal(save.status,200);await save.text();assert.equal(ctx.planningStudioConfig.overlays[0].id,"existing");assert.equal(ctx.planningStudioConfig.weather.unit,"celsius");
 const scene=await fetch(base+"/scene",{method:"POST",headers:{"x-test-role":"reader","content-type":"application/json"},body:JSON.stringify({mode:"overlay",overlayFields:["temperature"]})});assert.equal(scene.status,200);assert.equal((await scene.json()).scene.transparent,true);
 const invalid=await fetch(base+"/scene",{method:"POST",headers:{"x-test-role":"reader","content-type":"application/json"},body:'{"days":999}'});assert.equal(invalid.status,400);await invalid.text();
});
