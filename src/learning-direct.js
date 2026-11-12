"use strict";
const crypto=require('node:crypto');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const directPath=new RegExp(`^/api/v1/learning/direct/(?:activities/(${uuid})(?:/(posts(?:/${uuid}(?:/history)?)?|submit|receipt|enroll))?|platform/activities/(${uuid})/(state|events|presence))$`);
function route(method,path){
 const m=directPath.exec(path);if(!m)return null;
 const id=m[1]||m[3],part=m[2]||m[4]||'activity';
 const allowed=part==='enroll'?['POST']:(['activity','state','receipt'].includes(part)||part.endsWith('/history'))?['GET']:part==='posts'?['POST']:part.startsWith('posts/')?['PUT']:['POST'];
 return allowed.includes(method)?{id,part}:null;
}
class LearningDirect{
 constructor(learning){
  this.learning=learning;this.store=learning.store;this.db=learning.db;
  this.db.exec(`CREATE TABLE IF NOT EXISTS learning_direct_participants(user_id TEXT PRIMARY KEY REFERENCES users(id),activity_id TEXT NOT NULL REFERENCES learning_activities(id),token_hash TEXT UNIQUE NOT NULL,reported_id_hash TEXT NOT NULL,reported_name TEXT NOT NULL,created_at TEXT NOT NULL,revoked INTEGER NOT NULL DEFAULT 0); CREATE INDEX IF NOT EXISTS learning_direct_activity ON learning_direct_participants(activity_id);`);
 }
 key(id){return 'learning.direct.'+id;}
 settings(id){return this.store.getPreference(this.key(id),{});}
 available(id){const cfg=this.settings(id);if(!cfg.enabled)return false;const owner=this.store.listUsers().find(u=>u.id===cfg.ownerId&&u.enabled);if(!owner||!this.learning.teacherCapability?.(owner))return false;try{this.learning.activity(owner,id,true);return true;}catch{return false;}}
 issue(user,id){
  this.learning.activity(user,id,true);
  return this.store.tx(()=>{let key=this.store.getSecret(this.key(id));if(!key){key=crypto.randomBytes(32).toString('hex');this.store.putSecret(this.key(id),key,{purpose:'assignment-enrollment-only'});}this.store.setPreference(this.key(id),{enabled:true,ownerId:user.id});this.learning.event(user,id,'direct.package',id);return key;});
 }
 enroll(id,key,input){
  const a=this.db.prepare('SELECT * FROM learning_activities WHERE id=?').get(id),saved=this.store.getSecret(this.key(id));
  if(!this.store.authEnabled()||!a||!this.available(id)||typeof key!=='string'||!saved||!crypto.timingSafeEqual(Buffer.from(hash(key)),Buffer.from(hash(saved))))fail(401,'Assignment connection is unavailable.');
  if(!a.open||this.learning.portal.command(id).paused)fail(409,'The teacher has closed or paused this assignment.');
  if(!input||typeof input!=='object'||!/^[a-f0-9]{64}$/.test(input.participantToken||'')||typeof input.reportedId!=='string'||!input.reportedId.trim()||input.reportedId.length>255||typeof input.name!=='string'||!input.name.trim()||input.name.length>255||/[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(input.name))fail(400,'Use an assignment participant token and a reported SCORM learner identity.');
  const tokenHash=hash(input.participantToken),reportedHash=hash(input.reportedId),prior=this.db.prepare('SELECT * FROM learning_direct_participants WHERE token_hash=?').get(tokenHash);
  if(prior){if(prior.activity_id!==id||prior.reported_id_hash!==reportedHash)fail(409,'The saved participant belongs to another assignment or learner.');return this.authorize(id,input.participantToken);}
  if(this.db.prepare('SELECT COUNT(*) n FROM learning_direct_participants WHERE activity_id=?').get(id).n>=5000)fail(429,'Assignment registration capacity reached.');
  const name=input.name.trim().replace(/\s+/gu,' ');
  return this.store.tx(()=>{
   const user=this.store.putUser({username:'direct-'+crypto.randomUUID(),displayName:name,role:'viewer',profileId:'learning-student'},{password:crypto.randomBytes(48).toString('base64url')});
   this.db.prepare('INSERT INTO learning_members(class_id,user_id,role,alias) VALUES(?,?,?,?)').run(a.class_id,user.id,'student',name);
   this.db.prepare('INSERT INTO learning_direct_participants(user_id,activity_id,token_hash,reported_id_hash,reported_name,created_at) VALUES(?,?,?,?,?,?)').run(user.id,id,tokenHash,reportedHash,name,new Date().toISOString());
   this.learning.event(user,id,'direct.register',user.id,{identitySource:'SCORM-reported'});return {...user,directParticipant:true,sessionId:'direct:'+tokenHash};
  });
 }
 authorize(id,token){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail(401,'The assignment participant connection is missing.');
  const row=this.db.prepare('SELECT p.*,u.username,u.display_name,u.role,u.profile_id,u.enabled FROM learning_direct_participants p JOIN users u ON u.id=p.user_id WHERE p.token_hash=? AND p.activity_id=?').get(hash(token),id);
  if(!this.store.authEnabled()||!row||row.revoked||!row.enabled||row.role!=='viewer'||row.profile_id!=='learning-student'||!this.available(id))fail(401,'The assignment participant connection is unavailable.');
  const user={id:row.user_id,username:row.username,displayName:row.display_name,role:'viewer',profileId:'learning-student',enabled:true,directParticipant:true,sessionId:'direct:'+row.token_hash};
  this.learning.activity(user,id);return user;
 }
 isParticipant(userId){return !!this.db.prepare('SELECT 1 FROM learning_direct_participants WHERE user_id=?').get(userId);}
}
function cors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-RoomGoblin-Learning');res.setHeader('Access-Control-Max-Age','600');res.setHeader('Cache-Control','no-store');res.setHeader('Cross-Origin-Resource-Policy','cross-origin');}
const presencePath='/learn/direct-presence/attest';
module.exports={LearningDirect,route,cors,presencePath};
