"use strict";

const net=require("net");

function normalizeAddress(value){
  let address=String(value||"").trim().toLowerCase();
  if(address.startsWith("[")){const end=address.indexOf("]");if(end>0)address=address.slice(1,end)}
  if(address.startsWith("::ffff:"))address=address.slice(7);
  const zone=address.indexOf("%");if(zone>=0)address=address.slice(0,zone);
  return address;
}

function isLoopbackAddress(value){
  const address=normalizeAddress(value);
  if(address==="localhost"||address==="::1")return true;
  if(net.isIP(address)===4){const first=Number(address.split(".")[0]);return first===127}
  return false;
}

// These headers identify forwarding; none independently proves encryption.
const FORWARDING_HEADERS=Object.freeze([
  "forwarded","x-forwarded-for","x-forwarded-host","x-forwarded-port",
  "x-forwarded-proto","x-real-ip","cf-connecting-ip","cf-visitor",
  "true-client-ip","via"
]);

function requestHeader(req,name){
  const value=req.headers?.[name];
  return value===undefined?req.get?.(name):value;
}

function hasForwardingEvidence(req){
  return FORWARDING_HEADERS.some(name=>{
    if(Object.prototype.hasOwnProperty.call(req.headers||{},name))return true;
    const value=requestHeader(req,name);
    return value!==undefined&&value!==null;
  });
}

function loopbackAuthority(value,{origin=false}={}){
  if(typeof value!=="string"||!value||value.length>1024||/[\s\\]/.test(value))return false;
  if(!origin&&/[/?#@]/.test(value))return false;
  try{
    const url=new URL(origin?value:`http://${value}`);
    return ["http:","https:"].includes(url.protocol)&&!url.username&&!url.password&&
      url.pathname==="/"&&!url.search&&!url.hash&&isLoopbackAddress(url.hostname);
  }catch{return false}
}

function directLoopbackRequest(req){
  if(hasForwardingEvidence(req))return false;
  const host=requestHeader(req,"host");
  const origin=requestHeader(req,"origin");
  return (host===undefined||loopbackAuthority(host))&&
    (origin===undefined||loopbackAuthority(origin,{origin:true}));
}

function forwardedHttps(req,trustProxyHops=0){
  const hops=Number(trustProxyHops);
  if(!Number.isSafeInteger(hops)||hops<1||hops>5)return false;
  const raw=requestHeader(req,"x-forwarded-proto");
  if(typeof raw!=="string"||raw.length>128)return false;
  const values=raw.split(",").map(value=>value.trim().toLowerCase());
  // Never discard empty entries or an HTTP prefix: either makes the supplied
  // client-to-proxy protocol evidence unsafe, even if its last entry is HTTPS.
  return values.length<=hops&&values.every(value=>value==="https");
}

function recoveryTransportAllowed(req,{trustProxyHops=0}={}){
  const peer=req.socket?.remoteAddress||req.connection?.remoteAddress||"";
  const loopback=isLoopbackAddress(peer);
  // A local proxy's socket is not proof that the browser itself is local.
  // Forwarded traffic needs explicit proxy trust and complete HTTPS evidence.
  // Proxies must overwrite X-Forwarded-Proto, not pass client input through.
  const encrypted=req.socket?.encrypted===true||(loopback&&forwardedHttps(req,trustProxyHops));
  return {allowed:encrypted||(loopback&&directLoopbackRequest(req)),encrypted,loopback};
}

function validRecoveryId(value){return /^[A-Za-z0-9_-]{32,128}$/.test(String(value||""))}

function boundedRecoveryStatus(input,id){
  const source=input?.job&&typeof input.job==="object"?input.job:input||{};
  if(!validRecoveryId(id)||String(source.recoveryId||"")!==String(id))return null;
  const clean=(value,max)=>String(value||"").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,max);
  const rollback=source.rollback&&typeof source.rollback==="object"?{attempted:source.rollback.attempted===true,ok:source.rollback.ok===true}:undefined;
  return {ok:source.ok===true,running:source.running===true,phase:clean(source.phase,64)||"unknown",message:clean(source.message,500),updatedAt:clean(source.updatedAt,64)||null,reloginRequired:source.reloginRequired===true,...(rollback?{rollback}:{})};
}

module.exports={normalizeAddress,isLoopbackAddress,recoveryTransportAllowed,validRecoveryId,boundedRecoveryStatus};
