 'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {fixture}=require('../helpers/learning-fixture');
(async()=>{
 const f=await fixture(),browser=await chromium.launch({channel:'msedge',headless:true}),checks=[];
 const pass=x=>{checks.push(x);console.log('PASS '+x);};
 try{
  const empty=f.store.putUser({username:'empty-teacher',displayName:'Another teacher',role:'operator',profileId:'teacher'},{password:'synthetic-test-password'});
  const other=f.learning.createClass(f.admin,'Another period');f.learning.post(f.a,f.activityId,{kind:'initial',body:'PRIVATE SYNTHETIC CLASS WRITING'});
  const context=await browser.newContext();await context.addCookies([{name:'classroom_hub_session',value:f.cookies[f.admin.id].split('=')[1],url:f.base}]);const p=await context.newPage(),errors=[];p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push(e.message));
  await p.goto(f.base+'/learn?view=classes');await p.locator('#workspace').waitFor({state:'visible'});assert.equal(await p.locator('#classes').isVisible(),true);assert.equal(await p.locator('#teacher-form').count(),0);pass('The root Classes view opens without the retired student discussion editor');
  await p.locator('#class-select').selectOption(f.classId);await p.locator('[data-tab="assignments"]').click();await p.getByText('Add an assignment',{exact:true}).click();await p.getByLabel('Assignment title',{exact:true}).fill('Unfinished draft');
  p.once('dialog',dialog=>dialog.dismiss());await p.locator('#class-select').selectOption(other);assert.equal(await p.locator('#class-select').inputValue(),f.classId);assert.equal(await p.getByLabel('Assignment title',{exact:true}).inputValue(),'Unfinished draft');pass('Class switching requires an explicit draft discard');
  await p.locator('[data-tab="setup"]').click();await p.getByText('AI chat and media shortcuts',{exact:true}).click();await p.locator('#ai-chat-url').fill('https://draft.example.test/');
  // Saving another form must not wipe either draft.
  await p.getByRole('button',{name:'Save connection settings',exact:true}).click();await p.getByText('Saved. Other unsaved drafts remain open.',{exact:true}).waitFor();assert.equal(await p.locator('#ai-chat-url').inputValue(),'https://draft.example.test/');await p.waitForTimeout(8500);assert.equal(await p.getByLabel('Assignment title',{exact:true}).inputValue(),'Unfinished draft');pass('Saving and background refresh preserve unrelated drafts across views');
  p.once('dialog',dialog=>dialog.accept());await p.locator('#refresh').click();await p.getByText('Refreshed from RoomGoblin.',{exact:true}).waitFor();
  await p.locator('[data-tab="overview"]').click();let release,intercepted;const captured=new Promise(resolve=>{intercepted=resolve;});const blocked=new Promise(resolve=>{release=resolve;});
  await p.route('**/api/v1/learning/teacher/classes/'+f.classId,async route=>{const response=await route.fetch();intercepted();await blocked;await route.fulfill({response});});
  await p.locator('#refresh').click();await captured;await p.locator('#class-select').selectOption(other);await p.locator('#activity').getByText('No records for this class yet.',{exact:true}).waitFor();release();await p.unrouteAll({behavior:'wait'});assert.equal(await p.locator('#class-select').inputValue(),other);assert(!(await p.locator('#activity').innerText()).includes('PRIVATE SYNTHETIC'));pass('Late responses cannot replace the newly selected class');
  // Native management operations stay inside the selected class.
  await p.locator('[data-tab="classes"]').click();await p.getByLabel('Class title',{exact:true}).fill('Created through teacher portal');await p.getByRole('button',{name:'Create class',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#class-select option:checked')?.textContent==='Created through teacher portal');
  const created=await p.locator('#class-select').inputValue();await p.getByLabel('Account',{exact:true}).selectOption(f.a.id);await p.getByLabel('Name shown in this class',{exact:true}).fill('Assigned student');await p.getByRole('button',{name:'Assign account',exact:true}).click();await p.getByText('Assigned student · student',{exact:true}).waitFor();assert.equal(f.learning.membership(f.a,created).alias,'Assigned student');pass('Class creation and account assignment refresh the unified roster');
  await p.locator('#class-select').selectOption(f.classId);await p.locator('[data-tab="discussions"]').click();await p.locator('#discussion-list summary').first().click();await p.getByText('PRIVATE SYNTHETIC CLASS WRITING',{exact:true}).waitFor();
  await context.clearCookies();await p.locator('#refresh').click();await p.locator('#login').waitFor();assert(!(await p.locator('body').textContent()).includes('PRIVATE SYNTHETIC'));assert.equal(await p.locator('#class-select option').count(),0);
  await p.locator('#username').fill(empty.username);await p.locator('#password').fill('synthetic-test-password');await p.locator('#login-form button').click();await p.locator('#workspace').waitFor();assert.equal(await p.locator('#class-select option').count(),0);assert(!(await p.locator('body').textContent()).includes('PRIVATE SYNTHETIC'));assert.equal(await p.locator('[data-tab="setup"]').isVisible(),false);pass('Session loss clears private DOM before a different teacher signs in with no classes');
  assert.deepEqual(errors,[]);pass('No uncaught errors during drafts, class races or account changes');console.log(JSON.stringify({passed:checks.length,failed:0}));
 }finally{await browser.close();await f.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
