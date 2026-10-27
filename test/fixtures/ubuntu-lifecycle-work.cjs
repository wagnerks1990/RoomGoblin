"use strict";
// Exercise the real scheduled poll, claim, acknowledgment and persistence with
// a controlled transport. No SSH connection or remote command is made.
const fs=require("node:fs"),path=require("node:path"),{setTimeout:delay}=require("node:timers/promises");
const ubuntu=require("../../src/ubuntu-displays"),Original=ubuntu.UbuntuDisplays;
const machineId="b".repeat(64),key="ubuntu-displays.v1";
ubuntu.UbuntuDisplays=class extends Original{
  constructor(options){
    if(options.storage.getPreference(key,null)===null){
      options.storage.setPreference(key,[{id:"fixture",name:"Fixture",address:"10.0.0.8",port:22,fingerprint:"SHA256:"+"a".repeat(43),machineId,state:"ready",config:{screens:[]},scheduled:{id:"scheduled-fixture",operation:"check-updates",at:new Date(Date.now()-1000).toISOString(),state:"scheduled"}}]);
      options.storage.putSecret("ubuntu-display.fixture.ssh","test-only-transport-key",{type:"ubuntu-restricted-ssh"});
    }
    super({...options,transport:async request=>{
      const body=JSON.parse(request.input);
      if(body.action==="status"){console.log("fixture-ubuntu-status");return {identity:"fixture",machineId,protocolVersion:"2",session:{online:true,screens:[]}}}
      if(body.action!=="maintenance"||body.operation!=="check-updates")throw Error("Unexpected fixture operation");
      console.log("fixture-ubuntu-dispatch-started");
      while(!fs.existsSync(path.join(process.env.DATA_DIR,"release-ubuntu")))await delay(10);
      return {accepted:true,job:{id:body.requestId}};
    }});
  }
};
