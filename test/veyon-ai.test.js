'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {VeyonAI,validateResult,MODEL_SHA256}=require('../src/veyon-ai');
const good={ok:true,modelSha256:MODEL_SHA256,detections:[{label:'Word',confidence:.7,box:[0,0,10,10]}]};
test('AI results require exact model and bounded valid detections',()=>{
  assert.deepEqual(validateResult({...good,private:'secret'}).detections,good.detections);
  assert.equal(validateResult({...good,private:'secret'}).private,undefined);
  for(const value of [{...good,modelSha256:'wrong'},{...good,detections:Array(101).fill(good.detections[0])},{...good,detections:[{...good.detections[0],confidence:NaN}]}])assert.throws(()=>validateResult(value));
});
test('AI is disabled without separate configuration and never captures a screen',async()=>{
  const ai=new VeyonAI({token:''});let captured=false;
  await assert.rejects(ai.analyze(async()=>{captured=true}),/Configure/);assert.equal(captured,false);
});
test('AI calls only the fixed loopback service, returns no token and releases busy state',async()=>{
  let request;const ai=new VeyonAI({token:'fixture-token-not-a-secret-000000000',fetchImpl:async(url,options)=>{request={url,options};return new Response(JSON.stringify(good))}});
  const r=await ai.analyze(async()=>Buffer.from('sample'));assert.equal(request.url,'http://127.0.0.1:3025/analyze');assert.equal(request.options.redirect,'error');assert.equal(r.retained,false);assert.equal(ai.busy,false);
  assert.equal(JSON.stringify(r).includes('fixture-token'),false);
});
test('AI rejects concurrent calls, oversized capture and response without retry',async()=>{
  let release;const capture=new Promise(resolve=>{release=resolve}),ai=new VeyonAI({token:'fixture-token-not-a-secret-000000000',fetchImpl:async()=>new Response('x'.repeat(65537))});
  const first=ai.analyze(()=>capture);await assert.rejects(ai.analyze(async()=>Buffer.from('other')),/already running/);
  release(Buffer.from('sample'));await assert.rejects(first,/failed/);assert.equal(ai.busy,false);
  await assert.rejects(ai.analyze(async()=>Buffer.alloc(4*1024*1024+1)),/failed/);
});
