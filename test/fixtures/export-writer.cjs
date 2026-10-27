"use strict";
// Register after the real request-admission middleware, while retaining the
// application's own handler tracking and SQLite instance. No production hook.
const fs=require("node:fs"),path=require("node:path");
const storage=require("../../src/storage"),lifecycle=require("../../src/application-drain");
const Original=storage.ClassroomHubStorage,track=lifecycle.trackApplicationHandlers;
let store;
storage.ClassroomHubStorage=class extends Original{constructor(...args){super(...args);store=this}};
lifecycle.trackApplicationHandlers=(app,options)=>{
  const tracker=track(app,options),post=app.post;
  app.post=function(route,...handlers){
    if(route==="/api/v1/internal/maintenance/export-freeze"){
      post.call(this,"/fixture/export-write",async(req,res)=>{
        console.log("fixture-export-writer-started");
        if(req.query.early==="true")res.end("accepted");
        while(!fs.existsSync(path.join(process.env.DATA_DIR,"release-writer")))await new Promise(resolve=>setTimeout(resolve,10));
        store.setPreference("export.fixture.completed",true);
        if(req.query.reject==="true")throw Error("fixture writer rejection");
        if(!res.writableEnded)res.end("completed");
      });
    }
    return post.call(this,route,...handlers);
  };
  return tracker;
};
