"use strict";

const express=require("express");
const http=require("http");
const path=require("path");
const {ClassroomHubStorage}=require("./storage");
const {CloudflareManager}=require("./cloudflare");

let routesRegistered=false,storeInstance=null;
function storage(){
  if(storeInstance)return storeInstance;
  const dataDir=path.resolve(process.env.DATA_DIR||path.join(__dirname,"..","data"));
  storeInstance=new ClassroomHubStorage({dataDir,dbFile:String(process.env.DATABASE_FILE||path.join(dataDir,"classroom-control-hub.db")),masterKeyFile:String(process.env.MASTER_KEY_FILE||"/run/secrets/classroom-control-hub-master-key")});
  return storeInstance;
}
function maintenanceRequest(method,pathName,body=null,timeoutMs=180000){
  const port=Number(process.env.MAINTENANCE_PORT||3010),token=String(process.env.MAINTENANCE_TOKEN||"");
  if(!token)return Promise.reject(Error("Maintenance service credential is unavailable"));
  return new Promise((resolve,reject)=>{
    const raw=body==null?null:Buffer.from(JSON.stringify(body));
    const req=http.request({host:"127.0.0.1",port,path:pathName,method,headers:{"x-maintenance-token":token,...(raw?{"content-type":"application/json","content-length":raw.length}:{})}},res=>{
      const chunks=[];res.on("data",c=>chunks.push(c));res.on("end",()=>{const text=Buffer.concat(chunks).toString("utf8");let value;try{value=JSON.parse(text||"{}")}catch{value={error:text}}if((res.statusCode||500)>=400||value.ok===false){const e=Error(value.error||`Maintenance HTTP ${res.statusCode}`);e.status=res.statusCode;return reject(e)}resolve(value)})});
    req.on("error",reject);req.setTimeout(timeoutMs,()=>req.destroy(Error("Cloudflare host provisioning timed out")));if(raw)req.write(raw);req.end();
  });
}
function manager(){return new CloudflareManager({storage:storage(),connectorInstaller:token=>maintenanceRequest("POST","/cloudflare/configure",{token},240000)})}
function route(fn){return async(req,res)=>{try{res.json(await fn(req))}catch(error){res.status(error.status||500).json({ok:false,error:error.message})}}}

const nativeGet=express.application.get,nativePut=express.application.put,nativePost=express.application.post,nativeDelete=express.application.delete;
function register(app,requireAdmin){
  if(routesRegistered||typeof requireAdmin!=="function")return;routesRegistered=true;
  nativeGet.call(app,"/api/v1/admin/cloudflare",requireAdmin,route(()=>manager().liveStatus()));
  nativePut.call(app,"/api/v1/admin/cloudflare",requireAdmin,route(req=>({ok:true,settings:manager().save(req.body||{})})));
  nativePost.call(app,"/api/v1/admin/cloudflare/validate",requireAdmin,route(req=>{const m=manager();if(req.body&&Object.keys(req.body).length)m.save(req.body);return m.validate()}));
  nativePost.call(app,"/api/v1/admin/cloudflare/provision",requireAdmin,route(req=>manager().provision(req.body||{})));
  nativePost.call(app,"/api/v1/admin/cloudflare/restart",requireAdmin,route(()=>maintenanceRequest("POST","/cloudflare/restart",{confirm:"RESTART_ROOMGOBLIN_FOR_CLOUDFLARE"},30000)));
  nativeDelete.call(app,"/api/v1/admin/cloudflare/credentials",requireAdmin,route(()=>{
    const s=storage();s.tx(()=>{s.deleteSecret("integration.cloudflare.api-token");s.deleteSecret("integration.cloudflare.global-key")});
    return {ok:true,settings:manager().status()};
  }));
}
express.application.get=function(routeName,...handlers){
  if(routeName==="/api/v1/admin/config"&&handlers.length)register(this,handlers[0]);
  return nativeGet.call(this,routeName,...handlers);
};
module.exports={manager,maintenanceRequest};
