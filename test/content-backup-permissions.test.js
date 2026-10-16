"use strict";

const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const {spawnSync,execFile}=require("node:child_process"),{promisify}=require("node:util"),{Readable}=require("node:stream");
const {contentDirectory,contentFile}=require("../src/content-permissions");
const {ResumableUploadStore}=require("../src/resumable-upload");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const maintenance=fs.readFileSync(path.join(__dirname,"../maintenance-agent/server.js"),"utf8");
const linux={skip:process.platform!=="linux"};
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a);return text.slice(a,b)}
function mode(p){return fs.statSync(p).mode&0o777}
function digest(b){return crypto.createHash("sha256").update(b).digest("hex")}
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),"rgb-content-mode-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root}
function privateUmask(t){const prior=process.umask(0o077);t.after(()=>process.umask(prior))}

test("content publication overrides restrictive umask without relaxing private siblings",linux,t=>{
  const root=fixture(t);privateUmask(t);
  const content=path.join(root,"content"),secret=path.join(root,"identity");
  fs.mkdirSync(secret);fs.writeFileSync(path.join(secret,"private.key"),"private fixture");
  contentDirectory(content);const file=path.join(content,"asset.pdf");fs.writeFileSync(file,"%PDF-fixture");
  assert.equal(mode(file),0o600);contentFile(root,file);
  assert.equal(mode(content),0o750);assert.equal(mode(file),0o640);
  assert.equal(mode(secret),0o700);assert.equal(mode(path.join(secret,"private.key")),0o600);
  assert.equal(process.umask(),0o077);
  fs.symlinkSync(secret,path.join(root,"linked-directory"));
  assert.throws(()=>contentDirectory(path.join(root,"linked-directory")));
  fs.symlinkSync(path.join(secret,"private.key"),path.join(content,"linked-file"));
  assert.throws(()=>contentFile(root,path.join(content,"linked-file")));
  fs.linkSync(path.join(secret,"private.key"),path.join(content,"hard-link"));
  assert.throws(()=>contentFile(root,path.join(content,"hard-link")),/Hard-linked/);
  assert.throws(()=>contentFile(content,path.join(content,"..","identity","private.key")),/outside/);
  const sibling=path.join(root,"content-other");fs.mkdirSync(sibling);fs.writeFileSync(path.join(sibling,"private"),"private fixture");
  assert.throws(()=>contentFile(content,path.join(sibling,"private")),/outside/);
  fs.symlinkSync(secret,path.join(content,"parent-link"));
  assert.throws(()=>contentFile(content,path.join(content,"parent-link","private.key")),/escapes/);
  assert.throws(()=>contentDirectory(content,path.join(content,"parent-link","new-directory")),/escapes/);
  assert.equal(fs.existsSync(path.join(secret,"new-directory")),false);
  assert.equal(mode(path.join(secret,"private.key")),0o600);
});

test("resumable sessions, metadata, chunks and final media survive umask 0077",linux,async t=>{
  const root=fixture(t);privateUmask(t);
  const sessions=path.join(root,"sessions"),store=new ResumableUploadStore({root:sessions,destinationRoot:root,maxFileBytes:1024,chunkBytes:1024,minFreeBytes:0});
  for(const [name,bytes] of [["image.png",Buffer.from("89504e470d0a1a0a","hex")],["video.mp4",Buffer.from("000000186674797069736f6d","hex")],["deck.pdf",Buffer.from("%PDF-fixture")]]){
    const s=store.create({owner:"fixture",name,size:bytes.length});
    assert.equal(mode(store.dir(s.id)),0o750);assert.equal(mode(store.metaFile(s.id)),0o640);
    await store.putChunk({id:s.id,owner:"fixture",index:0,input:Readable.from(bytes),contentLength:bytes.length,digest:digest(bytes)});
    assert.equal(mode(path.join(store.dir(s.id),"0.part")),0o640);assert.equal(mode(store.metaFile(s.id)),0o640);
    const destination=path.join(root,name);await store.assemble({id:s.id,owner:"fixture",digest:digest(bytes),destination});
    assert.equal(mode(destination),0o640);assert.deepEqual(fs.readFileSync(destination),bytes);
  }
  assert.equal(process.umask(),0o077);
  const rejected=store.create({owner:"fixture",name:"rejected.pdf",size:4});
  const outside=path.join(root,"..",path.basename(root)+"-outside.pdf");
  await assert.rejects(store.assemble({id:rejected.id,owner:"fixture",digest:digest(Buffer.from("%PDF")),destination:outside}),/outside/);
  assert.equal(fs.existsSync(outside),false);
});

function presentationContext(root,{fail=false,onRender=()=>{}}={}){
  const PRESENTATIONS_DIR=path.join(root,"presentations"),PRESENTATION_UPLOAD_TMP=path.join(root,"presentation-upload-tmp");
  contentDirectory(PRESENTATIONS_DIR);fs.mkdirSync(PRESENTATION_UPLOAD_TMP);
  const ctx={fs,path,crypto,contentDirectory,contentFile,PRESENTATIONS_DIR,PRESENTATION_UPLOAD_TMP,
    presentationLibrary:{presentations:{}},presentationDir:id=>path.join(PRESENTATIONS_DIR,id),persistPresentationLibrary(){},extractPptxSpeakerNotes:()=>[],
    execFileAsync:async(command,args)=>{
      if(command==="libreoffice"){const dir=args[args.indexOf("--outdir")+1];fs.writeFileSync(path.join(dir,"converted.pdf"),"%PDF-converted");}
      else{const prefix=args.at(-1);fs.writeFileSync(prefix+"-1.jpg","slide one");fs.writeFileSync(prefix+"-2.jpg","slide two");await onRender(ctx);if(fail)throw Error("converter failed");}
    }};
  vm.createContext(ctx);vm.runInContext(section(source,"async function buildPresentationSlidesUnlocked(","function buildPresentationSlides("),ctx);return ctx;
}

test("actual presentation upload and PDF/PPT conversion publish readable assets from private staging",linux,async t=>{
  const root=fixture(t);privateUmask(t);
  let during=0;const ctx=presentationContext(root,{onRender:()=>{
    const active=fs.readdirSync(ctx.PRESENTATION_UPLOAD_TMP);assert.ok(active.some(x=>x.startsWith("render-")));
    assert.ok(!fs.readdirSync(path.join(ctx.PRESENTATIONS_DIR,ctx.activeId)).some(x=>x.startsWith("render-")));during++;
  }});
  let handler;Object.assign(ctx,{app:{post:(route,...callbacks)=>{if(route==="/api/v1/presentations/upload")handler=callbacks.at(-1)}},requireCapability:()=>()=>{},presentationUpload:{single:()=>()=>{}},
    presentationId:()=>ctx.activeId,normalizePresentationFolderId:()=>"root",cleanPresentationLabel:x=>x,presentationPublicRecord:x=>x,audit(){},
    buildPresentationSlides:id=>ctx.buildPresentationSlidesUnlocked(id)});
  vm.runInContext(section(source,'app.post("/api/v1/presentations/upload"','app.post("/api/v1/presentations/:id/rebuild"'),ctx);
  for(const extension of [".pptx",".pdf"]){
    ctx.activeId="pres-test"+extension;const temp=path.join(ctx.PRESENTATION_UPLOAD_TMP,"incoming"+extension);fs.writeFileSync(temp,"original fixture");assert.equal(mode(temp),0o600);
    const req={file:{path:temp,originalname:"lesson"+extension,size:16},body:{}},res={status:code=>{assert.fail("unexpected upload HTTP "+code)},json:body=>assert.equal(body.ok,true)};
    await handler(req,res);const dir=ctx.presentationDir(ctx.activeId);
    assert.equal(mode(dir),0o750);assert.equal(mode(path.join(dir,"original"+extension)),0o640);
    assert.equal(mode(path.join(dir,"presentation.pdf")),0o640);assert.equal(mode(path.join(dir,"slides")),0o750);
    for(const name of fs.readdirSync(path.join(dir,"slides")))assert.equal(mode(path.join(dir,"slides",name)),0o640);
    assert.deepEqual(fs.readdirSync(ctx.PRESENTATION_UPLOAD_TMP),[]);
  }
  assert.equal(during,2);assert.equal(process.umask(),0o077);
});

test("failed rebuild leaves previous readable deck and removes private conversion staging",linux,async t=>{
  const root=fixture(t);privateUmask(t);const ctx=presentationContext(root,{fail:true}),id="pres-existing",dir=ctx.presentationDir(id);
  contentDirectory(dir);contentDirectory(path.join(dir,"slides"));
  for(const [name,bytes] of [["original.pptx","original"],["presentation.pdf","old pdf"],["slides/slide-001.jpg","old slide"]]){fs.writeFileSync(path.join(dir,name),bytes);contentFile(root,path.join(dir,name));}
  ctx.presentationLibrary.presentations[id]={originalFile:"original.pptx"};
  await assert.rejects(ctx.buildPresentationSlidesUnlocked(id),/converter failed/);
  assert.equal(fs.readFileSync(path.join(dir,"presentation.pdf"),"utf8"),"old pdf");
  assert.equal(mode(path.join(dir,"slides/slide-001.jpg")),0o640);assert.deepEqual(fs.readdirSync(ctx.PRESENTATION_UPLOAD_TMP),[]);
});

test("media registration and copied office PDF explicitly publish group-readable files",linux,async t=>{
  const root=fixture(t);privateUmask(t);const MEDIA_DIR=path.join(root,"media");contentDirectory(MEDIA_DIR);
  const ctx={fs,path,crypto,contentFile,MEDIA_DIR,DATA_DIR:root,safeStoredName:x=>x,
    execFileAsync:async(_cmd,args)=>fs.writeFileSync(path.join(args[args.indexOf("--outdir")+1],"lesson.pdf"),"%PDF-converted")};
  vm.createContext(ctx);vm.runInContext(section(source,"async function convertOfficeToPdf(","function documentViewerUrl("),ctx);
  Object.assign(ctx,{classifyMedia:()=>"image",mediaLibrary:{files:{}},persistMediaLibrary(){},officeConvertible:()=>false,audit(){},libraryRecordFromDisk:x=>x});
  vm.runInContext(section(source,"async function registerUploadedMedia(","const storage = multer.diskStorage("),ctx);
  for(const name of ["image.png","video.mp4","lesson.pptx"]){fs.writeFileSync(path.join(MEDIA_DIR,name),"fixture");await ctx.registerUploadedMedia({stored:name,originalName:name,mime:"fixture",size:7});assert.equal(mode(path.join(MEDIA_DIR,name)),0o640);}
  const pdf=await ctx.convertOfficeToPdf("lesson.pptx");assert.equal(mode(path.join(MEDIA_DIR,pdf)),0o640);
});

test("real operational ZIP writer reads content as a different uid in the shared group",{skip:process.platform!=="linux"||process.getuid()!==0},async t=>{
  const root=fixture(t);privateUmask(t);
  const hub=path.join(root,"classroom-hub"),data=path.join(hub,"data"),deck=path.join(data,"presentations/pres-fixture"),work=path.join(root,"work"),services=path.join(root,"services"),snapshot=path.join(root,"snapshot.db"),dest=path.join(root,"backup.zip");
  for(const dir of [root,hub,data,path.join(data,"presentations"),deck,work,services]){contentDirectory(dir);fs.chownSync(dir,10001,10001);}
  for(const name of ["original.pptx","presentation.pdf","slide.jpg"]){const file=path.join(deck,name);fs.writeFileSync(file,"fixture "+name);fs.chownSync(file,10001,10001);contentFile(root,file);}
  const {DatabaseSync}=require("node:sqlite"),db=new DatabaseSync(snapshot);db.exec("CREATE TABLE fixture(value); INSERT INTO fixture VALUES(1)");db.close();contentFile(root,snapshot);fs.chownSync(snapshot,10001,10001);
  fs.writeFileSync(path.join(hub,".env"),"PRIVATE_TEST_SENTINEL");
  const privateStage=path.join(data,"presentation-upload-tmp");fs.mkdirSync(privateStage);fs.writeFileSync(path.join(privateStage,"unfinished"),"private partial");
  const session=path.join(data,"media-upload-sessions/fixture-session");
  for(const dir of [path.dirname(session),session]){contentDirectory(dir);fs.chownSync(dir,10001,10001);}
  for(const name of ["session.json","0.part"]){const file=path.join(session,name);fs.writeFileSync(file,"committed "+name);fs.chownSync(file,10001,10001);contentFile(root,file);}
  fs.writeFileSync(path.join(session,".active-chunk.tmp"),"private partial");
  const unpublished=path.join(path.dirname(session),".unpublished.tmp");fs.mkdirSync(unpublished);fs.writeFileSync(path.join(unpublished,"session.json"),"private partial");
  const filter=section(maintenance,"function backupFilter(","async function createFullRecoveryExport("),writer=section(maintenance,"async function writeOperationalZipStreaming(","function writeJsonAtomic(");
  const script=`const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{promisify}=require('node:util'),{execFile}=require('node:child_process');const run=async(cmd,args,opts)=>promisify(execFile)(cmd,args,opts);const ctx={fs,path,run,HUB_ROOT:${JSON.stringify(hub)},Classroom_ROOT:${JSON.stringify(services)},UPLOAD_DIR:${JSON.stringify(work)},process};vm.createContext(ctx);vm.runInContext(${JSON.stringify(filter+writer)},ctx);process.setgid(10001);process.setuid(65534);ctx.writeOperationalZipStreaming(${JSON.stringify(dest)},${JSON.stringify(snapshot)},{version:4,scope:'operational',databaseSnapshot:true}).catch(e=>{console.error(e.message);process.exitCode=1});`;
  fs.chmodSync(root,0o770);fs.chmodSync(work,0o770);
  const result=spawnSync(process.execPath,["-e",script],{encoding:"utf8"});assert.equal(result.status,0,result.stderr);
  const AdmZip=require("adm-zip"),zip=new AdmZip(dest);assert.ok(zip.test());
  for(const name of ["original.pptx","presentation.pdf","slide.jpg"])assert.equal(zip.readAsText("classroom-hub/data/presentations/pres-fixture/"+name),"fixture "+name);
  for(const name of ["session.json","0.part"])assert.equal(zip.readAsText("classroom-hub/data/media-upload-sessions/fixture-session/"+name),"committed "+name);
  assert.equal(zip.getEntry("classroom-hub/.env"),null);assert.equal(zip.getEntry("classroom-hub/data/presentation-upload-tmp/unfinished"),null);
  assert.equal(zip.getEntry("classroom-hub/data/media-upload-sessions/fixture-session/.active-chunk.tmp"),null);
  assert.equal(zip.getEntry("classroom-hub/data/media-upload-sessions/.unpublished.tmp/session.json"),null);
  assert.ok(zip.getEntry("classroom-hub/data/classroom-control-hub.db"));assert.equal(mode(dest),0o600);assert.equal(mode(path.join(hub,".env")),0o600);assert.equal(mode(privateStage),0o700);
  const restored=path.join(root,"restored.db");fs.writeFileSync(restored,zip.readFile("classroom-hub/data/classroom-control-hub.db"));
  const restoredDb=new DatabaseSync(restored);assert.equal(restoredDb.prepare("PRAGMA quick_check").get().quick_check,"ok");assert.equal(restoredDb.prepare("SELECT value FROM fixture").get().value,1);restoredDb.close();
  // Reproduce the old failure with the identical writer and reader identity.
  fs.chmodSync(deck,0o700);const blocked=spawnSync(process.execPath,["-e",script],{encoding:"utf8"});assert.notEqual(blocked.status,0);assert.match(blocked.stderr,/EACCES/);
});
