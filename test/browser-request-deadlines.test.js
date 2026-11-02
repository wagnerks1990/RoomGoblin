'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),http=require('node:http');
const root=require('node:path').join(__dirname,'..');
const read=file=>fs.readFileSync(require('node:path').join(root,file),'utf8');
const helper=read('public/shared/request.js');
const definitions={
 veyon:{file:'public/controller/veyon.js',end:'\nfunction updateSelectionCount(',name:'api',path:'/api/v1/veyon/computers'},
 controller:{file:'public/controller/app.js',end:'\nfunction jpost(',name:'api',path:'/api/v1/devices'},
 android:{file:'public/managed-displays/app.js',end:'\nfunction esc(',name:'api',path:'/android/devices/fixture/status'},
 ubuntu:{file:'public/managed-displays/ubuntu.js',end:'\n  function outcomeMessage(',name:'request',path:'/fixture/refresh'}
};
const turn=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(kind){
 const calls=[],timers=new Map();let timerId=0,loads=0,logins=0;
 const ctx=vm.createContext({URL,AbortController,DOMException,base:'/api/v1/ubuntu-displays',inventoryVersion:0,inventoryWrites:0,loadAgain:false,
   window:{AUTH_STATUS:{authEnabled:true,user:{username:'fixture'}}},applyAuthUi(){},showLogin(){logins++},load(){loads++},
   setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id},clearTimeout(id){timers.delete(id)},
   fetch(url,options){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});calls.push({url,options,resolve,reject});return promise}});
 vm.runInContext(helper,ctx);
 const def=definitions[kind],source=read(def.file),start=source.indexOf(`async function ${def.name}(`),end=source.indexOf(def.end,start);
 assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),ctx);
 return {ctx,calls,timers,loads:()=>loads,logins:()=>logins,
   invoke(options={},path=def.path){return kind==='ubuntu'?ctx.request(path,options.method||'GET',options.body):ctx.api(path,options)},
   reply(value={ok:true},status=200,body){calls.at(-1).resolve({ok:status<400,status,text:()=>body||Promise.resolve(JSON.stringify(value)),json:()=>body||Promise.resolve(value)})},
   expire(){assert.equal(timers.size,1,'an unfinished request must retain one deadline');[...timers.values()][0].fn()}};
}
for(const kind of Object.keys(definitions)){
 test(`${kind}: stalled headers release ownership without repeating a write`,async()=>{
  const h=fixture(kind),pending=h.invoke({method:'POST',body:{confirm:true}}),rejected=assert.rejects(pending,/outcome is unconfirmed/);
  assert.equal(h.calls.length,1);h.expire();await rejected;assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.timers.size,0);assert.equal(h.calls.length,1);assert.equal(h.ctx.inventoryWrites,0);
  if(kind==='ubuntu')assert.equal(h.loads(),1);
 });
 test(`${kind}: deadline remains active while the response body stalls`,async()=>{
  const h=fixture(kind),pending=h.invoke(),rejected=assert.rejects(pending,/Request timed out/);
  h.reply({},200,new Promise(()=>{}));await turn();h.expire();await rejected;
  assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.timers.size,0);
 });
 test(`${kind}: normal success clears the timer and preserves request options`,async()=>{
  const h=fixture(kind),pending=h.invoke();h.reply({ok:true,value:'fixture'});assert.equal((await pending).value,'fixture');assert.equal(h.timers.size,0);assert.equal(h.calls[0].options.credentials,kind==='veyon'?undefined:'same-origin');assert.equal(h.calls[0].options.cache,kind==='veyon'?undefined:'no-store');assert.equal(h.calls[0].options.signal.aborted,false);
 });
 test(`${kind}: failed requests clear their deadline`,async()=>{
  const h=fixture(kind),pending=h.invoke(),rejected=assert.rejects(pending,/connection lost/);h.calls[0].reject(Error('connection lost'));await rejected;assert.equal(h.timers.size,0);
 });
}
for(const kind of ['controller','android','veyon']){
 test(`${kind}: caller cancellation remains active through the body`,async()=>{
  const h=fixture(kind),caller=new AbortController(),reason=new DOMException('Caller cancelled','AbortError');let attached=0;
  const add=caller.signal.addEventListener.bind(caller.signal),remove=caller.signal.removeEventListener.bind(caller.signal);
  caller.signal.addEventListener=(...a)=>{attached++;return add(...a)};caller.signal.removeEventListener=(...a)=>{attached--;return remove(...a)};
  const pending=h.invoke({signal:caller.signal}),rejected=assert.rejects(pending,e=>e===reason);h.reply({},200,new Promise(()=>{}));await turn();caller.abort(reason);await rejected;
  assert.equal(h.calls[0].options.signal.reason,reason);assert.equal(h.timers.size,0);assert.equal(attached,0);
 });
 test(`${kind}: already-cancelled callers never send a request`,async()=>{
  const h=fixture(kind),caller=new AbortController();caller.abort();await assert.rejects(h.invoke({signal:caller.signal}),e=>e.name==='AbortError');assert.equal(h.calls.length,0);assert.equal(h.timers.size,0);
 });
}
test('controller authentication failures still clear the session and open login',async()=>{
 const h=fixture('controller'),pending=h.invoke(),rejected=assert.rejects(pending,/Authentication required/);h.reply({authRequired:true},401);await rejected;assert.equal(h.ctx.window.AUTH_STATUS.user,null);assert.equal(h.logins(),1);assert.equal(h.timers.size,0);
});
test('Android error payload and HTTP status remain available to lifecycle reconciliation',async()=>{
 const h=fixture('android'),pending=h.invoke(),rejected=assert.rejects(pending,e=>e.httpStatus===409&&e.payload.delivery==='unconfirmed');h.reply({ok:false,error:'Unconfirmed',delivery:'unconfirmed'},409);await rejected;assert.equal(h.timers.size,0);
});
test('long-running maintenance and Android operations retain separate bounded budgets',async()=>{
 for(const [path,method,expected] of [['/api/v1/devices','GET',60000],['/api/v1/commands','POST',600000],['/api/v1/maintenance/health','GET',60000],['/api/v1/maintenance/backup/create','POST',2700000],['/api/v1/maintenance/backup/fixture/inspect','GET',2700000],['/api/v1/maintenance/android/devices/fixture/action','POST',600000]]){
  const h=fixture('controller'),pending=h.invoke({method},path);assert.equal([...h.timers.values()][0].ms,expected,path);h.reply();await pending;
 }
 const h=fixture('ubuntu'),pending=h.invoke({method:'PUT',body:{}},'/fixture/screens');assert.equal([...h.timers.values()][0].ms,60000);h.reply();await pending;
});
test('operator entry pages load the deadline owner before their API callers',()=>{
 for(const [file,caller] of [['public/controller/index.html','/controller/app.js'],['public/managed-displays/index.html','/managed-displays/app.js'],['public/managed-displays/index.html','/managed-displays/ubuntu.js'],['public/controller/veyon.html','/controller/veyon.js']]){
  const source=read(file);assert.ok(source.indexOf('/shared/request.js')>=0&&source.indexOf('/shared/request.js')<source.indexOf(caller),file);
 }
});
test('invalid request URLs do not retain caller listeners or start transport',async()=>{
 const h=fixture('controller'),caller=new AbortController();let listeners=0;
 caller.signal.addEventListener=()=>{listeners++};await assert.rejects(h.invoke({signal:caller.signal},'http://['));
 assert.equal(listeners,0);assert.equal(h.timers.size,0);assert.equal(h.calls.length,0);
});
test('real fetch aborts a stalled HTTP body and closes its socket',{timeout:5000},async t=>{
 let closed=false,bodyStarted=false,expire,headersRead;
 const headers=new Promise(resolve=>{headersRead=resolve});
 const server=http.createServer((req,res)=>{res.on('close',()=>{closed=true});res.writeHead(200,{'content-type':'application/json'});res.write('{');bodyStarted=true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))});
 const ctx=vm.createContext({URL,AbortController,DOMException,fetch:async(...args)=>{const response=await fetch(...args);headersRead();return response},setTimeout:fn=>{expire=fn},clearTimeout(){}});vm.runInContext(helper,ctx);
 const rejected=assert.rejects(ctx.RoomGoblinRequest.read(`http://127.0.0.1:${server.address().port}/fixture`),/Request timed out/);
 await headers;await turn();expire();await rejected;assert.equal(bodyStarted,true);
 for(let i=0;i<30&&!closed;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(closed,true);
});
