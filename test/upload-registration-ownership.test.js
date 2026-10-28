"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),vm=require("node:vm"),{Readable}=require("node:stream");
const {ResumableUploadStore}=require("../src/resumable-upload");
const bytes=Buffer.from("%PDF-1.7"),digest=crypto.createHash("sha256").update(bytes).digest("hex");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n"),a=source.indexOf('app.post("/api/v1/media/uploads/:id/complete"'),b=source.indexOf('\napp.delete("/api/v1/media/uploads/:id"',a);
assert.ok(a>0&&b>a);
function gate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}}
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-upload-register-"));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const media=path.join(root,"media");fs.mkdirSync(media);
 const store=new ResumableUploadStore({root:path.join(root,"sessions"),destinationRoot:media,maxFileBytes:1024,chunkBytes:16,minFreeBytes:0,ttlMs:1000}),meta=store.create({owner:"fixture",name:"lesson.pdf",mime:"application/pdf",size:bytes.length});
 await store.putChunk({id:meta.id,owner:"fixture",index:0,input:Readable.from(bytes),contentLength:bytes.length,digest});
 let route,index=0;const h={root,media,store,meta,register:async args=>({storedName:args.stored,url:"/media/"+args.stored})};
 const ctx=vm.createContext({app:{post:(_url,...args)=>route=args.at(-1)},mediaUploadCompletionLimit:()=>{},requireCapability:()=>()=>{},resumableUploads:store,ownerKey:req=>req.owner||"fixture",mediaStoredName:()=>"fixture-"+(++index)+".pdf",MEDIA_DIR:media,path,fs,registerUploadedMedia:args=>h.register(args)});
 vm.runInContext(source.slice(a,b),ctx);
 h.call=async(overrides={},responseHook)=>{const result={status:200,body:null},res={status(v){result.status=v;return res},json(value){responseHook?.(value);result.body=value;return res}};await route({params:{id:meta.id},body:{sha256:digest},...overrides},res);return result};
 h.part=path.join(store.dir(meta.id),"0.part");return h;
}
test("failed registration retains verified chunks and an explicit retry can finish",async t=>{
 const h=await fixture(t);let calls=0;h.register=async args=>{if(++calls===1)throw Error("registration unavailable");return{storedName:args.stored}};
 const failed=await h.call();assert.equal(failed.status,400);assert.match(failed.body.error,/registration unavailable/);assert.deepEqual(fs.readFileSync(h.part),bytes);assert.deepEqual(fs.readdirSync(h.media),[]);assert.equal(h.store.locks.size,0);
 const retried=await h.call();assert.equal(retried.status,200);assert.equal(retried.body.file.storedName,"fixture-2.pdf");assert.deepEqual(fs.readFileSync(path.join(h.media,"fixture-2.pdf")),bytes);assert.equal(fs.existsSync(h.store.dir(h.meta.id)),false);
});
test("registration holds session ownership through await and blocks expiry",async t=>{
 const h=await fixture(t),entered=gate(),release=gate();h.register=async args=>{entered.resolve();await release.promise;return{storedName:args.stored}};
 const pending=h.call();await entered.promise;
 try{assert.equal(h.store.locks.has(h.meta.id),true);assert.equal(h.store.cleanup(Date.now()+2000),0);assert.deepEqual(fs.readFileSync(h.part),bytes)}
 finally{release.resolve();await pending}
 assert.equal(h.store.locks.size,0);
});
test("queued completion waits for failed registration and then retries intact chunks",async t=>{
 const h=await fixture(t),entered=gate(),release=gate();let calls=0;h.register=async args=>{if(++calls===1){entered.resolve();await release.promise;throw Error("first registration failed")}return{storedName:args.stored}};
 const first=h.call();await entered.promise;const second=h.call();
 try{assert.equal(calls,1);assert.equal(h.store.cleanup(Date.now()+2000),0)}finally{release.resolve()}
 assert.equal((await first).status,400);assert.equal((await second).status,200);assert.equal(calls,2);assert.deepEqual(fs.readdirSync(h.media),["fixture-2.pdf"]);
});
test("explicit cancel waits for registration failure before removing retained chunks",async t=>{
 const h=await fixture(t),entered=gate(),release=gate();h.register=async()=>{entered.resolve();await release.promise;throw Error("registration failed")};
 const completion=h.call();await entered.promise;let cancelled=false;const cancel=h.store.cancel(h.meta.id,"fixture").then(()=>cancelled=true);
 try{assert.equal(cancelled,false);assert.equal(fs.existsSync(h.part),true);assert.equal(h.store.cleanup(Date.now()+2000),0)}finally{release.resolve()}
 assert.equal((await completion).status,400);await cancel;assert.equal(cancelled,true);assert.equal(fs.existsSync(h.store.dir(h.meta.id)),false);
});
test("successful registration survives a later session cleanup failure",async t=>{
 const h=await fixture(t),remove=fs.rmSync;let reject=true;
 t.mock.method(fs,"rmSync",function(file,options){if(file===h.store.dir(h.meta.id)&&options?.recursive&&reject){reject=false;throw Error("session cleanup unavailable")}return remove.call(this,file,options)});
 const result=await h.call();assert.equal(result.status,400);assert.match(result.body.error,/session cleanup unavailable/);assert.deepEqual(fs.readFileSync(path.join(h.media,"fixture-1.pdf")),bytes);assert.deepEqual(fs.readFileSync(h.part),bytes);assert.equal(h.store.locks.size,0);
});
test("a response failure cannot delete a successfully registered file",async t=>{
 const h=await fixture(t);let response=0;const result=await h.call({},()=>{if(++response===1)throw Error("response unavailable")});
 assert.equal(result.status,400);assert.deepEqual(fs.readFileSync(path.join(h.media,"fixture-1.pdf")),bytes);assert.equal(fs.existsSync(h.store.dir(h.meta.id)),false);
});
test("a missing registered file leaves chunks available and reports failure",async t=>{
 const h=await fixture(t);h.register=async()=>null;const result=await h.call();assert.equal(result.status,400);assert.match(result.body.error,/unavailable after registration/);assert.deepEqual(fs.readFileSync(h.part),bytes);assert.deepEqual(fs.readdirSync(h.media),[]);
});
test("digest rejection never reaches registration and preserves its inputs",async t=>{
 const h=await fixture(t);let called=false;h.register=async()=>called=true;const result=await h.call({body:{sha256:"0".repeat(64)}});assert.equal(result.status,400);assert.equal(called,false);assert.deepEqual(fs.readFileSync(h.part),bytes);assert.deepEqual(fs.readdirSync(h.media),[]);
});
test("another owner cannot trigger registration or destroy uploaded chunks",async t=>{
 const h=await fixture(t);let called=false;h.register=async()=>called=true;const result=await h.call({owner:"other"});assert.equal(result.status,404);assert.equal(called,false);assert.deepEqual(fs.readFileSync(h.part),bytes);
});
test("successful registration receives verified metadata and only then releases chunks",async t=>{
 const h=await fixture(t);h.register=async args=>{assert.equal(args.originalName,"lesson.pdf");assert.equal(args.mime,"application/pdf");assert.equal(args.size,8);assert.deepEqual(fs.readFileSync(path.join(h.media,args.stored)),bytes);assert.deepEqual(fs.readFileSync(h.part),bytes);assert.equal(h.store.locks.has(h.meta.id),true);return{storedName:args.stored}};
 assert.equal((await h.call()).status,200);assert.equal(fs.existsSync(h.part),false);
});
