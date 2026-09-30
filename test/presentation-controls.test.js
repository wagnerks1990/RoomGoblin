const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const controller=fs.readFileSync(path.join(__dirname,'../public/controller/app.js'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'../src/server.js'),'utf8');
function section(source,start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
test('idle navigation previews locally and never dispatches live commands',async()=>{
 const previews=[],requests=[];
 const ctx={PRES:{selectedId:'deck',previewSlide:2,state:{active:false}},presFile:()=>({slideCount:3}),previewPresentationSlide:n=>previews.push(n),alert:message=>assert.fail(message),jpost:async(...args)=>requests.push(args)};
 vm.createContext(ctx);vm.runInContext(section(controller,'async function presentationControl(','function presentationSetAuto('),ctx);
 for(const action of ['next','previous','back'])await ctx.presentationControl(action);
 await ctx.presentationControl('goto',{slide:3});
 assert.deepEqual(previews,[3,1,1,3]);assert.equal(requests.length,0);
 // Previewing another deck must not navigate a different live presentation.
 ctx.PRES.state={active:true,presentationId:'other'};
 await ctx.presentationControl('next');assert.equal(requests.length,0);
});
test('live navigation still dispatches and updates the presenter',async()=>{
 const requests=[];let renders=0;
 const ctx={PRES:{selectedId:'deck',state:{active:true,presentationId:'deck'}},jpost:async(url,body)=>{requests.push({url,body});return {state:{active:true,presentationId:'deck',slide:2}};},renderPresenter:()=>renders++,alert:message=>assert.fail(message)};
 vm.createContext(ctx);vm.runInContext(section(controller,'async function presentationControl(','function presentationSetAuto('),ctx);
 await ctx.presentationControl('next');assert.equal(requests[0].body.action,'next');assert.equal(ctx.PRES.state.slide,2);assert.equal(renders,1);
});
test('preview navigation clamps bounds and chooses the starting slide',()=>{
 const ctx={PRES:{selectedId:'deck'},presFile:()=>({id:'deck',slideCount:3,notes:['a','b','c']}),presentationUrl:(_p,n)=>String(n)};
 for(const key of ['presStartSlide','presCurrentImage','presCurrentEmpty','presSlideMetric','presGoto','presNotes','presNextImage','presNextEmpty'])ctx[key]={style:{}};
 vm.createContext(ctx);vm.runInContext(section(controller,'function previewPresentationSlide(','function updatePresentationTimers('),ctx);
 ctx.previewPresentationSlide(99);assert.equal(ctx.PRES.previewSlide,3);assert.equal(ctx.presStartSlide.value,3);assert.equal(ctx.presNotes.value,'c');assert.equal(ctx.presNextImage.style.display,'none');
 ctx.previewPresentationSlide(0);assert.equal(ctx.PRES.previewSlide,1);assert.equal(ctx.presNextImage.src,'2');
});
test('presentation start clears only its targets before the image, while slide changes avoid blanking',async()=>{
 const commands=[];
 const ctx={presentationLibrary:{presentations:{deck:{id:'deck',name:'Deck',slideCount:3}}},presentationState:{active:true,presentationId:'deck',slide:2,targets:['tv2'],black:false},presentationSlideUrl:()=>'/slide.jpg',announcementPriorityError:()=>null,executeCommand:async command=>commands.push(command)};
 vm.createContext(ctx);vm.runInContext(section(server,'async function sendPresentationSlide(','async function presentationGoto('),ctx);
 await ctx.sendPresentationSlide({clear:true});assert.deepEqual(commands.map(c=>c.type),['display.clear','display.image']);assert.equal(commands[0].target[0],'tv2');assert.equal(commands[1].payload.slide,2);
 commands.length=0;await ctx.sendPresentationSlide();assert.deepEqual(commands.map(c=>c.type),['display.image']);
 commands.length=0;ctx.announcementPriorityError=()=>new Error('Morning Announcements have priority');
 await assert.rejects(ctx.sendPresentationSlide({clear:true}),/priority/);assert.equal(commands.length,0);
});
