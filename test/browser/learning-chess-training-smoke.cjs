'use strict';
// Offline teaching UI, synthetic LMS and isolated gateway. No real classroom or learner data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http');
const {fixture}=require('../helpers/learning-fixture');
const {createStudentGateway}=require('../../src/learning-public');
const {createChessPackage}=require('../../src/learning-chess-package');
const AdmZip=require('adm-zip'),path=require('node:path');
(async()=>{
 const f=await fixture({beforeAuth:app=>{const express=require('express');app.use('/brand',express.static(path.join(__dirname,'../../public/brand')));app.use('/shared',express.static(path.join(__dirname,'../../public/shared')));}}),browser=await chromium.launch({...(process.env.CHESS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true});
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
  for(const zip of packages){const manifest=zip.readAsText('imsmanifest.xml'),listed=[...manifest.matchAll(/<file href="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(listed).size,listed.length);for(const entry of zip.getEntries().filter(e=>!e.isDirectory&&e.entryName!=='imsmanifest.xml'))assert.ok(listed.includes(entry.entryName),'Manifest must include '+entry.entryName);for(const name of listed)assert.ok(zip.getEntry(name),'Manifest asset must exist: '+name);for(const name of ['coach.js','coach.css','board.js','board.css','vision.js','vision.css','training.js'])assert.ok(listed.includes(name));}pass('SCORM manifests include every exported offline file and teaching asset');
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
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  for(const p of pages){p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));}
  const [a,b,teacher]=pages;
  await Promise.all([a.goto(lmsOrigin+'/?package=0'),b.goto(lmsOrigin+'/?package=1')]);
  for(const p of [a,b])await p.waitForFunction(()=>document.querySelector('#assignment').contentWindow.RoomGoblinSCORM?.connected());
  const fa=a.frameLocator('#assignment'),fb=b.frameLocator('#assignment');
  async function exercise(page,scope){
   await scope.locator('#coach-panel>summary').click();
   assert.equal(await scope.locator('#difficulty').inputValue(),'adaptive');
   assert.equal(await scope.locator('#difficulty option').count(),10);
   const panel=scope.locator('.rg-chess-training');await panel.getByRole('button',{name:'Refresh my coaching profile'}).click();await panel.getByText('practice level',{exact:false}).waitFor();assert.match(await panel.textContent(),/not a measured chess rating/);
   await panel.getByRole('button',{name:'Load / refresh my lessons'}).click();
   await panel.locator('select[aria-label="Guided lesson"] option').nth(5).waitFor({state:'attached'});
   assert.equal(await panel.locator('select[aria-label="Guided lesson"] option').count(),6);await panel.locator('.rg-training-recommendations').getByRole('button',{name:'Castle with king and rook'}).click();assert.equal(await panel.locator('select[aria-label="Guided lesson"]').inputValue(),'castle-safely');assert.equal(await panel.locator('.board').isVisible(),false);await panel.locator('select[aria-label="Guided lesson"]').selectOption('escape-check');
   await panel.getByRole('button',{name:'Start / restart lesson'}).click();
   await panel.locator('.board.is-interactive').waitFor().catch(async e=>{console.log(await panel.textContent());throw e;});
   await panel.getByRole('button',{name:'Reveal next hint'}).click();
   await panel.locator('ol li').waitFor();
   await panel.locator('[data-square="e1"]').click();await panel.locator('[data-square="d1"]').click();
   await panel.getByText('1 completions',{exact:false}).waitFor();
   assert.match(await panel.textContent(),/1 assisted/);
   await panel.getByRole('button',{name:'Load / refresh my lessons'}).click();
   await panel.getByText('1 completions',{exact:false}).waitFor();
   assert.equal(await panel.getByRole('button',{name:'Reveal next hint'}).isDisabled(),true);
   await panel.getByRole('button',{name:'Start / restart lesson'}).click();await panel.locator('.board.is-interactive').waitFor().catch(async e=>{console.log(await panel.textContent());throw e;});
   await panel.locator('[data-square="e1"]').click();await panel.locator('[data-square="d1"]').click();
   await panel.getByText('2 completions',{exact:false}).waitFor();assert.match(await panel.textContent(),/1 without hints/);
   assert.equal(await scope.locator('.rg-chess-vision button[data-square]').count(),64);
   await scope.locator('#coach-panel').evaluate(n=>n.open=false);await scope.locator('#difficulty').selectOption('adaptive-coach');assert.equal(await scope.locator('#coach-panel').evaluate(n=>n.open),true);assert.match(await panel.textContent(),/1 assisted/);pass('Actual '+(scope===fa?'SCORM':'teacher')+' page loads six private lessons, records hint assistance, resumes and validates a legal solution');
  }
  const score=await a.evaluate(()=>values['cmi.core.score.raw']);await exercise(a,fa);assert.equal(await a.evaluate(()=>values['cmi.core.score.raw']),score);pass('Guided lesson completion does not write SCORM game grades');
  await contexts[2].addCookies([{name:'classroom_hub_session',value:f.cookies[f.admin.id].split('=')[1],url:f.base}]);await teacher.goto(f.base+'/learn/chess');await teacher.locator('#computer:not([disabled])').waitFor();await exercise(teacher,teacher);
  await teacher.setViewportSize({width:390,height:844});assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);pass('Integrated practice fits a narrow phone viewport');if(process.env.CHESS_TEST_SCREENSHOTS)await teacher.locator('.rg-chess-training').screenshot({path:path.join(process.env.CHESS_TEST_SCREENSHOTS,'training-mobile.png')});for(const asset of ['training.js','vision.js','vision.css'])assert.equal((await fetch(origin+'/learn/chess/'+asset)).status,404);pass('Teacher practice assets stay blocked on the isolated learner gateway');
  const lifecycle=await teacher.evaluate(async()=>{
   const root=document.createElement('section');document.body.append(root);const ui=new RGChessTraining(root);let writes=0,resolveProfile;
   const lesson={id:'escape-check',title:'Safety',stage:'Safety',objective:'Escape check',description:'Practice',revision:0,progress:{completions:0,unassistedCompletions:0,assistedCompletions:0,attempts:0},session:null};
   const request=async(path,method)=>{if(method==='POST'){writes++;throw Error('Simulated response timeout');}return {lessons:[lesson]};};
   ui.configure({key:'class-a',writable:false,request});await ui.load();await ui.act('start');const readonly=writes===0&&ui.start.disabled;
   ui.configure({key:'class-a',writable:true,request});await ui.act('start');await ui.act('start');const timeout=writes===1&&ui.start.disabled&&ui.stale;
   await ui.load();const refreshed=!ui.start.disabled&&!ui.stale;
   ui.configure({key:'class-a',writable:true,request:()=>new Promise(resolve=>resolveProfile=resolve)});const pending=ui.loadProfile();ui.configure({key:'class-b',writable:true,request});resolveProfile({profile:{band:5,style:'old-private-style',confidence:'new',eligibleGames:0,assistedGames:0,excludedGames:0,notice:'old-private-notice',recommendations:['escape-check']}});await pending;
   const isolated=!root.textContent.includes('old-private')&&ui.lessons.length===0&&ui.recommendations.length===0;
   ui.destroy();root.remove();return {readonly,timeout,refreshed,isolated};
  });assert.deepEqual(lifecycle,{readonly:true,timeout:true,refreshed:true,isolated:true});pass('Read-only practice cannot write; uncertain writes lock without retry; class changes discard late private profiles');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,failed:0,skipped:0}));
 }finally{await browser.close();for(const server of [lms,proxy,gateway])if(server)await new Promise(r=>server.close(r));await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
