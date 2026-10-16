"use strict";
// A fresh public IPv4 resolution is pinned into each TLS request. No redirects,
// cookies, authentication headers, arbitrary ports or private network access.
const https=require('node:https'),dns=require('node:dns').promises,net=require('node:net');
function publicAddress(ip){if(net.isIP(ip)!==4)return false;const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19));}
function safeUrl(raw,origins){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hash||net.isIP(u.hostname)||u.hostname==='localhost'||!u.hostname.includes('.'))throw Error('Use a public HTTPS source without credentials');if([...u.searchParams.keys()].some(k=>/^(?:token|key|api[-_]?key|access[-_]?token|signature|secret|password|auth)$/i.test(k)))throw Error('Credential-bearing Sports URLs are unsupported; use a public feed');if(origins&&!origins.includes(u.origin))throw Error('Source origin is not approved');return u}
async function fetchPublic(raw,{origins,maxBytes=2097152,timeout=8000,lookup=dns.lookup,request=https.request}={}){
 const u=safeUrl(raw,origins);let timer;
 const addresses=await Promise.race([lookup(u.hostname,{all:true,family:4}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Source DNS timed out')),3000);timer.unref?.()})]).finally(()=>clearTimeout(timer));
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Source does not resolve to public addresses');
 return new Promise((resolve,reject)=>{
  const req=request(u,{autoSelectFamily:false,headers:{'User-Agent':'RoomGoblin Sports/1.0','Accept-Encoding':'identity'},lookup:(_host,_opts,cb)=>cb(null,addresses[0].address,4)},res=>{
   if(res.statusCode!==200){res.resume();reject(Error(res.statusCode===429?'Source rate limited':'Source unavailable'));return}
   if(Number(res.headers['content-length'])>maxBytes){res.destroy();reject(Error('Source is too large'));return}
   const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){req.destroy(Error('Source is too large'));return}chunks.push(chunk)});res.on('error',reject);res.on('end',()=>resolve({body:Buffer.concat(chunks),type:String(res.headers['content-type']||'').split(';')[0]}));
  });const deadline=setTimeout(()=>req.destroy(Error('Source timed out')),timeout);req.on('close',()=>clearTimeout(deadline));req.on('error',reject);req.end();
 });
}
module.exports={publicAddress,safeUrl,fetchPublic};
