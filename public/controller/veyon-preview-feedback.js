"use strict";

(function installVeyonPreviewFeedback(){
  const PAUSED_PREFIX="Preview paused while classroom commands are being sent.";
  const FRIENDLY_PAUSED="Preview paused for classroom command.";
  const COMMAND_PRESSURE_RETRIES=4;

  function normalizeMessage(text){
    const value=String(text||"");
    if(value.startsWith(PAUSED_PREFIX))return FRIENDLY_PAUSED;
    return value;
  }

  function hideRetryForPaused(id){
    try{
      const retry=document.querySelector(`[data-retry="${CSS.escape(id)}"]`);
      if(retry)retry.hidden=true;
    }catch{}
  }

  function commandPressure(response,body){
    return response?.status===503&&body?.reason==="commands-pending";
  }

  function retryDelay(response){
    const seconds=Number(response?.headers?.get?.("Retry-After"));
    return Number.isFinite(seconds)&&seconds>0?Math.min(1500,Math.max(200,seconds*1000)):500;
  }

  function waitForRetry(ms,signal){
    return new Promise((resolve,reject)=>{
      if(signal?.aborted)return reject(new Error("Screen request timed out"));
      const timer=setTimeout(resolve,ms);
      signal?.addEventListener?.("abort",()=>{clearTimeout(timer);reject(new Error("Screen request timed out"))},{once:true});
    });
  }

  const originalSetThumbStatus=window.setThumbStatus;
  if(typeof originalSetThumbStatus==="function"){
    window.setThumbStatus=function(id,text){
      const normalized=normalizeMessage(text);
      const result=originalSetThumbStatus(id,normalized);
      if(normalized===FRIENDLY_PAUSED)hideRetryForPaused(id);
      return result;
    };
  }

  // A busy classroom command queue deliberately gives commands priority over
  // screenshots. Treat that short-lived 503 as back-pressure instead of a
  // failed thumbnail: wait for Retry-After and transparently retry a few times.
  // Real authentication, network and framebuffer failures retain the original
  // diagnostic behavior and normal exponential UI backoff.
  if(typeof window.imageFrame==="function"){
    window.imageFrame=async function resilientImageFrame(url,controller){
      let objectUrl;
      const timeout=setTimeout(()=>controller.abort(),30000);
      try{
        for(let attempt=0;attempt<=COMMAND_PRESSURE_RETRIES;attempt++){
          const response=await fetch(url,{cache:"no-store",signal:controller.signal});
          if(!response.ok){
            let body;try{body=await response.json()}catch{}
            if(commandPressure(response,body)&&attempt<COMMAND_PRESSURE_RETRIES){
              await waitForRetry(retryDelay(response),controller.signal);
              continue;
            }
            const message=typeof body?.error?.message==="string"?body.error.message:typeof body?.error==="string"?body.error:"Screen request failed";
            const detail=[body?.stage==="authentication"?"Authentication":body?.stage==="framebuffer"?"Screen capture":"",Number.isInteger(body?.code)?`Veyon ${body.code}`:"",`HTTP ${response.status}`].filter(Boolean).join(" · ");
            throw new Error(normalizeMessage(`${message} (${detail})`));
          }
          const blob=await response.blob();
          if(!blob.size||!/^image\/(jpeg|png|webp|bmp)$/i.test(blob.type))throw new Error("No valid screen image returned");
          objectUrl=URL.createObjectURL(blob);
          const probe=new Image();probe.src=objectUrl;
          await Promise.race([probe.decode(),new Promise((_,reject)=>{
            if(controller.signal.aborted)return reject(new Error("Screen request timed out"));
            controller.signal.addEventListener("abort",()=>reject(new Error("Screen request timed out")),{once:true});
          })]);
          return objectUrl;
        }
        throw new Error(FRIENDLY_PAUSED);
      }catch(error){if(objectUrl)URL.revokeObjectURL(objectUrl);throw error}
      finally{clearTimeout(timeout)}
    };
  }

  window.RoomGoblinVeyonPreviewFeedback={normalizeMessage,commandPressure,retryDelay};
})();
