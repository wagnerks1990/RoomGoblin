"use strict";
// Hold only the synthetic computer's TCP probe. No workstation is contacted;
// inventory, stable identity persistence and lifecycle owners remain real.
const fs=require("node:fs"),path=require("node:path"),net=require("node:net");
const ip="192.168.50.254",dir=process.env.DATA_DIR;
fs.writeFileSync(path.join(dir,"veyon-computers.json"),JSON.stringify({version:2,computers:{[ip]:{id:ip,ip,name:"Lifecycle fixture",hostname:"lifecycle-fixture",role:"student"}}}));
const connect=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(port,host,...args){
  if(port!==11100||host!==ip)return connect.call(this,port,host,...args);
  this.setTimeout(0);
  fs.writeFileSync(path.join(dir,"probe-entered"),"");
  const timer=setInterval(()=>{
    if(!fs.existsSync(path.join(dir,"release-probe")))return;
    clearInterval(timer);this.emit("connect");
  },10);
  this.once("close",()=>clearInterval(timer));
  return this;
};
