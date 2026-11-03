"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {IntegrationUpdates,apolloCandidate,newer,POLICY,STATE}=require("../src/integration-updates");
function device(){return {id:"apollo-1",name:"Test Apollo",generation:"one",mac:"02:00:00:00:00:01",online:true,enabled:true,info:{project_name:"ApolloAutomation.CAST-1",model:"esp32-s3",project_version:"26.9.21.1"},entities:[{id:"update:0:1",domain:"update",name:"Firmware Update"},{id:"select:0:2",domain:"select",name:"Firmware Channel"}],states:{"update:0:1":{current_version:"26.9.21.1",latest_version:"26.10.30.1"},"select:0:2":{state:"Stable"}}}}
function fixture(){
  const values=new Map(),devices=[device()],calls=[];let now=100000000,allowed=true,idle=true,failed=false;
  const storage={getPreference:(key,fallback)=>structuredClone(values.get(key)??fallback),setPreference:(key,value)=>values.set(key,structuredClone(value))};
  const manager=new IntegrationUpdates({storage,esp:{list:()=>({devices}),firmwareUpdate:async(id,version)=>{calls.push(["firmware",id,version]);if(failed)throw Error("lost")}},host:async(method,path,body)=>{calls.push([method,path,body]);if(path.endsWith("/check"))return {available:true,currentVersion:"2.10.8",latestVersion:"2.10.9"};if(path.endsWith("/job"))return {running:false,job:null};return {running:true}},canRun:()=>allowed,idle:async()=>{if(idle instanceof Error)throw idle;return idle},allowRecovery:()=>allowed,window:()=>({active:true,start:"02:00",end:"04:00"}),catalog:async()=>({version:"26.10.30.1"}),now:()=>now});
  return {manager,values,devices,calls,allow:value=>allowed=value,idle:value=>idle=value,fail:()=>failed=true,advance:ms=>now+=ms};
}
test("Apollo catalog requires pinned project, stable channel and matching native version",()=>{
  assert.equal(apolloCandidate(device()).available,true);
  for(const change of [d=>d.online=false,d=>d.enabled=false,d=>d.info.project_name="other",d=>d.info.model="other",d=>d.states["select:0:2"].state="Beta",d=>d.info.project_version="different",d=>d.entities.push({...d.entities[0]})]){const d=device();change(d);assert.equal(apolloCandidate(d),null)}
  assert.equal(newer("26.10.1.1","26.9.30.1"),true);assert.equal(newer("26.9.1.1","26.10.1.1"),false);
});
test("automatic policies default off and only accept enrolled Apollo devices",()=>{
  const h=fixture();assert.deepEqual(h.manager.policy(),{musicAssistant:false,recoverMusicAssistant:false,apollo:[]});
  assert.throws(()=>h.manager.configure({musicAssistant:true,recoverMusicAssistant:true,apollo:["other"]}));
  h.manager.configure({musicAssistant:true,recoverMusicAssistant:true,apollo:["apollo-1","apollo-1"]});assert.deepEqual(h.values.get(POLICY).apollo,["apollo-1"]);
  h.allow(false);assert.throws(()=>h.manager.configure({musicAssistant:false,recoverMusicAssistant:false,apollo:[]}));
});
test("disabled optional maintenance makes no host or player probes",async()=>{
  const h=fixture();h.manager.idle=async()=>{throw Error("must not probe")};await h.manager.tick();assert.deepEqual(h.calls,[]);assert.equal(h.manager.error,"");
});
test("firmware claim is durable before dispatch and exact reconnect establishes success",async()=>{
  const h=fixture();h.manager.esp.firmwareUpdate=async()=>assert.equal(h.values.get(STATE).apollo["apollo-1"].stage,"issued");
  await h.manager.install("apollo","apollo-1","26.10.30.1");assert.equal(h.manager.active(),true);
  h.devices[0].info.project_version="26.10.30.1";h.manager.reconcile();assert.equal(h.values.get(STATE).apollo["apollo-1"].stage,"succeeded");
});
test("offline, wrong MAC and changed enrollment cannot confirm firmware",async()=>{
  for(const change of [d=>d.online=false,d=>d.mac="02:00:00:00:00:02",d=>d.generation="two"]){
    const h=fixture();await h.manager.install("apollo","apollo-1","26.10.30.1");h.devices[0].info.project_version="26.10.30.1";change(h.devices[0]);h.advance(600001);h.manager.reconcile();assert.equal(h.values.get(STATE).apollo["apollo-1"].stage,"unconfirmed");
  }
});
test("uncertain firmware dispatch is never automatically or manually replayed",async()=>{
  const h=fixture();h.fail();await h.manager.install("apollo","apollo-1","26.10.30.1");
  assert.equal(h.values.get(STATE).apollo["apollo-1"].stage,"unconfirmed");await assert.rejects(h.manager.install("apollo","apollo-1","26.10.30.1"),/unconfirmed/);assert.equal(h.calls.filter(c=>c[0]==="firmware").length,1);
});
test("pending firmware survives owner reconstruction without replay",async()=>{
  const h=fixture();await h.manager.install("apollo","apollo-1","26.10.30.1");h.manager.configure({musicAssistant:false,recoverMusicAssistant:false,apollo:["apollo-1"]});
  await h.manager.tick();assert.equal(h.calls.filter(c=>c[0]==="firmware").length,1);h.advance(600001);await h.manager.tick();assert.equal(h.calls.filter(c=>c[0]==="firmware").length,1);
});
test("priority playback and freeze prevent update dispatch",async()=>{
  for(const mode of ["idle","freeze"]){const h=fixture();mode==="idle"?h.idle(false):h.allow(false);await assert.rejects(h.manager.install("apollo","apollo-1","26.10.30.1"));assert.equal(h.calls.length,0)}
});
test("a priority change during release discovery is rechecked before dispatch",async()=>{
  const h=fixture();h.manager.catalog=async()=>{h.idle(false);return {version:"26.10.30.1"}};await assert.rejects(h.manager.install("apollo","apollo-1","26.10.30.1"));assert.equal(h.calls.filter(c=>c[0]==="firmware").length,0);
});
test("automatic Music Assistant updates claim a release once",async()=>{
  const h=fixture();h.manager.configure({musicAssistant:true,recoverMusicAssistant:false,apollo:[]});await h.manager.tick();h.manager.hostRunning=false;await h.manager.tick();assert.equal(h.calls.filter(c=>c[1]==="/music-updates/start").length,1);
});
test("service recovery needs three failed reads and observes cooldown",async()=>{
  const h=fixture();h.manager.configure({musicAssistant:false,recoverMusicAssistant:true,apollo:[]});h.idle(Error("unavailable"));
  await h.manager.tick();await h.manager.tick();assert.equal(h.calls.filter(c=>c[1]==="/music-updates/recover").length,0);await h.manager.tick();assert.equal(h.calls.filter(c=>c[1]==="/music-updates/recover").length,1);h.manager.hostRunning=false;await h.manager.tick();assert.equal(h.calls.filter(c=>c[1]==="/music-updates/recover").length,1);
});
test("firmware status writes stop during Full Recovery freeze",async()=>{
  const h=fixture();await h.manager.install("apollo","apollo-1","26.10.30.1");h.devices[0].info.project_version="26.10.30.1";h.allow(false);h.manager.reconcile();assert.equal(h.values.get(STATE).apollo["apollo-1"].stage,"issued");h.allow(true);h.manager.reconcile();assert.equal(h.values.get(STATE).apollo["apollo-1"].stage,"succeeded");
});

test("maintenance routes enforce administrator access without charging rejected requests",async t=>{
  const express=require("express"),{once}=require("node:events"),{registerIntegrationUpdates}=require("../src/integration-updates");
  const app=express();app.use(express.json());const h=fixture();let starts=0;
  h.manager.install=async()=>{starts++;return {ok:true}};
  const isAdmin=req=>req.headers["x-test-admin"]==="yes",requireAdmin=(req,res,next)=>isAdmin(req)?next():res.status(403).json({ok:false});
  registerIntegrationUpdates(app,{manager:h.manager,requireAdmin,isAdmin});const server=app.listen(0,"127.0.0.1");await once(server,"listening");t.after(()=>{server.closeAllConnections();server.close()});
  const url=`http://127.0.0.1:${server.address().port}/api/v1/admin/music-maintenance`;
  for(let i=0;i<32;i++){const result=await fetch(url+"/install",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});assert.equal(result.status,403);await result.text()}
  assert.equal(starts,0);const result=await fetch(url,{headers:{"x-test-admin":"yes"}});assert.equal(result.status,200);assert.equal((await result.json()).policy.musicAssistant,false);
});
