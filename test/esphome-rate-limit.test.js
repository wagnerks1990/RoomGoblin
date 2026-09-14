"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const express=require("express");
const {registerESPHomeRoutes}=require("../src/esphome");

test("ESPHome HTTP budgets stop rapid requests before authorization and keep polling, management and commands separate",async(t)=>{
  const app=express(),calls={read:0,management:0,command:0,auth:0};
  app.use(express.json());
  const gate=(req,res,next)=>{calls.auth++;return req.get("x-fixture-authorized")==="yes"?next():res.status(403).json({ok:false})};
  const manager={
    list(){calls.read++;return {ok:true,devices:[]}},
    async save(){calls.management++;return {ok:true}},
    async change(){calls.management++;return {ok:true}},
    async command(){calls.command++;return {ok:true}}
  };
  registerESPHomeRoutes(app,{manager,requireRead:gate,requireControl:gate,requireAdmin:gate,isAdmin:()=>true,owner:()=>"fixture"});
  const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
  const base=`http://127.0.0.1:${server.address().port}/api/v1/esphome/devices`;
  async function request(method="GET",suffix="",allowed=true,forward="198.51.100.1"){
    const response=await fetch(base+suffix,{method,headers:{"content-type":"application/json","x-fixture-authorized":allowed?"yes":"no","x-forwarded-for":forward},...(method==="GET"?{}:{body:"{}"})});
    await response.json();return response;
  }
  const writes=[["POST",""],["PUT","/fixture"],["POST","/fixture/enabled"],["DELETE","/fixture"]];
  for(let i=0;i<60;i++){
    const [method,suffix]=writes[i%writes.length];
    assert.equal((await request(method,suffix,i<30,`198.51.100.${i+1}`)).status,i<30?200:403);
  }
  assert.equal(calls.management,30);
  const before=calls.auth;
  for(const [method,suffix] of writes){
    const blocked=await request(method,suffix,true,"203.0.113.2");
    assert.equal(blocked.status,429);
    assert.ok(Number(blocked.headers.get("retry-after"))>0);
    assert.ok(blocked.headers.get("ratelimit"));
  }
  assert.equal(calls.auth,before,"throttled requests must not run authorization or reach a worker");
  assert.equal(calls.management,30);
  for(let i=0;i<240;i++)assert.equal((await request("POST",`/fixture-${i}/entities/0:1/command`)).status,200);
  assert.equal((await request("POST","/different-node/entities/0:2/command",true,"203.0.113.3")).status,429);
  assert.equal(calls.command,240,"target changes must not multiply the command quota");
  for(let i=0;i<600;i++)assert.equal((await request()).status,200);
  assert.equal((await request()).status,429);
  assert.equal(calls.read,600,"polling must have an independent budget");
});
