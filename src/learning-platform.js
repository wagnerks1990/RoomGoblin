"use strict";
const crypto=require('node:crypto'),net=require('node:net');
const {LearningArcade,normalizeArcade}=require('./learning-arcade');
const {SETTINGS}=require('./learning-public');
const {LearningGradePolicy}=require('./learning-grade-policy');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
const plain=v=>v&&typeof v==='object'&&!Array.isArray(v);
const objectJson=v=>{try{const parsed=JSON.parse(v);return plain(parsed)?parsed:{};}catch{return {};}};
const digest=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function label(v,max=80){if(typeof v!=='string'||!v.trim()||v.length>max||/[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(v))fail(400,'Use plain text within the displayed limit.');return v.trim();}
function cidr(raw){
 if(typeof raw!=='string'||raw.length>80)fail(400,'Use exact classroom IP addresses or narrow CIDR networks.');
 const [address,bits,...rest]=raw.split('/'),version=net.isIP(address),prefix=bits===undefined?(version===4?32:128):Number(bits);
 if(rest.length||!version||bits!==undefined&&!/^\d+$/.test(bits)||!Number.isInteger(prefix)||prefix<(version===4?24:64)||prefix>(version===4?32:128))fail(400,'Use IPv4 /24–/32 or IPv6 /64–/128 classroom networks.');
 if(address==='127.0.0.1'||address==='::1'||address==='0.0.0.0'||address==='::')fail(400,'Loopback cannot establish classroom presence.');
 const list=new net.BlockList();try{list.addSubnet(address,prefix,version===4?'ipv4':'ipv6');}catch{fail(400,'Invalid classroom network.');}
 return {address,prefix,version,value:address+'/'+prefix,list};
}
function classroomRequest(req,settings){
 if(settings.networksConfirmed!==true||!Array.isArray(settings.classroomNetworks)||!settings.classroomNetworks.length)return false;
 let address=String(req.socket?.remoteAddress||'').replace(/^::ffff:/,'');
 const forwarded=['forwarded','x-forwarded-for','x-forwarded-proto','cf-connecting-ip'].some(k=>req.headers?.[k]!==undefined);
 if(forwarded){
  if(!['127.0.0.1','::1'].includes(address)||req.headers['x-forwarded-proto']!=='https')return false;
  const client=req.headers['cf-connecting-ip'];
  // Only the same-host Cloudflare connector can supply this assertion. The edge
  // overwrites CF-Connecting-IP; arbitrary LAN forwarding headers are rejected.
  if(typeof client!=='string'||!net.isIP(client)||typeof req.headers['cf-ray']!=='string'||!req.headers['cf-ray'].match(/^[a-f0-9]{16,32}-[A-Z]{3}$/i))return false;
  const chain=String(req.headers['x-forwarded-for']||'').split(',').map(v=>v.trim());
  if(chain.at(-1)!==client)return false;
  address=client;
 }
 if(!net.isIP(address)||['127.0.0.1','::1'].includes(address))return false;
 try{return settings.classroomNetworks.some(raw=>cidr(raw).list.check(address,net.isIP(address)===4?'ipv4':'ipv6'));}catch{return false;}
}
function normalizeSettings(input={}){
 let publicOrigin='';if(input.publicOrigin){try{const u=new URL(input.publicOrigin);if(u.protocol!=='https:'||u.origin!==input.publicOrigin||u.username||u.password||net.isIP(u.hostname))throw Error();publicOrigin=u.origin;}catch{fail(400,'Use an exact student HTTPS origin.');}}
 if(input.publicEnabled===true&&!publicOrigin)fail(400,'Set the student HTTPS origin first.');
 let presenceOrigin='';if(input.presenceOrigin){try{const u=new URL(input.presenceOrigin),parts=u.hostname.split('.').map(Number),privateAddress=net.isIP(u.hostname)===4&&(parts[0]===10||parts[0]===172&&parts[1]>=16&&parts[1]<=31||parts[0]===192&&parts[1]===168);if(!privateAddress||u.protocol!=='http:'||u.origin!==input.presenceOrigin||u.username||u.password)throw Error();presenceOrigin=u.origin;}catch{fail(400,'Use the RoomGoblin private IPv4 HTTP origin for presence only.');}}
 const networks=input.classroomNetworks||[];if(!Array.isArray(networks)||networks.length>16)fail(400,'Use up to sixteen classroom networks.');
 return {publicOrigin,presenceOrigin,embeddedEnabled:input.embeddedEnabled===true,publicEnabled:input.publicEnabled===true,classroomNetworks:[...new Set(networks.map(v=>cidr(v).value))],networksConfirmed:input.networksConfirmed===true,insightsEnabled:input.insightsEnabled===true};
}
function normalizeEvent(input,points){
 if(!plain(input)||!uuid(input.id)||!Number.isInteger(input.sequence)||input.sequence<1||input.sequence>2147483647)fail(400,'A unique event ID and increasing sequence are required.');
 if(!['progress','score','completed','checkpoint','arcade','assessment'].includes(input.kind))fail(400,'Unsupported assignment event.');
 const occurred=Date.parse(input.occurredAt);if(typeof input.occurredAt!=='string'||input.occurredAt.length>40||!Number.isFinite(occurred)||!/(Z|[+-]\d\d:\d\d)$/.test(input.occurredAt))fail(400,'An event timestamp with timezone is required.');
 const data={};
 if(input.kind==='arcade')Object.assign(data,normalizeArcade(input));
 if(input.kind==='progress'){if(!Number.isInteger(input.current)||!Number.isInteger(input.total)||input.total<1||input.total>10000||input.current<0||input.current>input.total)fail(400,'Invalid assignment progress.');data.current=input.current;data.total=input.total;}
 if(['score','completed'].includes(input.kind)){if(!finite(input.raw,0,100))fail(400,'SCORM scores must be percentages from 0 to 100.');data.raw=input.raw;data.earned=Math.round(input.raw*points)/100;data.possible=points;}
 if(input.kind==='checkpoint'){if(typeof input.state!=='string'||Buffer.byteLength(input.state)>4096)fail(400,'Resume data must be a string of at most 4096 bytes.');data.state=input.state;}
 if(input.kind==='assessment'){if(!finite(input.raw,0,100)||!Number.isInteger(input.current)||!Number.isInteger(input.total)||input.total<1||input.total>10000||input.current<0||input.current>input.total)fail(400,'Invalid assessment progress.');Object.assign(data,{raw:input.raw,current:input.current,total:input.total});}
 return {id:input.id,sequence:input.sequence,kind:input.kind,occurredAt:new Date(occurred).toISOString(),data};
}
class LearningPlatform{
 constructor(learning,{clock=Date.now,dispatch=async()=>{throw Error('Classroom adapter unavailable');},options=()=>({displays:[],lights:[],assets:[]}),available=()=>true,arcadeAvailable=available}={}){
  this.learning=learning;this.store=learning.store;this.db=learning.db;this.clock=clock;this.dispatch=dispatch;this.options=options;this.available=available;this.arcadeAvailable=arcadeAvailable;this.effectBusy=false;this.lastEffect=-Infinity;
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS learning_connectors(activity_id TEXT PRIMARY KEY REFERENCES learning_activities(id),points INTEGER NOT NULL,launch_url TEXT NOT NULL DEFAULT '');
   CREATE TABLE IF NOT EXISTS learning_first_names(class_id TEXT NOT NULL,user_id TEXT NOT NULL,first_name TEXT NOT NULL,PRIMARY KEY(class_id,user_id));
   CREATE TABLE IF NOT EXISTS learning_signals(id INTEGER PRIMARY KEY,activity_id TEXT NOT NULL,user_id TEXT NOT NULL,client_id TEXT NOT NULL,fingerprint TEXT NOT NULL,kind TEXT NOT NULL,sequence INTEGER NOT NULL,occurred_at TEXT NOT NULL,received_at INTEGER NOT NULL,data_json TEXT NOT NULL,classroom INTEGER NOT NULL,UNIQUE(activity_id,user_id,client_id));
   CREATE INDEX IF NOT EXISTS learning_signals_recent ON learning_signals(activity_id,received_at);
   CREATE TABLE IF NOT EXISTS learning_progress(activity_id TEXT NOT NULL,user_id TEXT NOT NULL,sequence INTEGER NOT NULL DEFAULT 0,data_json TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(activity_id,user_id));
   CREATE TABLE IF NOT EXISTS learning_live_sessions(id TEXT PRIMARY KEY,class_id TEXT NOT NULL,teacher_id TEXT NOT NULL,started_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,ended_at INTEGER);
   CREATE TABLE IF NOT EXISTS learning_live_attendance(session_id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(session_id,user_id));
   CREATE TABLE IF NOT EXISTS learning_live_scores(session_id TEXT NOT NULL,activity_id TEXT NOT NULL,user_id TEXT NOT NULL,data_json TEXT NOT NULL,PRIMARY KEY(session_id,activity_id,user_id));
   CREATE TABLE IF NOT EXISTS learning_effect_recipes(id TEXT PRIMARY KEY,class_id TEXT NOT NULL,label TEXT NOT NULL,event_kind TEXT NOT NULL,config_json TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS learning_effect_runs(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,signal_id INTEGER NOT NULL UNIQUE,recipe_id TEXT NOT NULL,status TEXT NOT NULL,created_at INTEGER NOT NULL,finished_at INTEGER);
  `);
  // Saved progress survives; permission to operate physical hardware does not.
  this.db.prepare('UPDATE learning_live_sessions SET ended_at=? WHERE ended_at IS NULL').run(this.clock());
  this.db.prepare("UPDATE learning_effect_runs SET status='interrupted',finished_at=? WHERE status='dispatching'").run(this.clock());
  this.arcade=new LearningArcade(this);
  this.grading=new LearningGradePolicy(this);
 }
 settings(){try{return normalizeSettings(this.store.getPreference(SETTINGS,{}));}catch{return normalizeSettings();}}
 saveSettings(user,input){const cfg=normalizeSettings({...input,embeddedEnabled:input?.embeddedEnabled??this.settings().embeddedEnabled});this.store.setPreference(SETTINGS,cfg);this.learning.event(user,null,'platform.settings',null);return cfg;}
 signedName(classId,userId,given){
  let first='Student';try{if(given)first=label(given,80);}catch{}
  this.db.prepare('INSERT INTO learning_first_names VALUES(?,?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET first_name=excluded.first_name').run(classId,userId,first);
 }
 configure(user,id,input){
  const a=this.learning.activity(user,id,true);if(a.template_id!=='scorm-connector-v1'&&!Object.hasOwn(require('./learning-grader').CASES,a.template_id))fail(400,'Create a supported assignment first.');
  if(a.template_id!=='scorm-connector-v1'&&input.points!==20)fail(400,'Written discussions use 20 possible points.');
  if(!Number.isInteger(input.points)||input.points<1||input.points>1000)fail(400,'Set 1–1000 possible points.');
  if(this.config(id)?.points!==input.points&&this.db.prepare('SELECT 1 FROM learning_signals WHERE activity_id=? LIMIT 1').get(id))fail(409,'Create a new connector to change possible points after progress has been saved.');
  let launch='';if(input.launchUrl){try{const u=new URL(input.launchUrl),lti=this.learning.lti.config(id),allowed=[lti.platformOrigin,...this.store.getPreference('learning.bridgeOrigins',[])];if(u.protocol!=='https:'||u.username||u.password||u.hash||!allowed.includes(u.origin)||input.launchUrl.length>1500)throw Error();launch=u.href;}catch{fail(400,'Use this activity’s Schoology External Tool URL.');}}
  this.db.prepare('INSERT INTO learning_connectors VALUES(?,?,?) ON CONFLICT(activity_id) DO UPDATE SET points=excluded.points,launch_url=excluded.launch_url').run(id,input.points,launch);
  this.learning.event(user,id,'connector.configure',id,{points:input.points});return this.config(id);
 }
 config(id){return this.db.prepare('SELECT * FROM learning_connectors WHERE activity_id=?').get(id)||null;}
 state(user,id){
  const a=this.learning.activity(user,id),cfg=this.config(id);if(!cfg)fail(404,'Assignment connector not configured.');
  const row=this.db.prepare('SELECT * FROM learning_progress WHERE activity_id=? AND user_id=?').get(id,user.id);
  const firstName=this.db.prepare('SELECT first_name FROM learning_first_names WHERE class_id=? AND user_id=?').get(a.class_id,user.id)?.first_name||'Student';
  const progress=row?objectJson(row.data_json):{};
  // Historical completed events retain the best result even when an older SCO
  // subsequently reports a lower replay. This stays private to the learner.
  const best=this.db.prepare("SELECT MAX(CAST(json_extract(data_json,'$.raw') AS REAL)) best FROM learning_signals WHERE activity_id=? AND user_id=? AND kind='completed'").get(id,user.id).best;
  if(best!==null)progress.bestRaw=best;
  return {activityId:id,title:a.title,learnerKey:user.id,firstName,points:cfg.points,sequence:row?.sequence||0,progress,grade:this.grading.state(user,id),open:!!a.open,source:'SCORM-reported',presenceOrigin:this.settings().presenceOrigin,classroomSession:!!this.currentSession(a.class_id),arcade:this.arcade?.state(user,id)||null};
 }
 currentSession(classId){const session=this.db.prepare('SELECT * FROM learning_live_sessions WHERE class_id=? AND ended_at IS NULL AND expires_at>? ORDER BY started_at DESC LIMIT 1').get(classId,this.clock())||null;return session&&this.schedule&&!this.schedule.valid(session)?null:session;}
 start(user,classId,minutes){
  this.learning.membership(user,classId,true);if(!Number.isInteger(minutes)||minutes<1||minutes>180)fail(400,'Choose a classroom session from 1 to 180 minutes.');
  if(this.schedule?.classStatus(classId).automatic)fail(409,'This class follows the RoomGoblin timetable automatically.');
  const id=crypto.randomUUID(),now=this.clock();this.store.tx(()=>{this.db.prepare('UPDATE learning_live_sessions SET ended_at=? WHERE ended_at IS NULL').run(now);this.db.prepare('INSERT INTO learning_live_sessions VALUES(?,?,?,?,?,NULL)').run(id,classId,user.id,now,now+minutes*60000);});this.learning.event(user,null,'classroom.start',id,{classId,minutes});return this.session(user,classId);
 }
 stop(user,classId){this.learning.membership(user,classId,true);this.store.tx(()=>{this.schedule?.pause(user,classId);this.db.prepare('UPDATE learning_live_sessions SET ended_at=? WHERE class_id=? AND ended_at IS NULL').run(this.clock(),classId);this.learning.event(user,null,'classroom.stop',classId);});return this.session(user,classId);}
 admit(user,classId,userIds){
  this.learning.membership(user,classId,true);const session=this.currentSession(classId);if(!session)fail(409,'Start a classroom session first.');
  if(this.schedule?.automatic(session))fail(409,'Students join automatically through signed Schoology launches and fresh classroom presence.');
  if(!Array.isArray(userIds)||userIds.length>500||userIds.some(id=>!uuid(id)))fail(400,'Select the students physically present.');
  for(const id of userIds){const m=this.db.prepare("SELECT 1 FROM learning_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? AND m.user_id=? AND m.role='student' AND u.enabled=1").get(classId,id);if(!m)fail(400,'Attendance includes an unavailable student.');}
  this.store.tx(()=>{this.db.prepare('DELETE FROM learning_live_attendance WHERE session_id=?').run(session.id);for(const id of new Set(userIds))this.db.prepare('INSERT INTO learning_live_attendance VALUES(?,?)').run(session.id,id);});this.learning.event(user,null,'classroom.attendance',session.id,{count:userIds.length});return this.session(user,classId);
 }
 session(user,classId){
  this.learning.membership(user,classId,true);const session=this.currentSession(classId);return {session,automation:this.schedule?.classStatus(classId)||{automatic:false},attending:session?this.db.prepare('SELECT user_id FROM learning_live_attendance WHERE session_id=?').all(session.id).map(r=>r.user_id):[],board:session?this.board(session.id):[],recipes:this.db.prepare('SELECT * FROM learning_effect_recipes WHERE class_id=? ORDER BY rowid LIMIT 20').all(classId).map(r=>({...r,config:objectJson(r.config_json),config_json:undefined})),recentEffects:session?this.db.prepare('SELECT status,created_at,finished_at FROM learning_effect_runs WHERE session_id=? ORDER BY rowid DESC LIMIT 20').all(session.id):[]};
 }
 board(sessionId){
  return this.db.prepare('SELECT p.user_id,p.data_json,n.first_name,activity.title activity_title FROM learning_live_scores p JOIN learning_activities activity ON activity.id=p.activity_id JOIN learning_live_sessions s ON s.id=p.session_id JOIN learning_live_attendance a ON a.session_id=s.id AND a.user_id=p.user_id JOIN learning_members m ON m.class_id=s.class_id AND m.user_id=p.user_id LEFT JOIN learning_first_names n ON n.class_id=s.class_id AND n.user_id=p.user_id WHERE p.session_id=?').all(sessionId).map(r=>({...objectJson(r.data_json),firstName:r.first_name||'Student',activityTitle:r.activity_title})).sort((a,b)=>(b.raw||0)-(a.raw||0)).slice(0,50);
 }
 eligible(user,a,session){
  if(!session||this.currentSession(a.class_id)?.id!==session.id||!this.available())return false;
  const owner=this.store.listUsers().find(u=>u.id===session.teacher_id&&u.enabled);
  if(!owner||this.learning.teacherCapability&&!this.learning.teacherCapability(owner))return false;
  try{this.learning.membership(owner,a.class_id,true);this.learning.writable(this.learning.activity(user,a.id));}catch{return false;}
  const admitted=this.schedule?.automatic(session)?user.learningSso===true&&user.profileId==='learning-student'&&!!user.sessionId:this.db.prepare('SELECT 1 FROM learning_live_attendance WHERE session_id=? AND user_id=?').get(session.id,user.id);
  return !!(admitted&&this.db.prepare("SELECT 1 FROM learning_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=? AND m.user_id=? AND m.role='student' AND u.enabled=1").get(a.class_id,user.id));
 }
 async record(user,id,input,req){
  const a=this.learning.activity(user,id);this.learning.writable(a);if(a.member.role!=='student')fail(403,'Only the signed-in student can send assignment progress.');
  const cfg=this.config(id);if(!cfg)fail(404,'Assignment connector not configured.');if(input.learnerKey!==user.id)fail(409,'The connected learner changed. Reconnect before sending saved events.');
  this.schedule?.reconcile();
  const event=normalizeEvent(input,cfg.points),fingerprint=digest(event),old=this.db.prepare('SELECT fingerprint FROM learning_signals WHERE activity_id=? AND user_id=? AND client_id=?').get(id,user.id,event.id);
  if(old){if(old.fingerprint!==fingerprint)fail(409,'This event ID was already used for different data.');return {duplicate:true,state:this.state(user,id)};}
  const now=this.clock();if(Date.parse(event.occurredAt)>now+300000)fail(400,'Event timestamp is in the future.');
  if(this.db.prepare('SELECT COUNT(*) n FROM learning_signals WHERE user_id=? AND received_at>?').get(user.id,now-86400000).n>=2000)fail(429,'Daily assignment event limit reached. Your SCORM assignment can still save its grade in Schoology.');
  const prior=this.state(user,id),latest=event.sequence>prior.sequence,session=this.currentSession(a.class_id),fresh=now-Date.parse(event.occurredAt)>=-5000&&now-Date.parse(event.occurredAt)<=30000;
  const attested=latest&&fresh&&this.presence?.consume(user,id,event.id,input.presenceId)===true,attestedAt=this.clock();
  const attestedNetworks=digest(this.settings().classroomNetworks);
  const presenceValid=()=>attested&&this.settings().networksConfirmed===true&&digest(this.settings().classroomNetworks)===attestedNetworks&&this.clock()-attestedAt<=5000;
  const classroom=latest&&fresh&&(classroomRequest(req,this.settings())||presenceValid())&&this.eligible(user,a,session);
  const progress={...prior.progress,...event.data,...(event.kind==='completed'?{completed:true}:{})};let signalId;
  this.store.tx(()=>{
   if(event.kind==='assessment')this.grading.award(user,a,event.data);
   if(event.kind==='arcade'){
    if(!latest)fail(409,'A newer assignment checkpoint is already saved. Reconnect before continuing.');
    this.arcade.save(user,a,event.data,classroom);
   }
   if(classroom&&this.schedule?.automatic(session))this.db.prepare('INSERT OR IGNORE INTO learning_live_attendance VALUES(?,?)').run(session.id,user.id);
   signalId=Number(this.db.prepare('INSERT INTO learning_signals(activity_id,user_id,client_id,fingerprint,kind,sequence,occurred_at,received_at,data_json,classroom) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,user.id,event.id,fingerprint,event.kind,event.sequence,event.occurredAt,now,JSON.stringify(event.data),classroom?1:0).lastInsertRowid);
   if(latest)this.db.prepare('INSERT INTO learning_progress VALUES(?,?,?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET sequence=excluded.sequence,data_json=excluded.data_json,updated_at=excluded.updated_at').run(id,user.id,event.sequence,JSON.stringify(progress),now);
   if(classroom&&['score','completed','progress'].includes(event.kind)){const previous=this.db.prepare('SELECT data_json FROM learning_live_scores WHERE session_id=? AND activity_id=? AND user_id=?').get(session.id,id,user.id);const visible={...objectJson(previous?.data_json),...event.data,...(event.kind==='completed'?{completed:true}:{})};delete visible.state;this.db.prepare('INSERT INTO learning_live_scores VALUES(?,?,?,?) ON CONFLICT(session_id,activity_id,user_id) DO UPDATE SET data_json=excluded.data_json').run(session.id,id,user.id,JSON.stringify(visible));}
  });
  const effect=classroom?await this.runEffect(user,a,session,signalId,event.kind,now,()=>classroomRequest(req,this.settings())||presenceValid()):{status:'not-in-classroom'};
  return {duplicate:false,saved:true,classroom:!!classroom,effect,state:this.state(user,id)};
 }
 actions(input){
  if(!Array.isArray(input)||input.length<1||input.length>4)fail(400,'Choose one to four approved effects.');
  const options=this.options();return input.map(action=>{
   if(!plain(action)||!['leaderboard','image','video','sound','lights'].includes(action.kind)||!Array.isArray(action.targets)||!action.targets.length||action.targets.length>16)fail(400,'Select explicit configured effect targets.');
   const catalog=action.kind==='lights'?options.lights:options.displays;
   if(action.targets.some(id=>typeof id!=='string'||!catalog.some(v=>v.id===id)))fail(400,'An effect target is unavailable.');
   const out={kind:action.kind,targets:[...new Set(action.targets)]};
   if(action.kind==='lights'){if(typeof action.color!=='string'||!/^#[a-f0-9]{6}$/i.test(action.color))fail(400,'Choose a static light color.');out.color=action.color;}
   if(['image','video','sound'].includes(action.kind)){const asset=options.assets.find(v=>v.id===action.assetId&&v.kind===action.kind);if(!asset)fail(400,'Choose an existing approved media asset.');out.assetId=asset.id;if(action.kind!=='image'){if(!finite(action.volume,0,.35))fail(400,'Classroom effect volume must be between 0 and 35%.');out.volume=action.volume;}}
   return out;
  });
 }
 saveRecipe(user,classId,input){
  this.learning.membership(user,classId,true);const title=label(input.label),kind=input.eventKind;
  if(!['progress','score','completed'].includes(kind))fail(400,'Choose an assignment event.');
  const actions=this.actions(input.actions);
  const id=input.id||crypto.randomUUID();if(!uuid(id))fail(400,'Invalid effect identifier.');const existing=this.db.prepare('SELECT class_id FROM learning_effect_recipes WHERE id=?').get(id);if(existing&&existing.class_id!==classId)fail(404,'Effect not found.');if(!existing&&this.db.prepare('SELECT COUNT(*) n FROM learning_effect_recipes WHERE class_id=?').get(classId).n>=20)fail(400,'Class effect limit reached.');
  this.db.prepare('INSERT INTO learning_effect_recipes VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,event_kind=excluded.event_kind,config_json=excluded.config_json').run(id,classId,title,kind,JSON.stringify({actions,enabled:input.enabled===true}));this.learning.event(user,null,'classroom.recipe',id,{classId});return id;
 }
 async runEffect(user,a,session,signalId,kind,received,networkStillAllowed){
  if(this.effectBusy||this.clock()-this.lastEffect<15000)return {status:'cooldown'};
  const recipe=this.db.prepare('SELECT * FROM learning_effect_recipes WHERE class_id=? AND event_kind=? ORDER BY rowid').all(a.class_id,kind).find(r=>objectJson(r.config_json).enabled===true);
  if(!recipe||!this.eligible(user,a,session)||!networkStillAllowed())return {status:'disabled'};
  const run=crypto.randomUUID();this.db.prepare("INSERT INTO learning_effect_runs VALUES(?,?,?,?,'dispatching',?,NULL)").run(run,session.id,signalId,recipe.id,this.clock());this.effectBusy=true;this.lastEffect=this.clock();let status='sent';
  try{for(const action of this.actions(objectJson(recipe.config_json).actions)){if(!this.eligible(user,a,session)||!networkStillAllowed()||this.clock()-received>30000){status='cancelled';break;}const result=await this.dispatch(action,{board:this.board(session.id),classId:a.class_id,sessionId:session.id,admitted:()=>this.eligible(user,a,session)&&networkStillAllowed()&&this.clock()-received<=30000});if(result?.ok!==true){status='unconfirmed';break;}}}catch{status='unconfirmed';}finally{this.effectBusy=false;this.db.prepare('UPDATE learning_effect_runs SET status=?,finished_at=? WHERE id=?').run(status,this.clock(),run);}
  return {status};
 }
 summary(user,classId){
  this.learning.membership(user,classId,true);const rows=this.db.prepare('SELECT p.data_json FROM learning_progress p JOIN learning_activities a ON a.id=p.activity_id JOIN learning_members m ON m.class_id=a.class_id AND m.user_id=p.user_id WHERE a.class_id=?').all(classId).map(r=>objectJson(r.data_json));
  const scores=rows.filter(r=>finite(r.raw,0,100)).map(r=>r.raw);return {attempts:rows.length,completed:rows.filter(r=>r.completed).length,scored: scores.length,meanReportedPercent:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null,scoreSource:'SCORM-reported; not evidence of verified mastery',activeClassroom:!!this.currentSession(classId)};
 }
}
module.exports={LearningPlatform,normalizeSettings,normalizeEvent,classroomRequest,cidr};
