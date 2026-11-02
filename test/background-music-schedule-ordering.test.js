"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const {validTime}=require("../src/school-schedule");
function section(a,b){const x=source.indexOf(a),y=source.indexOf(b,x);assert.ok(x>0&&y>x,a);return source.slice(x,y)}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const flush=()=>new Promise(setImmediate);
function fixture(){
  let route,cfg={enabled:true,playerId:"A",favoriteId:"old",startTime:"07:00",endTime:"15:00",days:[1],volume:20},ticks=0,failWrite=false;
  const r={sessionGeneration:0,playing:true,paused:false,activePlayerId:"A",manualStopped:false,startedKey:"old-window"},commands=[],saved=[],audits=[];
  const ctx=vm.createContext({Date,validTime,backgroundMusicRuntime:r,backgroundMusicSchedule:()=>({...cfg}),
    backgroundMusicRecovery:{reset(){}},musicAssistantCommand:(c,args)=>{const d=deferred();commands.push({c,args,...d});return d.promise},
    dbStore:{setPreference:(key,v)=>{assert.equal(key,"musicassistant.background.schedule");if(failWrite)throw Error("fixture save failed");cfg=v;saved.push(v)}},
    backgroundMusicTick:async()=>{ticks++},audit:event=>audits.push(event),musicAssistantMutationLimit(){},requireControl(){},
    app:{put:(_p,...handlers)=>{route=handlers.at(-1)}}});
  vm.runInContext(section("const BACKGROUND_MUSIC_DEFAULT_SCHEDULE=","const backgroundMusicRuntime=")+
    section("function normalizeBackgroundMusicSchedule(","function backgroundMusicSchedule(")+
    section("async function backgroundMusicStop(","\nfunction backgroundMusicPriorityBlocked(")+
    section("let backgroundMusicScheduleWrites=",'\napp.post("/api/v1/music-assistant/background/favorites"'),ctx);
  return {r,ctx,commands,saved,audits,get cfg(){return cfg},get ticks(){return ticks},failWrite:value=>{failWrite=value},
    save(body){let status=200,result;const res={status(s){status=s;return res},json(v){result=JSON.parse(JSON.stringify(v));return res}};const promise=route({body},res);assert.equal(typeof promise.then,"function");return promise.then(()=>({status,body:result}))}};
}
test("accepted Music schedule saves persist in arrival order through an awaited Stop",async()=>{
  const h=fixture(),a=h.save({playerId:"B"}),b=h.save({playerId:"C"});let bDone=false;b.then(()=>{bDone=true});await flush();
  assert.equal(h.commands.length,1);assert.equal(bDone,false);assert.equal(h.cfg.playerId,"A");
  h.commands[0].resolve();assert.equal((await a).status,200);assert.equal((await b).status,200);assert.deepEqual(h.saved.map(c=>c.playerId),["B","C"]);assert.equal(h.cfg.playerId,"C");
});
test("queued partial Music schedule edits merge against the preceding committed save",async()=>{
  const h=fixture(),a=h.save({playerId:"B",favoriteId:"new"}),b=h.save({volume:35});await flush();h.commands[0].resolve();await a;await b;
  assert.equal(h.cfg.playerId,"B");assert.equal(h.cfg.favoriteId,"new");assert.equal(h.cfg.volume,35);
});
test("a schedule save cannot release a newer manual Stop",async()=>{
  const h=fixture(),p=h.save({playerId:"B"});await flush();h.r.manualStopped=true;
  const stopped=h.ctx.backgroundMusicStop("manual");h.r.startedKey="successor-window";h.commands[1].resolve();await stopped;h.commands[0].resolve();
  assert.equal((await p).status,200);assert.equal(h.r.manualStopped,true);assert.equal(h.r.startedKey,"successor-window");assert.equal(h.cfg.playerId,"B");
});
test("schedule Stop completion preserves a newer manual playback session",async()=>{
  const h=fixture(),p=h.save({playerId:"B"});await flush();
  Object.assign(h.r,{sessionGeneration:h.r.sessionGeneration+1,activePlayerId:"C",playing:true,manualStopped:false,manualSession:true,startedKey:"new-window"});
  h.commands[0].resolve();await p;assert.equal(h.r.activePlayerId,"C");assert.equal(h.r.playing,true);assert.equal(h.r.manualSession,true);assert.equal(h.r.startedKey,"new-window");
});
test("current schedule Stop completes before persistence and releases its own intent",async()=>{
  const h=fixture(),p=h.save({playerId:"B"});await flush();assert.equal(h.saved.length,0);assert.equal(h.r.manualStopped,true);
  assert.equal(h.commands[0].c,"players/cmd/stop");assert.equal(h.commands[0].args.player_id,"A");h.commands[0].resolve();
  const result=await p;assert.equal(result.status,200);assert.equal(result.body.schedule.playerId,"B");assert.equal(h.r.activePlayerId,null);assert.equal(h.r.startedKey,null);assert.equal(h.r.manualStopped,false);assert.equal(h.ticks,1);assert.equal(h.audits.length,1);
});
test("a failed Stop preserves durable settings and does not poison the next save",async()=>{
  const h=fixture(),a=h.save({playerId:"B"}),b=h.save({volume:35});await flush();h.commands[0].reject(Error("fixture stop failed"));
  assert.equal((await a).status,400);assert.equal((await b).status,200);assert.equal(h.cfg.playerId,"A");assert.equal(h.cfg.volume,35);assert.equal(h.commands.length,1);assert.equal(h.saved.length,1);assert.equal(h.r.manualStopped,true);
});
test("failed persistence after Stop remains visible and allows a later save",async()=>{
  const h=fixture();h.failWrite(true);const p=h.save({playerId:"B"});await flush();h.commands[0].resolve();
  assert.equal((await p).status,400);assert.equal(h.cfg.playerId,"A");assert.equal(h.ticks,0);assert.equal(h.audits.length,0);h.failWrite(false);
  assert.equal((await h.save({playerId:"C"})).status,200);assert.equal(h.cfg.playerId,"C");assert.equal(h.ticks,1);
});
test("non-identity edits preserve manual Stop without sending a playback command",async()=>{
  const h=fixture();h.r.manualStopped=true;assert.equal((await h.save({volume:35})).status,200);assert.equal(h.commands.length,0);assert.equal(h.r.manualStopped,true);assert.equal(h.r.startedKey,"old-window");
});
test("invalid schedule input neither stops playback nor blocks the next valid save",async()=>{
  const h=fixture(),a=h.save({startTime:"99:99"}),b=h.save({volume:35});assert.equal((await a).status,400);assert.equal((await b).status,200);assert.equal(h.commands.length,0);assert.equal(h.saved.length,1);assert.equal(h.cfg.startTime,"07:00");
});
test("the returned schedule handler promise retains ownership until its tick finishes",async()=>{
  const h=fixture(),tick=deferred();h.ctx.backgroundMusicTick=()=>tick.promise;const p=h.save({volume:35});let done=false;p.then(()=>{done=true});await flush();
  assert.equal(h.cfg.volume,35);assert.equal(done,false);tick.resolve();assert.equal((await p).status,200);assert.equal(done,true);
});
