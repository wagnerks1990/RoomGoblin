"use strict";

const {createHash}=require("node:crypto");
const MAX_MAPPINGS=2048;

function cleanId(value){return String(value||"").replace(/[^A-Za-z0-9._-]/g,"-").slice(0,220)}
function normalizeHostname(value){
  const host=String(value||"").trim().replace(/\.$/,"").toLowerCase();
  if(!host||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host))return "";
  return host;
}
function stableIdForHostname(hostname){
  const host=normalizeHostname(hostname);
  if(!host)return "";
  const cleaned=cleanId(host);
  // Preserve IDs for ordinary DNS/Windows hostnames. If normalization would
  // collapse distinct endpoint identities, append a deterministic digest.
  if(cleaned===host)return `host-${cleaned}`;
  const prefix=(cleaned||"device").slice(0,200);
  const digest=createHash("sha256").update(host).digest("hex").slice(0,16);
  return `host-${prefix}-${digest}`;
}
function timestamp(value){const n=Date.parse(String(value||""));return Number.isFinite(n)?n:0}
function score(row){return [row?.online===true?1:0,row?.authenticated===true?1:0,timestamp(row?.lastDiscoveredAt),timestamp(row?.updatedAt)]}
function better(a,b){
  const sa=score(a),sb=score(b);
  for(let i=0;i<sa.length;i++){if(sa[i]!==sb[i])return sa[i]>sb[i]}
  return false;
}
function canonicalRows(rows){
  const grouped=new Map(),anonymous=[];
  for(const row of Array.isArray(rows)?rows:[]){
    const host=normalizeHostname(row?.hostname);
    if(!host){anonymous.push(row);continue}
    const current=grouped.get(host);
    if(!current||better(row,current))grouped.set(host,row);
  }
  return [...grouped.values(),...anonymous];
}
function normalizedMapping(value){
  const out={};
  for(const [host,entry] of Object.entries(value&&typeof value==="object"?value:{})){
    const normalized=normalizeHostname(host||entry?.hostname);
    if(!normalized||!entry||typeof entry!=="object")continue;
    out[normalized]={
      hostname:normalized,
      stableId:String(entry.stableId||stableIdForHostname(normalized)),
      backendId:String(entry.backendId||""),
      ip:String(entry.ip||""),
      previousIp:String(entry.previousIp||""),
      stale:entry.stale===true,
      updatedAt:String(entry.updatedAt||"")
    };
  }
  const counts={};
  for(const entry of Object.values(out))counts[entry.stableId]=(counts[entry.stableId]||0)+1;
  for(const entry of Object.values(out)){
    const safeId=stableIdForHostname(entry.hostname),legacyId=`host-${cleanId(entry.hostname)}`;
    // Preserve a unique legacy compatibility ID. Upgrade only an actual
    // collision produced by the old lossy cleaning scheme.
    if(counts[entry.stableId]>1&&safeId!==legacyId&&entry.stableId===legacyId)entry.stableId=safeId;
  }
  return out;
}
function reconcileMappings(existing,rows,{now=new Date().toISOString()}={}){
  const mapping=normalizedMapping(existing),moves=[],displaced=[];
  for(const row of canonicalRows(rows)){
    const hostname=normalizeHostname(row?.hostname);if(!hostname)continue;
    const backendId=String(row?.id||"");const ip=String(row?.ip||"");if(!backendId||!ip)continue;
    for(const [otherHost,entry] of Object.entries(mapping)){
      if(otherHost===hostname)continue;
      if(entry.backendId===backendId||entry.ip===ip){
        mapping[otherHost]={...entry,backendId:"",ip:"",previousIp:entry.ip||entry.previousIp||ip,stale:true,updatedAt:now};
        displaced.push({hostname:otherHost,stableId:entry.stableId||stableIdForHostname(otherHost),previousIp:entry.ip||entry.previousIp||ip});
      }
    }
    const previous=mapping[hostname],oldIp=String(previous?.ip||previous?.previousIp||"");
    if(oldIp&&oldIp!==ip)moves.push({hostname,stableId:previous?.stableId||stableIdForHostname(hostname),fromIp:oldIp,toIp:ip,fromBackendId:previous?.backendId||"",toBackendId:backendId});
    mapping[hostname]={hostname,stableId:previous?.stableId||stableIdForHostname(hostname),backendId,ip,previousIp:oldIp&&oldIp!==ip?oldIp:String(previous?.previousIp||""),stale:false,updatedAt:now};
  }
  const entries=Object.entries(mapping).sort((a,b)=>timestamp(b[1].updatedAt)-timestamp(a[1].updatedAt)).slice(0,MAX_MAPPINGS);
  return {mapping:Object.fromEntries(entries),moves,displaced};
}
function projectRows(mappingValue,rows){
  const mapping=normalizedMapping(mappingValue),out=[];
  for(const row of canonicalRows(rows)){
    const hostname=normalizeHostname(row?.hostname);
    if(!hostname){out.push(row);continue}
    const entry=mapping[hostname];
    if(entry?.backendId&&String(row?.id||"")!==entry.backendId)continue;
    if(entry?.stale&&!entry.backendId)continue;
    out.push({...row,id:entry?.stableId||stableIdForHostname(hostname)});
  }
  return out;
}
function resolveBackendId(mappingValue,id){
  const raw=String(id||"");if(!raw.startsWith("host-"))return raw;
  const mapping=normalizedMapping(mappingValue);
  const matches=Object.values(mapping).filter(entry=>entry.stableId===raw&&entry.backendId&&!entry.stale);
  return matches.length===1?matches[0].backendId:raw;
}
function stableIdForBackend(mappingValue,id){
  const raw=String(id||"");if(!raw)return raw;
  const mapping=normalizedMapping(mappingValue);
  for(const entry of Object.values(mapping))if(entry.backendId===raw&&!entry.stale)return entry.stableId||stableIdForHostname(entry.hostname);
  return raw;
}
function recalcSummary(body,computers){
  if(!body||typeof body!=="object")return body;
  const list=Array.isArray(computers)?computers:[];
  if(body.summary&&Object.prototype.hasOwnProperty.call(body.summary,"found"))return {...body,summary:{...body.summary,found:list.length,authenticated:list.filter(x=>x.authenticated).length}};
  return {...body,summary:{...(body.summary||{}),total:list.length,online:list.filter(x=>x.online).length,authenticated:list.filter(x=>x.authenticated).length,students:list.filter(x=>x.role!=="teacher").length,teachers:list.filter(x=>x.role==="teacher").length}};
}

module.exports={normalizeHostname,stableIdForHostname,canonicalRows,normalizedMapping,reconcileMappings,projectRows,resolveBackendId,stableIdForBackend,recalcSummary};
