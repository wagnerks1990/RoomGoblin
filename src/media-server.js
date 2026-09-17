"use strict";

const http=require("http");
const fs=require("fs");
const path=require("path");

const PORT=Math.max(1,Math.min(65535,Number(process.env.MEDIA_PLANE_PORT||3020)));
const BIND_ADDRESS=String(process.env.MEDIA_PLANE_BIND_ADDRESS||process.env.BIND_ADDRESS||"0.0.0.0").replace(/^\[|\]$/g,"");
const CONTROL_PORT=Math.max(1,Math.min(65535,Number(process.env.PORT||3000)));
const DATA_DIR=path.resolve(process.env.DATA_DIR||path.join(__dirname,"..","data"));
const MEDIA_DIR=path.join(DATA_DIR,"media");
const CONTROL_ORIGIN=`http://127.0.0.1:${CONTROL_PORT}`;
const MAX_AUTH_RESPONSE_BYTES=16*1024;

const MIME=Object.freeze({
  ".mp4":"video/mp4",
  ".m4v":"video/x-m4v",
  ".webm":"video/webm",
  ".mov":"video/quicktime",
  ".mp3":"audio/mpeg",
  ".m4a":"audio/mp4",
  ".aac":"audio/aac",
  ".ogg":"audio/ogg",
  ".oga":"audio/ogg",
  ".wav":"audio/wav"
});

function safeMediaPath(pathname){
  if(!pathname.startsWith("/media/"))return null;
  let relative;
  try{relative=decodeURIComponent(pathname.slice("/media/".length))}catch{return null}
  if(!relative||relative.includes("\0"))return null;
  const candidate=path.resolve(MEDIA_DIR,relative);
  const prefix=MEDIA_DIR.endsWith(path.sep)?MEDIA_DIR:MEDIA_DIR+path.sep;
  return candidate.startsWith(prefix)?candidate:null;
}

function authorizeWithControlPlane(reqUrl,clientHeaders={}){
  return new Promise((resolve,reject)=>{
    const upstream=new URL(reqUrl,CONTROL_ORIGIN);
    upstream.protocol="http:";
    upstream.hostname="127.0.0.1";
    upstream.port=String(CONTROL_PORT);
    const headers={"user-agent":"RoomGoblin-Media-Plane/1","accept":"*/*"};
    const cookie=String(clientHeaders.cookie||"").trim();
    if(cookie)headers.cookie=cookie;
    const request=http.request(upstream,{method:"HEAD",headers},response=>{
      let bytes=0;
      response.on("data",chunk=>{bytes+=chunk.length;if(bytes>MAX_AUTH_RESPONSE_BYTES)request.destroy(new Error("authorization response too large"))});
      response.on("end",()=>resolve({ok:response.statusCode>=200&&response.statusCode<300,statusCode:response.statusCode||502}));
      response.resume();
    });
    request.setTimeout(3000,()=>request.destroy(new Error("authorization timeout")));
    request.on("error",reject);
    request.end();
  });
}

function parseRange(value,size){
  if(!value)return null;
  const match=/^bytes=(\d*)-(\d*)$/.exec(String(value).trim());
  if(!match)return {invalid:true};
  let start=match[1]===""?null:Number(match[1]);
  let end=match[2]===""?null:Number(match[2]);
  if(start===null){
    const suffix=end;
    if(!Number.isInteger(suffix)||suffix<=0)return {invalid:true};
    start=Math.max(0,size-suffix);end=size-1;
  }else{
    if(!Number.isInteger(start)||start<0||start>=size)return {invalid:true};
    if(end===null)end=size-1;
    if(!Number.isInteger(end)||end<start)return {invalid:true};
    end=Math.min(end,size-1);
  }
  return {start,end};
}

async function handle(req,res){
  const method=String(req.method||"GET").toUpperCase();
  if(req.url==="/health"||req.url?.startsWith("/health?")){
    res.writeHead(200,{"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
    res.end(JSON.stringify({ok:true,service:"roomgoblin-media-plane",port:PORT}));
    return;
  }
  if(method!=="GET"&&method!=="HEAD"){
    res.writeHead(405,{allow:"GET, HEAD","cache-control":"no-store"});res.end();return;
  }
  let parsed;
  try{parsed=new URL(req.url||"/","http://media.local")}catch{res.writeHead(400);res.end();return}
  const file=safeMediaPath(parsed.pathname);
  if(!file){res.writeHead(404,{"cache-control":"no-store"});res.end();return}

  let auth;
  try{auth=await authorizeWithControlPlane(req.url,req.headers)}catch{
    res.writeHead(503,{"cache-control":"no-store","retry-after":"1"});res.end();return;
  }
  if(!auth.ok){res.writeHead(auth.statusCode===401||auth.statusCode===403?auth.statusCode:403,{"cache-control":"no-store"});res.end();return}

  let stat;
  try{stat=await fs.promises.stat(file)}catch{res.writeHead(404,{"cache-control":"no-store"});res.end();return}
  if(!stat.isFile()){res.writeHead(404,{"cache-control":"no-store"});res.end();return}

  const range=parseRange(req.headers.range,stat.size);
  if(range?.invalid){
    res.writeHead(416,{"content-range":`bytes */${stat.size}`,"accept-ranges":"bytes","cache-control":"private, max-age=60"});res.end();return;
  }
  const contentType=MIME[path.extname(file).toLowerCase()]||"application/octet-stream";
  const common={
    "content-type":contentType,
    "accept-ranges":"bytes",
    "cache-control":"private, max-age=60",
    "x-content-type-options":"nosniff",
    "cross-origin-resource-policy":"cross-origin"
  };
  if(range){
    const length=range.end-range.start+1;
    res.writeHead(206,{...common,"content-length":length,"content-range":`bytes ${range.start}-${range.end}/${stat.size}`});
    if(method==="HEAD"){res.end();return}
    const stream=fs.createReadStream(file,{start:range.start,end:range.end});
    stream.on("error",()=>res.destroy());
    req.on("aborted",()=>stream.destroy());
    stream.pipe(res);
    return;
  }
  res.writeHead(200,{...common,"content-length":stat.size});
  if(method==="HEAD"){res.end();return}
  const stream=fs.createReadStream(file);
  stream.on("error",()=>res.destroy());
  req.on("aborted",()=>stream.destroy());
  stream.pipe(res);
}

const server=http.createServer((req,res)=>{handle(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500,{"cache-control":"no-store"});res.end()})});
server.keepAliveTimeout=5000;
server.headersTimeout=10000;
server.requestTimeout=0;
server.listen(PORT,BIND_ADDRESS,()=>console.log(`RoomGoblin media plane listening on ${BIND_ADDRESS}:${PORT}`));

function shutdown(){server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),5000).unref()}
process.on("SIGTERM",shutdown);
process.on("SIGINT",shutdown);
