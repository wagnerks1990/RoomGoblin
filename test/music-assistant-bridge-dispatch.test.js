"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8"),a=source.indexOf("async function executeCommand("),b=source.indexOf("\n}",a);assert.ok(a>0&&b>a);
function fixture(){
 const calls=[],controls={admit:null,broadcast:null,publish:null},ctx=vm.createContext({Date,maApiGeneration:0,
 normalizeCommand:(c,s)=>({...c,source:s,id:"fixture-command",payload:c.payload||{}}),validateCommandForDispatch:c=>c,URL_BEARING_DISPLAY_COMMANDS:new Set(),
 engageManualMediaPriority:async()=>{await controls.admit?.();return null},resolveDisplayTargets:t=>Array.isArray(t)?t:[t],announcementPriorityError:()=>null,
 updateStateFromCommand:()=>calls.push("state"),broadcastDisplays:ids=>{calls.push("websocket");controls.broadcast?.();return ids},broadcastDisplayPreviews:()=>{},broadcastControllers:()=>{},
 MQTT_JSON_BRIDGE:true,MQTT_LEGACY_BRIDGE:true,runtime:{mqtt:{connected:true}},devices:{},cleanId:String,toLegacyCommand:()=>null,
 mqttPublish:async topic=>{calls.push(topic);await controls.publish?.()},backgroundMusicObserveDisplayCommand:()=>calls.push("observe"),audit:()=>calls.push("audit"),diagnosticError(){}});
 vm.runInContext(source.slice(a,b+2),ctx);
 return {ctx,calls,controls,run:(source="music-assistant-bridge",type="music.assistant.attach",generation=0)=>ctx.executeCommand({type,target:["tv1","front-screen"],payload:{}},source,{expectedMusicAssistantGeneration:generation})};
}
test("current bridge delivery preserves selected targets and command observation",async()=>{
 const h=fixture(),r=await h.run();assert.deepEqual([...r.deliveries.websocket],["tv1","front-screen"]);assert.equal(h.calls.filter(c=>c.startsWith("classroom/")).length,2);assert.ok(h.calls.includes("observe"));
});
test("connection change during router admission prevents every delivery",async()=>{
 const h=fixture();h.controls.admit=async()=>{h.ctx.maApiGeneration++};const r=await h.run();assert.equal(r.skipped,true);assert.equal(r.reason,"music-connection-changed");assert.deepEqual(h.calls,[]);
});
test("connection change after WebSocket dispatch stops later transports and observation",async()=>{
 const h=fixture();h.controls.broadcast=()=>{h.ctx.maApiGeneration++};await h.run();assert.equal(h.calls.filter(c=>c.startsWith("classroom/")).length,0);assert.equal(h.calls.includes("observe"),false);assert.ok(h.calls.includes("websocket"));
});
test("connection change during MQTT dispatch stops remaining targets",async()=>{
 const h=fixture();h.controls.publish=async()=>{h.ctx.maApiGeneration++};await h.run();assert.deepEqual(h.calls.filter(c=>c.startsWith("classroom/")),["classroom/v2/display/tv1/command"]);assert.equal(h.calls.includes("observe"),false);
});
test("conditional music dispatch rejects unrelated sources and command types",async()=>{
 const h=fixture();await assert.rejects(()=>h.run("http"),/only supported/);await assert.rejects(()=>h.run("music-assistant-bridge","display.clear"),/only supported/);assert.deepEqual(h.calls,[]);
});
test("current conditional detach preserves normal dispatch",async()=>{
 const h=fixture(),r=await h.run("music-assistant-bridge","music.assistant.detach");assert.equal(r.ok,true);assert.equal(h.calls.filter(c=>c.startsWith("classroom/")).length,2);
});
