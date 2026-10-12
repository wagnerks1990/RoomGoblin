'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const html=fs.readFileSync('public/document-viewer/index.html','utf8');
const execute=(source,globals)=>vm.runInNewContext('(async()=>{'+source+'\n})()',globals);

async function viewer(html,{file='/media/lesson%20%2B%20notes.pdf?v=fixture&access_token=test-asset-token',auto=0,loop=true,page=1,failure=null}={}){
  const elements=Object.fromEntries(['canvas','status','error','prev','next','play'].map(id=>[id,{
    hidden:id==='error',style:{},textContent:'',onclick:null,
    click(){return this.onclick?.()},getContext(){return {}}
  }]));
  const loads=[],renders=[],events={},intervals=new Map();
  let timerId=0;
  const query=new URLSearchParams({auto:String(auto),loop:loop?'1':'0',page:String(page)});
  if(file!==null)query.set('file',file);
  const pdfjsLib={GlobalWorkerOptions:{},getDocument(options){
    loads.push(options);
    // PDF.js 6 accepts a DocumentInitParameters object, not a bare URL string.
    const error=failure||(!options?.url?Error('getDocument - expected either data, range, or url parameter'):null);
    return {promise:error?Promise.reject(error):Promise.resolve({
      numPages:3,async getPage(number){return {
        getViewport:({scale})=>({width:600*scale,height:800*scale}),
        render:()=>{renders.push(number);return {promise:Promise.resolve()}}
      }}
    })};
  }};
  const globals={pdfjsLib,document:{getElementById:id=>elements[id]},
    location:{search:'?'+query},URLSearchParams,innerWidth:1200,innerHeight:800,devicePixelRatio:2,
    addEventListener:(type,fn)=>{events[type]=fn},
    setInterval:fn=>{const id=++timerId;intervals.set(id,fn);return id},
    clearInterval:id=>intervals.delete(id),
    prev:elements.prev,next:elements.next,play:elements.play};
  const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;\s*$/m,'');
  await execute(source,globals);
  const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve()};
  return {elements,loads,renders,intervals,flush,
    async click(id){elements[id].click();await flush()},
    async key(key){events.keydown({key});await flush()},
    async tick(){for(const fn of [...intervals.values()])fn();await flush()}};
}

test('document viewer supplies PDF.js 6 with the complete signed URL and paints the first page',async()=>{
  const v=await viewer(html);
  assert.equal(v.loads.length,1);
  assert.equal(typeof v.loads[0],'object');
  assert.equal(v.loads[0].url,'/media/lesson%20%2B%20notes.pdf?v=fixture&access_token=test-asset-token');
  assert.deepEqual(v.renders,[1]);
  assert.equal(v.elements.status.textContent,'Page 1 / 3');
  assert.equal(v.elements.error.hidden,true);
  assert.equal(v.elements.canvas.width,1200);
  assert.equal(v.elements.canvas.height,1600);
});

test('document buttons and keyboard navigate with the configured wrap behavior',async()=>{
  const v=await viewer(html);
  await v.click('next');
  await v.click('prev');
  await v.click('prev');
  await v.key('ArrowRight');
  await v.key('PageDown');
  await v.key('PageUp');
  assert.deepEqual(v.renders,[1,2,1,3,1,2,1]);
});

test('document auto advance pauses, resumes and stops at the final page without looping',async()=>{
  const v=await viewer(html,{auto:1000,loop:false,page:2});
  assert.equal(v.intervals.size,1);
  await v.click('play');
  assert.equal(v.intervals.size,0);
  await v.tick();
  assert.deepEqual(v.renders,[2]);
  await v.key(' ');
  await v.tick();
  await v.tick();
  assert.deepEqual(v.renders,[2,3]);
  assert.equal(v.intervals.size,0);
  assert.equal(v.elements.play.textContent,'Auto');
  await v.click('next');
  assert.deepEqual(v.renders,[2,3]);
});

test('document auto advance wraps when looping is enabled',async()=>{
  const v=await viewer(html,{auto:1000,page:3});
  await v.tick();
  assert.deepEqual(v.renders,[3,1]);
  assert.equal(v.intervals.size,1);
});

test('missing document URL shows a clear error without starting PDF.js or an interval',async()=>{
  const v=await viewer(html,{file:null,auto:1000});
  assert.equal(v.loads.length,0);
  assert.equal(v.elements.error.textContent,'Unable to display document: No PDF specified');
  assert.equal(v.elements.canvas.hidden,true);
  assert.equal(v.elements.error.hidden,false);
  assert.equal(v.intervals.size,0);
});

test('document loading failure stays visible and never starts auto advance',async()=>{
  const v=await viewer(html,{failure:Error('PDF request failed'),auto:1000});
  assert.equal(v.elements.error.textContent,'Unable to display document: PDF request failed');
  assert.equal(v.elements.status.textContent,'Error');
  assert.equal(v.elements.canvas.hidden,true);
  assert.equal(v.elements.error.hidden,false);
  assert.equal(v.intervals.size,0);
});

test('Hub serves matching PDF.js compatibility assets for kiosk browsers',()=>{
  const path=require('node:path');
  const server=fs.readFileSync('src/server.js','utf8');
  const route=server.split('\n').find(line=>line.startsWith('app.use("/vendor/pdfjs",'));
  assert.ok(route,'PDF.js asset route is required');
  let mounted;
  vm.runInNewContext(route,{
    __dirname:path.resolve('src'),path,
    express:{static:directory=>directory},
    app:{use:(url,directory)=>{mounted={url,directory}}}
  });
  assert.equal(mounted.url,'/vendor/pdfjs');
  assert.equal(mounted.directory,path.resolve('node_modules/pdfjs-dist/legacy/build'));
  for(const name of ['pdf.mjs','pdf.worker.mjs']){
    assert.ok(fs.statSync(path.join(mounted.directory,name)).size>0,name+' must be packaged');
  }
});
