"use strict";
const {rateLimit}=require("express-rate-limit");
const POLICY="music.maintenance.policy.v1",STATE="music.maintenance.state.v1";
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const apolloVersion=value=>typeof value==="string"&&/^\d{2}\.\d{1,2}\.\d{1,2}\.\d+$/.test(value);
const newer=(a,b)=>{const x=a.split(".").map(Number),y=b.split(".").map(Number);for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)}return false};
async function apolloRelease(){
  const response=await fetch("https://api.github.com/repos/ApolloAutomation/CAST-1/releases/latest",{headers:{Accept:"application/vnd.github+json","User-Agent":"RoomGoblin"},signal:AbortSignal.timeout(20000),redirect:"error"});
  if(!response.ok)throw fail("Apollo release check is unavailable.",503);
  let raw="";for await(const chunk of response.body){raw+=Buffer.from(chunk).toString();if(Buffer.byteLength(raw)>1024*1024)throw fail("Apollo release response is too large.",503)}
  const data=JSON.parse(raw),version=data.tag_name;
  if(!apolloVersion(version)||data.draft||data.prerelease)throw fail("The Apollo release needs a compatibility review.");
  return {version,url:`https://github.com/ApolloAutomation/CAST-1/releases/tag/${version}`};
}
function apolloCandidate(device){
  if(!device?.online||!device.enabled||device.info?.project_name!=="ApolloAutomation.CAST-1"||device.info?.model!=="esp32-s3")return null;
  const updates=device.entities.filter(e=>e.domain==="update"&&e.name==="Firmware Update"&&!e.disabledByDefault);
  const channels=device.entities.filter(e=>e.domain==="select"&&e.name==="Firmware Channel");
  if(updates.length!==1||channels.length!==1||device.states[channels[0].id]?.state!=="Stable")return null;
  const state=device.states[updates[0].id]||{};
  if(!apolloVersion(state.current_version)||!apolloVersion(state.latest_version)||state.current_version!==device.info.project_version)return null;
  return {currentVersion:state.current_version,latestVersion:state.latest_version,available:newer(state.latest_version,state.current_version)};
}
class IntegrationUpdates{
  constructor({storage,esp,host,canRun,idle,allowRecovery=()=>false,window,track=task=>task,catalog=apolloRelease,now=Date.now}){
    Object.assign(this,{storage,esp,host,canRun,idle,allowRecovery,window,track,catalog,now});
    this.busy=false;this.hostRunning=false;this.hostKnown=false;this.checkedAt=0;this.checking=null;this.catalogData=null;this.error="";this.closed=false;
  }
  policy(){return {musicAssistant:false,recoverMusicAssistant:false,apollo:[],...this.storage.getPreference(POLICY,{})}}
  state(){return {apollo:{},attempts:{},...this.storage.getPreference(STATE,{})}}
  saveState(value){if(!this.canRun()||this.closed)throw fail("Maintenance is paused for appliance recovery.",423);this.storage.setPreference(STATE,value)}
  active(){return this.busy||this.hostRunning||Object.values(this.state().apollo).some(j=>j.stage==="issued"&&this.now()-j.startedAt<10*60000)}
  status(){
    const devices=this.esp.list().devices.filter(d=>d.info?.project_name==="ApolloAutomation.CAST-1").map(d=>({id:d.id,name:d.name,online:d.online,version:d.info.project_version,candidate:apolloCandidate(d),job:this.state().apollo[d.id]||null}));
    return {ok:true,policy:this.policy(),window:this.window(),busy:this.active(),devices,catalog:this.catalogData,hostJob:this.hostJob||null,error:this.error};
  }
  configure(input){
    if(!this.canRun()||this.closed)throw fail("Maintenance is paused for appliance recovery.",423);
    if(typeof input.musicAssistant!=="boolean"||typeof input.recoverMusicAssistant!=="boolean"||!Array.isArray(input.apollo)||input.apollo.length>64||input.apollo.some(id=>typeof id!=="string"))throw fail("Invalid automatic maintenance policy.",400);
    const devices=this.esp.list().devices;
    if(input.apollo.some(id=>!devices.some(d=>d.id===id&&d.enabled&&d.info?.project_name==="ApolloAutomation.CAST-1")))throw fail("Select an enrolled, enabled Apollo CAST-1.",400);
    this.storage.setPreference(POLICY,{musicAssistant:input.musicAssistant,recoverMusicAssistant:input.recoverMusicAssistant,apollo:[...new Set(input.apollo)]});
    return this.status();
  }
  async check(){
    if(this.checking)return this.checking;
    this.checking=(async()=>{
      const [ma,apollo]=await Promise.allSettled([this.host("GET","/music-updates/check"),this.catalog()]);
      this.catalogData={musicAssistant:ma.status==="fulfilled"?ma.value:{error:ma.reason.message},apollo:apollo.status==="fulfilled"?apollo.value:{error:apollo.reason.message}};
      this.checkedAt=this.now();return this.status();
    })().finally(()=>{this.checking=null});return this.checking;
  }
  async assertIdle(){
    if(!this.canRun()||this.closed)throw fail("Maintenance is paused for appliance recovery.",423);
    if(!await this.idle())throw fail("Updates wait until announcements, priority audio and music playback are idle.",409);
    if(!this.canRun()||this.closed)throw fail("Maintenance is paused for appliance recovery.",423);
  }
  async install(kind,id,version,{automatic=false}={}){
    if(this.active())throw fail("Integration maintenance is already active.");
    this.busy=true;
    try{
      await this.assertIdle();
      if(this.now()-this.checkedAt>60000||!this.catalogData)await this.check();
      const saved=this.state(),key=kind==="apollo"?`apollo:${id}`:kind;
      if(automatic&&saved.attempts[key]===version)return {ok:true,deferred:"This release was already attempted; review its result before retrying."};
      if(kind==="musicAssistant"){
        const release=this.catalogData.musicAssistant;
        if(!release.available||release.latestVersion!==version)throw fail("Check again and select the current stable Music Assistant update.");
        await this.assertIdle();saved.attempts[key]=version;this.saveState(saved);
        const result=await this.host("POST","/music-updates/start",{version,confirm:"UPDATE_MUSIC_ASSISTANT"});
        this.hostRunning=result.running;return result;
      }
      if(kind!=="apollo"||this.catalogData.apollo?.version!==version)throw fail("Check again and select the current stable Apollo release.");
      const device=this.esp.list().devices.find(d=>d.id===id),candidate=apolloCandidate(device);
      if(!candidate?.available||candidate.latestVersion!==version)throw fail("Apollo must be connected on the Stable channel and advertise the selected release.");
      if(saved.apollo[id]?.stage==="issued"||saved.apollo[id]?.stage==="unconfirmed")throw fail("The previous firmware delivery is unconfirmed. Verify the device before another update.");
      await this.assertIdle();
      // Persist the claim before sending. A process restart may observe it, but
      // never replay a flash whose delivery is uncertain.
      saved.attempts[key]=version;saved.apollo[id]={stage:"issued",version,previousVersion:candidate.currentVersion,mac:device.mac,generation:device.generation,startedAt:this.now()};this.saveState(saved);
      try{await this.esp.firmwareUpdate(id,version)}catch{saved.apollo[id].stage="unconfirmed";this.saveState(saved)}
      return this.status();
    }finally{this.busy=false}
  }
  reconcile(){
    if(!this.canRun()||this.closed)return;
    const state=this.state(),devices=this.esp.list().devices;let changed=false;
    for(const [id,job] of Object.entries(state.apollo)){
      if(!["issued","unconfirmed"].includes(job.stage))continue;
      const device=devices.find(d=>d.id===id);
      if(device?.online&&device.mac===job.mac&&device.generation===job.generation&&device.info?.project_name==="ApolloAutomation.CAST-1"&&device.info?.project_version===job.version){job.stage="succeeded";job.completedAt=this.now();changed=true}
      else if(job.stage==="issued"&&this.now()-job.startedAt>=10*60000){job.stage="unconfirmed";changed=true}
    }
    if(changed)this.saveState(state);
  }
  async tick(){
    if(!this.canRun()||this.closed||this.ticking)return;
    this.ticking=true;
    try{
      this.reconcile();
      const policy=this.policy(),attempts=this.state().attempts;
      if(policy.musicAssistant||policy.recoverMusicAssistant||attempts.musicAssistant||attempts.serviceRecovery||this.hostRunning){
        const job=await this.host("GET","/music-updates/job");this.hostRunning=job.running;this.hostKnown=true;this.hostJob=job.job;
      }
      if(this.active())return;
      if(!policy.musicAssistant&&!policy.apollo.length&&!policy.recoverMusicAssistant)return;
      let idle;
      try{idle=await this.idle();this.failures=0}catch(error){
        this.failures=(this.failures||0)+1;
        if(policy.recoverMusicAssistant&&this.failures>=3&&this.allowRecovery()&&this.canRun()&&this.now()-(this.lastRecovery||0)>=1800000){
          this.lastRecovery=this.now();
          const state=this.state();state.attempts.serviceRecovery=this.lastRecovery;this.saveState(state);
          const recovery=await this.host("POST","/music-updates/recover",{confirm:"RECOVER_MUSIC_ASSISTANT"});this.hostRunning=recovery.running;
        }
        throw error;
      }
      if(!this.window().active||!idle)return;
      if(!this.catalogData||this.catalogData.musicAssistant?.checking||this.now()-this.checkedAt>=6*3600000)await this.check();
      if(policy.musicAssistant&&this.catalogData.musicAssistant?.available){
        const version=this.catalogData.musicAssistant.latestVersion;
        if(this.state().attempts.musicAssistant!==version){await this.install("musicAssistant",null,version,{automatic:true});return}
      }
      for(const id of policy.apollo){
        const device=this.esp.list().devices.find(d=>d.id===id),candidate=apolloCandidate(device),version=this.catalogData.apollo?.version;
        if(candidate?.available&&candidate.latestVersion===version&&this.state().attempts[`apollo:${id}`]!==version){await this.install("apollo",id,version,{automatic:true});return}
      }
      this.error="";
    }catch(error){this.error=error.message}finally{this.ticking=false}
  }
  start(){this.timer=setInterval(()=>{this.track(this.tick()).catch(()=>{})},30000);this.timer.unref();setImmediate(()=>{if(!this.closed)this.track(this.tick()).catch(()=>{})})}
  close(){this.closed=true;clearInterval(this.timer)}
}
function registerIntegrationUpdates(app,{manager,requireAdmin,isAdmin,track=task=>task}){
  const limit=rateLimit({windowMs:60000,limit:30,keyGenerator:()=>"integration-maintenance",skip:req=>!isAdmin(req),standardHeaders:"draft-8",legacyHeaders:false,message:{ok:false,error:"Maintenance request limit reached."}});
  const route=fn=>(req,res)=>track((async()=>{try{res.json(await fn(req))}catch(error){res.status(error.status||503).json({ok:false,error:error.message})}})());
  app.get("/api/v1/admin/music-maintenance",limit,requireAdmin,route(()=>({...manager.status(),hostJob:manager.hostJob||null})));
  app.put("/api/v1/admin/music-maintenance",limit,requireAdmin,route(req=>manager.configure(req.body)));
  app.post("/api/v1/admin/music-maintenance/check",limit,requireAdmin,route(()=>manager.check()));
  app.post("/api/v1/admin/music-maintenance/install",limit,requireAdmin,route(req=>manager.install(req.body.kind,req.body.deviceId,req.body.version)));
}
module.exports={IntegrationUpdates,registerIntegrationUpdates,apolloCandidate,apolloRelease,newer,POLICY,STATE};
