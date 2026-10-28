"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const displayMedia=require("../src/display-media");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>0&&b>a);return source.slice(a,b)}
function fixture(media={type:"video",url:"/media/clip.mp4",sessionId:"session",volume:.8,muted:false,playbackRate:1,startAtSeconds:4,endAtSeconds:30,loop:true}){
 const state={displays:{tv1:{media,audioContentId:"owner",timer:{visible:true}},tv2:{media:{type:"video",volume:.9}}}},calls=[];
 const context=vm.createContext({displayMedia,persistentState:state,setDisplayState:(id,p)=>Object.assign(state.displays[id],p),persistState:()=>calls.push("persist"),URL_BEARING_DISPLAY_COMMANDS:new Set()});
 vm.runInContext(block("function updateStateFromCommand(","\nfunction sanitizeText(")+block("function validateCommandForDispatch(","\n// -----------------------------------------------------------------------------"),context);
 return {state,calls,send(payload,targets=["tv1"]){const c=context.validateCommandForDispatch({type:"display.media.control",payload});context.updateStateFromCommand(c,targets);return c}};
}
for(const [action,payload,expected]of [["volume",{volume:.25},{volume:.25,muted:false}],["mute",{muted:true},{muted:true}],["rate",{playbackRate:1.5},{playbackRate:1.5}]]){
 test(action+" survives the actual persisted receiver snapshot",()=>{
  const h=fixture();h.state.displays.tv1.media.muted=action==="volume";const before=structuredClone(h.state),c=h.send({action,...payload});
  for(const[k,v]of Object.entries(expected))assert.equal(h.state.displays.tv1.media[k],v);
  for(const k of ["url","sessionId","startAtSeconds","endAtSeconds","loop"])assert.equal(h.state.displays.tv1.media[k],before.displays.tv1.media[k]);
  assert.deepEqual(h.state.displays.tv2,before.displays.tv2);assert.equal(h.state.displays.tv1.audioContentId,"owner");assert.deepEqual(h.state.displays.tv1.timer,{visible:true});assert.deepEqual(h.calls,["persist"]);assert.equal(c.type,"display.media.control");
 });
}
test("zero volume preserves mute intent and positive volume unmutes exactly like the receiver",()=>{
 const h=fixture();h.send({action:"mute"});h.send({action:"volume",volume:0});assert.equal(h.state.displays.tv1.media.muted,true);
 h.send({action:"volume",volume:.1});assert.equal(h.state.displays.tv1.media.muted,false);h.send({action:"volume",volume:0});assert.equal(h.state.displays.tv1.media.muted,false);
});
test("controls never manufacture a video or modify other content",()=>{
 for(const media of [undefined,null,{type:"image",url:"/media/image.png"},{type:"web",url:"https://example.invalid/"}]){
  const h=fixture();h.state.displays.tv1.media=media;const before=structuredClone(h.state);h.send({action:"volume",volume:.2});assert.deepEqual(h.state,before);
 }
});
test("transient playback commands do not turn snapshots into seek or restart replays",()=>{
 for(const action of ["play","pause","stop","restart","seek"]){const h=fixture(),before=structuredClone(h.state);h.send({action,positionSeconds:15});assert.deepEqual(h.state,before)}
});
test("finite numeric compatibility and bounds are shared across command entry points",()=>{
 assert.deepEqual(displayMedia.validate({action:" VOLUME ",volume:"0.3",extra:"discarded"}),{action:"volume",volume:.3});
 assert.equal(displayMedia.validate({action:"volume",volume:9}).volume,1);assert.equal(displayMedia.validate({action:"volume",volume:-9}).volume,0);
 assert.equal(displayMedia.validate({action:"rate",playbackRate:0}).playbackRate,.25);assert.equal(displayMedia.validate({action:"rate",playbackRate:9}).playbackRate,4);
 assert.equal(displayMedia.validate({action:"seek",positionSeconds:-9}).positionSeconds,0);assert.deepEqual(displayMedia.validate({action:"mute",muted:false}),{action:"mute",muted:false});
});
test("invalid numeric controls fail before any persisted state changes",()=>{
 for(const [action,field]of [["volume","volume"],["rate","playbackRate"],["seek","positionSeconds"]])for(const value of [NaN,Infinity,-Infinity,"not-a-number"]){
  const h=fixture(),before=structuredClone(h.state);assert.throws(()=>h.send({action,[field]:value}),/finite number/);assert.deepEqual(h.state,before);assert.deepEqual(h.calls,[]);
 }
 for(const action of ["","reload","arbitrary"]){const h=fixture();assert.throws(()=>h.send({action}),/Unsupported/);assert.deepEqual(h.calls,[])}
});
test("HTTP media control uses the same validation and keeps failures visible",async()=>{
 let route;const calls=[],ctx=vm.createContext({app:{post:(_p,...args)=>route=args.at(-1)},schedulerMutationLimit(){},requireControl(){},cleanId:String,devices:{tv1:{enabled:true},disabled:{enabled:false}},displayMedia,executeCommand:async c=>{calls.push(c);return{ok:true}},audit(){}});
 vm.runInContext(block('app.post("/api/v1/displays/:id/media/control"','\napp.get("/api/v1/displays/audio"'),ctx);
 async function send(body,id="tv1"){let status=200,response;const res={status(v){status=v;return res},json(v){response=v;return res}};await route({params:{id},body},res);return{status,response}}
 assert.equal((await send({action:"volume",volume:"bad"})).status,400);assert.equal(calls.length,0);
 assert.equal((await send({action:"volume",volume:.2},"disabled")).status,400);assert.equal(calls.length,0);
 assert.equal((await send({action:"volume",volume:.2})).status,200);assert.equal(calls[0].type,"display.media.control");assert.equal(calls[0].payload.volume,.2);assert.deepEqual([...calls[0].target],["tv1"]);
});
test("settings projection does not mutate its input",()=>{
 const media={type:"video",volume:.8,sessionId:"live"},copy=structuredClone(media),next=displayMedia.applySettings(media,{action:"volume",volume:.2});assert.deepEqual(media,copy);assert.notEqual(next,media);assert.equal(next.sessionId,"live");
});
