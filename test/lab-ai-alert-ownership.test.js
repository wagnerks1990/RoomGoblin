"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/controller/lab.html'),'utf8');
const response=(title='Current',count=1)=>({alerts:[{title,id:title}],cooldownMinutes:10,enabled:true,summary:{new:count,total:count}});
async function flush(){for(let n=0;n<20;n++)await Promise.resolve()}
function fixture(){
 const calls=[],timers=new Map();let timerId=0;const node=()=>({textContent:'',innerHTML:'',value:'',className:''});
 const c={URLSearchParams,encodeURIComponent,esc:String,fmtTime:String,jsArg:JSON.stringify,
 setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),
 aiAlertDialog:{open:true,events:{},showModal(){this.open=true},close(){this.open=false},addEventListener(name,fn){this.events[name]=fn}},
 api:(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject}))};
 for(const id of ['aiStatus','aiHours','aiUserSearch','aiTextSearch','aiAlertMeta','aiAlertList','aiMonitorState','aiNewCount','aiTotalCount','aiLatestSummary'])c[id]=node();
 vm.createContext(c);vm.runInContext(source.slice(source.indexOf('let aiLoadTimer='),source.indexOf('function openInstructorLock()')),c);
 return{c,calls,timers,pending:()=>vm.runInContext('aiActionPending',c)};
}
test('AI filter responses keep the newest request',async()=>{
 const h=fixture(),old=h.c.loadAiAlerts(),now=h.c.loadAiAlerts();h.calls[1].resolve(response('Current'));await now;h.calls[0].resolve(response('Old'));await old;assert.match(h.c.aiAlertList.innerHTML,/Current/);assert.doesNotMatch(h.c.aiAlertList.innerHTML,/Old/);
});
test('AI filter errors cannot replace newer data',async()=>{
 const h=fixture(),old=h.c.loadAiAlerts(),now=h.c.loadAiAlerts();h.calls[1].resolve(response());await now;h.calls[0].reject(Error('Old failure'));await old;assert.match(h.c.aiAlertList.innerHTML,/Current/);
});
test('AI replies cannot repopulate a closed dialog',async()=>{
 const h=fixture(),pending=h.c.loadAiAlerts();h.c.closeAiAlerts();h.calls[0].resolve(response('Private fixture'));await pending;assert.equal(h.c.aiAlertList.innerHTML,'');assert.equal(h.c.aiAlertMeta.textContent,'');
});
test('AI summary ignores older failures',async()=>{
 const h=fixture(),old=h.c.refreshAiSummary(),now=h.c.refreshAiSummary();h.calls[1].resolve(response());await now;h.calls[0].reject(Error('Old failure'));await old;assert.equal(h.c.aiMonitorState.textContent,'ENABLED');
});
test('late AI capture cannot schedule a closed-view refresh',async()=>{
 const h=fixture(),pending=h.c.captureAiAlert('alert-a');h.c.closeAiAlerts();h.calls[0].resolve({ok:true});assert.equal(await pending,true);assert.equal(h.timers.size,0);assert.equal(h.c.aiAlertMeta.textContent,'');
});
test('closing AI alerts clears sensitive rows and cancels a debounced search',()=>{
 const h=fixture();h.c.aiAlertList.innerHTML='Private fixture';h.c.debouncedAiLoad();assert.equal(h.timers.size,1);h.c.closeAiAlerts();assert.equal(h.timers.size,0);assert.equal(h.c.aiAlertList.innerHTML,'');
});
test('a queued native close event cannot clear a reopened AI dialog',async()=>{
 const h=fixture();h.c.closeAiAlerts();const pending=h.c.openAiAlerts();h.c.aiAlertDialog.events.close();h.calls[0].resolve(response());await pending;assert.match(h.c.aiAlertList.innerHTML,/Current/);
});
test('new text invalidates previous results before its debounce fires',async()=>{
 const h=fixture(),old=h.c.loadAiAlerts();h.c.aiTextSearch.value='new query';h.c.debouncedAiLoad();h.calls[0].resolve(response('Old'));await old;assert.doesNotMatch(h.c.aiAlertList.innerHTML,/Old/);
 [...h.timers.values()][0]();assert.match(h.calls[1].url,/search=new\+query/);h.calls[1].resolve(response());await flush();assert.match(h.c.aiAlertList.innerHTML,/Current/);
});
test('closed AI dialogs cannot start reads or actions',async()=>{
 const h=fixture();h.c.closeAiAlerts();await h.c.loadAiAlerts();await h.c.captureAiAlert('a');await h.c.setAiAlertStatus('a','dismissed');h.c.debouncedAiLoad();assert.equal(h.calls.length,0);assert.equal(h.timers.size,0);
});
test('failed status actions are contained and permit an explicit retry without replay',async()=>{
 const h=fixture(),pending=h.c.setAiAlertStatus('a','dismissed');h.calls[0].reject(Error('Offline'));assert.equal(await pending,false);assert.equal(h.pending(),false);assert.match(h.c.aiAlertMeta.textContent,/Alert action failed: Offline/);
 const retry=h.c.captureAiAlert('a');assert.equal(h.calls.filter(x=>x.options).length,2);h.calls[2].reject(Error('Still offline'));assert.equal(await retry,false);assert.equal(h.calls.filter(x=>x.options).length,2);
});
test('one accepted action retains its target and status while other actions wait',async()=>{
 const h=fixture(),first=h.c.setAiAlertStatus('a/b','acknowledged');assert.equal(await h.c.captureAiAlert('different'),false);assert.equal(h.calls.length,1);assert.match(h.calls[0].url,/a%2Fb$/);assert.deepEqual(JSON.parse(h.calls[0].options.body),{status:'acknowledged'});
 h.calls[0].resolve({ok:true});await flush();h.calls[1].resolve(response());h.calls[2].resolve(response());assert.equal(await first,true);assert.equal(h.pending(),false);
});
test('accepted actions invalidate older list and summary responses',async()=>{
 const h=fixture(),list=h.c.loadAiAlerts(),summary=h.c.refreshAiSummary(),write=h.c.captureAiAlert('a');h.calls[0].resolve(response('Old'));h.calls[1].reject(Error('Old summary'));await list;await summary;assert.doesNotMatch(h.c.aiAlertList.innerHTML,/Old/);assert.notEqual(h.c.aiMonitorState.textContent,'ERROR');
 h.calls[2].resolve({ok:true});await write;assert.match(h.c.aiAlertMeta.textContent,/Screenshot requested/);assert.equal(h.timers.size,1);
});
test('post-save refresh uses current filters without issuing a read during the write',async()=>{
 const h=fixture(),write=h.c.setAiAlertStatus('a','dismissed');h.c.aiStatus.value='acknowledged';await h.c.loadAiAlerts();await h.c.refreshAiSummary();assert.equal(h.calls.length,1);
 h.calls[0].resolve({ok:true});await flush();assert.match(h.calls[2].url,/status=acknowledged/);h.calls[1].resolve(response());h.calls[2].resolve(response('Filtered'));await write;assert.match(h.c.aiAlertList.innerHTML,/Filtered/);
});
test('capture delay is cancelled on close and an already queued callback stays inert',async()=>{
 const h=fixture(),write=h.c.captureAiAlert('a');h.calls[0].resolve({ok:true});await write;const callback=[...h.timers.values()][0];h.c.closeAiAlerts();assert.equal(h.timers.size,0);callback();assert.equal(h.calls.length,2);
});
test('late action failure cannot replace a reopened dialog with its error',async()=>{
 const h=fixture(),write=h.c.setAiAlertStatus('a','dismissed');h.c.closeAiAlerts();await h.c.openAiAlerts();assert.equal(h.calls.length,1);h.calls[0].reject(Error('Old action failed'));await write;assert.doesNotMatch(h.c.aiAlertMeta.textContent,/Old action/);
 h.calls[1].resolve(response());h.calls[2].resolve(response('New view'));await flush();assert.match(h.c.aiAlertList.innerHTML,/New view/);
});
test('current list failures are visible without exposing stale results',async()=>{
 const h=fixture();h.c.aiAlertList.innerHTML='Old results';const read=h.c.loadAiAlerts();h.calls[0].reject(Error('Unavailable'));await read;assert.match(h.c.aiAlertMeta.textContent,/could not refresh/);assert.match(h.c.aiAlertList.innerHTML,/Unavailable/);assert.doesNotMatch(h.c.aiAlertList.innerHTML,/Old results/);
});
test('older summary success cannot overwrite newer counts',async()=>{
 const h=fixture(),old=h.c.refreshAiSummary(),now=h.c.refreshAiSummary();h.calls[1].resolve(response('Current',2));await now;h.calls[0].resolve(response('Old',10));await old;assert.equal(h.c.aiNewCount.textContent,2);assert.equal(h.c.aiTotalCount.textContent,2);
});
