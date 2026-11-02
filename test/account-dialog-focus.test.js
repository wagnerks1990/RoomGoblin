'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/controller/app.js'),'utf8');
const start=source.indexOf('let accountReturnFocus=null;'),end=source.indexOf('async function loadMySessions()',start);
assert.ok(start>=0&&end>start);
function fixture(){
 const timers=[],events=[],document={activeElement:null,body:{classList:{contains:()=>false}},getElementById:()=>null};
 const node=()=>({value:'fixture',textContent:'fixture',focus(){document.activeElement=this},getClientRects:()=>[{}],closest:()=>null});
 const opener=node(),currentPassword=node(),newPassword=node(),confirmPassword=node(),passwordMsg=node(),accountModal={style:{display:'none'}};
 document.activeElement=opener;let loads=0,inert=false;
 const c={document,accountModal,currentPassword,newPassword,confirmPassword,passwordMsg,Event,
  window:{dispatchEvent:event=>events.push(event.type)},setTimeout:fn=>timers.push(fn),
  syncAuthModalInert:()=>{inert=accountModal.style.display==='flex'},loadMySessions:()=>{loads++},getComputedStyle:()=>({visibility:'visible'})};
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 return{c,opener,timers,events,loads:()=>loads,inert:()=>inert,flush:()=>timers.splice(0).forEach(fn=>fn())};
}
test('opening the account dialog establishes keyboard focus before returning',()=>{
 const h=fixture();h.c.openAccountModal();assert.equal(h.c.document.activeElement,h.c.currentPassword);
 assert.equal(h.c.accountModal.style.display,'flex');assert.equal(h.inert(),true);assert.equal(h.loads(),1);assert.deepEqual(h.events,['roomgoblin:modalopen']);
});
test('opening work cannot later steal focus from another account control',()=>{
 const h=fixture();h.c.openAccountModal();h.c.newPassword.focus();h.flush();assert.equal(h.c.document.activeElement,h.c.newPassword);
});
test('closing clears password fields and returns focus without a later jump',()=>{
 const h=fixture();h.c.openAccountModal();h.c.closeAccountModal();h.flush();assert.equal(h.c.document.activeElement,h.opener);
 assert.equal(h.c.accountModal.style.display,'none');assert.equal(h.inert(),false);
 for(const name of ['currentPassword','newPassword','confirmPassword'])assert.equal(h.c[name].value,'');assert.equal(h.c.passwordMsg.textContent,'');
});
test('reopening cannot leave an older initial-focus callback behind',()=>{
 const h=fixture();h.c.openAccountModal();h.c.closeAccountModal();h.c.openAccountModal();h.c.confirmPassword.focus();h.flush();assert.equal(h.c.document.activeElement,h.c.confirmPassword);
});
