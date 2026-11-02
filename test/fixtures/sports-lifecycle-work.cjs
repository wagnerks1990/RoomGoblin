"use strict";
// Keep the real initial refresh timer, service and store; replace only its
// external feed transport. The fixture never performs a network request.
const fs=require("node:fs"),path=require("node:path"),{setTimeout:delay}=require("node:timers/promises");
const storage=require("../../src/storage"),Original=storage.ClassroomHubStorage;
const model=require("../../src/sports");
storage.ClassroomHubStorage=class extends Original{
  constructor(...args){super(...args);if(this.getPreference(model.KEY,null)===null)this.setPreference(model.KEY,model.normalize({
    teams:[{id:"team",name:"Fixture team",sport:"Soccer",sources:[{id:"feed",url:"https://school.example/feed",kind:"json",enabled:true,approved:true}]}]
  }))}
};
require("../../src/sports-fetch").fetchPublic=async()=>{
  console.log("fixture-sports-fetch-started");
  while(!fs.existsSync(path.join(process.env.DATA_DIR,"release-sports")))await delay(10);
  return {body:Buffer.from(JSON.stringify({events:[{id:"match",opponent:"Visitors",startAt:"2026-10-19T20:00:00Z",status:"final",score:1,opponentScore:0}]}))};
};
