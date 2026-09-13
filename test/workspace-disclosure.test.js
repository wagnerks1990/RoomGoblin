'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('public/controller/app.js','utf8');
const helper=app.slice(app.indexOf('function revealControllerOutput('),app.indexOf('function setRecoveryStatus('));

test('action results open every enclosing disclosure without activating another page',()=>{
  const page={tagName:'SECTION',dataset:{authorized:'false'},parentElement:null};
  const outer={tagName:'DETAILS',open:false,parentElement:page};
  const inner={tagName:'DETAILS',open:false,parentElement:outer};
  let scroll;
  const output={parentElement:inner,scrollIntoView:options=>scroll=options};
  const context={document:{getElementById:id=>id==='result'?output:null},matchMedia:()=>({matches:true})};
  vm.createContext(context);vm.runInContext(helper,context);
  assert.equal(context.revealControllerOutput('result',true),output);
  assert.equal(inner.open,true);assert.equal(outer.open,true);
  assert.equal(page.dataset.authorized,'false');assert.equal(page.className,undefined);
  assert.equal(scroll.behavior,'auto');
  assert.equal(context.revealControllerOutput('missing'),null);
});

test('navigation search and authorization changes cannot redisplay restricted workspaces',()=>{
  const handlers={};
  const makeItem=(text,hidden=false)=>({textContent:text,hidden,style:{},dataset:{page:text},setAttribute(){},removeAttribute(){}});
  const admin=makeItem('Settings',true),room=makeItem('Lighting'),managed=makeItem('Managed displays');
  const group={open:false,hidden:false,querySelectorAll:()=>[admin,managed]};
  const items=[room,admin,managed];
  const sidebar={prepend(){},addEventListener(){},querySelectorAll:selector=>selector==='.rg-nav-group'?[group]:selector==='[data-managed-displays-link]'?[managed]:selector==='[data-page]'?[room,admin]:items};
  const search={value:'',addEventListener:(name,fn)=>handlers[name]=fn};
  const empty={hidden:true};
  const elements={workspaceSidebar:sidebar,workspaceMenu:{setAttribute(){},addEventListener(){}},workspaceSearch:search,workspaceBackdrop:{addEventListener(){}},workspaceSearchEmpty:empty};
  const document={getElementById:id=>elements[id],createElement:()=>({addEventListener(){}}),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
  let isAdmin=false;
  const context={document,matchMedia:()=>({addEventListener(){}}),MutationObserver:class{observe(){}},userCan:()=>isAdmin,window:{addEventListener:(name,fn)=>handlers[name]=fn}};
  vm.runInNewContext(fs.readFileSync('public/controller/workspace.js','utf8'),context);
  assert.equal(managed.hidden,true);assert.equal(group.hidden,true);
  search.value='Settings';handlers.input();
  assert.equal(admin.hidden,true);assert.equal(empty.hidden,false);
  isAdmin=true;admin.hidden=false;handlers['roomgoblin:authchange']();
  assert.equal(managed.hidden,false);assert.equal(group.hidden,false);assert.equal(empty.hidden,true);
  isAdmin=false;admin.hidden=true;handlers['roomgoblin:authchange']();
  assert.equal(group.hidden,true);assert.equal(empty.hidden,false);
});
