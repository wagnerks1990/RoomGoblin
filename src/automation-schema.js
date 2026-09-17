"use strict";

const AUTOMATION_SCHEMA_VERSION=2;
const ACTION_EXECUTION_MODES=new Set(["once","repeat","loop"]);

function cleanTargets(value){
  return [...new Set((Array.isArray(value)?value:[]).map(x=>String(x||"").trim()).filter(Boolean))];
}
function finite(value,fallback,min,max){
  const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
}
function actionId(value,index=0){
  const cleaned=String(value||"").trim().replace(/[^a-zA-Z0-9._-]/g,"-").slice(0,100);
  return cleaned||`action-${index+1}`;
}
function normalizeExecutionMode(action,value){
  let mode=String(value||"once").toLowerCase();
  if(!ACTION_EXECUTION_MODES.has(mode))mode="once";
  // Unbounded command generators are never permitted for side-effecting actions.
  if(mode==="loop"&&String(action)!=="display.media")mode="repeat";
  return mode;
}
function normalizeAutomationAction(input={},index=0,{primaryTargets=[]}={}){
  const action=String(input.action||"display.clear").trim()||"display.clear";
  const executionMode=normalizeExecutionMode(action,input.executionMode);
  const useEventTargets=input.useEventTargets!==false;
  return {
    id:actionId(input.id,index),
    action,
    targets:cleanTargets(input.targets),
    useEventTargets,
    payload:input.payload&&typeof input.payload==="object"&&!Array.isArray(input.payload)?{...input.payload}:{},
    delaySeconds:finite(input.delaySeconds,0,0,3600),
    executionMode,
    repeatCount:Math.round(finite(input.repeatCount,executionMode==="repeat"?2:1,1,100)),
    repeatDelaySeconds:finite(input.repeatDelaySeconds,0,0,3600),
    continueOnError:input.continueOnError!==false,
    ...(input.targetMode?{targetMode:String(input.targetMode)}:{}),
    _primaryTargets:primaryTargets
  };
}
function stripInternalAction(action){
  const {_primaryTargets,...publicAction}=action;return publicAction;
}
function legacyPrimaryAction(event={}){
  return normalizeAutomationAction({
    id:event.primaryActionId||"action-1",
    action:event.action||"display.clear",
    targets:cleanTargets(event.targets),
    useEventTargets:false,
    payload:event.payload||{},
    delaySeconds:event.primaryDelaySeconds||0,
    executionMode:event.executionMode||event.primaryExecutionMode||"once",
    repeatCount:event.repeatCount||event.primaryRepeatCount||1,
    repeatDelaySeconds:event.repeatDelaySeconds||event.primaryRepeatDelaySeconds||0,
    continueOnError:event.continueOnError!==false
  },0,{primaryTargets:cleanTargets(event.targets)});
}
function automationActionSequence(event={}){
  // Schema v2 stores every action, including Action 1, in actionSequence.
  if(Array.isArray(event.actionSequence)&&event.actionSequence.length){
    return event.actionSequence.map((x,i)=>stripInternalAction(normalizeAutomationAction(x,i,{primaryTargets:event.targets||[]})));
  }
  // Transitional clients may send actions[] containing the complete sequence.
  if(Number(event.automationSchemaVersion)>=2&&Array.isArray(event.actions)&&event.actions.length){
    return event.actions.map((x,i)=>stripInternalAction(normalizeAutomationAction(x,i,{primaryTargets:event.targets||[]})));
  }
  // Legacy schema: primary fields plus additional actions[].
  return [legacyPrimaryAction(event),...(Array.isArray(event.actions)?event.actions:[]).map((x,i)=>normalizeAutomationAction(x,i+1,{primaryTargets:event.targets||[]}))]
    .map(stripInternalAction);
}
function mirrorLegacyPrimary(event,sequence){
  const first=sequence[0]||normalizeAutomationAction({},0);
  return {
    ...event,
    action:first.action,
    targets:cleanTargets(first.targets.length?first.targets:event.targets),
    payload:{...(first.payload||{})},
    // Keep legacy additional-actions semantics for one compatibility release.
    actions:sequence.slice(1).map(x=>({...x})),
    primaryActionId:first.id,
    primaryDelaySeconds:first.delaySeconds,
    primaryExecutionMode:first.executionMode,
    primaryRepeatCount:first.repeatCount,
    primaryRepeatDelaySeconds:first.repeatDelaySeconds,
    continueOnError:first.continueOnError
  };
}
function normalizeAutomationEvent(event={}){
  const sequence=automationActionSequence(event);
  const normalized=mirrorLegacyPrimary({...event,automationSchemaVersion:AUTOMATION_SCHEMA_VERSION},sequence);
  normalized.actionSequence=sequence.map((x,i)=>stripInternalAction(normalizeAutomationAction(x,i,{primaryTargets:normalized.targets})));
  return normalized;
}
function migrateAutomationStore(store={}){
  const source=store&&typeof store==="object"?store:{};
  const events=Array.isArray(source.events)?source.events:[];
  let changed=Number(source.version)!==AUTOMATION_SCHEMA_VERSION;
  const migrated=events.map(event=>{
    const normalized=normalizeAutomationEvent(event);
    if(!changed&&JSON.stringify(event)!==JSON.stringify(normalized))changed=true;
    return normalized;
  });
  return {changed,store:{...source,version:AUTOMATION_SCHEMA_VERSION,events:migrated},migratedEvents:changed?migrated.length:0};
}
function eventFromActionSequence(event={},sequence=[]){
  return normalizeAutomationEvent({...event,automationSchemaVersion:AUTOMATION_SCHEMA_VERSION,actionSequence:sequence,actions:sequence});
}

module.exports={
  AUTOMATION_SCHEMA_VERSION,
  normalizeAutomationAction,
  automationActionSequence,
  normalizeAutomationEvent,
  migrateAutomationStore,
  eventFromActionSequence
};
