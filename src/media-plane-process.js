"use strict";

const {spawn}=require("node:child_process");
const path=require("node:path");

// One owner for the media child's lifetime. The application stays PID 1; a
// failed media listener must fail the pair so the container can restart it.
function createMediaPlaneSupervisor({spawnProcess=spawn,owner=process,gracefulTimeoutMs=6000,report=message=>console.error(message)}={}){
  let child=null,finished=false,stopping=false,stopPromise=null,resolveStop,rejectStop,killTimer=null,stopFailure=null,ownerExiting=false;
  const killOnOwnerExit=()=>{
    // An exit listener cannot await graceful cleanup. This also handles a
    // synchronous bootstrap failure before server.js installs signal handlers.
    ownerExiting=true;
    if(child&&!finished)try{child.kill("SIGKILL")}catch{}
  };
  const rememberStopFailure=error=>{stopFailure??=error};
  function finish(error){
    if(finished)return;
    finished=true;
    clearTimeout(killTimer);
    owner.removeListener("exit",killOnOwnerExit);
    if(stopping){if(error)rejectStop(error);else resolveStop();return}
    report(error?`RoomGoblin media plane failed to start: ${error.message}`:"RoomGoblin media plane exited unexpectedly.");
    owner.exit(1);
  }
  function start(){
    if(child)throw new Error("RoomGoblin media plane is already started");
    child=spawnProcess(process.execPath,[path.join(__dirname,"media-server.js")],{env:process.env,stdio:"inherit"});
    owner.once("exit",killOnOwnerExit);
    child.on("error",error=>{
      if(finished||ownerExiting)return;
      if(!child.pid){finish(error);return}
      // A failed signal is not an exit. Keep the deadline and owner fallback
      // until the running child is actually reaped.
      if(stopping){rememberStopFailure(error);return}
      report(`RoomGoblin media plane failed: ${error.message}`);
      owner.exit(1);
    });
    child.once("exit",(code,signal)=>{
      if(finished)return;
      if(!stopping)report(`RoomGoblin media plane exit status: ${signal??code??"unknown"}.`);
      const error=stopping&&(stopFailure||(code!==0||signal?new Error(`RoomGoblin media plane shutdown failed: ${signal??code??"unknown"}.`):null));
      finish(error);
    });
    return child;
  }
  function stop(){
    if(stopPromise)return stopPromise;
    if(!child||finished)return Promise.resolve();
    stopping=true;
    stopPromise=new Promise((resolve,reject)=>{resolveStop=resolve;rejectStop=reject});
    // The child has its own five-second HTTP drain. Give it time to finish,
    // then reap even a stuck child before the application's ten-second limit.
    killTimer=setTimeout(()=>{
      rememberStopFailure(new Error("RoomGoblin media plane shutdown required forced termination."));
      try{child.kill("SIGKILL")}catch(error){rememberStopFailure(error)}
    },gracefulTimeoutMs);
    killTimer.unref();
    try{child.kill("SIGTERM")}catch(error){rememberStopFailure(error)}
    return stopPromise;
  }
  return {start,stop};
}

const mediaPlane=createMediaPlaneSupervisor();
module.exports={createMediaPlaneSupervisor,startMediaPlane:mediaPlane.start,stopMediaPlane:mediaPlane.stop};
