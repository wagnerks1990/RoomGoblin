'use strict';
// Actual browser input against an ephemeral local server. No classroom is contacted.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {fixture}=require('../helpers/learning-fixture');
const {randomUUID}=require('node:crypto');
(async()=>{
 const f=await fixture();let browser;const errors=[],checks=[];
 const pass=text=>{checks.push(text);console.log('PASS '+text);};
 try{
  const activity=f.learning.createActivity(f.admin,f.classId,{title:'Synthetic interaction chess',templateId:'scorm-connector-v1'});
  f.learning.platform.configure(f.admin,activity,{points:20});
  browser=await chromium.launch({...(process.env.CHESS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true});
  const context=await browser.newContext({hasTouch:true,viewport:{width:1280,height:1000}}),p=await context.newPage();
  p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  await context.addCookies([{name:'classroom_hub_session',value:f.cookies[f.admin.id].split('=')[1],url:f.base}]);
  await p.goto(f.base+'/learn/chess');await p.locator('#solo').click();
  const ready=()=>p.waitForFunction(()=>document.getElementById('board').classList.contains('is-interactive'));
  const cell=s=>p.locator('#board [data-square="'+s+'"]');
  await cell('e2').waitFor();
  const firstGame=f.store.db.prepare("SELECT id FROM learning_chess_matches WHERE mode='solo' ORDER BY created_at DESC LIMIT 1").get().id;
  const moves=()=>JSON.parse(f.store.db.prepare('SELECT moves_json FROM learning_chess_matches WHERE id=?').get(firstGame).moves_json);
  await cell('e2').evaluate(n=>{window.originalSquare=n;});
  const point=async s=>{await p.waitForFunction(()=>document.getElementById('board').classList.contains('is-interactive'));await p.locator('#board').scrollIntoViewIfNeeded();const r=await cell(s).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
  const mouseDrag=async(from,to)=>{const a=await point(from),b=await point(to);await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(b.x,b.y,{steps:12});await p.mouse.up();};
  await mouseDrag('e2','e4');await p.locator('#moves').getByText('e2–e4',{exact:false}).waitFor({state:'attached'});await ready();
  assert.deepEqual(moves(),['e2e4']);assert.equal(await p.locator('#board').getAttribute('data-orientation'),'black');
  assert.equal(await p.locator('#board button').first().getAttribute('data-square'),'h1');
  pass('Mouse dragging submits a legal move and solo turns orient the active color at the bottom');
  await p.locator('#refresh').click();await p.waitForTimeout(2800);
  assert.equal(await cell('e2').evaluate(n=>n===window.originalSquare),true);
  pass('Square DOM nodes survive polling and orientation changes');
  await cell('e7').click();await cell('e5').click();await p.locator('#moves').getByText('e7–e5',{exact:false}).waitFor({state:'attached'});await ready();
  await cell('g1').focus();await p.keyboard.press('Enter');await cell('f3').focus();await p.keyboard.press('Enter');
  await p.locator('#moves').getByText('g1–f3',{exact:false}).waitFor({state:'attached'});await ready();
  const a=await point('b8'),b=await point('c6'),cdp=await context.newCDPSession(p);
  if(process.env.CHESS_DEBUG_INPUT)await p.evaluate(()=>{window.inputTrace=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])document.getElementById('board').addEventListener(type,e=>inputTrace.push([type,e.pointerType,e.target.dataset.square,e.clientX,e.clientY]));});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  if(process.env.CHESS_DEBUG_INPUT)console.log({a,b,trace:await p.evaluate(()=>window.inputTrace)});
  await p.locator('#moves').getByText('b8–c6',{exact:false}).waitFor({state:'attached'});await ready();
  assert.deepEqual(moves(),['e2e4','e7e5','g1f3','b8c6']);
  pass('Tap, keyboard and native touch dragging all reach the same server move validation');
  let submissions=0;await p.route('**/chess/matches/*/move',async route=>{submissions++;await new Promise(r=>setTimeout(r,250));await route.continue();});
  await cell('f1').click();await cell('c4').click();await cell('c4').click();
  await p.locator('#moves').getByText('f1–c4',{exact:false}).waitFor({state:'attached'});await ready();assert.equal(submissions,1);assert.equal(moves().length,5);
  await p.unroute('**/chess/matches/*/move');
  pass('An in-flight move blocks duplicate submission');
  await p.locator('#board-size').fill('900');await p.locator('#board-size').dispatchEvent('input');
  assert.equal(await p.locator('#stage').evaluate(n=>n.style.getPropertyValue('--board-size')),'900px');
  await p.locator('#expand').click();assert.equal(await p.locator('body').evaluate(n=>n.classList.contains('board-focus')),true);
  await p.locator('#expand').click();await p.locator('#effects').uncheck();assert.equal(await p.locator('#board').evaluate(n=>n.classList.contains('effects-off')),true);
  await p.emulateMedia({reducedMotion:'reduce'});await p.setViewportSize({width:390,height:844});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  for(const size of await p.locator('#board button').evaluateAll(ns=>ns.map(n=>{const r=n.getBoundingClientRect();return [r.width,r.height];})))assert.ok(Math.abs(size[0]-size[1])<1);
  pass('Board size, focused view, reduced effects and narrow-screen square geometry remain usable');
  // Two distinct create intents must remain resumable, rather than silently reusing one game.
  const extra=f.learning.chess.create(f.admin,activity,{teacher:true,mode:'solo',requestId:randomUUID()});
  assert.notEqual(extra.id,firstGame);assert.equal(moves().length,5);
  await p.reload();await p.locator('#games button').first().waitFor();
  assert.ok(await p.locator('#games button').count()>=2);
  pass('Multiple open games persist through page reload');
  // A student's white seat gives the teacher black. The browser must keep black at bottom.
  let match=f.learning.chess.create(f.a,activity,{timeControl:'5+3',requestId:randomUUID()});
  match=f.learning.chess.join(f.admin,activity,match.id,{teacher:true});
  match=await f.learning.chess.move(f.a,activity,match.id,'e2e4',match.revision);
  await p.setViewportSize({width:1280,height:1000});await p.reload();
  await p.locator('#games button').first().waitFor();
  const selected=p.locator('#games button[data-match-id="'+match.id+'"]');
  await selected.click();await cell('e7').waitFor();
  assert.equal(await p.locator('#board').getAttribute('data-orientation'),'black');
  assert.equal(await p.locator('#board [data-square="e4"]').evaluate(n=>n.classList.contains('last-opponent')),true);
  assert.equal(await p.locator('.chess-clock').count(),2);
  pass('A black multiplayer participant sees their side at bottom, opponent move glow and both server clocks');
  assert.equal(await p.locator('#cinematic').count(),1,'The 3D toggle must have a unique control ID');
  await p.locator('#battle-camera').check();await p.locator('#fast-animation').check();
  assert.equal(await p.locator('#battle-camera').isChecked(),true);assert.equal(await p.locator('#fast-animation').isChecked(),true);
  await p.locator('#cinematic').click();
  await p.waitForFunction(()=>document.querySelector('.cinematic-mode canvas')||document.querySelector('.cinema-notice')?.textContent.includes('unavailable'));
  if(await p.locator('.cinematic-mode canvas').count()){
   assert.equal(await p.locator('.cinematic-mode canvas').isVisible(),true);await p.locator('#cinematic').click();
   assert.equal(await p.locator('#board').isVisible(),true);assert.equal(await p.locator('#board button').count(),64);
   pass('The integrated fantasy renderer loads locally and returns to the keyboard-accessible 2D board');
  }else{
   assert.equal(await p.locator('#board').isVisible(),true);pass('Unavailable WebGL falls back to the interactive 2D board');
  }
  // Public TV polling must pick up a newly finished game without a reload.
  const tv=await context.newPage();tv.on('pageerror',e=>errors.push(e.message));await tv.goto(f.base+'/chess/leaderboard');
  await tv.locator('#connection').getByText('LIVE',{exact:false}).waitFor({state:'attached'});await ready();
  const before=await tv.locator('#players').textContent();
  f.learning.chess.leave(f.admin,activity,match.id,match.revision,{teacher:true});
  await tv.waitForFunction(previous=>document.getElementById('players').textContent!==previous,before,{timeout:12000});
  const response=await fetch(f.base+'/api/v1/chess/leaderboard'),publicBoard=await response.json();
  assert.ok(publicBoard.players.some(x=>x.label==='Investigator A.'));
  for(const player of publicBoard.players)assert.equal('id' in player,false);
  assert.equal(response.headers.get('cache-control')?.includes('no-store'),true);
  pass('Public TV standings auto-update with privacy-safe student names and no participant identifiers');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:checks.length,failed:0,skipped:0}));
 }finally{await browser?.close();await f.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
