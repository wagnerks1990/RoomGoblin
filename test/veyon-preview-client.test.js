'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync('public/controller/veyon.js','utf8');
const imageHelper=source.slice(source.indexOf('async function imageFrame('),source.indexOf('async function fetchThumbnail('));
function fixture({ok=true,type='image/jpeg',decodeError=false}={}){
  const revoked=[],created=[];
  const context={AbortController,setTimeout,clearTimeout,fetch:async()=>({ok,status:502,json:async()=>({error:'Connection expired'}),blob:async()=>({size:15,type})}),URL:{createObjectURL:()=>{created.push('blob:frame');return 'blob:frame'},revokeObjectURL:url=>revoked.push(url)},Image:class{decode(){return decodeError?Promise.reject(new Error('Corrupt image')):Promise.resolve()}}};
  vm.runInNewContext(imageHelper,context);return {...context,created,revoked};
}
test('preview accepts a decoded PNG fallback and transfers object URL ownership',async()=>{
  const c=fixture({type:'image/png'});assert.equal(await c.imageFrame('/frame',new AbortController()),'blob:frame');assert.equal(c.revoked.length,0);
});
test('preview rejects JSON error responses before creating an image URL',async()=>{
  const c=fixture({ok:false});await assert.rejects(c.imageFrame('/frame',new AbortController()),/Connection expired/);assert.equal(c.created.length,0);
  const bad=fixture({type:'application/json'});await assert.rejects(bad.imageFrame('/frame',new AbortController()),/No valid screen/);assert.equal(bad.created.length,0);
});
test('corrupt framebuffer URLs are revoked when decode fails',async()=>{
  const c=fixture({decodeError:true});await assert.rejects(c.imageFrame('/frame',new AbortController()),/Corrupt image/);assert.deepEqual(c.revoked,['blob:frame']);
});
test('role, search and connection filters compose without changing selected targets',()=>{
  const controls={deviceSearch:{value:'ALICE'},connectionFilter:{value:'online'}};
  const context={$:id=>controls[id],roleFilter:'student',computers:[{id:'a',role:'student',online:true,user:{login:'alice'}},{id:'b',role:'teacher',online:true,user:{login:'alice'}},{id:'c',role:'student',online:false,user:{login:'alice'}}]};
  vm.runInNewContext(source.slice(source.indexOf('function visibleComputers('),source.indexOf('function render(')),context);
  assert.deepEqual(Array.from(context.visibleComputers(),c=>c.id),['a']);context.roleFilter='all';assert.deepEqual(Array.from(context.visibleComputers(),c=>c.id),['a','b']);
});
test('intentional preview cancellation retains the last image and retries without failure backoff',async()=>{
  const state={url:'blob:last-good',message:'Updated recently',failures:0,nextTry:0,busy:false};
  const img={src:'blob:last-good',hidden:false,classList:{remove(){},add(){throw new Error('Cancellation must not mark the image stale')}}};
  let calls=0,scheduled=0;
  const context={AbortController,Date,CSS:{escape:x=>x},computers:[{id:'pc',online:true}],thumbState:new Map([['pc',state]]),previewsPaused:false,liveId:null,
    window:{frameElement:null},document:{hidden:false,querySelector:()=>img},$:()=>({dataset:{layout:'compact'}}),
    thumbnailUrl:()=>'/frame',THUMB_REFRESH_MS:10000,URL:{revokeObjectURL(){}},setThumbStatus:(_,message)=>state.message=message,
    queueVisibleThumbnails(){},setTimeout:()=>{scheduled++},imageFrame:(_,controller)=>{
      calls++;
      if(calls>1)return Promise.resolve('blob:new-good');
      return new Promise((resolve,reject)=>controller.signal.addEventListener('abort',()=>reject(new Error('Aborted')),{once:true}));
    }};
  vm.runInNewContext(source.slice(source.indexOf('function previewSurfaceVisible('),source.indexOf('async function mapThumbLimit(')),context);
  const pending=context.fetchThumbnail('pc');context.cancelThumbnailRequests();await pending;
  assert.equal(state.failures,0);assert.equal(state.nextTry,0);assert.equal(state.message,'Updated recently');assert.equal(img.src,'blob:last-good');assert.equal(state.busy,false);assert.equal(scheduled,1);
  await context.fetchThumbnail('pc');assert.equal(calls,2);assert.equal(img.src,'blob:new-good');assert.equal(state.failures,0);
});
test('preview visibility includes a hidden containing iframe',()=>{
  const context={document:{hidden:false},window:{frameElement:{getClientRects:()=>[]}}};
  vm.runInNewContext(source.slice(source.indexOf('function previewSurfaceVisible('),source.indexOf('function cancelThumbnailRequests(')),context);
  assert.equal(context.previewSurfaceVisible(),false);
  context.window.frameElement=null;assert.equal(context.previewSurfaceVisible(),true);
  context.document.hidden=true;assert.equal(context.previewSurfaceVisible(),false);
});
