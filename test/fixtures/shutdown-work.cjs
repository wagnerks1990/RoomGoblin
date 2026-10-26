"use strict";
// Test-only preload: hold a real registered handler and write through the exact
// Hub storage instance after the HTTP client has gone away. No production hook.
const storage=require("../../src/storage"),lifecycle=require("../../src/application-drain");
const Original=storage.ClassroomHubStorage,track=lifecycle.trackApplicationHandlers;
let store;
storage.ClassroomHubStorage=class extends Original{constructor(...args){super(...args);store=this}};
if(process.env.SHUTDOWN_MQTT_FIXTURE==="1"){
  const mqtt=require("mqtt"),{EventEmitter}=require("node:events");
  require.cache[require.resolve("mqtt")].exports={...mqtt,connect:()=>{
    const client=new EventEmitter();client.subscribe=()=>{};
    client.publish=(_topic,_payload,_options,callback)=>{console.log("fixture-mqtt-started");setTimeout(()=>callback(),800)};
    client.end=(_force,_options,callback)=>{callback?.()};
    setImmediate(()=>client.emit("connect"));return client;
  }};
}
lifecycle.trackApplicationHandlers=(app,options)=>{
  const tracker=track(app,options);
  app.post("/fixture/pending-write",async(req,res)=>{
    console.log("fixture-writer-started");
    if(req.query.early==="true")res.end("accepted");
    await new Promise(resolve=>setTimeout(resolve,req.query.stuck==="true"?60000:800));
    store.setPreference("shutdown.fixture.completed",true);
    if(!res.writableEnded)res.end("completed");
  });
  return tracker;
};
