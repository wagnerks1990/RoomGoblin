"use strict";

const fs=require("node:fs");
const {DatabaseSync}=require("node:sqlite");

// Scheduled Background Music stays dormant until credentials exist. Reopen on
// identity changes so an atomic database restore cannot leave a stale reader.
let integrationReadDb=null,integrationReadDbIdentity=null;
function closeMusicAssistantReadiness(){
  if(integrationReadDb)try{integrationReadDb.close()}catch{}
  integrationReadDb=null;integrationReadDbIdentity=null;
}
function musicAssistantTokenConfigured(){
  const file=String(process.env.DATABASE_FILE||"").trim();
  if(!file){closeMusicAssistantReadiness();return false}
  try{
    const stat=fs.statSync(file),identity=`${file}:${stat.dev}:${stat.ino}`;
    if(integrationReadDb&&integrationReadDbIdentity!==identity)closeMusicAssistantReadiness();
    if(!integrationReadDb){integrationReadDb=new DatabaseSync(file,{readOnly:true});integrationReadDbIdentity=identity}
    return !!integrationReadDb.prepare("SELECT 1 FROM secret_store WHERE name='musicassistant.token' LIMIT 1").get();
  }catch{closeMusicAssistantReadiness();return false}
}

module.exports={musicAssistantTokenConfigured,closeMusicAssistantReadiness};
