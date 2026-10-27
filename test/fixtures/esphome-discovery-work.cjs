"use strict";
// Keep the real manager, route, audit and SQLite ownership. Only its external
// mDNS worker is replaced with a test-owned IPC stream; no network scan occurs.
const fs=require("node:fs"),path=require("node:path");
const {EventEmitter}=require("node:events"),{PassThrough}=require("node:stream");
const esphome=require("../../src/esphome"),Original=esphome.ESPHomeManager;
esphome.ESPHomeManager=class extends Original{
  constructor(options){super({...options,spawnProcess:(_command,args)=>{
    if(path.basename(args[1])!=="discovery.py")throw Error("Unexpected fixture worker");
    console.log("fixture-esphome-discovery-started");
    const child=new EventEmitter();child.stdout=new PassThrough();let timer,done=false;
    child.kill=()=>{if(done)return false;done=true;clearTimeout(timer);child.stdout.destroy();child.emit("exit",null,"SIGKILL");return true};
    const finish=()=>{
      if(done)return;
      if(!fs.existsSync(path.join(process.env.DATA_DIR,"release-discovery"))){timer=setTimeout(finish,10);return}
      done=true;child.stdout.end(JSON.stringify({devices:[]}));child.emit("exit",0,null);
    };
    setImmediate(finish);return child;
  }})}
};
