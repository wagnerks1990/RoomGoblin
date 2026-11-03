'use strict';
// Only accepted writing is queued. Interrupted inference remains unavailable;
// a queue item that never started can safely resume after restart.
class LearningRetryQueue{
 constructor(db,{run,available=()=>true,track=p=>p,clock=Date.now,intervalMs=5000}={}){
  Object.assign(this,{db,run,available,track,clock,busy:false,closed:false});
  db.exec('CREATE TABLE IF NOT EXISTS learning_grading_pending(activity_id TEXT NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL,reply_id TEXT,accepted_at TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,ready_at INTEGER NOT NULL,PRIMARY KEY(activity_id,user_id));');
  if(intervalMs>0){this.timer=setInterval(()=>{if(!this.closed&&this.available())this.track(this.drain()).catch(()=>{});},intervalMs);this.timer.unref?.();}
 }
 enqueue({activityId,userId,fingerprint,replyId,acceptedAt,attempts=0,delayMs=0}){
  if(this.closed)return false;
  if(!valid({activityId,userId,fingerprint,replyId,acceptedAt,attempts},this.clock())||!Number.isSafeInteger(delayMs)||delayMs<0||delayMs>86400000)throw Error('Invalid queued review');
  const previous=this.db.prepare('SELECT fingerprint FROM learning_grading_pending WHERE activity_id=? AND user_id=?').get(activityId,userId);
  if(!previous&&this.db.prepare('SELECT COUNT(*) n FROM learning_grading_pending').get().n>=200)return false;
  // Identical retries retain the accepted timestamp and their place in line.
  if(previous?.fingerprint===fingerprint)return true;
  this.db.prepare('INSERT INTO learning_grading_pending(activity_id,user_id,fingerprint,reply_id,accepted_at,attempts,ready_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET fingerprint=excluded.fingerprint,reply_id=excluded.reply_id,accepted_at=excluded.accepted_at,attempts=excluded.attempts,ready_at=excluded.ready_at').run(activityId,userId,fingerprint,replyId||null,acceptedAt,attempts,this.clock()+delayMs);
  return true;
 }
 remove(job){this.db.prepare('DELETE FROM learning_grading_pending WHERE activity_id=? AND user_id=? AND fingerprint=?').run(job.activityId,job.userId,job.fingerprint);}
 async drain(){
  if(this.closed||this.busy||!this.available())return;
  const row=this.db.prepare('SELECT * FROM learning_grading_pending WHERE ready_at<=? ORDER BY ready_at,accepted_at LIMIT 1').get(this.clock());if(!row)return;
  const job={activityId:row.activity_id,userId:row.user_id,fingerprint:row.fingerprint,replyId:row.reply_id,acceptedAt:row.accepted_at,attempts:row.attempts};
  if(!valid(job,this.clock())||!Number.isSafeInteger(row.ready_at)||row.ready_at<0){this.remove(job);return;}
  this.busy=true;
  try{
   const outcome=await this.run(job);
   if(outcome==='busy'||outcome==='budget')this.db.prepare('UPDATE learning_grading_pending SET ready_at=? WHERE activity_id=? AND user_id=? AND fingerprint=?').run(this.clock()+(outcome==='budget'?3600000:5000),job.activityId,job.userId,job.fingerprint);
   else if(outcome!=='requeued')this.remove(job);
  }finally{this.busy=false;}
 }
 close(){this.closed=true;clearInterval(this.timer);}
}
function valid(job,now){
 const accepted=Date.parse(job.acceptedAt);
 return ['activityId','userId'].every(k=>typeof job[k]==='string'&&job[k].length>0&&job[k].length<=128)&&
  /^[a-f0-9]{64}$/.test(job.fingerprint)&&Number.isInteger(job.attempts)&&job.attempts>=0&&job.attempts<=2&&
  (job.replyId===null||job.replyId===undefined||typeof job.replyId==='string'&&job.replyId.length<=128)&&
  Number.isFinite(accepted)&&accepted<=now+5000&&new Date(accepted).toISOString()===job.acceptedAt;
}
module.exports={LearningRetryQueue};
