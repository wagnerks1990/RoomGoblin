"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function extract(name){const a=source.indexOf("function "+name+"("),b=source.indexOf("\n}",a);assert.ok(a>0&&b>a);return source.slice(a,b+2)}
function fixture(){
 const ctx=vm.createContext({crypto,Buffer,deviceConfig:{room:"fixture"},ROOM_NAME:"fixture",URL_BEARING_DISPLAY_COMMANDS:new Set(["display.video","display.image","display.web"]),persistentState:{displays:{tv1:{timer:{visible:true}},tv2:{timer:{visible:false}}}},persistState(){}});
 for(const name of ["commandId","normalizeCommand","safeMediaUrl","validateCommandForDispatch","setDisplayState","updateStateFromCommand","toLegacyCommand"])vm.runInContext(extract(name),ctx);
 return{ctx,command:(payload={},extra={})=>ctx.validateCommandForDispatch(ctx.normalizeCommand({type:"display.video",target:"tv1",payload:{url:"/media/clip.mp4",...payload},...extra}))};
}
test("a normalized video command owns one identity in dispatch and persisted replay",()=>{
 const h=fixture(),c=h.command();assert.equal(c.payload.sessionId,c.id);assert.match(c.payload.sessionId,/^[a-f0-9-]{36}$/);
 h.ctx.updateStateFromCommand(c,["tv1"]);assert.equal(h.ctx.persistentState.displays.tv1.media.sessionId,c.payload.sessionId);assert.equal(h.ctx.persistentState.displays.tv1.audioContentId,c.id);assert.equal(h.ctx.persistentState.displays.tv1.timer.visible,true);assert.equal(h.ctx.persistentState.displays.tv2.media,undefined);
});
test("caller and automation session identities remain unchanged",()=>{
 const h=fixture();for(const sessionId of ["explicit-session","occurrence:step:lesson.mp4","display-"+"x".repeat(90),"0"]){const c=h.command({sessionId});assert.equal(c.payload.sessionId,sessionId);assert.notEqual(c.payload.sessionId,c.id)}
});
test("each new video command gets a distinct default playback identity",()=>{
 const h=fixture(),a=h.command(),b=h.command();assert.notEqual(a.payload.sessionId,b.payload.sessionId);assert.equal(a.payload.sessionId,a.id);assert.equal(b.payload.sessionId,b.id);
});
test("an explicit command identity remains stable when the same command is normalized again",()=>{
 const h=fixture(),a=h.command({}, {id:"retry-command"}),b=h.command({}, {id:"retry-command"});assert.equal(a.payload.sessionId,"retry-command");assert.equal(a.payload.sessionId,b.payload.sessionId);
});
test("missing or empty session values use the existing command identity",()=>{
 const h=fixture();for(const sessionId of [undefined,null,"",false,0]){const c=h.command({sessionId});assert.equal(c.payload.sessionId,c.id)}
});
test("other content kinds do not gain a video session identity",()=>{
 const h=fixture();for(const type of ["display.image","display.web"]){const c=h.command({}, {type});assert.equal(Object.hasOwn(c.payload,"sessionId"),false)}
});
test("selected receivers share the dispatched session without mutating caller input",()=>{
 const h=fixture(),payload={url:"/media/clip.mp4",muted:true,loop:true},before=structuredClone(payload),c=h.command({}, {payload});
 h.ctx.updateStateFromCommand(c,["tv1","tv2"]);assert.deepEqual(payload,before);for(const id of ["tv1","tv2"]){assert.equal(h.ctx.persistentState.displays[id].media.sessionId,c.id);assert.equal(h.ctx.persistentState.displays[id].media.loop,true)}
});
test("legacy video commands remain unchanged and invalid URLs still fail",()=>{
 const h=fixture(),c=h.command({muted:true});assert.equal(h.ctx.toLegacyCommand(c),"PLAYMUTED:/media/clip.mp4");assert.throws(()=>h.command({url:"javascript:alert(1)"}),/Media URL/);
});
