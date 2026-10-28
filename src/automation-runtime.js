"use strict";

const DISPLAY_ACTIONS=new Set([
  "display.clear","display.text","display.url","display.media","display.timer.class-end"
]);

function actionResourceDomain(action){
  const value=String(action||"").trim().toLowerCase();
  if(value.startsWith("govee.")||value.startsWith("lighting."))return "lighting";
  if(value==="tv.power")return "tv-power";
  if(value.startsWith("av."))return "av";
  if(value.startsWith("display.timer"))return "display-overlay";
  if(value.startsWith("display."))return "display-content";
  return "other";
}

function isDisplayContentAction(action){
  return DISPLAY_ACTIONS.has(String(action||"").trim().toLowerCase())&&String(action||"").trim().toLowerCase()!=="display.timer.class-end";
}

function normalizeIntegerMinutes(value,{name="Offset",fallback=0,min=-720,max=720}={}){
  const candidate=value===undefined||value===null||value===""?fallback:Number(value);
  if(!Number.isFinite(candidate)||!Number.isInteger(candidate))throw new Error(`${name} must be a whole number of minutes`);
  return Math.max(min,Math.min(max,candidate));
}

function enabledDisplayIds(devices={}){
  return Object.keys(devices).filter(id=>devices[id]?.enabled!==false);
}

function expandDisplayTargets(targets,{devices={},displayGroups={}}={}){
  const out=[];
  const keyFor=(value,records)=>{
    const id=String(value||"").trim();
    if(Object.hasOwn(records,id))return id;
    const matches=Object.keys(records).filter(key=>key.toLowerCase()===id.toLowerCase());
    return matches.length===1?matches[0]:"";
  };
  const add=value=>{const id=keyFor(value,devices);if(id&&!out.includes(id)&&devices[id]?.enabled!==false)out.push(id)};
  for(const raw of Array.isArray(targets)?targets:[]){
    const id=String(raw||"").trim();
    if(!id)continue;
    if(id.toLowerCase()==="all"){for(const key of enabledDisplayIds(devices))add(key);continue}
    const group=keyFor(id,displayGroups);
    if(group&&Array.isArray(displayGroups[group])){for(const member of displayGroups[group])add(member);continue}
    add(id);
  }
  return out;
}

function normalizeTvInventory({tvs=null,topology=null,devices={},connection="hdbt",outputCount=8}={}){
  const map={};
  const source=tvs&&typeof tvs==="object"?tvs:topology?.tvs&&typeof topology.tvs==="object"?topology.tvs:null;
  if(source){
    for(const [id,row] of Object.entries(source)){
      if(row?.enabled===false)continue;
      const output=Number(row?.transport?.output||row?.output||row?.avOutput);
      if(!Number.isInteger(output)||output<1)continue;
      const mode=String(row?.transport?.connection||row?.connection||row?.avConnection||connection||"hdbt").toLowerCase()==="hdmi"?"hdmi":"hdbt";
      map[String(id).toLowerCase()]={id:String(id),output,connection:mode};
    }
    return map;
  }
  const maxOutputs=Math.max(1,Math.min(64,Number(outputCount)||8));
  for(let output=1;output<=maxOutputs;output++){
    const id=`tv${output}`,row=devices[id]||{};
    const configuredOutput=Number(row?.avOutput),actual=Number.isInteger(configuredOutput)&&configuredOutput>0?configuredOutput:output;
    const mode=String(row?.avConnection||row?.connection||connection||"hdbt").toLowerCase()==="hdmi"?"hdmi":"hdbt";
    map[id]={id,output:actual,connection:mode};
  }
  return map;
}

function expandTvTargets(targets,options={}){
  const requested=Array.isArray(targets)?targets:[];
  const inventory=normalizeTvInventory(options);
  const groups=options.tvGroups||Object.fromEntries(Object.entries(options.topology?.groups||{}).filter(([,group])=>group?.type==="tv").map(([id,group])=>[id,group.members||[]]));
  const rows=[];const seen=new Set();
  const add=(id,forcedConnection=null)=>{
    const row=inventory[String(id||"").toLowerCase()];if(!row)return;
    const connection=forcedConnection||row.connection,key=`${connection}:${row.output}`;
    if(seen.has(key))return;seen.add(key);rows.push({id:row.id,output:row.output,connection});
  };
  for(const raw of requested){
    const id=String(raw||"").trim().toLowerCase();
    if(!id)continue;
    if(id==="all"){for(const key of Object.keys(inventory))add(key);continue}
    if(id==="hdbt-all"){for(const key of Object.keys(inventory))add(key,"hdbt");continue}
    if(id==="hdmi-all"){for(const key of Object.keys(inventory))add(key,"hdmi");continue}
    if(Array.isArray(groups[id])){for(const member of groups[id])add(member);continue}
    add(id);
  }
  return rows;
}

function tvPowerIntent(targets,{devices={},payload={}}={}){
  const requested=[...new Set((Array.isArray(targets)?targets:[]).map(value=>String(value||"").trim().toLowerCase()).filter(Boolean))];
  const candidate=requested.includes("all")?"all":requested.length===1?requested[0]:null;
  const selector=["all","hdmi-all","hdbt-all"].includes(candidate)?candidate:null;
  const mapped=expandTvTargets(requested,{devices,connection:payload.connection||"hdbt"});
  let resolvedTargets=mapped;
  if(selector){
    // Broadcasts address fixed physical ports, independently of receiver aliases.
    // Unmapped ports use a diagnostic transport/port label, never a receiver ID.
    const connections=selector==="all"?["hdmi","hdbt"]:[selector==="hdmi-all"?"hdmi":"hdbt"];
    resolvedTargets=connections.flatMap(connection=>Array.from({length:8},(_,index)=>{
      const output=index+1,alias=mapped.find(row=>row.connection===connection&&row.output===output);
      return {id:alias?.id||`${connection}:${output}`,connection,output};
    }));
  }else if(!requested.some(id=>["all","hdmi-all","hdbt-all"].includes(id))&&mapped.length===1){
    const output=Number(payload.output);
    if(Number.isInteger(output)&&output>=1&&output<=8)resolvedTargets=[{...mapped[0],output}];
  }
  return {targets:requested,selector,resolvedTargets};
}

function summarizeAdapterResult(result){
  if(result===undefined||result===null)return {ok:false,status:"unknown",reason:"No adapter result"};
  if(result.ok===false)return {ok:false,status:"rejected",reason:String(result.error||result.message||"Adapter rejected the command")};
  if(result.pendingVerify===true)return {ok:false,status:"pending-verification",reason:String(result.message||"Command requires verification")};
  return {ok:true,status:result.verified===true?"verified":"acknowledged",reason:null};
}

function assertAdapterResults(results,{action="automation action"}={}){
  const list=Array.isArray(results)?results:[];
  if(!list.length)throw new Error(`${action} resolved to no executable targets`);
  const failures=list.map(summarizeAdapterResult).filter(item=>!item.ok);
  if(failures.length){
    const error=new Error(`${action} did not complete successfully: ${failures.map(item=>item.reason).join("; ")}`);
    error.code="AUTOMATION_ADAPTER_UNVERIFIED";
    error.failures=failures;
    throw error;
  }
  return list;
}

class SchedulerClock{
  constructor({timezone="America/New_York"}={}){this.timezone=timezone;this.simulated=null;this.liveCommands=false;this.liveExpiresAt=0}
  now(){return this.simulated?new Date(this.simulated.getTime()):new Date()}
  realNow(){return new Date()}
  setSimulation(value){const date=value instanceof Date?new Date(value.getTime()):new Date(value);if(Number.isNaN(date.getTime()))throw new Error("Simulated scheduler time is invalid");this.simulated=date;this.liveCommands=false;this.liveExpiresAt=0;return this.status()}
  clearSimulation(){this.simulated=null;this.liveCommands=false;this.liveExpiresAt=0;return this.status()}
  enableLiveCommands(minutes=15){if(!this.simulated)throw new Error("Live simulation requires an active simulated scheduler time");const ttl=Math.max(1,Math.min(30,Number(minutes)||15));this.liveCommands=true;this.liveExpiresAt=Date.now()+ttl*60000;return this.status()}
  commandsAllowed(){if(!this.simulated)return true;if(this.liveCommands&&Date.now()<this.liveExpiresAt)return true;this.liveCommands=false;this.liveExpiresAt=0;return false}
  status(){const active=!!this.simulated;return {mode:active?"simulated":"real",active,timezone:this.timezone,schedulerTime:this.now().toISOString(),observedAt:new Date().toISOString(),liveCommands:active&&this.commandsAllowed(),liveExpiresAt:this.liveExpiresAt?new Date(this.liveExpiresAt).toISOString():null}}
}

function automationOccurrenceKey(event){return String(event?.classId||(event?._planningBlockId?`block:${event._planningBlockId}`:"manual"))}
function occurrenceId(event,dateKey,time){return `${String(event?.id||"unknown")}:${automationOccurrenceKey(event)}:${dateKey}:${time}`}

function assertAutomationCommandsAllowed(clock,{manual=false}={}){
  if(!manual&&!clock.commandsAllowed())throw Object.assign(new Error("Scheduled automation stopped because the test clock is dry-run only"),{code:"AUTOMATION_SIMULATION_DRY_RUN"});
}

function firstPassDueActions(sequence,elapsedSeconds){
  const due=[];let elapsed=0;
  if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)return due;
  for(const step of sequence){
    elapsed+=Math.max(0,Number(step.delaySeconds||0));
    if(elapsed>elapsedSeconds)break;
    due.push(step);
    elapsed+=Math.max(0,Number(step.repeatDelaySeconds||0));
  }
  return due;
}

function makeLedger(store,{key="automation.run-ledger",limit=500,cancellationLimit=5000,now=()=>new Date()}={}){
  if(!Number.isSafeInteger(cancellationLimit)||cancellationLimit<1||cancellationLimit>5000)throw new Error("Automation cancellation retention limit is invalid");
  const cancellationStatus=status=>status==="cancel-requested"||status==="cancelled";
  const dateKey=date=>`${String(date.getFullYear()).padStart(4,"0")}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  function occurrenceDate(id){
    if(typeof id!=="string")return null;
    const match=/^.+:.+:(\d{4}-\d{2}-\d{2}):(\d{2}):(\d{2})$/.exec(id);
    if(!match||Number(match[2])>23||Number(match[3])>59)return null;
    const date=new Date(`${match[1]}T12:00:00`);
    return Number.isFinite(date.getTime())&&dateKey(date)===match[1]?match[1]:null;
  }
  function retainedCancellations(value){
    const saved=value.cancelledOccurrences===undefined?[]:value.cancelledOccurrences;
    if(!Array.isArray(saved)||saved.length>5000)throw new Error("Automation cancellation state is invalid or exceeds its limit");
    // Retention follows real local dates, never the operator's simulated clock.
    // Keep yesterday for overnight occurrences, today and future live-test IDs.
    const cutoff=new Date(now());
    if(!Number.isFinite(cutoff.getTime()))throw new Error("Automation cancellation retention date is invalid");
    cutoff.setHours(0,0,0,0);cutoff.setDate(cutoff.getDate()-1);
    const firstDate=dateKey(cutoff),ids=new Set();let bytes=2;
    const add=(id,strict=false)=>{
      const date=occurrenceDate(id);
      if(!date){if(strict)throw new Error("Automation cancellation identity is invalid");return}
      if(date<firstDate||ids.has(id))return;
      bytes+=Buffer.byteLength(JSON.stringify(id),"utf8")+1;
      if(ids.size>=cancellationLimit||bytes>1024*1024)throw new Error("Automation cancellation retention limit reached");
      ids.add(id);
    };
    for(const id of saved)add(id,true);
    for(const row of value.runs||[])if(cancellationStatus(row.status))add(row.occurrenceId);
    return [...ids];
  }
  function readValue(){const value=store.getPreference(key,{version:1,runs:[]})||{};return {...value,runs:Array.isArray(value.runs)?value.runs:[]}}
  function read(){const value=readValue();return {version:1,runs:value.runs}}
  function readState(){const value=readValue();return {...value,cancelledOccurrences:retainedCancellations(value)}}
  function write(value){
    // Migrate legacy history and retain newly requested Stops before truncation,
    // in the same atomic preference write as the diagnostic rows.
    const cancelledOccurrences=retainedCancellations(value);
    store.setPreference(key,{version:1,runs:value.runs.slice(-limit),cancelledOccurrences});
  }
  function cancelledOccurrenceIds(){
    const state=readState();
    return new Set([...state.cancelledOccurrences,...state.runs.filter(row=>cancellationStatus(row.status)).map(row=>row.occurrenceId)]);
  }
  function recordMany(entries){
    if(!entries.length)return entries;
    // Never acknowledge a batch after dropping some of its own new records.
    if(entries.length>limit)throw new Error("Automation ledger batch exceeds its history limit");
    const state=readState(),observedAt=new Date().toISOString();
    write({...state,runs:[...state.runs,...entries.map(entry=>({...entry,observedAt}))]});
    return entries;
  }
  function record(entry){recordMany([entry]);return entry}
  function claim(id,details={},{legacyIds=[]}={}){
    const state=readState(),identities=new Set([id,...legacyIds]);
    const stopped=state.cancelledOccurrences.find(value=>identities.has(value));
    if(stopped)return {claimed:false,existing:{occurrenceId:stopped,status:"cancelled"}};
    const existing=[...state.runs].reverse().find(run=>identities.has(run.occurrenceId)&&["claimed","running","succeeded"].includes(run.status));
    if(existing)return {claimed:false,existing};
    const row={occurrenceId:id,status:"claimed",...details};write({...state,runs:[...state.runs,{...row,observedAt:new Date().toISOString()}]});return {claimed:true,row};
  }
  return {read,record,recordMany,claim,cancelledOccurrenceIds};
}

module.exports={actionResourceDomain,isDisplayContentAction,normalizeIntegerMinutes,expandDisplayTargets,normalizeTvInventory,expandTvTargets,tvPowerIntent,summarizeAdapterResult,assertAdapterResults,SchedulerClock,assertAutomationCommandsAllowed,firstPassDueActions,automationOccurrenceKey,occurrenceId,makeLedger};
