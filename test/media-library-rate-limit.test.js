"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),express=require("express"),{rateLimit}=require("express-rate-limit");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
const code=block("function authenticationUnavailable(","\nfunction administratorAccessAllowed(")+block("function requireCapability(","\nfunction requireClassroomRead(")+block("const mediaLibraryMutationLimit=rateLimit(",'\napp.post("/api/v1/media/:name/display"');
async function fixture(t,{legacy=false}={}){
 const app=express();app.use(express.json());let owners=0;
 vm.runInNewContext(code,{app,rateLimit,CONTROL_TOKEN:"fixture-control",dbStore:{authEnabled:()=>!legacy,userCount:()=>1},secureTokenEqual:(a,b)=>a===b,
 requestUser:req=>req.get("x-fixture-role")?{capabilities:req.get("x-fixture-role")==="media"?["media.manage"]:[]}:null,hasCapability:(user,cap)=>!!user?.capabilities.includes(cap),safeStoredName:name=>name,MEDIA_DIR:"/fixture",path,fs:{existsSync:()=>false},mediaLibrary:{files:{}},withMediaFileWrite:async(_name,task)=>{owners++;return task()},commitMediaLibraryRecord:()=>{},audit:()=>{}});
 const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
 return{owners:()=>owners,async request({convert=true,role="media",token="",id="fixture",ip="198.51.100.1"}={}){const r=await fetch("http://127.0.0.1:"+server.address().port+"/api/v1/media/"+id+(convert?"/convert":""),{method:convert?"POST":"DELETE",headers:{"content-type":"application/json","x-fixture-role":role,"x-control-token":token,"x-forwarded-for":ip},body:"{}"});const body=await r.json();return{r,body}}};
}
test("conversion and deletion share a fixed budget before any file owner runs",async t=>{
 const h=await fixture(t);for(let i=0;i<30;i++)assert.equal((await h.request({convert:i%2===0,id:"file-"+i,ip:"198.51.100."+(i+1)})).r.status,i%2===0?404:200);
 for(const convert of [true,false]){const {r,body}=await h.request({convert,id:"another",ip:"203.0.113.9"});assert.equal(r.status,429);assert.match(body.error,/library operation limit/);assert.ok(Number(r.headers.get("retry-after"))>0)}
 assert.equal(h.owners(),30);
});
test("anonymous and capability-rejected library mutations cannot consume the budget",async t=>{
 const h=await fixture(t);for(let i=0;i<20;i++){assert.equal((await h.request({role:""})).r.status,401);assert.equal((await h.request({convert:false,role:"viewer"})).r.status,403)}
 assert.equal(h.owners(),0);for(let i=0;i<30;i++)assert.equal((await h.request({convert:false})).r.status,200);assert.equal((await h.request()).r.status,429);assert.equal((await h.request({role:"viewer"})).r.status,403);
});
test("legacy rejected tokens cannot exhaust the authorized library mutation budget",async t=>{
 const h=await fixture(t,{legacy:true});for(let i=0;i<35;i++)assert.equal((await h.request({token:"wrong"})).r.status,401);for(let i=0;i<30;i++)assert.equal((await h.request({convert:false,token:"fixture-control"})).r.status,200);assert.equal((await h.request({token:"fixture-control"})).r.status,429);assert.equal(h.owners(),30);
});
