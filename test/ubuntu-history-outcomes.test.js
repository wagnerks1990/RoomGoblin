"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {UbuntuDisplays,STORE}=require("../src/ubuntu-displays");
function fixture({failAt=Infinity,remoteFailure=false,scheduled=true}={}){
 let writes=0;const calls=[],audits=[],prefs=new Map();
 const record={id:"fixture",name:"Fixture",address:"10.0.0.8",port:22,fingerprint:"SHA256:"+"A".repeat(43),machineId:"b".repeat(64),config:{screens:[{receiverId:"screen"}]},state:"ready",scheduled:{id:"scheduled-job",state:"scheduled",operation:"update-browser",at:new Date(Date.now()-1000).toISOString()}};
 if(!scheduled)record.scheduled=null;
 prefs.set(STORE,[record]);
 const storage={getPreference:(key,fallback)=>structuredClone(prefs.get(key)??fallback),getSecret:()=>"synthetic-key",
  setPreference(key,value){if(++writes===failAt)throw Error("Fixture history persistence failure");prefs.set(key,structuredClone(value))}};
 const manager=new UbuntuDisplays({storage,autostart:false,audit:event=>audits.push(event),transport:async request=>{
  const body=JSON.parse(request.input);calls.push(body);if(remoteFailure)throw Error("Fixture transport uncertain");
  if(body.action==="status")return {identity:"fixture",machineId:record.machineId,protocolVersion:"2"};
  if(body.action==="maintenance")return {ok:true,accepted:true,job:{id:body.requestId,state:"running"}};
  if(body.action==="screenshot")return {ok:true,png:"fixture-png"};
  return {ok:true,accepted:true};
 }});
 return {manager,calls,audits,row:()=>manager.record("fixture"),writes:()=>writes};
}
function warning(result){assert.equal(result.ok,true);assert.match(result.warning,/history.*could not be saved/i)}
test("accepted Ubuntu commands retain their result when computer history cannot be saved",async()=>{
 const h=fixture({failAt:1}),result=await h.manager.command("fixture",{action:"identify"});warning(result);
 assert.equal(result.accepted,true);assert.equal(h.calls.length,1);assert.equal(h.manager.busy.size,0);assert.equal(h.audits[0].computerHistorySaved,false);assert.equal(h.audits[0].state,"accepted");
});
test("accepted Ubuntu maintenance retains its durable remote job identity after history failure",async()=>{
 const h=fixture({failAt:1}),result=await h.manager.maintenance("fixture",{operation:"update-browser",confirm:true,requestId:"owned-job"});warning(result);
 assert.equal(result.job.id,"owned-job");assert.equal(h.calls.filter(c=>c.action==="maintenance").length,1);assert.equal(h.manager.busy.size,0);assert.equal(h.audits[0].jobId,"owned-job");
});
test("saved Ubuntu metadata is reported as saved when only its history append fails",async()=>{
 const h=fixture({failAt:2}),result=await h.manager.edit("fixture",{name:"Saved",location:"Room",notes:"Note",address:"10.0.0.8",port:22});warning(result);
 assert.equal(h.row().name,"Saved");assert.equal(h.row().notes,"Note");assert.equal(h.calls.length,0);assert.equal(h.audits[0].kind,"ubuntu-display.details");
});
test("a persisted Ubuntu schedule remains accepted when its secondary history append fails",async()=>{
 const h=fixture({failAt:2,scheduled:false});
 const result=await h.manager.maintenance("fixture",{operation:"update-browser",confirm:true,scheduleAt:new Date(Date.now()+60000).toISOString()});warning(result);
 assert.equal(result.scheduled.state,"scheduled");assert.equal(h.row().scheduled.id,result.scheduled.id);assert.equal(h.calls.length,0);assert.equal(h.audits[0].kind,"ubuntu-display.scheduled");
});
test("a cancelled Ubuntu schedule is not reported as failed after a history error",()=>{
 const h=fixture({failAt:2}),result=h.manager.cancelScheduled("fixture");warning(result);assert.equal(h.row().scheduled.state,"cancelled");assert.equal(h.calls.length,0);
});
test("scheduled Ubuntu maintenance keeps its pre-dispatch claim after accepted-history failure",async()=>{
 const h=fixture({failAt:2});h.manager.live.set("fixture",{online:true});await h.manager.runScheduled("fixture");
 assert.equal(h.row().scheduled.state,"dispatched");assert.equal(h.calls.filter(c=>c.action==="maintenance").length,1);
 await h.manager.runScheduled("fixture");assert.equal(h.calls.filter(c=>c.action==="maintenance").length,1);assert.equal(h.audits[0].computerHistorySaved,false);
});
test("primary Ubuntu metadata persistence failures still reject without claiming success",async()=>{
 const h=fixture({failAt:1});await assert.rejects(h.manager.edit("fixture",{name:"Unsaved",address:"10.0.0.8",port:22}),/persistence failure/);
 assert.equal(h.row().name,"Fixture");assert.equal(h.audits.length,0);assert.equal(h.manager.busy.size,0);
});
test("a failed Ubuntu schedule claim prevents dispatch",async()=>{
 const h=fixture({failAt:1});h.manager.live.set("fixture",{online:true});await assert.rejects(h.manager.runScheduled("fixture"),/persistence failure/);
 assert.equal(h.row().scheduled.state,"scheduled");assert.equal(h.calls.length,0);assert.equal(h.audits.length,0);
});
test("uncertain Ubuntu transport still fails once and is never reported as accepted",async()=>{
 const h=fixture({remoteFailure:true});await assert.rejects(h.manager.command("fixture",{action:"identify"}),/transport uncertain/);
 assert.equal(h.calls.length,1);assert.equal(h.writes(),0);assert.equal(h.audits.length,0);assert.equal(h.manager.busy.size,0);
});
test("Ubuntu screenshots do not write command history",async()=>{
 const h=fixture({failAt:1}),result=await h.manager.command("fixture",{action:"screenshot",receiverId:"screen"});
 assert.equal(result.png,"fixture-png");assert.equal(result.warning,undefined);assert.equal(h.writes(),0);assert.equal(h.audits.length,0);
});
test("healthy Ubuntu history persists and retains its original success response",async()=>{
 const h=fixture(),result=await h.manager.command("fixture",{action:"identify"});assert.equal(result.ok,true);assert.equal(result.warning,undefined);
 assert.equal(h.row().history.at(-1).action,"identify");assert.equal(h.audits[0].kind,"ubuntu-display.command");
});
