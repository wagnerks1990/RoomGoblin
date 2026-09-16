"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {EventEmitter} = require("node:events");

// Execute the actual receiver lifecycle, with transport/audio and time controlled.
function fixture() {
  const html=fs.readFileSync(require.resolve("../public/display/index.html"),"utf8");
  const source=html.slice(html.indexOf("let maSendspinPlayer="),html.indexOf("let identifyTimeout="));
  const sockets=[],players=[],statuses=[],warnings=[],timers=[],commands=[];
  class Socket extends EventEmitter {
    constructor(url){super();this.url=url;this.readyState=1;sockets.push(this)}
    addEventListener(type,fn){this.on(type,fn)}
    close(code=1000,reason=""){this.readyState=3;this.emit("close",{code,reason,wasClean:code!==1006})}
  }
  class Player {
    constructor(options){this.options=options;players.push(this)}
    connect(){return Promise.resolve()}
    disconnect(){this.options.webSocket.close()}
    setVolume(){}
    setMuted(){}
    unlock(){return Promise.resolve()}
  }
  const context=vm.createContext({WebSocket:Socket,SendspinPlayer:Player,id:"tv1",preview:false,
    musicAssistantProxyUrl:url=>url,location:{origin:"http://hub.example"},navigator:{},
    window:{addEventListener(){}},console:{info(){},warn:(...args)=>warnings.push(JSON.parse(JSON.stringify(args))),error(){}},
    setTimeout:(fn,delay)=>{timers.push({fn,delay})},
    ws:{readyState:1,send:raw=>{const msg=JSON.parse(raw);if(msg.type==="music.assistant.status")statuses.push(msg.status);else commands.push(msg)}}
  });
  vm.runInContext(source,context);
  return {sockets,players,statuses,warnings,timers,commands,
    attach:()=>vm.runInContext("attachMusicAssistant({proxyUrl:'/music-assistant/sendspin-proxy?ticket=PRIVATE-TICKET'})",context),
    detach:()=>vm.runInContext("detachMusicAssistant()",context)};
}

test("active close retains evidence through reconnect and never logs the ticket URL",async()=>{
  const f=fixture();f.attach();await Promise.resolve();
  f.players[0].options.onStateChange({isPlaying:true});
  f.sockets[0].close(1000,"Music Assistant Sendspin upstream closed");
  const last=f.statuses.at(-1);
  assert.equal(last.state,"reconnecting");assert.match(last.error,/1000/);
  assert.equal(last.lastProxyClose.wasClean,true);
  assert.equal(last.lastProxyClose.protocolActive,true);
  assert.equal(last.lastProxyClose.stale,false);
  assert.equal(f.warnings.length,1);
  const retries=f.timers.filter(x=>x.delay===1500);assert.equal(retries.length,1);
  retries[0].fn();assert.equal(f.commands[0].type,"music.assistant.reconnect.request");
  f.attach();await Promise.resolve();
  assert.deepEqual(f.statuses.at(-1).lastProxyClose,last.lastProxyClose);
  assert.doesNotMatch(JSON.stringify({statuses:f.statuses,warnings:f.warnings}),/PRIVATE-TICKET|ticket=|socketUrl/);
});

test("policy rejection before activation is visible and does not gain new retry behavior",async()=>{
  const f=fixture();f.attach();await Promise.resolve();
  f.sockets[0].close(1008,"Invalid or expired Music Assistant bridge ticket");
  assert.equal(f.statuses.at(-1).state,"error");
  assert.equal(f.statuses.at(-1).lastProxyClose.code,1008);
  assert.equal(f.timers.filter(x=>x.delay===1500).length,0);
});

test("replacement and detach closures are logged as stale without altering their successor",async()=>{
  const f=fixture();f.attach();await Promise.resolve();
  f.players[0].options.onStateChange({isPlaying:true});
  f.attach();await Promise.resolve();
  assert.equal(f.warnings[0][1].stale,true);
  assert.equal(f.statuses.at(-1).error,null);
  const count=f.statuses.length;
  f.sockets[0].close(1006);
  assert.equal(f.statuses.length,count);
  assert.equal(f.warnings.at(-1)[1].wasClean,false);
  assert.equal(f.timers.filter(x=>x.delay===1500).length,0);
  f.detach();
  assert.equal(f.statuses.at(-1).state,"detached");
  assert.equal(f.warnings.at(-1)[1].stale,true);
  assert.equal(f.timers.filter(x=>x.delay===1500).length,0);
});
