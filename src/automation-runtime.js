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
  const add=id=>{if(id&&!out.includes(id)&&devices[id]?.enabled!==false)out.push(id)};
  for(const raw of Array.isArray(targets)?targets:[]){
    const id=String(raw||"").trim().toLowerCase();
    if(!id)continue;
    if(id==="all"){for(const key of enabledDisplayIds(devices))add(key);continue}
    if(Array.isArray(displayGroups[id])){for(const member of displayGroups[id])add(String(member||"").trim().toLowerCase());continue}
    if(devices[id])add(id);
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

function occurrenceId(event,dateKey,time){return `${String(event?.id||"unknown")}:${String(event?.classId||"manual")}:${dateKey}:${time}`}

function makeLedger(store,{key="automation.run-ledger",limit=500}={}){
  function read(){const value=store.getPreference(key,{version:1,runs:[]})||{};return {version:1,runs:Array.isArray(value.runs)?value.runs:[]}}
  function write(value){store.setPreference(key,{version:1,runs:value.runs.slice(-limit)})}
  function record(entry){const state=read();state.runs.push({...entry,observedAt:new Date().toISOString()});write(state);return entry}
  function claim(id,details={}){const state=read();const existing=[...state.runs].reverse().find(run=>run.occurrenceId===id&&["claimed","running","succeeded"].includes(run.status));if(existing)return {claimed:false,existing};const row={occurrenceId:id,status:"claimed",...details};state.runs.push({...row,observedAt:new Date().toISOString()});write(state);return {claimed:true,row}}
  return {read,record,claim};
}

module.exports={actionResourceDomain,isDisplayContentAction,normalizeIntegerMinutes,expandDisplayTargets,normalizeTvInventory,expandTvTargets,summarizeAdapterResult,assertAdapterResults,SchedulerClock,occurrenceId,makeLedger};
