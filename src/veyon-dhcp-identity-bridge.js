"use strict";

const express=require("express");
const path=require("path");
const {ClassroomHubStorage}=require("./storage");
const {runtimeVeyonKeyring}=require("./veyon-keyring");
const {reconcileMappings,projectRows,resolveBackendId,stableIdForBackend,recalcSummary}=require("./veyon-inventory-identity");

const PREF="veyon.inventory-hostmap.v2";
let storeInstance=null;
function store(){
  if(storeInstance)return storeInstance;
  const dataDir=path.resolve(process.env.DATA_DIR||path.join(__dirname,"..","data"));
  storeInstance=new ClassroomHubStorage({dataDir,dbFile:String(process.env.DATABASE_FILE||path.join(dataDir,"classroom-control-hub.db")),masterKeyFile:String(process.env.MASTER_KEY_FILE||"/run/secrets/classroom-control-hub-master-key")});
  return storeInstance;
}
function readMapping(){return store().getPreference(PREF,{})||{}}
function saveMapping(mapping){store().setPreference(PREF,mapping)}
function migrateKeyPreference(move){
  if(!move?.fromIp||!move?.toIp||move.fromIp===move.toIp)return;
  try{runtimeVeyonKeyring.moveHostPreference(move.fromIp,move.toIp)}catch{}
}
function reconcileBody(body,{read=readMapping,save=saveMapping,migrate=migrateKeyPreference}={}){
  if(!body||typeof body!=="object"||!Array.isArray(body.computers))return body;
  const current=read();
  const result=reconcileMappings(current,body.computers);
  // Never publish IDs which cannot be resolved by the next request. Persist
  // authoritative identity before projection or optional key-affinity moves.
  save(result.mapping);
  for(const move of result.moves)migrate(move);
  const computers=projectRows(result.mapping,body.computers);
  return recalcSummary({...body,computers},computers);
}
function mappedId(value){return resolveBackendId(readMapping(),value)}
function stableId(value,mapping=readMapping()){return stableIdForBackend(mapping,value)}
function projectRecord(record,mapping){
  if(!record||typeof record!=="object")return record;
  return typeof record.id==="string"?{...record,id:stableId(record.id,mapping)}:{...record};
}
function projectJob(job,mapping){
  if(!job||typeof job!=="object")return job;
  const out={...job};
  if(Array.isArray(job.results))out.results=job.results.map(row=>projectRecord(row,mapping));
  if(Array.isArray(job.targets))out.targets=job.targets.map(id=>typeof id==="string"?stableId(id,mapping):id);
  return out;
}
function projectOperationalBody(body){
  if(!body||typeof body!=="object")return body;
  const mapping=readMapping(),out={...body};
  if(body.computer)out.computer=projectRecord(body.computer,mapping);
  if(Array.isArray(body.updated))out.updated=body.updated.map(row=>projectRecord(row,mapping));
  if(Array.isArray(body.results))out.results=body.results.map(row=>projectRecord(row,mapping));
  if(body.job)out.job=projectJob(body.job,mapping);
  if(Array.isArray(body.jobs))out.jobs=body.jobs.map(job=>projectJob(job,mapping));
  if(Array.isArray(body.ownedLocks))out.ownedLocks=body.ownedLocks.map(row=>projectRecord(row,mapping));
  return out;
}
function rewriteRequestIds(req){
  if(req.params?.id)req.params.id=mappedId(req.params.id);
  if(req.params?.computerId)req.params.computerId=mappedId(req.params.computerId);
  const body=req.body;
  if(!body||typeof body!=="object")return;
  for(const key of ["id","teacherId","computerId"]){if(typeof body[key]==="string")body[key]=mappedId(body[key])}
  for(const key of ["ids","studentIds","computerIds","targets"]){if(Array.isArray(body[key]))body[key]=body[key].map(mappedId)}
}
function wrapVeyonHandler(handler,{inventory=false}={}){
  return async function(req,res,next){
    try{rewriteRequestIds(req)}catch{return res.status(503).json({ok:false,error:"Veyon identity mapping is temporarily unavailable"})}
    const json=res.json.bind(res);
    res.json=body=>{
      try{return json(inventory?reconcileBody(body):projectOperationalBody(body))}
      catch{
        if(res.headersSent)return res.end();
        res.status(503);return json({ok:false,error:"Veyon identity mapping could not be persisted"});
      }
    };
    return handler(req,res,next);
  };
}
function isVeyonRoute(route){return typeof route==="string"&&route.startsWith("/api/v1/veyon/")}
function isInventoryRoute(route,method){return method==="get"&&route==="/api/v1/veyon/computers"||method==="post"&&route==="/api/v1/veyon/discover"}
function wrapHandlers(route,method,handlers){
  if(!handlers.length||!isVeyonRoute(route))return handlers;
  const next=[...handlers],last=next.length-1;
  next[last]=wrapVeyonHandler(next[last],{inventory:isInventoryRoute(route,method)});
  return next;
}

for(const method of ["get","post","put","delete"]){
  const previous=express.application[method];
  express.application[method]=function(route,...handlers){return previous.call(this,route,...wrapHandlers(route,method,handlers))};
}

module.exports={PREF,reconcileBody,projectOperationalBody,rewriteRequestIds,mappedId,stableId};
