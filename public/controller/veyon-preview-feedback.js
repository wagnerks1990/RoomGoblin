"use strict";

(function installVeyonPreviewFeedback(){
  const PAUSED_PREFIX="Preview paused while classroom commands are being sent.";
  const FRIENDLY_PAUSED="Preview paused for classroom command.";

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

  const original=window.setThumbStatus;
  if(typeof original==="function"){
    window.setThumbStatus=function(id,text){
      const normalized=normalizeMessage(text);
      const result=original(id,normalized);
      if(normalized===FRIENDLY_PAUSED)hideRetryForPaused(id);
      return result;
    };
  }

  window.RoomGoblinVeyonPreviewFeedback={normalizeMessage};
})();
