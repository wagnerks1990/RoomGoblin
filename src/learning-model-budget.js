'use strict';
const MAX_CALLS_PER_REVIEW=24;
function exhausted(){return Object.assign(Error('Automatic grading reached its model request budget. Writing is saved for instructor review.'),{code:'LEARNING_MODEL_BUDGET'});}
function boundedModel(options,modelJSON){let calls=0;return async(o,request)=>{if(calls>=MAX_CALLS_PER_REVIEW)throw exhausted();options.consumeModelBudget?.();calls++;return modelJSON(o,request);};}
class LearningModelBudget{
 constructor(learning){this.learning=learning;this.db=learning.db;
  const columns='(id INTEGER PRIMARY KEY,review_id TEXT REFERENCES learning_reviews(id) ON DELETE SET NULL,user_id TEXT REFERENCES users(id) ON DELETE SET NULL,started_at TEXT NOT NULL)';
  this.db.exec('CREATE TABLE IF NOT EXISTS learning_model_requests'+columns);
  const keys=this.db.prepare('PRAGMA foreign_key_list(learning_model_requests)').all();
  if(keys.some(k=>k.on_delete!=='SET NULL'))learning.store.tx(()=>{
   if(keys.length!==2||keys.some(k=>!['learning_reviews','users'].includes(k.table)))throw Error('Unrecognized model-budget schema; migration refused');
   this.db.exec('CREATE TABLE learning_model_requests_v2'+columns+'; INSERT INTO learning_model_requests_v2 SELECT id,review_id,user_id,started_at FROM learning_model_requests; DROP TABLE learning_model_requests; ALTER TABLE learning_model_requests_v2 RENAME TO learning_model_requests;');
  });
  this.db.exec('CREATE INDEX IF NOT EXISTS learning_model_request_time ON learning_model_requests(started_at); CREATE INDEX IF NOT EXISTS learning_model_request_review ON learning_model_requests(review_id);');
 }
 usedSince(since,excludeReview=null){
  const calls=this.db.prepare('SELECT COUNT(*) n FROM learning_model_requests WHERE started_at>=?').get(since).n;
  const legacy=this.db.prepare('SELECT COUNT(*) n FROM learning_reviews r WHERE model IS NOT NULL AND COALESCE(started_at,created_at)>=? AND id<>? AND NOT EXISTS(SELECT 1 FROM learning_model_requests m WHERE m.review_id=r.id)').get(since,excludeReview||'').n;
  return calls+legacy+(this.learning.assignmentAI?.startedSince(since)||0);
 }
 reserve(reviewId,userId,limit){return this.learning.store.tx(()=>{
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw exhausted();
  const since=new Date(Date.now()-86400000).toISOString();if(this.usedSince(since,reviewId)>=limit)throw exhausted();
  this.db.prepare('INSERT INTO learning_model_requests(review_id,user_id,started_at) VALUES(?,?,?)').run(reviewId,userId,new Date().toISOString());
 });}
}
module.exports={LearningModelBudget,boundedModel,MAX_CALLS_PER_REVIEW};
