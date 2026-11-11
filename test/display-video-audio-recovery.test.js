"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"../public/display/index.html"),"utf8");
function fixture(options={}){
  const timers=[],reports=[],writes=[],listeners=new Map();let muted=true,playCount=0;
  const video={dataset:{},paused:true,ended:false,currentTime:12,duration:60,volume:.7,
    addEventListener(name,fn){listeners.set(name,fn)},
    play(){playCount++;video.paused=false;return options.play?options.play(video):Promise.resolve()},
    pause(){video.paused=true},load(){},
    get muted(){return muted},set muted(value){muted=value;writes.push(value)}};
  const ctx=vm.createContext({activeMediaSession:null,badge:{},id:"fixture",ws:null,
    reportMediaStatus:reason=>reports.push(reason),setTimeout:fn=>timers.push(fn),queueMicrotask,
    authorizeAssetUrl:()=>"/media/clip.mp4?renewed"});
  vm.runInContext(source.slice(source.indexOf("async function startVideoPlayback("),source.indexOf("function applyDisplayAudio(")),ctx);
  ctx.configureVideoSession(video,{url:"/media/clip.mp4",authorizedUrl:"/media/clip.mp4?original",volume:.7,...options.spec});
  writes.length=0;
  return {ctx,video,timers,reports,writes,get playCount(){return playCount},async settle(){await new Promise(setImmediate);while(timers.length)timers.shift()();await new Promise(setImmediate)}};
}

test("buffer recovery never remutes or restarts an already playing video",async()=>{
  const h=fixture();h.video.oncanplay();await h.settle();assert.equal(h.video.muted,false);
  h.writes.length=0;
  for(let i=0;i<5;i++)h.video.oncanplay();
  assert.deepEqual(h.writes,[]);assert.equal(h.playCount,1);assert.equal(h.video.currentTime,12);
});

test("repeated canplay events retain one pending startup owner",async()=>{
  let finish;const h=fixture({play:()=>new Promise(resolve=>finish=resolve)});
  h.video.oncanplay();h.video.oncanplay();h.video.oncanplay();
  assert.equal(h.playCount,1);finish();await h.settle();assert.equal(h.video.muted,false);
});

test("muted autoplay fallback survives buffer recovery without another unmute attempt",async()=>{
  const h=fixture();h.video.oncanplay();await new Promise(setImmediate);h.video.paused=true;await h.settle();
  assert.equal(h.video.muted,true);assert.equal(h.playCount,2);h.writes.length=0;
  h.video.oncanplay();assert.deepEqual(h.writes,[]);assert.equal(h.playCount,2);
});

test("buffer events preserve operator pause and explicit play can resume",async()=>{
  const h=fixture();h.video.oncanplay();await h.settle();h.ctx.applyMediaControl({action:"pause"});
  h.video.oncanplay();assert.equal(h.playCount,1);assert.equal(h.video.paused,true);
  h.ctx.applyMediaControl({action:"play"});await h.settle();assert.equal(h.playCount,2);assert.equal(h.video.muted,false);
});

test("autoplay disabled remains idle until explicit play",async()=>{
  const h=fixture({spec:{autoplay:false}});h.video.oncanplay();assert.equal(h.playCount,0);
  h.ctx.applyMediaControl({action:"play"});await h.settle();assert.equal(h.playCount,1);assert.equal(h.video.muted,false);
});

test("token renewal still resumes the existing video and restores requested audio",async()=>{
  const h=fixture();h.video.oncanplay();await h.settle();assert.equal(h.ctx.renewVideoAccess(h.video),true);
  await Promise.resolve();assert.equal(h.video.src,"/media/clip.mp4?renewed");
  h.video.oncanplay();await h.settle();assert.equal(h.playCount,2);assert.equal(h.video.muted,false);assert.equal(h.video.currentTime,12);
});

test("intentional mute and zero volume remain silent after buffer recovery",async()=>{
  for(const spec of [{muted:true},{volume:0}]){
    const h=fixture({spec});h.video.oncanplay();await h.settle();h.writes.length=0;
    h.video.oncanplay();assert.equal(h.video.muted,true);assert.deepEqual(h.writes,[]);
  }
});
