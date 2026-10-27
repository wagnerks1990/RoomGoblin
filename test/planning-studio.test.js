"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const studio=require("../src/planning-studio"),engine=require("../src/planning"),school=require("../src/school-schedule"),{createWeatherCache}=require("../src/planning-weather");
const scene=studio.scene;
const {assertAutomationCommandsAllowed,SchedulerClock,firstPassDueActions}=require("../src/automation-runtime");
const profile=()=>school.normalizeSchoolScheduleProfile({...engine.cyclePreset(),anchorDate:"2027-10-18",planning:{enabled:true,dates:{"2027-10-18":{status:"school",timetableId:"special"}},timetables:[{id:"special",name:"Special",blocks:[{id:"lunch",kind:"break",label:"Lunch A",startTime:"10:58",endTime:"11:28"},{id:"return",kind:"event",label:"Return to class",startTime:"11:28",endTime:"11:36"}]}]}});
test("temporary recurring clocks are bounded, skip dates, and reject ambiguous ranges",()=>{
 const w=studio.windowRule({startDate:"2027-10-18",endDate:"2027-10-22",excludedDates:["2027-10-20"],repeatEveryMinutes:15,endTime:"09:00"});
 assert.deepEqual(studio.times({time:"08:00",scheduleWindow:w}),["08:00","08:15","08:30","08:45","09:00"]);
 assert.equal(studio.inWindow(w,"2027-10-20"),false);assert.equal(studio.inWindow(w,"2027-10-19"),true);assert.equal(studio.inWindow(w,"2027-10-23"),false);
 for(const invalid of [{repeatEveryMinutes:1,endTime:"09:00"},{startDate:"2027-02-29"},{startDate:"2027-10-22",endDate:"2027-10-18"},{excludedDates:"bad"}])assert.throws(()=>studio.windowRule(invalid));
 assert.throws(()=>studio.times({time:"10:00",scheduleWindow:{repeatEveryMinutes:5,endTime:"09:00"}}));
});
test("lunch and assembly blocks create dated occurrences with their own end, without fallback on regular days",()=>{
 const p=profile(),event={id:"lunch-display",blockIds:["lunch"],targets:["tv1"],classTimeReference:"start"};
 const [run]=studio.blockOccurrences(p,{},event,"2027-10-18");assert.equal(run.time,"10:58");assert.equal(run._class.name,"Lunch A");assert.equal(new Date(run._classEndAt).getHours(),11);assert.equal(new Date(run._classEndAt).getMinutes(),28);
 assert.deepEqual(studio.blockOccurrences(p,{},event,"2027-10-19"),[]);
 assert.deepEqual(studio.blockOccurrences(p,{},event,"2027-10-17"),[]);
 p.planning.dates["2027-10-18"].status="remote";assert.deepEqual(studio.blockOccurrences(p,{},event,"2027-10-18"),[]);
});
test("day preview links break actions and warns when an event would leave previous content visible",()=>{
 const p=profile(),e={id:"lunch-display",name:"Lunch screen",blockIds:["lunch"],enabled:true};
 const day=engine.resolveDay(p,{},[],[e],"2027-10-18");assert.equal(day.rows[0].automations[0].name,"Lunch screen");assert.equal(day.fixedAutomations.length,0);assert.ok(day.warnings.some(w=>w.includes("Return to class")&&w.includes("no display automation")));
});
test("date-only classes and class date windows cannot leak into later regular days",()=>{
 const p=profile(),c={id:"homeroom",enabled:true,scheduleMode:"dates",includeDates:["2027-10-18"],days:[1,2,3,4,5]};
 assert.equal(engine.classMatches(p,{},c,"2027-10-18"),true);assert.equal(engine.classMatches(p,{},c,"2027-10-19"),false);
 c.scheduleWindow={endDate:"2027-10-17"};assert.equal(engine.classMatches(p,{},c,"2027-10-18"),false);
});
test("shared rules combine scopes, preserve transparent layers, and honor per-event exclusions",()=>{
 const config=studio.normalize({overlays:[{id:"notice",name:"Notice",automationIds:["class-screen"],excludedAutomationIds:["hidden"],classIds:["class-1"],days:[1],startTime:"08:00",endTime:"15:00",cycleDays:["A"],scene:{layers:[{id:"text",type:"text",text:"Notice"}]}}]});
 const now={dateKey:"2027-10-18",weekday:1,time:"09:00",cycleDay:"A"},event={id:"class-screen",classIds:["class-1"]};assert.equal(studio.matchingOverlays(config,event,now).length,1);assert.equal(config.overlays[0].scene.transparent,true);
 for(const [changed,value] of [["weekday",2],["time","15:00"],["cycleDay","B"]])assert.equal(studio.matchingOverlays(config,event,{...now,[changed]:value}).length,0);
 assert.equal(studio.matchingOverlays(config,{...event,overlayPolicy:"off"},now).length,0);assert.equal(studio.matchingOverlays(config,{...event,overlayPolicy:"selected",overlayIds:[]},now).length,0);
 assert.throws(()=>studio.normalize({overlays:[{id:"same",scene:{layers:[]}},{id:"same",scene:{layers:[]}}]}));
});
test("scene normalization prevents remote/script assets and keeps rotated content within canvas",()=>{
 for(const asset of ["https://example.test/a.png","../secret.png","file:///tmp/a.png"])assert.throws(()=>scene.normalize({layers:[{type:"image",asset}]}));
 assert.throws(()=>scene.normalize({layers:Array.from({length:41},()=>({type:"text"}))}));assert.throws(()=>scene.normalize({layers:[{type:"text",x:NaN}]}));
 for(const rotation of [-135,-90,-45,0,30,90,180]){const l=scene.normalize({layers:[{type:"text",x:85,y:90,w:100,h:100,rotation}]}).layers[0],rad=l.rotation*Math.PI/180,w=l.w*19.2,h=l.h*10.8,cx=(l.x+l.w/2)*19.2,cy=(l.y+l.h/2)*10.8,bw=Math.abs(w*Math.cos(rad))+Math.abs(h*Math.sin(rad)),bh=Math.abs(w*Math.sin(rad))+Math.abs(h*Math.cos(rad));assert.ok(cx-bw/2>=-0.001&&cx+bw/2<=1920.001);assert.ok(cy-bh/2>=-0.001&&cy+bh/2<=1080.001)}
});
test("widgets use real deadlines, bounded progress and explicit stale weather",()=>{
 assert.equal(scene.widgetText({widget:"countdown"},{endAt:120000},60000),"01:00");assert.equal(scene.widgetText({widget:"countdown"},{endAt:120000},180000),"00:00");
 assert.equal(scene.widgetText({widget:"progress"},{startAt:100,endAt:200},500),"100% complete");assert.match(scene.widgetText({widget:"weather"},{weather:"18 C",weatherUpdatedAt:1},3600002),/stale/);
});
test("weather is optional, cached and bounded; network failure never blocks callers",async()=>{
 let calls=0,clock=1000000;const weather=createWeatherCache({now:()=>clock,fetchImpl:async(url,opts)=>{calls++;assert.equal(url.origin,"https://api.open-meteo.com");assert.equal(opts.redirect,"error");return new Response(JSON.stringify({current:{temperature_2m:18.4,weather_code:0}}))}});
 assert.equal(weather.read({enabled:false}),null);assert.equal(calls,0);assert.equal(weather.read({enabled:true,latitude:0,longitude:0}),null);await weather.settled();assert.match(weather.read({enabled:true,latitude:0,longitude:0}).text,/18.*Clear/);assert.equal(calls,1);
 clock+=900001;weather.read({enabled:true,latitude:0,longitude:0});await weather.settled();assert.equal(calls,2);
 const failed=createWeatherCache({fetchImpl:async()=>{throw Error("offline")}});assert.equal(failed.read({enabled:true,latitude:0,longitude:0}),null);await failed.settled();assert.equal(failed.read({enabled:true,latitude:0,longitude:0}),null);
 assert.throws(()=>weather.read({enabled:true,latitude:91,longitude:0}));
});
const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
function extract(name,async=false){const start=source.indexOf(`${async?"async ":""}function ${name}(`);assert.ok(start>=0,name);const end=source.indexOf("\nfunction ",start+1),nextAsync=source.indexOf("\nasync function ",start+1);return source.slice(start,Math.min(...[end,nextAsync].filter(n=>n>=0)))}
function timerRuntime(){
 const now=new Date(2027,9,18,11,10).getTime(),sent=[];class ClockDate extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
 const ctx=vm.createContext({assertAutomationCommandsAllowed,schedulerClock:new SchedulerClock(),Date:ClockDate,localDateKey:()=>"2027-10-18",automationDisplayTargets:t=>t,commandId:()=>"timer-id",expandAutomationVariables:v=>v,executeCommand:async c=>{sent.push(c);return {ok:true}},classScheduleMatchesDate:()=>false,timerLinkedClassChain:e=>({endAt:new Date(e._classEndAt),classes:[e._class]})});vm.runInContext(extract("resolvedClassReferenceDate")+extract("runAutomationTimerOverlay",true),ctx);return {ctx,sent,now};
}
test("duration timers with no override never interpret null as Unix epoch",async()=>{
 const {ctx,sent,now}=timerRuntime();await ctx.runAutomationTimerOverlay({id:"lunch",targets:["tv1"],timerOverlay:{enabled:true,source:"duration",durationSeconds:1800}});assert.equal(sent[0].payload.endAt,now+1800000);assert.equal(sent[0].payload.durationSeconds,1800);
});
test("clock-deadline timer always ends at the authored time, including after refresh",async()=>{
 const {ctx,sent}=timerRuntime();await ctx.runAutomationTimerOverlay({id:"lunch",targets:["tv1"],timerOverlay:{enabled:true,source:"end-time",endTime:"11:28"}});assert.equal(new Date(sent[0].payload.endAt).getMinutes(),28);assert.equal(sent[0].payload.remainingSeconds,18*60);
});
test("timetable-bound lunch timer uses block end even though no teaching class exists",async()=>{
 const {ctx,sent}=timerRuntime(),[run]=studio.blockOccurrences(profile(),{},{id:"lunch",blockIds:["lunch"],targets:["tv1"]},"2027-10-18");await ctx.runAutomationTimerOverlay({...run,timerOverlay:{enabled:true,source:"class-end"}});assert.equal(sent[0].payload.endAt,run._classEndAt);assert.equal(sent[0].payload.remainingSeconds,18*60);
});

test("resync preserves an owned duration deadline and reconstructs the original scheduled deadline after restart",async()=>{
 for(const prior of [true,false]){
  const deadline=new Date(2027,9,18,11,prior?27:28).getTime(),timerCalls=[],state={displays:{tv1:{timer:prior?{automationId:"lunch",automationOccurrence:"lunch:2027-10-18:clock:10:58",endAt:deadline}:null}}};
  const ctx=vm.createContext({assertAutomationCommandsAllowed,firstPassDueActions,Date,persistentState:state,normalizeTimerOverlay:x=>x,automationActionSequence:()=>[],automationTargetDomain:()=>"display-content",automationDisplayTargets:x=>x,executeCommand:async()=>{state.displays.tv1.timer=null;return {ok:true}},runAutomationTimerOverlay:async(e,opts)=>{timerCalls.push(opts);return {}},localDateKey:()=>"2027-10-18",schedulerClock:{now:()=>new Date(2027,9,18,11,10),commandsAllowed:()=>true}});
  vm.runInContext(extract("automationOccurrenceScheduledMinutes")+extract("automationDueActionSequence")+extract("runDisplayAutomationResync",true),ctx);await ctx.runDisplayAutomationResync({id:"lunch",_scheduledDateKey:"2027-10-18",time:"10:58",targets:["tv1"],timerOverlay:{enabled:true,source:"duration",durationSeconds:1800}},["tv1"]);
  assert.equal(new Date(timerCalls[0].endAtOverride).getTime(),deadline);
 }
});

test("real automation normalization retains device scenes and safely unlinks old class timing",()=>{
 const schema=require("../src/automation-schema"),runtime=require("../src/automation-runtime"),crypto=require("node:crypto");
 const ctx=vm.createContext({Date,crypto,planningStudio:studio,cleanId:x=>String(x||""),validTime:school.validTime,validDateKey:school.validDateKey,normalizeIntegerMinutes:runtime.normalizeIntegerMinutes,uniqueDateKeys:v=>v||[],normalizeCycleDays:v=>v||[],normalizedDayType:v=>v||"Any",AUTOMATION_ACTIONS:new Set(["govee.scene","display.text"]),AUTOMATION_SCHEMA_VERSION:schema.AUTOMATION_SCHEMA_VERSION,normalizeSequenceAction:schema.normalizeAutomationAction,normalizeSequenceEvent:schema.normalizeAutomationEvent,defaultAutomationActionTargets:()=>["all"]});
 for(const name of ["automationClassIds","finiteTimerOverlayNumber","normalizeTimerOverlay","normalizeAutomation"])vm.runInContext(extract(name),ctx);
 const lighting=ctx.normalizeAutomation({id:"light",action:"govee.scene",targets:["all"],payload:{scene:"Rainbow"}});assert.equal(lighting.payload.scene,"Rainbow");
 const unlinked=ctx.normalizeAutomation({classIds:[],scheduleWindow:{repeatEveryMinutes:15,endTime:"10:00"}},{id:"old",classId:"class-1",classIds:["class-1"],action:"display.text",targets:["all"],time:"08:00"});assert.equal(unlinked.classId,"");assert.equal(unlinked.classIds.length,0);
 assert.throws(()=>ctx.normalizeAutomation({action:"display.text",classIds:["class-1"],blockIds:["lunch"]}),/classes or timetable blocks/);
 assert.throws(()=>ctx.normalizeAutomation({action:"display.text",overlayIds:"bad"}),/shared layers/);
});


test("single lighting actions delegate deadline overlays without treating device scenes as screen layers",async()=>{
 const {ctx,sent}=timerRuntime();
 Object.assign(ctx,{schedulerClock:{now:()=>new Date(2027,9,18,11,10),commandsAllowed:()=>true},expandAutomationPayload:x=>x,AUTOMATION_ACTIONS:new Set(["govee.scene"]),directGoveeCommand:async()=>({ok:true}),audit:()=>{}});
 vm.runInContext(extract("runSingleAutomationAction",true),ctx);
 await ctx.runSingleAutomationAction({id:"notice",action:"govee.scene",targets:["light-1"],payload:{scene:"Rainbow"},timerOverlay:{enabled:true,source:"end-time",endTime:"11:28",useEventTargets:false,targets:["tv1"]}});
 assert.equal(sent.length,1);assert.equal(sent[0].target[0],"tv1");assert.equal(sent[0].payload.remainingSeconds,18*60);
});
