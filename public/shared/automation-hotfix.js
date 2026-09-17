"use strict";

(function installAutomationCompatibility(){
  const TAIL_SUFFIX=".__primary-repeat-tail";
  function normalizeAction(input={},index=0){
    const action=String(input.action||"display.clear"),payload={...(input.payload||{})};
    let executionMode=String(input.executionMode||"").toLowerCase();
    if(!executionMode&&action==="display.media"&&payload.loop===true)executionMode="loop";
    if(!["once","repeat","loop"].includes(executionMode))executionMode="once";
    if(executionMode==="loop"&&action!=="display.media")executionMode="repeat";
    if(action==="display.media")payload.loop=executionMode==="loop";
    return {
      id:String(input.id||`action-${index+1}`),action,
      targets:Array.isArray(input.targets)?[...new Set(input.targets.map(String).filter(Boolean))]:[],
      useEventTargets:index>0&&input.useEventTargets!==false,payload,
      delaySeconds:Math.max(0,Math.min(3600,Number(input.delaySeconds)||0)),
      executionMode,
      repeatCount:Math.max(1,Math.min(100,Math.round(Number(input.repeatCount)||1))),
      repeatDelaySeconds:Math.max(0,Math.min(3600,Number(input.repeatDelaySeconds)||0)),
      continueOnError:input.continueOnError!==false
    };
  }
  function normalizeEventForEditor(event){
    if(!event||typeof event!=="object")return event;
    if(Array.isArray(event.actionSequence)&&event.actionSequence.length){
      event.actionSequence=event.actionSequence.map(normalizeAction);event.automationSchemaVersion=2;return event;
    }
    const first=normalizeAction({
      id:event.primaryActionId||"action-1",action:event.action,targets:event.targets,payload:event.payload,
      executionMode:event.primaryExecutionMode||(event.action==="display.media"&&event.payload?.loop?"loop":"once"),
      repeatCount:event.primaryRepeatCount||1,repeatDelaySeconds:event.primaryRepeatDelaySeconds||0,
      delaySeconds:event.primaryDelaySeconds||0,continueOnError:event.continueOnError!==false,useEventTargets:false
    },0);
    const extras=(Array.isArray(event.actions)?event.actions:[])
      .filter(step=>!String(step?.id||"").endsWith(TAIL_SUFFIX))
      .map((step,index)=>normalizeAction(step,index+1));
    event.actionSequence=[first,...extras];
    event.automationSchemaVersion=2;
    event._migratedInController=true;
    return event;
  }
  function install(){
    if(typeof window.api!=="function"||typeof window.scheduleDescription!=="function"||typeof window.editorEvent!=="function"||typeof window.editAutomation!=="function"){
      setTimeout(install,50);return;
    }
    if(window.__CLASSROOM_HUB_AUTOMATION_CLASS_TARGET_FIX__)return;
    window.__CLASSROOM_HUB_AUTOMATION_CLASS_TARGET_FIX__=true;

    const originalApi=window.api;
    window.api=async function patchedApi(url,opt={}){
      const payload=await originalApi(url,opt);
      const path=String(url||"").split("?")[0];
      const method=String(opt?.method||"GET").toUpperCase();
      if(path==="/api/v1/automations"&&method==="GET"&&Array.isArray(payload?.events)){
        for(const event of payload.events){
          normalizeEventForEditor(event);
          const occurrences=Array.isArray(event?.resolvedOccurrences)?event.resolvedOccurrences.filter(Boolean):[];
          const linked=Array.isArray(event?.classIds)?event.classIds.length>0:!!event?.classId;
          if(!linked||!occurrences.length)continue;
          const primary=[...occurrences].sort((a,b)=>String(a?.time||"").localeCompare(String(b?.time||"")))[0];
          if(primary?.time){event.legacyTime=event.time;event.time=primary.time;}
        }
      }
      return payload;
    };

    const originalScheduleDescription=window.scheduleDescription;
    window.scheduleDescription=function patchedScheduleDescription(event){
      const occurrences=Array.isArray(event?.resolvedOccurrences)?event.resolvedOccurrences.filter(Boolean):[];
      const linked=Array.isArray(event?.classIds)?event.classIds.length>0:!!event?.classId;
      if(linked&&occurrences.length){
        return [...occurrences]
          .sort((a,b)=>String(a?.time||"").localeCompare(String(b?.time||"")))
          .map(occ=>`${occ.time||event.time} • ${originalScheduleDescription(occ)}`)
          .join(" | ");
      }
      return originalScheduleDescription(event);
    };

    const originalEditorEvent=window.editorEvent;
    window.editorEvent=function patchedEditorEvent(){
      const event=originalEditorEvent();
      const checkbox=document.getElementById("autoUseClassTargets");
      if(checkbox)event.useClassTargets=checkbox.checked;
      return event;
    };

    const originalEditAutomation=window.editAutomation;
    window.editAutomation=function patchedEditAutomation(id){
      const result=originalEditAutomation(id);
      Promise.resolve().then(async()=>{
        try{
          const response=await fetch("/api/v1/automations",{cache:"no-store",credentials:"same-origin"});
          if(!response.ok)return;
          const payload=await response.json();
          const event=(payload.events||[]).find(item=>item.id===id);
          const checkbox=document.getElementById("autoUseClassTargets");
          if(event&&checkbox)checkbox.checked=event.useClassTargets!==false;
        }catch{}
      });
      return result;
    };
    window.RoomGoblinAutomationMigration={normalizeEvent:normalizeEventForEditor};
  }
  install();
})();
