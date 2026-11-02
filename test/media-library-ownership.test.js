"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
const code=block("function commitMediaLibraryRecord(","\nlet classroomAutomations=")+block("async function registerUploadedMedia(","\nconst storage = multer.diskStorage")+block("function libraryRecordFromDisk(","\nfunction listMediaLibrary(")+block('app.post("/api/v1/media",','\napp.post("/api/v1/media/uploads",')+block('app.post("/api/v1/media/:name/convert"','\napp.post("/api/v1/media/:name/display"');
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function fixture(t,{prior=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-media-owner-"));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const rec={storedName:"lesson.docx",originalName:"lesson.docx",generatedPdf:prior?"lesson.display.pdf":null,conversionStatus:prior?"ready":null};fs.writeFileSync(path.join(root,"lesson.docx"),"document");if(prior)fs.writeFileSync(path.join(root,"lesson.display.pdf"),"previous");
 const h={root,routes:{},persist:()=>{},retire:()=>{},audits:[],conversions:0,persisted:{files:{"lesson.docx":rec}}};
 h.convert=async name=>{const pdf=path.basename(name,path.extname(name))+".display.pdf";fs.writeFileSync(path.join(root,pdf),"converted");return pdf};
 h.ctx=vm.createContext({app:{post:(url,...args)=>h.routes[url]=args.at(-1),delete:(url,...args)=>h.routes[url]=args.at(-1)},upload:{single:()=>()=>{}},inspectUpload:()=>{},mediaUploadCompletionLimit:()=>{},mediaLibraryMutationLimit:()=>{},requireCapability:()=>()=>{},MEDIA_DIR:root,MEDIA_LIBRARY_FILE:"library.json",path,fs,mediaLibrary:structuredClone(h.persisted),
 safeStoredName:name=>path.basename(String(name)),classifyMedia:name=>name.endsWith(".docx")?"document":"pdf",officeConvertible:name=>name.endsWith(".docx"),contentFile:()=>{},mediaUrl:name=>"/media/"+name,audit:e=>h.audits.push(e),
 persistJson:(_file,next)=>{h.persist(next);h.persisted=JSON.parse(JSON.stringify(next))},convertOfficeToPdf:async name=>{h.conversions++;return h.convert(name)},resumableUploads:{retire:(...args)=>h.retire(...args)}});
 vm.runInContext(code,h.ctx);
 h.call=async(kind,name="lesson.docx")=>{const r={status:200},res={status(v){r.status=v;return res},json(body){r.body=body;return res}};await h.routes["/api/v1/media/:name"+(kind==="convert"?"/convert":"")]({params:{name}},res);return r};
 h.multipart=async()=>h.routes["/api/v1/media"]({file:{filename:"upload.docx",originalname:"upload.docx",mimetype:"document",size:8,path:path.join(root,"upload.docx")}},{status(){return this},json(){return this}});
 h.hold=()=>{const entered=gate(),release=gate();h.convert=async name=>{entered.resolve();await release.promise;const pdf=path.basename(name,path.extname(name))+".display.pdf";fs.writeFileSync(path.join(root,pdf),"converted");return pdf};return{entered,release}};
 return h;
}
test("delete waits for accepted conversion and removes its late generated PDF",async t=>{
 const h=fixture(t),g=h.hold(),convert=h.call("convert");await g.entered.promise;let finished=false;const remove=h.call("delete").then(r=>{finished=true;return r});
 try{assert.equal(finished,false);assert.equal(fs.existsSync(path.join(h.root,"lesson.docx")),true)}finally{g.release.resolve()}
 assert.equal((await convert).status,200);assert.equal((await remove).status,200);assert.deepEqual(fs.readdirSync(h.root),[]);assert.deepEqual(Object.keys(h.ctx.mediaLibrary.files),[]);
});
test("failed conversion cannot resurrect metadata after queued deletion",async t=>{
 const h=fixture(t),g=h.hold(),convert=h.call("convert");await g.entered.promise;const remove=h.call("delete");g.release.reject(Error("converter failed"));assert.equal((await convert).status,500);assert.equal((await remove).status,200);assert.deepEqual(Object.keys(h.ctx.mediaLibrary.files),[]);assert.deepEqual(fs.readdirSync(h.root),[]);
});
test("two conversions of one file never overlap",async t=>{
 const h=fixture(t),g=h.hold(),first=h.call("convert");await g.entered.promise;const second=h.call("convert");assert.equal(h.conversions,1);g.release.resolve();assert.equal((await first).status,200);assert.equal((await second).status,200);assert.equal(h.conversions,2);assert.equal(h.ctx.mediaLibrary.files["lesson.docx"].conversionStatus,"ready");
});
test("unrelated media deletion can finish while a document converts",async t=>{
 const h=fixture(t),g=h.hold();fs.writeFileSync(path.join(h.root,"other.pdf"),"other");h.ctx.mediaLibrary.files["other.pdf"]={storedName:"other.pdf"};
 const converting=h.call("convert");await g.entered.promise;
 try{assert.equal((await h.call("delete","other.pdf")).status,200);assert.equal(fs.existsSync(path.join(h.root,"other.pdf")),false)}finally{g.release.resolve();await converting}
});
test("upload registration and manual deletion share the conversion owner",async t=>{
 const h=fixture(t),g=h.hold(),register=h.ctx.registerUploadedMedia({stored:"lesson.docx",originalName:"lesson.docx",mime:"document",size:8});await g.entered.promise;
 const remove=h.call("delete");g.release.resolve();assert.equal((await register).storedName,"lesson.docx");assert.equal((await remove).status,200);assert.deepEqual(fs.readdirSync(h.root),[]);
});
test("a failed converter preserves the previous PDF and reports the failure",async t=>{
 const h=fixture(t,{prior:true});h.convert=async()=>{throw Error("converter unavailable")};const result=await h.call("convert");assert.equal(result.status,500);assert.match(result.body.error,/converter unavailable/);assert.equal(fs.readFileSync(path.join(h.root,"lesson.display.pdf"),"utf8"),"previous");const rec=h.ctx.mediaLibrary.files["lesson.docx"];assert.equal(rec.generatedPdf,"lesson.display.pdf");assert.equal(rec.conversionStatus,"ready");assert.match(rec.conversionError,/converter unavailable/);
});
test("failed initial conversion persistence does not change cache or run the converter",async t=>{
 const h=fixture(t);h.persist=()=>{throw Error("database unavailable")};const result=await h.call("convert");assert.equal(result.status,500);assert.equal(h.conversions,0);assert.equal(h.ctx.mediaLibrary.files["lesson.docx"].conversionStatus,null);assert.equal(h.persisted.files["lesson.docx"].conversionStatus,null);
});
test("failed final persistence is visible and does not publish uncommitted ready state",async t=>{
 const h=fixture(t);let writes=0;h.persist=()=>{if(++writes===2)throw Error("final save unavailable")};assert.equal((await h.call("convert")).status,500);assert.equal(h.ctx.mediaLibrary.files["lesson.docx"].conversionStatus,"converting");h.persist=()=>{};assert.equal((await h.call("convert")).status,200);assert.equal(h.ctx.mediaLibrary.files["lesson.docx"].conversionStatus,"ready");
});
test("conversion completion merges its record into the latest library",async t=>{
 const h=fixture(t),g=h.hold(),convert=h.call("convert");await g.entered.promise;
 h.ctx.commitMediaLibraryRecord("other.pdf",{storedName:"other.pdf",originalName:"later"});g.release.resolve();await convert;assert.equal(h.ctx.mediaLibrary.files["other.pdf"].originalName,"later");assert.equal(h.persisted.files["other.pdf"].originalName,"later");
});
test("deletion persistence failure remains visible and does not publish a cache deletion",async t=>{
 const h=fixture(t);h.persist=()=>{throw Error("delete save unavailable")};const result=await h.call("delete");assert.equal(result.status,400);assert.match(result.body.error,/delete save unavailable/);assert.ok(h.ctx.mediaLibrary.files["lesson.docx"]);assert.ok(h.persisted.files["lesson.docx"]);h.persist=()=>{};assert.equal((await h.call("delete")).status,200);assert.equal(h.ctx.mediaLibrary.files["lesson.docx"],undefined);
});
test("upload retirement failure prevents deletion of both source and generated PDF",async t=>{
 const h=fixture(t,{prior:true});Object.assign(h.ctx.mediaLibrary.files["lesson.docx"],{uploadSessionId:"fixture",uploadDigest:"digest"});h.retire=(id,name,digest)=>{assert.equal(id,"fixture");assert.equal(name,"lesson.docx");assert.equal(digest,"digest");throw Error("retirement unavailable")};
 const result=await h.call("delete");assert.equal(result.status,400);assert.equal(fs.existsSync(path.join(h.root,"lesson.docx")),true);assert.equal(fs.readFileSync(path.join(h.root,"lesson.display.pdf"),"utf8"),"previous");assert.ok(h.ctx.mediaLibrary.files["lesson.docx"]);
});
test("an owner rejection releases the queue and removes its last promise",async t=>{
 const h=fixture(t);await assert.rejects(h.ctx.withMediaFileWrite("lesson.docx",()=>{throw Error("fixture rejection")}),/fixture rejection/);assert.equal(await h.ctx.withMediaFileWrite("lesson.docx",()=>42),42);assert.equal(vm.runInContext("mediaFileWrites.size",h.ctx),0);
});
test("multipart registration failure removes only its unregistered file",async t=>{
 const h=fixture(t);fs.writeFileSync(path.join(h.root,"upload.docx"),"uploaded");h.persist=()=>{throw Error("registration unavailable")};await assert.rejects(h.multipart(),/registration unavailable/);assert.equal(fs.existsSync(path.join(h.root,"upload.docx")),false);assert.equal(fs.existsSync(path.join(h.root,"lesson.docx")),true);
});
test("multipart upload preserves its committed file after later conversion persistence fails",async t=>{
 const h=fixture(t);fs.writeFileSync(path.join(h.root,"upload.docx"),"uploaded");let writes=0;h.persist=()=>{if(++writes===2)throw Error("conversion save unavailable")};await assert.rejects(h.multipart(),/conversion save unavailable/);assert.equal(fs.readFileSync(path.join(h.root,"upload.docx"),"utf8"),"uploaded");assert.ok(h.persisted.files["upload.docx"]);assert.equal(h.ctx.mediaLibrary.files["upload.docx"].conversionStatus,null);
});
