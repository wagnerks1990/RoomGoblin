"use strict";
const crypto=require('node:crypto');
const COOKIE='roomgoblin_bridge_flow';
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
function flowCookie(req){const value=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return uuid(value)?value:null;}
class LearningConnection{
 constructor(platform){this.platform=platform;this.db=platform.db;this.clock=platform.clock;this.db.exec('CREATE TABLE IF NOT EXISTS learning_bridge_flows(id TEXT PRIMARY KEY,class_id TEXT NOT NULL,activity_id TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,session_id TEXT)');}
 start(activityId,parent){
  const p=this.platform,a=this.db.prepare('SELECT * FROM learning_activities WHERE id=?').get(activityId),cfg=p.config(activityId);
  if(!a?.open||!cfg?.launch_url||!p.store.getPreference('learning.bridgeOrigins',[]).includes(parent))fail(409,'The signed Schoology connector needs teacher setup.');
  this.db.prepare('DELETE FROM learning_bridge_flows WHERE expires_at<?').run(this.clock());
  if(this.db.prepare('SELECT COUNT(*) n FROM learning_bridge_flows').get().n>=20000)fail(429,'Connection capacity reached. Try again later.');
  const id=crypto.randomUUID();this.db.prepare('INSERT INTO learning_bridge_flows VALUES(?,?,?,?,?,NULL)').run(id,a.class_id,a.id,this.clock(),this.clock()+600000);return {id,launchUrl:cfg.launch_url};
 }
 signed(user,launchActivity,sessionId,id){
  if(!uuid(id))return false;const activity=this.platform.learning.activity(user,launchActivity);
  return this.db.prepare('UPDATE learning_bridge_flows SET session_id=?,expires_at=? WHERE id=? AND class_id=? AND expires_at>? AND session_id IS NULL').run(sessionId,this.clock()+28800000,id,activity.class_id,this.clock()).changes===1;
 }
 authorize(user,activityId,id){
  if(!uuid(id)||!user.learningSso||!user.sessionId)fail(401,'Open this connection through Schoology.');
  if(!this.db.prepare('SELECT 1 FROM learning_bridge_flows WHERE id=? AND activity_id=? AND session_id=? AND expires_at>?').get(id,activityId,user.sessionId,this.clock()))fail(401,'This connection needs a fresh signed Schoology launch.');
 }
}
module.exports={LearningConnection,COOKIE,flowCookie};
