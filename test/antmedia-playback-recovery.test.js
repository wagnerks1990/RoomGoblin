'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function player({native=false,frames=true}={}){
  let now=100000,interval,frameCount=0,deny=false;
  const listeners={},messages=[],timeouts=new Map(),instances=[];
  const video={currentTime:0,volume:1,muted:false,paused:false,ended:false,readyState:4,networkState:2,videoWidth:1920,
    buffered:{length:1,start:()=>0,end:()=>90},seekable:{length:1,start:()=>20,end:()=>90},
    addEventListener:(event,fn)=>{(listeners[event]??=[]).push(fn)},removeEventListener:(event,fn)=>{listeners[event]=(listeners[event]||[]).filter(x=>x!==fn)},removeAttribute(){},setAttribute(){},load(){},canPlayType:()=>native?'probably':'',
    play:async()=>{video.plays=(video.plays||0)+1;if(deny&&!video.muted)throw Object.assign(new Error('policy'),{name:'NotAllowedError'});video.paused=false},
    getVideoPlaybackQuality:frames?()=>({totalVideoFrames:frameCount}):undefined};
  const status={style:{}};
  class Hls{
    static Events={MANIFEST_PARSED:'manifest',LEVEL_LOADED:'level',FRAG_LOADED:'fragment',ERROR:'error'};
    static ErrorTypes={NETWORK_ERROR:'network',MEDIA_ERROR:'media'};
    static isSupported(){return !native}
    constructor(){this.handlers={};this.starts=0;this.repairs=0;instances.push(this)}
    loadSource(url){this.url=url}attachMedia(){}on(event,fn){this.handlers[event]=fn}destroy(){this.destroyed=true}
    startLoad(){this.starts++}recoverMediaError(){this.repairs++}
    emit(event,data){this.handlers[event]?.(event,data)}
  }
  const context=vm.createContext({document:{getElementById:id=>id==='player'?video:status},location:{origin:'https://hub.example',search:'?source='+encodeURIComponent('https://stream.example/LiveApp/play.html?id=test')},URL,URLSearchParams,Date:class extends Date{static now(){return now}},console:{info(){}},parent:{postMessage:message=>messages.push(message.telemetry)},Hls,
    setInterval:fn=>{interval=fn},setTimeout:fn=>{const id=timeouts.size+1;timeouts.set(id,fn);return id},clearTimeout:id=>timeouts.delete(id)});
  context.window={Hls,addEventListener:(event,fn)=>{listeners['window-'+event]=[fn]}};
  const html=fs.readFileSync('public/antmedia-player/index.html','utf8');
  vm.runInContext(html.match(/<script>\n([\s\S]*?)<\/script>/)[1],context);
  return {video,status,messages,instances,Hls,tick(seconds=5){now+=seconds*1000;interval()},advance(time,count=1){video.currentTime=time;frameCount+=count},event(type){for(const fn of listeners[type]||[])fn()},message(data){listeners['window-message'][0]({origin:'https://hub.example',data})},deny(){deny=true;video.paused=true},async flush(){await new Promise(resolve=>setImmediate(resolve))},timeouts};
}

test('playlist/segment traffic cannot conceal a full-buffer playback freeze',()=>{
  const p=player(),h=p.instances[0];
  for(let i=0;i<3;i++){h.emit('level');h.emit('fragment');p.tick()}
  assert.equal(h.starts,1);
  assert.equal(p.messages.find(x=>x.event==='watchdog-recover').state,'stalled');
  p.tick(15);assert.equal(p.video.currentTime,88);
  p.tick(15);assert.equal(h.repairs,1);
  p.tick(15);assert.equal(p.instances.length,2);assert.equal(h.destroyed,true);
  assert.match(p.instances[1].url,/_adaptive\.m3u8$/);
});
test('healthy playback is preserved and clears escalation after genuine progress',()=>{
  const p=player(),h=p.instances[0];
  for(let i=1;i<=20;i++){p.advance(i*5,150);h.emit('level');p.tick()}
  assert.equal(p.instances.length,1);assert.equal(h.starts,0);
  p.tick(15);assert.equal(h.starts,1);
  p.advance(106,30);p.tick();
  p.tick(15);assert.equal(h.starts,2);assert.equal(h.repairs,0);
});
test('decode freeze is detected even with an advancing media clock',()=>{
  const p=player(),h=p.instances[0];
  for(let i=1;i<=3;i++){p.advance(i*5,0);p.tick()}
  assert.equal(h.starts,1);
  p.advance(20,0);p.tick(15);assert.equal(p.video.currentTime,88);
});
test('paused and native HLS playback receive bounded recovery',()=>{
  const p=player({native:true,frames:false});p.video.paused=true;
  p.tick(15);assert.equal(p.video.plays,1);
  p.tick(5);assert.equal(p.video.plays,1);
  p.tick(10);assert.equal(p.video.currentTime,88);
  p.tick(15);assert.match(p.video.src,/_adaptive\.m3u8$/);
});
test('autoplay denial falls back to muted video and is explicitly diagnosed',async()=>{
  const p=player();p.deny();p.instances[0].emit('manifest');await p.flush();
  assert.equal(p.video.muted,true);assert.equal(p.video.paused,false);
  assert.ok(p.messages.some(x=>x.event==='autoplay-blocked'&&x.errorName==='NotAllowedError'));
  p.message({type:'unmute'});await p.flush();assert.equal(p.video.muted,true);
  p.message({type:'setVolume',volume:.4});assert.equal(p.video.volume,.4);assert.equal(p.video.muted,true);
});
test('retired HLS callbacks cannot schedule or mutate a successor session',()=>{
  const p=player(),old=p.instances[0];for(let i=0;i<4;i++)p.tick(15);
  const count=p.messages.length;old.emit('level');old.emit('error',{fatal:true,type:'other'});
  assert.equal(p.messages.length,count);assert.equal(p.timeouts.size,0);
});

test('repeated fatal errors cannot starve watchdog escalation or flood recovery',()=>{
  const p=player(),h=p.instances[0];
  h.emit('error',{fatal:true,type:'network'});assert.equal(h.starts,1);
  for(let i=0;i<3;i++){h.emit('error',{fatal:true,type:'network'});p.tick()}
  assert.equal(h.starts,1);assert.equal(p.video.currentTime,88);
  p.tick(15);assert.equal(h.repairs,1);
});
