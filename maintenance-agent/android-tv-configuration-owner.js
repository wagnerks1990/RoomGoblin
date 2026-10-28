'use strict';

const {normalizeDevice}=require('./android-tv-lib');
const pending=new Map();
const configurationFields=['host','port','serial','androidId','agentPackage','displayUrl','agentV2','persistentAdb'];

function busy(){const error=Error('Android configuration is already pending for this display. Wait for it to finish before changing its connection or agent settings.');error.status=409;error.code='android_configuration_pending';return error}
async function withConfiguration(id,work,lease){
  id=String(id);
  if(lease!==undefined){if(pending.get(id)!==lease)throw busy();return work(lease)}
  if(pending.has(id))throw busy();
  const owner={};pending.set(id,owner);
  try{return await work(owner)}finally{if(pending.get(id)===owner)pending.delete(id)}
}
function assertConfigurationEditable(current,next){
  if(!pending.has(String(current.id)))return;
  const proposed=normalizeDevice(next);
  if(configurationFields.some(field=>JSON.stringify(proposed[field])!==JSON.stringify(current[field])))throw busy();
}

module.exports={withConfiguration,assertConfigurationEditable};
