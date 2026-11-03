'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,good}=require('./helpers/learning-fixture');
const initial='The hosts use different /26 subnets. The two blocks are .64–.127 and .128–.191. Traffic uses a reachable local router. The calculation cannot prove connectivity.';
const route=f=>'/api/v1/learning/activities/'+f.activityId;
const pending=f=>f.store.db.prepare('SELECT * FROM learning_grading_pending').all();
const configure=(f,extra={})=>f.store.setPreference('learning.ai',{enabled:true,provider:'ollama',baseURL:'http://127.0.0.1:11434/api',model:'fixture',dailyLimit:100,autonomous:true,...extra});
async function setup(t,options){const f=await fixture({...options,reviewOptions:{intervalMs:0,...options?.reviewOptions}});t.after(f.close);configure(f);return f;}
async function until(check){for(let n=0;n<100&&!check();n++)await new Promise(r=>setTimeout(r,5));assert(check());}
test('the HTTP submission returns before inference starts and the worker owns publication',async t=>{
 let calls=0;const f=await setup(t,{grader:async()=>{calls++;return good();}});
 const response=await f.rawRequest(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial,acceptedAt:'2000-01-01T00:00:00.000Z'});
 assert.equal(response.status,200);assert.equal(response.body.gradingPending,true);assert.equal(calls,0);assert.equal(f.learning.currentReview(f.a,f.activityId),null);
 assert.notEqual(pending(f)[0].accepted_at,'2000-01-01T00:00:00.000Z');
 await f.learning.reviewQueue.drain();assert.equal(calls,1);assert.equal(f.learning.currentReview(f.a,f.activityId).status,'approved');
});
test('saved queue survives a queue-owner restart, discards corrupt metadata, and closes without replay',async t=>{
 let calls=0;const f=await setup(t,{grader:async()=>{calls++;return good();}});
 await f.rawRequest(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});const old=f.learning.reviewQueue;old.close();
 const {LearningRetryQueue}=require('../src/learning-retry-queue');const resumed=new LearningRetryQueue(f.store.db,{run:old.run,intervalMs:0});t.after(()=>resumed.close());
 await resumed.drain();assert.equal(calls,1);assert.equal(pending(f).length,0);
 const post=f.learning.posts(f.a,f.activityId).find(p=>p.kind==='initial');f.learning.edit(f.a,f.activityId,post.id,{revision:1,body:initial+' Revised.'});
 resumed.enqueue({activityId:f.activityId,userId:f.a.id,fingerprint:'a'.repeat(64),acceptedAt:new Date().toISOString()});f.store.db.prepare("UPDATE learning_grading_pending SET accepted_at='not-a-date'").run();
 await resumed.drain();assert.equal(calls,1);assert.equal(pending(f).length,0);
});
test('busy student writing finishes from the saved queue without another browser request',async t=>{
 let release,calls=0;const f=await setup(t,{grader:()=>++calls===1?new Promise(r=>release=()=>r(good())):Promise.resolve(good())});
 const first=f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});await until(()=>release);
 const second=await f.request(f.b,route(f)+'/posts','POST',{kind:'initial',body:initial});assert.equal(second.body.gradingPending,true);assert.equal(pending(f).length,1);assert.equal(calls,1);
 release();await first;await f.learning.reviewQueue.drain();assert.equal(pending(f).length,0);assert.equal(calls,2);
 assert.equal(f.learning.currentReview(f.b,f.activityId).status,'approved');assert.equal(f.learning.posts(f.b,f.activityId).filter(p=>p.kind==='ai').length,2);
 await f.learning.reviewQueue.drain();assert.equal(calls,2);
});
test('queue preserves original submission time across the due date and cutoff',async t=>{
 let release,calls=0;const f=await setup(t,{grader:()=>++calls===1?new Promise(r=>release=()=>r(good())):Promise.resolve(good())});
 const first=f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});await until(()=>release);
 await f.request(f.b,route(f)+'/posts','POST',{kind:'initial',body:initial});const accepted=Date.parse(pending(f)[0].accepted_at);
 f.learning.settings(f.admin,f.activityId,{open:true,dueAt:new Date(accepted+1).toISOString(),closeAt:new Date(accepted+2).toISOString()});
 release();await first;await new Promise(r=>setTimeout(r,5));await f.learning.reviewQueue.drain();
 const review=f.learning.currentReview(f.b,f.activityId);assert.equal(review.status,'approved');assert.equal(review.final.lateMultiplier,1);assert.equal(review.final.total,17);
});
test('revisions replace queued snapshots; stale queue completion cannot erase a newer revision',async t=>{
 let release,calls=0;const f=await setup(t,{grader:()=>++calls===1?new Promise(r=>release=()=>r(good())):Promise.resolve(good())});
 const first=f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});await until(()=>release);
 const second=await f.request(f.b,route(f)+'/posts','POST',{kind:'initial',body:initial});const before=pending(f)[0].fingerprint;
 await f.request(f.b,route(f)+'/posts/'+second.body.id,'PUT',{revision:1,body:initial+' I would also test the return path.'});assert.notEqual(pending(f)[0].fingerprint,before);
 release();await first;await f.learning.reviewQueue.drain();assert.equal(pending(f).length,0);assert.equal(f.learning.currentReview(f.b,f.activityId).status,'approved');
});
test('freeze and removal of enrollment prevent queued grading',async t=>{
 let release,calls=0;const f=await setup(t,{grader:()=>++calls===1?new Promise(r=>release=()=>r(good())):Promise.resolve(good())});
 const first=f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});await until(()=>release);
 await f.request(f.b,route(f)+'/posts','POST',{kind:'initial',body:initial});release();await first;
 f.freeze(true);await f.learning.reviewQueue.drain();assert.equal(calls,1);assert.equal(pending(f).length,1);f.freeze(false);
 f.store.db.prepare('DELETE FROM learning_members WHERE class_id=? AND user_id=?').run(f.classId,f.b.id);await f.learning.reviewQueue.drain();assert.equal(calls,1);assert.equal(pending(f).length,0);
});
test('a newly submitted reply prevents the in-flight older selection from publishing',async t=>{
 let release,calls=0;const f=await setup(t,{grader:()=>++calls===1?new Promise(r=>release=()=>r(good())):Promise.resolve(good())});
 const first=f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});await until(()=>release);
 await f.rawRequest(f.a,route(f)+'/posts','POST',{kind:'critique',body:'A gateway must be a usable local router address. Test its forwarding and return path.'});
 release();await first;assert(!f.learning.posts(f.a,f.activityId).some(p=>p.kind==='ai'));
 await f.learning.reviewQueue.drain();assert.equal(f.learning.currentReview(f.a,f.activityId).final.total,20);
 assert.equal(f.learning.posts(f.a,f.activityId).filter(p=>p.kind==='ai').length,1);
});
test('temporary service failure retries twice at most and preserves accepted time',async t=>{
 let calls=0;const f=await setup(t,{grader:async()=>{calls++;const error=Error('Temporary fixture failure');error.retryable=true;throw error;}});
 await f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});const accepted=pending(f)[0].accepted_at;assert.equal(pending(f)[0].attempts,1);
 for(const attempt of [2,3]){f.store.db.prepare('UPDATE learning_grading_pending SET ready_at=0').run();await f.learning.reviewQueue.drain();assert.equal(calls,attempt);}
 assert.equal(pending(f).length,0);assert.equal(f.learning.currentReview(f.a,f.activityId).status,'unavailable');assert.equal(f.learning.posts(f.a,f.activityId).filter(p=>p.kind==='ai').length,0);
 assert(f.store.db.prepare('SELECT created_at FROM learning_reviews').all().every(r=>r.created_at===accepted));
});
test('old accepted writing consumes the current inference budget when it actually runs',async t=>{
 let calls=0;const f=await setup(t,{grader:async()=>{calls++;return good();}});configure(f,{dailyLimit:1});
 await f.rawRequest(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});
 f.store.db.prepare('UPDATE learning_grading_pending SET accepted_at=?').run(new Date(Date.now()-172800000).toISOString());
 await f.learning.reviewQueue.drain();assert.equal(calls,1);
 await f.rawRequest(f.b,route(f)+'/posts','POST',{kind:'initial',body:initial});await f.learning.reviewQueue.drain();
 assert.equal(calls,1);assert.equal(pending(f).length,1);
 assert(f.store.db.prepare('SELECT started_at FROM learning_reviews').get().started_at>new Date(Date.now()-10000).toISOString());
});
test('invalid evidence requires review without automatic inference retries',async t=>{
 let calls=0;const f=await setup(t,{grader:async()=>{calls++;throw Error('Invalid evidence reference');}});
 await f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});await f.learning.reviewQueue.drain();assert.equal(calls,1);assert.equal(pending(f).length,0);
});
test('turning grading off during inference prevents both automatic publications',async t=>{
 let release;const f=await setup(t,{grader:()=>new Promise(r=>release=()=>r(good()))});
 const request=f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});await until(()=>release);configure(f,{enabled:false});release();await request;
 assert.equal(f.learning.currentReview(f.a,f.activityId).status,'unavailable');assert(!f.learning.posts(f.a,f.activityId).some(p=>p.kind==='ai'));
});
test('review mode withholds replies and grades; explicit teacher approval publishes once',async t=>{
 const f=await setup(t);configure(f,{autonomous:false});await f.request(f.a,route(f)+'/posts','POST',{kind:'initial',body:initial});
 const review=f.learning.currentReview(f.a,f.activityId);assert.equal(review.status,'needs_review');assert.equal(review.final,null);assert(review.ai.proposedResponse);assert(!f.learning.posts(f.a,f.activityId).some(p=>p.kind==='ai'));
 const body={criteria:review.ai.criteria,summary:review.ai.summary,response:'Your boundaries support the conclusion. What would you test next?'};
 await f.request(f.admin,route(f)+'/reviews/'+review.id+'/approve','POST',body);await f.request(f.admin,route(f)+'/reviews/'+review.id+'/approve','POST',body);
 assert.equal(f.learning.posts(f.a,f.activityId).filter(p=>p.kind==='teacher').length,1);assert.equal(f.learning.currentReview(f.a,f.activityId).status,'approved');
});
