"use strict";

const {performance}=require("node:perf_hooks");
const STATUS_ACTIONS=Object.freeze(["videoStatus","outputStatus","inputStatus","cecStatus","systemStatus","networkStatus"]);
const STATUS_BUDGET_MS=8000;
const STATUS_CACHE_MS=2000;
const MAX_RESPONSE_BYTES=64*1024;

// The deadline supplied to fetch stays active until this bounded body is read.
async function readPlutoResponse(response){
  if(!response.ok){
    await response.body?.cancel();
    throw new Error(`Pluto HTTP ${response.status}`);
  }
  if(Number(response.headers.get("content-length"))>MAX_RESPONSE_BYTES){
    await response.body?.cancel();
    throw new Error("Pluto response exceeds 64 KiB limit");
  }
  const reader=response.body?.getReader(),chunks=[];
  let size=0;
  if(reader){
    try{
      for(;;){
        const {done,value}=await reader.read();
        if(done)break;
        size+=value.byteLength;
        if(size>MAX_RESPONSE_BYTES)throw new Error("Pluto response exceeds 64 KiB limit");
        chunks.push(Buffer.from(value));
      }
    }catch(error){
      try{await reader.cancel()}catch{}
      throw error;
    }finally{reader.releaseLock()}
  }
  let data;
  try{data=JSON.parse(Buffer.concat(chunks).toString("utf8"))}
  catch{throw new Error("Pluto returned invalid JSON")}
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Pluto returned an invalid response object");
  return data;
}

function createPlutoStatusReader(read,{budgetMs=STATUS_BUDGET_MS,cacheMs=STATUS_CACHE_MS,clock=()=>performance.now()}={}){
  let pending=null,controller=null,cached=null,expiresAt=0,generation=0;
  function invalidate(){
    generation++;cached=null;
    controller?.abort(new Error("Matrix status interrupted by a command or connection change"));
  }
  function status(){
    if(pending)return pending;
    if(cached&&clock()<expiresAt)return Promise.resolve(cached);
    const scanGeneration=generation;
    controller=new AbortController();
    const {signal}=controller;
    const timer=setTimeout(()=>controller.abort(new Error(`Matrix status exceeded its ${budgetMs} ms budget`)),budgetMs);
    pending=(async()=>{
      const out={ok:true};
      for(const action of STATUS_ACTIONS){
        try{
          signal.throwIfAborted();
          out[action]=(await read({action},{signal})).data;
        }catch(error){out.ok=false;out[action]={error:error.message}}
      }
      out.observedAt=new Date().toISOString();
      // Cache partial failures briefly too, so multiple clients cannot create
      // a burst of identical failed scans. Invalidated scans are never cached.
      if(scanGeneration===generation){cached=out;expiresAt=clock()+cacheMs}
      return out;
    })().finally(()=>{clearTimeout(timer);pending=null;controller=null});
    return pending;
  }
  return {status,invalidate};
}

module.exports={createPlutoStatusReader,readPlutoResponse,STATUS_ACTIONS,STATUS_BUDGET_MS,STATUS_CACHE_MS,MAX_RESPONSE_BYTES};
