"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("fs");
const os=require("os");
const path=require("path");
const crypto=require("crypto");
const {Readable}=require("stream");
const vm=require("vm");
const {ResumableUploadStore,inspectUpload,ABSOLUTE_CHUNK_BYTES}=require("../src/resumable-upload");

function digest(value){return crypto.createHash("sha256").update(value).digest("hex")}
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-upload-"));return {root,store:new ResumableUploadStore({root,maxFileBytes:1024,chunkBytes:4,ttlMs:1000})}}
async function put(store,id,owner,index,value){const body=Buffer.from(value);return store.putChunk({id,owner,index,input:Readable.from(body),contentLength:body.length,digest:digest(body)})}

test("chunk sessions accept out-of-order chunks, resume, and idempotent retries",async t=>{
 const {root,store}=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=Buffer.concat([Buffer.from("%PDF-1.7\n"),Buffer.from("test")]),session=store.create({owner:"user:a",name:"lesson.pdf",size:file.length,mime:"application/pdf"});
 await Promise.all([put(store,session.id,"user:a",2,file.subarray(8,12)),put(store,session.id,"user:a",0,file.subarray(0,4))]);
 let status=store.public(store.owned(session.id,"user:a"));assert.deepEqual(status.received,[0,2]);
 await put(store,session.id,"user:a",0,file.subarray(0,4));
 await put(store,session.id,"user:a",3,file.subarray(12));await put(store,session.id,"user:a",1,file.subarray(4,8));
 const destination=path.join(root,"complete.pdf");await store.assemble({id:session.id,owner:"user:a",digest:digest(file),destination});
 assert.deepEqual(fs.readFileSync(destination),file);assert.equal(fs.existsSync(store.dir(session.id)),false);
});

test("sessions enforce owner isolation, exact chunks, final integrity, and content inspection",async t=>{
 const {root,store}=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=Buffer.from("%PDF-bad"),session=store.create({owner:"user:a",name:"lesson.pdf",size:file.length,mime:"application/pdf"});
 assert.throws(()=>store.owned(session.id,"user:b"),/not found/);
 await assert.rejects(()=>store.putChunk({id:session.id,owner:"user:a",index:0,input:Readable.from("bad"),contentLength:3,digest:digest("bad")}),/exactly 4 bytes/);
 await put(store,session.id,"user:a",0,file.subarray(0,4));await put(store,session.id,"user:a",1,file.subarray(4));
 await assert.rejects(()=>store.assemble({id:session.id,owner:"user:a",digest:"0".repeat(64),destination:path.join(root,"bad.pdf")}),/verification failed/);
 const fake=path.join(root,"fake.mp4");fs.writeFileSync(fake,"not a movie");assert.throws(()=>inspectUpload(fake,"fake.mp4"),/contents do not match/);
 assert.ok(ABSOLUTE_CHUNK_BYTES<100*1024*1024);
});

test("expired sessions are reclaimed and cancelled sessions disappear",async t=>{
 const {root,store}=fixture();t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const expired=store.create({owner:"user:a",name:"old.pdf",size:4,mime:"application/pdf"});const meta=store.read(expired.id);meta.updatedAt=new Date(0).toISOString();fs.writeFileSync(store.metaFile(expired.id),JSON.stringify(meta));
 assert.equal(store.cleanup(Date.now()),1);assert.throws(()=>store.read(expired.id),/not found/);
 const cancelled=store.create({owner:"user:a",name:"cancel.pdf",size:4,mime:"application/pdf"});await store.cancel(cancelled.id,"user:a");assert.throws(()=>store.read(cancelled.id),/not found/);
});

test("5 GiB policy accepts a 1.7 GiB session without allocating the file and enforces owner quota",t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-upload-policy-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const gib=1024*1024*1024,store=new ResumableUploadStore({root,maxFileBytes:5*gib,maxOwnerBytes:2*gib,minFreeBytes:0});
 const session=store.create({owner:"user:a",name:"class-video.mp4",size:Math.floor(1.7*gib),mime:"video/mp4"});
 assert.equal(session.size,Math.floor(1.7*gib));assert.ok(session.chunkBytes<50*1000*1000);
 assert.throws(()=>store.create({owner:"user:a",name:"second.mp4",size:400*1024*1024,mime:"video/mp4"}),/quota exceeded/);
});

test("browser incremental SHA-256 matches the platform digest",()=>{
 let source=fs.readFileSync(path.join(__dirname,"../public/shared/resumable-upload.js"),"utf8");
 source=source.replace("global.RoomGoblinUpload={upload,cancel,MAX_BYTES};","global.RoomGoblinUpload={upload,cancel,MAX_BYTES,Sha256};");
 const context={window:{},TextEncoder,crypto:crypto.webcrypto,fetch:()=>{},localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}};vm.runInNewContext(source,context);
 const hash=new context.window.RoomGoblinUpload.Sha256();hash.update(new TextEncoder().encode("large "));hash.update(new TextEncoder().encode("upload"));
 assert.equal(hash.digest(),digest("large upload"));assert.equal(context.window.RoomGoblinUpload.MAX_BYTES,5*1024*1024*1024);
});
