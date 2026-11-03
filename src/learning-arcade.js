"use strict";
// Persistent, teacher-owned arcade campaigns. Grades never enter the TV projection.
const crypto=require('node:crypto');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const int=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const parse=(v,fallback={})=>{try{return JSON.parse(v)??fallback}catch{return fallback}};
const text=(v,max=100)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(v))fail(400,'Use a short plain-text campaign name.');return v.trim();};
function normalizeArcade(input){
 if(!int(input.revision,2147483646)||!int(input.arcadeScore,999999999)||!int(input.level,99)||input.level<1||!int(input.board,4)||input.board<1||!int(input.current,10000)||!int(input.total,10000)||input.total<1||input.current>input.total)fail(400,'Invalid arcade checkpoint.');
 if(typeof input.checkpoint!=='string'||Buffer.byteLength(input.checkpoint)>16000)fail(400,'Arcade checkpoint exceeds the limit.');
 const s=parse(input.checkpoint,null);
 if(!s||s.v!==1||s.engine!=='174d526f'||s.score!==input.arcadeScore||s.level!==input.level||s.board!==input.board||typeof s.ram!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(s.ram)||Buffer.from(s.ram,'base64').length!==5120)fail(400,'Arcade checkpoint and score disagree.');
 const ram=Buffer.from(s.ram,'base64'),bcd=b=>(b>>4)*10+(b&15),score=bcd(ram[0xb2])+100*bcd(ram[0xb3])+10000*bcd(ram[0xb4]);
 if(ram[5]!==3||ram[10]!==12||ram[0x227]!==s.board||ram[0x229]!==s.level||score!==s.score)fail(400,'Arcade checkpoint does not match its game memory.');
 return {revision:input.revision,arcadeScore:input.arcadeScore,level:input.level,board:input.board,current:input.current,total:input.total,checkpoint:input.checkpoint};
}
class LearningArcade{
 constructor(platform){
  this.p=platform;this.db=platform.db;this.store=platform.store;this.learning=platform.learning;this.clock=platform.clock;this.busy=false;this.lastDispatch=new Map();
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS learning_arcade_campaigns(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,title TEXT NOT NULL,enabled INTEGER NOT NULL,targets_json TEXT NOT NULL,created_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS learning_arcade_classes(campaign_id TEXT NOT NULL,class_id TEXT NOT NULL,label TEXT NOT NULL,PRIMARY KEY(campaign_id,class_id));
   CREATE TABLE IF NOT EXISTS learning_arcade_bindings(activity_id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS learning_arcade_players(campaign_id TEXT NOT NULL,user_id TEXT NOT NULL,revision INTEGER NOT NULL,data_json TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(campaign_id,user_id));
   CREATE TABLE IF NOT EXISTS learning_arcade_public(campaign_id TEXT NOT NULL,user_id TEXT NOT NULL,class_id TEXT NOT NULL,data_json TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(campaign_id,user_id));
  `);
 }
 owned(user,id){const c=this.db.prepare('SELECT * FROM learning_arcade_campaigns WHERE id=? AND owner_id=?').get(id,user.id);if(!c||!this.authorized(user,c.id))fail(404,'Campaign not found.');return c;}
 authorized(user,id){return this.classes(id).every(c=>{try{this.learning.membership(user,c.classId,true);return true;}catch{return false;}});}
 classes(id){return this.db.prepare('SELECT class_id classId,label FROM learning_arcade_classes WHERE campaign_id=? ORDER BY label').all(id);}
 list(user){return this.db.prepare('SELECT * FROM learning_arcade_campaigns WHERE owner_id=? ORDER BY created_at').all(user.id).filter(c=>this.authorized(user,c.id)).map(c=>({id:c.id,title:c.title,enabled:!!c.enabled,targets:parse(c.targets_json,[]),classes:this.classes(c.id),board:this.board(c.id)}));}
 configure(user,input){
  const id=input.id||crypto.randomUUID();if(!uuid(id))fail(400,'Invalid campaign ID.');
  const old=this.db.prepare('SELECT * FROM learning_arcade_campaigns WHERE id=?').get(id);if(old)this.owned(user,id);
  const title=text(input.title),classes=input.classes,targets=input.targets;
  if(!Array.isArray(classes)||!classes.length||classes.length>16||classes.some(c=>!c||typeof c!=='object')||new Set(classes.map(c=>c.classId)).size!==classes.length)fail(400,'Select one to sixteen distinct classes.');
  for(const c of classes){if(!uuid(c.classId))fail(400,'Invalid class.');this.learning.membership(user,c.classId,true);text(c.label,30);}
  const options=this.p.options();if(!Array.isArray(targets)||targets.length>4||targets.some(id=>!options.displays.some(d=>d.id===id)))fail(400,'Select configured display receivers.');
  if(input.enabled===true&&!targets.length)fail(400,'Choose a display before enabling the board.');
  if(input.enabled===true&&this.db.prepare('SELECT id,targets_json FROM learning_arcade_campaigns WHERE enabled=1 AND id<>?').all(id).some(c=>parse(c.targets_json,[]).some(t=>targets.includes(t))))fail(409,'A selected display already has an enabled campaign. Disable that board first.');
  // Never strand an assignment or silently move already saved player history.
  const used=this.db.prepare('SELECT DISTINCT a.class_id FROM learning_arcade_bindings b JOIN learning_activities a ON a.id=b.activity_id WHERE b.campaign_id=?').all(id);
  if(used.some(a=>!classes.some(c=>c.classId===a.class_id)))fail(409,'A class with linked assignments cannot be removed from this campaign.');
  this.store.tx(()=>{this.db.prepare('INSERT INTO learning_arcade_campaigns VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,enabled=excluded.enabled,targets_json=excluded.targets_json').run(id,user.id,title,input.enabled===true?1:0,JSON.stringify([...new Set(targets)]),this.clock());this.db.prepare('DELETE FROM learning_arcade_classes WHERE campaign_id=?').run(id);for(const c of classes)this.db.prepare('INSERT INTO learning_arcade_classes VALUES(?,?,?)').run(id,c.classId,text(c.label,30));});
  this.learning.event(user,null,'arcade.configure',id);return this.list(user).find(c=>c.id===id);
 }
 bind(user,activityId,campaignId){
  const a=this.learning.activity(user,activityId,true);if(a.template_id!=='scorm-connector-v1')fail(400,'Choose a SCORM activity.');this.owned(user,campaignId);
  if(!this.classes(campaignId).some(c=>c.classId===a.class_id))fail(400,'This class is outside the campaign.');
  const old=this.db.prepare('SELECT campaign_id FROM learning_arcade_bindings WHERE activity_id=?').get(activityId);if(old&&old.campaign_id!==campaignId)fail(409,'An activity already belongs to another campaign.');
  this.db.prepare('INSERT OR IGNORE INTO learning_arcade_bindings VALUES(?,?)').run(activityId,campaignId);this.learning.event(user,activityId,'arcade.bind',campaignId);
 }
 state(user,activityId){
  const binding=this.db.prepare('SELECT c.* FROM learning_arcade_bindings b JOIN learning_arcade_campaigns c ON c.id=b.campaign_id WHERE b.activity_id=?').get(activityId);if(!binding)return null;
  const a=this.learning.activity(user,activityId);if(!this.classes(binding.id).some(c=>c.classId===a.class_id))return null;
  const owner=this.store.listUsers().find(u=>u.id===binding.owner_id&&u.enabled);if(!owner||this.learning.teacherCapability&&!this.learning.teacherCapability(owner))return null;
  try{this.learning.membership(owner,a.class_id,true);}catch{return null;}
  const row=this.db.prepare('SELECT * FROM learning_arcade_players WHERE campaign_id=? AND user_id=?').get(binding.id,user.id);
  return {campaignId:binding.id,title:binding.title,revision:row?.revision||0,...parse(row?.data_json)};
 }
 save(user,a,data,classroom){
  const prior=this.state(user,a.id);if(!prior)fail(409,'This assignment needs a campaign connection.');
  if(prior.revision!==data.revision)fail(409,'Campaign changed in another assignment. Reconnect to load its latest checkpoint.');
  const {revision,...saved}=data;
  this.db.prepare('INSERT INTO learning_arcade_players VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,user_id) DO UPDATE SET revision=excluded.revision,data_json=excluded.data_json,updated_at=excluded.updated_at').run(prior.campaignId,user.id,revision+1,JSON.stringify(saved),this.clock());
  if(classroom){
   // Off-campus updates stay private until this learner next confirms classroom presence.
   const progress=this.db.prepare('SELECT a.id,p.data_json FROM learning_arcade_bindings b JOIN learning_activities a ON a.id=b.activity_id LEFT JOIN learning_progress p ON p.activity_id=a.id AND p.user_id=? WHERE b.campaign_id=? AND a.class_id=?').all(user.id,prior.campaignId,a.class_id);
   let answered=0,total=0,completed=0;for(const row of progress){const d=row.id===a.id?saved:parse(row.data_json);answered+=Number.isInteger(d.current)?d.current:0;total+=Number.isInteger(d.total)?d.total:0;if(d.completed||d.current===d.total&&d.total>0)completed++;}
   const visible={arcadeScore:saved.arcadeScore,level:saved.level,board:saved.board,answered,total,completed,assignments:progress.length};
   this.db.prepare('INSERT INTO learning_arcade_public VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,user_id) DO UPDATE SET class_id=excluded.class_id,data_json=excluded.data_json,updated_at=excluded.updated_at').run(prior.campaignId,user.id,a.class_id,JSON.stringify(visible),this.clock());
  }
 }
 board(id){
  const c=this.db.prepare('SELECT owner_id FROM learning_arcade_campaigns WHERE id=?').get(id),owner=this.store.listUsers().find(u=>u.id===c?.owner_id&&u.enabled);
  if(!owner||!this.authorized(owner,id)||this.learning.teacherCapability&&!this.learning.teacherCapability(owner))return [];
  const rows=this.db.prepare(`SELECT p.data_json,n.first_name,c.label FROM learning_arcade_public p JOIN learning_arcade_classes c ON c.campaign_id=p.campaign_id AND c.class_id=p.class_id JOIN learning_members m ON m.class_id=p.class_id AND m.user_id=p.user_id JOIN users u ON u.id=p.user_id LEFT JOIN learning_first_names n ON n.class_id=p.class_id AND n.user_id=p.user_id WHERE p.campaign_id=? AND m.role='student' AND u.enabled=1`).all(id);
  return rows.map(r=>{const d=parse(r.data_json);return {firstName:r.first_name||'Student',period:r.label,arcadeScore:d.arcadeScore||0,level:d.level||1,board:d.board||1,answered:d.answered||0,total:d.total||0,completed:d.completed||0,assignments:d.assignments||0};}).sort((a,b)=>b.arcadeScore-a.arcadeScore||b.level-a.level||a.firstName.localeCompare(b.firstName)).slice(0,100);
 }
 async tick(){
  if(this.busy||!this.p.available())return;this.busy=true;
  try{for(const c of this.db.prepare('SELECT * FROM learning_arcade_campaigns WHERE enabled=1 ORDER BY created_at').all()){
   const owner=this.store.listUsers().find(u=>u.id===c.owner_id&&u.enabled);if(!owner||this.learning.teacherCapability&&!this.learning.teacherCapability(owner))continue;
   const active=()=>{const current=this.db.prepare('SELECT enabled FROM learning_arcade_campaigns WHERE id=?').get(c.id),actor=this.store.listUsers().find(u=>u.id===c.owner_id&&u.enabled);return current?.enabled===1&&actor&&(!this.learning.teacherCapability||this.learning.teacherCapability(actor))&&this.p.available()&&this.classes(c.id).some(row=>{try{this.learning.membership(actor,row.classId,true);const s=this.p.currentSession(row.classId);return s&&s.teacher_id===actor.id;}catch{return false;}});};
   if(!active())continue;const targets=parse(c.targets_json,[]);if(!targets.length||targets.some(id=>!this.p.options().displays.some(d=>d.id===id)))continue;
   const rows=this.board(c.id),page=Math.floor(this.clock()/15000)%Math.max(1,Math.ceil(rows.length/8));
   const board=rows.slice(page*8,page*8+8);const result=await this.p.dispatch({kind:'arcade-board',targets},{title:c.title,board,offset:page*8,count:rows.length,admitted:active});
   this.lastDispatch.set(c.id,{at:this.clock(),status:result?.ok===true?'sent':'unconfirmed'});
  }}finally{this.busy=false;}
 }
}
module.exports={LearningArcade,normalizeArcade};
