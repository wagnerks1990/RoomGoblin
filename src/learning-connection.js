"use strict";
const crypto=require('node:crypto');
const COOKIE='roomgoblin_bridge_flow';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function flowCookie(req){const value=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return uuid(value)?value:null;}
class LearningConnection{
 constructor(platform){this.platform=platform;this.db=platform.db;this.clock=platform.clock;this.db.exec('CREATE TABLE IF NOT EXISTS learning_bridge_flows(id TEXT PRIMARY KEY,class_id TEXT NOT NULL,activity_id TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,session_id TEXT); CREATE TABLE IF NOT EXISTS learning_bridge_embedded(flow_id TEXT PRIMARY KEY); CREATE TABLE IF NOT EXISTS learning_bridge_candidates(flow_id TEXT PRIMARY KEY,session_id TEXT NOT NULL)');}
 embedded(id){return uuid(id)&&!!this.db.prepare('SELECT 1 FROM learning_bridge_embedded WHERE flow_id=?').get(id);}
 start(activityId,parent,embedded=false,existingUser=null){
  const p=this.platform,a=this.db.prepare('SELECT * FROM learning_activities WHERE id=?').get(activityId),cfg=p.config(activityId);
  if(!a?.open||!cfg?.launch_url||!p.store.getPreference('learning.bridgeOrigins',[]).includes(parent))fail(409,'The signed Schoology connector needs teacher setup.');
  if(embedded&&!p.settings().embeddedEnabled)fail(409,'The teacher has not enabled embedded Schoology connections.');
  this.db.prepare('DELETE FROM learning_bridge_flows WHERE expires_at<?').run(this.clock());
  if(this.db.prepare('SELECT COUNT(*) n FROM learning_bridge_flows').get().n>=20000)fail(429,'Connection capacity reached. Try again later.');
  this.db.prepare('DELETE FROM learning_bridge_embedded WHERE flow_id NOT IN (SELECT id FROM learning_bridge_flows)').run();
  this.db.prepare('DELETE FROM learning_bridge_candidates WHERE flow_id NOT IN (SELECT id FROM learning_bridge_flows)').run();
  const id=crypto.randomUUID();this.db.prepare('INSERT INTO learning_bridge_flows VALUES(?,?,?,?,?,NULL)').run(id,a.class_id,a.id,this.clock(),this.clock()+600000);if(embedded)this.db.prepare('INSERT INTO learning_bridge_embedded VALUES(?)').run(id);
  // The same-origin start can see the Lax cookie; a cross-site LTI POST cannot.
  // Retain only its server session ID as a candidate, never an authenticated flow
  // or bearer token. A fresh signed launch must still verify the same learner.
  if(existingUser?.learningSso&&existingUser.profileId==='learning-student'&&existingUser.role==='viewer'&&existingUser.sessionId)this.db.prepare('INSERT INTO learning_bridge_candidates VALUES(?,?)').run(id,existingUser.sessionId);
  return {id,launchUrl:cfg.launch_url};
 }
 candidate(id,launchActivity){if(!uuid(id))return null;return this.db.prepare('SELECT c.session_id FROM learning_bridge_candidates c JOIN learning_bridge_flows f ON f.id=c.flow_id JOIN learning_activities a ON a.class_id=f.class_id WHERE f.id=? AND a.id=? AND f.session_id IS NULL AND f.expires_at>?').get(id,launchActivity,this.clock())?.session_id||null;}
 signed(user,launchActivity,sessionId,id){
  if(!uuid(id))return false;const activity=this.platform.learning.activity(user,launchActivity);
  const signed=this.db.prepare('UPDATE learning_bridge_flows SET session_id=?,expires_at=? WHERE id=? AND class_id=? AND expires_at>? AND session_id IS NULL').run(sessionId,this.clock()+28800000,id,activity.class_id,this.clock()).changes===1;
  if(signed)this.db.prepare('DELETE FROM learning_bridge_candidates WHERE flow_id=?').run(id);return signed;
 }
 authorize(user,activityId,id){
  if(!uuid(id)||!user.learningSso||!user.sessionId)fail(401,'Open this connection through Schoology.');
  if(!this.db.prepare('SELECT 1 FROM learning_bridge_flows WHERE id=? AND activity_id=? AND session_id=? AND expires_at>?').get(id,activityId,user.sessionId,this.clock()))fail(401,'This connection needs a fresh signed Schoology launch.');
 }
}
module.exports={LearningConnection,COOKIE,flowCookie};
