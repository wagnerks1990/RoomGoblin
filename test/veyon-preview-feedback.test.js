"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
function harness(){
  const source=fs.readFileSync(path.join(root,"public","controller","veyon-preview-feedback.js"),"utf8");
  const retry={hidden:false};
  let status;
  const context=vm.createContext({
    window:{setThumbStatus:(id,text)=>{status={id,text}}},
    document:{querySelector:()=>retry},
    CSS:{escape:value=>value},
    setTimeout,clearTimeout,Error,Number,String,Promise
  });
  vm.runInContext(source,context);
  return {context,retry,status:()=>status};
}

test("command-pressure preview failures are presented as a pause and hide retry",()=>{
  const {context,retry,status}=harness();
  const api=context.window.RoomGoblinVeyonPreviewFeedback;
  const message=api.normalizeMessage("Preview paused while classroom commands are being sent. (Screen capture · HTTP 503)");
  assert.equal(message,"Preview paused for classroom command.");
  context.window.setThumbStatus("fixture",message);
  assert.deepEqual(status(),{id:"fixture",text:"Preview paused for classroom command."});
  assert.equal(retry.hidden,true);
});

test("only command-pressure 503 responses get fast transparent retry treatment",()=>{
  const {context}=harness(),api=context.window.RoomGoblinVeyonPreviewFeedback;
  const response={status:503,headers:{get:name=>name==="Retry-After"?"1":null}};
  assert.equal(api.commandPressure(response,{reason:"commands-pending"}),true);
  assert.equal(api.commandPressure(response,{reason:"framebuffer-unavailable"}),false);
  assert.equal(api.commandPressure({status:401},{reason:"commands-pending"}),false);
  assert.equal(api.retryDelay(response),1000);
  assert.equal(api.retryDelay({status:503,headers:{get:()=>"20"}}),1500);
});

test("ordinary Veyon preview failures retain their diagnostic text",()=>{
  const {context}=harness();
  assert.equal(context.window.RoomGoblinVeyonPreviewFeedback.normalizeMessage("Veyon authentication failed (Authentication · Veyon 6 · HTTP 401)"),"Veyon authentication failed (Authentication · Veyon 6 · HTTP 401)");
});

test("MorningStream installation evidence stays in diagnostics without console spam",()=>{
  const source=fs.readFileSync(path.join(root,"public","shared","attribution.js"),"utf8");
  assert.match(source,/function record\(kind,detail=\{\},quiet=false\)/);
  assert.match(source,/record\("websocket-command-filter-installed",\{\},true\)/);
});

test("Veyon workspace loads preview feedback after the main Veyon script",()=>{
  const html=fs.readFileSync(path.join(root,"public","controller","veyon.html"),"utf8");
  assert.ok(html.indexOf('/controller/veyon.js')<html.indexOf('/controller/veyon-preview-feedback.js'));
});
