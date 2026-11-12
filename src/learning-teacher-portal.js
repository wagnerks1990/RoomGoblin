'use strict';

const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const parse=value=>value?JSON.parse(value):null;
const csv=value=>{let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};

// Native class-scoped replacement for the isolated Python demonstration portal.
class LearningTeacherPortal {
 constructor(learning){
  this.learning=learning;this.db=learning.db;this.store=learning.store;
  this.db.exec(`CREATE TABLE IF NOT EXISTS learning_portal_commands(activity_id TEXT PRIMARY KEY REFERENCES learning_activities(id),version INTEGER NOT NULL,paused INTEGER NOT NULL,hint TEXT NOT NULL,stage INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS learning_portal_reviews(signal_id INTEGER PRIMARY KEY REFERENCES learning_signals(id),score REAL NOT NULL,feedback TEXT NOT NULL,revision INTEGER NOT NULL,teacher_id TEXT NOT NULL,updated_at TEXT NOT NULL);`);
 }
 command(id){return this.db.prepare('SELECT version,paused,hint,stage FROM learning_portal_commands WHERE activity_id=?').get(id)||{version:0,paused:0,hint:'',stage:1};}
 catalog(user){
  if(!this.learning.teacherCapability?.(user))fail(403,'Teacher access required.');
  return this.db.prepare(`SELECT c.id,c.title,c.created_at,
   (SELECT COUNT(*) FROM learning_activities a WHERE a.class_id=c.id) assignmentCount,
   (SELECT COUNT(*) FROM learning_members s WHERE s.class_id=c.id AND s.role='student') studentCount,
   (SELECT MAX(t.at) FROM (
     SELECT a.class_id,s.received_at at FROM learning_signals s JOIN learning_activities a ON a.id=s.activity_id
     UNION ALL SELECT a.class_id,CAST(strftime('%s',p.created_at) AS INTEGER)*1000 at FROM learning_posts p JOIN learning_activities a ON a.id=p.activity_id
   ) t WHERE t.class_id=c.id) lastActivityAt
   FROM learning_classes c JOIN learning_members m ON m.class_id=c.id
   WHERE m.user_id=? AND m.role='teacher' ORDER BY c.title,c.id LIMIT 500`).all(user.id);
 }
 createAssignment(user,classId,input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'Enter assignment settings.');
  this.learning.membership(user,classId,true);
  const definition=input.definition?require('./learning-assignment-definition').normalize(input.definition):null;
  const templateId=definition?(definition.kind==='discussion'?require('./learning-assignment-definition').TEMPLATE:'scorm-connector-v1'):(input.templateId||'scorm-connector-v1');
  const points=definition?.points??(templateId==='scorm-connector-v1'?input.points:20);
  if(!Number.isInteger(points)||points<1||points>1000)fail(400,'Set 1–1000 possible points.');
  return this.store.tx(()=>{
   const id=this.learning.createActivity(user,classId,{title:input.title||definition?.title,templateId});
   if(definition)this.learning.definitions.save(user,id,definition);
   this.learning.platform.configure(user,id,{points});
   if(definition?.kind==='written')this.learning.assignmentAI.configure(user,id,{enabled:true,prompt:definition.gradingInstructions,criteria:definition.criteria.map(c=>({label:c.label,points:c.points,description:c.description}))});
   return id;
  });
 }
 saveCommand(user,id,input={}){
  this.learning.activity(user,id,true);
  if(typeof input.paused!=='boolean'||!Number.isInteger(input.stage)||input.stage<1||input.stage>20||typeof input.hint!=='string'||input.hint.length>300||!Number.isInteger(input.version))fail(400,'Use a pause setting, stage 1–20, and a hint of up to 300 characters.');
  this.store.tx(()=>{
   const prior=this.command(id);if(prior.version!==input.version)fail(409,'The activity controls changed. Refresh before saving.');
   this.db.prepare('INSERT INTO learning_portal_commands(activity_id,version,paused,hint,stage) VALUES(?,?,?,?,?) ON CONFLICT(activity_id) DO UPDATE SET version=excluded.version,paused=excluded.paused,hint=excluded.hint,stage=excluded.stage').run(id,prior.version+1,input.paused?1:0,input.hint,input.stage);
   this.learning.event(user,id,'portal.command',id,{paused:input.paused,stage:input.stage});
  });return this.command(id);
 }
 submission(user,id){
  if(!Number.isSafeInteger(id)||id<1)fail(400,'Choose a submission.');
  const row=this.db.prepare("SELECT s.*,m.alias,c.points FROM learning_signals s JOIN learning_activities a ON a.id=s.activity_id JOIN learning_members m ON m.class_id=a.class_id AND m.user_id=s.user_id AND m.role='student' JOIN learning_connectors c ON c.activity_id=a.id WHERE s.id=? AND s.kind='submission'").get(id);
  if(!row)fail(404,'Submission not found.');this.learning.activity(user,row.activity_id,true);return row;
 }
 review(user,id,input={}){
  const row=this.submission(user,id);
  if(typeof input.score!=='number'||!Number.isFinite(input.score)||input.score<0||input.score>row.points||typeof input.feedback!=='string'||input.feedback.length>1000||!Number.isInteger(input.revision)||input.revision<0)fail(400,'Use a score within the assignment points and feedback of up to 1000 characters.');
  this.store.tx(()=>{
   const prior=this.db.prepare('SELECT revision FROM learning_portal_reviews WHERE signal_id=?').get(id);
   if((prior?.revision||0)!==input.revision)fail(409,'This review changed. Refresh before saving.');
   this.db.prepare('INSERT INTO learning_portal_reviews(signal_id,score,feedback,revision,teacher_id,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(signal_id) DO UPDATE SET score=excluded.score,feedback=excluded.feedback,revision=excluded.revision,teacher_id=excluded.teacher_id,updated_at=excluded.updated_at').run(id,input.score,input.feedback,input.revision+1,user.id,new Date().toISOString());
   this.learning.event(user,row.activity_id,'portal.review',String(id),{score:input.score});
  });return this.db.prepare('SELECT score,feedback,revision,updated_at FROM learning_portal_reviews WHERE signal_id=?').get(id);
 }
 overview(user,classId){
  this.learning.membership(user,classId,true);
  const activities=this.db.prepare('SELECT a.*,c.points FROM learning_activities a LEFT JOIN learning_connectors c ON c.activity_id=a.id WHERE class_id=? ORDER BY a.created_at DESC,a.id LIMIT 200').all(classId).map(a=>({...a,directEnabled:this.learning.direct?.settings(a.id).enabled===true,command:this.command(a.id)}));
  const submissions=this.db.prepare("SELECT s.id,s.activity_id,s.user_id,s.received_at,s.data_json,a.title,m.alias,c.points,r.score,r.feedback,r.revision,CASE WHEN r.teacher_id='assignment-ai' THEN 'AI' WHEN r.score IS NOT NULL THEN 'Teacher' ELSE NULL END review_source,j.status ai_status,j.result_json ai_json FROM learning_signals s JOIN learning_activities a ON a.id=s.activity_id JOIN learning_members m ON m.class_id=a.class_id AND m.user_id=s.user_id AND m.role='student' JOIN learning_connectors c ON c.activity_id=a.id LEFT JOIN learning_portal_reviews r ON r.signal_id=s.id LEFT JOIN learning_assignment_ai_jobs j ON j.signal_id=s.id WHERE a.class_id=? AND s.kind='submission' ORDER BY s.id DESC LIMIT 100").all(classId).map(({data_json,ai_json,...r})=>({...r,ai:parse(ai_json),payload:parse(data_json)}));
  const discussions=this.db.prepare('SELECT p.id,p.activity_id,p.parent_id,p.body,p.kind,p.hidden,p.revision,p.created_at,m.alias,a.title FROM learning_posts p JOIN learning_activities a ON a.id=p.activity_id JOIN learning_members m ON m.class_id=a.class_id AND m.user_id=p.user_id WHERE a.class_id=? ORDER BY p.rowid DESC LIMIT 100').all(classId);
  const reviews=this.db.prepare('SELECT r.*,m.alias,a.title,a.template_id FROM learning_reviews r JOIN learning_activities a ON a.id=r.activity_id JOIN learning_members m ON m.class_id=a.class_id AND m.user_id=r.user_id WHERE a.class_id=? AND m.role=\'student\' AND r.rowid IN (SELECT MAX(x.rowid) FROM learning_reviews x JOIN learning_activities y ON y.id=x.activity_id WHERE y.class_id=? GROUP BY x.activity_id,x.user_id) ORDER BY r.rowid DESC LIMIT 100').all(classId,classId).map(r=>{
   let current;try{current=this.learning.currentReview({id:r.user_id,profileId:'learning-student',role:'viewer'},r.activity_id);}catch{current={...this.learning.projectReview(r),status:'superseded',final:null};}
   return {...current,activityId:r.activity_id,alias:r.alias,title:r.title,templateId:r.template_id,snapshot:parse(r.snapshot_json)};
  });
  const events=this.db.prepare('SELECT e.id,e.at,e.kind,e.record_id,a.title FROM learning_events e LEFT JOIN learning_activities a ON a.id=e.activity_id WHERE a.class_id=? OR (e.activity_id IS NULL AND (json_extract(e.details_json,\'$.classId\')=? OR e.record_id=?)) ORDER BY e.id DESC LIMIT 80').all(classId,classId,classId);
  const signals=this.db.prepare('SELECT s.id,s.kind,s.received_at,a.title,m.alias FROM learning_signals s JOIN learning_activities a ON a.id=s.activity_id JOIN learning_members m ON m.class_id=a.class_id AND m.user_id=s.user_id WHERE a.class_id=? ORDER BY s.id DESC LIMIT 80').all(classId);
  const counts={};
  for(const [key,table] of [['events','learning_signals'],['submissions','learning_signals'],['discussions','learning_posts']])counts[key]=this.db.prepare(`SELECT COUNT(*) n FROM ${table} x JOIN learning_activities a ON a.id=x.activity_id WHERE a.class_id=?${key==='submissions'?" AND x.kind='submission'":''}`).get(classId).n;
  counts.events+=counts.discussions;
  counts.reviewed=this.db.prepare('SELECT COUNT(*) n FROM learning_portal_reviews r JOIN learning_signals s ON s.id=r.signal_id JOIN learning_activities a ON a.id=s.activity_id WHERE a.class_id=?').get(classId).n+reviews.filter(r=>r.status==='approved').length;
  counts.pending=submissions.filter(r=>!r.revision).length+reviews.filter(r=>['needs_review','unavailable','superseded'].includes(r.status)).length;
  const recentActivity=[...signals.map(r=>({key:'signal:'+r.id,at:r.received_at,title:r.title,alias:r.alias,kind:r.kind})),...discussions.map(r=>({key:'post:'+r.id,at:Date.parse(r.created_at),title:r.title,alias:r.alias,kind:'discussion.'+r.kind}))].sort((a,b)=>b.at-a.at||a.key.localeCompare(b.key)).slice(0,80);
  return {activities,submissions,discussions,reviews,events,signals,recentActivity,counts,connectionOrigin:this.learning.platform.settings().publicOrigin};
 }
 export(user,classId){
  this.learning.membership(user,classId,true);
  const rows=this.db.prepare("SELECT s.id,s.received_at,s.data_json,a.title,m.alias,c.points,r.score,r.feedback,r.teacher_id FROM learning_signals s JOIN learning_activities a ON a.id=s.activity_id JOIN learning_members m ON m.class_id=a.class_id AND m.user_id=s.user_id JOIN learning_connectors c ON c.activity_id=a.id LEFT JOIN learning_portal_reviews r ON r.signal_id=s.id WHERE a.class_id=? AND s.kind='submission' ORDER BY s.id DESC LIMIT 5000").all(classId);
  return [['event_id','timestamp_utc','assignment','learner','possible_points','provisional_score','teacher_score','teacher_feedback','answers_json','review_source'],...rows.map(r=>{const p=parse(r.data_json);return [r.id,new Date(r.received_at).toISOString(),r.title,r.alias,r.points,p.earned,r.score,r.feedback,JSON.stringify(p.answers),r.teacher_id==='assignment-ai'?'AI':r.score!==null?'Teacher':''];})].map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n';
 }
}
module.exports={LearningTeacherPortal};
