'use strict';
// Synthetic local renderer only; no student or classroom connections.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {START}=require('../../src/learning-chess');
const bundle=path.resolve(__dirname,'../../public/learn/chess/cinematic/view.mjs');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/view.mjs'?'text/javascript':'text/html');res.end(req.url==='/view.mjs'?fs.readFileSync(bundle):'<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#101c29}#stage{width:700px;height:700px}</style><div id="stage"></div>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({...(process.env.CHESS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:850,height:850}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});await page.goto(origin);
  await page.evaluate(async fen=>{const {ChessCinema}=await import('/view.mjs');window.clicks=[];window.failures=[];window.match={id:'camera-check',revision:0,moves:[],fen,status:'active'};window.c=new ChessCinema(document.querySelector('#stage'),{onSquare:s=>clicks.push(s),onFailure:s=>failures.push(s)});c.update(match);},START);
  const matrices=[];
  for(const preset of ['angled','overhead','player']){
   matrices.push(await page.evaluate(preset=>{c.setCameraView({preset});c.render();return c.camera.matrixWorld.elements.slice();},preset));
   if(process.env.CHESS_CAMERA_SCREENSHOT_DIR){fs.mkdirSync(process.env.CHESS_CAMERA_SCREENSHOT_DIR,{recursive:true});await page.locator('#stage').screenshot({path:path.join(process.env.CHESS_CAMERA_SCREENSHOT_DIR,preset+'.png')});}
  }
  assert.notDeepEqual(matrices[0],matrices[1]);assert.notDeepEqual(matrices[1],matrices[2]);
  await page.evaluate(()=>{
   c.setCameraView({preset:'angled',orbit:45,tilt:65,zoom:1.2});const state=JSON.stringify(c.getCameraView()),position=c.camera.position.toArray();
   c.update(match,{orientation:'white'});c.update(match,{orientation:'white'});
   if(JSON.stringify(c.getCameraView())!==state||position.some((v,i)=>Math.abs(v-c.camera.position.toArray()[i])>1e-9))throw Error('Polling changed the chosen camera.');
   const initial=c.camera.position.clone();c.setCameraView({zoom:0.8});if(c.camera.position.distanceTo(initial)<1)throw Error('Zoom did not move the camera.');
   c.setCameraView({tilt:80});if(c.camera.position.y<=initial.y)throw Error('Tilt did not raise the camera.');
  });
  const click=await page.evaluate(()=>{
   c.setCameraView({preset:'angled',orbit:35,tilt:65});c.update(match,{orientation:'black'});c.render();
   const point=c.camera.position.clone().set(0.5,0.04,0.5).project(c.camera),r=c.canvas.getBoundingClientRect();return {x:r.left+(point.x+1)*r.width/2,y:r.top+(1-point.y)*r.height/2};
  });
  await page.mouse.click(click.x,click.y);assert.deepEqual(await page.evaluate(()=>clicks),['e4']);
  await page.evaluate(()=>{document.querySelector('#stage').style.width='350px';document.querySelector('#stage').style.height='700px';c.resize();if(c.camera.aspect!==0.5)throw Error('Resize did not update aspect.');const before=JSON.stringify(c.getCameraView());c.update(match,{orientation:'black'});if(JSON.stringify(c.getCameraView())!==before)throw Error('Resize lost camera preferences.');c.resetCameraView();if(c.getCameraView().preset!=='angled'||c.getCameraView().zoom!==1||c.getCameraView().orbit!==0)throw Error('Reset did not restore fit.');if(c.camera.position.z>=0)throw Error('Reset lost black orientation.');});
  if(process.env.CHESS_CAMERA_SCREENSHOT_DIR)await page.locator('#stage').screenshot({path:path.join(process.env.CHESS_CAMERA_SCREENSHOT_DIR,'narrow-black.png')});
  assert.deepEqual(await page.evaluate(()=>failures),[]);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  await page.evaluate(()=>{c.destroy();if(document.querySelector('canvas'))throw Error('Camera renderer was not removed.');});
  console.log('PASS camera presets, orbit/tilt/zoom, polling stability, black rotated picking, resize/reset and local-only lifecycle');
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
