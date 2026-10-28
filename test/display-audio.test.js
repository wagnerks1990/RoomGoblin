"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const displayAudio=require("../src/display-audio");
const {assertAutomationCommandsAllowed}=require("../src/automation-runtime");
const source=fs.readFileSync(require.resolve("../src/server"),"utf8").replace(/\r\n/g,"\n");
function extract(name){const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);return source.slice(start,source.indexOf("\n}",start)+2)}
const sports=()=>({textOptions:{scene:{layers:[{id:"board",type:"widget",widget:"sports-board",sportsBoardId:"school",sportsAudio:true,sportsVolume:.6}]}},timer:{remainingSeconds:300}});
function fixture(){
  const sent=[],ctx=vm.createContext({displayAudio,Date,JSON,Buffer,path,crypto:require("node:crypto"),deviceConfig:{room:"test"},ROOM_NAME:"test",
    devices:{tv1:{},tv2:{}},persistentState:{displays:{tv1:sports(),tv2:sports()}},persistState:()=>{},
    resolveDisplayTargets:t=>Array.isArray(t)?t:[t],announcementPriorityError:()=>null,engageManualMediaPriority:async()=>null,
    backgroundMusicObserveDisplayCommand:()=>{},broadcastDisplays:(targets,message)=>{sent.push({targets,command:message.command});return targets},
    broadcastDisplayPreviews:()=>{},broadcastControllers:()=>{},audit:()=>{},diagnosticError:()=>{},MQTT_JSON_BRIDGE:false,MQTT_LEGACY_BRIDGE:false,
    legacyColorMap:new Map(),sanitizeText:t=>t,planningStudio:{scene:{normalize:s=>s}}
  });
  vm.runInContext('const URL_BEARING_DISPLAY_COMMANDS=new Set(["display.image","display.video","display.web","display.pdf","display.document","display.presentation"]);',ctx);
  for(const name of ["commandId","normalizeCommand","safeMediaUrl","validateCommandForDispatch","setDisplayState","updateStateFromCommand","toLegacyCommand","executeCommand"])vm.runInContext(extract(name),ctx);
  return {ctx,sent};
}

test("live volume/mute persist for Sports, native video, websites and shared layers without changing playback identity",()=>{
  const state={...sports(),media:{type:"video",url:"/media/clip.mp4",sessionId:"session",positionSeconds:21,volume:.8,muted:false},layers:[{id:"shared",expiresAt:Date.now()+60000,scene:sports().textOptions.scene}]};
  for(const type of ["video","web"]){
    state.media.type=type;
    const before=structuredClone(state),key=displayAudio.describe(state).contentKey;
    let next=displayAudio.apply(state,{volume:.3,muted:true});
    assert.deepEqual(state,before);assert.equal(next.media.positionSeconds,21);assert.equal(next.media.sessionId,"session");
    assert.equal(next.textOptions.scene.layers[0].sportsVolume,.3);assert.equal(next.layers[0].scene.layers[0].sportsAudio,false);
    assert.equal(displayAudio.describe(next).audible,false);assert.equal(displayAudio.describe(next).contentKey,key);
    next=displayAudio.apply(next,{muted:false});assert.equal(next.media.volume,.3);assert.equal(displayAudio.describe(next).audible,true);
    assert.equal(displayAudio.describe(displayAudio.apply(next,{volume:0})).audible,false);
  }
});

test("audio input rejects invalid values and status never exposes media URLs",()=>{
  for(const input of [{},{volume:NaN},{volume:Infinity},{volume:-1},{volume:2},{volume:".5"},{volume:null},{muted:"false"},{muted:0},{muted:false,contentKey:"url"}])assert.throws(()=>displayAudio.validate(input));
  assert.deepEqual(displayAudio.validate({volume:0,muted:true,arbitrary:"ignored"}),{volume:0,muted:true});
  const status=displayAudio.describe({media:{type:"web",url:"https://example.test/private-stream",volume:.4}});
  assert.equal(JSON.stringify(status).includes("private-stream"),false);assert.equal(displayAudio.describe({media:{type:"image"}}).available,false);
  assert.equal(displayAudio.describe(null).available,false);
  assert.equal(displayAudio.describe({layers:[{expiresAt:Date.now()-1,scene:sports().textOptions.scene}]}).available,false);
});

test("website automation dispatch preserves legacy defaults and carries explicit saved audio",async()=>{
  for(const audio of [{},{volume:.37,muted:true},{volume:.7,muted:false}]){
    const sent=[],ctx=vm.createContext({assertAutomationCommandsAllowed,expandAutomationPayload:p=>p,schedulerClock:{now:()=>new Date(),commandsAllowed:()=>true},
      AUTOMATION_ACTIONS:new Set(["display.url"]),requireAutomationTargets:targets=>targets,
      executeCommand:async c=>{sent.push(c);return {ok:true}},localDateKey:()=>"2026-10-26",schoolCycleForDate:()=>({}),
      planningStudio:{matchingOverlays:()=>[]},planningStudioConfig:{},announcementLockedDisplayTargets:()=>[],persistentState:{displays:{}}});
    vm.runInContext(extract("runSingleAutomationAction"),ctx);
    await ctx.runSingleAutomationAction({action:"display.url",targets:["tv1"],payload:{url:"https://example.test/player",clearBefore:false,...audio}},{skipAudit:true});
    assert.equal(sent.length,1);const payload=sent[0].payload;
    assert.equal(payload.volume,audio.volume);assert.equal(payload.muted,audio.muted);
    if(audio.volume!==undefined)assert.equal(payload.forceAudio,!audio.muted);
    else assert.equal(Object.hasOwn(payload,"forceAudio"),false);
  }
});

test("router sends only audio to selected targets, persists reconnect settings and preserves the timer",async()=>{
  const {ctx,sent}=fixture(),other=structuredClone(ctx.persistentState.displays.tv2),key=displayAudio.describe(ctx.persistentState.displays.tv1).contentKey;
  await ctx.executeCommand({type:"display.audio.control",target:["tv1"],payload:{volume:.25,muted:true,contentKey:key}},"controller");
  assert.deepEqual(sent.map(row=>row.command.type),["display.audio.control"]);
  assert.deepEqual(ctx.persistentState.displays.tv2,other);
  assert.equal(ctx.persistentState.displays.tv1.timer.remainingSeconds,300);
  assert.equal(displayAudio.describe(ctx.persistentState.displays.tv1).volume,.25);
});

test("router rejects stale content and announcement takeover, including after awaiting dispatch",async()=>{
  for(const race of ["announcement","replacement","empty"]){
    const {ctx,sent}=fixture(),key=displayAudio.describe(ctx.persistentState.displays.tv1).contentKey;
    ctx.engageManualMediaPriority=async()=>{
      if(race==="announcement")ctx.announcementPriorityError=()=>Error("Morning Announcements has priority");
      else if(race==="replacement")ctx.persistentState.displays.tv1.audioContentId="new-run";
      else ctx.persistentState.displays.tv1={};
    };
    await assert.rejects(ctx.executeCommand({type:"display.audio.control",target:["tv1"],payload:{muted:false,contentKey:key}},"http"),/priority|changed|no active/);
    assert.equal(sent.length,0);
  }
});

test("audio routes enforce control permission and fail closed on invalid, unknown and locked displays",async t=>{
  const express=require("express"),app=express();app.use(express.json());
  const {ctx,sent}=fixture();Object.assign(ctx,{app,cleanId:String,
    schedulerReadLimit:(req,res,next)=>next(),schedulerMutationLimit:(req,res,next)=>next(),
    requireControl:(req,res,next)=>req.get("x-role")==="operator"?next():res.sendStatus(403),publicDisplayStatus:()=>({online:true})});
  vm.runInContext(extract("configuredDisplayId")+"\n"+source.slice(source.indexOf('app.get("/api/v1/displays/audio"'),source.indexOf('function startManagedManualAutomation(')),ctx);
  const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>server.close());
  const request=(url,body,role="operator")=>fetch(`http://127.0.0.1:${server.address().port}/api/v1/displays/${url}`,{method:body?"POST":"GET",headers:{"Content-Type":"application/json","x-role":role},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request("audio",null,"reader")).status,403);
  assert.equal((await request("tv1/audio",{muted:true},"reader")).status,403);
  assert.equal((await request("unknown/audio",{muted:true})).status,400);
  assert.equal((await request("tv1/audio",{volume:4})).status,400);
  const status=await (await request("audio")).json();assert.equal(status.displays[0].volume,.6);
  assert.equal((await request("tv1/audio",{volume:.2,contentKey:status.displays[0].contentKey})).status,200);
  assert.equal(sent.length,1);ctx.announcementPriorityError=()=>Error("Morning Announcements has priority");
  assert.equal((await request("tv1/audio",{muted:true})).status,400);assert.equal(sent.length,1);
});
