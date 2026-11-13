'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {rows,select}=require('../src/learning-cumulative-evidence'),{assessWriting}=require('../src/learning-assignment-definition');
const d={schemaVersion:1,kind:'discussion',title:'Synthetic long discussion',points:20,prompt:'Explain access and verification.',initialDirections:'Explain least privilege and tests.',replyDirections:'Improve a peer plan.',alternate:'Evaluate Modify for Viewers.',gradingInstructions:'Credit specific evidence; do not infer facts.',criteria:[{id:'access',label:'Access',description:'Explain Editors, Viewers and tests.',points:16,levels:[0,8,16]},{id:'reply',label:'Reply',description:'Justified improvement.',points:4,levels:[0,2,4]}]};
const initial='EARLY Editors may edit. '+('Unrelated filler sentence. '.repeat(170))+'MIDDLE Viewers may only read. '+('Unrelated filler sentence. '.repeat(170))+'LATE Verify denied writes.';
test('cumulative span IDs preserve every character beyond the old single-post limit',()=>{const spans=rows(initial);assert(initial.length>6000);assert.equal(spans.map(r=>r.text).join(''),initial);assert(spans.every(r=>Buffer.byteLength(r.text)<=150));assert.deepEqual(spans.map(r=>r.id),spans.map((_,i)=>i+1));assert.throws(()=>rows('x'.repeat(180101)),/budget/);});
test('all cumulative text is examined in bounded requests; early, middle and late evidence can combine',async()=>{
 const examined=new Set();let selections=0;
 const output=await assessWriting({definition:d,initial,reply:'',model:'synthetic'},async(_o,request)=>{
  const input=JSON.parse(request.input);
  if(request.text.format.name==='cumulative_evidence_selection'){
   selections++;for(const row of input.SOURCE)examined.add(row.id);assert(Buffer.byteLength(request.input)<5000);
   return {evidence:input.SOURCE.filter(r=>/EARLY|MIDDLE|LATE/.test(r.text)).map(r=>r.id)};
  }
  assert(input.STUDENT_SOURCE.some(r=>r.text.includes('EARLY')));assert(input.STUDENT_SOURCE.some(r=>r.text.includes('MIDDLE')));assert(input.STUDENT_SOURCE.some(r=>r.text.includes('LATE')));
  return {access:{level:'full',sentences:input.STUDENT_SOURCE.map(r=>r.id)}};
 });
 assert.equal(examined.size,rows(initial).length);assert(selections>1);assert.equal(output.total,16);assert.equal(output.evidenceSelection.access.chunks,selections);
});
test('selection refuses fabricated IDs and the final classifier cannot cite omitted spans',async()=>{
 await assert.rejects(select({model:'synthetic'},d,d.criteria[0],initial,async()=>({evidence:[999999]})),/selection/);
 await assert.rejects(assessWriting({definition:d,initial,reply:'',model:'synthetic'},async(_o,r)=>r.text.format.name==='cumulative_evidence_selection'?{evidence:[]}:{access:{level:'full',sentences:[1]}}),/criterion/);
});
test('long peer context remains separate from own evidence during bounded selection',async()=>{
 const reply='A justified learner correction.',seen=[];
 const output=await assessWriting({definition:d,initial:'A short learner answer.',reply,parent:initial,model:'synthetic'},async(_o,r)=>{
  if(r.text.format.name==='cumulative_evidence_selection'){assert(r.instructions.includes('peer context only'));return {evidence:JSON.parse(r.input).SOURCE.filter(s=>s.text.includes('LATE')).map(s=>s.id)};}
  const id=Object.keys(r.text.format.schema.properties)[0],input=JSON.parse(r.input);seen.push(input);if(id==='reply'){assert.equal(input.STUDENT_SOURCE[0].text,reply);assert(input.PEER_CONTEXT.includes('LATE'));assert(!input.PEER_CONTEXT.includes('EARLY'));}return {[id]:{level:'zero',sentences:[]}};
 });assert.equal(output.total,0);assert(output.evidenceSelection.reply.contextChunks>0);
});
test('two valid main posts beyond 6000 total characters receive an approved cumulative grade',async t=>{
 const {fixture}=require('./helpers/learning-fixture');
 const f=await fixture({grader:o=>assessWriting(o,async(_o,r)=>{
  if(r.text.format.name==='discussion_post_relevance')return {relevance:'related'};
  const input=JSON.parse(r.input);if(r.text.format.name==='cumulative_evidence_selection')return {evidence:input.SOURCE.slice(-2).map(row=>row.id)};
  return {access:{level:'full',sentences:[input.STUDENT_SOURCE[0].id]}};
 })});t.after(f.close);
 const created=await f.request(f.admin,'/api/v1/learning/teacher/classes/'+f.classId+'/assignments','POST',{definition:d}),id=created.body.id;
 const body='Editors use least privilege. '.repeat(145);assert(body.length<6000);
 for(let i=0;i<2;i++)assert.equal((await f.request(f.a,'/api/v1/learning/activities/'+id+'/posts','POST',{kind:'initial',body})).status,200);
 await f.learning.reviewQueue.drain();const review=f.learning.currentReview(f.a,id);assert.equal(review.status,'approved');assert.equal(review.final.total,16);assert(review.ai.evidenceSelection.access.sourceLength>6000);assert(review.ai.evidenceSelection.access.chunks>1);
});
