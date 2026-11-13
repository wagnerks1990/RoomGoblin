'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fixture}=require('./helpers/learning-fixture');
const {createPreview,originURL}=require('../tools/discussion-preview.cjs');
const definition={schemaVersion:1,kind:'discussion',title:'Synthetic discussion preview',points:20,prompt:'Editors need to change a shared file; viewers need to read it. Recommend access.',initialDirections:'Explain access and verification.',replyDirections:'Respond with a justified correction.',alternate:'Evaluate giving viewers Modify.',responseLabel:'Instructor',gradingInstructions:'Editors read/write; viewers read-only. Test both roles.',criteria:[{id:'access',label:'Access',description:'Correct access plan.',points:16,levels:[0,8,16]},{id:'reply',label:'Reply',description:'Justified correction.',points:4,levels:[0,2,4]}]};
test('local preview creates and exports a separate test assignment, serves real SCO, and reuses its receipt',async()=>{
 const f=await fixture(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-preview-'));let p;
 try{
  p=await createPreview({origin:f.base,definition,outdir:dir});
  const headers={'content-type':'application/json',origin:p.url,'x-roomgoblin-preview':'1'};
  assert.equal((await fetch(p.url+'/connect',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);
  const r=await fetch(p.url+'/connect',{method:'POST',headers,body:JSON.stringify({username:'teacher-test',password:'synthetic-test-password'})});assert.equal(r.status,200,JSON.stringify(await r.clone().json()));
  const status=await(await fetch(p.url+'/status')).json();assert.equal(status.ready,true);assert.equal(status.points,20);
  const sco=await(await fetch(p.url+'/sco/index.html')).text();assert.match(sco,/script/);
  const config=await(await fetch(p.url+'/sco/config.js')).text();assert.doesNotMatch(config,/synthetic-test-password|classroom_hub_session/);
  const receipt=JSON.parse(fs.readFileSync(path.join(dir,'test-assignment-receipt.json')));assert.notEqual(receipt.classId,f.classId);assert.equal(receipt.testOnly,true);
  assert.doesNotMatch(fs.readFileSync(path.join(dir,'creation-checkpoint.json'),'utf8'),/password|classroom_hub_session/);
  await p.close();p=await createPreview({origin:f.base,definition,outdir:dir,fetchImpl:()=>{throw Error('Receipt reuse must not sign in again');}});
  assert.equal((await(await fetch(p.url+'/status')).json()).ready,true);
 }finally{await p?.close();await f.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('preview rejects remote insecure origins and resumes uncertain setup without duplicate creation',async()=>{
 assert.throws(()=>originURL('http://example.com'));assert.throws(()=>originURL('https://example.com/path'));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-preview-'));let p;
 try{fs.writeFileSync(path.join(dir,'creation-checkpoint.json'),'{}');p=await createPreview({origin:'https://example.com',definition,outdir:dir});assert.equal((await(await fetch(p.url+'/status')).json()).uncertain,true);}finally{await p?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('local helper bounds sign-in attempts before another native authentication request',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-preview-rate-'));let p,calls=0;
 try{p=await createPreview({origin:'https://example.com',definition,outdir:dir,fetchImpl:async()=>{calls++;return new Response('{}',{status:401});}});const headers={'content-type':'application/json',origin:p.url,'x-roomgoblin-preview':'1'};
  for(let i=0;i<5;i++)assert.equal((await fetch(p.url+'/connect',{method:'POST',headers,body:JSON.stringify({username:'synthetic',password:'synthetic-invalid'})})).status,400);
  assert.equal((await fetch(p.url+'/connect',{method:'POST',headers,body:JSON.stringify({username:'synthetic',password:'synthetic-invalid'})})).status,429);assert.equal(calls,5);
 }finally{await p?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('a lost class-create response leaves a durable pending checkpoint before restart',async()=>{
 const f=await fixture(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-preview-lost-'));let p,creates=0;
 try{p=await createPreview({origin:f.base,definition,outdir:dir,fetchImpl:async(url,options)=>{const response=await fetch(url,options);if(url.endsWith('/learning/classes')&&options.method==='POST'){creates++;await response.body.cancel();throw Error('Synthetic response loss');}return response;}});
  const response=await fetch(p.url+'/connect',{method:'POST',headers:{'content-type':'application/json',origin:p.url,'x-roomgoblin-preview':'1'},body:JSON.stringify({username:'teacher-test',password:'synthetic-test-password'})});assert.equal(response.status,400);assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'creation-checkpoint.json'))).status,'class-create-pending');
  await p.close();p=await createPreview({origin:f.base,definition,outdir:dir});assert((await(await fetch(p.url+'/status')).json()).uncertain);assert.equal(creates,1);
 }finally{await p?.close();await f.close();fs.rmSync(dir,{recursive:true,force:true});}
});
