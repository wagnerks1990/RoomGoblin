"use strict";

const {runtimeVeyonKeyring,validPrivateKey,shouldFallbackAuthentication}=require("./veyon-keyring");

function veyonError(message,reason,extra={}) {
  return Object.assign(new Error(message),{reason,...extra});
}

function safeVeyonFailure(error) {
  const code=Number(error.veyonCode);
  return {
    ok:false,
    error:error.reason?error.message:"Veyon preview failed. Check the WebAPI service, authentication key and endpoint session.",
    code:Number.isFinite(code)?code:undefined,
    stage:["authentication","framebuffer"].includes(error.stage)?error.stage:"framebuffer",
    reason:error.reason||"upstream-failure",
    upstreamStatus:Number.isInteger(error.status)?error.status:undefined
  };
}

function veyonAuthenticationRequest(url,options={}){
  if(String(options.method||"GET").toUpperCase()!=="POST")return null;
  let parsedUrl;try{parsedUrl=new URL(String(url))}catch{return null}
  const match=parsedUrl.pathname.match(/\/api\/v1\/authentication\/([^/]+)$/);if(!match)return null;
  let body;try{body=JSON.parse(String(options.body||""))}catch{return null}
  const credentials=body?.credentials||{},keyName=String(credentials.keyname||"").trim(),privateKey=String(credentials.keydata||"");
  if(!keyName||!validPrivateKey(privateKey))return null;
  let host="";try{host=decodeURIComponent(match[1])}catch{host=match[1]}
  return {host,body,keyName,privateKey};
}

async function bufferedResponse(response,maxBytes){
  if(Number(response.headers.get("content-length"))>maxBytes)throw veyonError("Veyon response exceeds size limit","response-too-large");
  const chunks=[];let size=0;
  if(response.body){
    for await(const chunk of response.body){
      size+=chunk.byteLength;
      if(size>maxBytes)throw veyonError("Veyon response exceeds size limit","response-too-large");
      chunks.push(Buffer.from(chunk));
    }
  }
  return new Response([204,205,304].includes(response.status)?null:Buffer.concat(chunks),{status:response.status,statusText:response.statusText,headers:response.headers});
}

async function authenticationCandidates(request){
  if(!request)return [];
  try{
    if(!String(process.env.DATABASE_FILE||"").trim())return [{keyName:request.keyName,privateKey:request.privateKey}];
    return runtimeVeyonKeyring.orderedCredentials(request.host,{keyName:request.keyName,privateKey:request.privateKey});
  }catch{return [{keyName:request.keyName,privateKey:request.privateKey}]}
}

// Keep the deadline active through body consumption, not just HTTP headers.
// Authentication POSTs may transparently try another configured Veyon key, but
// only after Veyon explicitly rejects key authentication (codes 4/5/6). Pool
// exhaustion, transport failures and timeouts never trigger key spraying.
async function bufferedVeyonFetch(url, options = {}, fetchImpl = fetch) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),options.timeoutMs||7000);
  const maxBytes=options.maxBytes||16*1024*1024;
  const authentication=veyonAuthenticationRequest(url,options);
  let candidates=authentication?await authenticationCandidates(authentication):[];
  if(!candidates.length)candidates=[null];
  try{
    let lastResponse=null;
    for(let index=0;index<candidates.length;index++){
      const candidate=candidates[index];
      let body=options.body;
      if(authentication&&candidate){
        body=JSON.stringify({...authentication.body,credentials:{...authentication.body.credentials,keyname:candidate.keyName,keydata:candidate.privateKey}});
      }
      const upstream=await fetchImpl(url,{method:options.method||"GET",headers:options.headers||{},body,signal:controller.signal,redirect:"error"});
      const response=await bufferedResponse(upstream,maxBytes);lastResponse=response;
      if(!authentication||!candidate||response.ok){
        if(authentication&&candidate&&response.ok){try{runtimeVeyonKeyring.rememberHost(authentication.host,candidate.keyName)}catch{}}
        return response;
      }
      if(index>=candidates.length-1)return response;
      const rejection=await veyonResponseError(response.clone());
      if(!shouldFallbackAuthentication(rejection))return response;
    }
    return lastResponse;
  }catch(error){
    if(error.reason)throw error;
    if(controller.signal.aborted)throw veyonError("Veyon request timed out. Check the WebAPI service and endpoint connection.","timeout",{status:504});
    const networkCode=error.cause?.code||error.code;
    if(networkCode==="ECONNREFUSED")throw veyonError("Veyon WebAPI refused the connection. Check its service and configured address.","connection-refused");
    if(["ENOTFOUND","EAI_AGAIN"].includes(networkCode))throw veyonError("Veyon WebAPI hostname could not be resolved. Check its configured address.","name-resolution");
    throw veyonError("Cannot reach Veyon WebAPI. Check its service and network connection.","network-failure");
  }finally{
    controller.abort();clearTimeout(timeout);
  }
}

async function veyonResponseError(response) {
  let body;
  try { body = await response.json(); } catch { body = {}; }
  const code = Number(body?.error?.code);
  const messages = {
    1: "Veyon rejected the request data. Check WebAPI compatibility.",
    2: "Veyon connection expired. Retry the preview.",
    4: "Veyon credentials are invalid. Check the configured authentication key.",
    5: "Veyon key authentication is unavailable on this endpoint. Check its authentication configuration.",
    6: "Veyon authentication failed. Check the endpoint key and access policy.",
    7: "Veyon connection limit reached. Retry shortly or reduce preview concurrency.",
    8: "Veyon connection timed out. Check the endpoint connection.",
    9: "Veyon cannot encode the requested image format.",
    10: "Screen preview is not available yet. Check the endpoint session and retry.",
    11: "Veyon could not encode the screen preview. Check the endpoint session and WebAPI image codecs.",
    12: "Veyon protocol mismatch. Check that the endpoint runs a compatible Veyon Server."
  };
  const error = veyonError(messages[code] || `Veyon request failed (HTTP ${response.status}).`,messages[code]?`veyon-${code}`:"upstream-http");
  error.status = response.status; error.veyonCode = code;
  return error;
}

function framebufferType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  throw veyonError("Veyon returned an invalid screen image.","invalid-image");
}

async function readVeyonFrame(query, request, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const params = new URLSearchParams(query);
  // A new VNC connection may authenticate before its first framebuffer arrives.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(`/api/v1/framebuffer?${params}`);
      if (!response.ok) throw await veyonResponseError(response);
      const buffer = Buffer.from(await response.arrayBuffer());
      return {buffer, contentType: framebufferType(buffer)};
    } catch (error) {
      if (attempt === 2) throw error;
      if ([9,11].includes(error.veyonCode) && params.get("format") !== "png") {
        params.set("format", "png"); params.delete("quality");
      } else if (error.veyonCode === 10) {
        await wait(200 * (attempt + 1));
      } else throw error;
    }
  }
}

module.exports={bufferedVeyonFetch,veyonResponseError,framebufferType,readVeyonFrame,safeVeyonFailure,veyonAuthenticationRequest};
