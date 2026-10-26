"use strict";
const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const net=require("node:net");
const {Client,utils}=require("ssh2");
const {rateLimit}=require("express-rate-limit");
const {recoveryTransportAllowed}=require("./recovery-transport-policy");
const STORE="ubuntu-displays.v1",MAX_DEVICES=64;
const secretName=id=>`ubuntu-display.${id}.ssh`;
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const fingerprint=key=>"SHA256:"+crypto.createHash("sha256").update(key).digest("base64").replace(/=+$/,"");
const source=name=>fs.readFileSync(path.join(__dirname,"ubuntu-display",name),"utf8");
function target(input={}){
  const address=String(input.address||""),parts=address.split(".").map(Number),[a,b]=parts;
  if(net.isIP(address)!==4||!(a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168)))throw fail("Enter the computer’s private IPv4 address.");
  const port=Number(input.port??22);
  if(!Number.isInteger(port)||port<1||port>65535)throw fail("Invalid SSH port.");
  return {address,port};
}
function hostKey(value){if(typeof value!=="string"||!/^SHA256:[A-Za-z0-9+/]{43}$/.test(value))throw fail("Verify and accept the computer’s SSH host fingerprint first.");return value}
function credentials(input={}){
  if(!/^[a-z_][a-z0-9_-]{0,31}$/.test(input.username||""))throw fail("A valid SSH account is required.");
  const result={username:input.username};
  if(input.privateKey){
    if(typeof input.privateKey!=="string"||input.privateKey.length>32768)throw fail("Invalid SSH private key.");
    const key=utils.parseKey(input.privateKey,input.passphrase||undefined);
    if(key instanceof Error)throw fail("The SSH key could not be read. Check its passphrase.");
    result.privateKey=input.privateKey;if(input.passphrase)result.passphrase=String(input.passphrase);
  }else if(typeof input.password==="string"&&input.password.length>0&&input.password.length<=1024)result.password=input.password;
  else throw fail("Choose an SSH private key or enter the SSH password.");
  return result;
}
function hubOrigin(value){
  let url;try{url=new URL(value)}catch{throw fail("Enter the Hub’s LAN HTTP(S) origin.")}
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password||url.search||url.hash||!["","/"].includes(url.pathname))throw fail("Use a Hub origin without a path, credentials or query.");
  return url.origin;
}
function screenConfig(input,probe,otherRecords=[],receivers={},allowEmpty=false,previous=[]){
  const hubUrl=hubOrigin(input.hubUrl),screens=input.screens;
  if(!Array.isArray(screens)||(!screens.length&&!allowEmpty)||screens.length>16)throw fail("Assign between one and sixteen screens.");
  const outputs=new Map((probe.outputs||[]).map(o=>[o.connector,o])),used=new Set(),connectors=new Set();
  const assigned=new Set(otherRecords.flatMap(d=>d.config?.screens?.map(s=>s.receiverId)||[]));
  const audioProfiles=(probe.audio?.profiles||[]).filter(p=>/^[A-Za-z0-9_.:-]{1,160}$/.test(p.card)&&/^[A-Za-z0-9_.:+-]{1,160}$/.test(p.profile));
  return {hubUrl,audioProfiles,screens:screens.map(s=>{
    if(!s||typeof s!=="object"||!/^[a-zA-Z0-9_-]{1,40}$/.test(s.receiverId||""))throw fail("Each screen needs a valid receiver ID (letters, numbers, hyphen or underscore).");
    if(used.has(s.receiverId)||assigned.has(s.receiverId))throw fail("A receiver ID can belong to only one Ubuntu output.",409);
    if(connectors.has(s.connector))throw fail("Each connector can be assigned only once.");
    const output=outputs.get(s.connector),old=previous.find(p=>p.connector===s.connector);
    const unchangedOffline=!output?.connected&&old&&["connector","monitorId","receiverId","mode","rotation","audioSink"].every(k=>(s[k]??({mode:"auto",rotation:"normal",audioSink:"default"}[k]))===(old[k]??({mode:"auto",rotation:"normal",audioSink:"default"}[k])));
    if(!unchangedOffline&&(!output?.connected||!output.monitorId||output.monitorId!==s.monitorId))throw fail("A monitor changed or disconnected. Probe the computer again.",409);
    if(receivers[s.receiverId]?.enabled===false)throw fail("Enable the selected receiver before assigning it.",409);
    used.add(s.receiverId);connectors.add(s.connector);
    const mode=s.mode||"auto",rotation=s.rotation||"normal";
    if(!unchangedOffline&&mode!=="auto"&&!output.modes.includes(mode))throw fail("Choose a resolution advertised by this monitor.");
    if(!["normal","left","right","inverted"].includes(rotation))throw fail("Invalid screen rotation.");
    const name=String(s.name||s.receiverId).trim();if(!name||name.length>100||/[\x00-\x1f]/.test(name))throw fail("Screen names must be 1–100 printable characters.");
    const audioSink=s.audioSink||"default";
    if(!unchangedOffline&&!["default","muted"].includes(audioSink)&&!(probe.audio?.sinks||[]).some(sink=>sink.name===audioSink))throw fail("Choose an available audio output.");
    return {connector:s.connector,monitorId:s.monitorId,receiverId:s.receiverId,name,mode,rotation,audioSink,enabled:s.enabled!==false};
  })};
}

// One bounded connection per operation. Raw SSH errors/output never reach the UI.
function sshOperation({address,port,hostFingerprint,auth={},command,input="",discover=false,timeout=20000,maxBytes=12*1024*1024}){
  return new Promise((resolve,reject)=>{
    const client=new Client();let finished=false,seen="",bytes=0,out=[];
    const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);client.destroy();error?reject(error):resolve(result)};
    const timer=setTimeout(()=>finish(fail("SSH operation timed out; its outcome may be uncertain. Refresh status before retrying.",504)),timeout);timer.unref?.();
    client.on("error",()=>{if(discover&&seen)return finish(null,{fingerprint:seen});finish(fail(seen&&hostFingerprint&&seen!==hostFingerprint?"SSH host identity changed. Recheck the computer’s fingerprint before reconnecting.":"SSH connection failed. Check the account, key/password and network.",502))});
    client.on("close",()=>{if(!finished)finish(fail("SSH connection closed before a result was confirmed.",502))});
    client.on("ready",()=>client.exec(command,{pty:false},(error,stream)=>{
      if(error)return finish(fail("SSH command could not start.",502));
      stream.on("data",chunk=>{bytes+=chunk.length;if(bytes>maxBytes)return finish(fail("Device response exceeded its limit.",502));out.push(chunk)});
      stream.stderr.on("data",chunk=>{bytes+=chunk.length;if(bytes>maxBytes)finish(fail("Device output exceeded its limit.",502))});
      stream.on("error",()=>finish(fail("Device command stream failed.",502)));
      stream.on("close",code=>{
        if(code!==0)return finish(fail("Device operation failed. Verify Ubuntu readiness, administrator rights and the kiosk configuration.",502));
        try{const result=JSON.parse(Buffer.concat(out).toString("utf8"));if(result.ok===false)throw Error();finish(null,result)}catch{finish(fail("Device returned an invalid or failed result.",502))}
      });
      stream.end(input);
    }));
    try{client.connect({host:address,port,username:discover?"roomgoblin-probe":auth.username,...auth,
      readyTimeout:10000,keepaliveInterval:5000,keepaliveCountMax:2,tryKeyboard:false,
      hostVerifier:key=>{seen=fingerprint(key);if(discover)return false;return seen===hostFingerprint}})}
    catch{finish(fail("Invalid SSH connection configuration.",400))}
  });
}
function managementKey(){
  const pair=crypto.generateKeyPairSync("rsa",{modulusLength:3072,privateKeyEncoding:{type:"pkcs1",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}});
  const parsed=utils.parseKey(pair.privateKey);
  return {privateKey:pair.privateKey,publicKey:"ssh-rsa "+parsed.getPublicSSH().toString("base64")};
}

class UbuntuDisplays{
  constructor({storage,receivers=()=>({}),ensureReceivers=()=>{},receiverOnline=()=>false,canRun=()=>true,transport=sshOperation,autostart=true,track=p=>p,audit=()=>{}}){
    Object.assign(this,{storage,receivers,ensureReceivers,receiverOnline,canRun,transport,track,audit});
    this.live=new Map();this.busy=new Set();this.jobs=new Map();this.closed=false;this.enrolling=false;this.configuring=false;
    this.timer=autostart?setInterval(()=>this.poll(),30000):null;this.timer?.unref();
    if(autostart)setImmediate(()=>this.poll());
  }
  records(){const records=this.storage.getPreference(STORE,[]);if(!Array.isArray(records)||records.length>MAX_DEVICES)throw fail("Ubuntu inventory could not be read.",503);return records}
  record(id){const d=this.records().find(d=>d.id===id);if(!d)throw fail("Unknown Ubuntu computer.",404);return d}
  check(){if(this.closed||!this.canRun())throw fail("Appliance changes are temporarily locked.",423)}
  list(){return {ok:true,devices:this.records().map(d=>{
    const live=this.live.get(d.id),fresh=live&&Date.now()-live.at<90000;
    return {...d,config:{...d.config,screens:d.config.screens.map(({enrollmentToken,...s})=>({...s,receiverOnline:this.receiverOnline(s.receiverId)}))},
      live:fresh?live:{online:false,error:"Not checked recently"}};
  }),receivers:this.receivers()}}
  async discover(input){this.check();return this.transport({...target(input),discover:true})}
  async probe(input){
    this.check();const auth=credentials(input),endpoint=target(input);
    const result=await this.transport({...endpoint,hostFingerprint:hostKey(input.fingerprint),auth,
      command:(auth.username==="root"?"":"sudo -n ")+"python3 -",input:source("probe.py")});
    if(result.distribution!=="ubuntu"||!["22.04","24.04","26.04"].includes(result.version)||result.architecture!=="x86_64")throw fail("This release supports Ubuntu 22.04, 24.04 and 26.04 LTS on x86-64.");
    if(!/^[a-f0-9]{64}$/.test(result.machineId))throw fail("The computer did not return a valid machine identity.",502);
    return {ok:true,...result};
  }
  connection(d){const key=this.storage.getSecret(secretName(d.id));if(!key)throw fail("Management key is unavailable. Repair this enrollment.",503);return {...target(d),hostFingerprint:d.fingerprint,auth:{username:"rg-display-mgr",privateKey:key}}}
  async rpc(d,action,body={}){return this.transport({...this.connection(d),command:"roomgoblin-display",input:JSON.stringify({id:d.id,action,...body}),timeout:action==="screenshot"?25000:20000})}
  async refresh(id){
    this.check();if(this.busy.has(id))return;
    this.busy.add(id);
    try{const d=this.record(id),status=await this.rpc(d,"status");if(status.identity!==id||status.machineId!==d.machineId)throw fail("Computer identity does not match its enrollment.",409);this.live.set(id,{at:Date.now(),online:true,status})}
    catch(e){this.live.set(id,{at:Date.now(),online:false,error:e.status?e.message:"Status unavailable"})}
    finally{this.busy.delete(id)}
  }
  async poll(){if(this.closed||!this.canRun())return;let records;try{records=this.records()}catch{return}for(const d of records){if(this.closed||!this.canRun())break;if(d.state==="ready")await this.refresh(d.id)}}
  async enroll(input){
    this.check();if(this.enrolling||this.configuring)throw fail("Another Ubuntu configuration change is in progress.",409);
    if(input.confirm!==true)throw fail("Review and confirm the kiosk installation first.");
    const auth=credentials(input),endpoint=target(input),fp=hostKey(input.fingerprint);
    const name=String(input.name||"").trim();if(!name||name.length>100||/[\x00-\x1f]/.test(name))throw fail("Enter a computer name.");
    this.enrolling=true;
    try{
      const probe=await this.probe(input);this.check();
      let record=input.id?this.record(input.id):null;
      if(record&&(record.machineId!==probe.machineId||record.fingerprint!==fp))throw fail("Repair target does not match this computer.",409);
      if(!record&&this.records().some(d=>d.machineId===probe.machineId||d.address===endpoint.address))throw fail("This computer is already enrolled. Use Repair instead.",409);
      if(!record&&this.records().length>=MAX_DEVICES)throw fail("Ubuntu inventory limit reached.",409);
      const config=screenConfig(input,probe,this.records().filter(d=>d.id!==record?.id),this.receivers(),probe.graphics!=="x11",record?.config.screens||[]);
      const id=record?.id||crypto.randomUUID(),key=record?{privateKey:this.storage.getSecret(secretName(id))}:managementKey();
      if(!key.privateKey)throw fail("The saved management key is unavailable.",503);
      if(!key.publicKey)key.publicKey="ssh-rsa "+utils.parseKey(key.privateKey).getPublicSSH().toString("base64");
      record={id,name,...endpoint,fingerprint:fp,machineId:probe.machineId,config,state:"installing",createdAt:record?.createdAt||new Date().toISOString()};
      this.storage.tx(()=>{this.storage.putSecret(secretName(id),key.privateKey,{type:"ubuntu-restricted-ssh"});this.storage.setPreference(STORE,[...this.records().filter(d=>d.id!==id),record])});
      this.busy.add(id);
      const job={id:crypto.randomUUID(),deviceId:id,state:"running",stage:"Installing verified kiosk files and packages",startedAt:new Date().toISOString()};
      this.jobs.set(job.id,job);while(this.jobs.size>32)this.jobs.delete(this.jobs.keys().next().value);
      const task=(async()=>{
        try{
          const files=Object.fromEntries(["probe.py","control.py","session.py","installer.py"].map(name=>[name,source(name)]));
          const payload={id,publicKey:key.publicKey,files,confirm:true,version:require("./version").applicationVersion(),installer:source("installer.py")};
          await this.transport({...endpoint,hostFingerprint:fp,auth,timeout:1200000,maxBytes:1024*1024,
            command:(auth.username==="root"?"":"sudo -n ")+`python3 -c 'import json,sys; p=json.load(sys.stdin); exec(compile(p.pop("installer"),"installer.py","exec")); print(json.dumps(install(p)))'`,input:JSON.stringify(payload)});
          job.stage="Verifying restricted management access and receiver assignments";
          const status=await this.rpc(record,"status");if(status.identity!==id||status.machineId!==probe.machineId)throw fail("Installed identity verification failed.",409);
          this.ensureReceivers(config.screens);
          const deploymentConfig=structuredClone(config);
          this.storage.tx(()=>{
            if(this.storage.displayCredentialPolicy?.().authenticationRequired){
              for(const s of deploymentConfig.screens)s.enrollmentToken=this.storage.createDisplayEnrollment(s.receiverId,{ttlMinutes:60}).token;
            }
          });
          await this.rpc(record,"configure",{config:deploymentConfig});
          record.state="ready";this.storage.setPreference(STORE,this.records().map(d=>d.id===id?record:d));
          job.stage="Installed. Activate the kiosk when ready.";job.state="completed";
          this.audit({kind:"ubuntu-display.install",deviceId:id,screenCount:config.screens.length,ok:true});
        }catch(error){
          job.state="failed";job.error=error.status?error.message:"Installation failed. Existing enrollment and rollback files were retained.";
          record.state="attention";this.storage.setPreference(STORE,this.records().map(d=>d.id===id?record:d));
        }finally{job.finishedAt=new Date().toISOString();this.busy.delete(id);this.enrolling=false}
      })();
      this.track(task);return {ok:true,job:{...job}};
    }catch(e){this.enrolling=false;throw e}
  }
  async configure(id,input){
    this.check();if(this.busy.has(id)||this.enrolling||this.configuring)throw fail("Computer is busy.",409);this.busy.add(id);this.configuring=true;
    try{
      const d=this.record(id),probe=await this.rpc(d,"status");
      if(probe.identity!==id||probe.machineId!==d.machineId)throw fail("Computer identity changed.",409);
      const config=screenConfig(input,probe,this.records().filter(d=>d.id!==id),this.receivers(),false,d.config.screens);
      this.ensureReceivers(config.screens);const deploymentConfig=structuredClone(config);
      this.storage.tx(()=>{if(this.storage.displayCredentialPolicy?.().authenticationRequired)for(const s of deploymentConfig.screens)s.enrollmentToken=this.storage.createDisplayEnrollment(s.receiverId,{ttlMinutes:60}).token});
      await this.rpc(d,"configure",{config:deploymentConfig});
      this.storage.setPreference(STORE,this.records().map(row=>row.id===id?{...d,config}:row));return {ok:true};
    }finally{this.busy.delete(id);this.configuring=false}
  }
  async command(id,input){
    this.check();if(this.busy.has(id))throw fail("Computer is busy; wait for the current operation.",409);
    const allowed=["identify","restart-screen","screenshot","activate","reboot","shutdown","rollback"];
    if(!allowed.includes(input.action))throw fail("Unsupported Ubuntu management action.");
    const d=this.record(id);
    if(["activate","reboot","shutdown","rollback"].includes(input.action)&&input.confirm!==true)throw fail("Explicit confirmation is required.");
    if(["restart-screen","screenshot"].includes(input.action)&&!d.config.screens.some(s=>s.receiverId===input.receiverId))throw fail("Unknown screen.");
    this.busy.add(id);
    try{return {ok:true,...await this.rpc(d,input.action,{receiverId:input.receiverId,confirm:input.confirm===true})}}
    finally{this.busy.delete(id)}
  }
  remove(id,confirm){this.check();if(confirm!==true)throw fail("Confirm removal first.");if(this.busy.has(id))throw fail("Computer is busy.",409);this.record(id);this.storage.tx(()=>{this.storage.setPreference(STORE,this.records().filter(d=>d.id!==id));this.storage.deleteSecret(secretName(id))});this.live.delete(id);return {ok:true,message:"Management enrollment removed. Receivers and computer files were preserved."}}
  close(){this.closed=true;clearInterval(this.timer)}
}

function registerUbuntuDisplayRoutes(app,{manager,requireAdmin,isAdmin,track=p=>p,audit=()=>{},trustProxyHops=0}){
  const limit=rateLimit({windowMs:60000,limit:60,keyGenerator:()=>"ubuntu-display-management",skip:req=>!isAdmin(req),standardHeaders:"draft-8",legacyHeaders:false});
  const readLimit=rateLimit({windowMs:60000,limit:180,keyGenerator:()=>"ubuntu-display-read",skip:req=>!isAdmin(req),standardHeaders:"draft-8",legacyHeaders:false});
  const secure=(req,res,next)=>recoveryTransportAllowed(req,{trustProxyHops}).allowed?next():res.status(403).json({ok:false,error:"SSH credentials require HTTPS or a local SSH-forwarded connection to RoomGoblin."});
  const route=(action,kind)=>(req,res)=>track((async()=>{
    try{const result=await action(req);if(kind)audit({kind:`ubuntu-display.${kind}`,deviceId:req.params.id||null});res.json(result)}
    catch(e){res.status(e.status||503).json({ok:false,error:e.status?e.message:"Ubuntu display operation failed."})}
  })());
  const base="/api/v1/ubuntu-displays";
  app.get(base,readLimit,requireAdmin,route(()=>manager.list()));
  app.get(base+"/jobs/:id",readLimit,requireAdmin,route(req=>{const job=manager.jobs.get(req.params.id);if(!job)throw fail("Installation job not found; refresh the computer inventory.",404);return {ok:true,job}}));
  app.post(base+"/host-key",limit,requireAdmin,route(req=>manager.discover(req.body)));
  app.post(base+"/probe",limit,requireAdmin,secure,route(req=>manager.probe(req.body)));
  app.post(base,limit,requireAdmin,secure,route(req=>manager.enroll(req.body),"enroll"));
  app.post(base+"/:id/refresh",limit,requireAdmin,route(async req=>{await manager.refresh(req.params.id);return manager.list()}));
  app.put(base+"/:id/screens",limit,requireAdmin,route(req=>manager.configure(req.params.id,req.body),"screens"));
  app.post(base+"/:id/command",limit,requireAdmin,route(req=>manager.command(req.params.id,req.body),"command"));
  app.delete(base+"/:id",limit,requireAdmin,route(req=>manager.remove(req.params.id,req.body?.confirm),"remove"));
}
module.exports={UbuntuDisplays,registerUbuntuDisplayRoutes,target,hostKey,hubOrigin,screenConfig,sshOperation,fingerprint,credentials,STORE,secretName};
