'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture,good}=require('./helpers/learning-fixture');
test('evidence disagreement retains writing and coaching but requires teacher publication',async t=>{
 const f=await fixture({grader:async()=>({...good(),reviewRequired:true})});t.after(f.close);
 const base='/api/v1/learning/activities/'+f.activityId;
 const posted=await f.request(f.a,base+'/posts','POST',{kind:'initial',body:'Synthetic saved evidence requiring review.'});
 assert.equal(posted.status,200);await f.learning.reviewQueue.drain();
 const review=f.learning.currentReview(f.a,f.activityId);assert.equal(review.status,'needs_review');assert.equal(review.ai.reviewRequired,true);assert.equal(review.final,null);
 assert(f.learning.posts(f.a,f.activityId).some(p=>p.id===posted.body.id));assert.equal(f.learning.posts(f.a,f.activityId).filter(p=>p.kind==='ai').length,1);
 assert.equal((await f.request(f.a,base+'/receipt')).status,409);
 assert.equal(f.learning.db.prepare("SELECT COUNT(*) n FROM learning_events WHERE activity_id=? AND kind='grade.automated'").get(f.activityId).n,0);
 assert.equal(f.learning.db.prepare("SELECT COUNT(*) n FROM learning_events WHERE activity_id=? AND kind='grade.review_required'").get(f.activityId).n,1);
 assert.equal(f.learning.currentReview(f.b,f.activityId),null);
 await f.request(f.a,base+'/submit','POST',{});await f.learning.reviewQueue.drain();assert.equal(f.learning.posts(f.a,f.activityId).filter(p=>p.kind==='ai').length,1);
 const approved=await f.request(f.admin,base+'/reviews/'+review.id+'/approve','POST',{criteria:review.ai.criteria,summary:review.ai.summary,response:''});assert.equal(approved.status,200);
 assert.equal(f.learning.currentReview(f.a,f.activityId).final.source,'teacher');assert.equal((await f.request(f.a,base+'/receipt')).status,200);
});
