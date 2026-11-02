"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),vm=require("node:vm"),{Readable,PassThrough}=require("node:stream");
const {ResumableUploadStore}=require("../src/resumable-upload");
const bytes=Buffer.from("%PDF-1.7"),digest=crypto.createHash("sha256").update(bytes).digest("hex");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>0&&b>a);return source.slice(a,b)}
const code=block("function commitMediaLibraryRecord(","\nlet classroomAutomations=")+block("async function registerUploadedMedia(","\nconst storage = multer.diskStorage")+block("function libraryRecordFromDisk(","\nfunction listMediaLibrary(")+block('app.post("/api/v1/media/uploads/:id/complete"','\nconst mediaLibraryMutationLimit=');
async function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-upload-receipt-"));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const media=path.join(root,"media");fs.mkdirSync(media);const h={root,media,names:0,audits:0,persisted:{files:{}},persist:()=>{},options:{root:path.join(root,"sessions"),destinationRoot:media,maxFileBytes:1024,maxOwnerBytes:8,chunkBytes:16,minFreeBytes:0,ttlMs:1000}};
 h.reopen=()=>{
  h.store=new ResumableUploadStore(h.options);h.ctx=vm.createContext({app:{post:(_url,...args)=>h.route=args.at(-1),delete:(_url,...args)=>h.cancelRoute=args.at(-1)},rateLimit:()=>()=>{},mediaUploadCompletionLimit:()=>{},requireCapability:()=>()=>{},resumableUploads:h.store,ownerKey:req=>req.owner||"fixture",mediaStoredName:()=>"file-"+(++h.names)+".pdf",MEDIA_DIR:media,MEDIA_LIBRARY_FILE:"library.json",path,fs,
  mediaLibrary:structuredClone(h.persisted),persistJson:(_file,next)=>{h.persist(next);h.persisted=JSON.parse(JSON.stringify(next))},contentFile:()=>{},safeStoredName:name=>name,classifyMedia:()=>"pdf",officeConvertible:()=>false,audit:()=>h.audits++,mediaUrl:name=>"/media/"+name});
  vm.runInContext(code,h.ctx);
 };
 h.reopen();h.meta=h.store.create({owner:"fixture",name:"lesson.pdf",mime:"application/pdf",size:bytes.length});await h.store.putChunk({id:h.meta.id,owner:"fixture",index:0,input:Readable.from(bytes),contentLength:bytes.length,digest});
 h.part=path.join(h.store.dir(h.meta.id),"0.part");
 h.call=async(overrides={},responseHook)=>{const result={status:200},res={status(v){result.status=v;return res},json(body){responseHook?.(body);result.body=body;return res}};await h.route({params:{id:h.meta.id},body:{sha256:digest},...overrides},res);return result};
 h.cancel=async(overrides={})=>{const r={status:200},res={status(v){r.status=v;return res},json(v){r.body=v;return res}};await h.cancelRoute({params:{id:h.meta.id},...overrides},res);return r};
 h.file=()=>path.join(media,"file-1.pdf");return h;
}
test("cancelling an incomplete upload removes its session and reports no saved file",async t=>{
 const h=await fixture(t),r=await h.cancel();assert.equal(r.status,200);assert.equal(r.body.completed,false);assert.equal(r.body.file,undefined);assert.equal(fs.existsSync(h.store.dir(h.meta.id)),false);assert.deepEqual(fs.readdirSync(h.media),[]);
});
test("cancellation after completion reports the public saved file without deleting media",async t=>{
 const h=await fixture(t);await h.call();const r=await h.cancel();assert.equal(r.status,200);assert.equal(r.body.completed,true);assert.equal(r.body.file.storedName,"file-1.pdf");assert.deepEqual(fs.readFileSync(h.file()),bytes);assert.equal(fs.existsSync(h.store.dir(h.meta.id)),false);assert.doesNotMatch(JSON.stringify(r.body),/uploadSessionId|uploadDigest|"owner"|"sha256"/);
});
test("cancel recognizes saved media after registered-receipt persistence failed",async t=>{
 const h=await fixture(t),checked=failReceipt(t,h,m=>m.completion?.registered);assert.equal((await h.call()).status,400);checked();const r=await h.cancel();assert.equal(r.body.completed,true);assert.deepEqual(fs.readFileSync(h.file()),bytes);
});
test("cancel waits for accepted conversion and reports its committed upload",async t=>{
 const h=await fixture(t);let entered,release;const enteredPromise=new Promise(r=>entered=r),released=new Promise(r=>release=r);h.ctx.officeConvertible=()=>true;h.ctx.convertOfficeToPdf=async()=>{entered();await released;return "rendered.pdf"};
 const completing=h.call();await enteredPromise;let ended=false;const cancelling=h.cancel().then(r=>{ended=true;return r});await Promise.resolve();assert.equal(ended,false);release();assert.equal((await completing).status,200);const r=await cancelling;assert.equal(r.body.completed,true);assert.equal(fs.existsSync(h.file()),true);
});
test("another owner cannot cancel or inspect a saved upload",async t=>{
 const h=await fixture(t);await h.call();const r=await h.cancel({owner:"other"});assert.equal(r.status,404);assert.equal(r.body.file,undefined);assert.equal(fs.existsSync(h.store.dir(h.meta.id)),true);
});
test("cancel reports a missing completed file without returning stale library data",async t=>{
 const h=await fixture(t);await h.call();fs.rmSync(h.file());const r=await h.cancel();assert.equal(r.body.completed,false);assert.equal(r.body.file,undefined);
});
test("cancel identity conflicts stay unknown without disclosing another library item",async t=>{
 const h=await fixture(t);await h.call();h.ctx.mediaLibrary.files["file-1.pdf"].uploadSessionId="another";const r=await h.cancel();assert.equal(r.body.completed,null);assert.equal(r.body.file,undefined);assert.equal(fs.existsSync(h.file()),true);
});
test("cancel size conflicts stay unknown and preserve the changed file",async t=>{
 const h=await fixture(t);await h.call();fs.appendFileSync(h.file(),"changed");const r=await h.cancel();assert.equal(r.body.completed,null);assert.equal(r.body.file,undefined);assert.equal(fs.readFileSync(h.file(),"utf8"),bytes.toString()+"changed");
});
test("a retirement marker alone does not falsely report cancellation of a retained library file",async t=>{
 const h=await fixture(t);await h.call();h.store.retire(h.meta.id,"file-1.pdf",digest);const r=await h.cancel();assert.equal(r.body.completed,true);assert.equal(fs.existsSync(h.file()),true);
});
test("cancel observes a queued library deletion under the same file owner",async t=>{
 const h=await fixture(t);await h.call();let release,entered;const ready=new Promise(r=>entered=r),held=new Promise(r=>release=r);
 const deletion=h.ctx.withMediaFileWrite("file-1.pdf",async()=>{entered();await held;fs.rmSync(h.file());h.ctx.commitMediaLibraryRecord("file-1.pdf",null)});await ready;const cancelling=h.cancel();release();await deletion;const r=await cancelling;assert.equal(r.body.completed,false);assert.equal(r.body.file,undefined);
});
function failReceipt(t,h,predicate){
 const rename=fs.renameSync;let failed=false;
 t.mock.method(fs,"renameSync",function(from,to){if(to===h.store.metaFile(h.meta.id)&&!failed){const next=JSON.parse(fs.readFileSync(from,"utf8"));if(predicate(next)){failed=true;throw Error("receipt write unavailable")}}return rename.call(this,from,to)});
 return()=>assert.equal(failed,true);
}
test("lost successful completion response retries the same library item without registering again",async t=>{
 const h=await fixture(t),first=await h.call(),second=await h.call();assert.equal(first.status,200);assert.equal(second.status,200);assert.equal(second.body.file.storedName,first.body.file.storedName);assert.equal(h.audits,1);assert.deepEqual(fs.readdirSync(h.media),["file-1.pdf"]);assert.equal(fs.existsSync(h.part),false);
});
test("completion receipt and committed library identity survive a reopened store/runtime",async t=>{
 const h=await fixture(t),first=await h.call();h.reopen();const second=await h.call();assert.equal(second.status,200);assert.equal(second.body.file.storedName,first.body.file.storedName);assert.equal(h.audits,1);
});
test("simultaneous completion requests serialize to one filename and one registration",async t=>{
 const h=await fixture(t),[a,b]=await Promise.all([h.call(),h.call()]);assert.equal(a.status,200);assert.equal(b.status,200);assert.equal(a.body.file.storedName,b.body.file.storedName);assert.equal(h.audits,1);assert.deepEqual(fs.readdirSync(h.media),["file-1.pdf"]);
});
test("a lost response after registration retains the receipt for an explicit retry",async t=>{
 const h=await fixture(t);let writes=0;const first=await h.call({},()=>{if(++writes===1)throw Error("response disconnected")});assert.equal(first.status,400);const next=await h.call();assert.equal(next.status,200);assert.equal(h.audits,1);assert.equal(next.body.file.storedName,"file-1.pdf");
});
for(const reopen of [false,true])test("failed registered receipt publication recovers committed identity"+(reopen?" after restart":""),async t=>{
 const h=await fixture(t),checked=failReceipt(t,h,m=>m.completion?.registered&&!m.completion?.reclaimed);const first=await h.call();checked();assert.equal(first.status,400);assert.deepEqual(fs.readFileSync(h.file()),bytes);assert.deepEqual(fs.readFileSync(h.part),bytes);assert.equal(h.audits,1);
 if(reopen)h.reopen();const second=await h.call();assert.equal(second.status,200);assert.equal(second.body.file.storedName,"file-1.pdf");assert.equal(h.audits,1);assert.equal(fs.existsSync(h.part),false);
});
test("failed chunk reclamation retries cleanup without registering or rewriting the file",async t=>{
 const h=await fixture(t),remove=fs.rmSync;let failed=false;t.mock.method(fs,"rmSync",function(file,opts){if(file===h.part&&!failed){failed=true;throw Error("cleanup unavailable")}return remove.call(this,file,opts)});
 assert.equal((await h.call()).status,400);const before=fs.statSync(h.file()).mtimeMs;assert.equal(h.store.read(h.meta.id).completion.reclaimed,false);
 assert.throws(()=>h.store.create({owner:"fixture",name:"next.pdf",size:8}),/quota/);
 assert.equal((await h.call()).status,200);assert.equal(h.audits,1);assert.equal(fs.statSync(h.file()).mtimeMs,before);assert.equal(h.store.read(h.meta.id).completion.reclaimed,true);
});
test("failed reclaimed receipt publication remains quota-conservative until retry",async t=>{
 const h=await fixture(t),checked=failReceipt(t,h,m=>m.completion?.reclaimed);assert.equal((await h.call()).status,400);checked();assert.equal(fs.existsSync(h.part),false);assert.throws(()=>h.store.create({owner:"fixture",name:"next.pdf",size:8}),/quota/);
 assert.equal((await h.call()).status,200);assert.doesNotThrow(()=>h.store.create({owner:"fixture",name:"next.pdf",size:8}));assert.equal(h.audits,1);
});
test("reclaimed receipts do not consume active upload quota",async t=>{
 const h=await fixture(t);assert.equal((await h.call()).status,200);assert.doesNotThrow(()=>h.store.create({owner:"fixture",name:"next.pdf",size:8}));assert.equal(h.store.read(h.meta.id).completion.reclaimed,true);
});
test("completion retry with another digest fails closed without deleting the published file",async t=>{
 const h=await fixture(t);await h.call();const result=await h.call({body:{sha256:"0".repeat(64)}});assert.equal(result.status,409);assert.deepEqual(fs.readFileSync(h.file()),bytes);assert.equal(h.audits,1);
});
test("initial bad digest does not pin an unverified hash or prevent a corrected retry",async t=>{
 const h=await fixture(t);assert.equal((await h.call({body:{sha256:"0".repeat(64)}})).status,400);assert.equal(h.store.read(h.meta.id).completion.digest,null);assert.equal((await h.call()).status,200);assert.equal(h.audits,1);
});
test("another owner cannot replay or learn the completed file identity",async t=>{
 const h=await fixture(t);await h.call();const result=await h.call({owner:"other"});assert.equal(result.status,404);assert.equal(result.body.file,undefined);assert.deepEqual(fs.readFileSync(h.file()),bytes);
});
test("completed file deletion is reported as gone and never recreates the file",async t=>{
 const h=await fixture(t);await h.call();fs.rmSync(h.file());const result=await h.call();assert.equal(result.status,410);assert.equal(fs.existsSync(h.file()),false);assert.equal(h.audits,1);
});
test("removed library membership is not recreated from a completed receipt",async t=>{
 const h=await fixture(t);await h.call();delete h.ctx.mediaLibrary.files["file-1.pdf"];const result=await h.call();assert.equal(result.status,410);assert.deepEqual(fs.readFileSync(h.file()),bytes);assert.equal(h.audits,1);
});
test("a conflicting library owner prevents replay without deleting either identity",async t=>{
 const h=await fixture(t);await h.call();h.ctx.mediaLibrary.files["file-1.pdf"].uploadSessionId="foreign";const result=await h.call();assert.equal(result.status,409);assert.deepEqual(fs.readFileSync(h.file()),bytes);assert.equal(h.audits,1);
});
test("changed completed file size is visible and never triggers re-registration",async t=>{
 const h=await fixture(t);await h.call();fs.appendFileSync(h.file(),"changed");assert.equal((await h.call()).status,409);assert.equal(fs.readFileSync(h.file(),"utf8"),"%PDF-1.7changed");assert.equal(h.audits,1);
});
test("receipts expose neither internal owner, digest nor private registration identity",async t=>{
 const h=await fixture(t),result=await h.call(),publicSession=h.store.public(h.store.read(h.meta.id));
 for(const key of ["owner","completion","uploadDigest","uploadSessionId"])assert.equal(publicSession[key],undefined);
 for(const key of ["uploadSessionId","uploadDigest"])assert.equal(result.body.file[key],undefined);
 assert.equal(fs.statSync(h.store.metaFile(h.meta.id)).mode&0o777,0o640);assert.equal(fs.statSync(h.store.dir(h.meta.id)).mode&0o777,0o750);
});
test("expiry reclaims only the receipt and keeps the registered media",async t=>{
 const h=await fixture(t);await h.call();assert.equal(h.store.cleanup(Date.now()+2000),1);assert.equal(fs.existsSync(h.store.dir(h.meta.id)),false);assert.deepEqual(fs.readFileSync(h.file()),bytes);
});
test("cancelling a completed upload removes its receipt but preserves published media",async t=>{
 const h=await fixture(t);await h.call();await h.store.cancel(h.meta.id,"fixture");assert.equal(fs.existsSync(h.store.dir(h.meta.id)),false);assert.deepEqual(fs.readFileSync(h.file()),bytes);
});
test("failed initial library persistence never publishes a phantom cache identity",async t=>{
 const h=await fixture(t);let attempts=0;h.persist=()=>{if(++attempts===1)throw Error("database unavailable")};assert.equal((await h.call()).status,400);assert.deepEqual(Object.keys(h.ctx.mediaLibrary.files),[]);assert.deepEqual(Object.keys(h.persisted.files),[]);assert.deepEqual(fs.readFileSync(h.part),bytes);
 assert.equal((await h.call()).status,200);assert.equal(h.audits,1);assert.deepEqual(fs.readdirSync(h.media),["file-1.pdf"]);
});
test("unverified prepared destination and chunks survive a fresh process retry",async t=>{
 const h=await fixture(t);h.persist=()=>{throw Error("database unavailable")};assert.equal((await h.call()).status,400);h.persist=()=>{};h.reopen();assert.equal((await h.call()).status,200);assert.deepEqual(fs.readdirSync(h.media),["file-1.pdf"]);
});
test("tampered completion destination is rejected before any file is touched",async t=>{
 const h=await fixture(t);await h.call();const meta=h.store.read(h.meta.id);meta.completion.storedName="../outside.pdf";fs.writeFileSync(h.store.metaFile(meta.id),JSON.stringify(meta));assert.equal((await h.call()).status,400);assert.deepEqual(fs.readFileSync(h.file()),bytes);assert.equal(h.audits,1);
});
test("registered receipt without its verified digest fails closed",async t=>{
 const h=await fixture(t);await h.call();const meta=h.store.read(h.meta.id);meta.completion.digest=null;fs.writeFileSync(h.store.metaFile(meta.id),JSON.stringify(meta));assert.equal((await h.call()).status,400);assert.deepEqual(fs.readFileSync(h.file()),bytes);
});

test("retirement survives the committed-library but unpublished-receipt failure window",async t=>{
 const h=await fixture(t),checked=failReceipt(t,h,m=>m.completion?.registered);assert.equal((await h.call()).status,400);checked();
 h.store.retire(h.meta.id,"file-1.pdf",digest);fs.rmSync(h.file());h.ctx.commitMediaLibraryRecord("file-1.pdf",null);h.reopen();
 assert.equal((await h.call()).status,410);assert.equal(fs.existsSync(h.file()),false);assert.equal(h.audits,1);
});
test("retirement while replay waits on the library owner prevents reassembly",async t=>{
 const h=await fixture(t);failReceipt(t,h,m=>m.completion?.registered);assert.equal((await h.call()).status,400);
 let release,entered;const ready=new Promise(r=>entered=r),hold=h.ctx.withMediaFileWrite("file-1.pdf",async()=>{entered();await new Promise(r=>release=r)});await ready;
 const retry=h.call();await new Promise(setImmediate);h.store.retire(h.meta.id,"file-1.pdf",digest);fs.rmSync(h.file());h.ctx.commitMediaLibraryRecord("file-1.pdf",null);release();await hold;
 assert.equal((await retry).status,410);assert.equal(fs.existsSync(h.file()),false);assert.equal(h.audits,1);
});
test("retirement after registration cannot be overwritten by receipt publication",async t=>{
 const h=await fixture(t),register=h.ctx.registerUploadedMedia;
 h.ctx.registerUploadedMedia=async args=>{const result=await register(args);h.store.retire(h.meta.id,args.stored,digest);fs.rmSync(h.file());h.ctx.commitMediaLibraryRecord(args.stored,null);return result};
 assert.equal((await h.call()).status,410);assert.equal(h.store.read(h.meta.id).completion.deleted,true);assert.equal((await h.call()).status,410);assert.equal(fs.existsSync(h.file()),false);
});
test("retirement validates both the destination and the verified digest",async t=>{
 const h=await fixture(t);await h.call();assert.throws(()=>h.store.retire(h.meta.id,"foreign.pdf",digest),/identity conflict/);assert.throws(()=>h.store.retire(h.meta.id,"file-1.pdf","0".repeat(64)),/identity conflict/);assert.equal(h.store.read(h.meta.id).completion.deleted,undefined);assert.equal((await h.call()).status,200);
});
test("an expired receipt does not prevent deleting its separately owned library item",async t=>{
 const h=await fixture(t);await h.call();h.store.cleanup(Date.now()+2000);assert.doesNotThrow(()=>h.store.retire(h.meta.id,"file-1.pdf",digest));assert.deepEqual(fs.readFileSync(h.file()),bytes);
});
test("failed retirement publication preserves the prior receipt for retry",async t=>{
 const h=await fixture(t);await h.call();const checked=failReceipt(t,h,m=>m.completion?.deleted);assert.throws(()=>h.store.retire(h.meta.id,"file-1.pdf",digest),/receipt write unavailable/);checked();assert.equal(h.store.read(h.meta.id).completion.deleted,undefined);assert.equal((await h.call()).status,200);assert.deepEqual(fs.readFileSync(h.file()),bytes);
});
test("failure saving the verified digest discards only this unregistered output",async t=>{
 const h=await fixture(t),checked=failReceipt(t,h,m=>!!m.completion?.digest&&!m.completion?.registered);assert.equal((await h.call()).status,400);checked();assert.deepEqual(fs.readdirSync(h.media),[]);assert.deepEqual(fs.readFileSync(h.part),bytes);assert.equal(h.audits,0);assert.equal((await h.call()).status,200);
});
test("discard completes inside the session owner before its queued retry assembles",async t=>{
 const h=await fixture(t);let release,entered,failed;const ready=new Promise(r=>entered=r),failure=new Promise(r=>failed=r),hold=h.ctx.withMediaFileWrite("file-1.pdf",async()=>{entered();await new Promise(r=>release=r)});await ready;
 const rename=fs.renameSync;let once=true;t.mock.method(fs,"renameSync",function(from,to){if(to===h.store.metaFile(h.meta.id)&&once){const m=JSON.parse(fs.readFileSync(from,"utf8"));if(m.completion?.digest&&!m.completion?.registered){once=false;failed();throw Error("verified receipt unavailable")}}return rename.call(this,from,to)});
 const first=h.call();await failure;const second=h.call();assert.equal(h.store.locks.has(h.meta.id),true);release();await hold;
 assert.equal((await first).status,400);assert.equal((await second).status,200);assert.deepEqual(fs.readFileSync(h.file()),bytes);assert.equal(h.audits,1);
});
test("a committed library item survives a later conversion-state persistence failure",async t=>{
 const h=await fixture(t);h.ctx.officeConvertible=()=>true;h.persist=next=>{if(next.files["file-1.pdf"]?.conversionStatus==="converting")throw Error("conversion state unavailable")};
 assert.equal((await h.call()).status,400);assert.deepEqual(fs.readFileSync(h.file()),bytes);assert.ok(h.persisted.files["file-1.pdf"]);assert.equal(h.ctx.mediaLibrary.files["file-1.pdf"].conversionStatus,null);
 h.persist=()=>{};const replay=await h.call();assert.equal(replay.status,200);assert.equal(replay.body.file.storedName,"file-1.pdf");assert.equal(h.audits,0);
});
test("retirement during chunk reassembly cannot be overwritten by a stale metadata copy",async t=>{
 const h=await fixture(t);failReceipt(t,h,m=>m.completion?.registered);assert.equal((await h.call()).status,400);fs.rmSync(h.file());
 const read=fs.createReadStream,stream=new PassThrough();let opened;const ready=new Promise(r=>opened=r);
 t.mock.method(fs,"createReadStream",function(file,...args){if(file===h.part){opened();return stream}return read.call(this,file,...args)});
 const retry=h.call();await ready;h.store.retire(h.meta.id,"file-1.pdf",digest);h.ctx.commitMediaLibraryRecord("file-1.pdf",null);stream.end(bytes);
 assert.equal((await retry).status,410);assert.equal(h.store.read(h.meta.id).completion.deleted,true);assert.equal(fs.existsSync(h.file()),false);assert.deepEqual(fs.readdirSync(h.media),[]);
});

test("retirement reclaims retry chunks so legacy assembly cannot recover deleted bytes",async t=>{
 const h=await fixture(t);failReceipt(t,h,m=>m.completion?.registered);assert.equal((await h.call()).status,400);
 h.store.retire(h.meta.id,"file-1.pdf",digest);fs.rmSync(h.file());
 await assert.rejects(h.store.assemble({id:h.meta.id,owner:"fixture",digest,destination:path.join(h.media,"legacy.pdf")}));
 assert.equal(fs.existsSync(h.part),false);
 assert.equal(fs.existsSync(path.join(h.media,"legacy.pdf")),false);assert.equal((await h.call()).status,410);
});
test("retired and reclaimed upload chunks no longer reserve the owner's quota",async t=>{
 const h=await fixture(t);failReceipt(t,h,m=>m.completion?.registered);assert.equal((await h.call()).status,400);h.store.retire(h.meta.id,"file-1.pdf",digest);
 assert.equal(h.store.read(h.meta.id).completion.reclaimed,true);assert.doesNotThrow(()=>h.store.create({owner:"fixture",name:"new.pdf",size:8}));
});
