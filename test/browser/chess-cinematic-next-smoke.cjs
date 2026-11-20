'use strict';
// Synthetic loopback fixture only. Never connects to a real LMS or classroom.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {START,play}=require('../../src/learning-chess');
const bundle=path.resolve(__dirname,'../../public/learn/chess/cinematic/view.mjs');
const states=[{id:'synthetic-cinema',revision:0,moves:[],fen:START,status:'active'}];
for(const move of ['e2e4','d7d5','e4d5','g8f6']){const old=states.at(-1),next=play(START,old.moves,move);states.push({...old,...next.outcome,fen:next.fen,moves:[...old.moves,move],revision:old.revision+1});}
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/view.mjs'?'text/javascript':'text/html');res.end(req.url==='/view.mjs'?fs.readFileSync(bundle):'<!doctype html><meta charset="utf-8"><div id="stage" style="width:700px;height:700px"></div>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({...(process.env.CHESS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:850,height:850}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});await page.goto(origin);
  const initial=await page.evaluate(async values=>{
   const {ChessCinema}=await import('/view.mjs');window.states=values;window.clicks=[];window.failures=[];
   window.c=new ChessCinema(document.querySelector('#stage'),{onSquare:s=>clicks.push(s),onFailure:m=>failures.push(m)});c.update(states[0]);
   if(c.failed||c.meshes.size!==32)throw Error('Expected complete initial board.');
   for(const mesh of c.meshes.values())if(!mesh.children.some(part=>part.material===(mesh.userData.token===mesh.userData.token.toUpperCase()?c.white:c.black)))throw Error('Stone material batch disappeared.');
   if(c.tiles.length!==2)throw Error('Static board was not instanced.');
   window.initialGeometryCount=c.geometries.size;
   const point=c.camera.position.clone().set(0.5,0.04,0.5).project(c.camera),r=c.canvas.getBoundingClientRect();
   return {click:{x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2},drawCalls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles,geometries:c.geometries.size};
  },states);
  await page.mouse.click(initial.click.x,initial.click.y);assert.deepEqual(await page.evaluate(()=>clicks),['e4']);
  const final=await page.evaluate(()=>{
   c.update(states[1]);if(!c.animation||c.meshes.get('e4').userData.baked)throw Error('Moving actor was not articulated.');
   c.update(states[2]);c.animation.start=performance.now()-c.animation.duration*0.35;c.render();
   c.update(states[3],{battleCamera:true});const a=c.animation;
   if(!a?.captured||a.captured.userData.baked||a.defenderFrom.x!==-0.5||a.defenderFrom.z!==-0.5)throw Error('Interrupted defender did not reset to its confirmed square.');
   a.start=performance.now()-a.duration*0.80;c.render();
   if(!c.cameraBusy||!a.chips||a.chips.length>8)throw Error('Battle camera or bounded stone chips missing.');
   const before=clicks.length;c.canvas.dispatchEvent(new MouseEvent('click',{clientX:350,clientY:350}));if(clicks.length!==before)throw Error('Battle camera accepted stale overview picking.');
   c.update(states[3],{orientation:'black',effects:false});
   if(c.animation||c.cameraBusy||c.camera.position.z>=0||c.pieces.children.length!==31)throw Error('Fast cancellation retained actors, effects or camera.');
   for(let i=0;i<8;i++)c.update({...states[0],id:'synthetic-reset-'+i},{orientation:i%2?'black':'white'});
   if(c.geometries.size!==initialGeometryCount)throw Error('Snapshot replacement leaked geometry.');
   c.update({...states[0],id:'fast-demo'});c.update({...states[1],id:'fast-demo'});c.update({...states[1],id:'fast-demo'},{fast:true});if(c.animation)throw Error('Fast toggle did not settle an active animation.');
   c.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));c.canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
   if(failures.length!==1||!c.failed)throw Error('Context loss fallback was not single-shot.');c.destroy();if(c.geometries.size||c.materials.size||c.textures.size||document.querySelector('canvas'))throw Error('Destroy retained resources.');
   return {contextFailures:failures.length};
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(async()=>{
   const {ChessCinema}=await import('/view.mjs'),d=new ChessCinema(document.querySelector('#stage'));d.update(states[0]);d.update(states[1]);if(d.animation)throw Error('Reduced-motion preference ignored.');d.destroy();
   const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:get.call(this,type,...args);};let rejected=false;
   try{new ChessCinema(document.querySelector('#stage'));}catch{rejected=true;}finally{HTMLCanvasElement.prototype.getContext=get;}if(!rejected)throw Error('No-WebGL2 constructor failed to throw.');
  });
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('PASS complete stone batches, local-only bundle, picking, interrupt-safe actors, camera/fast/reduced-motion fallback, bounded chips and resource lifecycle',JSON.stringify({...initial,...final}));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
