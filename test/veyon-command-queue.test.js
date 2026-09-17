"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {VeyonCommandQueue}=require("../src/veyon-command-queue");
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<1000;i++){if(fn())return;await delay(1)}throw Error("queue condition timed out")}
function harness(options={}){
  const computers=new Map(Array.from({length:24},(_,i)=>{const id=`pc${i}`;return [id,{id,ip:`192.0.2.${i+1}`,name:id}]})),state=new Map(),calls=[],writes=[];
  let journal=options.journal||[],allowed=true,paused=false,active=0;
  const q=new VeyonCommandQueue({
    execute:async(ip,feature,value,args)=>{calls.push({ip,feature,value,args});state.set(`${ip}|${feature}`,value)},
    readState:async(ip,feature)=>({active:state.get(`${ip}|${feature}`)||false}),eligible:async()=>({eligible:true}),
    authorize:()=>allowed,lookup:id=>computers.get(id),readJournal:()=>journal,
    writeJournal:value=>{assert.ok(active>0,"journal writes hold export lease");journal=structuredClone(value);writes.push(journal)},
    canRun:()=>!paused,begin:()=>active++,end:()=>active--,safeError:()=>"Safe command error",retryMs:1,tickMs:5,...options
  });
  return {q,computers,state,calls,writes,journal:()=>journal,allow:v=>allowed=v,pause:v=>paused=v,active:()=>active};
}
test("24 commands stream through bounded workers and each host serializes",async()=>{
  let active=0,max=0;const busy=new Set(),calls=[];
  const h=harness({execute:async(ip)=>{assert.equal(busy.has(ip),false);busy.add(ip);max=Math.max(max,++active);await delay(3);calls.push(ip);active--;busy.delete(ip)}});
  try{
    const targets=[...h.computers.values()];
    const a=h.q.enqueue({feature:"textMessage",targets,args:{text:"hello"}}),b=h.q.enqueue({feature:"openWebsite",targets,args:{websiteUrls:["https://example.test"]}});
    await until(()=>h.q.get(a.id).state==="completed"&&h.q.get(b.id).state==="completed");assert.equal(calls.length,48);assert.equal(max,6);assert.equal(h.q.get(a.id).summary.succeeded,24);assert.equal(h.active(),0);
  }finally{h.q.stop()}
});
test("request IDs deduplicate and reject conflicts without exposing login arguments",async()=>{
  const h=harness();h.pause(true);
  try{
    const command={feature:"userLogin",targets:[h.computers.get("pc0")],owner:"operator",requestId:"test-1",args:{password:"secret-login"}};
    const a=h.q.enqueue(command);assert.equal(h.q.enqueue(command).id,a.id);
    assert.throws(()=>h.q.enqueue({...command,args:{password:"different"}}),/different command/);
    assert.doesNotMatch(JSON.stringify(h.q.list()),/secret-login|password/);assert.deepEqual(h.journal(),[]);
    h.q.cancel(a.id);assert.equal(h.q.get(a.id).summary.cancelled,1);
  }finally{h.q.stop()}
});
test("offline lock retries release preview pressure; ordinary ambiguous writes never replay",async()=>{
  let online=false;const h=harness({retryMs:100,eligible:async()=>({eligible:online,reason:"offline"})});
  try{
    const a=h.q.enqueue({feature:"screenLock",targets:[h.computers.get("pc0")]});await until(()=>h.q.get(a.id).summary.retrying===1);assert.equal(h.q.pressure(),false);
    online=true;await until(()=>h.q.get(a.id).state==="completed");assert.equal(h.q.get(a.id).summary.succeeded,1);assert.equal(h.q.get(a.id).results[0].verified,true);
    let writes=0;h.q.execute=async()=>{writes++;throw Error("uncertain delivery")};
    const b=h.q.enqueue({feature:"reboot",targets:[h.computers.get("pc1")]});await until(()=>h.q.get(b.id).state==="completed");assert.equal(writes,1);assert.equal(h.q.get(b.id).summary.unknown,1);
  }finally{h.q.stop()}
});
test("new unlock supersedes a lock awaiting feature state before it can write",async()=>{
  let release;const gate=new Promise(r=>release=r);let reads=0;
  const h=harness({readState:async()=>{if(++reads===1)await gate;return {active:false}}});
  try{
    const target=h.computers.get("pc0"),a=h.q.enqueue({feature:"screenLock",targets:[target]});await until(()=>reads===1);
    const b=h.q.enqueue({feature:"screenLock",active:false,targets:[target]});release();await until(()=>h.q.get(b.id).state==="completed");
    assert.equal(h.q.get(a.id).summary.cancelled,1);assert.equal(h.calls.length,0);assert.equal(h.q.get(b.id).summary.succeeded,1);
  }finally{h.q.stop()}
});
test("owned lock journal precedes dispatch and restart clears only recorded locks",async()=>{
  const h=harness();
  try{
    h.q.execute=async(ip,feature,value)=>{if(value)assert.equal(h.journal()[0].feature,feature);h.state.set(`${ip}|${feature}`,value)};
    const a=h.q.enqueue({feature:"inputLock",targets:[h.computers.get("pc0")]});await until(()=>h.q.get(a.id).state==="completed");assert.equal(h.journal().length,1);
    const journal=h.journal();h.q.stop();
    const fresh=harness({journal,readState:async()=>({active:true}),execute:async(_ip,_feature,value)=>{assert.equal(value,false);fresh.q.readState=async()=>({active:false})}});
    try{await until(()=>fresh.q.list()[0].state==="completed");assert.equal(fresh.q.list()[0].active,false);assert.deepEqual(fresh.journal(),[])}finally{fresh.q.stop()}
  }finally{h.q.stop()}
});
test("preexisting external lock is not adopted or reasserted; denied users and expired jobs never dispatch",async()=>{
  const h=harness({readState:async()=>({active:true})});
  try{
    const target=h.computers.get("pc0"),a=h.q.enqueue({feature:"screenLock",targets:[target]});await until(()=>h.q.get(a.id).state==="completed");assert.deepEqual(h.journal(),[]);assert.equal(h.q.intents.size,0);
    h.allow(false);const b=h.q.enqueue({feature:"reboot",targets:[target]});await until(()=>h.q.get(b.id).state==="completed");assert.equal(h.q.get(b.id).results[0].reason,"permission-revoked");
    h.pause(true);const c=h.q.enqueue({feature:"screenLock",targets:[target],expiresAt:Date.now()-1});h.pause(false);h.q.tick();assert.equal(h.q.get(c.id).results[0].reason,"expired");assert.equal(h.calls.length,0);
  }finally{h.q.stop()}
});
test("export freeze pauses new attempts and journal writes; owned state reconciles without a browser",async()=>{
  const h=harness();h.pause(true);
  try{
    const target=h.computers.get("pc0"),a=h.q.enqueue({feature:"screenLock",targets:[target]});await delay(15);assert.equal(h.calls.length,0);assert.equal(h.writes.length,0);
    h.pause(false);h.q.tick();await until(()=>h.q.get(a.id).state==="completed");h.state.set(`${target.ip}|screenLock`,false);h.q.nextReconcile=0;h.q.tick();await until(()=>h.calls.length===2&&h.active()===0);assert.equal(h.q.list().length,1);assert.equal(h.state.get(`${target.ip}|screenLock`),true);
  }finally{h.q.stop()}
});

test("newer same-state intent survives older completion and cancel; identity and TTL checked after reads",async()=>{
  let release;const gate=new Promise(r=>release=r);let reads=0;
  const h=harness({readState:async()=>{if(++reads===1)await gate;return {active:true}}});
  try{
    const target=h.computers.get("pc0"),a=h.q.enqueue({feature:"screenLock",targets:[target]});await until(()=>reads===1);
    const b=h.q.enqueue({feature:"screenLock",targets:[target]});h.q.cancel(a.id);assert.equal(h.q.intents.get(`${target.ip}|screenLock`).jobId,b.id);
    release();await until(()=>h.q.get(b.id).state==="completed");assert.equal(h.q.get(a.id).summary.cancelled,1);assert.equal(h.q.get(b.id).summary.succeeded,1);
  }finally{h.q.stop()}
  for(const change of ["expiry","identity"]){
    let stamp=Date.now();const x=harness({now:()=>stamp,readState:async()=>{if(change==="expiry")stamp+=120001;else x.computers.delete("pc0");return {active:false}}});
    try{const j=x.q.enqueue({feature:"inputLock",targets:[x.computers.get("pc0")]});await until(()=>x.q.get(j.id).state==="completed");assert.equal(x.calls.length,0);assert.equal(x.q.get(j.id).results[0].reason,change==="expiry"?"expired":"computer-removed-or-changed")}finally{x.q.stop()}
  }
});
test("large startup journals group recovery safely and revoked confirmed owners trigger owned unlock",async()=>{
  const journal=Array.from({length:200},(_,i)=>({id:`fixture${i}`,ip:`fixture${i}`,feature:i%2?"screenLock":"inputLock",createdAt:1}));
  const large=harness({journal,canRun:()=>false});try{assert.equal(large.q.list().length,2);assert.equal(large.q.ownedLocks().length,200)}finally{large.q.stop()}
  const h=harness();
  try{
    const j=h.q.enqueue({feature:"screenLock",targets:[h.computers.get("pc0")]});await until(()=>h.q.get(j.id).state==="completed");h.allow(false);h.q.reconcile();await until(()=>h.q.intents.size===0);h.q.reconcile();await until(()=>h.journal().length===0);assert.equal(h.calls.at(-1).value,false);
  }finally{h.q.stop()}
});
test("backoff preserves per-host order and does not unnecessarily block other hosts or previews",async()=>{
  let online=false;const h=harness({retryMs:100,eligible:async(rec)=>({eligible:rec.id!=="pc0"||online,reason:"offline"})});
  try{
    const first=h.q.enqueue({feature:"screenLock",targets:[h.computers.get("pc0")]});await until(()=>h.q.get(first.id).summary.retrying===1);
    const later=h.q.enqueue({feature:"textMessage",targets:[h.computers.get("pc0")]});assert.equal(h.q.pressure(),false);
    const other=h.q.enqueue({feature:"textMessage",targets:[h.computers.get("pc1")]});await until(()=>h.q.get(other.id).state==="completed");assert.equal(h.q.get(later.id).summary.queued,1);
    online=true;await until(()=>h.q.get(later.id).state==="completed");assert.deepEqual(h.calls.filter(c=>c.ip===h.computers.get("pc0").ip).map(c=>c.feature),["screenLock","textMessage"]);
  }finally{h.q.stop()}
});

test("broadcast modes journal no tokens, observe reconnect without replay, and clear on Hub restart",async()=>{
  const h=harness();
  try{
    const target=h.computers.get("pc0");
    const j=h.q.enqueue({feature:"demoServer",targets:[target],args:{demoAccessToken:"secret-demo-token"}});await until(()=>h.q.get(j.id).state==="completed");assert.equal(h.journal()[0].feature,"demoServer");assert.doesNotMatch(JSON.stringify(h.journal()),/token|secret-demo/);
    h.q.reconcileHost(target.ip);await until(()=>h.active()===0);assert.equal(h.calls.length,1,"active broadcast was not replayed");
    h.state.set(`${target.ip}|demoServer`,false);h.q.reconcileHost(target.ip);await until(()=>h.journal().length===0);assert.equal(h.calls.length,1,"reconnected endpoint was not forced back into broadcast");
    const again=h.q.enqueue({feature:"windowDemoClient",targets:[target],args:{demoAccessToken:"another-secret"}});await until(()=>h.q.get(again.id).state==="completed");const saved=h.journal();h.q.stop();
    const fresh=harness({journal:saved,readState:async()=>({active:true}),execute:async(_ip,feature,value,args)=>{assert.equal(feature,"windowDemoClient");assert.equal(value,false);assert.deepEqual(args,{});fresh.q.readState=async()=>({active:false})}});
    try{await until(()=>fresh.journal().length===0);assert.equal(fresh.q.list()[0].results[0].verified,true)}finally{fresh.q.stop()}
  }finally{h.q.stop()}
});
test("transient eligibility transport errors retry locks while permanent authentication failures stop",async()=>{
  for(const [error,retry] of [[Object.assign(Error("timed out"),{reason:"timeout"}),true],[Object.assign(Error("denied"),{veyonCode:6}),false]]){
    let attempts=0;const h=harness({eligible:async()=>{if(++attempts===1)throw error;return {eligible:true}}});
    try{const job=h.q.enqueue({feature:"screenLock",targets:[h.computers.get("pc0")]});await until(()=>h.q.get(job.id).state==="completed");assert.equal(attempts,retry?2:1);assert.equal(h.q.get(job.id).summary[retry?"succeeded":"failed"],1)}finally{h.q.stop()}
  }
});

test("failed durable ownership writes fail closed before any mode or lock command",async()=>{
  for(const feature of ["screenLock","demoServer"]){
    const h=harness({writeJournal:()=>{throw Error("disk unavailable")}});
    try{const j=h.q.enqueue({feature,targets:[h.computers.get("pc0")]});await until(()=>h.q.get(j.id).state==="completed");assert.equal(h.q.get(j.id).summary.failed,1);assert.equal(h.calls.length,0);assert.equal(h.q.ownedLocks().length,0)}finally{h.q.stop()}
  }
});

test("broadcast stop retries a disconnected endpoint and confirms inactive state",async()=>{
  let online=false;const h=harness({retryMs:20,eligible:async()=>({eligible:online,reason:"offline"})});
  try{
    const target=h.computers.get("pc0");h.state.set(`${target.ip}|fullScreenDemoClient`,true);
    const job=h.q.enqueue({feature:"fullScreenDemoClient",active:false,targets:[target]});
    await until(()=>h.q.get(job.id).summary.retrying===1);online=true;
    await until(()=>h.q.get(job.id).state==="completed");
    assert.equal(h.q.get(job.id).summary.succeeded,1);assert.equal(h.q.get(job.id).results[0].verified,true);
    assert.equal(h.state.get(`${target.ip}|fullScreenDemoClient`),false);
  }finally{h.q.stop()}
});

test("expired broadcast stop remains pending cleanup and clears after reconnect",async()=>{
  let stamp=Date.now(),online=true;const h=harness({now:()=>stamp,eligible:async()=>({eligible:online,reason:"offline"})});
  try{
    const target=h.computers.get("pc0"),start=h.q.enqueue({feature:"fullScreenDemoClient",targets:[target],args:{demoAccessToken:"fixture-only"}});
    await until(()=>h.q.get(start.id).state==="completed");online=false;
    const stop=h.q.enqueue({feature:"fullScreenDemoClient",active:false,targets:[target]});
    await until(()=>h.q.get(stop.id).summary.retrying===1);stamp+=120001;h.q.tick();
    assert.equal(h.q.get(stop.id).results[0].reason,"expired");assert.equal(h.q.ownedLocks()[0].recoveryPending,true);
    await until(()=>h.q.list().some(job=>job.recovery&&job.summary.retrying===1));
    online=true;stamp+=30001;h.q.tick();
    await until(()=>h.journal().length===0);assert.equal(h.state.get(`${target.ip}|fullScreenDemoClient`),false);
  }finally{h.q.stop()}
});

test("stop queued behind a starting broadcast retains cleanup intent",async()=>{
  let release,releaseStop;
  const gate=new Promise(resolve=>{release=resolve}),stopGate=new Promise(resolve=>{releaseStop=resolve});
  const h=harness({eligible:async(_rec,_feature,active)=>{await (active?gate:stopGate);return {eligible:true}}});
  try{
    const target=h.computers.get("pc0"),start=h.q.enqueue({feature:"demoServer",targets:[target]});
    await until(()=>h.q.get(start.id).summary.running===1);
    const stop=h.q.enqueue({feature:"demoServer",active:false,targets:[target]});
    release();await until(()=>h.q.get(start.id).state==="completed");
    assert.equal(h.q.activeModes.has(`${target.ip}|demoServer`),false);
    releaseStop();await until(()=>h.q.get(stop.id).state==="completed");
    assert.equal(h.journal().length,0);
  }finally{release();releaseStop();h.q.stop()}
});

test('selected broadcast cleanup reserves all modes or none when queue is full',()=>{
  const h=harness();h.pause(true);
  try{
    const targets=[...h.computers.values()];
    const jobs=h.q.enqueueModeCleanup(targets,'operator');assert.equal(jobs.length,3);assert.ok(jobs.every(j=>j.active===false));
    while(h.q.jobs.size<126)h.q.enqueue({feature:'textMessage',targets:[targets[0]]});
    const before=h.q.jobs.size;
    assert.throws(()=>h.q.enqueueModeCleanup(targets,'operator'),/No cleanup commands/);
    assert.equal(h.q.jobs.size,before);
  }finally{h.q.stop()}
});

test("clipboard content is transient, unverified, deduplicated and never replayed",async()=>{
  let count=0;const h=harness({execute:async()=>{count++;throw Error("delivery uncertain")}});
  try{
    const command={feature:"clipboardWrite",targets:[h.computers.get("pc0")],args:{clipboardText:"sensitive clipboard sample"},requestId:"clipboard-1"};
    const job=h.q.enqueue(command);assert.equal(h.q.enqueue(command).id,job.id);
    await until(()=>h.q.get(job.id).state==="completed");
    assert.equal(count,1);assert.equal(h.q.get(job.id).results[0].state,"unknown");
    assert.equal(h.q.get(job.id).results[0].verified,false);
    assert.doesNotMatch(JSON.stringify(h.q.list()),/sensitive clipboard sample|clipboardText/);
    assert.equal(h.q.jobs.get(job.id).tasks[0].args,null);assert.deepEqual(h.journal(),[]);
  }finally{h.q.stop()}
});
