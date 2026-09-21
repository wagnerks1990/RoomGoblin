(function(global){"use strict";
const MAX_BYTES=5*1024*1024*1024;
const encoder=new TextEncoder();
function hex(buffer){return [...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,"0")).join("")}
class Sha256{
 constructor(){this.h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);this.buf=new Uint8Array(64);this.used=0;this.bytes=0}
 block(b){const k=Sha256.k,w=new Uint32Array(64);for(let i=0;i<16;i++)w[i]=(b[i*4]<<24)|(b[i*4+1]<<16)|(b[i*4+2]<<8)|b[i*4+3];for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2],s0=((x>>>7)|(x<<25))^((x>>>18)|(x<<14))^(x>>>3),s1=((y>>>17)|(y<<15))^((y>>>19)|(y<<13))^(y>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0}let[a,c,d,e,f,g,h,j]=this.h;for(let i=0;i<64;i++){const s1=((f>>>6)|(f<<26))^((f>>>11)|(f<<21))^((f>>>25)|(f<<7)),ch=(f&g)^(~f&h),t1=(j+s1+ch+k[i]+w[i])>>>0,s0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10)),maj=(a&c)^(a&d)^(c&d),t2=(s0+maj)>>>0;j=h;h=g;g=f;f=(e+t1)>>>0;e=d;d=c;c=a;a=(t1+t2)>>>0}const q=[a,c,d,e,f,g,h,j];for(let i=0;i<8;i++)this.h[i]=(this.h[i]+q[i])>>>0}
 update(data){data=data instanceof Uint8Array?data:new Uint8Array(data);this.bytes+=data.length;for(const value of data){this.buf[this.used++]=value;if(this.used===64){this.block(this.buf);this.used=0}}return this}
 digest(){const bits=this.bytes*8;this.buf[this.used++]=0x80;if(this.used>56){this.buf.fill(0,this.used);this.block(this.buf);this.used=0}this.buf.fill(0,this.used,56);const hi=Math.floor(bits/0x100000000),lo=bits>>>0;for(let i=0;i<4;i++){this.buf[56+i]=(hi>>>(24-i*8))&255;this.buf[60+i]=(lo>>>(24-i*8))&255}this.block(this.buf);return [...this.h].map(x=>x.toString(16).padStart(8,"0")).join("")}
}
Sha256.k=new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function key(file){return `roomgoblin-upload:${file.name}:${file.size}:${file.lastModified}`}
async function json(response){let body={};try{body=await response.json()}catch{}if(!response.ok)throw Error(body.error||`Upload failed (HTTP ${response.status})`);return body}
async function chunkDigest(bytes){return hex(await crypto.subtle.digest("SHA-256",bytes))}
async function startOrResume(file){
 let saved=null;try{saved=JSON.parse(localStorage.getItem(key(file))||"null")}catch{}
 if(saved?.id){const r=await fetch(`/api/v1/media/uploads/${encodeURIComponent(saved.id)}`);if(r.ok)return (await r.json()).upload;localStorage.removeItem(key(file))}
 const response=await fetch("/api/v1/media/uploads",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name,size:file.size,mime:file.type})}),body=await json(response);localStorage.setItem(key(file),JSON.stringify({id:body.upload.id}));return body.upload;
}
async function upload(file,{signal,onProgress=()=>{}}={}){
 if(!file||file.size<1||file.size>MAX_BYTES)throw Error("Choose a file between 1 byte and 5 GB.");
 const session=await startOrResume(file),received=new Set(session.received||[]),full=new Sha256();let uploaded=0;
 for(let index=0;index<session.totalChunks;index++){
  if(signal?.aborted)throw new DOMException("Upload paused","AbortError");
  const start=index*session.chunkBytes,end=Math.min(file.size,start+session.chunkBytes),bytes=new Uint8Array(await file.slice(start,end).arrayBuffer());full.update(bytes);
  if(!received.has(index)){
   const digest=await chunkDigest(bytes);let response,error;
   for(let attempt=1;attempt<=3;attempt++){try{response=await fetch(`/api/v1/media/uploads/${encodeURIComponent(session.id)}/chunks/${index}`,{method:"PUT",headers:{"Content-Type":"application/octet-stream","X-Chunk-SHA256":digest},body:bytes,signal});if(response.ok)break;error=Error((await response.json().catch(()=>({}))).error||`Chunk ${index+1} failed`)}catch(err){error=err;if(signal?.aborted)throw err}}
   if(!response?.ok)throw error||Error(`Chunk ${index+1} failed`);
  }
  uploaded=end;onProgress({uploaded,total:file.size,percent:Math.floor(uploaded/file.size*100),uploadId:session.id});
 }
 const response=await fetch(`/api/v1/media/uploads/${encodeURIComponent(session.id)}/complete`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha256:full.digest()}),signal}),body=await json(response);localStorage.removeItem(key(file));return body;
}
async function cancel(file){let saved;try{saved=JSON.parse(localStorage.getItem(key(file))||"null")}catch{}if(saved?.id)await fetch(`/api/v1/media/uploads/${encodeURIComponent(saved.id)}`,{method:"DELETE"});localStorage.removeItem(key(file))}
global.RoomGoblinUpload={upload,cancel,MAX_BYTES};
})(window);
