"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {EventEmitter} = require("node:events");
const fs = require("node:fs");
const vm = require("node:vm");
const {sendspinEndpoint, relaySendspin} = require("../src/music-assistant-sendspin");

function fixture(t) {
  t.mock.timers.enable({apis:["setTimeout"]});
  const sockets = [], connected = [], errors = [], closures = [];
  class Socket extends EventEmitter {
    static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
    constructor(url, options) {
      super(); this.url=url; this.options=options; this.readyState=0;
      this.bufferedAmount=0; this.sent=[]; this.closes=[]; this.terminated=0;
      sockets.push(this);
    }
    open() { this.readyState=1; this.emit("open"); }
    send(data, options, callback) { this.sent.push({data, ...options}); callback?.(this.sendError); }
    close(code, reason) { this.closes.push({code, reason}); this.readyState=3; this.emit("close",code); }
    terminate() { this.terminated++; this.readyState=3; this.emit("error",new Error("Connection terminated")); this.emit("close",1006); }
  }
  const client=new Socket(); client.open();
  const handle=relaySendspin(client,{WebSocket:Socket,config:{url:"http://ma.example:8095",sendspinHost:"ma.example"},
    maxPayload:123456,onConnected:url=>connected.push(url),onError:e=>errors.push(e),onClosed:event=>closures.push(event)});
  t.after(()=>handle.close());
  return {client,upstream:sockets[1],connected,errors,closures,handle,Socket,sockets};
}

test("dedicated endpoint uses saved host/port, not the web/API path or protocol",()=>{
  assert.equal(sendspinEndpoint({url:"https://ma.example:8443/api"}),"ws://ma.example:8927/sendspin");
  assert.equal(sendspinEndpoint({url:"http://ma.example:8095",sendspinHost:"other.example",sendspinPort:18927}),"ws://other.example:18927/sendspin");
  assert.equal(sendspinEndpoint({}),"ws://127.0.0.1:8927/sendspin");
  for(const host of ["host.docker.internal","music-assistant","music-assistant-server"]){
    assert.equal(sendspinEndpoint({sendspinHost:host},"host"),"ws://127.0.0.1:8927/sendspin");
    assert.equal(sendspinEndpoint({sendspinHost:host},"bridge"),`ws://${host}:8927/sendspin`);
  }
  assert.equal(sendspinEndpoint({sendspinHost:"host.docker.internal.school.test"},"host"),"ws://host.docker.internal.school.test:8927/sendspin");
  for(const host of ["2001:db8::2","[2001:db8::2]"])
    assert.equal(sendspinEndpoint({sendspinHost:host,sendspinPort:"8928"}),"ws://[2001:db8::2]:8928/sendspin");
  assert.equal(sendspinEndpoint({url:"http://[::1]:8095"}),"ws://[::1]:8927/sendspin");
});

test("malformed host and invalid ports fail before a connection can be opened",()=>{
  for(const host of ["ws://ma.example","ma.example/path","user:secret@ma.example","ma.example:8095","ma.example?x=y","ma.example#secret","[::1", "ma\n.example", "-bad", "a".repeat(254)])
    assert.throws(()=>sendspinEndpoint({sendspinHost:host}),/Sendspin host/);
  for(const port of [0,-1,65536,Infinity,NaN,"abc",8927.5])
    assert.throws(()=>sendspinEndpoint({sendspinPort:port}),/Port/);
});

test("queued client hello and binary frames are relayed without an API auth preamble",t=>{
  const f=fixture(t),hello=Buffer.from('{"type":"client/hello"}'),binary=Buffer.from([0,255,1,2]);
  f.client.emit("message",hello,false); f.client.emit("message",binary,true);
  assert.equal(f.upstream.sent.length,0);
  f.upstream.open();
  assert.deepEqual(f.upstream.sent,[{data:hello,binary:false},{data:binary,binary:true}]);
  assert.deepEqual(f.connected,["ws://ma.example:8927/sendspin"]);
  assert.equal(f.upstream.options.maxPayload,123456);
  assert.equal(f.upstream.options.followRedirects,false);
  t.mock.timers.tick(11000); assert.equal(f.client.closes.length,0);
});

test("first server hello and first audio frame are forwarded unchanged, not consumed as auth",t=>{
  const f=fixture(t); f.upstream.open();
  const hello=Buffer.from('{"type":"server/hello"}'),audio=new Uint8Array([1,2,3,255]).buffer;
  f.upstream.emit("message",hello,false); f.upstream.emit("message",audio,true);
  assert.deepEqual(f.client.sent,[{data:hello,binary:false},{data:audio,binary:true}]);
  f.client.emit("message",Buffer.from("after-open"),false);
  assert.equal(f.upstream.sent[0].data.toString(),"after-open");
});

test("client close during connection cancels timeout and terminates pending upstream",t=>{
  const f=fixture(t); f.client.emit("message",Buffer.from("queued"),false);
  f.client.close(1000,"leaving");
  assert.equal(f.upstream.terminated,1);
  t.mock.timers.tick(20000);
  assert.equal(f.client.closes.length,1); assert.equal(f.errors.length,0);
  // A stale open callback cannot forward queued frames or report success.
  f.upstream.open(); assert.equal(f.upstream.sent.length,0); assert.equal(f.connected.length,0);
});

test("connection timeout and upstream errors close both ends without leftover authTimer",t=>{
  const f=fixture(t); t.mock.timers.tick(10000);
  assert.equal(f.client.closes[0].code,1011); assert.match(f.client.closes[0].reason,/timed out/);
  assert.equal(f.upstream.terminated,1);
  f.upstream.emit("error",new Error("late error")); assert.equal(f.errors.length,0);
});

test("invalid upstream close codes are normalized and send failures are contained",t=>{
  const f=fixture(t); f.upstream.open(); f.upstream.readyState=3; f.upstream.emit("close",1006);
  assert.equal(f.client.closes[0].code,1011);
});

test("pending frame and byte budgets reject floods instead of silently losing frames",t=>{
  const f=fixture(t);
  for(let i=0;i<101;i++)f.client.emit("message",Buffer.from("queued"),false);
  assert.equal(f.client.closes[0].code,1009); assert.equal(f.upstream.terminated,1);
});

test("pending byte budget and active backpressure protect bounded memory",t=>{
  const f=fixture(t); f.client.emit("message",Buffer.alloc(1024*1024+1),true);
  assert.equal(f.client.closes[0].code,1009);
});

test("slow browser consumers and asynchronous send errors terminate the bridge",t=>{
  const f=fixture(t); f.upstream.open(); f.client.bufferedAmount=8*1024*1024;
  f.upstream.emit("message",Buffer.from("audio"),true);
  assert.equal(f.client.closes[0].code,1013);
});

test("asynchronous send errors are reported once and close both endpoints",t=>{
  const f=fixture(t); f.upstream.open(); f.upstream.sendError=new Error("send failed");
  f.client.emit("message",Buffer.from("hello"),false);
  assert.equal(f.errors.length,1); assert.equal(f.client.closes[0].code,1011);
  assert.equal(f.upstream.closes.length,1);
});

test("actual server connection handler retains single-use tickets, attachment, enable and IP gates",()=>{
  const source=fs.readFileSync(require.resolve("../src/server.js"),"utf8");
  const start=source.indexOf('maSendspinProxyWss.on("connection",(client,req)=>{');
  const end=source.indexOf('\n\nwss.on("connection",',start);
  const wss=new EventEmitter(),calls=[],tickets=new Map();
  let targets=["tv1"],enabled=true;
  const audits=[];
  const context={maSendspinProxyWss:wss,WebSocket:{OPEN:1},URL,crypto:require("node:crypto"),
    clientAddress:()=>"192.0.2.1",consumeMusicAssistantProxyTicket:value=>{const v=tickets.get(value);tickets.delete(value);return v},
    dbStore:{getPreference:()=>targets},musicAssistantConfig:()=>({tvBridgeEnabled:enabled}),
    relaySendspin:(...args)=>calls.push(args),WS_MAX_PAYLOAD_BYTES:123456,audit:event=>audits.push(event),diagnosticError(){}};
  vm.runInNewContext(source.slice(start,end),context);
  function connect(ticket){const client=new EventEmitter();client.readyState=1;client.close=(code,reason)=>{client.closed={code,reason};client.readyState=3};wss.emit("connection",client,{url:'/music-assistant/sendspin-proxy?ticket='+ticket});return client;}
  assert.equal(connect("missing").closed.code,1008);assert.equal(calls.length,0);
  tickets.set("one",{deviceId:"tv1",playerId:"classroom-hub-tv1"});
  const client=connect("one");assert.equal(client.remoteAddress,"192.0.2.1");assert.equal(calls.length,1);
  assert.equal(connect("one").closed.code,1008);assert.equal(calls.length,1);
  tickets.set("detached",{deviceId:"tv1"});targets=[];assert.equal(connect("detached").closed.code,1008);
  tickets.set("disabled",{deviceId:"tv1"});targets=["tv1"];enabled=false;assert.equal(connect("disabled").closed.code,1008);
  assert.equal(calls.length,1);
  const relay=calls[0][1];
  relay.onConnected("ws://ma.example:8927/sendspin");
  relay.onClosed({closedBy:"upstream",observedCode:1006,forwardedCode:1011});
  const opened=audits.find(e=>e.kind==="musicassistant.sendspin.proxy.connected");
  const closed=audits.find(e=>e.kind==="musicassistant.sendspin.proxy.closed");
  assert.equal(closed.relayId,opened.relayId);
  assert.equal(closed.deviceId,"tv1");assert.equal(closed.observedCode,1006);
  assert.equal(audits.filter(e=>e.kind==="musicassistant.sendspin.proxy.rejected").length,4);
  assert.doesNotMatch(JSON.stringify(audits),/ticket=|"ticket"/);
});


test("close diagnostics preserve the first source and original abnormal code once",t=>{
  const f=fixture(t);f.upstream.open();
  f.upstream.readyState=3;
  f.upstream.emit("close",1006,Buffer.from("https://peer.invalid/?token=do-not-log"));
  assert.equal(f.closures.length,1);
  assert.equal(f.closures[0].closedBy,"upstream");
  assert.equal(f.closures[0].observedCode,1006);
  assert.equal(f.closures[0].forwardedCode,1011);
  assert.equal(f.closures[0].upstreamConnected,true);
  assert.ok(f.closures[0].durationMs>=0);
  assert.doesNotMatch(JSON.stringify(f.closures),/do-not-log|peer.invalid/);
  f.handle.close();f.client.emit("close",1000);
  assert.equal(f.closures.length,1);
});

test("client-initiated closure is distinct from the upstream cleanup it causes",t=>{
  const f=fixture(t);f.upstream.open();f.client.close(1001,"leaving");
  assert.equal(f.closures.length,1);
  assert.equal(f.closures[0].closedBy,"browser");
  assert.equal(f.closures[0].observedCode,1001);
  assert.equal(f.upstream.closes[0].code,1000);
});

test("timeout diagnostics are emitted once and identify an unopened upstream",t=>{
  const f=fixture(t);t.mock.timers.tick(10000);
  assert.equal(f.closures.length,1);
  assert.equal(f.closures[0].closedBy,"connect-timeout");
  assert.equal(f.closures[0].upstreamConnected,false);
});

test("buffer diagnostics identify a local limit without changing close codes",t=>{
  const f=fixture(t);f.upstream.open();f.client.bufferedAmount=8*1024*1024;
  f.upstream.emit("message",Buffer.from("audio"),true);
  assert.equal(f.closures.length,1);
  assert.equal(f.closures[0].closedBy,"buffer-limit");
  assert.equal(f.closures[0].forwardedCode,1013);
});

test("send errors report direction without reclassifying the resulting peer close",t=>{
  const f=fixture(t);f.upstream.open();f.upstream.sendError=new Error("fixture");
  f.client.emit("message",Buffer.from("hello"),false);
  assert.equal(f.closures.length,1);
  assert.equal(f.closures[0].closedBy,"upstream-send-error");
  assert.equal(f.closures[0].observedCode,null);
});

test("a failing diagnostic observer cannot interrupt relay teardown",t=>{
  const f=fixture(t);
  const handle=relaySendspin(f.client,{WebSocket:f.Socket,config:{},onClosed(){throw Error("observer")}});
  assert.doesNotThrow(()=>handle.close());
  assert.equal(f.client.readyState,3);
  assert.equal(f.sockets[2].terminated,1);
});
