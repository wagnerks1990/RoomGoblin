"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const {validateAllowedTarget}=require("../src/display-gateway");
const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function fixture(reply=()=>new Response("#EXTM3U")){
 const requests=[],ctx=vm.createContext({Date,URL,AbortController,Response,Buffer,setTimeout,clearTimeout,
  validateDisplayGatewayTarget:validateAllowedTarget,MORNING_ANNOUNCEMENTS_ALLOWED_HOSTS:new Set(["stream.example.test","alternate.example.test"]),
  fetch:async(url,options)=>{requests.push({url:new URL(url),options});return reply(requests.length,url,options)}
 });
 vm.runInContext(section("function announcementsCoordinates(","function announcementsWebSocketUrls(")+
  section("function announcementHlsProbeUrl(","async function probeMorningAnnouncementsWebRtc(")+
  section("async function fetchWithDeadline(","async function probeMorningAnnouncementsLive("),ctx);
 return {ctx,requests};
}
for(const url of [
 "https://stream.example.test.attacker.test/live",
 "https://attacker-stream.example.test/live",
 "https://stream.example.test@attacker.test/live",
 "https://someone@stream.example.test/live",
 "https://stream.example.test:8443/live",
 "ftp://stream.example.test/live",
 "http://127.0.0.1/live",
 "https://stream.example.test./live"
])test("unapproved announcement destination is rejected before transport: "+url,async()=>{
 const h=fixture();await assert.rejects(h.ctx.fetchWithDeadline(url,{},500));assert.equal(h.requests.length,0);
});
test("an exact configured hostname and safe port remain usable",async()=>{
 const h=fixture(),r=await h.ctx.fetchWithDeadline("https://STREAM.EXAMPLE.TEST:443/LiveApp/live.m3u8",{},500);
 assert.equal(await r.text(),"#EXTM3U");assert.equal(h.requests.length,1);assert.equal(h.requests[0].url.origin,"https://stream.example.test");assert.equal(h.requests[0].options.redirect,"manual");
});
for(const path of ["LiveApp/play.html?id=morning","%2F%2Fattacker.test/play.html?id=../other","LiveApp/play.html?id=//attacker.test/path"])
test("path-derived playlist values stay on the configured origin: "+path,async()=>{
 const h=fixture(),coordinates=h.ctx.announcementsCoordinates("https://stream.example.test/"+path);
 const url=h.ctx.announcementHlsProbeUrl(coordinates,"",123);await h.ctx.fetchWithDeadline(url,{},500);
 assert.equal(h.requests.length,1);assert.equal(h.requests[0].url.origin,"https://stream.example.test");assert.equal(h.requests[0].url.username,"");assert.equal(h.requests[0].url.password,"");
});
test("an approved redirect retains exact-host validation",async()=>{
 const h=fixture(n=>n===1?new Response("",{status:302,headers:{location:"https://alternate.example.test/stream.m3u8"}}):new Response("#EXTM3U"));
 await h.ctx.fetchWithDeadline("https://stream.example.test/start",{},500);
 assert.deepEqual(h.requests.map(r=>r.url.origin),["https://stream.example.test","https://alternate.example.test"]);
});
test("an unapproved redirect is rejected before any request reaches it",async()=>{
 const h=fixture(()=>new Response("",{status:302,headers:{location:"https://attacker.test/stream.m3u8"}}));
 await assert.rejects(h.ctx.fetchWithDeadline("https://stream.example.test/start",{},500),/not allowed/);assert.equal(h.requests.length,1);
});
test("approved redirect loops remain bounded",async()=>{
 const h=fixture(()=>new Response("",{status:302,headers:{location:"/again"}}));
 await assert.rejects(h.ctx.fetchWithDeadline("https://stream.example.test/start",{},500),/redirect limit/);assert.equal(h.requests.length,4);
});
