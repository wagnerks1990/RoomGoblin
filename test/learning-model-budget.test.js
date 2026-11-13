'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {boundedModel,MAX_CALLS_PER_REVIEW}=require('../src/learning-model-budget'),{fixture}=require('./helpers/learning-fixture');
test('each provider subrequest is charged and a review cannot dispatch beyond its hard cap',async()=>{
 let charged=0,dispatched=0;const call=boundedModel({consumeModelBudget:()=>charged++},async()=>{dispatched++;return {};});
 for(let i=0;i<MAX_CALLS_PER_REVIEW;i++)await call({},{});
 await assert.rejects(call({},{}),e=>e.code==='LEARNING_MODEL_BUDGET');assert.equal(charged,MAX_CALLS_PER_REVIEW);assert.equal(dispatched,MAX_CALLS_PER_REVIEW);
});
function review(f,user){const id=crypto.randomUUID(),stamp=new Date().toISOString();f.learning.db.prepare("INSERT INTO learning_reviews(id,activity_id,user_id,fingerprint,snapshot_json,status,model,created_at,updated_at,started_at) VALUES(?,?,?,?,?,'grading','synthetic',?,?,?)").run(id,f.activityId,user.id,id,'{}',stamp,stamp,stamp);return id;}
test('daily reservations persist, count each subrequest, and refuse another learner before dispatch',async t=>{
 const f=await fixture();t.after(f.close);const budget=f.learning.modelBudget,id=review(f,f.a),since=new Date(Date.now()-86400000).toISOString();
 budget.reserve(id,f.a.id,2);budget.reserve(id,f.a.id,2);assert.equal(budget.usedSince(since),2);
 assert.throws(()=>budget.reserve(id,f.a.id,2),e=>e.code==='LEARNING_MODEL_BUDGET');const other=review(f,f.b);assert.throws(()=>budget.reserve(other,f.b.id,2),e=>e.code==='LEARNING_MODEL_BUDGET');
 assert.equal(f.learning.db.prepare('SELECT COUNT(*) n FROM learning_model_requests').get().n,2);
 const reopened=new(require('../src/learning-model-budget').LearningModelBudget)(f.learning);assert.throws(()=>reopened.reserve(id,f.a.id,2),e=>e.code==='LEARNING_MODEL_BUDGET');
});
test('exhaustion retains the saved response for review and publishes no automatic comment or score',async t=>{
 let dispatched=0;const f=await fixture({grader:async o=>{for(let i=0;i<2;i++){o.consumeModelBudget();dispatched++;}throw Error('Budget should stop the second call');}});t.after(f.close);f.store.setPreference('learning.ai',{enabled:true,model:'synthetic-fixture-model',dailyLimit:1,autonomous:true});
 const r=await f.request(f.a,'/api/v1/learning/activities/'+f.activityId+'/posts','POST',{kind:'initial',body:'The response must stay saved even when automatic grading reaches its budget.'});assert.equal(r.status,200);await f.learning.reviewQueue.drain();const result=f.learning.currentReview(f.a,f.activityId);assert.equal(result.status,'unavailable');assert.equal(result.ai.budgetExceeded,true);assert.equal(result.final,null);assert.equal(dispatched,1);assert(f.learning.posts(f.a,f.activityId).some(p=>p.kind==='initial'));assert(!f.learning.posts(f.a,f.activityId).some(p=>p.kind==='ai'));
});
test('the actual long-form grading path cannot turn one review into unbounded provider calls',async()=>{
 const {gradeWriting}=require('../src/learning-grader');const d=JSON.parse(JSON.stringify(require('../examples/assignments/it3-password-storage.json')));let calls=0,charges=0;
 await assert.rejects(gradeWriting({definition:d,initial:'Long untrusted source. '.repeat(2000),reply:'',model:'synthetic',consumeModelBudget:()=>charges++,fetchImpl:async(_url,options)=>{calls++;const request=JSON.parse(options.body),keys=Object.keys(request.text.format.schema.properties),value=request.text.format.name==='cumulative_evidence_selection'?{evidence:[]}:Object.fromEntries(keys.map(k=>[k,{level:'zero',sentences:[]} ]));return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]}),{status:200});}}),e=>e.code==='LEARNING_MODEL_BUDGET');
 assert.equal(calls,MAX_CALLS_PER_REVIEW);assert.equal(charges,MAX_CALLS_PER_REVIEW);
});
