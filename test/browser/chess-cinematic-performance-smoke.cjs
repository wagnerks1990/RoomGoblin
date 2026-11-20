'use strict';
// Opt-in comparison baseline is a local prior bundle, never a remote dependency.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {START}=require('../../src/learning-chess');
(async()=>{
 const current=path.resolve(__dirname,'../../public/learn/chess/cinematic/view.mjs'),baseline=process.env.CHESS_PERF_BASELINE;
 const server=http.createServer((req,res)=>{const file=req.url==='/view.mjs'?current:req.url==='/baseline.mjs'?baseline:null;res.setHeader('Content-Type',file?'text/javascript':'text/html');res.end(file?fs.readFileSync(file):'<!doctype html><style>body{margin:0}#stage{width:700px;height:700px}</style><div id="stage"></div>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{browser=await chromium.launch({...(process.env.CHESS_TEST_BROWSER==='chromium'?{}:{channel:'msedge'}),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results={};
  for(const version of baseline?['baseline','view']:['view']){const page=await browser.newPage({viewport:{width:700,height:700}});await page.goto(origin);results[version]=await page.evaluate(async({version,fen})=>{const {ChessCinema}=await import('/'+version+'.mjs'),start=performance.now(),c=new ChessCinema(document.querySelector('#stage'));c.update({id:'perf',revision:0,moves:[],fen,status:'active'});const gl=c.renderer.getContext();gl.finish();const loadMs=performance.now()-start,samples=[];for(let i=0;i<10;i++){const at=performance.now();c.render();gl.finish();if(i>=2)samples.push(performance.now()-at);}samples.sort((a,b)=>a-b);const result={pieces:c.meshes.size,drawCalls:c.renderer.info.render.calls,triangles:c.renderer.info.render.triangles,geometries:c.geometries.size,loadMs:Math.round(loadMs),medianSynchronizedFrameMs:Math.round(samples[4]*10)/10};c.destroy();return result;},{version,fen:START});assert.equal(results[version].pieces,32);await page.close();}
  console.log('PASS 32-piece synchronized software-renderer measurement (not school-device FPS)',JSON.stringify(results));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
