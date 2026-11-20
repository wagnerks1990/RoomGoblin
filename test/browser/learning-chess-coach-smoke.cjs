'use strict';
// Offline teaching UI, synthetic LMS and isolated gateway. No real classroom or learner data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http');
const {fixture}=require('../helpers/learning-fixture');
const {createStudentGateway}=require('../../src/learning-public');
const {createChessPackage}=require('../../src/learning-chess-package');
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
  const contexts=await Promise.all([browser.newContext(),browser.newContext(),browser.newContext()]);
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  for(const p of pages){p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));}
  const [a,b,teacher]=pages;
  await Promise.all([a.goto(lmsOrigin+'/?package=0'),b.goto(lmsOrigin+'/?package=1')]);
  for(const p of [a,b])await p.waitForFunction(()=>document.querySelector('#assignment').contentWindow.RoomGoblinSCORM?.connected());
  const fa=a.frameLocator('#assignment'),fb=b.frameLocator('#assignment');
  assert.equal(await fa.locator('#practice-hint').isDisabled(),true);
  await fa.locator('#solo').click();await fa.locator('#board.is-interactive').waitFor();const coach=fa.locator('#chess-coach');const beforeScore=await a.evaluate(()=>values['cmi.core.score.raw']);
  // This LMS fixture deliberately recognizes .js but serves unknown extensions
  // as HTML. Exercise the actual exported renderer, not the teacher asset route.
  await fa.locator('#cinematic').click();
  await fa.locator('#cinematic[aria-pressed="true"]').waitFor();
  await fa.locator('.cinema-host canvas').waitFor({state:'visible'});
  assert.match(await fa.locator('#stage .cinema-notice').textContent(),/3D fantasy view/);
  await fa.locator('#camera-controls summary').click();
  await fa.locator('#camera-preset').selectOption('overhead');
  await fa.locator('#camera-orbit').fill('45');await fa.locator('#camera-orbit').dispatchEvent('input');
  await fa.locator('#camera-zoom').fill('115');await fa.locator('#camera-zoom').dispatchEvent('input');
  assert.equal(await fa.locator('#camera-orbit-value').textContent(),'45°');
  assert.equal(await fa.locator('#camera-zoom-value').textContent(),'115%');
  await fa.locator('#refresh').click();await a.waitForTimeout(350);
  assert.equal(await fa.locator('#camera-preset').inputValue(),'overhead');
  await fa.locator('#cinematic').click();
  await fa.locator('#board.is-interactive').waitFor({state:'visible'});
  await fa.locator('#cinematic').click();await fa.locator('.cinema-host canvas').waitFor({state:'visible'});
  assert.equal(await fa.locator('#camera-orbit').inputValue(),'45');
  await fa.locator('#camera-reset').click();assert.equal(await fa.locator('#camera-orbit').inputValue(),'0');
  await fa.locator('#cinematic').click();
  await fa.locator('#board.is-interactive').waitFor({state:'visible'});
  assert.equal(await a.evaluate(()=>values['cmi.core.score.raw']),beforeScore);
  pass('Exported Fantasy 3D loads inside the LMS iframe with standard .js MIME mapping and returns to 2D without scoring');
  await fa.locator('#practice-hint').click();await coach.locator('.rg-coach-hints h3').waitFor();assert.match(await coach.locator('.rg-coach-hints').textContent(),/practice position/);assert.equal(await a.evaluate(()=>values['cmi.core.score.raw']),beforeScore);assert.equal(JSON.parse(f.store.db.prepare("SELECT moves_json FROM learning_chess_matches WHERE mode='solo'").get().moves_json).length,0);pass('Exported SCO assets render practice explanations through exact SDK and isolated gateway without scoring or moving');
  await coach.locator('.rg-coach-answers').getByRole('button',{name:'e4',exact:true}).click();assert.match(await coach.locator('.rg-coach-feedback').textContent(),/Correct/);await fa.locator('#refresh').click();assert.match(await coach.locator('.rg-coach-feedback').textContent(),/Correct/);pass('Student lesson answers survive authoritative refreshes');
  let readReady,releaseRead;const oldRead=new Promise(r=>readReady=r),readGate=new Promise(r=>releaseRead=r);let heldRead=false;await a.route('**/chess',async route=>{if(route.request().method()!=='GET'||heldRead)return route.continue();heldRead=true;const response=await route.fetch();readReady();await readGate;await route.fulfill({response});});await fa.locator('#refresh').evaluate(n=>n.click());await oldRead;await fa.locator('#solo').click();const newSaved=await fa.locator('#lobby button[aria-pressed="true"]').getAttribute('data-match-id');await fa.locator('body').evaluate((_,id)=>{window.savedDisappeared=false;window.savedObserver=new MutationObserver(()=>{if(!document.querySelector('#lobby [data-match-id="'+id+'"]'))savedDisappeared=true;});savedObserver.observe(document.getElementById('lobby'),{childList:true,subtree:true});},newSaved);releaseRead();await a.waitForTimeout(600);assert.equal(await fa.locator('body').evaluate(()=>savedDisappeared),false);await fa.locator('body').evaluate(()=>savedObserver.disconnect());await a.unroute('**/chess');pass('A pre-creation student read cannot overwrite a newly saved game');
  let readsBlocked=true,moveAttempts=0;await a.route('**/chess',route=>route.request().method()==='GET'&&readsBlocked&&moveAttempts>0?route.abort('failed'):route.continue());await a.route('**/chess/matches/*/move',route=>{if(route.request().method()!=='POST')return route.continue();moveAttempts++;return route.abort('failed');});await fa.getByRole('button',{name:'e2 white pawn',exact:true}).click();await fa.getByRole('button',{name:'e4 empty',exact:true}).click();await fa.locator('#board[data-sync="reconnecting"]').waitFor();assert.equal(await fa.locator('#solo').isDisabled(),true);await fa.locator('#board [data-square="e2"]').evaluate(n=>n.click());await fa.locator('#board [data-square="e4"]').evaluate(n=>n.click());assert.equal(moveAttempts,1);readsBlocked=false;await a.unroute('**/chess/matches/*/move');await fa.locator('#refresh').evaluate(n=>n.click());await fa.locator('#board.is-interactive').waitFor();assert.equal(moveAttempts,1);await a.unroute('**/chess');pass('A disconnected student board locks actions and reconnects without replaying the failed move');
  await fa.locator('#leave').click();await fa.getByRole('dialog',{name:'Stop this practice game?'}).waitFor();await fa.getByRole('button',{name:'Keep practicing',exact:true}).click();assert.equal(await fa.locator('body').evaluate(()=>document.activeElement.id),'leave');pass('Student practice ending is explicit and returns keyboard focus when cancelled');
  let announce,release;const arrived=new Promise(r=>announce=r),gate=new Promise(r=>release=r);await a.route('**/chess/matches/*/hint',async route=>{const response=await route.fetch();announce();await gate;await route.fulfill({response});});await fa.locator('#practice-hint').click();await arrived;await fa.getByRole('button',{name:'e2 white pawn',exact:true}).click();await fa.getByRole('button',{name:'e4 empty',exact:true}).click();await fa.locator('#moves').getByText('e2–e4',{exact:false}).waitFor({state:'attached'});release();await fa.locator('#practice-hint').getByText('Explain practice position',{exact:true}).waitFor();assert.equal(await coach.locator('.rg-coach-hints').textContent(),'');await a.unroute('**/chess/matches/*/hint');pass('Late hint response is discarded after a live board revision changes');
  await fa.locator('#solo').click();await fa.locator('#board.is-interactive').waitFor();
  let hintReady,moveReady,releaseHint,releaseMove;const hintArrived=new Promise(r=>hintReady=r),moveArrived=new Promise(r=>moveReady=r),hintGate=new Promise(r=>releaseHint=r),moveGate=new Promise(r=>releaseMove=r);
  await a.route('**/chess/matches/*/hint',async route=>{const response=await route.fetch();hintReady();await hintGate;await route.fulfill({response});});
  await a.route('**/chess/matches/*/move',async route=>{moveReady();await moveGate;await route.continue();});
  try{await fa.locator('#practice-hint').click();await hintArrived;await fa.getByRole('button',{name:'e2 white pawn',exact:true}).click();await fa.getByRole('button',{name:'e4 empty',exact:true}).click();await moveArrived;releaseHint();await fa.locator('#practice-hint').getByText('Explain practice position',{exact:true}).waitFor();assert.equal(await coach.locator('.rg-coach-hints').textContent(),'');pass('A hint arriving while a move is still in flight is discarded even before the revision changes');}
  finally{releaseHint();releaseMove();}
  await fa.locator('#moves').getByText('e2–e4',{exact:false}).waitFor({state:'attached'});await a.unroute('**/chess/matches/*/hint');await a.unroute('**/chess/matches/*/move');
  await fa.locator('#create').click();await fa.locator('#turn').getByText('Finding your opponent',{exact:false}).waitFor();assert.equal(await fa.locator('#practice-hint').isDisabled(),true);await coach.locator('.rg-coach-path [data-stage="safety"]').click();assert.match(await coach.locator('.rg-coach-lesson').textContent(),/castling/i);pass('Multiplayer keeps general learning available while tactical explanations stay unavailable');
  for(const route of ['/learn/chess/coach.js','/learn/chess/coach.css'])assert.equal((await fetch(origin+route)).status,404);pass('New teacher teaching assets remain denied through learner gateway');
  await a.reload();await a.waitForFunction(()=>document.querySelector('#assignment').contentWindow.RoomGoblinSCORM?.connected());await fa.locator('#coach-panel>summary').click();assert.match(await fa.locator('#chess-coach .rg-coach-note').last().textContent(),/do not change grades/);assert.equal(await fa.locator('#practice-hint').isDisabled(),true);pass('Student resume initializes fresh local lessons and preserves multiplayer hint gating');
  await a.locator('#assignment').evaluate(frame=>{frame.style.height=frame.contentDocument.documentElement.scrollHeight+'px';});if(process.env.CHESS_TEST_SCREENSHOTS)await fa.locator('#coach-panel').screenshot({path:path.join(process.env.CHESS_TEST_SCREENSHOTS,'coach-sco.png')});
  await contexts[2].addCookies([{name:'classroom_hub_session',value:f.cookies[f.admin.id].split('=')[1],url:f.base}]);
  await teacher.goto(f.base+'/learn/chess');await teacher.locator('#solo').click();await teacher.locator('#board.is-interactive').waitFor();const teacherCoach=teacher.locator('#chess-coach');await teacher.locator('#practice-hint').click();await teacherCoach.locator('.rg-coach-hints h3').waitFor();assert.equal(JSON.parse(f.store.db.prepare("SELECT moves_json FROM learning_chess_matches WHERE mode='solo' AND white_id=?").get(f.admin.id).moves_json).length,0);pass('Teacher practice explanations use the server route without playing a move');
  await teacherCoach.locator('.rg-coach-answers').getByRole('button',{name:'e4',exact:true}).click();await teacherCoach.getByRole('button',{name:'Next question',exact:true}).click();await teacherCoach.locator('.rg-coach-answers').getByRole('button',{name:'Knight',exact:true}).click();await teacherCoach.getByRole('button',{name:'Next question',exact:true}).click();await teacherCoach.locator('.rg-coach-answers [data-square="d5"]').focus();await teacher.keyboard.press('ArrowRight');await teacher.keyboard.press('ArrowUp');await teacher.keyboard.press('Enter');assert.match(await teacherCoach.locator('.rg-coach-feedback').textContent(),/Correct.*not a suggested move/);await teacher.waitForTimeout(2800);assert.match(await teacherCoach.locator('.rg-coach-feedback').textContent(),/Correct/);pass('Teacher quizzes support arrow keys and Enter while preserving feedback across polling');
  await teacherCoach.locator('.rg-coach-path [data-stage="safety"]').click();assert.match(await teacherCoach.locator('.rg-coach-lesson').textContent(),/castling.*Neither may have moved/is);assert.match(await teacherCoach.locator('.rg-coach-lesson').textContent(),/Fivefold repetition/);if(process.env.CHESS_TEST_SCREENSHOTS)await teacher.locator('#coach-panel').screenshot({path:path.join(process.env.CHESS_TEST_SCREENSHOTS,'coach-rules-desktop.png')});pass('Teacher learning stages explain special moves and claimable versus automatic draws');
  await teacherCoach.locator('.rg-coach-path [data-stage="basics"]').click();await teacher.setViewportSize({width:390,height:844});assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);for(const [width,height]of await teacherCoach.locator('.rg-coach-square').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.width,r.height];})))assert.ok(Math.abs(width-height)<1);if(process.env.CHESS_TEST_SCREENSHOTS)await teacher.locator('#coach-panel').screenshot({path:path.join(process.env.CHESS_TEST_SCREENSHOTS,'coach-mobile.png')});pass('Teacher learning diagrams remain square and contained on a narrow screen');
  await fb.locator('#solo').click();await fb.locator('#board.is-interactive').waitFor();await b.route('**/chess',async route=>{if(route.request().method()!=='GET')return route.continue();const response=await route.fetch();await route.fulfill({response,status:401,body:JSON.stringify({ok:false,error:'Private connection revoked.'})});});await fb.locator('#refresh').click();await fb.locator('#status').getByText('no longer authorized',{exact:false}).waitFor();assert.equal(await fb.locator('#board button').count(),0);assert.equal(await fb.locator('#grade').textContent(),'— / 5 moves');for(const id of ['lobby','leaderboard','draw-actions'])assert.equal(await fb.locator('#'+id).getAttribute('data-signature'),null);assert.equal(await fb.locator('#create').isDisabled(),true);await b.unroute('**/chess');pass('A revoked private connection clears cached student state and requires reopening');
  await a.evaluate(()=>{actor='different-learner';});await fa.locator('#refresh').evaluate(n=>n.click());assert.equal(await fa.locator('#chess-coach').textContent(),'');assert.equal(await fa.locator('#grade').textContent(),'— / 5 moves');for(const id of ['lobby','leaderboard','draw-actions'])assert.equal(await fa.locator('#'+id).getAttribute('data-signature'),null);assert.equal(await fa.locator('#practice-hint').isDisabled(),true);await fa.locator('body').evaluate(()=>{dispatchEvent(new CustomEvent('roomgoblin:ready'));dispatchEvent(new CustomEvent('roomgoblin:control',{detail:{paused:false}}));});assert.equal(await fa.locator('#create').isDisabled(),true);pass('Actor changes destroy teaching context and disable hint actions');assert.deepEqual(errors,[]);pass('No uncaught SCO browser errors');console.log(JSON.stringify({passed:checks.length,failed:0,skipped:0}));
 }finally{
  await browser.close();for(const server of [lms,proxy,gateway])if(server)await new Promise(r=>server.close(r));await f.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
