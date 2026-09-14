"use strict";
const {spawn}=require("node:child_process");
const {rateLimit}=require("express-rate-limit");
const crypto=require("node:crypto");
const path=require("node:path");
const net=require("node:net");

const STORE="esphome.devices.v1",MAX_DEVICES=64,MAX_LINE=1024*1024;
const secretName=id=>`esphome.${id}.encryption-key`;
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
function target(input={}){
  const address=String(input.address||"").trim();
  const [a,b]=address.split(".").map(Number);
  if(net.isIP(address)!==4||!(a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168)))
    throw failure("Enter a private IPv4 device address (10.x, 172.16–31.x, or 192.168.x), not a URL or hostname.");
  const port=input.port===undefined?6053:Number(input.port);
  if(!Number.isInteger(port)||port<1||port>65535)throw failure("Invalid native API port.");
  return {address,port};
}
function encryptionKey(value){
  if(typeof value!=="string"||! /^[A-Za-z0-9+/]{43}=$/.test(value)||Buffer.from(value,"base64").length!==32||Buffer.from(value,"base64").toString("base64")!==value)
    throw failure("A valid 32-byte base64 ESPHome API encryption key is required.");
  return value;
}
function deviceName(value){
  const name=String(value||"").trim();
  if(!name||name.length>100||/[\x00-\x1f]/.test(name))throw failure("Enter a device name of 1–100 characters.");
  return name;
}
function validateCommand(entity,command,admin=false){
  if(!entity?.writable||entity.disabledByDefault)throw failure("This entity is read-only.",409);
  if(!command||typeof command!=="object"||Array.isArray(command))throw failure("Invalid command.");
  if(entity.adminOnly&&(!admin||command.confirm!==true))throw failure("Administrator permission and explicit confirmation are required for this entity.",403);
  const keys=Object.keys(command).filter(k=>k!=="confirm"),domain=entity.domain;
  if(domain==="button"){
    if(keys.length!==1||keys[0]!=="press"||command.press!==true)throw failure("Invalid button command.");
  }else if(["switch","light"].includes(domain)){
    const allowed=domain==="light"&&entity.brightness?["state","brightness"]:["state"];
    if(!keys.length||keys.some(k=>!allowed.includes(k)))throw failure("Unsupported control.");
    if("state" in command&&typeof command.state!=="boolean")throw failure("State must be true or false.");
    if("brightness" in command&&(typeof command.brightness!=="number"||!Number.isFinite(command.brightness)||command.brightness<0||command.brightness>1))throw failure("Brightness must be between 0 and 1.");
  }else if(["number","select"].includes(domain)){
    if(keys.length!==1||keys[0]!=="state")throw failure("A state value is required.");
    if(domain==="select"&&!entity.options?.includes(command.state))throw failure("Choose an advertised option.");
    if(domain==="number"){
      const {min,max,step}=entity,v=command.state;
      if([v,min,max,step].some(n=>typeof n!=="number"||!Number.isFinite(n))||step<=0||v<min||v>max||Math.abs((v-min)/step-Math.round((v-min)/step))>0.001)throw failure("Number is outside the advertised range or step.");
    }
  }else throw failure("Unsupported entity type.");
  return structuredClone(command);
}

class ESPHomeManager{
  constructor({storage,spawnProcess=spawn,python=process.env.ESPHOME_PYTHON||"/opt/esphome/bin/python",canRun=()=>true,autostart=true}){
    this.storage=storage;this.spawnProcess=spawnProcess;this.python=python;this.canRun=canRun;
    this.child=null;this.pending=new Map();this.live=new Map();this.busy=new Set();this.commands=new Map();
    this.closed=false;this.configHash="";this.syncing=null;this.saving=false;this.lastError="";this.sequence=0;this.lastWorkerAt=0;
    this.timer=autostart?setInterval(()=>{this.checkWorker();this.sync().catch(()=>{})},15000):null;this.timer?.unref();
    if(autostart)setImmediate(()=>this.sync().catch(()=>{}));
  }
  records(){const rows=this.storage.getPreference(STORE,[]);return Array.isArray(rows)?rows.slice(0,MAX_DEVICES):[]}
  record(id){return this.records().find(d=>d.id===id)}
  list(){return {ok:true,transport:"native-encrypted",limit:MAX_DEVICES,workerError:this.lastError,devices:this.records().map(d=>{
    const current=this.live.get(d.id),live=current?.generation===d.generation?current:null;
    return {id:d.id,generation:d.generation,name:d.name,address:d.address,port:d.port,mac:d.mac,enabled:d.enabled!==false,
      hasKey:this.storage.hasSecret(secretName(d.id)),info:live?.info||d.info||{},
      online:d.enabled!==false&&live?.online===true,error:d.enabled===false?"disabled":live?.online?"":live?.error||"not-connected",
      entities:live?.entities||[],states:live?.states||{},receivedAt:live?.receivedAt||null};
  })}}
  checkRun(){if(!this.canRun()||this.closed)throw failure("Appliance changes are temporarily locked.",423)}
  worker(){
    if(this.closed)throw failure("ESPHome is stopping.",503);
    if(this.child)return this.child;
    const child=this.spawnProcess(this.python,["-u",path.join(__dirname,"esphome","worker.py")],{
      stdio:["pipe","pipe","ignore"],env:{PATH:process.env.PATH||"/usr/bin:/bin",LANG:"C.UTF-8",TZ:process.env.TZ||"UTC",PYTHONDONTWRITEBYTECODE:"1"}
    });
    this.child=child;this.lastWorkerAt=Date.now();let buffer="";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data",chunk=>{
      if(this.child!==child)return;
      buffer+=chunk;
      if(Buffer.byteLength(buffer)>MAX_LINE*2){this.failWorker(child);return}
      let newline;
      while((newline=buffer.indexOf("\n"))>=0){
        const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);
        if(Buffer.byteLength(line)>MAX_LINE){this.failWorker(child);return}
        let message;try{message=JSON.parse(line)}catch{this.failWorker(child);return}
        this.lastWorkerAt=Date.now();
        if(message.event==="device"){
          const d=message.device,r=this.record(d?.id);
          if(r&&r.generation===d.generation&&Array.isArray(d.entities)&&d.entities.length<=128){this.live.set(d.id,{...d,receivedAt:Date.now()});this.lastError=""}
        }else{
          const request=this.pending.get(message.requestId);if(!request)continue;
          this.pending.delete(message.requestId);clearTimeout(request.timer);
          if(message.ok===true)request.resolve(message);
          else request.reject(failure(`ESPHome: ${/^[a-z-]{1,60}$/.test(message.error)?message.error:"operation-failed"}.`,502));
        }
      }
    });
    child.once("error",()=>this.failWorker(child));child.once("exit",()=>this.failWorker(child));
    child.stdin.on("error",()=>this.failWorker(child));
    return child;
  }
  checkWorker(){if(this.child&&Date.now()-this.lastWorkerAt>45000)this.failWorker(this.child)}
  failWorker(child){
    if(this.child!==child)return;
    this.child=null;this.configHash="";this.lastError="ESPHome worker unavailable; connections will retry. Pending commands are not replayed.";
    for(const [id,state] of this.live)this.live.set(id,{...state,online:false,error:"worker-unavailable"});
    for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(failure("ESPHome connection lost. Command delivery may be unknown; it will not be replayed.",503))}
    this.pending.clear();try{child.kill("SIGKILL")}catch{}
  }
  rpc(op,payload={},timeout=20000){
    if(this.pending.size>=72)return Promise.reject(failure("ESPHome is busy.",429));
    let child;try{child=this.worker()}catch{return Promise.reject(failure("ESPHome worker is unavailable.",503))}
    if(child.stdin.writableLength>MAX_LINE)return Promise.reject(failure("ESPHome is busy.",429));
    const requestId=String(++this.sequence),line=JSON.stringify({op,requestId,...payload})+"\n";
    if(Buffer.byteLength(line)>MAX_LINE)return Promise.reject(failure("ESPHome request is too large.",413));
    return new Promise((resolve,reject)=>{
      // A stalled worker is terminated so timed-out commands cannot execute later.
      const timer=setTimeout(()=>this.failWorker(child),timeout);timer.unref();
      this.pending.set(requestId,{resolve,reject,timer});
      child.stdin.write(line,error=>{if(error)this.failWorker(child)});
    });
  }
  async sync(){
    if(this.closed)return;
    if(this.syncing)return this.syncing;
    const work=async()=>{
      const devices=[];
      for(const row of this.records()){
        if(row.enabled===false)continue;
        try{devices.push({id:row.id,generation:row.generation,...target(row),mac:row.mac,key:encryptionKey(this.storage.getSecret(secretName(row.id)))})}
        catch{this.live.set(row.id,{generation:row.generation,online:false,error:"configuration-or-key-unavailable",entities:[],states:{}})}
      }
      if(!devices.length&&!this.child)return;
      const hash=crypto.createHash("sha256").update(JSON.stringify(devices)).digest("hex");
      if(hash===this.configHash&&this.child)return;
      await this.rpc("configure",{devices});this.configHash=hash;
    };
    this.syncing=work().finally(()=>{this.syncing=null});return this.syncing;
  }
  async save(id,input){
    this.checkRun();if(this.saving||(id&&this.busy.has(id)))throw failure("Another device change is in progress.",409);
    this.saving=true;
    try{
      const previous=id?this.record(id):null;if(id&&!previous)throw failure("Unknown ESPHome device.",404);
      if(!previous&&this.records().length>=MAX_DEVICES)throw failure("The 64-device limit has been reached.",409);
      const name=deviceName(input.name),endpoint=target(input);
      const key=encryptionKey(input.key|| (previous?this.storage.getSecret(secretName(id)):""));
      if(this.records().some(d=>d.id!==id&&d.address===endpoint.address&&d.port===endpoint.port))throw failure("This endpoint is already enrolled.",409);
      const result=await this.rpc("probe",{device:{...endpoint,key}});
      this.checkRun();
      const mac=result.info?.mac_address;
      if(!/^(?:[a-f0-9]{2}:){5}[a-f0-9]{2}$/.test(mac||""))throw failure("ESPHome did not return a valid device identity.",502);
      if(previous&&mac!==previous.mac)throw failure("Device identity differs from the enrolled MAC. Remove and enroll separately only after verifying the hardware.",409);
      if(this.records().some(d=>d.id!==id&&d.mac===mac))throw failure("This device is already enrolled.",409);
      const device={id:id||crypto.randomUUID(),generation:crypto.randomUUID(),name,...endpoint,mac,info:result.info,enabled:previous?.enabled!==false};
      this.storage.tx(()=>{this.storage.putSecret(secretName(device.id),key,{integration:"esphome",type:"native-api-encryption-key"});this.storage.setPreference(STORE,[...this.records().filter(d=>d.id!==device.id),device])});
      this.live.delete(device.id);await this.sync().catch(()=>{});return this.list();
    }finally{this.saving=false}
  }
  async change(id,{remove=false,enabled}={}){
    this.checkRun();if(this.saving||this.busy.has(id))throw failure("Device is busy; retry after the current operation.",409);
    const device=this.record(id);if(!device)throw failure("Unknown ESPHome device.",404);
    if(!remove&&typeof enabled!=="boolean")throw failure("Enabled must be true or false.");
    this.saving=true;
    try{
      this.storage.tx(()=>{
        const rows=this.records().filter(d=>d.id!==id);
        if(remove)this.storage.deleteSecret(secretName(id));
        else rows.push({...device,enabled,generation:crypto.randomUUID()});
        this.storage.setPreference(STORE,rows);
      });
      this.live.delete(id);await this.sync().catch(()=>{});return this.list();
    }finally{this.saving=false}
  }
  async command(id,entityId,input,{admin=false,owner=""}={}){
    this.checkRun();if(this.saving)throw failure("A device configuration change is in progress.",409);
    const record=this.record(id),live=this.live.get(id);
    if(!record)throw failure("Unknown ESPHome device.",404);
    if(record.enabled===false||!this.storage.hasSecret(secretName(id))||!live?.online||live.generation!==record.generation)throw failure("ESPHome device is not connected.",409);
    const entity=live.entities.find(e=>e.id===entityId),command=validateCommand(entity,input.command,admin);
    const requestId=input.requestId;
    if(typeof requestId!=="string"||!/^[a-zA-Z0-9._-]{8,80}$/.test(requestId))throw failure("A unique command request ID is required.");
    for(const [key,value] of this.commands)if(value.expires<Date.now())this.commands.delete(key);
    const key=`${owner}:${requestId}`,fingerprint=JSON.stringify([id,record.generation,entityId,command]);
    const existing=this.commands.get(key);
    if(existing){if(existing.fingerprint!==fingerprint)throw failure("Request ID was already used for a different command.",409);return existing.promise}
    if(this.commands.size>=1024||this.busy.size>=32)throw failure("ESPHome command limit reached.",429);
    if(this.busy.has(id))throw failure("A command is already in progress for this device.",409);
    this.busy.add(id);
    const promise=this.rpc("command",{deviceId:id,entityId,command,admin,generation:record.generation},6000).finally(()=>this.busy.delete(id));
    this.commands.set(key,{fingerprint,promise,expires:Date.now()+300000});
    return promise;
  }
  close(){this.closed=true;clearInterval(this.timer);if(this.child)this.failWorker(this.child)}
}

function registerESPHomeRoutes(app,{manager,requireRead,requireControl,requireAdmin,isAdmin,owner,track=task=>task,audit=()=>{}}){
  // Appliance-wide budgets run before authorization. Fixed keys bound memory and
  // prevent changed users, target IDs or forwarding headers multiplying quotas.
  // Polling cannot spend the separate management and interactive-control budgets.
  const statusLimit=rateLimit({windowMs:60000,limit:600,keyGenerator:()=>"esphome-status",standardHeaders:"draft-8",legacyHeaders:false,
    message:{ok:false,error:"ESPHome inventory request limit reached; retry later."}});
  const managementLimit=rateLimit({windowMs:60000,limit:60,keyGenerator:()=>"esphome-management",standardHeaders:"draft-8",legacyHeaders:false,
    message:{ok:false,error:"ESPHome management request limit reached; retry later."}});
  const commandLimit=rateLimit({windowMs:60000,limit:240,keyGenerator:()=>"esphome-commands",standardHeaders:"draft-8",legacyHeaders:false,
    message:{ok:false,error:"ESPHome command request limit reached; retry later. Commands are not queued."}});
  const route=(action,kind)=>(req,res)=>{
    const task=(async()=>{
      try{const result=await action(req);if(kind)audit({kind:`esphome.${kind}`,deviceId:req.params.id||null,ok:true});res.json(result)}
      catch(error){res.status(error.status||503).json({ok:false,error:error.status?error.message:"ESPHome operation failed. Check worker availability and the encrypted credential store."})}
    })();return track(task);
  };
  app.get("/api/v1/esphome/devices",statusLimit,requireRead,(_req,res)=>res.json(manager.list()));
  app.post("/api/v1/esphome/devices",managementLimit,requireAdmin,route(req=>manager.save(null,req.body),"enroll"));
  app.put("/api/v1/esphome/devices/:id",managementLimit,requireAdmin,route(req=>manager.save(req.params.id,req.body),"update"));
  app.post("/api/v1/esphome/devices/:id/enabled",managementLimit,requireAdmin,route(req=>manager.change(req.params.id,{enabled:req.body.enabled}),"enabled"));
  app.delete("/api/v1/esphome/devices/:id",managementLimit,requireAdmin,route(req=>manager.change(req.params.id,{remove:true}),"remove"));
  app.post("/api/v1/esphome/devices/:id/entities/:entityId/command",commandLimit,requireControl,route(req=>manager.command(req.params.id,req.params.entityId,req.body,{admin:isAdmin(req),owner:owner(req)}),"command"));
}
module.exports={ESPHomeManager,registerESPHomeRoutes,validateCommand,target,encryptionKey,STORE,secretName};
