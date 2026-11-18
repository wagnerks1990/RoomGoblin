'use strict';
// Synthetic LMS and isolated student gateway. Never contacts a real classroom.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http');
const {fixture}=require('../helpers/learning-fixture');
const {createStudentGateway}=require('../../src/learning-public');
const {createChessPackage}=require('../../src/learning-chess-package');
const AdmZip=require('adm-zip'),path=require('node:path');
(async()=>{
 const f=await fixture(),browser=await chromium.launch({...(process.env.CHESS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true});
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
  await fa.locator('#create').click();await fa.locator('#turn').getByText('Waiting for another student.',{exact:false}).waitFor();
  await fb.locator('#create').click();await fb.locator('#board button').first().waitFor();
  await fa.locator('#refresh').click();await fa.locator('#turn').getByText('Your turn',{exact:false}).waitFor();
  await fa.getByRole('button',{name:'e2 P',exact:true}).click();await fa.getByRole('button',{name:'e4 empty',exact:true}).click();
  await fb.locator('#refresh').click();await fb.locator('#turn').getByText('Your turn',{exact:false}).waitFor();
  await fb.getByRole('button',{name:'e7 p',exact:true}).click();await fb.getByRole('button',{name:'e5 empty',exact:true}).click();
  await b.waitForFunction(()=>values['cmi.core.score.raw']==='20');
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_direct_participants').get().n,2);
  pass('Two LMS identities enroll without passwords and play across classes through the isolated gateway');
  for(const route of ['/learn/chess','/learn/chess/index.html','/learn/chess/app.js','/api/v1/learning/teacher/chess','/controller/','/api/v1/auth/login'])assert.equal((await fetch(origin+route)).status,404,route);
  pass('Student gateway denies teacher assets, teacher APIs, controller and login');
  const credential=await a.evaluate(()=>JSON.parse(values['cmi.suspend_data']).credential);
  await a.reload();await a.waitForFunction(()=>document.querySelector('#assignment').contentWindow.RoomGoblinSCORM?.connected());
  assert.equal(await a.evaluate(()=>JSON.parse(values['cmi.suspend_data']).credential.participantToken),credential.participantToken);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM learning_direct_participants').get().n,2);
  await fa.locator('#moves').getByText('e2e4',{exact:false}).waitFor();
  pass('LMS suspend data restores the same private account and saved game');
  const aId=packages[0].readAsText('config.js').match(/"activityId":"([a-f0-9-]+)"/)[1];
  const directUser=f.learning.direct.authorize(aId,credential.participantToken),c=f.learning.chess;
  let practice=c.create(directUser,aId,{mode:'solo'});
  for(const move of ['d2d4','d7d5','c2c4','e7e6'])practice=c.move(directUser,aId,practice.id,move,practice.revision);
  await a.evaluate(()=>{failCommit=true;failCompletion=true;});await fa.locator('#refresh').click();
  assert.notEqual(await a.evaluate(()=>values['cmi.core.lesson_status']),'completed');
  await a.evaluate(()=>{failCommit=false;failCompletion=false;});await fa.locator('#refresh').click();
  await a.waitForFunction(()=>values['cmi.core.score.raw']==='100'&&values['cmi.core.lesson_status']==='completed');
  assert.equal(c.progress(directUser,aId),5);
  pass('Five validated moves across modes save completion and retry failed LMS saves');
  await contexts[2].addCookies([{name:'classroom_hub_session',value:f.cookies[f.admin.id].split('=')[1],url:f.base}]);
  await teacher.goto(f.base+'/learn/chess');await teacher.locator('#leaderboard table').waitFor();
  await teacher.locator('#solo').click();await teacher.locator('#board button').first().waitFor();
  await teacher.getByRole('button',{name:'e2 P',exact:true}).click();await teacher.getByRole('button',{name:'e4 empty',exact:true}).click();
  await teacher.locator('#moves').getByText('e2e4',{exact:false}).waitFor();
  pass('Teacher monitoring, leaderboard rendering and playing work with native teacher login');
  await b.evaluate(()=>{mode='review';});await fb.locator('body').evaluate(()=>location.reload());
  await b.waitForFunction(()=>document.querySelector('#assignment').contentWindow.RoomGoblinSCORM?.connected());
  assert.equal(await fb.locator('#create').isDisabled(),true);assert.equal(await fb.locator('#leave').isDisabled(),true);
  pass('LMS review with saved credentials remains read only');
  await a.setViewportSize({width:390,height:844});await teacher.setViewportSize({width:390,height:844});
  await fa.locator('body').evaluate(()=>{document.documentElement.style.width='360px';});
  assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await fa.locator('body').evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
  if(process.env.CHESS_TEST_SCREENSHOTS){
   require('node:fs').mkdirSync(process.env.CHESS_TEST_SCREENSHOTS,{recursive:true});
   await teacher.screenshot({path:path.join(process.env.CHESS_TEST_SCREENSHOTS,'teacher-mobile.png'),fullPage:true});
   await a.locator('#assignment').evaluate(frame=>{frame.style.height=frame.contentDocument.documentElement.scrollHeight+'px';});
   await fa.locator('main').screenshot({path:path.join(process.env.CHESS_TEST_SCREENSHOTS,'student-mobile.png')});
  }
  for(const board of [teacher.locator('#board'),fa.locator('#board')]){
   const sizes=await board.locator('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return [r.width,r.height];}));
   assert.equal(sizes.length,64);for(const [w,h] of sizes)assert.ok(Math.abs(w-h)<1,'Each chess square must remain square');
  }
  pass('Mobile pages contain their board and scroll wide leaderboard columns locally');
  await a.evaluate(()=>{actor='different-learner';});await fa.locator('body').evaluate(()=>RoomGoblinSCORM.request('/activities/'+ROOMGOBLIN_SCORM.activityId+'/chess').catch(()=>{}));
  assert.equal(await fa.locator('#board button').count(),0);assert.equal(await fa.locator('#leaderboard table').count(),0);
  assert.equal(await fa.locator('#create').isDisabled(),true);
  pass('Identity changes clear private board and leaderboard and disable stale actions');
  assert.deepEqual(errors,[]);pass('No uncaught browser errors');
  console.log(JSON.stringify({passed:checks.length,failed:0}));
 }finally{
  await browser.close();for(const server of [lms,proxy,gateway])if(server)await new Promise(r=>server.close(r));await f.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
