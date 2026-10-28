"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(require.resolve("../src/server"),"utf8").replace(/\r\n/g,"\n");
function extract(name){
  const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start>=0,name);
  return source.slice(start,source.indexOf("\n}",start)+2);
}
function fixture(){
  const sent=[],observed=[],effects=[];
  const old={text:"Old body",title:"Old title",subtitle:"Old subtitle",textOptions:{scene:{layers:[{text:"Old scene"}]}},layers:[{id:"overlay"}],media:{type:"video",url:"/media/old.mp4"},presentationBlack:true,timer:{visible:true,running:true}};
  const ctx=vm.createContext({
    Date,JSON,Buffer,path,crypto:require("node:crypto"),displayMedia:require("../src/display-media"),deviceConfig:{room:"test"},ROOM_NAME:"test",
    devices:{tv1:{},tv2:{}},persistentState:{displays:{tv1:structuredClone(old),tv2:structuredClone(old)}},
    persistState:()=>{},planningStudio:{scene:{normalize:s=>s}},
    resolveDisplayTargets:t=>t==="all"?["tv1","tv2"]:(Array.isArray(t)?t:[t]).filter(id=>["tv1","tv2"].includes(id)),
    announcementPriorityError:()=>null,
    engageManualMediaPriority:async c=>{effects.push(c.type);return null},
    backgroundMusicObserveDisplayCommand:c=>observed.push(c.type),
    broadcastDisplays:(targets,message)=>{sent.push({targets:[...targets],command:message.command,state:structuredClone(ctx.persistentState.displays.tv1)});return targets},
    broadcastDisplayPreviews:()=>{},broadcastControllers:()=>{},audit:()=>{},diagnosticError:()=>{},
    MQTT_JSON_BRIDGE:false,MQTT_LEGACY_BRIDGE:false,
    sanitizeText:t=>t,legacyColorMap:new Map(),
  });
  vm.runInContext('const URL_BEARING_DISPLAY_COMMANDS=new Set(["display.image","display.video","display.web","display.pdf","display.document","display.ppt","display.presentation"]);',ctx);
  for(const name of ["commandId","normalizeCommand","safeMediaUrl","validateCommandForDispatch","setDisplayState","updateStateFromCommand","toLegacyCommand","executeCommand"])vm.runInContext(extract(name),ctx);
  return {ctx,sent,observed,effects,old};
}
function assertCleared(state){
  for(const key of ["text","title","subtitle"])assert.equal(state[key],"");
  assert.equal(state.textOptions.scene,undefined);assert.equal(state.layers.length,0);
  assert.equal(state.timer.visible,false);assert.equal(state.timer.running,false);
  assert.equal(state.presentationBlack,false);
}
for(const origin of ["http","media-library"])for(const type of ["display.image","display.video","display.web","display.pdf","display.document"]){
  test(`${origin} ${type} clears selected state before delivery and reconnect replay`,async()=>{
    const {ctx,sent,old}=fixture();
    const result=await ctx.executeCommand({type,target:"tv1",payload:{url:"/media/new",sessionId:"new"}},origin);
    assert.equal(result.ok,true);
    assert.deepEqual(sent.map(x=>x.command.type),["display.clear",type]);
    for(const delivery of sent){assert.deepEqual(delivery.targets,["tv1"]);assertCleared(delivery.state)}
    assert.equal(sent[0].state.media,null);
    assert.equal(ctx.persistentState.displays.tv1.media.url,"/media/new");
    assert.deepEqual(ctx.persistentState.displays.tv2,old);
  });
}
test("manual scene replaces all selected displays; explicit overlays and playback controls do not clear",async()=>{
  const {ctx,sent}=fixture();
  await ctx.executeCommand({type:"display.text",target:"all",payload:{scene:{layers:[]}}},"http");
  assert.deepEqual(sent.map(x=>x.command.type),["display.clear","display.text"]);
  assert.deepEqual(sent[0].targets,["tv1","tv2"]);
  sent.length=0;
  for(const type of ["display.text","display.title","display.subtitle","display.timer","display.media.control","display.web.audio"]){
    await ctx.executeCommand({type,target:"tv1",payload:{text:"Overlay",action:"pause"}},"http");
  }
  assert.equal(sent.length,6);assert.ok(sent.every(x=>x.command.type!=="display.clear"));
});
test("automation and presentation navigation retain their own clearing policy",async()=>{
  const {ctx,sent}=fixture();
  for(const origin of ["automation","presentation","session"])await ctx.executeCommand({type:"display.image",target:"tv1",payload:{url:"/media/new"}},origin);
  assert.deepEqual(sent.map(x=>x.command.type),Array(3).fill("display.image"));
});
test("invalid URLs, missing targets and announcement locks do not clear or acquire audio priority",async()=>{
  const {ctx,sent,effects,old}=fixture();
  for(const payload of [{url:"javascript:alert(1)"},{url:""},{url:"/media/new",volume:2}]){
    await assert.rejects(ctx.executeCommand({type:"display.video",target:"tv1",payload},"http"));
  }
  await assert.rejects(ctx.executeCommand({type:"display.video",target:"missing",payload:{url:"/media/new"}},"http"));
  ctx.announcementPriorityError=()=>new Error("Morning Announcements have priority");
  await assert.rejects(ctx.executeCommand({type:"display.video",target:"tv1",payload:{url:"/media/new"}},"media-library"),/priority/);
  assert.equal(sent.length,0);assert.equal(effects.length,0);assert.deepEqual(ctx.persistentState.displays.tv1,old);
});
test("announcement priority is checked again after asynchronous clear delivery",async()=>{
  const {ctx,sent}=fixture(),broadcast=ctx.broadcastDisplays;
  ctx.broadcastDisplays=(targets,message)=>{const result=broadcast(targets,message);ctx.announcementPriorityError=()=>new Error("announcement started");return result};
  await assert.rejects(ctx.executeCommand({type:"display.image",target:"tv1",payload:{url:"/media/new"}},"http"),/announcement started/);
  assert.deepEqual(sent.map(x=>x.command.type),["display.clear"]);
});
test("media library Show uses replacement dispatch for images, video, PDF and converted documents",async()=>{
  for(const [name,type] of [["image.png","image"],["clip.mp4","video"],["paper.pdf","pdf"],["slides.pptx","presentation"],["notes.docx","document"]]){
    const {ctx,sent}=fixture();let handler,response;
    Object.assign(ctx,{app:{post:(_url,_guard,fn)=>handler=fn},requireCapability:()=>()=>{},fs:{existsSync:()=>true},MEDIA_DIR:"/media",
      safeStoredName:x=>x,cleanId:x=>x,mediaLibrary:{files:{[name]:{type,generatedPdf:"converted.pdf"}}},
      mediaUrl:n=>"/media/"+n,documentViewerUrl:n=>"/document-viewer/"+n,libraryRecordFromDisk:()=>({})});
    const start=source.indexOf('app.post("/api/v1/media/:name/display"');
    vm.runInContext(source.slice(start,source.indexOf('\n\napp.use(',start)),ctx);
    const res={json:v=>response=v,status:code=>{assert.fail(`HTTP ${code}`)}};
    await handler({params:{name},body:{target:"tv1"}},res);
    assert.equal(response.ok,true);assert.equal(sent[0].command.type,"display.clear");assert.equal(sent.length,2);assertCleared(sent[1].state);
  }
});

function mediaRouteFixture(name,type,{converted=true}={}){
 const h=fixture();let handler;Object.assign(h.ctx,{app:{post:(_url,_guard,fn)=>handler=fn},requireCapability:()=>()=>{},fs:{existsSync:file=>converted||!file.endsWith("converted.pdf")},MEDIA_DIR:"/media",
 safeStoredName:x=>x,cleanId:x=>String(x).toLowerCase().replace(/[^a-z0-9._-]/g,""),mediaLibrary:{files:{[name]:{type,generatedPdf:"converted.pdf"}}},mediaUrl:n=>"/media/"+n,documentViewerUrl:n=>"/document-viewer/"+n,libraryRecordFromDisk:()=>({})});
 const start=source.indexOf('app.post("/api/v1/media/:name/display"');vm.runInContext(source.slice(start,source.indexOf('\n\napp.use(',start)),h.ctx);
 h.call=async body=>{const r={status:200},res={status(n){r.status=n;return res},json(v){r.body=v;return res}};await handler({params:{name},body},res);return r};return h;
}
for(const type of ["image","video","pdf","document","presentation"])test("media library "+type+" preserves multi-receiver targets through real dispatch",async()=>{
 const h=mediaRouteFixture("lesson",type);assert.equal((await h.call({target:["tv1","tv2"]})).status,200);assert.equal(h.sent.length,2);for(const delivery of h.sent)assert.deepEqual(delivery.targets,["tv1","tv2"]);
});
test("library video honors explicit playback and appearance options and preserves omitted defaults",async()=>{
 const h=mediaRouteFixture("clip.mp4","video");assert.equal((await h.call({target:"tv1",autoplay:false,loop:true,muted:true,fit:"cover",opacity:.4,localDirect:true})).status,200);
 const p=h.sent[1].command.payload;assert.equal(p.autoplay,false);assert.equal(p.loop,true);assert.equal(p.muted,true);assert.equal(p.fit,"cover");assert.equal(p.opacity,.4);assert.equal(p.localDirect,true);
 h.sent.length=0;await h.call({target:"tv1"});const d=h.sent[1].command.payload;assert.equal(d.autoplay,true);assert.equal(d.muted,false);assert.equal(d.loop,false);assert.equal(d.fit,"contain");assert.equal(Object.hasOwn(d,"opacity"),false);assert.equal(Object.hasOwn(d,"localDirect"),false);
});
test("library image retains opacity and local-direct selection",async()=>{
 const h=mediaRouteFixture("image.png","image");await h.call({target:"tv1",opacity:.6,localDirect:false});assert.equal(h.sent[1].command.payload.opacity,.6);assert.equal(h.sent[1].command.payload.localDirect,false);
});
test("unready documents and oversized or unknown targets cannot clear receivers",async()=>{
 const h=mediaRouteFixture("lesson.docx","document",{converted:false});assert.equal((await h.call({target:["tv1","tv2"]})).status,409);assert.equal(h.sent.length,0);
 const ready=mediaRouteFixture("lesson.pdf","pdf");assert.equal((await ready.call({target:Array(101).fill("tv1")})).status,400);assert.equal((await ready.call({target:["missing"]})).status,400);assert.equal(ready.sent.length,0);
});
