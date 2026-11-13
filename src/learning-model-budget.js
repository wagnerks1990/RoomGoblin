'use strict';
const MAX_CALLS_PER_REVIEW=24;
function exhausted(){return Object.assign(Error('Automatic grading reached its model request budget. Writing is saved for instructor review.'),{code:'LEARNING_MODEL_BUDGET'});}
function boundedModel(options,modelJSON){let calls=0;return async(o,request)=>{if(calls>=MAX_CALLS_PER_REVIEW)throw exhausted();options.consumeModelBudget?.();calls++;return modelJSON(o,request);};}
class LearningModelBudget{
 constructor(learning){this.learning=learning;this.db=learning.db;this.db.exec('CREATE TABLE IF NOT EXISTS learning_model_requests(id INTEGER PRIMARY KEY,review_id TEXT NOT NULL REFERENCES learning_reviews(id),user_id TEXT NOT NULL REFERENCES users(id),started_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS learning_model_request_time ON learning_model_requests(started_at); CREATE INDEX IF NOT EXISTS learning_model_request_review ON learning_model_requests(review_id);');}
 usedSince(since,excludeReview=null){
  const calls=this.db.prepare('SELECT COUNT(*) n FROM learning_model_requests WHERE started_at>=?').get(since).n;
  const legacy=this.db.prepare('SELECT COUNT(*) n FROM learning_reviews r WHERE model IS NOT NULL AND COALESCE(started_at,created_at)>=? AND id<>? AND NOT EXISTS(SELECT 1 FROM learning_model_requests m WHERE m.review_id=r.id)').get(since,excludeReview||'').n;
  return calls+legacy+(this.learning.assignmentAI?.startedSince(since)||0);
 }
 reserve(reviewId,userId,limit){return this.learning.store.tx(()=>{
  const since=new Date(Date.now()-86400000).toISOString();if(this.usedSince(since,reviewId)>=limit)throw exhausted();
  this.db.prepare('INSERT INTO learning_model_requests(review_id,user_id,started_at) VALUES(?,?,?)').run(reviewId,userId,new Date().toISOString());
 });}
}
module.exports={LearningModelBudget,boundedModel,MAX_CALLS_PER_REVIEW};
