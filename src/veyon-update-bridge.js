"use strict";

const express=require("express");
const {parseVersion,compareVersions,parseAptVeyon,installedVeyonVersion}=require("./veyon-update-policy");

const GITHUB_LATEST="https://api.github.com/repos/veyon/veyon/releases/latest";
const MAINTENANCE_URL=String(process.env.MAINTENANCE_URL||"http://127.0.0.1:3010").replace(/\/$/,"");
const MAINTENANCE_TOKEN=String(process.env.MAINTENANCE_TOKEN||"");
let routesRegistered=false;

async function jsonFetch(url,options={},timeoutMs=10000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{...options,signal:controller.signal});
    const text=await response.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={error:text}}
    if(!response.ok)throw new Error(body?.error||body?.message||`HTTP ${response.status}`);
    return body;
  }finally{clearTimeout(timer)}
}
async function hostUpdates(){
  if(!MAINTENANCE_TOKEN)throw new Error("Maintenance token is not configured");
  return jsonFetch(`${MAINTENANCE_URL}/host/updates`,{headers:{"x-maintenance-token":MAINTENANCE_TOKEN}},15000);
}
async function upstreamRelease(){
  try{
    const body=await jsonFetch(GITHUB_LATEST,{headers:{"user-agent":"RoomGoblin-Veyon-Lifecycle","accept":"application/vnd.github+json"}},10000);
    return {ok:true,tag:String(body.tag_name||""),version:parseVersion(body.tag_name)?.text||String(body.tag_name||""),publishedAt:body.published_at||null,url:body.html_url||""};
  }catch(error){return {ok:false,error:error.message,tag:"",version:""}}
}
async function statusPayload(){
  const [updates,release]=await Promise.all([hostUpdates(),upstreamRelease()]);
  const apt=parseAptVeyon(updates.packages);
  const installed=installedVeyonVersion(updates.veyonInstalledPackages);
  const baseline=apt.candidateVersion||installed.installedVersion;
  const cmp=baseline&&release.version?compareVersions(baseline,release.version):null;
  return {
    ok:true,
    ...installed,
    candidateVersion:apt.candidateVersion||null,
    aptUpdateAvailable:apt.packages.length>0,
    packages:apt.packages.map(row=>({name:row.name,security:!!row.security,raw:row.raw})),
    upstream:release,
    newerUpstreamThanApt:cmp===null?null:cmp<0,
    hostUpdateJob:updates.job||null,
    rebootRequired:updates.rebootRequired===true
  };
}
async function startUpdate(){
  if(!MAINTENANCE_TOKEN)throw new Error("Maintenance token is not configured");
  return jsonFetch(`${MAINTENANCE_URL}/host/updates`,{method:"POST",headers:{"x-maintenance-token":MAINTENANCE_TOKEN,"content-type":"application/json"},body:JSON.stringify({confirm:"INSTALL_UPDATES"})},20000);
}

const previousGet=express.application.get;
const previousPost=express.application.post;
function registerRoutes(app,requireAdmin){
  if(routesRegistered||typeof requireAdmin!=="function")return;
  routesRegistered=true;
  previousGet.call(app,"/api/v1/admin/veyon-update-status",requireAdmin,async(_req,res)=>{
    try{res.json(await statusPayload())}catch(error){res.status(502).json({ok:false,error:error.message})}
  });
  previousPost.call(app,"/api/v1/admin/veyon-update",requireAdmin,async(req,res)=>{
    if(String(req.body?.confirm||"")!=="UPDATE_VEYON_AND_HOST")return res.status(400).json({ok:false,error:"Explicit UPDATE_VEYON_AND_HOST confirmation required"});
    try{const status=await statusPayload();if(!status.aptUpdateAvailable)return res.status(409).json({ok:false,error:"No Veyon package update is currently offered by the configured apt sources",status});const result=await startUpdate();res.status(202).json({ok:true,scope:"host-packages",includesVeyon:true,result})}
    catch(error){res.status(502).json({ok:false,error:error.message})}
  });
}
express.application.get=function(route,...handlers){
  if(route==="/api/v1/admin/config"&&handlers.length)registerRoutes(this,handlers[0]);
  return previousGet.call(this,route,...handlers);
};

module.exports={statusPayload,upstreamRelease,hostUpdates,startUpdate};
