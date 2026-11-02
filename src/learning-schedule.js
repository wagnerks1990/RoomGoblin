'use strict';

// Local planning data only. Signed LMS launches still own learner identity.
const crypto=require('node:crypto');
const {validDateKey}=require('./school-schedule');
const KEY='learning.schedule';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const clean=v=>typeof v==='string'&&v.trim()&&v.length<=120&&!/[\u0000-\u001f\u007f]/.test(v);

class LearningSchedule{
 constructor(platform,{source=()=>({classes:[],active:[],day:'',reason:'RoomGoblin timetable is unavailable.'}),writable=()=>true}={}){
  this.platform=platform;this.learning=platform.learning;this.store=platform.store;this.db=platform.db;
  this.source=source;this.writable=writable;this.clock=platform.clock;
  this.db.exec(
   'CREATE TABLE IF NOT EXISTS learning_schedule_links(schedule_id TEXT PRIMARY KEY,class_id TEXT NOT NULL REFERENCES learning_classes(id),managed INTEGER NOT NULL DEFAULT 0,last_title TEXT NOT NULL);'+
   'CREATE TABLE IF NOT EXISTS learning_schedule_sessions(session_id TEXT PRIMARY KEY REFERENCES learning_live_sessions(id),schedule_id TEXT NOT NULL,occurrence_key TEXT NOT NULL);'+
   'CREATE TABLE IF NOT EXISTS learning_schedule_pauses(class_id TEXT NOT NULL REFERENCES learning_classes(id),day TEXT NOT NULL,PRIMARY KEY(class_id,day));'
  );
 }
 settings(){
  const v=this.store.getPreference(KEY,{});
  return plain(v)&&typeof v.ownerId==='string'?{enabled:v.enabled===true,ownerId:v.ownerId}:{enabled:false,ownerId:null};
 }
 context(){
  let raw;try{raw=this.source(new Date(this.clock()));}catch{return {classes:[],active:[],day:'',reason:'RoomGoblin timetable is unavailable.'};}
  if(!plain(raw)||!Array.isArray(raw.classes)||raw.classes.length>500||!Array.isArray(raw.active)||raw.active.length>500||!validDateKey(raw.day)||raw.classes.some(c=>!plain(c)||!clean(c.id)||!clean(c.title)))return {classes:[],active:[],day:'',reason:'RoomGoblin timetable is unavailable.'};
  const classes=raw.classes.filter(c=>plain(c)&&clean(c.id)&&clean(c.title)&&c.transition!==true);
  if(new Set(classes.map(c=>c.id)).size!==classes.length)return {classes:[],active:[],day:raw.day,reason:'RoomGoblin class identifiers conflict.'};
  const now=this.clock();
  const active=raw.active.filter(a=>plain(a)&&classes.some(c=>c.id===a.scheduleId&&c.enabled!==false)&&clean(a.key)&&Number.isSafeInteger(a.startAt)&&Number.isSafeInteger(a.endAt)&&a.startAt<=now&&now<a.endAt&&a.endAt-a.startAt<=180*60000&&a.endAt>a.startAt);
  if(active.length!==raw.active.length)return {classes,active:[],day:raw.day,reason:'RoomGoblin timetable has an unavailable or invalid active period.'};
  return {classes,active:raw.blocked===true?[]:active,day:raw.day,reason:raw.reason||''};
 }
 owner(){
  const cfg=this.settings(),u=this.store.listUsers().find(u=>u.id===cfg.ownerId&&u.enabled);
  return u&&this.learning.teacherCapability?.(u)?u:null;
 }
 links(){return this.db.prepare('SELECT * FROM learning_schedule_links ORDER BY schedule_id').all();}
 configure(user,input){
  if(!plain(input)||typeof input.enabled!=='boolean'||input.links!==undefined&&(!Array.isArray(input.links)||input.links.length>500))fail(400,'Choose automatic mode and valid class mappings.');
  if(!this.writable())fail(423,'Backup or shutdown in progress.');
  const context=this.context(),seen=new Set(),links=input.links||[];
  if(input.enabled&&!context.day)fail(409,'RoomGoblin timetable is unavailable.');
  for(const link of links){
   if(!plain(link)||!context.classes.some(c=>c.id===link.scheduleId)||seen.has(link.scheduleId))fail(400,'Choose each current RoomGoblin class once.');
   seen.add(link.scheduleId);
   if(link.classId!==undefined&&link.classId!==''&&(typeof link.classId!=='string'||!/^[a-f0-9-]{36}$/.test(link.classId)))fail(400,'Choose an existing learning class or automatic import.');
   if(link.classId)this.learning.membership(user,link.classId,true);
  }
  // Never grant the new owner another teacher's existing class implicitly.
  for(const existing of this.links()){
   const requested=links.find(l=>l.scheduleId===existing.schedule_id);
   if(input.enabled&&!requested?.classId)this.learning.membership(user,existing.class_id,true);
  }
  this.store.tx(()=>{
   this.store.setPreference(KEY,{enabled:input.enabled,ownerId:input.enabled?user.id:this.settings().ownerId||user.id});
   for(const link of links){
    if(!link.classId)continue;
    const source=context.classes.find(c=>c.id===link.scheduleId);
    this.db.prepare('INSERT INTO learning_schedule_links VALUES(?,?,0,?) ON CONFLICT(schedule_id) DO UPDATE SET class_id=excluded.class_id,managed=0,last_title=excluded.last_title').run(link.scheduleId,link.classId,source.title.slice(0,100));
   }
   this.sync(context,user);
   this.learning.event(user,null,'classroom.automatic.configure',null,{enabled:input.enabled,mappings:links.length});
  });
  this.reconcile();return this.status(user);
 }
 sync(context,owner){
  if(!this.settings().enabled)return;
  for(const source of context.classes){
   if(source.enabled===false)continue;
   const title=source.title.trim().slice(0,100),existing=this.db.prepare('SELECT * FROM learning_schedule_links WHERE schedule_id=?').get(source.id);
   if(existing){
    try{this.learning.membership(owner,existing.class_id,true);}catch{continue;}
    // Imported titles follow planning; linked existing learning titles are retained.
    if(existing.managed&&existing.last_title!==title){
     this.db.prepare('UPDATE learning_classes SET title=? WHERE id=? AND title=?').run(title,existing.class_id,existing.last_title);
     this.db.prepare('UPDATE learning_schedule_links SET last_title=? WHERE schedule_id=?').run(title,source.id);
    }
    continue;
   }
   const matches=this.learning.classes(owner).filter(c=>c.role==='teacher'&&c.title===title&&!this.db.prepare('SELECT 1 FROM learning_schedule_links WHERE class_id=?').get(c.id));
   const classId=matches.length===1?matches[0].id:this.learning.createClass(owner,title);
   this.db.prepare('INSERT INTO learning_schedule_links VALUES(?,?,?,?)').run(source.id,classId,matches.length===1?0:1,title);
   this.learning.event(owner,null,'classroom.class.sync',classId,{created:matches.length!==1});
  }
 }
 candidate(context=this.context(),{includePaused=false}={}){
  const cfg=this.settings(),owner=this.owner();
  if(!cfg.enabled||!owner||context.active.length!==1)return null;
  const occurrence=context.active[0],link=this.db.prepare('SELECT * FROM learning_schedule_links WHERE schedule_id=?').get(occurrence.scheduleId);
  if(!link||!includePaused&&this.db.prepare('SELECT 1 FROM learning_schedule_pauses WHERE class_id=? AND day=?').get(link.class_id,context.day))return null;
  try{this.learning.membership(owner,link.class_id,true);}catch{return null;}
  return {...occurrence,classId:link.class_id,ownerId:owner.id,day:context.day};
 }
 automatic(session){return session?this.db.prepare('SELECT * FROM learning_schedule_sessions WHERE session_id=?').get(session.id)||null:null;}
 valid(session){
  const auto=this.automatic(session);if(!auto)return true;
  try{const active=this.candidate();return !!(active&&active.classId===session.class_id&&active.ownerId===session.teacher_id&&active.scheduleId===auto.schedule_id&&active.key===auto.occurrence_key&&session.expires_at===active.endAt);}catch{return false;}
 }
 reconcile(){
  if(!this.writable())return {deferred:true};
  const context=this.context(),owner=this.owner(),now=this.clock();
  this.store.tx(()=>{
   if(owner)this.sync(context,owner);
   if(context.day)this.db.prepare('DELETE FROM learning_schedule_pauses WHERE day<?').run(context.day);
   const desired=this.candidate(context),sessions=this.db.prepare('SELECT s.*,a.schedule_id,a.occurrence_key FROM learning_live_sessions s JOIN learning_schedule_sessions a ON a.session_id=s.id WHERE s.ended_at IS NULL').all();
   let current=null;
   for(const session of sessions){
    if(desired&&session.class_id===desired.classId&&session.teacher_id===desired.ownerId&&session.schedule_id===desired.scheduleId&&session.occurrence_key===desired.key&&session.expires_at===desired.endAt&&session.expires_at>now){current=session;continue;}
    this.db.prepare('UPDATE learning_live_sessions SET ended_at=? WHERE id=?').run(now,session.id);
   }
   if(desired&&!current){
    const id=crypto.randomUUID();
    this.db.prepare('UPDATE learning_live_sessions SET ended_at=? WHERE ended_at IS NULL').run(now);
    this.db.prepare('INSERT INTO learning_live_sessions VALUES(?,?,?,?,?,NULL)').run(id,desired.classId,desired.ownerId,now,desired.endAt);
    this.db.prepare('INSERT INTO learning_schedule_sessions VALUES(?,?,?)').run(id,desired.scheduleId,desired.key);
    this.learning.event(owner,null,'classroom.automatic.start',id,{classId:desired.classId,endsAt:desired.endAt});
   }
  });
  return {deferred:false};
 }
 classStatus(classId){
  const cfg=this.settings();let context;try{context=this.context();}catch{context={classes:[],active:[],day:'',reason:'RoomGoblin timetable is unavailable.'};}
  const links=this.links().filter(l=>l.class_id===classId),automatic=cfg.enabled&&links.length>0;
  const paused=!!(context.day&&this.db.prepare('SELECT 1 FROM learning_schedule_pauses WHERE class_id=? AND day=?').get(classId,context.day));
  return {automatic,paused,day:context.day,sources:links.map(l=>({id:l.schedule_id,title:context.classes.find(c=>c.id===l.schedule_id)?.title||l.last_title,available:context.classes.some(c=>c.id===l.schedule_id&&c.enabled!==false)})),reason:context.active.length>1?'Overlapping classes: effects are waiting for an unambiguous timetable.':context.reason};
 }
 pause(user,classId){
  this.learning.membership(user,classId,true);const status=this.classStatus(classId);
  if(!status.automatic)return false;
  if(!status.day)fail(409,'RoomGoblin timetable is unavailable.');
  this.db.prepare('INSERT OR IGNORE INTO learning_schedule_pauses VALUES(?,?)').run(classId,status.day);
  this.learning.event(user,null,'classroom.automatic.pause',classId,{day:status.day});return true;
 }
 resume(user,classId){
  this.learning.membership(user,classId,true);const status=this.classStatus(classId);
  if(!status.automatic||!status.day)fail(409,'Automatic mode is not configured for this class.');
  this.db.prepare('DELETE FROM learning_schedule_pauses WHERE class_id=? AND day=?').run(classId,status.day);
  this.learning.event(user,null,'classroom.automatic.resume',classId,{day:status.day});
  this.reconcile();return this.platform.session(user,classId);
 }
 status(user){
  const context=this.context(),cfg=this.settings(),owned=new Set(this.learning.classes(user).filter(c=>c.role==='teacher').map(c=>c.id));
  return {enabled:cfg.enabled,available:!!context.day,day:context.day,reason:context.reason,
   classes:context.classes.map(c=>({id:c.id,title:c.title,enabled:c.enabled!==false})),
   links:this.links().filter(l=>owned.has(l.class_id)).map(l=>({scheduleId:l.schedule_id,classId:l.class_id})),
   activeClassId:this.candidate(context)?.classId||null};
 }
 visibleActiveClass(user){
  try{const active=this.candidate(this.context(),{includePaused:true});if(!active)return null;this.learning.membership(user,active.classId,true);return active.classId;}catch{return null;}
 }
}
module.exports={LearningSchedule,KEY};
