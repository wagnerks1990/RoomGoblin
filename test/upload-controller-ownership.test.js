"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function fixture(kind){
 const events={},nodes={},uploads=[],cancels=[],results=[];const node=id=>nodes[id]||=( {style:{display:""},textContent:"",value:"selected",files:[],addEventListener:(event,fn)=>events[id+":"+event]=fn});
 const input=node(kind==="app"?"mediaFile":"upload"),status=node(kind==="app"?"uploadState":"uploadStatus"),pause=node(kind==="app"?"mediaUploadPause":"uploadPause"),cancel=node(kind==="app"?"mediaUploadCancel":"uploadCancel");
 const ctx=vm.createContext({AbortController,window:{},el:node,mediaFile:input,uploadState:status,mediaUploadPause:pause,mediaUploadCancel:cancel,mediaUploadForm:node("form"),fmtBytes:String,loadMedia:async()=>{},setResultSummary:(...args)=>results.push(args),
 RoomGoblinUpload:{upload:(file,options)=>new Promise((resolve,reject)=>uploads.push({file,options,resolve,reject})),cancel:file=>new Promise((resolve,reject)=>cancels.push({file,resolve,reject}))}});
 const source=fs.readFileSync(path.join(__dirname,kind==="app"?"../public/controller/app.js":"../public/controller/display.html"),"utf8").replace(/\r\n/g,"\n"),a=source.indexOf("let mediaUploadAbort="),b=source.indexOf(kind==="app"?"\n// Displays & AV":"\nconst dz=el(",a);assert.ok(a>0&&b>a);
 vm.runInContext(source.slice(a,b),ctx);
 return{ctx,nodes,input,status,pause,cancel,uploads,cancels,results,run(file){input.files=[file];return kind==="app"?ctx.runMediaUpload():ctx.uploadFile(file)},cancelNow:()=>kind==="app"?events["mediaUploadCancel:click"]():ctx.window.cancelMediaUpload(),pauseNow:()=>kind==="app"?events["mediaUploadPause:click"]():ctx.window.pauseMediaUpload()};
}
const uploaded=name=>({file:{originalName:name,url:"/media/"+name}});
for(const kind of ["app","display"]){
 test(kind+": failed cancel remains visible after the old upload rejects",async()=>{
  const h=fixture(kind),p=h.run({name:"old.pdf"}),c=h.cancelNow();assert.equal(h.uploads[0].options.signal.aborted,true);h.cancels[0].reject(Error("temporarily unavailable"));await c;
  assert.match(h.status.textContent,/Cancel failed: temporarily unavailable/);assert.equal(h.cancel.style.display,"");h.uploads[0].reject(Object.assign(Error("paused"),{name:"AbortError"}));await p;assert.match(h.status.textContent,/Cancel failed/);
 });
 test(kind+": old completion cannot overwrite the successor or release its abort owner",async()=>{
  const h=fixture(kind),old={name:"old.pdf"},current={name:"current.pdf"},a=h.run(old),b=h.run(current);assert.equal(h.uploads[0].options.signal.aborted,true);
  h.uploads[1].options.onProgress({percent:50,uploaded:4,total:8});h.uploads[0].options.onProgress({percent:90,uploaded:7,total:8});assert.match(h.status.textContent,/50%/);
  h.uploads[0].resolve(uploaded("old.pdf"));await a;assert.match(h.status.textContent,/50%/);assert.equal(h.pause.style.display,"");h.pauseNow();assert.equal(h.uploads[1].options.signal.aborted,true);h.uploads[1].resolve(uploaded("current.pdf"));await b;assert.doesNotMatch(h.status.textContent,/old/);
 });
 test(kind+": old errors cannot replace successor progress",async()=>{
  const h=fixture(kind),a=h.run({name:"old.pdf"}),b=h.run({name:"current.pdf"});h.uploads[1].options.onProgress({percent:33,uploaded:3,total:8});h.uploads[0].reject(Error("old failure"));await a;assert.match(h.status.textContent,/33%/);h.uploads[1].resolve(uploaded("current.pdf"));await b;
 });
 test(kind+": Cancel targets the active upload after another file is selected",async()=>{
  const h=fixture(kind),active={name:"active.pdf"},chosen={name:"chosen.pdf"},p=h.run(active);h.input.files=[chosen];const c=h.cancelNow();assert.equal(h.cancels[0].file,active);h.cancels[0].resolve();await c;h.uploads[0].reject(Object.assign(Error("paused"),{name:"AbortError"}));await p;assert.equal(h.input.files[0],chosen);assert.equal(h.status.textContent,"Upload cancelled");assert.equal(h.cancel.style.display,"none");
 });
 test(kind+": late cancel success cannot hide or overwrite a newer upload",async()=>{
  const h=fixture(kind),a=h.run({name:"old.pdf"}),c=h.cancelNow(),b=h.run({name:"current.pdf"});h.uploads[1].options.onProgress({percent:61,uploaded:5,total:8});h.cancels[0].resolve();await c;assert.match(h.status.textContent,/61%/);assert.equal(h.cancel.style.display,"");h.uploads[0].reject(Object.assign(Error("paused"),{name:"AbortError"}));await a;h.uploads[1].resolve(uploaded("current.pdf"));await b;
 });
 test(kind+": late cancel failure cannot replace current upload status",async()=>{
  const h=fixture(kind),a=h.run({name:"old.pdf"}),c=h.cancelNow(),b=h.run({name:"current.pdf"});h.uploads[1].options.onProgress({percent:72,uploaded:6,total:8});h.cancels[0].reject(Error("old cancel failure"));await c;assert.match(h.status.textContent,/72%/);h.uploads[0].resolve(uploaded("old.pdf"));await a;h.uploads[1].resolve(uploaded("current.pdf"));await b;
 });
}
