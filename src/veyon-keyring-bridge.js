"use strict";

const express=require("express");
const {runtimeVeyonKeyring,normalizeKeyName,validPrivateKey}=require("./veyon-keyring");

let managementRoutesRegistered=false;

function publicKeyring(){
  const value=runtimeVeyonKeyring.metadata();
  return {keyNames:value.keyNames,preferredKeyName:value.preferredKeyName,count:value.count};
}
function addKeyringProjection(body){
  if(!body||typeof body!=="object")return body;
  const meta=publicKeyring();
  if(body.integrationConnections?.veyon){
    body={...body,integrationConnections:{...body.integrationConnections,veyon:{...body.integrationConnections.veyon,keyNames:meta.keyNames,preferredKeyName:meta.preferredKeyName,keyCount:meta.count}}};
  }
  return body;
}
function withKeyringProjection(handler){
  return async function(req,res,next){
    const json=res.json.bind(res);
    res.json=body=>{try{body=addKeyringProjection(body)}catch{}return json(body)};
    return handler(req,res,next);
  };
}
function wrapIntegrationSave(handler){
  return async function(req,res,next){
    // Preserve the currently active compatibility credential before the
    // established integration handler can replace it. This applies to both the
    // administrator route and the maintenance-agent mirror used by setup.
    try{runtimeVeyonKeyring.captureLegacy()}catch{}
    const json=res.json.bind(res);
    res.json=body=>{
      if(body?.ok!==false){
        try{
          const v=req.body?.veyon||{},name=String(v.keyName||"").trim();
          if(v.privateKey)runtimeVeyonKeyring.importKey(name,v.privateKey,{preferred:true});
          else if(name&&runtimeVeyonKeyring.hasKey(name))runtimeVeyonKeyring.setPreferred(name);
        }catch{body={...body,keyringWarning:"Connection settings were applied, but the Veyon keyring could not be updated."}}
      }
      try{body=addKeyringProjection(body)}catch{}
      return json(body);
    };
    return handler(req,res,next);
  };
}

const nativeGet=express.application.get;
const nativePost=express.application.post;
const nativePut=express.application.put;
const nativeDelete=express.application.delete;

function registerManagementRoutes(app,requireAdmin){
  if(managementRoutesRegistered||typeof requireAdmin!=="function")return;
  managementRoutesRegistered=true;
  nativeGet.call(app,"/api/v1/admin/veyon-keys",requireAdmin,(_req,res)=>{
    try{res.json({ok:true,...publicKeyring()})}catch{res.status(500).json({ok:false,error:"Unable to read Veyon keyring metadata"})}
  });
  nativePost.call(app,"/api/v1/admin/veyon-keys",requireAdmin,(req,res)=>{
    try{
      const keyName=runtimeVeyonKeyring.importKey(req.body?.keyName,req.body?.privateKey,{preferred:req.body?.preferred===true});
      res.status(201).json({ok:true,keyName,...publicKeyring()});
    }catch(error){res.status(400).json({ok:false,error:error.message})}
  });
  nativePut.call(app,"/api/v1/admin/veyon-keys/preferred",requireAdmin,(req,res)=>{
    try{runtimeVeyonKeyring.setPreferred(req.body?.keyName);res.json({ok:true,...publicKeyring()})}
    catch(error){res.status(400).json({ok:false,error:error.message})}
  });
  nativeDelete.call(app,"/api/v1/admin/veyon-keys/:keyName",requireAdmin,(req,res)=>{
    try{
      const keyName=normalizeKeyName(req.params.keyName),legacy=runtimeVeyonKeyring.currentLegacy();
      if(keyName===legacy.keyName&&validPrivateKey(legacy.privateKey))return res.status(409).json({ok:false,error:"This is the active compatibility Veyon key. Import or select another default key before removing its keyring copy."});
      runtimeVeyonKeyring.removeKey(keyName);res.json({ok:true,keyName,...publicKeyring()});
    }catch(error){res.status(400).json({ok:false,error:error.message})}
  });
}

express.application.get=function(route,...handlers){
  if(route==="/api/v1/admin/config"&&handlers.length){
    handlers[handlers.length-1]=withKeyringProjection(handlers[handlers.length-1]);
  }
  return nativeGet.call(this,route,...handlers);
};

express.application.put=function(route,...handlers){
  const adminRoute=route==="/api/v1/admin/integration-connections";
  const maintenanceRoute=route==="/api/v1/internal/maintenance/integration-connections";
  if((adminRoute||maintenanceRoute)&&handlers.length){
    if(adminRoute)registerManagementRoutes(this,handlers[0]);
    handlers[handlers.length-1]=wrapIntegrationSave(handlers[handlers.length-1]);
  }
  return nativePut.call(this,route,...handlers);
};

module.exports={publicKeyring,addKeyringProjection,wrapIntegrationSave};
