"use strict";

const {randomUUID,createHash}=require("node:crypto");
const LOCKS=new Set(["screenLock","inputLock"]);
const MODES=new Set(["demoServer","fullScreenDemoClient","windowDemoClient"]);
const STATEFUL=new Set([...LOCKS,...MODES]);
const PENDING=new Set(["queued","running","retrying"]);

// Only RoomGoblin-owned reversible mode records reach durable storage. Command
// arguments (including login credentials) stay in memory and are never projected.
class VeyonCommandQueue {
  constructor({execute,readState,eligible,authorize,lookup,readJournal,writeJournal,canRun=()=>true,begin=()=>{},end=()=>{},safeError=()=>"Veyon command failed.",now=()=>Date.now(),concurrency=6,ttlMs=120000,retryMs=2000,tickMs=500}){
    Object.assign(this,{execute,readState,eligible,authorize,lookup,writeJournal,canRun,begin,end,safeError,now,concurrency,ttlMs,retryMs});
    this.activeModes=new Set();this.reconcileCursor=0;this.sequence=0;this.jobs=new Map();this.busy=new Set();this.running=0;this.intents=new Map();this.stopped=false;this.nextReconcile=now()+15000;
    const storedJournal=readJournal();
    this.owned=new Map((Array.isArray(storedJournal)?storedJournal:[]).filter(x=>x&&STATEFUL.has(x.feature)&&typeof x.id==="string"&&typeof x.ip==="string").slice(0,512).map(x=>[this.key(x.ip,x.feature),{id:x.id,ip:x.ip,feature:x.feature,createdAt:Number(x.createdAt)||now()}]));
    // A Hub restart clears only journaled ownership. It never restores an old lock.
    for(const feature of STATEFUL){const targets=[...this.owned.values()].filter(rec=>rec.feature===feature);if(targets.length)this.enqueue({feature,active:false,targets,recovery:true})}
    this.timer=setInterval(()=>this.tick(),tickMs);this.timer.unref?.();
  }
  key(ip,feature){return `${ip}|${feature}`}
  persist(){this.writeJournal([...this.owned.values()])}
  enqueue({feature,active=true,targets,args={},owner=null,requestId="",recovery=false,expiresAt,reconcile=false,observe=false}){
    const fingerprint=createHash("sha256").update(JSON.stringify({feature,active,targets:targets.map(t=>t.id).sort(),args})).digest("hex");
    if(requestId){const prior=[...this.jobs.values()].find(j=>j.requestId===requestId&&j.owner===owner);if(prior){if(prior.fingerprint!==fingerprint)throw Object.assign(Error("Request ID was already used for a different command."),{status:409});return this.view(prior)}}
    this.prune();
    if(this.jobs.size>=128||[...this.jobs.values()].reduce((n,j)=>n+j.tasks.filter(t=>PENDING.has(t.state)).length,0)+targets.length>1024)throw Object.assign(Error("Veyon command queue is full. Wait for current jobs to finish."),{status:429});
    if(!targets.length||targets.length>512)throw Error("Choose between 1 and 512 computers.");
    const stamp=this.now(),job={id:randomUUID(),sequence:++this.sequence,requestId,fingerprint,feature,active:!!active,owner,recovery,observe,internal:reconcile,createdAt:stamp,expiresAt:expiresAt||stamp+this.ttlMs,tasks:[]};
    for(const rec of targets){
      const task={id:rec.id,ip:rec.ip,name:rec.name||rec.ip,state:"queued",attempts:0,args,job};
      if(LOCKS.has(feature)&&!reconcile){
        const key=this.key(rec.ip,feature);
        for(const old of this.jobs.values())if(old.feature===feature)for(const t of old.tasks)if(t.ip===rec.ip&&["queued","retrying"].includes(t.state)){t.state="cancelled";t.reason="superseded";t.args=null}
        this.intents.set(key,{id:rec.id,ip:rec.ip,name:rec.name,feature,active:!!active,owner,recovery,jobId:job.id,expiresAt:job.expiresAt,confirmed:false});
      }
      // A requested broadcast stop remains cleanup intent if the endpoint is
      // offline beyond this job's retry window. Do not merely observe it forever.
      if(MODES.has(feature)&&!active){
        this.activeModes.delete(this.key(rec.ip,feature));
        // An older start may still be awaiting eligibility before it journals.
        for(const prior of this.jobs.values())if(prior.feature===feature&&prior.active&&!prior.recovery)
          for(const pending of prior.tasks)if(pending.ip===rec.ip&&PENDING.has(pending.state))pending.stopRequested=true;
      }
      task.intentId=this.intents.get(this.key(rec.ip,feature))?.jobId;
      job.tasks.push(task);
    }
    this.jobs.set(job.id,job);queueMicrotask(()=>this.tick());return this.view(job);
  }
  enqueueModeCleanup(targets,owner){
    if(!Array.isArray(targets)||!targets.length||targets.length>512)throw Error("Choose between 1 and 512 computers.");
    this.prune();
    const pending=[...this.jobs.values()].reduce((n,j)=>n+j.tasks.filter(t=>PENDING.has(t.state)).length,0);
    if(this.jobs.size+MODES.size>128||pending+targets.length*MODES.size>1024)throw Object.assign(Error("Veyon command queue is full. No cleanup commands were queued."),{status:429});
    // No await: capacity for all modes is checked before any enqueue mutates intent.
    return [...MODES].map(feature=>this.enqueue({feature,active:false,targets,owner}));
  }
  view(job){
    const summary={requested:job.tasks.length,queued:0,running:0,retrying:0,succeeded:0,failed:0,skipped:0,cancelled:0,unknown:0};
    const results=job.tasks.map(t=>{summary[t.state]++;return {id:t.id,ip:t.ip,name:t.name,state:t.state,attempts:t.attempts,ok:t.state==="succeeded",verified:t.verified===true,error:t.error,reason:t.reason,nextAttemptAt:t.nextAttemptAt}});
    return {id:job.id,sequence:job.sequence,requestId:job.requestId,feature:job.feature,active:job.active,recovery:job.recovery,createdAt:job.createdAt,expiresAt:job.expiresAt,state:summary.running?"running":summary.queued||summary.retrying?"queued":"completed",summary,results};
  }
  list(){return [...this.jobs.values()].filter(j=>!j.internal).reverse().map(j=>this.view(j))}
  ownedLocks(){return [...this.owned.values()].map(({id,ip,feature,createdAt})=>({id,ip,feature,createdAt,recoveryPending:!this.intents.get(this.key(ip,feature))?.active&&!this.activeModes.has(this.key(ip,feature))}))}
  current(task){
    const key=this.key(task.ip,task.job.feature);
    if(MODES.has(task.job.feature)&&task.job.recovery)return task.job.observe?this.activeModes.has(key):!this.activeModes.has(key);
    return !LOCKS.has(task.job.feature)||this.intents.get(key)?.jobId===task.intentId;
  }
  async recordModeOwnership(rec,feature){
    if(!MODES.has(feature))throw Error("Unsupported persistent Veyon mode");
    if(!this.canRun())throw Error("Veyon mode changes are temporarily paused");
    this.begin();
    try{
      const key=this.key(rec.ip,feature);
      // A demo PUT changes its source/token even when already active. Record our
      // intended mutation, never its arguments, before the caller dispatches it.
      if(this.owned.size>=512&&!this.owned.has(key))throw Error("Veyon ownership journal is full");
      const previous=this.owned.get(key);
      this.owned.set(key,{id:rec.id,ip:rec.ip,feature,createdAt:this.now()});
      try{this.persist()}catch(error){if(previous)this.owned.set(key,previous);else this.owned.delete(key);throw error}
      this.activeModes.add(key);
    }finally{this.end()}
  }
  releaseModeOwnership(ip,feature){
    if(!MODES.has(feature))throw Error("Unsupported persistent Veyon mode");
    this.begin();try{const key=this.key(ip,feature);this.activeModes.delete(key);this.owned.delete(key);this.persist()}finally{this.end()}
  }
  get(id){const j=this.jobs.get(id);return j?this.view(j):null}
  cancel(id){const j=this.jobs.get(id);if(!j)return null;for(const task of j.tasks)if(["queued","retrying"].includes(task.state)){task.state="cancelled";task.reason="operator-cancelled";task.args=null;const key=this.key(task.ip,j.feature),intent=this.intents.get(key);if(intent&&intent.jobId===task.intentId&&!intent.confirmed)this.intents.delete(key)}return this.view(j)}
  runnable(){
    const seen=new Set(this.busy),ready=[];
    for(const job of this.jobs.values())for(const task of job.tasks){
      if(!["queued","retrying"].includes(task.state)||seen.has(task.ip))continue;
      seen.add(task.ip); // Later commands cannot overtake a host waiting in backoff.
      if(!task.nextAttemptAt||task.nextAttemptAt<=this.now())ready.push(task);
    }
    return ready;
  }
  pressure(){return this.running>0||this.runnable().length>0}
  prune(){for(const [id,j] of this.jobs)if(j.tasks.every(t=>!PENDING.has(t.state))&&(j.internal||this.now()-j.createdAt>3600000||this.jobs.size>=128))this.jobs.delete(id)}
  tick(){
    if(this.stopped||!this.canRun())return;
    const now=this.now();
    for(const job of this.jobs.values())for(const t of job.tasks)if(["queued","retrying"].includes(t.state)&&job.expiresAt<=now){t.state="cancelled";t.reason="expired";t.args=null;const key=this.key(t.ip,job.feature),intent=this.intents.get(key);if(intent&&intent.jobId===t.intentId&&!intent.confirmed)this.intents.delete(key)}
    if(now>=this.nextReconcile){this.nextReconcile=now+15000;this.reconcile()}
    for(const task of this.runnable()){
      if(this.running>=this.concurrency)return;
      this.busy.add(task.ip);this.running++;task.state="running";task.attempts++;delete task.nextAttemptAt;
      this.begin();this.run(task).catch(()=>{task.state="failed";task.error="Veyon queue could not complete this command."}).finally(()=>{if(!PENDING.has(task.state))task.args=null;this.busy.delete(task.ip);this.running--;this.end();this.prune();this.tick()});
    }
  }
  async run(task){
    const job=task.job,lock=LOCKS.has(job.feature)||MODES.has(job.feature)&&(!job.active||job.recovery||job.observe),key=this.key(task.ip,job.feature);
    let dispatched=false;
    try{
      if(!job.recovery&&!this.authorize(job.owner)){task.state="cancelled";task.reason="permission-revoked";return}
      const rec=this.lookup(task.id);
      if(!rec||rec.ip!==task.ip){task.state="skipped";task.reason="computer-removed-or-changed";return}
      const check=await this.eligible(rec,job.feature,job.observe?false:job.active);
      if(!check.eligible){
        if(lock&&check.reason==="offline")throw Object.assign(Error("Computer is offline; waiting to reconnect."),{queueSafe:true,retryable:true});
        task.state="skipped";task.reason=check.reason;return;
      }
      if(!job.recovery&&!this.authorize(job.owner)){task.state="cancelled";task.reason="permission-revoked";return}
      if(lock&&!this.current(task)){task.state="cancelled";task.reason="superseded";return}
      let actual;
      if(lock){
        actual=await this.readState(task.ip,job.feature);
        if(typeof actual?.active!=="boolean")throw Object.assign(Error("Veyon did not report the lock state."),{queueSafe:true,retryable:true});

      }
      if(lock&&!this.current(task)){task.state="cancelled";task.reason="superseded";return}
      if(job.observe){
        if(actual.active===false)this.releaseModeOwnership(task.ip,job.feature);
        task.state="succeeded";task.verified=true;return;
      }
      if(!job.recovery&&!this.authorize(job.owner)){task.state="cancelled";task.reason="permission-revoked";return}
      if(job.expiresAt<=this.now()){task.state="cancelled";task.reason="expired";return}
      const currentRecord=this.lookup(task.id);
      if(!currentRecord||currentRecord.ip!==task.ip){task.state="skipped";task.reason="computer-removed-or-changed";return}
      if(lock&&job.active&&actual.active===false){
          if(this.owned.size>=512&&!this.owned.has(key))throw Error("Lock ownership journal is full");
          // Journal before the write: a timeout may mean the endpoint accepted it.
          const previous=this.owned.get(key);
          this.owned.set(key,{id:task.id,ip:task.ip,feature:job.feature,createdAt:this.now()});
          try{this.persist()}catch(error){if(previous)this.owned.set(key,previous);else this.owned.delete(key);throw error}
        }
      if(MODES.has(job.feature)&&job.active){
        await this.recordModeOwnership(rec,job.feature);
        if(task.stopRequested)this.activeModes.delete(key);
      }
      if(!lock||actual.active!==job.active){dispatched=true;await this.execute(task.ip,job.feature,job.active,task.args||{})}
      if(MODES.has(job.feature)&&!lock){
        const confirmed=await this.readState(task.ip,job.feature);
        if(confirmed?.active!==job.active)throw Error("Veyon mode change is not confirmed");
        task.verified=true;if(!job.active)this.releaseModeOwnership(task.ip,job.feature);
      }
      if(lock){
        const confirmed=await this.readState(task.ip,job.feature);
        if(confirmed?.active!==job.active)throw Object.assign(Error("Lock state is not confirmed yet; retrying."),{queueSafe:true,retryable:true});
        task.verified=true;
        if(!job.active){this.activeModes.delete(key);this.owned.delete(key);this.persist()}
        const intent=this.intents.get(key);
        if(intent&&intent.jobId===task.intentId){if(!intent.confirmed)intent.expiresAt=Infinity;intent.confirmed=true;if(!job.active||!this.owned.has(key))this.intents.delete(key)}
      }
      task.state="succeeded";delete task.error;delete task.reason;
    }catch(error){
      if(lock&&!this.current(task)){task.state="cancelled";task.reason="superseded";return}
      const retryable=lock&&(error.retryable||[2,7,8,10].includes(Number(error.veyonCode))||["timeout","connection-refused","network-failure","name-resolution"].includes(error.reason));
      if(retryable&&task.attempts<8&&this.now()<job.expiresAt){task.state="retrying";task.nextAttemptAt=this.now()+Math.min(30000,this.retryMs*2**(task.attempts-1))}
      else task.state=!lock&&dispatched?"unknown":"failed";
      task.error=error.queueSafe?error.message:this.safeError(error);task.reason=error.reason||(!lock&&dispatched?"delivery-unconfirmed":"command-failed");
    }finally{
      if(!PENDING.has(task.state)&&task.state!=="succeeded"){
        const intent=this.intents.get(key);if(intent&&intent.jobId===task.intentId&&(!intent.confirmed||task.reason==="permission-revoked"))this.intents.delete(key);
      }
    }
  }
  reconcileHost(ip){this.reconcile(ip)}
  reconcile(ip){
    if(this.stopped||!this.canRun())return;
    const candidates=[...this.intents.values()];
    const ordered=ip?candidates:candidates.slice(this.reconcileCursor).concat(candidates.slice(0,this.reconcileCursor));
    if(!ip)this.reconcileCursor=(this.reconcileCursor+16)%Math.max(1,candidates.length);
    let scheduled=0;
    for(const intent of ordered){
      if(scheduled>=16)break;
      if(ip&&intent.ip!==ip||!intent.confirmed||intent.expiresAt<=this.now()||!intent.active)continue;
      if([...this.jobs.values()].some(j=>j.feature===intent.feature&&j.tasks.some(t=>t.ip===intent.ip&&PENDING.has(t.state))))continue;
      // Reading actual state before writing makes session recovery idempotent.
      try{this.enqueue({feature:intent.feature,active:intent.active,targets:[intent],owner:intent.owner,recovery:intent.recovery,expiresAt:Math.min(intent.expiresAt,this.now()+this.ttlMs),reconcile:true});scheduled++}catch{}
    }
    // Failed or expired intent never becomes a stale future lock. Clear only our
    // recorded ownership, retrying recovery in bounded attempts until an observed unlock clears the journal.
    for(const record of this.owned.values()){
      const intent=this.intents.get(this.key(record.ip,record.feature));
      if(ip&&record.ip!==ip||intent?.active&&intent.expiresAt>this.now())continue;
      if(this.activeModes.has(this.key(record.ip,record.feature))){
        if(![...this.jobs.values()].some(j=>j.feature===record.feature&&j.tasks.some(t=>t.ip===record.ip&&PENDING.has(t.state)))){
          try{this.enqueue({feature:record.feature,active:true,targets:[record],recovery:true,reconcile:true,observe:true})}catch{}
        }
        continue;
      }
      if([...this.jobs.values()].some(j=>j.feature===record.feature&&j.tasks.some(t=>t.ip===record.ip&&PENDING.has(t.state))))continue;
      try{this.enqueue({feature:record.feature,active:false,targets:[record],recovery:true,expiresAt:this.now()+this.ttlMs})}catch{}
    }
  }
  stop(){this.stopped=true;clearInterval(this.timer)}
}

module.exports={VeyonCommandQueue};
