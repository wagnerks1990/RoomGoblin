"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),express=require("express"),{rateLimit}=require("express-rate-limit");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
const code=block("function authenticationUnavailable(","\nfunction administratorAccessAllowed(")+block("function requireCapability(","\nfunction requireClassroomRead(")+block("const mediaUploadCompletionLimit=rateLimit(",'\napp.post("/api/v1/media",')+block('app.post("/api/v1/media/uploads/:id/complete"',"\nconst mediaLibraryMutationLimit=");
async function fixture(t,{legacy=false}={}){
 const app=express();app.use(express.json());let cancelled=0,completed=0;
 vm.runInNewContext(code,{app,rateLimit,CONTROL_TOKEN:"fixture-control",dbStore:{authEnabled:()=>!legacy,userCount:()=>1},secureTokenEqual:(a,b)=>a===b,
 requestUser:req=>req.get("x-fixture-role")?{capabilities:req.get("x-fixture-role")==="media"?["media.manage"]:[]}:null,hasCapability:(user,cap)=>!!user?.capabilities.includes(cap),ownerKey:()=>"fixture",audit:()=>{},
 resumableUploads:{owned(){completed++;throw Object.assign(Error("missing session"),{status:404})},async cancel(id){cancelled++;return{id}}}});
 const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
 return{cancelled:()=>cancelled,completed:()=>completed,async request({cancel=true,role="media",token="",id="fixture",ip="198.51.100.1"}={}){const r=await fetch("http://127.0.0.1:"+server.address().port+"/api/v1/media/uploads/"+id+(cancel?"":"/complete"),{method:cancel?"DELETE":"POST",headers:{"content-type":"application/json","x-fixture-role":role,"x-control-token":token,"x-forwarded-for":ip},body:"{}"});const body=await r.json();return{r,body}}};
}
test("cancellation has a fixed independent budget after completion is exhausted",async t=>{
 const h=await fixture(t);for(let i=0;i<12;i++)assert.equal((await h.request({cancel:false})).r.status,404);assert.equal((await h.request({cancel:false})).r.status,429);
 for(let i=0;i<30;i++){const {r,body}=await h.request({id:"session-"+i,ip:"198.51.100."+(i+1)});assert.equal(r.status,200);assert.equal(body.completed,false)}
 const {r,body}=await h.request({id:"another",ip:"203.0.113.1"});assert.equal(r.status,429);assert.match(body.error,/cancellation limit/);assert.ok(Number(r.headers.get("retry-after"))>0);assert.equal(h.cancelled(),30);assert.equal(h.completed(),12);
});
test("anonymous and capability-rejected cancellation cannot consume its budget",async t=>{
 const h=await fixture(t);for(let i=0;i<20;i++){assert.equal((await h.request({role:""})).r.status,401);assert.equal((await h.request({role:"viewer"})).r.status,403)}assert.equal(h.cancelled(),0);
 for(let i=0;i<30;i++)assert.equal((await h.request()).r.status,200);assert.equal((await h.request()).r.status,429);assert.equal((await h.request({role:"viewer"})).r.status,403);
});
test("legacy rejected tokens cannot consume the cancellation budget",async t=>{
 const h=await fixture(t,{legacy:true});for(let i=0;i<35;i++)assert.equal((await h.request({token:"wrong"})).r.status,401);for(let i=0;i<30;i++)assert.equal((await h.request({token:"fixture-control"})).r.status,200);assert.equal((await h.request({token:"fixture-control"})).r.status,429);assert.equal(h.cancelled(),30);
});
