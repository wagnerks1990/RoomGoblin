"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const {once}=require("node:events");
const {recoveryTransportAllowed}=require("../src/recovery-transport-policy");

function request(headers={},peer="127.0.0.1"){
  return {socket:{remoteAddress:peer},headers};
}
function decision(headers,trustProxyHops=1,peer="127.0.0.1"){
  return recoveryTransportAllowed(request(headers,peer),{trustProxyHops});
}

for(const proto of ["http","http, https","https, http","https,"," ,https","https,,https","wss",""]){
  test(`recovery rejects unsafe forwarded protocol ${JSON.stringify(proto)}`,()=>{
    assert.equal(decision({"x-forwarded-proto":proto,"x-forwarded-for":"192.0.2.20"}).allowed,false);
  });
}

for(const name of ["forwarded","x-forwarded-for","x-forwarded-host","x-forwarded-port","x-real-ip","cf-connecting-ip","cf-visitor","true-client-ip","via"]){
  test(`recovery rejects a proxy identified only by ${name}`,()=>{
    assert.equal(decision({[name]:"proxy-evidence"}).allowed,false);
    assert.equal(decision({[name]:""}).allowed,false,"empty proxy metadata is not evidence of a direct browser");
  });
}

test("recovery does not let loopback bypass disabled or invalid proxy trust",()=>{
  for(const trust of [0,-1,0.5,6,NaN,Infinity,"invalid"]){
    assert.equal(decision({"x-forwarded-proto":"https"},trust).allowed,false,String(trust));
  }
});

test("recovery validates the complete bounded forwarded protocol chain",()=>{
  assert.equal(decision({"x-forwarded-proto":"https, https"},1).allowed,false);
  assert.equal(decision({"x-forwarded-proto":"https, https"},2).allowed,true);
  assert.equal(decision({"x-forwarded-proto":"http, https"},2).allowed,false);
  assert.equal(decision({"x-forwarded-proto":["https"]},1).allowed,false);
});

test("reviewed same-host HTTPS remains supported without trusting a direct remote peer",()=>{
  const headers={host:"hub.example.test","x-forwarded-proto":" HTTPS ","x-forwarded-for":"192.0.2.20"};
  assert.deepEqual(decision(headers),{allowed:true,encrypted:true,loopback:true});
  assert.deepEqual(decision(headers,1,"192.0.2.20"),{allowed:false,encrypted:false,loopback:false});
  assert.equal(decision(headers,"1").allowed,true);
});

test("direct localhost and SSH-forwarded administration remain supported",()=>{
  for(const host of ["localhost:3000","127.0.0.1:3000","127.44.2.9:3000","[::1]:3000"]){
    for(const trust of [0,1,2]){
      assert.deepEqual(decision({host,origin:`http://${host}`},trust),{allowed:true,encrypted:false,loopback:true});
    }
  }
  assert.equal(decision({},1,"::1").allowed,true);
  assert.equal(decision({},1,"::ffff:127.0.0.1").allowed,true);
});

test("a remote or malformed authority cannot masquerade as direct localhost",()=>{
  for(const host of ["hub.example.test:3000","localhost.example.test","localhost@hub.example.test","hub.example.test@localhost","localhost/path","localhost?query","localhost#fragment","//localhost",""]){
    assert.equal(decision({host}).allowed,false,JSON.stringify(host));
  }
  for(const origin of ["http://hub.example.test","null","file:///tmp/page.html","http://localhost/path","http://user@localhost"]){
    assert.equal(decision({host:"localhost:3000",origin}).allowed,false,origin);
  }
});

test("only actual socket TLS can independently authorize a remote transport",()=>{
  const req=request({host:"hub.example.test"},"192.0.2.20");
  req.secure=true;
  req.protocol="https";
  assert.equal(recoveryTransportAllowed(req).allowed,false);
  req.socket.encrypted=true;
  assert.deepEqual(recoveryTransportAllowed(req),{allowed:true,encrypted:true,loopback:false});
});

test("real HTTP requests enforce the recovery policy before a guarded action",{timeout:5000},async t=>{
  let actions=0;
  const server=http.createServer((req,res)=>{
    const state=recoveryTransportAllowed(req,{trustProxyHops:1});
    if(state.allowed)actions++;
    res.writeHead(state.allowed?200:403,{"content-type":"application/json"});
    res.end(JSON.stringify(state));
  });
  const listening=once(server,"listening");
  server.listen(0,"127.0.0.1");
  t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
  await listening;
  const port=server.address().port;
  const send=headers=>new Promise((resolve,reject)=>{
    const req=http.request({host:"127.0.0.1",port,method:"POST",path:"/policy-probe",headers,agent:false},res=>{
      let body="";
      res.setEncoding("utf8");
      res.on("data",chunk=>{body+=chunk});
      res.on("error",reject);
      res.on("end",()=>{try{resolve({status:res.statusCode,state:JSON.parse(body)})}catch(error){reject(error)}});
    });
    req.on("error",reject);
    req.end();
  });
  for(const headers of [
    {"x-forwarded-proto":"http","x-forwarded-for":"192.0.2.20"},
    {"x-forwarded-proto":"http, https"},
    {"x-forwarded-for":"192.0.2.20"},
    {"x-forwarded-proto":""},
    {host:"hub.example.test"},
  ])assert.equal((await send(headers)).status,403);
  assert.equal(actions,0,"rejected transports must not reach the guarded action");
  assert.equal((await send({})).status,200);
  assert.equal((await send({host:"hub.example.test","x-forwarded-proto":"https","x-forwarded-for":"192.0.2.20"})).status,200);
  assert.equal(actions,2);
});
