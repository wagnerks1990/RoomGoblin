"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function fixture(app){
 const h={commands:[],persisted:[],events:[],routes:{},priority:null,command:async()=>({ok:true})};
 const initial={active:true,presentationId:"old",slide:1,targets:["tv1"],sessionId:"old-session",paused:false,black:false,autoAdvanceSeconds:1,startedAt:new Date(Date.now()-30000).toISOString(),slideStartedAt:new Date(Date.now()-30000).toISOString(),timings:{}};
 const ctx=vm.createContext({crypto,Date,presentationLibrary:{folders:{root:{id:"root"},folder:{id:"folder",parentId:"root"},nested:{id:"nested",parentId:"folder"},other:{id:"other",parentId:"root"}},presentations:{old:{id:"old",folderId:"nested",name:"Old",conversionStatus:"ready",slideCount:4},current:{id:"current",folderId:"other",name:"Current",conversionStatus:"ready",slideCount:4}}},PRESENTATION_STATE_FILE:"state",readJson:()=>structuredClone(initial),persistJson:(_key,state)=>h.persisted.push(structuredClone(state)),presentationPublicRecord:r=>r,presentationSlideUrl:(id,slide)=>"/"+id+"/"+slide,
 announcementPriorityError:()=>h.priority,executeCommand:async c=>{h.commands.push(structuredClone(c));return h.command(c)},broadcastControllers:()=>{},audit:e=>h.events.push(e),resolveDisplayTargets:t=>Array.isArray(t)?t:[t],requireCapability:()=> (_req,_res,next)=>next(),
 app:{post:(url,...handlers)=>{h.routes["POST "+url]=handlers.at(-1);app?.post(url,...handlers)},delete:(url,...handlers)=>{h.routes["DELETE "+url]=handlers.at(-1);app?.delete(url,...handlers)}},persistPresentationLibrary:()=>{},deletePresentationRecord:id=>{h.events.push({kind:"removed",id});delete ctx.presentationLibrary.presentations[id]}});
 Object.assign(ctx,{cleanId:String,devices:{tv1:{enabled:true},tv2:{enabled:true}},displayGroups:{all:["tv1","tv2"]}});
 vm.runInContext(block("function resolveDisplayTargets(","\nfunction commandId(")+block("function presentationDescendantFolderIds(","\nfunction presentationFolderWouldCycle(")+block("function defaultPresentationState(){","\nlet presentationAutoAdvanceBusy=")+block('app.delete("/api/v1/presentations/folders/:id"','\napp.post("/api/v1/presentations/upload"')+block('app.delete("/api/v1/presentations/:id"',"\n// Media Library uploads"),ctx);
 h.ctx=ctx;h.state=()=>ctx.presentationStatePublic();h.call=async(method,route,{id="old",body={},query={}}={})=>{const r={status:200},res={status(n){r.status=n;return res},json(v){r.body=v;return res}};await h.routes[method+" "+route]({params:{id},body,query},res);return r};
 h.folder=(id="folder",recursive="1")=>h.call("DELETE","/api/v1/presentations/folders/:id",{id,query:{recursive}});
 h.start=(id,targets=["tv1"],slide=1)=>h.call("POST","/api/v1/presentations/:id/start",{id,body:{targets,slide}});
 h.hold=()=>{const entered=gate(),release=gate();let used=false;h.command=async()=>{if(!used){used=true;entered.resolve();await release.promise}return{ok:true}};return{entered,release}};
 h.block=()=>{const entered=gate(),release=gate(),task=ctx.withPresentationSession(async()=>{entered.resolve();await release.promise});return{entered,release,task}};
 return h;
}
test("overlapping starts retain each deck's slide and receivers until its dispatch finishes",async()=>{
 const h=fixture(),g=h.hold(),a=h.start("old",["tv1"]);await g.entered.promise;const b=h.start("current",["tv2"],2);await Promise.resolve();assert.equal(h.commands.length,1);assert.equal(h.state().presentationId,"old");g.release.resolve();assert.equal((await a).status,200);assert.equal((await b).status,200);
 assert.deepEqual(h.commands.map(c=>[c.type,c.target,c.payload.url]),[["display.clear",["tv1"],undefined],["display.image",["tv1"],"/old/1"],["display.clear",["tv2"],undefined],["display.image",["tv2"],"/current/2"]]);assert.equal(h.state().presentationId,"current");
});
test("accepted navigation stays ordered and does not clear between slides",async()=>{
 const h=fixture(),g=h.hold(),a=h.ctx.controlPresentation("next");await g.entered.promise;const b=h.ctx.controlPresentation("next");assert.equal(h.state().slide,2);assert.equal(h.commands.length,1);g.release.resolve();await Promise.all([a,b]);assert.equal(h.state().slide,3);assert.deepEqual(h.commands.map(c=>[c.type,c.payload.slide]),[["display.image",2],["display.image",3]]);
});
test("a queued old-session control cannot navigate a successor deck",async()=>{
 const h=fixture(),g=h.block();await g.entered.promise;const start=h.start("current",["tv2"]),control=h.ctx.controlPresentation("next");const rejected=assert.rejects(control,e=>e.status===409);g.release.resolve();await g.task;assert.equal((await start).status,200);await rejected;assert.equal(h.state().slide,1);assert.equal(h.state().presentationId,"current");assert.equal(h.commands.length,2);
});
test("explicit stale session identity fails before state changes or dispatch",async()=>{
 const h=fixture();const r=await h.call("POST","/api/v1/presentations/control",{body:{action:"stop",sessionId:"stale"}});assert.equal(r.status,409);assert.equal(h.state().active,true);assert.equal(h.commands.length,0);assert.equal(h.persisted.length,0);
});
for(const target of [undefined,"tv2"])test(`explicit empty receiver selection never falls back to ${target||"all"}`,async()=>{
 const h=fixture(),r=await h.call("POST","/api/v1/presentations/:id/start",{id:"current",body:{targets:[],target}});assert.equal(r.status,400);assert.match(r.body.error,/at least one/);assert.equal(h.commands.length,0);assert.equal(h.state().sessionId,"old-session");
});
test("omitted receiver selection retains the legacy all-display default",async()=>{
 const h=fixture(),r=await h.call("POST","/api/v1/presentations/:id/start",{id:"current"});assert.equal(r.status,200);assert.deepEqual(h.commands.map(c=>c.target),[["tv1","tv2"],["tv1","tv2"]]);
});
test("queued automatic advancement rechecks the slide occurrence after manual navigation",async()=>{
 const h=fixture(),g=h.block();await g.entered.promise;const manual=h.ctx.controlPresentation("next"),automatic=h.ctx.controlPresentation("next",{}, {automatic:true});g.release.resolve();await Promise.all([g.task,manual,automatic]);assert.equal(h.state().slide,2);assert.equal(h.commands.length,1);
});
for(const action of ["pause","stop"])test("queued automatic advancement respects accepted "+action,async()=>{
 const h=fixture(),g=h.block();await g.entered.promise;const manual=h.ctx.controlPresentation(action),automatic=h.ctx.controlPresentation("next",{}, {automatic:true});g.release.resolve();await Promise.all([g.task,manual,automatic]);assert.equal(h.state().slide,1);assert.equal(action==="pause"?h.state().paused:!h.state().active,true);assert.equal(h.commands.filter(c=>c.type==="display.image").length,0);
});
test("queued automatic advancement cannot apply to a new presentation",async()=>{
 const h=fixture(),g=h.block();await g.entered.promise;const start=h.start("current",["tv2"]),automatic=h.ctx.controlPresentation("next",{}, {automatic:true});g.release.resolve();await Promise.all([g.task,start,automatic]);assert.equal(h.state().presentationId,"current");assert.equal(h.state().slide,1);assert.equal(h.commands.length,2);
});
test("deleting an accepted starting presentation waits and then stops before removing it",async()=>{
 const h=fixture(),g=h.hold(),start=h.start("old");await g.entered.promise;let ended=false;const deletion=h.call("DELETE","/api/v1/presentations/:id").then(r=>{ended=true;return r});assert.equal(ended,false);assert.ok(h.ctx.presentationLibrary.presentations.old);g.release.resolve();await start;assert.equal((await deletion).status,200);assert.equal(h.state().active,false);assert.equal(h.ctx.presentationLibrary.presentations.old,undefined);assert.deepEqual(h.commands.map(c=>c.type),["display.clear","display.image","display.clear"]);assert.ok(h.events.findIndex(e=>e.kind==="presentation.stop")<h.events.findIndex(e=>e.kind==="removed"));
});
test("failed dispatch releases the session owner for a subsequent start",async()=>{
 const h=fixture();let failed=false;h.command=async()=>{if(!failed){failed=true;throw Error("dispatch failed")}return{ok:true}};assert.equal((await h.start("old")).status,400);assert.equal((await h.start("current",["tv2"])).status,200);assert.equal(h.state().presentationId,"current");
});
test("an announcement lock acquired while start is queued preserves the existing session",async()=>{
 const h=fixture(),g=h.block();await g.entered.promise;const start=h.start("current",["tv2"]);h.priority=Error("Morning Announcements have priority");g.release.resolve();await g.task;const r=await start;assert.equal(r.status,400);assert.match(r.body.error,/priority/);assert.equal(h.state().presentationId,"old");assert.equal(h.commands.length,0);
});
test("a replaced session during clear cannot send its old slide to successor receivers",async()=>{
 const h=fixture(),g=h.hold(),sending=h.ctx.sendPresentationSlide({clear:true});await g.entered.promise;vm.runInContext('presentationState={...presentationState,presentationId:"current",sessionId:"new",targets:["tv2"],slide:2}',h.ctx);const rejected=assert.rejects(sending,e=>e.status===409);g.release.resolve();await rejected;assert.equal(h.commands.length,1);assert.deepEqual(h.commands[0].target,["tv1"]);
});
test("recursive folder deletion stops its nested live deck before removing any files",async()=>{
 const h=fixture(),g=h.hold(),deletion=h.folder();await g.entered.promise;assert.ok(h.ctx.presentationLibrary.presentations.old);assert.ok(h.ctx.presentationLibrary.folders.nested);assert.equal(h.events.some(e=>e.kind==="removed"),false);g.release.resolve();assert.equal((await deletion).status,200);
 assert.equal(h.state().active,false);assert.equal(h.ctx.presentationLibrary.presentations.old,undefined);assert.ok(h.ctx.presentationLibrary.presentations.current);assert.equal(h.ctx.presentationLibrary.folders.folder,undefined);assert.equal(h.ctx.presentationLibrary.folders.nested,undefined);assert.ok(h.events.findIndex(e=>e.kind==="presentation.stop")<h.events.findIndex(e=>e.kind==="removed"));
});
test("nonrecursive folder refusal does not stop the live deck",async()=>{
 const h=fixture();assert.equal((await h.folder("folder","0")).status,409);assert.equal(h.state().active,true);assert.equal(h.commands.length,0);assert.ok(h.ctx.presentationLibrary.presentations.old);
});
test("root folder deletion remains forbidden without dispatch",async()=>{
 const h=fixture();assert.equal((await h.folder("root")).status,400);assert.equal(h.commands.length,0);assert.ok(h.ctx.presentationLibrary.folders.root);
});
test("a failed live clear keeps the folder and all its deck files available",async()=>{
 const h=fixture();h.command=async()=>{throw Error("clear unavailable")};const r=await h.folder();assert.equal(r.status,400);assert.match(r.body.error,/clear unavailable/);assert.ok(h.ctx.presentationLibrary.presentations.old);assert.ok(h.ctx.presentationLibrary.folders.nested);assert.equal(h.events.some(e=>e.kind==="removed"),false);
});
test("folder deletion preserves a deck moved out while its old live session stops",async()=>{
 const h=fixture(),g=h.hold(),deletion=h.folder();await g.entered.promise;h.ctx.presentationLibrary.presentations.old.folderId="other";g.release.resolve();assert.equal((await deletion).status,200);assert.ok(h.ctx.presentationLibrary.presentations.old);assert.equal(h.ctx.presentationLibrary.folders.folder,undefined);
});
test("folder deletion includes a newly registered member after its stop wait",async()=>{
 const h=fixture(),g=h.hold(),deletion=h.folder();await g.entered.promise;h.ctx.presentationLibrary.presentations.upload={id:"upload",folderId:"nested"};g.release.resolve();assert.equal((await deletion).status,200);assert.equal(h.ctx.presentationLibrary.presentations.upload,undefined);assert.ok(h.events.some(e=>e.kind==="removed"&&e.id==="upload"));
});
test("folder removal waits behind an accepted start before stopping and deleting its deck",async()=>{
 const h=fixture(),g=h.hold(),start=h.start("old");await g.entered.promise;const deletion=h.folder();assert.equal(h.commands.length,1);g.release.resolve();assert.equal((await start).status,200);assert.equal((await deletion).status,200);assert.equal(h.state().active,false);assert.deepEqual(h.commands.map(c=>c.type),["display.clear","display.image","display.clear"]);
});
test("a start queued after folder deletion sees the missing deck before dispatch",async()=>{
 const h=fixture(),g=h.hold(),deletion=h.folder();await g.entered.promise;const start=h.start("old");g.release.resolve();assert.equal((await deletion).status,200);assert.equal((await start).status,404);assert.deepEqual(h.commands.map(c=>c.type),["display.clear"]);
});
test("deleting an unrelated folder does not stop the current presentation",async()=>{
 const h=fixture();assert.equal((await h.folder("other")).status,200);assert.equal(h.state().active,true);assert.equal(h.state().presentationId,"old");assert.equal(h.commands.length,0);assert.equal(h.ctx.presentationLibrary.presentations.current,undefined);
});
for(const action of ["start","control","delete","folder"])test(`disconnected ${action} handlers retain queued session mutation ownership`,{timeout:10000},async t=>{
 const express=require("express"),http=require("node:http"),{once}=require("node:events");
 const {trackApplicationHandlers,waitUntilDrained}=require("../src/application-drain");
 const app=express(),tracker=trackApplicationHandlers(app,{isMutation:req=>req.method!=="GET"});app.use(express.json());
 const h=fixture(app),g=h.hold(),server=http.createServer(app);server.listen(0,"127.0.0.1");await once(server,"listening");
 t.after(()=>{g.release.resolve();server.closeAllConnections();server.close()});
 const base=`http://127.0.0.1:${server.address().port}/api/v1/presentations`;
 function send(route,method="POST",body={}){const req=http.request(base+route,{method,headers:{"content-type":"application/json"}});req.on("error",()=>{});req.on("response",r=>r.resume());req.end(JSON.stringify(body));t.after(()=>req.destroy());return req}
 const first=send("/old/start", "POST", {targets:["tv1"]});await g.entered.promise;
 const next=action==="start"?send("/current/start","POST",{targets:["tv2"]}):action==="control"?send("/control","POST",{action:"pause"}):action==="folder"?send("/folders/folder?recursive=1","DELETE"):send("/old","DELETE");
 await waitUntilDrained(()=>tracker.pendingMutations===2);first.destroy();next.destroy();await new Promise(resolve=>server.close(resolve));
 assert.equal(tracker.pending,2);assert.equal(tracker.pendingMutations,2);assert.equal(h.commands.length,1);assert.equal(h.events.some(e=>e.kind==="removed"),false);
 g.release.resolve();await waitUntilDrained(()=>tracker.pending===0);assert.equal(tracker.pendingMutations,0);
 if(action==="start")assert.equal(h.state().presentationId,"current");else if(action==="control")assert.equal(h.state().paused,true);else assert.equal(h.ctx.presentationLibrary.presentations.old,undefined);
});
