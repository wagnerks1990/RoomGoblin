"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../public/controller/app.js"),"utf8").replace(/\r\n/g,"\n");
function block(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start);return source.slice(start,end)}
function gate(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function fixture(){
 const reads=[],writes=[],errors=[],live={active:true,presentationId:"live",sessionId:"session",slide:1},decks=[{id:"live",slideCount:4},{id:"preview",slideCount:4}];
 const ctx=vm.createContext({PRES:{selectedId:"live",previewSlide:1,currentFolder:"root",folders:[],presentations:decks,state:live},api:url=>{const g=gate();reads.push({url,...g});return g.promise},jpost:(url,body)=>{const g=gate();writes.push({url,body,...g});return g.promise},alert:e=>errors.push(e),renderPresenter:()=>{},renderPresentationLibrary:()=>{},renderPresentationTargets:()=>{},previewPresentationSlide:n=>ctx.PRES.previewSlide=n,presFile:id=>ctx.PRES.presentations.find(p=>p.id===id),presFolder:()=>({id:"root"}),presentationRows:{innerHTML:""},esc:String,presStartSlide:{value:1},presStartAuto:{value:0},presStartLoop:{checked:false},presTargetSeconds:{value:0},selectedPresentationTargets:()=>["tv1"]});
 vm.runInContext(block("let presentationLibraryGeneration=","function renderPresentationLibrary(")+block("function selectPresentation(","async function renamePresentation(")+block("async function startSelectedPresentation(","function presentationSetAuto("),ctx);
 return{ctx,reads,writes,errors,live,decks,snapshot:state=>({folders:[{id:"root"}],presentations:decks,displays:[],state:state||live})};
}
test("late live control reply preserves a newer preview selection",async()=>{
 const h=fixture(),p=h.ctx.presentationControl("pause");await Promise.resolve();h.ctx.selectPresentation("preview");h.writes[0].resolve({state:{...h.live,paused:true}});await p;assert.equal(h.ctx.PRES.selectedId,"preview");assert.equal(h.ctx.PRES.state.paused,true);assert.equal(h.writes[0].body.sessionId,"session");
});
test("controls from a different preview retain that preview and target the live session",async()=>{
 const h=fixture();h.ctx.selectPresentation("preview");const p=h.ctx.presentationControl("pause");await Promise.resolve();h.writes[0].resolve({state:{...h.live,paused:true}});await p;assert.equal(h.ctx.PRES.selectedId,"preview");assert.equal(h.writes[0].body.sessionId,"session");
});
test("overlapping starts send captured deck, receivers and options in acceptance order",async()=>{
 const h=fixture(),first=h.ctx.startSelectedPresentation();await Promise.resolve();h.ctx.selectPresentation("preview");h.ctx.presStartSlide.value=3;h.ctx.selectedPresentationTargets=()=>["tv2"];const second=h.ctx.startSelectedPresentation();await Promise.resolve();assert.equal(h.writes.length,1);h.writes[0].resolve({state:h.live});await first;await Promise.resolve();assert.equal(h.writes.length,2);assert.match(h.writes[1].url,/preview\/start$/);assert.equal(h.writes[1].body.slide,3);assert.deepEqual(h.writes[1].body.targets,["tv2"]);h.writes[1].resolve({state:{...h.live,presentationId:"preview",sessionId:"new"}});await second;assert.equal(h.ctx.PRES.state.sessionId,"new");
});
test("a failed command releases later writes and reports its error",async()=>{
 const h=fixture(),first=h.ctx.presentationControl("pause"),second=h.ctx.presentationControl("set-target",{seconds:12});await Promise.resolve();h.writes[0].reject(Error("temporary failure"));await first;await Promise.resolve();assert.equal(h.writes.length,2);h.writes[1].resolve({state:{...h.live,targetSeconds:12}});await second;assert.deepEqual(h.errors,["temporary failure"]);assert.equal(h.ctx.PRES.state.targetSeconds,12);
});
test("a read started before a command cannot replace its newer result",async()=>{
 const h=fixture(),read=h.ctx.refreshPresentationState(),write=h.ctx.presentationControl("pause");await Promise.resolve();h.writes[0].resolve({state:{...h.live,paused:true}});await write;h.reads[0].resolve({state:h.live});await read;assert.equal(h.ctx.PRES.state.paused,true);
});
test("polling does not start during accepted or queued commands",async()=>{
 const h=fixture(),write=h.ctx.presentationControl("pause");await h.ctx.refreshPresentationState();assert.equal(h.reads.length,0);h.writes[0].resolve({state:h.live});await write;const read=h.ctx.refreshPresentationState();assert.equal(h.reads.length,1);h.reads[0].resolve({state:h.live});await read;
});
test("state reads coalesce so slow polling can publish without starvation",async()=>{
 const h=fixture(),a=h.ctx.refreshPresentationState(),b=h.ctx.refreshPresentationState();assert.equal(a,b);assert.equal(h.reads.length,1);h.reads[0].resolve({state:{...h.live,sessionId:"new"}});await Promise.all([a,b]);assert.equal(h.ctx.PRES.state.sessionId,"new");const c=h.ctx.refreshPresentationState();assert.equal(h.reads.length,2);h.reads[1].resolve({state:h.live});await c;
});
test("an obsolete read cannot replace or release its successor after a command",async()=>{
 const h=fixture(),a=h.ctx.refreshPresentationState(),write=h.ctx.presentationControl("pause");await Promise.resolve();h.writes[0].resolve({state:{...h.live,paused:true}});await write;const b=h.ctx.refreshPresentationState();assert.notEqual(a,b);h.reads[0].resolve({state:h.live});await a;assert.equal(h.ctx.PRES.state.paused,true);assert.equal(h.ctx.refreshPresentationState(),b);h.reads[1].resolve({state:{...h.live,sessionId:"new"}});await b;assert.equal(h.ctx.PRES.state.sessionId,"new");
});
test("a failed state read releases polling for a later attempt",async()=>{
 const h=fixture(),a=h.ctx.refreshPresentationState();h.reads[0].reject(Error("offline"));await assert.rejects(a,/offline/);const b=h.ctx.refreshPresentationState();assert.equal(h.reads.length,2);h.reads[1].resolve({state:h.live});await b;
});
for(const failure of [false,true])test(`older library ${failure?"failure":"success"} cannot overwrite a newer read`,async()=>{
 const h=fixture(),a=h.ctx.loadPresentations(),b=h.ctx.loadPresentations();h.reads[1].resolve({...h.snapshot(),displays:[{id:"new"}]});await b;if(failure)h.reads[0].reject(Error("old failure"));else h.reads[0].resolve({...h.snapshot(),displays:[{id:"old"}]});await a;assert.equal(h.ctx.PRES.displays[0].id,"new");assert.equal(h.ctx.presentationRows.innerHTML,"");
});
test("current library failures remain visible",async()=>{
 const h=fixture(),p=h.ctx.loadPresentations();h.reads[0].reject(Error("current failure"));await p;assert.match(h.ctx.presentationRows.innerHTML,/current failure/);
});
test("library refresh during a command updates inventory without replacing or retiring that command's state",async()=>{
 const h=fixture(),write=h.ctx.presentationControl("pause"),read=h.ctx.loadPresentations();await Promise.resolve();h.reads[0].resolve({...h.snapshot(),state:{...h.live,sessionId:"old"},displays:[{id:"new"}]});await read;assert.equal(h.ctx.PRES.state.sessionId,"session");h.writes[0].resolve({state:{...h.live,paused:true}});await write;assert.equal(h.ctx.PRES.state.paused,true);assert.equal(h.ctx.PRES.displays[0].id,"new");
});
test("a library response predating a live command cannot roll back its session",async()=>{
 const h=fixture(),read=h.ctx.loadPresentations(),write=h.ctx.presentationControl("pause");await Promise.resolve();h.writes[0].resolve({state:{...h.live,paused:true}});await write;h.reads[0].resolve(h.snapshot());await read;assert.equal(h.ctx.PRES.state.paused,true);
});
function presenter(){
 const ctx=vm.createContext({PRES:{selectedId:"deck",state:{active:true,presentationId:"deck",sessionId:"session",slide:1,autoAdvanceSeconds:5,targetSeconds:10}},presFile:()=>({id:"deck",name:"Deck",slideCount:0}),updatePresentationTimers:()=>{},fmtTimer:String,document:{activeElement:null}});
 for(const id of ["presSelectedName","presStateBadge","presSlideMetric","presGoto","presTargetSeconds","presAutoSeconds","presLoop","presPauseBtn","presBlackBtn","presTargetStatus","presCurrentImage","presCurrentEmpty","presNextImage","presNextEmpty","presNotes","presThumbs","presTimingHistory"])ctx[id]={style:{},value:"",type:"number"};ctx.presLoop={type:"checkbox",checked:false};
 vm.runInContext(block("const presentationFieldStates=","function previewPresentationSlide("),ctx);ctx.renderPresenter();return ctx;
}
for(const field of ["presGoto","presAutoSeconds","presTargetSeconds","presLoop"])test(`polling preserves focused and blurred ${field} drafts until acknowledged`,()=>{
 const c=presenter(),checkbox=field==="presLoop",property=checkbox?"checked":"value",draft=checkbox?true:"23";c[field][property]=draft;c.document.activeElement=c[field];c.renderPresenter();assert.equal(c[field][property],draft);c.document.activeElement=null;c.renderPresenter();assert.equal(c[field][property],draft);
 const stateKey={presGoto:"slide",presAutoSeconds:"autoAdvanceSeconds",presTargetSeconds:"targetSeconds",presLoop:"loop"}[field];c.PRES.state[stateKey]=checkbox?true:23;c.renderPresenter();c.PRES.state[stateKey]=checkbox?false:4;c.renderPresenter();assert.equal(c[field][property],checkbox?false:"4");
});
test("a successor session resets timing drafts to its own settings",()=>{
 const c=presenter();c.presAutoSeconds.value="23";c.PRES.state={...c.PRES.state,sessionId:"new",autoAdvanceSeconds:12};c.renderPresenter();assert.equal(c.presAutoSeconds.value,"12");
});
