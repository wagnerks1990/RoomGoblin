"use strict";

// A separate loopback listener is the public student's only tunnel destination.
// An older Hub release has no such listener, so rollback closes this surface.
const http=require('node:http');
const net=require('node:net');
const publicRequests=new WeakSet();
const SETTINGS='learning.platform';
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const staticPaths=new Set([
  '/learn/sdk/roomgoblin-scorm.js','/favicon.ico']);
const learnerReads=new RegExp(`^/api/v1/learning/(?:me|classes/${UUID}|activities/${UUID}(?:/(?:receipt))?|platform/activities/${UUID}/state)$`);
const learnerWrites=new RegExp(`^/api/v1/learning/(?:logout|activities/${UUID}/(?:posts|submit|lms-sync)|platform/activities/${UUID}/(?:events|presence))$`);
const learnerEdits=new RegExp(`^/api/v1/learning/activities/${UUID}/posts/${UUID}$`);
const launches=new RegExp(`^/learn/lti/${UUID}$`);
function publicOrigin(store){
  try{const cfg=store.getPreference(SETTINGS,{});if(cfg?.publicEnabled!==true)return null;const u=new URL(cfg.publicOrigin);return u.protocol==='https:'&&u.origin===cfg.publicOrigin&&!u.username&&!u.password&&!net.isIP(u.hostname)?u.origin:null;}catch{return null;}
}
function allowedPath(method,raw){
  if(typeof raw!=='string'||raw.length>4096||/[\\\u0000-\u0020]/.test(raw))return false;
  const pathname=raw.split('?')[0];
  // Reject encodings and dot segments before Express can reinterpret a route.
  if(pathname.includes('%')||pathname.split('/').includes('..')||pathname.split('/').includes('.'))return false;
  const direct=require('./learning-direct');if(pathname.startsWith('/api/v1/learning/direct/'))return method==='OPTIONS'?['GET','POST','PUT'].some(m=>direct.route(m,pathname)):!!direct.route(method,pathname);
  if(method==='GET'||method==='HEAD')return staticPaths.has(pathname)||learnerReads.test(pathname)||new RegExp(`^/learn/connect-info/${UUID}$`).test(pathname);
  if(method==='POST')return pathname==='/learn/connect/start'||launches.test(pathname)||learnerWrites.test(pathname);
  return method==='PUT'&&learnerEdits.test(pathname);
}
function publicHeaders(res,store){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  // A checked postMessage channel connects a Schoology SCO and its companion.
  res.setHeader('Cross-Origin-Opener-Policy','unsafe-none');
  const configured=store?.getPreference('learning.bridgeOrigins',[]);
  const origins=store?.getPreference(SETTINGS,{})?.embeddedEnabled===true&&Array.isArray(configured)?configured.filter(value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value&&!u.username&&!u.password&&!value.includes('*');}catch{return false;}}):[];
  // Only previously approved LMS origins can contain this student surface.
  // The administrator/control-plane headers and route boundary are unchanged.
  if(origins.length)res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy',"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors "+(origins.length?origins.join(' '):"'none'")+"; frame-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'");
}
function isPublicRequest(req){return publicRequests.has(req);}
async function probeStudentGateway(origin){
 const host=new URL(origin).host;
 const check=path=>new Promise(resolve=>{const request=http.get({host:'127.0.0.1',port:3030,path,headers:{Host:host,'X-Forwarded-Proto':'https'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});request.setTimeout(3000,()=>request.destroy());request.on('error',()=>resolve(0));});
 return await check('/api/v1/learning/me')===401&&await check('/controller/')===404&&await check('/learn/sdk/roomgoblin-scorm.js')===200;
}
function createStudentGateway({app,store,allowLoopbackHttp=false,isStopping=()=>false,clock=Date.now}){
  const buckets=new Map();
  const deny=(res,status,message)=>{publicHeaders(res);res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:message}));};
  const server=http.createServer((req,res)=>{
    const origin=publicOrigin(store);if(!origin||isStopping())return deny(res,503,'Student connection is not available.');
    const peer=String(req.socket.remoteAddress||'');
    const loopback=peer==='127.0.0.1'||peer==='::1'||peer==='::ffff:127.0.0.1';
    if(!loopback||req.headers.host?.toLowerCase()!==new URL(origin).host||(!allowLoopbackHttp&&req.headers['x-forwarded-proto']!=='https'))return deny(res,404,'Not found.');
    if(!allowedPath(req.method,req.url))return deny(res,404,'Not found.');
    const supplied=String(req.headers['cf-connecting-ip']||'');
    const address=net.isIP(supplied)?supplied:peer,now=clock(),window=Math.floor(now/60000);
    for(const [key,item] of buckets)if(item.window!==window)buckets.delete(key);
    if(!buckets.has(address)&&buckets.size>=10000)return deny(res,429,'Connection limit reached. Try again shortly.');
    const item=buckets.get(address)||{window,count:0};item.count++;buckets.set(address,item);
    if(item.count>1200){res.setHeader('Retry-After','60');return deny(res,429,'Connection limit reached. Try again shortly.');}
    publicRequests.add(req);
    // The shared application sets its usual headers first. Reapply the stricter
    // student policy immediately before the response is committed.
    const writeHead=res.writeHead;res.writeHead=function(status,message,headers){
      const supplied=typeof message==='object'?message:headers;
      if(supplied){if(Array.isArray(supplied)){for(let i=0;i<supplied.length;i+=2)this.setHeader(supplied[i],supplied[i+1]);}else for(const [key,value] of Object.entries(supplied))this.setHeader(key,value);}
      publicHeaders(this,store);return typeof message==='string'?writeHead.call(this,status,message):writeHead.call(this,status);
    };
    app(req,res);
  });
  server.headersTimeout=10000;server.requestTimeout=30000;server.keepAliveTimeout=5000;
  server.maxRequestsPerSocket=100;
  server.on('upgrade',(_req,socket)=>{socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');});
  return server;
}
module.exports={SETTINGS,publicOrigin,allowedPath,isPublicRequest,createStudentGateway,probeStudentGateway};
