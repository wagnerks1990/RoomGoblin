"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {pipeline}=require("stream/promises");

const MIB=1024*1024;
const DEFAULT_CHUNK_BYTES=45*MIB;
const ABSOLUTE_CHUNK_BYTES=95*MIB;
const SESSION_ID=/^[a-f0-9-]{36}$/;

function atomicJson(file,value){
  const tmp=`${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tmp,JSON.stringify(value));
  fs.renameSync(tmp,file);
}
function safeSessionId(value){const id=String(value||"");if(!SESSION_ID.test(id))throw Object.assign(new Error("Invalid upload session"),{status:400});return id}
function safeDigest(value,label="SHA-256 digest"){const digest=String(value||"").toLowerCase();if(!/^[a-f0-9]{64}$/.test(digest))throw Object.assign(new Error(`${label} is required`),{status:400});return digest}
function magicMatches(ext,head){
  const ascii=head.toString("ascii"),hex=head.toString("hex");
  if([".jpg",".jpeg"].includes(ext))return hex.startsWith("ffd8ff");
  if(ext===".png")return hex.startsWith("89504e470d0a1a0a");
  if(ext===".gif")return ascii.startsWith("GIF87a")||ascii.startsWith("GIF89a");
  if(ext===".webp")return ascii.startsWith("RIFF")&&ascii.slice(8,12)==="WEBP";
  if(ext===".bmp")return ascii.startsWith("BM");
  if(ext===".pdf")return ascii.startsWith("%PDF-");
  if([".mp4",".mov",".m4v"].includes(ext))return head.length>=12&&ascii.slice(4,8)==="ftyp";
  if(ext===".webm")return hex.startsWith("1a45dfa3");
  if([".pptx",".docx",".odp",".odt"].includes(ext))return hex.startsWith("504b0304")||hex.startsWith("504b0506")||hex.startsWith("504b0708");
  if([".ppt",".doc"].includes(ext))return hex.startsWith("d0cf11e0a1b11ae1");
  if(ext===".rtf")return ascii.startsWith("{\\rtf");
  return false;
}
function inspectUpload(file,originalName){
  const ext=path.extname(String(originalName||"")).toLowerCase();
  const allowed=new Set([".png",".jpg",".jpeg",".gif",".webp",".bmp",".mp4",".webm",".mov",".m4v",".pdf",".ppt",".pptx",".odp",".doc",".docx",".odt",".rtf"]);
  if(!allowed.has(ext))throw Object.assign(new Error(`Unsupported file type: ${originalName}`),{status:400});
  const fd=fs.openSync(file,"r");let head;
  try{head=Buffer.alloc(32);head=head.subarray(0,fs.readSync(fd,head,0,head.length,0))}finally{fs.closeSync(fd)}
  if(!magicMatches(ext,head))throw Object.assign(new Error(`File contents do not match the ${ext} file type`),{status:400});
  return ext;
}
function ownerKey(req){
  if(req.authUser?.id)return `user:${req.authUser.id}`;
  const token=String(req.get?.("x-control-token")||"");
  return `legacy:${crypto.createHash("sha256").update(token).digest("hex")}`;
}

class ResumableUploadStore{
  constructor({root,maxFileBytes,chunkBytes=DEFAULT_CHUNK_BYTES,ttlMs=24*60*60*1000,maxOwnerBytes=maxFileBytes*2,minFreeBytes=1024*MIB}){
    this.root=root;this.maxFileBytes=maxFileBytes;this.chunkBytes=Math.min(chunkBytes,ABSOLUTE_CHUNK_BYTES);this.ttlMs=ttlMs;this.maxOwnerBytes=maxOwnerBytes;this.minFreeBytes=minFreeBytes;
    this.locks=new Map();
    fs.mkdirSync(root,{recursive:true});
  }
  async locked(id,task){const prior=this.locks.get(id)||Promise.resolve(),run=prior.catch(()=>{}).then(task);this.locks.set(id,run);try{return await run}finally{if(this.locks.get(id)===run)this.locks.delete(id)}}
  dir(id){return path.join(this.root,safeSessionId(id))}
  metaFile(id){return path.join(this.dir(id),"session.json")}
  read(id){try{return JSON.parse(fs.readFileSync(this.metaFile(id),"utf8"))}catch(err){if(err.code==="ENOENT")throw Object.assign(new Error("Upload session not found"),{status:404});throw err}}
  owned(id,owner){const meta=this.read(id);if(meta.owner!==owner)throw Object.assign(new Error("Upload session not found"),{status:404});return meta}
  create({owner,name,size,mime}){
    name=path.basename(String(name||"")).slice(0,240);size=Number(size);
    if(!name)throw Object.assign(new Error("File name is required"),{status:400});
    if(!Number.isSafeInteger(size)||size<1||size>this.maxFileBytes)throw Object.assign(new Error(`File size must be between 1 byte and ${this.maxFileBytes} bytes`),{status:413});
    this.cleanup();let activeOwnerBytes=0,activeBytes=0;
    for(const entry of fs.readdirSync(this.root)){if(!SESSION_ID.test(entry))continue;try{const other=this.read(entry);activeBytes+=Number(other.size)||0;if(other.owner===owner)activeOwnerBytes+=Number(other.size)||0}catch{}}
    if(activeOwnerBytes+size>this.maxOwnerBytes)throw Object.assign(new Error("Active upload storage quota exceeded; finish or cancel an existing upload"),{status:413});
    const stat=fs.statfsSync(this.root),freeBytes=Number(stat.bavail)*Number(stat.bsize);
    if(freeBytes-activeBytes-size*2<this.minFreeBytes)throw Object.assign(new Error("Not enough free storage to upload and finalize this file"),{status:507});
    const id=crypto.randomUUID(),now=new Date().toISOString(),totalChunks=Math.ceil(size/this.chunkBytes);
    const meta={id,owner,name,size,mime:String(mime||"application/octet-stream").slice(0,160),chunkBytes:this.chunkBytes,totalChunks,received:{},createdAt:now,updatedAt:now};
    fs.mkdirSync(this.dir(id),{recursive:false,mode:0o700});atomicJson(this.metaFile(id),meta);return meta;
  }
  public(meta){return {id:meta.id,name:meta.name,size:meta.size,mime:meta.mime,chunkBytes:meta.chunkBytes,totalChunks:meta.totalChunks,received:Object.keys(meta.received).map(Number).sort((a,b)=>a-b),createdAt:meta.createdAt,updatedAt:meta.updatedAt}}
  async putChunk(args){return this.locked(String(args.id),()=>this._putChunk(args))}
  async _putChunk({id,owner,index,input,contentLength,digest}){
    const meta=this.owned(id,owner);index=Number(index);
    if(!Number.isSafeInteger(index)||index<0||index>=meta.totalChunks)throw Object.assign(new Error("Invalid chunk index"),{status:400});
    const expected=index===meta.totalChunks-1?meta.size-index*meta.chunkBytes:meta.chunkBytes;
    if(contentLength!==expected||contentLength>ABSOLUTE_CHUNK_BYTES)throw Object.assign(new Error(`Chunk ${index} must contain exactly ${expected} bytes`),{status:400});
    digest=safeDigest(digest,"Chunk SHA-256 digest");
    if(meta.received[index]){
      if(meta.received[index].sha256!==digest||meta.received[index].size!==expected)throw Object.assign(new Error("Chunk retry does not match the stored chunk"),{status:409});
      input.resume();return this.public(meta);
    }
    const tmp=path.join(this.dir(id),`.${index}.${crypto.randomBytes(6).toString("hex")}.tmp`),target=path.join(this.dir(id),`${index}.part`);
    const hash=crypto.createHash("sha256");let bytes=0;
    input.on("data",chunk=>{bytes+=chunk.length;hash.update(chunk)});
    try{await pipeline(input,fs.createWriteStream(tmp,{flags:"wx",mode:0o600}));const actual=hash.digest("hex");if(bytes!==expected||actual!==digest)throw Object.assign(new Error("Chunk size or digest verification failed"),{status:400});fs.renameSync(tmp,target)}catch(err){fs.rmSync(tmp,{force:true});throw err}
    meta.received[index]={size:bytes,sha256:digest};meta.updatedAt=new Date().toISOString();atomicJson(this.metaFile(id),meta);return this.public(meta);
  }
  async assemble(args){return this.locked(String(args.id),()=>this._assemble(args))}
  async _assemble({id,owner,digest,destination}){
    const meta=this.owned(id,owner);digest=safeDigest(digest);
    if(Object.keys(meta.received).length!==meta.totalChunks)throw Object.assign(new Error("Upload is incomplete"),{status:409});
    const tmp=`${destination}.${crypto.randomBytes(6).toString("hex")}.uploading`,hash=crypto.createHash("sha256");let bytes=0;
    const out=fs.createWriteStream(tmp,{flags:"wx",mode:0o660});
    try{
      for(let i=0;i<meta.totalChunks;i++)await pipeline(fs.createReadStream(path.join(this.dir(id),`${i}.part`)),async function*(source){for await(const chunk of source){bytes+=chunk.length;hash.update(chunk);yield chunk}},out,{end:false});
      await new Promise((resolve,reject)=>out.end(err=>err?reject(err):resolve()));
      if(bytes!==meta.size||hash.digest("hex")!==digest)throw Object.assign(new Error("Final file size or SHA-256 verification failed"),{status:400});
      inspectUpload(tmp,meta.name);fs.renameSync(tmp,destination);fs.rmSync(this.dir(id),{recursive:true,force:true});return meta;
    }catch(err){out.destroy();fs.rmSync(tmp,{force:true});throw err}
  }
  async cancel(id,owner){return this.locked(String(id),()=>{this.owned(id,owner);fs.rmSync(this.dir(id),{recursive:true,force:true})})}
  cleanup(now=Date.now()){let removed=0;for(const name of fs.readdirSync(this.root)){if(!SESSION_ID.test(name))continue;try{const meta=this.read(name);if(now-Date.parse(meta.updatedAt)>this.ttlMs){fs.rmSync(this.dir(name),{recursive:true,force:true});removed++}}catch{try{const st=fs.statSync(path.join(this.root,name));if(now-st.mtimeMs>this.ttlMs){fs.rmSync(path.join(this.root,name),{recursive:true,force:true});removed++}}catch{}}}return removed}
}

module.exports={ResumableUploadStore,ownerKey,inspectUpload,DEFAULT_CHUNK_BYTES,ABSOLUTE_CHUNK_BYTES,MIB};
