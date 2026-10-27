"use strict";
// Real authentication/connection ownership, with only the external WebAPI
// transport controlled. The synthetic computer is never contacted.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),{setTimeout:delay}=require("node:timers/promises");
const dir=process.env.DATA_DIR,ip="192.168.50.253",key=path.join(dir,"fixture-veyon.key");
fs.writeFileSync(key,crypto.generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}}).privateKey,{mode:0o600});
process.env.VEYON_PRIVATE_KEY_FILE=key;
fs.writeFileSync(path.join(dir,"veyon-computers.json"),JSON.stringify({version:2,computers:{[ip]:{id:ip,ip,name:"Cleanup fixture",hostname:"cleanup-fixture",role:"student"}}}));
const now=Date.now;Date.now=()=>now()+(fs.existsSync(path.join(dir,"age-veyon"))?60000:0);
const original=global.fetch;
global.fetch=async(url,options={})=>{
  const target=new URL(String(url));
  if(target.origin!=="http://127.0.0.1:11080")return original(url,options);
  const auth=target.pathname===`/api/v1/authentication/${ip}`;
  if(auth&&options.method==="POST")return Response.json({"connection-uid":"fixture-only-uid",validUntil:Math.floor(now()/1000)+300});
  if(auth&&options.method==="DELETE"){
    fs.writeFileSync(path.join(dir,"veyon-close-entered"),"");
    while(!fs.existsSync(path.join(dir,"release-veyon-close")))await delay(10);
    return Response.json({ok:true});
  }
  if(target.pathname==="/api/v1/feature")return Response.json({features:[]});
  return new Response("fixture route unavailable",{status:404});
};
