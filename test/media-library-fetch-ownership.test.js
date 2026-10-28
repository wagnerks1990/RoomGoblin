"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function fixture(kind="app"){
 const source=fs.readFileSync(path.join(__dirname,kind==="app"?"../public/controller/app.js":"../public/controller/display.html"),"utf8").replace(/\r\n/g,"\n");
 const node=()=>({children:[],dataset:{},textContent:"",append(...items){this.children.push(...items)},appendChild(item){this.children.push(item)},set innerHTML(value){this.html=value;this.children=[]},get innerHTML(){return this.html||""}}),grid=node(),pending=[],notices=[];
 const ctx=vm.createContext({window:null,S:{},mediaRows:grid,api:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject})),esc:String,fmtBytes:String,inlineJsArg:JSON.stringify,el:()=>grid,document:{createElement:node},setResultSummary:(...v)=>notices.push(v),console:{warn:()=>{}},notify:(...v)=>notices.push(v)});ctx.window=ctx;
 function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
 vm.runInContext(kind==="app"?block("let mediaLibraryRequest=","\nasync function loadLabAgentCredentials"):block("let mediaLibraryGeneration=","\nwindow.loadScenes="),ctx);
 if(kind==="app")vm.runInContext(block("let goveeInventoryRequest=","\nasync function loadGovee(")+block("async function ensureAutomationMediaLibrary(","\nfunction automationMediaOptions("),ctx);
 return{ctx,grid,pending,notices,source,run:()=>ctx.loadMedia(),block};
}
const files=name=>({files:[{storedName:name,originalName:name,type:"pdf",url:"/media/"+name,size:8,modifiedAt:"2026-10-28"}]});
for(const kind of ["app","display"]){
 test(kind+" library keeps the newest fetch result",async()=>{
  const h=fixture(kind),a=h.run(),b=h.run();h.pending[1].resolve(files("new.pdf"));await b;h.pending[0].resolve(files("old.pdf"));await a;
  if(kind==="app"){assert.equal(h.ctx.S.mediaFiles[0].storedName,"new.pdf");assert.match(h.grid.innerHTML,/new.pdf/)}else assert.equal(h.grid.children[0].children[1].children[0].textContent,"new.pdf");
 });
 test(kind+" old read error cannot replace newer success",async()=>{
  const h=fixture(kind),a=h.run(),b=h.run();h.pending[1].resolve(files("new.pdf"));await b;h.pending[0].reject(Error("old failure"));await a;assert.equal(h.notices.length,0);
  if(kind==="app")assert.match(h.grid.innerHTML,/new.pdf/);else assert.equal(h.grid.children[0].children[1].children[0].textContent,"new.pdf");
 });
 test(kind+" current read failure stays visible instead of reviving old success",async()=>{
  const h=fixture(kind),a=h.run(),b=h.run();h.pending[1].reject(Error("current failure"));await b;h.pending[0].resolve(files("old.pdf"));await a;
  assert.match(kind==="app"?h.grid.innerHTML:h.grid.textContent,/current failure/);
 });
}
test("an earlier media view follows an active newer scheduler library fetch",async()=>{
 const h=fixture(),a=h.run(),b=h.ctx.ensureAutomationMediaLibrary({refresh:true});h.pending[0].resolve(files("old.pdf"));await Promise.resolve();assert.equal(h.grid.innerHTML,"");h.pending[1].resolve(files("new.pdf"));await Promise.all([a,b]);assert.match(h.grid.innerHTML,/new.pdf/);assert.equal(h.ctx.S.mediaFiles[0].storedName,"new.pdf");
});
test("ordinary picker lookup shares pending media reads and explicit refresh bypasses cache",async()=>{
 const h=fixture(),a=h.run(),b=h.ctx.ensureAutomationMediaLibrary();assert.equal(h.pending.length,1);h.pending[0].resolve(files("old.pdf"));await Promise.all([a,b]);await h.ctx.ensureAutomationMediaLibrary();assert.equal(h.pending.length,1);
 const c=h.ctx.ensureAutomationMediaLibrary({refresh:true});assert.equal(h.pending.length,2);h.pending[1].resolve(files("new.pdf"));await c;assert.equal(h.ctx.S.mediaFiles[0].storedName,"new.pdf");assert.match(h.source,/onclick="ensureAutomationMediaLibrary\(\{refresh:true\}\)/);
});
test("failed explicit scheduler refresh reports the error and preserves usable cached choices",async()=>{
 const h=fixture();h.ctx.S.mediaFiles=files("old.pdf").files;const p=h.ctx.ensureAutomationMediaLibrary({refresh:true});h.pending[0].reject(Error("unavailable"));await p;assert.equal(h.ctx.S.mediaFiles[0].storedName,"old.pdf");assert.match(h.notices[0][0],/Unable to refresh.*unavailable/);
});
test("slow schedule dependencies cannot overwrite a newer media library snapshot",async()=>{
 const h=fixture();Object.assign(h.ctx,{populateAutomationClassSelect:()=>{},selectedAutomationClassIds:()=>[],renderSchedulerClock:()=>{},renderSchedulerCalendar:()=>{},renderAutomationList:()=>{},loadMorningWatch:()=>{},autoId:{value:"existing"},automationList:{}});vm.runInContext(h.block("async function loadSchedules(){","\nfunction diagBadge("),h.ctx);
 const schedules=h.ctx.loadSchedules();const media=h.pending.find(p=>p.url==="/api/v1/media");media.resolve(files("old.pdf"));await Promise.resolve();const fresh=h.run();h.pending.at(-1).resolve(files("new.pdf"));await fresh;
 for(const p of h.pending.slice(0,5))if(p!==media)p.resolve({});await schedules;assert.equal(h.ctx.S.mediaFiles[0].storedName,"new.pdf");assert.match(h.grid.innerHTML,/new.pdf/);
});
