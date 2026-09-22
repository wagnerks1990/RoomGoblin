"use strict";

const AUTOMATION_SCHEMA_VERSION=3;
const ACTION_EXECUTION_MODES=new Set(["once","repeat","loop"]);
const PRIMARY_REPEAT_TAIL_SUFFIX=".__primary-repeat-tail";

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
function normalizeExecutionMode(_action,value,payload={}){
  let mode=String(value||"").toLowerCase();
  if(!mode&&String(_action)==="display.media"&&payload?.loop===true)mode="loop";
  if(!ACTION_EXECUTION_MODES.has(mode))mode="once";
  return mode;
}
function normalizeAutomationAction(input={},index=0,{primaryTargets=[]}={}){
  const action=String(input.action||"display.clear").trim()||"display.clear";
  const payload=input.payload&&typeof input.payload==="object"&&!Array.isArray(input.payload)?{...input.payload}:{};
  const executionMode=normalizeExecutionMode(action,input.executionMode,payload);
  const useEventTargets=input.useEventTargets!==false;
  // Media loop remains receiver-native while the action is active. Schema v3
  // additionally uses executionMode=loop to keep the action eligible on every
  // pass through the ordered automation sequence.
  if(action==="display.media")payload.loop=executionMode==="loop";
  return {
    id:actionId(input.id,index),
    action,
    targets:cleanTargets(input.targets),
    useEventTargets,
    payload,
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
  const payload=event.payload||{};
  return normalizeAutomationAction({
    id:event.primaryActionId||"action-1",
    action:event.action||"display.clear",
    targets:cleanTargets(event.targets),
    useEventTargets:false,
    payload,
    delaySeconds:event.primaryDelaySeconds||0,
    executionMode:event.executionMode||event.primaryExecutionMode||(event.action==="display.media"&&payload.loop?"loop":"once"),
    repeatCount:event.repeatCount||event.primaryRepeatCount||1,
    repeatDelaySeconds:event.repeatDelaySeconds||event.primaryRepeatDelaySeconds||0,
    continueOnError:event.continueOnError!==false
  },0,{primaryTargets:cleanTargets(event.targets)});
}
function legacyAdditionalActions(event={}){
  const rows=Array.isArray(event.actions)?event.actions:[];
  return rows.filter(x=>!String(x?.id||"").endsWith(PRIMARY_REPEAT_TAIL_SUFFIX));
}
function automationActionSequence(event={}){
  if(Array.isArray(event.actionSequence)&&event.actionSequence.length){
    return event.actionSequence.map((x,i)=>stripInternalAction(normalizeAutomationAction(x,i,{primaryTargets:event.targets||[]})));
  }
  return [legacyPrimaryAction(event),...legacyAdditionalActions(event).map((x,i)=>normalizeAutomationAction(x,i+1,{primaryTargets:event.targets||[]}))]
    .map(stripInternalAction);
}
function actionPassLimit(action={}){
  const mode=normalizeExecutionMode(action.action,action.executionMode,action.payload||{});
  if(mode==="loop")return Infinity;
  if(mode==="repeat")return Math.max(1,Math.min(100,Math.round(Number(action.repeatCount)||2)));
  return 1;
}
function actionDrivesAnotherPass(action={},nextPass=2){
  if(!actionEligibleOnPass(action,nextPass))return false;
  const mode=normalizeExecutionMode(action.action,action.executionMode,action.payload||{});
  // A receiver-native media loop keeps playing after its first dispatch and
  // therefore must not create sequence passes by itself. It still participates
  // in later passes when another repeat/loop action drives the sequence.
  return !(mode==="loop"&&String(action.action)==="display.media");
}
function sequenceNeedsAnotherPass(sequence=[],nextPass=2){
  return sequence.some(action=>actionDrivesAnotherPass(action,nextPass));
}
function actionEligibleOnPass(action={},pass=1){
  const n=Math.max(1,Math.trunc(Number(pass)||1));
  return n<=actionPassLimit(action);
}
function sequenceHasEligibleActions(sequence=[],pass=1){
  return sequence.some(action=>actionEligibleOnPass(action,pass));
}
function sequenceHasContinuousActions(sequence=[]){
  return sequence.some(action=>normalizeExecutionMode(action.action,action.executionMode,action.payload||{})==="loop");
}
function mirrorLegacyPrimary(event,sequence){
  const first=sequence[0]||normalizeAutomationAction({},0);
  const payload={...(first.payload||{})};
  if(first.action==="display.media")payload.loop=first.executionMode==="loop";
  return {
    ...event,
    action:first.action,
    targets:cleanTargets(first.targets.length?first.targets:event.targets),
    payload,
    // Legacy fields remain mirrors only. The runtime must execute actionSequence.
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
  const canonical=sequence.map((x,i)=>stripInternalAction(normalizeAutomationAction(x,i,{primaryTargets:event.targets||[]})));
  return normalizeAutomationEvent({...event,automationSchemaVersion:AUTOMATION_SCHEMA_VERSION,actionSequence:canonical});
}

module.exports={
  AUTOMATION_SCHEMA_VERSION,
  PRIMARY_REPEAT_TAIL_SUFFIX,
  normalizeExecutionMode,
  normalizeAutomationAction,
  automationActionSequence,
  actionPassLimit,
  actionEligibleOnPass,
  sequenceHasEligibleActions,
  actionDrivesAnotherPass,
  sequenceNeedsAnotherPass,
  sequenceHasContinuousActions,
  normalizeAutomationEvent,
  migrateAutomationStore,
  eventFromActionSequence
};
