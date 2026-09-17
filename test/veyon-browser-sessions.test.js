'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {BrowserSessions,argumentsFor,project}=require('../src/veyon-browser-sessions');
function fixture(){
  let time=0,valid=true;const connection={active:0},calls=[];
  const computer={id:'sample',ip:'192.0.2.1',hostname:'sample'};
  const sessions=new BrowserSessions({now:()=>time,connect:async()=>connection,identity:()=>valid,request:async(s,action,data)=>{calls.push({action,data});return action==='capabilities'?{ok:true,protocol:1,chat:true,files:true}:{ok:true}}});
  const run=(action,input={},owner='teacher')=>sessions.run({owner,computer,action,input,authorize:()=>{}});
  return {sessions,run,connection,calls,setTime:x=>time=x,invalidate:()=>valid=false};
}
test('browser arguments cannot forward arbitrary protocols, paths or oversized content',()=>{
  for(const [a,v] of [['shell',{}],['send',{text:'a'.repeat(2001)}],['send',{text:'\0'}],['list',{path:'a\0b'}],['chunk',{offset:-1}],['chunk',{offset:1.5}],['open',{kind:'native'}]])assert.throws(()=>argumentsFor(a,v));
  assert.deepEqual(argumentsFor('send',{text:'hello',uid:'private',shell:'bad'}),{text:'hello'});
});
test('sessions are owned by one user and pinned to one connection',async()=>{
  const f=fixture(),opened=await f.run('open',{kind:'chat'});assert.equal(f.connection.active,1);
  await assert.rejects(f.run('send',{session:opened.session,text:'hi'},'other'),/unavailable/);
  assert.equal(f.calls.filter(c=>c.action==='send').length,0);
  await assert.rejects(f.run('open',{kind:'files'}),/existing/);
  await assert.rejects(f.run('download',{session:opened.session,path:'sample'}),/does not match/);
  f.invalidate();await assert.rejects(f.run('send',{session:opened.session,text:'hi'}),/identity/);
  assert.equal(f.connection.active,0);assert.equal(f.sessions.sessions.size,0);
});
test('expiry releases pooled connection and does not replay a network command',async()=>{
  const f=fixture(),s=await f.run('open',{kind:'files'});f.setTime(900001);f.sessions.prune();
  assert.equal(f.connection.active,0);await assert.rejects(f.run('state',{session:s.session}),/expired/);
  assert.deepEqual(f.calls.map(c=>c.action),['capabilities','open']);
});
test('failed opens release reservation, uncertain sends are not retried',async()=>{
  const f=fixture();f.sessions.request=async()=>{throw Error('lost')};
  await assert.rejects(f.run('open',{kind:'chat'}),/lost/);assert.equal(f.connection.active,0);assert.equal(f.sessions.opening.size,0);
  const g=fixture(),s=await g.run('open',{kind:'chat'});let count=0;
  g.sessions.request=async()=>{count++;throw Error('lost')};
  await assert.rejects(g.run('send',{session:s.session,text:'hi'}),/lost/);assert.equal(count,1);
});
test('authorization is rechecked after connecting and no native open is sent on revocation',async()=>{
  const f=fixture();let calls=0;
  await assert.rejects(f.sessions.run({owner:'teacher',computer:{id:'sample',ip:'192.0.2.1'},action:'open',input:{kind:'chat'},authorize:()=>{if(++calls===2)throw Error('revoked')}}),/revoked/);
  assert.equal(f.calls.length,0);assert.equal(f.connection.active,0);
});
test('browser responses whitelist fields and bound content, filenames and chunks',()=>{
  const r=project('state',{uid:'private',messages:[{from:'student',text:'a',uid:'private'}],entries:[],fileName:'../bad\n.txt'});
  assert.equal(r.uid,undefined);assert.equal(r.messages[0].uid,undefined);assert.equal(r.fileName,'.._bad_.txt');
  assert.throws(()=>project('state',{entries:Array(1001).fill({})}));
  assert.throws(()=>project('chunk',{data:'data:text/html;bad'}));
  assert.throws(()=>project('chunk',{data:'A'.repeat(174765)}));
});
