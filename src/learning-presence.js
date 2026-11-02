"use strict";
// A local-only, one-use challenge attests network reachability, never identity.
// No password/session token is sent to the LAN presence window.
const crypto=require('node:crypto');
const {classroomRequest}=require('./learning-platform');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const networkKey=platform=>crypto.createHash('sha256').update(JSON.stringify(platform.settings().classroomNetworks)).digest('hex');
class LearningPresence{
 constructor(platform){this.platform=platform;this.db=platform.db;this.clock=platform.clock;
  this.db.exec('CREATE TABLE IF NOT EXISTS learning_presence_challenges(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_id TEXT NOT NULL,activity_id TEXT NOT NULL,event_id TEXT NOT NULL,created_at INTEGER NOT NULL,attested_at INTEGER,consumed_at INTEGER)');
  if(!this.db.prepare('PRAGMA table_info(learning_presence_challenges)').all().some(row=>row.name==='network_key'))this.db.exec('ALTER TABLE learning_presence_challenges ADD COLUMN network_key TEXT');
  if(!this.db.prepare('PRAGMA table_info(learning_presence_challenges)').all().some(row=>row.name==='classroom_session_id'))this.db.exec('ALTER TABLE learning_presence_challenges ADD COLUMN classroom_session_id TEXT');
  // Permission never survives an appliance restart.
  this.db.prepare('DELETE FROM learning_presence_challenges').run();
 }
 challenge(user,activityId,eventId){
  const a=this.platform.learning.activity(user,activityId);this.platform.learning.writable(a);
  if(a.member.role!=='student'||!user.sessionId||!uuid(eventId))fail(400,'A signed-in learner and event ID are required.');
  this.platform.schedule?.reconcile();
  const session=this.platform.currentSession(a.class_id);if(!this.platform.eligible(user,a,session))return {available:false};
  const now=this.clock();this.db.prepare('DELETE FROM learning_presence_challenges WHERE created_at<?').run(now-30000);
  if(this.db.prepare('SELECT COUNT(*) n FROM learning_presence_challenges WHERE user_id=?').get(user.id).n>=10)fail(429,'Presence request limit reached.');
  const id=crypto.randomUUID();this.db.prepare('INSERT INTO learning_presence_challenges VALUES(?,?,?,?,?,?,NULL,NULL,?,?)').run(id,user.id,user.sessionId,activityId,eventId,now,networkKey(this.platform),session.id);return {available:true,id,expiresInMs:8000};
 }
 attest(id,req){
  // Forwarded/cloud requests are never evidence of a private classroom subnet.
  if(['forwarded','x-forwarded-for','x-forwarded-proto','cf-connecting-ip'].some(k=>req.headers[k]!==undefined)||!classroomRequest(req,this.platform.settings()))fail(403,'Classroom network required.');
  if(!uuid(id))fail(400,'Invalid presence request.');
  const changed=this.db.prepare('UPDATE learning_presence_challenges SET attested_at=? WHERE id=? AND attested_at IS NULL AND consumed_at IS NULL AND created_at>=? AND network_key=?').run(this.clock(),id,this.clock()-8000,networkKey(this.platform)).changes;
  if(!changed)fail(409,'Presence request expired or was already used.');return {attested:true};
 }
 consume(user,activityId,eventId,id){
  if(!uuid(id)||!user.sessionId)return false;
  const activity=this.platform.learning.activity(user,activityId),session=this.platform.currentSession(activity.class_id);if(!session)return false;
  return this.db.prepare('UPDATE learning_presence_challenges SET consumed_at=? WHERE id=? AND user_id=? AND session_id=? AND activity_id=? AND event_id=? AND attested_at>=? AND created_at>=? AND consumed_at IS NULL AND network_key=? AND classroom_session_id=?').run(this.clock(),id,user.id,user.sessionId,activityId,eventId,this.clock()-5000,this.clock()-8000,networkKey(this.platform),session.id).changes===1;
 }
}
module.exports={LearningPresence};
