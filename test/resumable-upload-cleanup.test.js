"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),crypto=require("node:crypto"),{PassThrough,Readable}=require("node:stream");
const {ResumableUploadStore}=require("../src/resumable-upload");
const tick=()=>new Promise(setImmediate),digest=b=>crypto.createHash("sha256").update(b).digest("hex"),bytes=Buffer.from("%PDF-1.7");
function fixture(t,chunkBytes=8){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-upload-owner-"));assert.equal(path.dirname(root),path.resolve(os.tmpdir()));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const store=new ResumableUploadStore({root,maxFileBytes:1024,chunkBytes,ttlMs:1000,minFreeBytes:0});
 const make=(owner="user:a")=>store.create({owner,name:"lesson.pdf",size:bytes.length});
 return{root,store,make,expiry:()=>Date.now()+2000};
}
function writing(store,meta,index=0,body=bytes){
 const input=new PassThrough(),promise=store.putChunk({id:meta.id,owner:meta.owner,index,input,contentLength:body.length,digest:digest(body)});
 promise.catch(()=>{});return{input,promise,finish:async()=>{if(!input.writableEnded&&!input.destroyed)input.end(body);return promise}};
}
test("expiry cannot unlink the accepted active chunk or its metadata",async t=>{
 const h=fixture(t),m=h.make(),w=writing(h.store,m);await tick();
 try{assert.equal(h.store.cleanup(h.expiry()),0);assert.ok(fs.existsSync(h.store.metaFile(m.id)))}
 finally{await w.finish()}
 assert.equal(h.store.read(m.id).received[0].sha256,digest(bytes));assert.equal(h.store.locks.size,0);
});
test("queued chunk ownership remains after the preceding write completes",async t=>{
 const h=fixture(t,4),m=h.make(),a=writing(h.store,m,0,bytes.subarray(0,4)),b=writing(h.store,m,1,bytes.subarray(4));
 try{await tick();assert.equal(h.store.cleanup(h.expiry()),0);await a.finish();await tick();assert.equal(h.store.locks.has(m.id),true);assert.equal(h.store.cleanup(h.expiry()),0)}
 finally{await a.finish();await b.finish()}
 assert.deepEqual(h.store.public(h.store.read(m.id)).received,[0,1]);assert.equal(h.store.locks.size,0);
});
test("active assembly retains all chunk inputs until verified publication",async t=>{
 const h=fixture(t),m=h.make();await h.store.putChunk({id:m.id,owner:m.owner,index:0,input:Readable.from(bytes),contentLength:bytes.length,digest:digest(bytes)});
 const read=fs.createReadStream,gate=new PassThrough(),part=path.join(h.store.dir(m.id),"0.part");let opened=false;
 t.mock.method(fs,"createReadStream",function(file,...args){if(file===part){opened=true;return gate}return read.call(this,file,...args)});
 const destination=path.join(h.root,"complete.pdf"),pending=h.store.assemble({id:m.id,owner:m.owner,digest:digest(bytes),destination});pending.catch(()=>{});
 try{await tick();assert.equal(opened,true);assert.equal(h.store.cleanup(h.expiry()),0);assert.ok(fs.existsSync(part))}
 finally{gate.end(bytes);await pending}
 assert.deepEqual(fs.readFileSync(destination),bytes);assert.equal(h.store.locks.size,0);
});
test("a failed writer releases ownership so expiry can reclaim the session",async t=>{
 const h=fixture(t),m=h.make(),w=writing(h.store,m);await tick();
 assert.equal(h.store.cleanup(h.expiry()),0);w.input.destroy(Error("fixture disconnect"));await assert.rejects(w.promise,/fixture disconnect/);
 assert.equal(h.store.locks.size,0);assert.equal(h.store.cleanup(h.expiry()),1);assert.equal(fs.existsSync(h.store.dir(m.id)),false);
});
test("expiry still removes idle sessions while preserving another owner's writer",async t=>{
 const h=fixture(t),m=h.make(),idle=h.make("user:b"),w=writing(h.store,m);await tick();
 try{assert.equal(h.store.cleanup(h.expiry()),1);assert.equal(fs.existsSync(h.store.dir(idle.id)),false);assert.ok(fs.existsSync(h.store.dir(m.id)))}
 finally{await w.finish()}
});
test("explicit cancel stays ordered behind its accepted writer",async t=>{
 const h=fixture(t),m=h.make(),w=writing(h.store,m),cancel=h.store.cancel(m.id,m.owner);cancel.catch(()=>{});
 try{await tick();assert.equal(h.store.cleanup(h.expiry()),0);assert.ok(fs.existsSync(h.store.dir(m.id)))}
 finally{await w.finish();await cancel}
 assert.equal(fs.existsSync(h.store.dir(m.id)),false);assert.equal(h.store.locks.size,0);
});
test("create-triggered cleanup protects an old session whose chunk is now active",async t=>{
 const h=fixture(t),m=h.make(),w=writing(h.store,m);await tick();
 try{
  const meta=h.store.read(m.id);meta.updatedAt=new Date(0).toISOString();fs.writeFileSync(h.store.metaFile(m.id),JSON.stringify(meta));
  const other=h.make("user:b");assert.ok(fs.existsSync(h.store.dir(other.id)));assert.ok(fs.existsSync(h.store.dir(m.id)));
 }finally{await w.finish()}
 assert.deepEqual(h.store.public(h.store.read(m.id)).received,[0]);
});
test("corrupt metadata fallback cannot bypass an accepted lock and reclaims it after release",async t=>{
 const h=fixture(t),m=h.make();let release;const hold=h.store.locked(m.id,()=>new Promise(resolve=>release=resolve));await tick();
 fs.writeFileSync(h.store.metaFile(m.id),"corrupt");fs.utimesSync(h.store.dir(m.id),new Date(0),new Date(0));
 try{assert.equal(h.store.cleanup(h.expiry()),0);assert.ok(fs.existsSync(h.store.dir(m.id)))}
 finally{release();await hold}
 assert.equal(h.store.cleanup(h.expiry()),1);assert.equal(h.store.locks.size,0);
});
