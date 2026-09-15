"use strict";

const MAX_TOPOLOGY_ITEMS=64;

function cleanId(value,{prefix="item"}={}){
  const raw=String(value||"").trim().toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);
  return raw||prefix;
}

function clampItems(items=[]){return items.slice(0,MAX_TOPOLOGY_ITEMS)}
function cleanName(value,fallback){const s=String(value||"").trim().slice(0,120);return s||fallback}
function cleanTransport(value={}){
  const adapter=cleanId(value.adapter||"pluto",{prefix:"pluto"});
  const connection=String(value.connection||"hdbt").trim().toLowerCase()==="hdmi"?"hdmi":"hdbt";
  const output=Number(value.output),input=Number(value.input);
  const result={adapter};
  if(Number.isInteger(output)&&output>0)result.output=output;
  if(Number.isInteger(input)&&input>0)result.input=input;
  if(result.output)result.connection=connection;
  return result;
}

function normalizeTopology(raw={}){
  const tvRows=Array.isArray(raw.tvs)?raw.tvs:Object.entries(raw.tvs||{}).map(([id,value])=>({id,...value}));
  const displayRows=Array.isArray(raw.displays)?raw.displays:Object.entries(raw.displays||{}).map(([id,value])=>({id,...value}));
  const sourceRows=Array.isArray(raw.sources)?raw.sources:Object.entries(raw.sources||{}).map(([id,value])=>({id,...value}));
  const groupRows=Array.isArray(raw.groups)?raw.groups:Object.entries(raw.groups||{}).map(([id,value])=>({id,...value}));
  const tvs={},displays={},sources={},groups={};
  for(const [index,row] of clampItems(tvRows).entries()){
    const id=cleanId(row?.id||`tv${index+1}`,{prefix:`tv${index+1}`});
    if(tvs[id])throw Error(`Duplicate TV id: ${id}`);
    tvs[id]={id,name:cleanName(row?.name,`TV ${index+1}`),enabled:row?.enabled!==false,transport:cleanTransport(row?.transport||{adapter:row?.adapter,connection:row?.connection,output:row?.output||row?.avOutput}),tags:[...new Set((row?.tags||[]).map(String))]};
  }
  for(const [index,row] of clampItems(displayRows).entries()){
    const id=cleanId(row?.id||`display${index+1}`,{prefix:`display${index+1}`});
    if(displays[id])throw Error(`Duplicate display id: ${id}`);
    const physicalTvId=row?.physicalTvId?cleanId(row.physicalTvId):null;
    displays[id]={id,name:cleanName(row?.name,id.toUpperCase()),enabled:row?.enabled!==false,physicalTvId:physicalTvId&&tvs[physicalTvId]?physicalTvId:null,tags:[...new Set((row?.tags||[]).map(String))]};
  }
  for(const [index,row] of clampItems(sourceRows).entries()){
    const id=cleanId(row?.id||`source${index+1}`,{prefix:`source${index+1}`});
    if(sources[id])throw Error(`Duplicate source id: ${id}`);
    sources[id]={id,name:cleanName(row?.name,`Content Source ${index+1}`),enabled:row?.enabled!==false,endpointId:cleanId(row?.endpointId||row?.endpoint||id,{prefix:id}),transport:cleanTransport(row?.transport||{adapter:row?.adapter,input:row?.input}),tags:[...new Set((row?.tags||[]).map(String))]};
  }
  for(const row of clampItems(groupRows)){
    const id=cleanId(row?.id||row?.name||"group");
    const type=["display","tv","source","lighting"].includes(String(row?.type||"").toLowerCase())?String(row.type).toLowerCase():"display";
    const inventory=type==="tv"?tvs:type==="source"?sources:type==="display"?displays:null;
    const members=[...new Set((row?.members||[]).map(x=>cleanId(x)).filter(x=>!inventory||inventory[x]))];
    groups[id]={id,name:cleanName(row?.name,id),type,members};
  }
  return {version:1,tvs,displays,sources,groups};
}

function deriveTopologyFromLegacy({devices={},displayGroups={},avLabels={}}={}){
  const labels={outputs:Array.isArray(avLabels.outputs)?avLabels.outputs:[],inputs:Array.isArray(avLabels.inputs)?avLabels.inputs:[],sourceEndpoints:Array.isArray(avLabels.sourceEndpoints)?avLabels.sourceEndpoints:[]};
  const outputNumbers=new Set();
  for(const d of Object.values(devices||{})){const output=Number(d?.avOutput);if(Number.isInteger(output)&&output>0)outputNumbers.add(output)}
  for(let i=0;i<labels.outputs.length;i++)if(String(labels.outputs[i]||"").trim())outputNumbers.add(i+1);
  const maxOutput=Math.max(8,...outputNumbers,0);
  const tvs=[];
  for(let output=1;output<=maxOutput;output++){
    const match=Object.entries(devices||{}).find(([,d])=>Number(d?.avOutput)===output);
    const id=match?cleanId(match[0]):`tv${output}`;
    const d=match?.[1]||{};
    tvs.push({id,name:cleanName(d.name,labels.outputs[output-1]||`TV ${output}`),enabled:d.enabled!==false,transport:{adapter:"pluto",connection:String(d.avConnection||"hdbt").toLowerCase(),output},tags:d.tags||[]});
  }
  const displays=Object.entries(devices||{}).map(([id,d])=>({id:cleanId(id),name:cleanName(d?.name,id),enabled:d?.enabled!==false,physicalTvId:(()=>{const output=Number(d?.avOutput);const tv=tvs.find(x=>x.transport.output===output);return tv?.id||null})(),tags:d?.tags||[]}));
  const inputCount=Math.max(8,labels.inputs.length,labels.sourceEndpoints.length);
  const sources=Array.from({length:inputCount},(_,i)=>({id:`source${i+1}`,name:cleanName(labels.inputs[i],`Content Source ${i+1}`),endpointId:cleanId(labels.sourceEndpoints[i]||`source${i+1}`),enabled:true,transport:{adapter:"pluto",input:i+1}}));
  const groups=Object.entries(displayGroups||{}).map(([id,members])=>({id,name:id,type:"display",members:Array.isArray(members)?members:[]}));
  return normalizeTopology({tvs,displays,sources,groups});
}

function enabledItems(map={}){return Object.values(map).filter(item=>item?.enabled!==false)}
function resolveTargets(targets,{topology,domain}){
  const t=normalizeTopology(topology||{}),wanted=Array.isArray(targets)?targets:[];
  const map=domain==="tv"?t.tvs:domain==="source"?t.sources:t.displays;
  const groupType=domain==="tv"?"tv":domain==="source"?"source":"display";
  const out=[];const seen=new Set();const add=id=>{if(map[id]?.enabled!==false&&!seen.has(id)){seen.add(id);out.push(map[id])}};
  for(const raw of wanted){const id=String(raw||"").trim().toLowerCase();if(!id)continue;if(id==="all"){for(const item of enabledItems(map))add(item.id);continue}const group=t.groups[id];if(group?.type===groupType){for(const member of group.members)add(member);continue}add(id)}
  return out;
}

function legacyProjection(topology){
  const t=normalizeTopology(topology);
  const devices={};
  for(const display of Object.values(t.displays)){
    const tv=display.physicalTvId?t.tvs[display.physicalTvId]:null;
    devices[display.id]={name:display.name,enabled:display.enabled,avOutput:tv?.transport?.output||null,avConnection:tv?.transport?.connection||null,tags:display.tags||[]};
  }
  const displayGroups={all:enabledItems(t.displays).map(x=>x.id)};
  for(const group of Object.values(t.groups))if(group.type==="display")displayGroups[group.id]=[...group.members];
  const plutoTvs=Object.values(t.tvs).filter(x=>x.transport?.adapter==="pluto"&&x.transport.output).sort((a,b)=>a.transport.output-b.transport.output);
  const plutoSources=Object.values(t.sources).filter(x=>x.transport?.adapter==="pluto"&&x.transport.input).sort((a,b)=>a.transport.input-b.transport.input);
  const maxOutput=Math.max(8,...plutoTvs.map(x=>x.transport.output),0),maxInput=Math.max(8,...plutoSources.map(x=>x.transport.input),0);
  const avLabels={outputs:Array.from({length:maxOutput},(_,i)=>plutoTvs.find(x=>x.transport.output===i+1)?.name||`TV ${i+1}`),inputs:Array.from({length:maxInput},(_,i)=>plutoSources.find(x=>x.transport.input===i+1)?.name||`Content Source ${i+1}`),sourceEndpoints:Array.from({length:maxInput},(_,i)=>plutoSources.find(x=>x.transport.input===i+1)?.endpointId||`source${i+1}`)};
  return {devices,displayGroups,avLabels};
}

module.exports={MAX_TOPOLOGY_ITEMS,cleanId,normalizeTopology,deriveTopologyFromLegacy,resolveTargets,legacyProjection};
