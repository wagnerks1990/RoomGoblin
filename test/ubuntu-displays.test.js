"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {Server,utils}=require("ssh2");
const express=require("express");
const {UbuntuDisplays,registerUbuntuDisplayRoutes,target,hostKey,hubOrigin,screenConfig,sshOperation,fingerprint,credentials,STORE}=require("../src/ubuntu-displays");
const monitor="a".repeat(64),machineId="b".repeat(64),fp="SHA256:"+"A".repeat(43);
const outputs=[{connector:"HDMI-1",connected:true,monitorId:monitor,modes:["1920x1080"]},{connector:"DP-1",connected:true,monitorId:monitor,modes:["1920x1080"]}];
const input={hubUrl:"http://10.0.0.2:3000",screens:outputs.map((o,i)=>({...o,receiverId:`screen${i+1}`,name:`Screen ${i+1}`}))};
const probe={machineId,outputs,graphics:"x11",distribution:"ubuntu",version:"24.04",architecture:"x86_64"};
function harness(transport){
  const prefs=new Map(),secrets=new Map(),receivers={},tasks=[];
  const storage={getPreference:(k,d)=>structuredClone(prefs.get(k)??d),setPreference:(k,v)=>prefs.set(k,structuredClone(v)),putSecret:(k,v)=>secrets.set(k,v),getSecret:k=>secrets.get(k),deleteSecret:k=>secrets.delete(k),tx:fn=>fn(),displayCredentialPolicy:()=>({authenticationRequired:false})};
  const manager=new UbuntuDisplays({storage,autostart:false,transport:transport||(async()=>({})),receivers:()=>receivers,ensureReceivers:screens=>screens.forEach(s=>receivers[s.receiverId]={name:s.name}),track:p=>tasks.push(p)});
  return {manager,storage,receivers,tasks,secrets};
}
test("private targets, pinned host identities and SSH credentials fail closed",()=>{
  for(const address of ["localhost","127.0.0.1","169.254.169.254","8.8.8.8","::1","10.0.0.1;id"])assert.throws(()=>target({address}));
  assert.deepEqual(target({address:"172.16.1.4"}),{address:"172.16.1.4",port:22});
  assert.throws(()=>target({address:"10.0.0.1",port:0}));assert.throws(()=>hostKey(""));assert.equal(hostKey(fp),fp);
  assert.throws(()=>credentials({username:"root; id",password:"password"}));
  assert.throws(()=>credentials({username:"root",privateKey:"not a key"}));
  assert.deepEqual(credentials({username:"root",password:"a!#'$\\;"}),{username:"root",password:"a!#'$\\;"});
  for(const url of ["file:///tmp/x","http://user:pass@10.0.0.2","http://10.0.0.2/a","http://10.0.0.2/?token=secret"])assert.throws(()=>hubOrigin(url));
});
test("two identical monitors remain separate by connector; duplicate receivers and remapping fail",()=>{
  const result=screenConfig(input,probe);assert.equal(result.screens.length,2);assert.notEqual(result.screens[0].receiverId,result.screens[1].receiverId);
  assert.throws(()=>screenConfig({...input,screens:[input.screens[0],{...input.screens[1],receiverId:"screen1"}]},probe));
  assert.throws(()=>screenConfig(input,probe,[{config:{screens:[{receiverId:"screen1"}]}}]));
  assert.throws(()=>screenConfig(input,{...probe,outputs:[{...outputs[0],monitorId:"c".repeat(64)},outputs[1]]}));
  assert.throws(()=>screenConfig(input,{...probe,outputs:[{...outputs[0],connected:false},outputs[1]]}));
  assert.throws(()=>screenConfig({...input,screens:[{...input.screens[0],mode:"8000x8000"}]},probe));
  assert.throws(()=>screenConfig(input,probe,[],{screen1:{enabled:false}}));
  assert.equal(screenConfig({...input,screens:[]},{...probe,graphics:"session-unavailable"},[],{},true).screens.length,0);
});
test("bootstrap uses ephemeral admin credentials and a separate restricted encrypted key; exact identities are verified",async()=>{
  const calls=[];let id;
  const h=harness(async request=>{calls.push(request);if(request.command.endsWith("python3 -"))return probe;
    if(request.command.includes("python3 -c")){id=JSON.parse(request.input).id;return {installed:true}}
    const command=JSON.parse(request.input);if(command.action==="status")return {...probe,identity:id};return {ok:true};
  });
  const result=await h.manager.enroll({...input,name:"Computer",address:"10.0.0.8",username:"root",password:"private-password",fingerprint:fp,confirm:true});
  await Promise.all(h.tasks);assert.equal(h.manager.jobs.get(result.job.id).state,"completed");
  assert.equal(h.manager.records()[0].state,"ready");assert.equal(h.secrets.size,1);
  const serialized=JSON.stringify(h.manager.list());assert.ok(!serialized.includes("private-password"));assert.ok(!serialized.includes("PRIVATE KEY"));
  assert.equal(calls.find(c=>c.command==="roomgoblin-display").auth.username,"rg-display-mgr");
  assert.deepEqual(Object.keys(h.receivers),["screen1","screen2"]);
  await assert.rejects(h.manager.command(id,{action:"shell",command:"id"}),/Unsupported/);
  await assert.rejects(h.manager.command(id,{action:"reboot"}),/confirmation/);
  await assert.rejects(h.manager.enroll({...input,name:"Duplicate",address:"10.0.0.8",username:"root",password:"p",fingerprint:fp,confirm:true}),/already enrolled/);
});
test("failed install retains recovery identity and never claims readiness or returns raw SSH errors",async()=>{
  const h=harness(async request=>{if(request.command.endsWith("python3 -"))return probe;throw Error("secret raw diagnostic")});
  const result=await h.manager.enroll({...input,name:"Computer",address:"10.0.0.8",username:"root",password:"p",fingerprint:fp,confirm:true});
  await Promise.all(h.tasks);const job=h.manager.jobs.get(result.job.id);
  assert.equal(job.state,"failed");assert.ok(!job.error.includes("secret raw"));assert.equal(h.manager.records()[0].state,"attention");assert.equal(h.secrets.size,1);
});
test("mutations honor full-recovery freeze and serialize each device",async()=>{
  const h=harness();h.manager.canRun=()=>false;
  await assert.rejects(h.manager.enroll({}),e=>e.status===423);await assert.rejects(h.manager.command("x",{}),e=>e.status===423);
  h.manager.canRun=()=>true;h.manager.busy.add("x");await assert.rejects(h.manager.command("x",{action:"reboot",confirm:true}),e=>e.status===409);
});
test("actual SSH transport verifies host keys, isolates JSON stdin, bounds output and rejects changed identity",async t=>{
  const key=crypto.generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs1",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}}).privateKey;
  const pinned=fingerprint(utils.parseKey(key).getPublicSSH());let authenticated=0,received="";
  const server=new Server({hostKeys:[key]},client=>{
    client.on("error",()=>{});client.on("authentication",ctx=>{authenticated++;ctx.accept()});
    client.on("ready",()=>client.on("session",accept=>accept().on("exec",(accept,reject,info)=>{const stream=accept();stream.on("data",d=>received+=d);stream.on("end",()=>{stream.write(JSON.stringify({ok:true,command:info.command}));stream.exit(0);stream.end()})})));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));t.after(()=>server.close());
  const endpoint={address:"127.0.0.1",port:server.address().port,hostFingerprint:pinned,auth:{username:"fixture",password:"opaque!$"}};
  const discovered=await sshOperation({...endpoint,discover:true});assert.equal(discovered.fingerprint,pinned);assert.equal(authenticated,0);
  const result=await sshOperation({...endpoint,command:"roomgoblin-display",input:'{"action":"status"}'});assert.equal(result.command,"roomgoblin-display");assert.equal(received,'{"action":"status"}');
  await assert.rejects(sshOperation({...endpoint,hostFingerprint:fp,command:"anything"}),/identity changed/);
  await assert.rejects(sshOperation({...endpoint,command:"anything",maxBytes:4}),/limit/);
});
test("HTTP routes require administrator access and protect SSH credentials on remote HTTP",async t=>{
  const app=express();app.use(express.json());let probed=0;
  const manager={list:()=>({ok:true,devices:[]}),probe:async()=>{probed++;return {ok:true}}};
  const isAdmin=req=>req.get("x-test-admin")==="yes";
  registerUbuntuDisplayRoutes(app,{manager,requireAdmin:(req,res,next)=>isAdmin(req)?next():res.sendStatus(403),isAdmin});
  const server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.once("listening",resolve));t.after(()=>server.close());
  const url=`http://127.0.0.1:${server.address().port}/api/v1/ubuntu-displays`;
  assert.equal((await fetch(url)).status,403);assert.equal((await fetch(url,{headers:{"x-test-admin":"yes"}})).status,200);
  assert.equal((await fetch(url+"/probe",{method:"POST",headers:{"x-test-admin":"yes","x-forwarded-proto":"http","content-type":"application/json"},body:"{}"})).status,403);assert.equal(probed,0);
});
test("Linux screen identity and root-helper regression suite",{skip:process.platform!=="linux"?"Linux-only device runtime; covered by the Linux worktree runner":false},()=>{
  const result=require("node:child_process").spawnSync("python3",["-m","unittest","discover","-s","test","-p","ubuntu_display_test.py","-v"],{encoding:"utf8",timeout:30000});
  assert.equal(result.status,0,result.stdout+result.stderr);
});
