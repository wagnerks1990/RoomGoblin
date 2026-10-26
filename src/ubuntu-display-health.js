"use strict";
// Presentation-safe health from independent SSH, session, output and receiver evidence.
function health(d,live,receiverOnline){
  const alerts=[],s=live?.status,h=s?.health;
  if(!live?.online)alerts.push({code:"offline",text:live?.error||"Computer has not been checked."});
  else{
    if(!s.session?.online)alerts.push({code:"session",text:"The kiosk session is not reporting."});
    if(h?.diskTotalBytes&&h.diskFreeBytes/h.diskTotalBytes<0.1)alerts.push({code:"disk",text:"Less than 10% disk space remains."});
    if(h?.memoryTotalKiB&&h.memoryAvailableKiB/h.memoryTotalKiB<0.08)alerts.push({code:"memory",text:"Less than 8% memory is available."});
    if(s.rebootRequired)alerts.push({code:"reboot",text:"Ubuntu requires a reboot to finish updates."});
    for(const screen of d.config.screens.filter(s=>s.enabled!==false)){
      const runtime=s.session?.screens?.find(s=>s.receiverId===screen.receiverId);
      if(runtime?.error||!runtime?.browserRunning||!receiverOnline(screen.receiverId))alerts.push({code:"screen:"+screen.receiverId,text:`${screen.name}: ${runtime?.error||(!runtime?.browserRunning?"browser unavailable":"receiver disconnected")}`});
    }
    const job=s.maintenance?.job;
    if(["failed","interrupted"].includes(job?.state))alerts.push({code:"maintenance",text:"The last maintenance operation needs attention."});
  }
  if(d.state!=="ready")alerts.push({code:"enrollment",text:"Installation requires repair."});
  return {state:!live?.online?"offline":alerts.length?"attention":"healthy",alerts};
}
module.exports={health};
