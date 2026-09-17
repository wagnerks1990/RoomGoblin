"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const http=require("node:http");
const {spawn}=require("node:child_process");

async function freePort(){
  return await new Promise((resolve,reject)=>{
    const s=http.createServer();s.on("error",reject);s.listen(0,"127.0.0.1",()=>{const p=s.address().port;s.close(e=>e?reject(e):resolve(p))});
  });
}
function waitFor(url,timeout=5000){
  const started=Date.now();
  return new Promise((resolve,reject)=>{
    const tick=()=>fetch(url).then(r=>r.ok?resolve():Promise.reject(Error(`HTTP ${r.status}`))).catch(e=>Date.now()-started>timeout?reject(e):setTimeout(tick,50));tick();
  });
}

test("media plane validates signed request upstream and serves byte ranges",async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-media-plane-"));
  const mediaDir=path.join(root,"media");fs.mkdirSync(mediaDir,{recursive:true});
  const body=Buffer.from("0123456789abcdefghijklmnopqrstuvwxyz");
  fs.writeFileSync(path.join(mediaDir,"fixture.mp4"),body);
  const controlPort=await freePort(),mediaPort=await freePort();
  const control=http.createServer((req,res)=>{
    if(req.method==="HEAD"&&req.url==="/media/fixture.mp4?asset=valid"){res.writeHead(200);res.end();return}
    if(req.method==="HEAD"&&req.url==="/media/fixture.mp4"&&req.headers.cookie==="classroom_hub_session=preview-session"){res.writeHead(200);res.end();return}
    res.writeHead(401);res.end();
  });
  await new Promise((resolve,reject)=>{control.on("error",reject);control.listen(controlPort,"127.0.0.1",resolve)});
  const child=spawn(process.execPath,[path.join(__dirname,"..","src","media-server.js")],{
    env:{...process.env,DATA_DIR:root,PORT:String(controlPort),MEDIA_PLANE_PORT:String(mediaPort),MEDIA_PLANE_BIND_ADDRESS:"127.0.0.1"},
    stdio:["ignore","pipe","pipe"]
  });
  t.after(()=>{child.kill("SIGTERM");control.close();fs.rmSync(root,{recursive:true,force:true})});
  await waitFor(`http://127.0.0.1:${mediaPort}/health`);

  const denied=await fetch(`http://127.0.0.1:${mediaPort}/media/fixture.mp4?asset=bad`);
  assert.equal(denied.status,401);

  const controllerPreview=await fetch(`http://127.0.0.1:${mediaPort}/media/fixture.mp4`,{headers:{cookie:"classroom_hub_session=preview-session",range:"bytes=0-3"}});
  assert.equal(controllerPreview.status,206);
  assert.equal(await controllerPreview.text(),"0123");

  const ranged=await fetch(`http://127.0.0.1:${mediaPort}/media/fixture.mp4?asset=valid`,{headers:{range:"bytes=5-12"}});
  assert.equal(ranged.status,206);
  assert.equal(ranged.headers.get("accept-ranges"),"bytes");
  assert.equal(ranged.headers.get("content-range"),`bytes 5-12/${body.length}`);
  assert.equal(await ranged.text(),body.subarray(5,13).toString());

  const suffix=await fetch(`http://127.0.0.1:${mediaPort}/media/fixture.mp4?asset=valid`,{headers:{range:"bytes=-4"}});
  assert.equal(suffix.status,206);
  assert.equal(await suffix.text(),body.subarray(-4).toString());
});

test("receiver media-plane shim only reroutes same-origin uploaded media",()=>{
  const source=fs.readFileSync(path.join(__dirname,"..","public","shared","attribution.js"),"utf8");
  assert.match(source,/installReceiverMediaPlane/);
  assert.match(source,/pathname\.startsWith\("\/media\/"\)/);
  assert.match(source,/media\.port=MEDIA_PORT/);
  assert.match(source,/rgMediaPlaneFallbackUsed/);
  assert.match(source,/originalSet\.call\(this,prior\)/);
});

test("application remains PID1 while startup recovery supervises the media child",()=>{
  const launcher=fs.readFileSync(path.join(__dirname,"..","tools","start-roomgoblin.sh"),"utf8");
  const startup=fs.readFileSync(path.join(__dirname,"..","src","startup-recovery.js"),"utf8");
  assert.match(launcher,/exec node --require \.\/src\/direct-display-compat\.js src\/startup-recovery\.js/);
  assert.match(startup,/function startMediaPlane\(\)/);
  assert.match(startup,/spawn\(process\.execPath,\[path\.join\(__dirname,"media-server\.js"\)\]/);
  assert.match(startup,/child\.once\("exit"/);
  assert.match(startup,/process\.exit\(1\)/);
  assert.match(startup,/startMediaPlane\(\);/);
});
