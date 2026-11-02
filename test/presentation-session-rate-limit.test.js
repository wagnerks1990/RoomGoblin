"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),express=require("express"),{rateLimit}=require("express-rate-limit");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
const code=block("function authenticationUnavailable(","\nfunction administratorAccessAllowed(")+block("function requireCapability(","\nfunction requireClassroomRead(")+block("const presentationSessionMutationLimit=rateLimit(",'\napp.get("/api/v1/presentations"')+block('app.delete("/api/v1/presentations/folders/:id"','\napp.post("/api/v1/presentations/upload"')+block('app.delete("/api/v1/presentations/:id"',"\n// Media Library uploads");
async function fixture(t,{legacy=false}={}){
 const app=express();app.use(express.json());let owners=0,controls=0;
 vm.runInNewContext(code,{app,rateLimit,CONTROL_TOKEN:"fixture-control",dbStore:{authEnabled:()=>!legacy,userCount:()=>1},secureTokenEqual:(a,b)=>a===b,requestUser:req=>req.get("x-fixture-role")?{capabilities:req.get("x-fixture-role")==="media"?["media.manage"]:[]}:null,hasCapability:(user,cap)=>!!user?.capabilities.includes(cap),presentationLibrary:{folders:{},presentations:{}},withPresentationSession:async task=>{owners++;return task()},controlPresentation:async()=>{controls++;return{active:false}}});
 const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
 return{owners:()=>owners,controls:()=>controls,async request({kind="start",role="media",token="",id="missing",ip="198.51.100.1"}={}){const route=kind==="folder"?"/folders/"+id:kind==="control"?"/control":"/"+id+(kind==="start"?"/start":"");const r=await fetch("http://127.0.0.1:"+server.address().port+"/api/v1/presentations"+route,{method:["start","control"].includes(kind)?"POST":"DELETE",headers:{"content-type":"application/json","x-fixture-role":role,"x-control-token":token,"x-forwarded-for":ip},body:JSON.stringify({action:"stop"})});return{r,body:await r.json()}}};
}
test("starts, deck removal and folder removal share one budget before session admission",async t=>{
 const h=await fixture(t),kinds=["start","delete","folder"];for(let i=0;i<30;i++)assert.equal((await h.request({kind:kinds[i%3],id:"missing-"+i,ip:"198.51.100."+(i+1)})).r.status,i%3===2?400:404);
 for(const kind of kinds){const {r,body}=await h.request({kind,ip:"203.0.113.9"});assert.equal(r.status,429);assert.match(body.error,/start\/removal limit/);assert.ok(Number(r.headers.get("retry-after"))>0)}assert.equal(h.owners(),30);
});
test("anonymous and capability-rejected callers cannot consume presentation admission",async t=>{
 const h=await fixture(t);for(let i=0;i<35;i++){assert.equal((await h.request({role:""})).r.status,401);assert.equal((await h.request({role:"viewer"})).r.status,403)}assert.equal(h.owners(),0);for(let i=0;i<30;i++)assert.equal((await h.request()).r.status,404);assert.equal((await h.request()).r.status,429);assert.equal((await h.request({role:"viewer"})).r.status,403);
});
test("legacy rejected tokens cannot consume the authorized presentation budget",async t=>{
 const h=await fixture(t,{legacy:true});for(let i=0;i<35;i++)assert.equal((await h.request({token:"wrong"})).r.status,401);for(let i=0;i<30;i++)assert.equal((await h.request({token:"fixture-control"})).r.status,404);assert.equal((await h.request({token:"fixture-control"})).r.status,429);assert.equal(h.owners(),30);
});
test("live controls including Stop remain available after start/removal exhaustion",async t=>{
 const h=await fixture(t);for(let i=0;i<30;i++)await h.request();assert.equal((await h.request()).r.status,429);assert.equal((await h.request({kind:"control"})).r.status,200);assert.equal(h.controls(),1);assert.equal((await h.request({kind:"control",role:"viewer"})).r.status,403);assert.equal(h.controls(),1);
});
