/* One request deadline covers headers and body. Interrupted writes are never retried. */
(()=>{
  "use strict";
  function timeoutFor(url,method="GET"){
    const path=new URL(url,globalThis.location?.href||"http://localhost/").pathname;
    if(path.startsWith("/api/v1/ubuntu-displays"))return 60_000;
    if(path.startsWith("/api/v1/maintenance/android/"))return 600_000;
    if(path.startsWith("/api/v1/maintenance/")&&(!["GET","HEAD"].includes(method.toUpperCase())||/^\/api\/v1\/maintenance\/(?:backup\/|checks\/run|diagnostics\/bundle)/.test(path)))return 2_700_000;
    return ["GET","HEAD"].includes(method.toUpperCase())?60_000:600_000;
  }
  async function read(url,options={},consume=response=>response.text()){
    const caller=options.signal;
    if(caller?.aborted)throw caller.reason||new DOMException("Request cancelled","AbortError");
    const controller=new AbortController(),method=String(options.method||"GET").toUpperCase();
    const timeoutMs=timeoutFor(url,method);
    const timeoutError=new Error(["GET","HEAD"].includes(method)
      ?"Request timed out. Refresh to check the latest status."
      :"Request timed out; the operation's outcome is unconfirmed. Refresh status before retrying.");
    timeoutError.name="TimeoutError";
    let rejectStopped;
    const stopped=new Promise((_,reject)=>{rejectStopped=reject});
    const stop=reason=>{controller.abort(reason);rejectStopped(reason)};
    const onAbort=()=>stop(caller.reason||new DOMException("Request cancelled","AbortError"));
    caller?.addEventListener("abort",onAbort,{once:true});
    const timer=setTimeout(()=>stop(timeoutError),timeoutMs);
    try{
      return await Promise.race([(async()=>{
        const response=await fetch(url,{...options,signal:controller.signal});
        return {response,value:await consume(response)};
      })(),stopped]);
    }finally{clearTimeout(timer);caller?.removeEventListener("abort",onAbort)}
  }
  globalThis.RoomGoblinRequest=Object.freeze({read});
})();
