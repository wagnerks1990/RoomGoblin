'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {BrowserSessions,argumentsFor,project}=require('../src/veyon-browser-sessions');
function fixture(){
  let time=0,valid=true;const connection={active:0},calls=[];
  const computer={id:'sample',ip:'192.0.2.1',hostname:'sample'};
  const sessions=new BrowserSessions({now:()=>time,connect:async()=>connection,identity:()=>valid,request:async(s,action,data)=>{calls.push({action,data});return action==='capabilities'?{ok:true,protocol:1,chat:true,files:true,upload:true,control:true,terminal:true}:action==='terminalRead'?{ok:true,text:'',cursor:0,ready:true}:{ok:true}}});
  const run=(action,input={},owner='teacher')=>sessions.run({owner,computer,action,input,authorize:()=>{}});
  return {sessions,run,connection,calls,setTime:x=>time=x,invalidate:()=>valid=false};
}
test('browser arguments cannot forward arbitrary protocols, paths or oversized content',()=>{
  for(const [a,v] of [['shell',{}],['send',{text:'a'.repeat(2001)}],['send',{text:'\0'}],['list',{path:'a\0b'}],['chunk',{offset:-1}],['chunk',{offset:1.5}],['uploadStart',{name:'../bad',size:1}],['uploadStart',{name:'x',size:2*1024*1024+1}],['uploadChunk',{offset:0,data:'%%%'}],['uploadChunk',{offset:0,data:Buffer.alloc(128*1024+1).toString('base64')}],['open',{kind:'native'}]])assert.throws(()=>argumentsFor(a,v));
  assert.deepEqual(argumentsFor('send',{text:'hello',uid:'private',shell:'bad'}),{text:'hello'});
});
test('file sessions forward only bounded typed upload messages',async()=>{
  const f=fixture(),opened=await f.run('open',{kind:'files'}),data=Buffer.from('sample').toString('base64');assert.equal(opened.upload,true);
  await f.run('uploadStart',{session:opened.session,name:'sample.txt',size:6,uid:'discard'});
  await f.run('uploadChunk',{session:opened.session,offset:0,data,private:'discard'});
  await f.run('uploadFinish',{session:opened.session,extra:'discard'});
  assert.deepEqual(f.calls.slice(-3),[
    {action:'uploadStart',data:{session:opened.session,name:'sample.txt',size:6}},
    {action:'uploadChunk',data:{session:opened.session,offset:0,data}},
    {action:'uploadFinish',data:{session:opened.session}}
  ]);
  await assert.rejects(f.run('uploadStart',{session:opened.session,name:'../bad',size:1}),/ordinary file/);
});
test('an older native bridge keeps file browsing but does not advertise upload',async()=>{
  const f=fixture();f.sessions.request=async(_session,action)=>action==='capabilities'?{ok:true,protocol:1,files:true}:{ok:true};
  const opened=await f.run('open',{kind:'files'});assert.equal(opened.upload,false);
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
test('control accepts only owner-bound leased input and fixed response fields',async()=>{
  const f=fixture(),opened=await f.run('open',{kind:'control'}),lease='123e4567-e89b-12d3-a456-426614174000';
  await f.run('pointer',{session:opened.session,x:10,y:20,buttons:1,lease,revision:4,sequence:1});
  await f.run('pointer',{session:opened.session,x:10,y:20,buttons:0,wheel:-1,lease,revision:4,sequence:2});
  await f.run('key',{session:opened.session,key:'é',pressed:true,lease,revision:4,sequence:3});
  assert.deepEqual(f.calls.slice(-3).map(call=>call.data),[
    {session:opened.session,x:10,y:20,buttons:1,lease,revision:4,sequence:1},
    {session:opened.session,x:10,y:20,buttons:0,wheel:-1,lease,revision:4,sequence:2},
    {session:opened.session,key:'é',pressed:true,lease,revision:4,sequence:3}
  ]);
  for(const input of [{x:1,y:1,buttons:32,lease,revision:4,sequence:4},{x:1,y:1,buttons:24,lease,revision:4,sequence:4},{x:1,y:1,buttons:0,wheel:2,lease,revision:4,sequence:4},{x:1,y:1,buttons:0,lease:'bad',revision:4,sequence:4}])assert.throws(()=>argumentsFor('pointer',input));
  assert.throws(()=>argumentsFor('key',{key:'Unidentified',pressed:true,lease,revision:4,sequence:3}));
  await assert.rejects(f.run('send',{session:opened.session,text:'wrong kind'}),/does not match/);
});
test('control state bounds monitors and clipboard content',()=>{
  const state=project('state',{frameWidth:1920,frameHeight:1080,ready:true,lease:'123e4567-e89b-12d3-a456-426614174000',frameRevision:7,topology:'a'.repeat(64),screens:[{index:0,name:'Main',x:0,y:0,width:1920,height:1080},{index:1,name:'Outside',x:1920,y:0,width:20,height:20}]});
  assert.equal(state.ready,true);assert.equal(state.screens.length,1);assert.equal(state.frameRevision,7);assert.equal(state.topology.length,64);
  assert.equal(project('state',{frameWidth:1920,frameHeight:1080,ready:true,lease:'bad',frameRevision:7,topology:'a'.repeat(64),screens:[]}).ready,false);
  assert.throws(()=>project('state',{frameWidth:20000,frameHeight:1080,screens:[]}));
  assert.equal(project('clipboard',{pending:false,text:'hello',private:'discard'}).text,'hello');
  assert.equal(project('clipboard',{pending:false,text:'é'.repeat(4097)}).text,'');
});
test('terminal sessions allow only typed shells, bounded input and monotonic reads',async()=>{
  const f=fixture(),opened=await f.run('open',{kind:'terminal',shell:'powershell'});
  assert.equal(opened.kind,'terminal');
  await f.run('terminalWrite',{session:opened.session,text:'Get-Process\r\n'});
  await f.run('terminalRead',{session:opened.session,offset:0});
  assert.deepEqual(f.calls.slice(-2),[
    {action:'terminalWrite',data:{session:opened.session,text:'Get-Process\r\n'}},
    {action:'terminalRead',data:{session:opened.session,offset:0}}
  ]);
  assert.throws(()=>argumentsFor('open',{kind:'terminal',shell:'bash'}));
  assert.throws(()=>argumentsFor('terminalWrite',{text:'x'.repeat(4097)}));
  assert.throws(()=>argumentsFor('terminalWrite',{text:'bad\0command'}));
  assert.throws(()=>argumentsFor('terminalRead',{offset:-1}));
  await assert.rejects(f.run('send',{session:opened.session,text:'wrong'}),/does not match/);
});
test('terminal projection strips native fields and bounds streamed output',()=>{
  assert.deepEqual(project('terminalRead',{text:'hello',cursor:5,reset:false,ready:true,private:'discard'}),
    {ok:true,text:'hello',cursor:5,reset:false,ready:true,exited:false,error:''});
  assert.throws(()=>project('terminalRead',{text:'x'.repeat(128*1024+1),cursor:1}));
  const state=project('state',{shell:'cmd',terminalReady:true,terminalExited:false,terminalBase:0,terminalEnd:12,frameWidth:0,frameHeight:0,screens:[]});
  assert.equal(state.shell,'cmd');assert.equal(state.terminalReady,true);assert.equal(state.frameWidth,0);
});
