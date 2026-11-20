'use strict';
// Offline teaching UI, synthetic LMS and isolated gateway. No real classroom or learner data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http');
const {fixture}=require('../helpers/learning-fixture');
const {createStudentGateway}=require('../../src/learning-public');
const {createChessPackage}=require('../../src/learning-chess-package');
const {START,play}=require('../../src/learning-chess');
const AdmZip=require('adm-zip'),path=require('node:path');
(async()=>{
 const f=await fixture({beforeAuth:app=>{const express=require('express');app.use('/brand',express.static(path.join(__dirname,'../../public/brand')));app.use('/shared',express.static(path.join(__dirname,'../../public/shared')));}}),browser=await chromium.launch({...(process.env.CHESS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[],checks=[];let gateway,proxy,lms;
 const pass=s=>{checks.push(s);console.log('PASS '+s);};
 const listen=server=>new Promise(r=>server.listen(0,'127.0.0.1',()=>r('http://127.0.0.1:'+server.address().port)));
 try{
  f.store.setPreference('learning.platform',{publicEnabled:true,publicOrigin:'https://chess-student.example.test'});
  gateway=createStudentGateway({app:f.app,store:f.store});await listen(gateway);
  proxy=http.createServer((req,res)=>{
   const upstream=http.request({host:'127.0.0.1',port:gateway.address().port,path:req.url,method:req.method,headers:{...req.headers,host:'chess-student.example.test','x-forwarded-proto':'https'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});
   upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);
  });const origin=await listen(proxy);
  const second=f.learning.createClass(f.admin,'Synthetic chess class B');
  const packages=[];
  for(const classId of [f.classId,second]){
   const id=f.learning.createActivity(f.admin,classId,{title:'Synthetic Chess',templateId:'scorm-connector-v1'});
   f.learning.platform.configure(f.admin,id,{points:20});
   packages.push(new AdmZip(createChessPackage(f.learning.activity(f.admin,id,true),{origin,enrollmentKey:f.learning.direct.issue(f.admin,id)},path.join(__dirname,'../../public/learn'))));
  }
  for(const zip of packages){const manifest=zip.readAsText('imsmanifest.xml'),listed=[...manifest.matchAll(/<file href="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(listed).size,listed.length);for(const entry of zip.getEntries().filter(e=>!e.isDirectory&&e.entryName!=='imsmanifest.xml'))assert.ok(listed.includes(entry.entryName),'Manifest must include '+entry.entryName);for(const name of listed)assert.ok(zip.getEntry(name),'Manifest asset must exist: '+name);for(const name of ['coach.js','coach.css','board.js','board.css'])assert.ok(listed.includes(name));}pass('SCORM manifests include every exported offline file and teaching asset');
  lms=http.createServer((req,res)=>{
   const url=new URL(req.url,'http://localhost'),which=Number(url.searchParams.get('package')||0);
   if(url.pathname==='/'){
    res.setHeader('Content-Type','text/html');return res.end(`<script>
     window.values=JSON.parse(sessionStorage.getItem('resume')||'{}');window.actor='synthetic-'+${which};window.mode='normal';window.failCommit=false;window.failCompletion=false;window.commitCount=0;
     window.API={LMSInitialize:()=> 'true',LMSGetValue:k=>k==='cmi.core.student_id'?actor:k==='cmi.core.student_name'?('Family, Synthetic'+${which}):k==='cmi.core.lesson_mode'?mode:values[k]||'',LMSSetValue:(k,v)=>{if(failCompletion&&k==='cmi.core.lesson_status')return 'false';values[k]=String(v);return 'true';},LMSCommit:()=>{commitCount++;if(failCommit)return 'false';sessionStorage.setItem('resume',JSON.stringify(values));return 'true';},LMSFinish:()=> 'true',LMSGetLastError:()=> '0'};
     </script><iframe id="assignment" src="/index.html?package=${which}" style="width:100%;height:1200px"></iframe>`);
   }
   const zip=packages[which],entry=zip.getEntry(url.pathname.slice(1));
   if(!entry){res.writeHead(404);return res.end();}
   // Preserve the selected package when relative asset URLs omit the query.
   const selected=Number(/package=(\d)/.exec(req.headers.referer||'')?.[1]||which),asset=packages[selected];
   res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');res.end(asset.readFile(entry.entryName));
  });const lmsOrigin=await listen(lms);
  const context=await browser.newContext({viewport:{width:1500,height:1300}}),page=await context.newPage();
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));let movePosts=0;
  page.on('request',r=>{if(r.method()==='POST'&&/\/chess\/matches\/[^/]+\/move$/.test(new URL(r.url()).pathname))movePosts++;});
  await page.goto(lmsOrigin+'/?package=0');
  await page.waitForFunction(()=>document.querySelector('#assignment').contentWindow.RoomGoblinSCORM?.connected());
  const ui=page.frameLocator('#assignment'),frame=page.frames().find(frame=>frame.url().includes('/index.html'));
  await ui.locator('#difficulty').selectOption('beginner');
  await ui.locator('#computer').click();await ui.locator('#board.is-interactive').waitFor();
  const initial=f.store.db.prepare("SELECT id,revision,moves_json FROM learning_chess_matches WHERE mode='computer'").get();assert.deepEqual(JSON.parse(initial.moves_json),[]);
  // Observe the actual packaged module without changing the renderer or service.
  await frame.evaluate(async()=>{
   const {ChessCinema}=await import('./cinematic/view.js');window.presented=[];
   const original=ChessCinema.prototype.presentPosition;
   ChessCinema.prototype.presentPosition=function(match,next,move){window.testCinema=this;const result=original.call(this,match,next,move);if(move)presented.push(move);return result;};
  });
  await ui.locator('#cinematic').click();await ui.locator('#cinematic[aria-pressed="true"]').waitFor();
  await ui.locator('#camera-controls summary').click();await ui.locator('#camera-preset').selectOption('overhead');
  await frame.evaluate(()=>{window.picks=0;const original=testCinema.onSquare;testCinema.onSquare=square=>{picks++;original(square);};});
  const clickSquare=async square=>{
   await ui.locator('.cinema-host canvas').scrollIntoViewIfNeeded();
   const uv=await frame.evaluate(square=>{const c=testCinema,p=c.camera.position.clone().set(square.charCodeAt(0)-100.5,0.04,3.5-(Number(square[1])-1)).project(c.camera);return {x:(p.x+1)/2,y:(1-p.y)/2};},square);
   const box=await ui.locator('.cinema-host canvas').boundingBox();await page.mouse.click(box.x+box.width*uv.x,box.y+box.height*uv.y);
  };
  await clickSquare('e2');await clickSquare('e4');
  await frame.waitForFunction(()=>testCinema.animation&&testCinema.presentationQueue);
  const confirmed=f.store.db.prepare('SELECT revision,moves_json FROM learning_chess_matches WHERE id=?').get(initial.id);
  const moves=JSON.parse(confirmed.moves_json);assert.equal(confirmed.revision,initial.revision+1);assert.equal(moves.length,2);assert.equal(moves[0],'e2e4');
  assert.equal(await frame.evaluate(()=>testCinema.animation.moving.userData.token),'P');
  pass('Actual exported SCORM 3D picking submits one human move and receives the real atomic two-ply computer response');
  const picks=await frame.evaluate(()=>window.picks);
  await clickSquare('d2');await clickSquare('d4');
  assert.equal(await frame.evaluate(()=>window.picks),picks);assert.equal(movePosts,1);
  assert.deepEqual(JSON.parse(f.store.db.prepare('SELECT moves_json FROM learning_chess_matches WHERE id=?').get(initial.id).moves_json),moves);
  pass('Intermediate computer presentation blocks stale canvas picking without submitting extra moves');
  await page.waitForFunction(()=>Number(values['cmi.core.score.raw'])===20);
  assert.equal(await ui.locator('#grade').textContent(),'1 / 5 moves');
  pass('Participation score reflects the single server-confirmed learner move before visual presentation finishes');
  await frame.waitForFunction(()=>presented.length===2&&!testCinema.animation&&!testCinema.presentationQueue,{},{timeout:25000});
  assert.deepEqual(await frame.evaluate(()=>presented),moves);assert.equal(movePosts,1);
  const expected=play(START,moves.slice(0,-1),moves.at(-1)).fen.split(' ')[0];
  const actual=await frame.evaluate(()=>Array.from({length:8},(_,rank)=>Array.from({length:8},(_,file)=>testCinema.meshes.get('abcdefgh'[file]+(8-rank))?.userData.token||'.').join('').replace(/\.+/g,s=>String(s.length))).join('/'));
  assert.equal(actual,expected);assert.equal(await page.evaluate(()=>Number(values['cmi.core.score.raw'])),20);
  pass('Human and computer animations finish naturally across polling and settle to the exact confirmed board');
  await ui.locator('#cinematic').click();await ui.locator('#board.is-interactive').waitFor({state:'visible'});
  assert.equal(await ui.locator('#cinematic').getAttribute('aria-pressed'),'false');assert.deepEqual(errors,[]);
  pass('Returning to 2D preserves playable state without browser errors or additional submissions');
  console.log(JSON.stringify({passed:checks.length,failed:0,skipped:0}));
 }finally{
  await browser.close();for(const server of [lms,proxy,gateway])if(server)await new Promise(r=>server.close(r));await f.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
