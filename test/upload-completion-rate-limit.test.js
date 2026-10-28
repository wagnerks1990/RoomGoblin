"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),express=require("express"),{rateLimit}=require("express-rate-limit");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
const authorization=block("function authenticationUnavailable(","\nfunction administratorAccessAllowed(")+block("function requireCapability(","\nfunction requireClassroomRead(");
const completion=block("const mediaUploadCompletionLimit=rateLimit(","\napp.post(\"/api/v1/media\"")+block('app.post("/api/v1/media",','\napp.post("/api/v1/media/uploads",')+block('app.post("/api/v1/media/uploads/:id/complete"','\nconst mediaUploadCancelLimit=');
async function fixture(t,{legacy=false,configured=true}={}){
 const app=express();app.use(express.json());let writes=0;
 const c=vm.createContext({app,rateLimit,upload:{single:()=> (_req,_res,next)=>next()},CONTROL_TOKEN:configured?"fixture-control":"",dbStore:{authEnabled:()=>!legacy,userCount:()=>0},secureTokenEqual:(a,b)=>a===b,
 requestUser:req=>req.get("x-fixture-role")?{id:"fixture",capabilities:req.get("x-fixture-role")==="media"?["media.manage"]:[]}:null,hasCapability:(user,cap)=>!!user?.capabilities.includes(cap),
 resumableUploads:{owned(){writes++;throw Object.assign(Error("fixture session not found"),{status:404})}},ownerKey:()=>"fixture"});
 vm.runInContext(authorization+completion,c);
 app.put("/api/v1/media/uploads/:id/chunks/:index",(_req,res)=>res.json({ok:true}));
 const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
 const base="http://127.0.0.1:"+server.address().port;
 return{writes:()=>writes,async request({role="media",token="",id="fixture",ip="198.51.100.1",chunk=false,multipart=false}={}){
 const response=await fetch(base+(multipart?"/api/v1/media":"/api/v1/media/uploads/"+id+(chunk?"/chunks/0":"/complete")),{method:chunk?"PUT":"POST",headers:{"content-type":"application/json","x-fixture-role":role,"x-control-token":token,"x-forwarded-for":ip},body:"{}"});const body=await response.json();return{response,body};
 }};
}
test("completion has a fixed shared budget and leaves chunk transfers independent",async t=>{
 const h=await fixture(t);for(let i=0;i<12;i++)assert.equal((await h.request({id:"session-"+i,ip:"198.51.100."+(i+1)})).response.status,404);
 const blocked=await h.request({id:"another-session",ip:"203.0.113.7"});assert.equal(blocked.response.status,429);assert.match(blocked.body.error,/completion limit/);assert.ok(Number(blocked.response.headers.get("retry-after"))>0);assert.ok(blocked.response.headers.get("ratelimit"));assert.equal(h.writes(),12);assert.equal((await h.request({chunk:true})).response.status,200);
});
test("rejected anonymous and capability-limited callers cannot consume completion budget",async t=>{
 const h=await fixture(t);for(let i=0;i<20;i++){assert.equal((await h.request({role:""})).response.status,401);assert.equal((await h.request({role:"viewer"})).response.status,403)}
 assert.equal(h.writes(),0);for(let i=0;i<12;i++)assert.equal((await h.request()).response.status,404);assert.equal((await h.request()).response.status,429);assert.equal((await h.request({role:"viewer"})).response.status,403);assert.equal(h.writes(),12);
});
test("legacy control-token authorization shares the same accepted-caller boundary",async t=>{
 const h=await fixture(t,{legacy:true});for(let i=0;i<20;i++)assert.equal((await h.request({token:"wrong"})).response.status,401);
 for(let i=0;i<12;i++)assert.equal((await h.request({token:"fixture-control"})).response.status,404);
 assert.equal((await h.request({token:"fixture-control"})).response.status,429);assert.equal(h.writes(),12);
});
test("unconfigured authentication fails closed without reaching upload storage",async t=>{
 const h=await fixture(t,{legacy:true,configured:false});for(let i=0;i<14;i++)assert.equal((await h.request()).response.status,503);assert.equal(h.writes(),0);
});
test("completion middleware remains before the media capability guard",()=>{
 assert.match(source,/app\.post\("\/api\/v1\/media\/uploads\/:id\/complete",mediaUploadCompletionLimit,requireCapability\("media\.manage"\),async/);
});
test("legacy multipart uploads share the completion budget before file parsing",async t=>{
 const h=await fixture(t);assert.equal((await h.request({multipart:true,role:"viewer"})).response.status,403);
 for(let i=0;i<11;i++)assert.equal((await h.request()).response.status,404);
 assert.equal((await h.request({multipart:true})).response.status,400);
 assert.equal((await h.request()).response.status,429);assert.equal((await h.request({multipart:true})).response.status,429);assert.equal(h.writes(),11);
});
