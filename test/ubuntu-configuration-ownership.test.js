"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {UbuntuDisplays,screenConfig,STORE}=require("../src/ubuntu-displays");
function fixture(){
 const prefs=new Map(),secrets=new Map(),calls=[];
 const outputs=[{connector:"HDMI-1",connected:true,monitorId:"a".repeat(64),modes:["1920x1080"]}];
 const input={hubUrl:"http://10.0.0.2:3000",screens:[{...outputs[0],receiverId:"screen1",name:"Fixture screen"}]};
 const probe={machineId:"b".repeat(64),outputs,graphics:"x11",distribution:"ubuntu",version:"24.04",architecture:"x86_64",identity:"fixture"};
 let resolve,reject,entered,failSave=false;
 const sent=new Promise(r=>entered=r),gate=new Promise((yes,no)=>{resolve=yes;reject=no});
 const storage={
  getPreference:(k,d)=>structuredClone(prefs.get(k)??d),
  setPreference:(k,v)=>{if(failSave)throw Error("Fixture persistence unavailable");prefs.set(k,structuredClone(v));},
  getSecret:k=>secrets.get(k),tx:f=>f(),displayCredentialPolicy:()=>({authenticationRequired:false})
 };
 const manager=new UbuntuDisplays({storage,autostart:false,transport:async request=>{
  const body=JSON.parse(request.input);calls.push(body);
  if(body.action==="status")return probe;
  assert.equal(body.action,"configure");entered();return gate;
 }});
 const config=screenConfig(input,probe);
 storage.setPreference(STORE,[{id:"fixture",name:"Fixture",address:"10.0.0.8",port:22,fingerprint:"SHA256:"+"A".repeat(43),machineId:probe.machineId,state:"ready",config,scheduled:{id:"job",state:"scheduled",operation:"update-browser",at:new Date(Date.now()+60000).toISOString()}}]);
 secrets.set("ubuntu-display.fixture.ssh","synthetic-key");
 const next={...input,screens:input.screens.map(s=>({...s,name:"Updated screen",rotation:"left"}))};
 return {manager,input,next,sent,resolve,reject,calls,failSave:()=>{failSave=true;},row:()=>manager.record("fixture")};
}
test("screen assignment save cannot restore a concurrently cancelled maintenance schedule",async()=>{
 const h=fixture(),pending=h.manager.configure("fixture",h.next);await h.sent;
 h.manager.cancelScheduled("fixture");h.resolve({ok:true});await pending;
 assert.equal(h.row().scheduled.state,"cancelled");assert.equal(h.row().scheduled.id,"job");
 assert.equal(h.row().config.screens[0].rotation,"left");
});
test("screen assignment save retains the cancellation history appended during remote configuration",async()=>{
 const h=fixture(),pending=h.manager.configure("fixture",h.next);await h.sent;
 h.manager.cancelScheduled("fixture");const history=h.row().history;h.resolve({ok:true});await pending;
 assert.deepEqual(h.row().history,history);assert.equal(h.row().history.at(-1).kind,"schedule-cancelled");
});
test("screen assignment save only updates config and retains newer record metadata",async()=>{
 const h=fixture(),pending=h.manager.configure("fixture",h.next);await h.sent;
 h.manager.updateRecord("fixture",{notes:"Newer note",reported:{protocolVersion:"2"},lastSeenAt:"2026-10-28T10:00:00Z"});
 h.resolve({ok:true});await pending;
 assert.equal(h.row().notes,"Newer note");assert.equal(h.row().reported.protocolVersion,"2");
 assert.equal(h.row().lastSeenAt,"2026-10-28T10:00:00Z");assert.equal(h.row().config.screens[0].name,"Updated screen");
});
test("uncertain remote configuration preserves a cancellation and never retries dispatch",async()=>{
 const h=fixture(),original=h.row().config,pending=h.manager.configure("fixture",h.next);await h.sent;
 h.manager.cancelScheduled("fixture");h.reject(Error("Fixture uncertain delivery"));
 await assert.rejects(pending,/uncertain delivery/);
 assert.equal(h.row().scheduled.state,"cancelled");assert.deepEqual(h.row().config,original);
 assert.equal(h.calls.filter(c=>c.action==="configure").length,1);assert.equal(h.manager.busy.size,0);assert.equal(h.manager.configuring,false);
});
test("failed configuration persistence stays visible and retains the saved cancellation",async()=>{
 const h=fixture(),original=h.row().config,pending=h.manager.configure("fixture",h.next);await h.sent;
 h.manager.cancelScheduled("fixture");h.failSave();h.resolve({ok:true});
 await assert.rejects(pending,/persistence unavailable/);
 assert.equal(h.row().scheduled.state,"cancelled");assert.deepEqual(h.row().config,original);
 assert.equal(h.calls.filter(c=>c.action==="configure").length,1);assert.equal(h.manager.busy.size,0);assert.equal(h.manager.configuring,false);
});
test("configuration continues to reject an overlapping second assignment",async()=>{
 const h=fixture(),pending=h.manager.configure("fixture",h.next);await h.sent;
 await assert.rejects(h.manager.configure("fixture",h.input),/busy/);
 h.resolve({ok:true});await pending;
 assert.equal(h.calls.filter(c=>c.action==="configure").length,1);assert.equal(h.row().config.screens[0].rotation,"left");
});
test("screen assignments reject an announcement lock on a newly selected receiver",async()=>{
 const h=fixture();h.next.screens[0].receiverId="new-screen";h.manager.allowDisruption=d=>!d.config.screens.some(s=>s.receiverId==="new-screen");h.resolve({ok:true});
 await assert.rejects(h.manager.configure("fixture",h.next),/Announcements/);assert.equal(h.calls.filter(c=>c.action==="configure").length,0);
});
test("screen assignments durably protect old and new targets until their acknowledgment",async()=>{
 const h=fixture();h.next.screens[0].receiverId="new-screen";const pending=h.manager.configure("fixture",h.next);await h.sent;
 try{assert.deepEqual(h.row().pendingReceiverIds,["screen1","new-screen"])}finally{h.resolve({ok:true});await pending}
 assert.deepEqual(h.row().pendingReceiverIds,[]);assert.equal(h.row().config.screens[0].receiverId,"new-screen");
});
test("uncertain assignment targets still block conflicting commands after manager restart",async()=>{
 const h=fixture();h.next.screens[0].receiverId="new-screen";const pending=h.manager.configure("fixture",h.next);await h.sent;h.reject(Error("Synthetic uncertain reply"));await assert.rejects(pending,/uncertain reply/);
 const restarted=new UbuntuDisplays({storage:h.manager.storage,autostart:false,transport:async()=>{throw Error("Unexpected dispatch")},allowDisruption:d=>!d.config.screens.some(s=>s.receiverId==="new-screen")});
 await assert.rejects(restarted.command("fixture",{action:"identify"}),/Announcements/);assert.equal(h.row().config.screens[0].receiverId,"screen1");
});
test("failed assignment target persistence prevents any remote configuration write",async()=>{
 const h=fixture();h.failSave();h.resolve({ok:true});await assert.rejects(h.manager.configure("fixture",h.next),/persistence unavailable/);
 assert.equal(h.calls.filter(c=>c.action==="configure").length,0);assert.equal(h.manager.busy.size,0);assert.equal(h.manager.configuring,false);
});

