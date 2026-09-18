"use strict";

const crypto=require("crypto");

const PREF="integrations.cloudflare";
const API_TOKEN_SECRET="integration.cloudflare.api-token";
const GLOBAL_KEY_SECRET="integration.cloudflare.global-key";
const API_BASE="https://api.cloudflare.com/client/v4";

function failure(message,status=400){const e=Error(message);e.status=status;return e}
function cleanText(v,max=253){return String(v??"").trim().slice(0,max)}
function dnsName(v,label="Domain"){
  const x=cleanText(v).toLowerCase().replace(/\.$/,"");
  if(!x||x.length>253||!x.includes(".")||!x.split(".").every(p=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(p)))throw failure(`${label} must be a valid DNS name`);
  return x;
}
function tunnelName(v,hostname){
  const x=cleanText(v||`roomgoblin-${hostname}`,120).toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"");
  if(!x)throw failure("Tunnel name is required");
  return x;
}
function emailDomain(v){
  const raw=cleanText(v).toLowerCase().replace(/^@/,"");
  return raw?dnsName(raw,"Access email domain"):"";
}
function normalizeSettings(input={},prior={}){
  const zone=input.zone!==undefined?dnsName(input.zone,"Zone"):cleanText(prior.zone);
  const hostname=input.hostname!==undefined?dnsName(input.hostname,"Hostname"):cleanText(prior.hostname);
  if(zone&&hostname&&hostname!==zone&&!hostname.endsWith(`.${zone}`))throw failure("Cloudflare hostname must be inside the selected zone");
  const authMode=input.authMode===undefined?String(prior.authMode||"token"):String(input.authMode);
  if(!["token","global"].includes(authMode))throw failure("Cloudflare authentication mode must be token or global");
  const accessEnabled=input.accessEnabled===undefined?prior.accessEnabled===true:input.accessEnabled===true;
  const accessEmailDomain=input.accessEmailDomain===undefined?cleanText(prior.accessEmailDomain):emailDomain(input.accessEmailDomain);
  if(accessEnabled&&!accessEmailDomain)throw failure("Cloudflare Access requires an allowed email domain before it can be enabled");
  return {
    enabled:input.enabled===undefined?prior.enabled!==false:input.enabled!==false,
    authMode,
    apiEmail:cleanText(input.apiEmail===undefined?prior.apiEmail:input.apiEmail,254),
    zone,hostname,
    tunnelName:tunnelName(input.tunnelName===undefined?prior.tunnelName:input.tunnelName,hostname||zone||"roomgoblin"),
    alwaysUseHttps:input.alwaysUseHttps===undefined?prior.alwaysUseHttps!==false:input.alwaysUseHttps!==false,
    automaticHttpsRewrites:input.automaticHttpsRewrites===undefined?prior.automaticHttpsRewrites!==false:input.automaticHttpsRewrites!==false,
    http3:input.http3===undefined?prior.http3!==false:input.http3!==false,
    brotli:input.brotli===undefined?prior.brotli!==false:input.brotli!==false,
    accessEnabled,accessEmailDomain,
    replaceConflictingDns:input.replaceConflictingDns===undefined?prior.replaceConflictingDns===true:input.replaceConflictingDns===true,
    adoptExistingTunnel:input.adoptExistingTunnel===undefined?prior.adoptExistingTunnel===true:input.adoptExistingTunnel===true,
    ids:{...(prior.ids||{})},
    ownership:{...(prior.ownership||{})}
  };
}
function publicSettings(value={},store){
  return {...value,
    apiTokenConfigured:!!store?.hasSecret?.(API_TOKEN_SECRET),
    globalKeyConfigured:!!store?.hasSecret?.(GLOBAL_KEY_SECRET),
    ids:{...(value.ids||{})},
    ownership:{...(value.ownership||{})}
  };
}
function sanitizeApiError(body,status){
  const errors=Array.isArray(body?.errors)?body.errors.map(x=>cleanText(x?.message,300)).filter(Boolean):[];
  const normalized=Number.isInteger(status)&&status>=400&&status<500?status:502;
  return failure(errors.join("; ")||`Cloudflare API request failed (HTTP ${status})`,normalized);
}

class CloudflareClient{
  constructor({auth,fetchImpl=globalThis.fetch,baseUrl=API_BASE}={}){
    if(typeof fetchImpl!=="function")throw Error("fetch implementation is required");
    this.fetch=fetchImpl;this.baseUrl=baseUrl.replace(/\/$/,"");this.auth=auth||{};
  }
  headers(){
    if(this.auth.mode==="token"){
      if(!this.auth.token)throw failure("Cloudflare API token is not configured",409);
      return {"Authorization":`Bearer ${this.auth.token}`};
    }
    if(!this.auth.email||!this.auth.key)throw failure("Cloudflare Global API Key authentication requires both email and key",409);
    return {"X-Auth-Email":this.auth.email,"X-Auth-Key":this.auth.key};
  }
  async request(method,path,body){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
      let response;
      try{response=await this.fetch(this.baseUrl+path,{method,headers:{...this.headers(),...(body===undefined?{}:{"Content-Type":"application/json"})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal})}
      catch(e){throw failure(e?.name==="AbortError"?"Cloudflare API request timed out":"Cloudflare API is unreachable",502)}
      let value={};try{value=await response.json()}catch{}
      if(!response.ok||value.success===false)throw sanitizeApiError(value,response.status);
      return value.result;
    }finally{clearTimeout(timer)}
  }
  get(path){return this.request("GET",path)}
  post(path,body){return this.request("POST",path,body)}
  put(path,body){return this.request("PUT",path,body)}
  patch(path,body){return this.request("PATCH",path,body)}
  delete(path){return this.request("DELETE",path)}
}

class CloudflareManager{
  constructor({storage,fetchImpl=globalThis.fetch,connectorInstaller=null,originUrl=null}={}){
    if(!storage)throw Error("CloudflareManager requires storage");
    const port=Number(process.env.PORT||3000);if(!Number.isInteger(port)||port<1||port>65535)throw Error("Invalid RoomGoblin origin port");
    this.storage=storage;this.fetchImpl=fetchImpl;this.connectorInstaller=connectorInstaller;this.originUrl=originUrl||`http://127.0.0.1:${port}`;
  }
  saved(){return normalizeSettings({},this.storage.getPreference(PREF,{})||{})}
  status(){return publicSettings(this.saved(),this.storage)}
  save(input={}){
    const prior=this.saved(),next=normalizeSettings(input,prior);
    this.storage.tx(()=>{
      const token=cleanText(input.apiToken,4096),key=cleanText(input.globalKey,4096);
      if(token&&token!=="••••••••")this.storage.putSecret(API_TOKEN_SECRET,token,{integration:"cloudflare",type:"api-token"});
      if(key&&key!=="••••••••")this.storage.putSecret(GLOBAL_KEY_SECRET,key,{integration:"cloudflare",type:"global-api-key"});
      this.storage.setPreference(PREF,next);
    });
    return this.status();
  }
  auth(settings=this.saved()){
    if(settings.authMode==="global")return {mode:"global",email:settings.apiEmail,key:String(this.storage.getSecret(GLOBAL_KEY_SECRET)||"")};
    return {mode:"token",token:String(this.storage.getSecret(API_TOKEN_SECRET)||"")};
  }
  client(settings=this.saved()){return new CloudflareClient({auth:this.auth(settings),fetchImpl:this.fetchImpl})}
  async resolve(settings=this.saved()){
    if(!settings.zone)throw failure("Cloudflare zone is required",409);
    if(!settings.hostname)throw failure("Cloudflare hostname is required",409);
    const client=this.client(settings);
    const zones=await client.get(`/zones?name=${encodeURIComponent(settings.zone)}&per_page=50`);
    const zone=(Array.isArray(zones)?zones:[]).find(z=>String(z.name).toLowerCase()===settings.zone);
    if(!zone)throw failure("The configured domain was not found in a Cloudflare account accessible to this credential. Add the domain to Cloudflare first, then retry.",404);
    if(zone.status!=="active"){
      const nameservers=(Array.isArray(zone.name_servers)?zone.name_servers:[]).map(x=>cleanText(x,253)).filter(Boolean);
      const suffix=nameservers.length?` Update the domain at its registrar to use these assigned Cloudflare nameservers: ${nameservers.join(", ")}.`:" Complete Cloudflare's authoritative DNS activation at the domain registrar.";
      throw failure(`Cloudflare zone ${settings.zone} is ${cleanText(zone.status||"not active",40)}.${suffix} Retry after Cloudflare reports the zone active.`,409);
    }
    if(!zone.account?.id)throw failure("Cloudflare zone did not include an account identifier",502);
    return {client,zone,accountId:zone.account.id};
  }
  async validate(){
    const settings=this.saved(),{zone,accountId}=await this.resolve(settings);
    return {ok:true,zone:{id:zone.id,name:zone.name,status:zone.status},accountId,authMode:settings.authMode,
      warning:settings.authMode==="global"?"Global API Key works, but a scoped API token is safer and recommended.":null};
  }
  async findTunnel(client,accountId,name){
    const list=await client.get(`/accounts/${accountId}/cfd_tunnel?is_deleted=false&name=${encodeURIComponent(name)}&per_page=100`);
    return (Array.isArray(list)?list:[]).find(x=>x.name===name)||null;
  }
  async ensureTunnel(ctx,settings){
    let tunnel=null,created=false,adopted=false;
    const recordedId=cleanText(settings.ids?.tunnelId,80);
    if(recordedId){
      try{tunnel=await ctx.client.get(`/accounts/${ctx.accountId}/cfd_tunnel/${recordedId}`)}
      catch(error){if(error.status!==404)throw error}
      if(tunnel&&tunnel.name!==settings.tunnelName)throw failure("The recorded RoomGoblin tunnel exists under a different name. Resolve the saved Cloudflare configuration before reprovisioning.",409);
    }
    if(!tunnel){
      const sameName=await this.findTunnel(ctx.client,ctx.accountId,settings.tunnelName);
      if(sameName){
        if(!settings.adoptExistingTunnel)throw failure("A Cloudflare tunnel with this name already exists but is not recorded as RoomGoblin-managed. Choose a different tunnel name or explicitly allow adoption; adoption replaces that tunnel's ingress configuration.",409);
        tunnel=sameName;adopted=true;
      }else{
        tunnel=await ctx.client.post(`/accounts/${ctx.accountId}/cfd_tunnel`,{name:settings.tunnelName,config_src:"cloudflare"});created=true;
      }
    }
    if(!tunnel?.id)throw failure("Cloudflare did not return a tunnel ID",502);
    await ctx.client.put(`/accounts/${ctx.accountId}/cfd_tunnel/${tunnel.id}/configurations`,{config:{ingress:[
      {hostname:settings.hostname,service:this.originUrl},
      {service:"http_status:404"}
    ]}});
    return {tunnel,created,adopted};
  }
  async ensureDns(ctx,settings,tunnel){
    const name=settings.hostname,target=`${tunnel.id}.cfargotunnel.com`;
    const rows=await ctx.client.get(`/zones/${ctx.zone.id}/dns_records?name=${encodeURIComponent(name)}&per_page=100`);
    const existing=(Array.isArray(rows)?rows:[]).find(x=>String(x.name).toLowerCase()===name);
    const desired={type:"CNAME",name,content:target,proxied:true,ttl:1,comment:"Managed by RoomGoblin Cloudflare provisioning"};
    if(existing){
      const same=existing.type==="CNAME"&&String(existing.content).toLowerCase()===target.toLowerCase();
      if(!same&&!settings.replaceConflictingDns)throw failure(`DNS ${name} already exists and does not point to the RoomGoblin tunnel. Enable explicit conflicting-record replacement to take ownership.`,409);
      const record=await ctx.client.put(`/zones/${ctx.zone.id}/dns_records/${existing.id}`,desired);
      return {record,created:false,adopted:same};
    }
    return {record:await ctx.client.post(`/zones/${ctx.zone.id}/dns_records`,desired),created:true,adopted:false};
  }
  async setZoneSetting(ctx,id,value){
    try{return {ok:true,result:await ctx.client.patch(`/zones/${ctx.zone.id}/settings/${id}`,{value})}}
    catch(error){return {ok:false,error:error.message}}
  }
  async ensureAccess(ctx,settings){
    if(!settings.accessEnabled)return {enabled:false};
    const apps=await ctx.client.get(`/accounts/${ctx.accountId}/access/apps?per_page=100`);
    let app=(Array.isArray(apps)?apps:[]).find(x=>String(x.domain||"").toLowerCase()===settings.hostname),created=false;
    if(!app){app=await ctx.client.post(`/accounts/${ctx.accountId}/access/apps`,{name:`RoomGoblin — ${settings.hostname}`,domain:settings.hostname,type:"self_hosted",session_duration:"12h",app_launcher_visible:false});created=true}
    const policies=await ctx.client.get(`/accounts/${ctx.accountId}/access/apps/${app.id}/policies?per_page=100`);
    const pname=`RoomGoblin allow @${settings.accessEmailDomain}`;
    let policy=(Array.isArray(policies)?policies:[]).find(x=>x.name===pname);
    if(!policy)policy=await ctx.client.post(`/accounts/${ctx.accountId}/access/apps/${app.id}/policies`,{name:pname,decision:"allow",precedence:1,include:[{email_domain:{domain:settings.accessEmailDomain}}]});
    return {enabled:true,app,policy,created};
  }
  async provision(input={}){
    let settings=this.save(input);
    settings=this.saved();
    const ctx=await this.resolve(settings);
    const tunnelResult=await this.ensureTunnel(ctx,settings);
    const dnsResult=await this.ensureDns(ctx,settings,tunnelResult.tunnel);
    const edge={
      alwaysUseHttps:await this.setZoneSetting(ctx,"always_use_https",settings.alwaysUseHttps?"on":"off"),
      automaticHttpsRewrites:await this.setZoneSetting(ctx,"automatic_https_rewrites",settings.automaticHttpsRewrites?"on":"off"),
      http3:await this.setZoneSetting(ctx,"http3",settings.http3?"on":"off"),
      brotli:await this.setZoneSetting(ctx,"brotli",settings.brotli?"on":"off")
    };
    const edgeWarnings=Object.entries(edge).filter(([,value])=>value?.ok===false).map(([name,value])=>`${name}: ${value.error}`);
    const access=await this.ensureAccess(ctx,settings);
    let connector={installed:false,restartRequired:false};
    if(this.connectorInstaller){
      const token=await ctx.client.get(`/accounts/${ctx.accountId}/cfd_tunnel/${tunnelResult.tunnel.id}/token`);
      if(typeof token!=="string"||!token)throw failure("Cloudflare did not return a connector token",502);
      connector=await this.connectorInstaller(token);
    }
    const persisted={...settings,ids:{accountId:ctx.accountId,zoneId:ctx.zone.id,tunnelId:tunnelResult.tunnel.id,dnsRecordId:dnsResult.record?.id||"",accessAppId:access.app?.id||"",accessPolicyId:access.policy?.id||""},
      ownership:{tunnel:tunnelResult.created,dns:dnsResult.created,accessApp:access.created===true}};
    this.storage.setPreference(PREF,persisted);
    return {ok:true,settings:publicSettings(persisted,this.storage),zone:{id:ctx.zone.id,name:ctx.zone.name,status:ctx.zone.status},
      tunnel:{id:tunnelResult.tunnel.id,name:tunnelResult.tunnel.name,created:tunnelResult.created,adopted:tunnelResult.adopted},
      dns:{id:dnsResult.record?.id,name:settings.hostname,target:`${tunnelResult.tunnel.id}.cfargotunnel.com`,created:dnsResult.created,adopted:dnsResult.adopted},
      edge,warnings:edgeWarnings,access:{enabled:access.enabled===true,appId:access.app?.id||null,policyId:access.policy?.id||null},connector,
      publicUrl:`https://${settings.hostname}/controller/`};
  }
  async liveStatus(){
    const settings=this.saved(),result={ok:true,configured:!!settings.zone&&!!settings.hostname,settings:this.status(),cloudflare:null};
    if(!result.configured)return result;
    try{
      const ctx=await this.resolve(settings),tunnel=settings.ids?.tunnelId?await ctx.client.get(`/accounts/${ctx.accountId}/cfd_tunnel/${settings.ids.tunnelId}`):await this.findTunnel(ctx.client,ctx.accountId,settings.tunnelName);
      const dnsRows=await ctx.client.get(`/zones/${ctx.zone.id}/dns_records?name=${encodeURIComponent(settings.hostname)}&per_page=100`);
      const dns=(Array.isArray(dnsRows)?dnsRows:[]).find(x=>String(x.name).toLowerCase()===settings.hostname)||null;
      result.cloudflare={zone:{id:ctx.zone.id,name:ctx.zone.name,status:ctx.zone.status},tunnel:tunnel?{id:tunnel.id,name:tunnel.name,status:tunnel.status||null}:null,dns:dns?{id:dns.id,type:dns.type,name:dns.name,content:dns.content,proxied:dns.proxied}:null};
    }catch(error){result.ok=false;result.error=error.message}
    return result;
  }
}

module.exports={CloudflareClient,CloudflareManager,normalizeSettings,publicSettings,API_TOKEN_SECRET,GLOBAL_KEY_SECRET,PREF};
