"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {EventEmitter}=require("node:events"),{PassThrough}=require("node:stream");
const express=require("express");
const {ESPHomeManager,registerESPHomeRoutes,target,encryptionKey,validateCommand,STORE,secretName}=require("../src/esphome");
const {ClassroomHubStorage}=require("../src/storage");
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function store(){
  const data=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-esp-")),key=path.join(data,"master.key");
  fs.writeFileSync(key,crypto.randomBytes(32).toString("hex"));
  const storage=new ClassroomHubStorage({dataDir:data,dbFile:path.join(data,"hub.db"),masterKeyFile:key});
  return {storage,close(){storage.db.close();fs.rmSync(data,{recursive:true,force:true})}};
}
function harness(){
  const db=store(),manager=new ESPHomeManager({storage:db.storage,autostart:false});
  const key=crypto.randomBytes(32).toString("base64"),calls=[];
  manager.rpc=async(op,payload)=>{calls.push({op,payload});if(op==="probe")return {ok:true,info:{mac_address:"02:00:00:00:00:01",name:"fixture",esphome_version:"test"}};return {ok:true,confirmed:true,status:"state-confirmed"}};
  return {db,manager,key,calls,close(){manager.close();db.close()}};
}
async function enroll(h){await h.manager.save(null,{name:"Fixture node",address:"10.200.0.8",port:6053,key:h.key});return h.manager.records()[0]}
function online(h,record,entity={id:"0:12",key:12,deviceId:0,domain:"switch",writable:true,adminOnly:false}){
  h.manager.live.set(record.id,{generation:record.generation,online:true,error:"",entities:[entity],states:{}});return entity;
}

test("ESPHome endpoints and keys reject URLs, rebinding names, public/link-local/loopback addresses, malformed keys and ports",()=>{
  for(const address of ["127.0.0.1","0.0.0.0","169.254.169.254","224.0.0.1","192.0.2.1","8.8.8.8","::1","::ffff:10.0.0.1","device.local","http://10.1.2.3","10.1.2.3/24","172.32.1.1","192.168.01.1"])
    assert.throws(()=>target({address}),/private IPv4/);
  for(const address of ["10.1.2.3","172.16.1.1","172.31.255.1","192.168.5.7"])assert.deepEqual(target({address}),{address,port:6053});
  for(const port of [0,65536,"bad",1.5])assert.throws(()=>target({address:"10.0.0.8",port}),/port/);
  const key=crypto.randomBytes(32).toString("base64");assert.equal(encryptionKey(key),key);
  for(const value of ["",key+"\n",key.slice(1),crypto.randomBytes(31).toString("base64"),null,{}])assert.throws(()=>encryptionKey(value),/base64/);
});

test("entity allowlist validates strict types, numeric bounds/steps, advertised options, brightness and administrator actions",()=>{
  const normal={writable:true,domain:"switch"};assert.deepEqual(validateCommand(normal,{state:false}),{state:false});
  for(const command of [{state:1},{state:"off"},{toggle:true},{state:true,method:"execute_service"}])assert.throws(()=>validateCommand(normal,command));
  const light={...normal,domain:"light",brightness:true};assert.deepEqual(validateCommand(light,{state:true,brightness:0.4}),{state:true,brightness:0.4});
  for(const brightness of [-1,2,NaN,"0.3"])assert.throws(()=>validateCommand(light,{brightness}));
  assert.throws(()=>validateCommand({...light,brightness:false},{brightness:0.3}));
  const number={...normal,domain:"number",min:0,max:10,step:0.5};assert.deepEqual(validateCommand(number,{state:2.5}),{state:2.5});
  for(const state of [0.1,10.5,Infinity,"2.5"])assert.throws(()=>validateCommand(number,{state}));
  const select={...normal,domain:"select",options:["A","B"]};assert.throws(()=>validateCommand(select,{state:"C"}));
  const button={...normal,domain:"button",adminOnly:true};assert.throws(()=>validateCommand(button,{press:true,confirm:true},false),/Administrator/);
  assert.throws(()=>validateCommand(button,{press:true},true),/confirmation/);assert.deepEqual(validateCommand(button,{press:true,confirm:true},true),{press:true,confirm:true});
  assert.throws(()=>validateCommand({...normal,disabledByDefault:true},{state:true}));
  assert.throws(()=>validateCommand({...normal,domain:"lock"},{state:true}));
});

test("enrollment verifies identity and atomically persists encrypted keys without returning secrets",async()=>{
  const h=harness();try{
    const r=await enroll(h);assert.equal(h.calls[0].op,"probe");assert.equal(h.db.storage.getSecret(secretName(r.id)),h.key);
    assert.doesNotMatch(JSON.stringify(h.manager.list()),new RegExp(h.key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")));
    const preference=h.db.storage.db.prepare("SELECT value_json FROM system_preferences WHERE key=?").get(STORE).value_json;
    assert.equal(preference.includes(h.key),false);const secret=h.db.storage.db.prepare("SELECT * FROM secret_store WHERE name=?").get(secretName(r.id));assert.notEqual(secret.cipher_text,h.key);
    const reopened=new ESPHomeManager({storage:h.db.storage,autostart:false});assert.equal(reopened.records()[0].id,r.id);assert.equal(reopened.list().devices[0].online,false);reopened.close();
    await assert.rejects(h.manager.save(null,{name:"Duplicate",address:r.address,port:r.port,key:h.key}),/already enrolled/);
    await h.manager.save(r.id,{name:"Renamed",address:r.address,port:r.port,key:""});assert.equal(h.db.storage.getSecret(secretName(r.id)),h.key);
    h.manager.rpc=async()=>({info:{mac_address:"02:00:00:00:00:02"}});
    await assert.rejects(h.manager.save(r.id,{name:"Replacement",address:r.address,port:r.port,key:h.key}),/identity differs/);
    assert.equal(h.manager.records()[0].name,"Renamed");
  }finally{h.close()}
});

test("invalid credentials, missing encryption master key, and freeze during enrollment do not save a partial device",async()=>{
  const h=harness();try{
    h.manager.rpc=async()=>{throw Error("upstream credential text")};await assert.rejects(enroll(h));assert.deepEqual(h.manager.records(),[]);
    h.manager.rpc=async()=>{h.manager.canRun=()=>false;return {info:{mac_address:"02:00:00:00:00:01"}}};
    await assert.rejects(enroll(h),/locked/);assert.deepEqual(h.manager.records(),[]);assert.equal(h.db.storage.listSecrets().length,0);
    h.manager.canRun=()=>true;h.manager.rpc=async()=>({info:{mac_address:"02:00:00:00:00:01"}});
    const original=h.db.storage.putSecret;h.db.storage.putSecret=()=>{throw Error("master key unavailable")};await assert.rejects(enroll(h));assert.deepEqual(h.manager.records(),[]);h.db.storage.putSecret=original;
  }finally{h.close()}
});

test("device operations are serialized; disabled and removed devices lose command access, and remove is not a hardware reset",async()=>{
  const h=harness();try{
    const r=await enroll(h);online(h,r);h.manager.saving=true;await assert.rejects(h.manager.change(r.id,{remove:true}),/busy/);h.manager.saving=false;
    await h.manager.change(r.id,{enabled:false});await assert.rejects(h.manager.command(r.id,"0:12",{requestId:"fixture-1",command:{state:true}}),/not connected/);
    assert.equal(h.db.storage.hasSecret(secretName(r.id)),true);
    await h.manager.change(r.id,{remove:true});assert.deepEqual(h.manager.records(),[]);assert.equal(h.db.storage.hasSecret(secretName(r.id)),false);
    assert.equal(h.calls.some(c=>c.op==="command"),false);
  }finally{h.close()}
});

test("commands deduplicate, reject per-device overlap and conflicting IDs, and never replay uncertain outcomes",async()=>{
  const h=harness();try{
    const r=await enroll(h);online(h,r);let release,count=0;
    h.manager.rpc=()=>{count++;return new Promise(resolve=>release=resolve)};
    const command={requestId:"same-request",command:{state:true}},options={owner:"teacher"};
    const first=h.manager.command(r.id,"0:12",command,options),duplicate=h.manager.command(r.id,"0:12",command,options);
    await assert.rejects(h.manager.command(r.id,"0:12",{...command,command:{state:false}},options),/different command/);
    await assert.rejects(h.manager.command(r.id,"0:12",{...command,requestId:"second-request"},options),/in progress/);
    release({confirmed:false,status:"sent-unconfirmed"});assert.equal((await first).confirmed,false);await duplicate;assert.equal(count,1);
    await h.manager.command(r.id,"0:12",command,options);assert.equal(count,1);
    h.manager.rpc=async()=>{count++;throw Error("delivery uncertain")};const unknown={...command,requestId:"unknown-request"};
    await assert.rejects(h.manager.command(r.id,"0:12",unknown,options));await assert.rejects(h.manager.command(r.id,"0:12",unknown,options));assert.equal(count,2);
    h.manager.canRun=()=>false;await assert.rejects(h.manager.command(r.id,"0:12",{...command,requestId:"freeze-request"},options),/locked/);assert.equal(count,2);
  }finally{h.close()}
});

function fakeChild(){const child=new EventEmitter();child.stdout=new PassThrough();child.stdin=new PassThrough();child.killed=false;child.kill=()=>{child.killed=true};return child}
test("worker IPC is bounded, errors are redacted, late generation events ignored and exit marks state offline",async()=>{
  const db=store(),child=fakeChild(),key=crypto.randomBytes(32).toString("base64");let invocation;
  const manager=new ESPHomeManager({storage:db.storage,autostart:false,spawnProcess:(...args)=>{invocation=args;return child}});
  try{
    const record={id:"fixture",generation:"current",name:"Fixture",address:"10.0.0.8",port:6053,mac:"02:00:00:00:00:01"};db.storage.setPreference(STORE,[record]);
    const response=manager.rpc("probe",{device:{key}});assert.equal(JSON.stringify(invocation).includes(key),false);assert.equal(invocation[2].stdio[2],"ignore");
    child.stdout.write(JSON.stringify({requestId:"1",ok:false,error:`secret ${key}`})+"\n");await assert.rejects(response,/operation-failed/);
    child.stdout.write(JSON.stringify({event:"device",device:{id:"fixture",generation:"old",online:true,entities:[]}})+"\n");assert.equal(manager.list().devices[0].online,false);
    child.stdout.write(JSON.stringify({event:"device",device:{id:"fixture",generation:"current",online:true,entities:[],states:{}}})+"\n");assert.equal(manager.list().devices[0].online,true);
    const pending=manager.rpc("command",{});manager.lastWorkerAt=Date.now()-46000;manager.checkWorker();await assert.rejects(pending,/not be replayed/);assert.equal(manager.list().devices[0].online,false);
  }finally{manager.close();db.close()}
});
test("oversized and stalled IPC terminate the worker rather than executing late commands",async()=>{
  for(const mode of ["oversize","timeout"]){const db=store(),child=fakeChild(),manager=new ESPHomeManager({storage:db.storage,autostart:false,spawnProcess:()=>child});
    try{const pending=manager.rpc("command",{},20);const rejected=assert.rejects(pending,/not be replayed/);if(mode==="oversize")child.stdout.write("x".repeat(2*1024*1024+1));await delay(30);await rejected;assert.equal(child.killed,true)}finally{manager.close();db.close()}}
});

test("worker restart backoff prevents rapid process respawn and grows across pre-health failures",async()=>{
  const db=store(),children=[fakeChild(),fakeChild()],spawned=[];let now=0;
  const manager=new ESPHomeManager({storage:db.storage,autostart:false,now:()=>now,restartBaseMs:100,restartMaxMs:400,spawnProcess:()=>{const child=children[spawned.length];spawned.push(child);return child}});
  try{
    const first=manager.rpc("probe",{});children[0].emit("exit",1);await assert.rejects(first,/not be replayed/);
    await assert.rejects(manager.rpc("probe",{}),/cooling down/);assert.equal(spawned.length,1);
    now=100;const second=manager.rpc("probe",{});assert.equal(spawned.length,2);
    children[1].stdout.write("{}\n");children[1].emit("exit",1);await assert.rejects(second,/not be replayed/);
    now=299;await assert.rejects(manager.rpc("probe",{}),/cooling down/);
    assert.equal(spawned.length,2);assert.equal(manager.nextWorkerAt,300);
  }finally{manager.close();db.close()}
});

test("synchronous worker spawn failures enter the same restart cooldown",async()=>{
  const db=store();let now=0,calls=0;
  const manager=new ESPHomeManager({storage:db.storage,autostart:false,now:()=>now,restartBaseMs:50,spawnProcess:()=>{calls++;throw Error("exec failed")}});
  try{
    await assert.rejects(manager.rpc("probe",{}),/unavailable/);
    await assert.rejects(manager.rpc("probe",{}),/cooling down/);assert.equal(calls,1);
    now=50;await assert.rejects(manager.rpc("probe",{}),/unavailable/);assert.equal(calls,2);
  }finally{manager.close();db.close()}
});

test("real HTTP routes enforce read/control/admin boundaries, hide key material and track async export mutations",async()=>{
  const h=harness(),app=express();let active=0,role="none";app.use(express.json());
  const gate=allowed=>(_req,res,next)=>allowed.includes(role)?next():res.status(403).json({error:"denied"});
  registerESPHomeRoutes(app,{manager:h.manager,requireRead:gate(["viewer","operator","admin"]),requireControl:gate(["operator","admin"]),requireAdmin:gate(["admin"]),isAdmin:()=>role==="admin",owner:()=>role,track:task=>{active++;return task.finally(()=>active--)}});
  const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));const base=`http://127.0.0.1:${server.address().port}/api/v1/esphome/devices`;
  const request=(url,body,method="POST")=>fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  try{
    assert.equal((await fetch(base)).status,403);role="viewer";assert.equal((await fetch(base)).status,200);assert.equal((await request(base,{})).status,403);
    role="operator";assert.equal((await request(base,{})).status,403);
    role="admin";const result=await request(base,{name:"HTTP fixture",address:"10.0.0.8",key:h.key});assert.equal(result.status,200);const value=await result.json();assert.equal(JSON.stringify(value).includes(h.key),false);const r=h.manager.records()[0];online(h,r,{id:"0:1",domain:"button",writable:true,adminOnly:true});
    role="operator";assert.equal((await request(`${base}/${r.id}/entities/0:1/command`,{requestId:"button-1",command:{press:true,confirm:true}})).status,403);
    role="admin";assert.equal((await request(`${base}/${r.id}/entities/0:1/command`,{requestId:"button-1",command:{press:true,confirm:true}})).status,200);await delay(0);assert.equal(active,0);
    h.manager.rpc=async()=>{throw Error("RAW_SECRET_SHOULD_NOT_LEAK")};const failureResponse=await request(base,{name:"Broken",address:"10.0.0.9",key:h.key});assert.equal(failureResponse.status,503);assert.equal((await failureResponse.text()).includes("RAW_SECRET"),false);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));h.close()}
});
