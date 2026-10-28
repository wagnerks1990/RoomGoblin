"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/controller/lab.html"),"utf8"),between=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b));
async function flush(){for(let n=0;n<20;n++)await Promise.resolve()}
const rows=title=>({history:[{title}],total:1});
const shots=label=>({retentionDays:7,screenshots:[{url:"/"+label,capturedAt:label,downloadUrl:"/"+label+"/download"}]});
function fixture(){
 const requests=[],alerts=[],intervals=new Map();let loads=0;
 const dialog=()=>({open:false,events:{},showModal(){this.open=true},close(){this.open=false},addEventListener(name,fn){this.events[name]=fn}});
 const c={inventory:{retentionHours:168,computers:[{id:"a",name:"A"},{id:"b",name:"B"}]},historyDialog:dialog(),screenDialog:dialog(),
 historyRows:{innerHTML:""},historyMeta:{textContent:""},historyTitle:{textContent:""},historyUser:{value:"",innerHTML:""},historyHours:{value:""},historyFrom:{value:""},historyTo:{value:""},historySearch:{value:""},
 screenHistory:{innerHTML:""},screenHistoryMeta:{textContent:""},screenMeta:{textContent:""},screenTitle:{textContent:""},liveScreenState:{textContent:"",className:""},screenImage:{hidden:true,removeAttribute(name){delete this[name]}},
 esc:String,fmtTime:String,jsArg:JSON.stringify,cacheBustUrl:x=>x,Date,Math,URLSearchParams,encodeURIComponent,alert:x=>alerts.push(x),loadAll:async()=>{loads++},
 setTimeout:fn=>{Promise.resolve().then(fn);return 1},clearTimeout(){},setInterval:fn=>{const id=intervals.size+1;intervals.set(id,fn);return id},clearInterval:id=>intervals.delete(id),
 api:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))};
 vm.createContext(c);vm.runInContext(between("let currentHistoryComputer=","async function editComputer(")+between("let currentScreenComputer=","async function openPresetDialog("),c);
 return{c,requests,alerts,intervals,loads:()=>loads,
 history:id=>{c.historyDialog.open=true;vm.runInContext("currentHistoryComputer="+JSON.stringify(id)+";historyGeneration++;historyReadGeneration++;",c)},
 screen:id=>{c.screenDialog.open=true;vm.runInContext("currentScreenComputer="+JSON.stringify(id)+";liveScreenGeneration++;",c)},
 state:()=>vm.runInContext("({currentHistoryComputer,currentScreenComputer,liveScreenRequest})",c)};
}
test("older browser history cannot appear under another computer",async()=>{
 const h=fixture();h.history("a");const old=h.c.applyHistoryFilters();h.history("b");const current=h.c.applyHistoryFilters();h.requests[1].resolve(rows("Current B"));await current;h.requests[0].resolve(rows("Old A"));await old;assert.match(h.c.historyRows.innerHTML,/Current B/);assert.doesNotMatch(h.c.historyRows.innerHTML,/Old A/);
});
test("older history errors cannot replace current filtered results",async()=>{
 const h=fixture();h.history("a");const old=h.c.applyHistoryFilters(),current=h.c.applyHistoryFilters();h.requests[1].resolve(rows("Current filter"));await current;h.requests[0].reject(Error("Old request"));await old;assert.match(h.c.historyRows.innerHTML,/Current filter/);
});
test("older saved screenshots cannot appear under another computer",async()=>{
 const h=fixture();h.screen("a");const old=h.c.loadScreenHistory();h.screen("b");const current=h.c.loadScreenHistory();h.requests[1].resolve(shots("Current B"));await current;h.requests[0].resolve(shots("Old A"));await old;assert.match(h.c.screenHistory.innerHTML,/Current B/);assert.doesNotMatch(h.c.screenHistory.innerHTML,/Old A/);
});
test("an obsolete screenshot save cannot mark a different computer saved",async()=>{
 const h=fixture();h.screen("a");const pending=h.c.saveCurrentScreenshot();h.screen("b");h.c.screenMeta.textContent="Current B";h.requests[0].resolve({deliveries:[{id:"a",delivered:true}]});await pending;assert.equal(h.c.screenMeta.textContent,"Current B");assert.equal(h.loads(),0);
});
test("opening a different screen clears the previous image and history while waiting",async()=>{
 const h=fixture();h.c.screenImage.src="/old-a";h.c.screenImage.hidden=false;h.c.screenHistory.innerHTML="Old A";
 const pending=h.c.showScreen("b");assert.equal(h.c.screenImage.src,undefined);assert.equal(h.c.screenImage.hidden,true);assert.equal(h.c.screenHistory.innerHTML,"");assert.match(h.c.screenTitle.textContent,/B/);
 h.requests[0].resolve({deliveries:[{id:"b",delivered:false}]});await flush();h.requests[1].resolve({screenshots:[],retentionDays:7});await pending;h.c.closeScreenView();
});
test("old profile discovery cannot change the current computer filters or launch another read",async()=>{
 const h=fixture(),old=h.c.showHistory("a");h.c.closeHistoryView();const current=h.c.showHistory("b");h.requests[1].resolve({history:[{profile:"Current profile"}]});await flush();h.requests[2].resolve(rows("Current B"));await current;h.requests[0].resolve({history:[{profile:"Old profile"}]});await old;assert.match(h.c.historyUser.innerHTML,/Current profile/);assert.doesNotMatch(h.c.historyUser.innerHTML,/Old profile/);assert.equal(h.requests.length,3);
});
test("a filter action supersedes the initial profile request without losing its rows",async()=>{
 const h=fixture(),initial=h.c.showHistory("a");h.c.historySearch.value="current";const filtered=h.c.applyHistoryFilters();h.requests[1].resolve(rows("Current filter"));await filtered;h.requests[0].resolve({history:[{profile:"Old profile"}]});await initial;assert.match(h.c.historyRows.innerHTML,/Current filter/);assert.equal(h.requests.length,2);assert.doesNotMatch(h.c.historyUser.innerHTML,/Old profile/);
});
test("closing history clears sensitive rows and ignores a late failure",async()=>{
 const h=fixture();h.history("a");h.c.historyRows.innerHTML="Private fixture";const pending=h.c.applyHistoryFilters();h.c.closeHistoryView();assert.equal(h.c.historyRows.innerHTML,"");assert.equal(h.state().currentHistoryComputer,null);h.requests[0].reject(Error("Old"));await pending;assert.equal(h.c.historyRows.innerHTML,"");
});
test("a queued native history close event cannot invalidate a reopened view",async()=>{
 const h=fixture();h.history("a");h.c.closeHistoryView();h.history("b");h.c.historyRows.innerHTML="Current B";h.c.historyDialog.events.close();assert.equal(h.state().currentHistoryComputer,"b");assert.equal(h.c.historyRows.innerHTML,"Current B");
});
test("native screen close releases timers, image and pending history ownership",async()=>{
 const h=fixture();h.screen("a");h.c.screenImage.src="/a";h.c.screenHistory.innerHTML="A";const pending=h.c.loadScreenHistory();h.c.screenDialog.open=false;h.c.screenDialog.events.close();h.requests[0].resolve(shots("Old A"));await pending;assert.equal(h.state().currentScreenComputer,null);assert.equal(h.c.screenImage.src,undefined);assert.equal(h.c.screenHistory.innerHTML,"");
});
test("a queued native screen close event cannot clear a reopened view",()=>{
 const h=fixture();h.screen("a");h.c.closeScreenView();h.screen("b");h.c.screenMeta.textContent="Current B";h.c.screenDialog.events.close();assert.equal(h.state().currentScreenComputer,"b");assert.equal(h.c.screenMeta.textContent,"Current B");
});
for(const deliveries of [[{id:"a",delivered:false}],[{id:"b",delivered:true}],null,{}])test("capture rejects missing or mismatched delivery confirmation "+JSON.stringify(deliveries),async()=>{
 const h=fixture();h.screen("a");const pending=h.c.saveCurrentScreenshot();h.requests[0].resolve({deliveries});await pending;assert.match(h.c.screenMeta.textContent,/not delivered/);assert.doesNotMatch(h.c.screenMeta.textContent,/Screenshot saved/);assert.equal(h.c.screenImage.src,undefined);assert.equal(h.requests.length,1);assert.equal(h.loads(),0);
});
test("capture transport failures are contained and release the pending request",async()=>{
 const h=fixture();h.screen("a");const pending=h.c.captureScreenFrame("a");h.requests[0].reject(Error("Unavailable"));assert.equal(await pending,false);assert.match(h.c.screenMeta.textContent,/Capture unavailable: Unavailable/);assert.equal(h.state().liveScreenRequest,null);assert.equal(h.c.liveScreenState.textContent,"CAPTURE UNCONFIRMED");
});
test("a delivered save reports requested until saved history confirms completion",async()=>{
 const h=fixture();h.screen("a");const pending=h.c.saveCurrentScreenshot();assert.deepEqual(JSON.parse(h.requests[0].options.body),{targets:["a"],action:"screenshot",payload:{quality:85,save:true}});h.requests[0].resolve({deliveries:[{id:"a",delivered:true}]});await flush();h.requests[1].resolve({screenshots:[],retentionDays:7});await pending;assert.equal(h.c.screenImage.hidden,false);assert.match(h.c.screenMeta.textContent,/Screenshot requested/);assert.doesNotMatch(h.c.screenMeta.textContent,/Screenshot saved/);assert.equal(h.loads(),1);
});
test("older screenshot history for the same computer cannot replace the latest refresh",async()=>{
 const h=fixture();h.screen("a");const old=h.c.loadScreenHistory(),current=h.c.loadScreenHistory();h.requests[1].resolve(shots("Latest"));await current;h.requests[0].reject(Error("Old failure"));await old;assert.match(h.c.screenHistory.innerHTML,/Latest/);assert.doesNotMatch(h.c.screenHistory.innerHTML,/Old failure/);
});
test("closed history views do not issue new requests",async()=>{
 const h=fixture();h.history("a");h.screen("a");h.c.historyDialog.open=false;h.c.screenDialog.open=false;await h.c.applyHistoryFilters();await h.c.loadScreenHistory();assert.equal(h.requests.length,0);
});
test("ordinary live capture remains single-flight and old cleanup cannot clear a newer owner",async()=>{
 const h=fixture();h.screen("a");const old=h.c.captureScreenFrame("a");await h.c.captureScreenFrame("a");assert.equal(h.requests.length,1);h.c.closeScreenView(false);h.screen("b");const current=h.c.captureScreenFrame("b");h.requests[0].resolve({deliveries:[{id:"a",delivered:true}]});await old;assert.equal(h.state().liveScreenRequest.id,"b");h.requests[1].resolve({deliveries:[{id:"b",delivered:true}]});assert.equal(await current,true);assert.equal(h.state().liveScreenRequest,null);assert.match(h.c.screenImage.src,/\/b\/screenshot/);
});
