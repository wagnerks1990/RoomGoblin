"use strict";
// Calendar-day credit is decided by server receipt time, never the learner clock.
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function dateValue(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail(400,'Use a valid assignment date.');
 const date=new Date(value+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)fail(400,'Use a valid assignment date.');
 return value;
}
function titleDate(title){const m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?=\s|$)/.exec(String(title));return m?dateValue(m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0')):null;}
function timeZone(value){try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format(0);if(typeof value!=='string'||value.length>80)throw Error();return value;}catch{fail(400,'Use a valid school time zone.');}}
function dayAt(now,zone){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));return parts.year+'-'+parts.month+'-'+parts.day;}
function credit(policy,now,override=null){
 const date=override?.creditDate||policy.assignmentDate,day=dayAt(now,policy.timeZone),days=Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000);
 return {assignmentDate:policy.assignmentDate,creditDate:date,timeZone:policy.timeZone,serverDay:day,multiplier:days<=0?1:days===1?.5:0,overridden:!!override};
}
class LearningGradePolicy{
 constructor(platform){this.p=platform;this.db=platform.db;this.store=platform.store;this.learning=platform.learning;
  this.db.exec(`CREATE TABLE IF NOT EXISTS learning_grade_policies(activity_id TEXT PRIMARY KEY,assignment_date TEXT NOT NULL,time_zone TEXT NOT NULL,enabled INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS learning_grade_awards(activity_id TEXT NOT NULL,user_id TEXT NOT NULL,best_percent REAL NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0,updated_at INTEGER NOT NULL,PRIMARY KEY(activity_id,user_id));
   CREATE TABLE IF NOT EXISTS learning_grade_overrides(activity_id TEXT NOT NULL,user_id TEXT NOT NULL,credit_date TEXT NOT NULL,reason TEXT NOT NULL,teacher_id TEXT NOT NULL,PRIMARY KEY(activity_id,user_id));`);
 }
 config(id){const r=this.db.prepare('SELECT * FROM learning_grade_policies WHERE activity_id=?').get(id);return r?{enabled:!!r.enabled,assignmentDate:r.assignment_date,timeZone:r.time_zone}:null;}
 configure(user,id,input){const a=this.learning.activity(user,id,true);if(!this.p.config(id))fail(400,'Configure assignment points first.');
  if(typeof input.enabled!=='boolean')fail(400,'Choose whether dated grading is enabled.');
  const assignmentDate=dateValue(input.assignmentDate||titleDate(a.title)),zone=timeZone(input.timeZone);
  this.store.tx(()=>{const old=this.config(id);
   // Establish the known completed baseline once. Older packages reporting new
   // telemetry later cannot bypass the new policy or rewrite this baseline.
   if(!old)this.db.prepare(`INSERT INTO learning_grade_awards(activity_id,user_id,best_percent,completed,updated_at)
    SELECT activity_id,user_id,MAX(CAST(json_extract(data_json,'$.raw') AS REAL)),1,MAX(received_at) FROM learning_signals WHERE activity_id=? AND kind='completed' GROUP BY user_id`).run(id);
   this.db.prepare('INSERT INTO learning_grade_policies VALUES(?,?,?,?) ON CONFLICT(activity_id) DO UPDATE SET assignment_date=excluded.assignment_date,time_zone=excluded.time_zone,enabled=excluded.enabled').run(id,assignmentDate,zone,input.enabled?1:0);
   this.learning.event(user,id,'grading.policy',id,{assignmentDate,timeZone:zone,enabled:input.enabled});
  });return this.config(id);
 }
 override(user,id,input){const a=this.learning.activity(user,id,true);const member=this.db.prepare("SELECT user_id FROM learning_members WHERE class_id=? AND user_id=? AND role='student'").get(a.class_id,input.userId);if(!member)fail(404,'Student not found in this class.');
  if(input.creditDate===null){this.db.prepare('DELETE FROM learning_grade_overrides WHERE activity_id=? AND user_id=?').run(id,input.userId);}
  else{const date=dateValue(input.creditDate);if(typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)fail(400,'Record a short reason for this override.');this.db.prepare('INSERT INTO learning_grade_overrides VALUES(?,?,?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET credit_date=excluded.credit_date,reason=excluded.reason,teacher_id=excluded.teacher_id').run(id,input.userId,date,input.reason.trim(),user.id);}
  this.learning.event(user,id,'grading.override',input.userId);return {ok:true};
 }
 state(user,id){this.learning.activity(user,id);const cfg=this.config(id);if(!cfg)return null;
  const row=this.db.prepare('SELECT * FROM learning_grade_awards WHERE activity_id=? AND user_id=?').get(id,user.id),override=this.db.prepare('SELECT credit_date creditDate FROM learning_grade_overrides WHERE activity_id=? AND user_id=?').get(id,user.id);
  return {enabled:cfg.enabled,...credit(cfg,this.p.clock(),override),bestPercent:row?.best_percent||0,completed:!!row?.completed,recorded:!!row};
 }
 award(user,a,data){const cfg=this.config(a.id);if(!cfg?.enabled)fail(409,'The teacher has not enabled dated automatic grading for this assignment.');
  const state=this.state(user,a.id),adjusted=Math.round(data.raw*state.multiplier*100)/100,best=Math.max(state.bestPercent,adjusted);
  this.db.prepare('INSERT INTO learning_grade_awards VALUES(?,?,?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET best_percent=MAX(best_percent,excluded.best_percent),completed=MAX(completed,excluded.completed),updated_at=excluded.updated_at').run(a.id,user.id,best,data.current===data.total?1:0,this.p.clock());
  return {bestPercent:best,multiplier:state.multiplier};
 }
}
module.exports={LearningGradePolicy,titleDate,dateValue,timeZone,credit,dayAt};
