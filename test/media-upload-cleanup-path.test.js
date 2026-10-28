"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
test("multipart failure cleanup uses the validated stored name under the media root",async()=>{
 const removed=[],owned=[];let handler;
 const ctx=vm.createContext({app:{post:(_url,...handlers)=>handler=handlers.at(-1)},requireCapability:()=>()=>{},upload:{single:()=>()=>{}},mediaUploadCompletionLimit:()=>{},MEDIA_DIR:"/controlled/media",path,mediaLibrary:{files:{}},
 fs:{rmSync:(file,options)=>removed.push({file,options})},inspectUpload:()=>{throw Error("invalid upload")},withMediaFileWrite:async(name,fn)=>{owned.push(name);return fn()}});
 const safeStart=source.indexOf("function safeStoredName("),safeEnd=source.indexOf("\nfunction mediaUrl(",safeStart);assert.ok(safeStart>0&&safeEnd>safeStart);vm.runInContext(source.slice(safeStart,safeEnd),ctx);
 const start=source.indexOf('app.post("/api/v1/media",'),end=source.indexOf('\napp.post("/api/v1/media/uploads",',start);assert.ok(start>0&&end>start);vm.runInContext(source.slice(start,end),ctx);
 await assert.rejects(handler({file:{filename:"upload.pdf",path:"/outside/keep.pdf",originalname:"upload.pdf"}},{}),/invalid upload/);
 assert.deepEqual(owned,["upload.pdf"]);assert.equal(removed.length,1);assert.equal(removed[0].file,path.join("/controlled/media","upload.pdf"));assert.equal(removed[0].options.force,true);
 removed.length=0;await assert.rejects(handler({file:{filename:"../keep.pdf",path:"/outside/keep.pdf"}},{}),/invalid upload/);assert.equal(removed[0].file,path.join("/controlled/media","keep.pdf"));
 removed.length=0;await assert.rejects(handler({file:{filename:"..",path:"/outside/keep.pdf"}},{}),/Invalid file name/);assert.equal(removed.length,0);
});
