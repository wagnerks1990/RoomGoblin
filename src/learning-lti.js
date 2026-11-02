"use strict";

// Course-scoped LTI 1.1 compatibility for Schoology External Tool Providers.
// No client-supplied name, role, URL, or score is trusted without a signed launch.
const crypto=require('node:crypto'),https=require('node:https'),dns=require('node:dns').promises;
const {XMLParser,XMLValidator}=require('fast-xml-parser');
const {publicAddress}=require('./sports-fetch');
const COOKIE='roomgoblin_learning_session';
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
const encode=s=>encodeURIComponent(String(s)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
const reject=(status,message)=>{throw Object.assign(Error(message),{status});};
function value(s,max=255){if(typeof s!=='string'||!s.trim()||s.length>max||/[\u0000-\u001f\u007f-\u009f]/.test(s))reject(400,'Invalid learning launch configuration.');return s;}
function exactOrigin(raw){try{const u=new URL(raw);if(u.origin!==raw||u.username||u.password||!(u.protocol==='https:'||u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))throw Error();return u.origin;}catch{reject(400,'Use an exact HTTPS origin.');}}
function signature(method,url,entries,secret,tokenSecret=''){
 const u=new URL(url),pairs=[...u.searchParams,...entries].filter(([k])=>k!=='oauth_signature').map(([k,v])=>[encode(k),encode(v)]);
 pairs.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0);
 const parameters=pairs.map(p=>p.join('=')).join('&');
 return crypto.createHmac('sha1',encode(secret)+'&'+encode(tokenSecret)).update([method.toUpperCase(),u.origin+u.pathname,parameters].map(encode).join('&')).digest('base64');
}
function constantEqual(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function cookie(req){try{const entry=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));return entry?decodeURIComponent(entry.slice(COOKIE.length+1)):'';}catch{return '';}}
function learningSessionUser(req,store){
 if(!/^\/(?:learn(?:\/|$)|api\/v1\/learning(?:\/|$))/.test(req.path)||!cookie(req))return undefined;
 const user=store.sessionUser(cookie(req));
 return user?.profileId==='learning-student'&&user.role==='viewer'?{...user,learningSso:true}:null;
}
function nameFrom(p){const name=p.lis_person_name_full||[p.lis_person_name_given,p.lis_person_name_family].filter(Boolean).join(' ')||'Student';return value(name,255).trim().replace(/\s+/gu,' ').replace(/[<>\u202a-\u202e\u2066-\u2069]/g,'')||'Student';}
function outcomeUrl(raw,origins){
 const u=new URL(value(raw,2048));
 if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443'||!origins.includes(u.origin))throw Error('Outcome origin is not configured.');
 return u;
}
const xml=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
function outcomeBody(id,sourcedId,score){return `<?xml version="1.0" encoding="UTF-8"?><imsx_POXEnvelopeRequest xmlns="http://www.imsglobal.org/services/ltiv1p1/xsd/imsoms_v1p0"><imsx_POXHeader><imsx_POXRequestHeaderInfo><imsx_version>V1.0</imsx_version><imsx_messageIdentifier>${xml(id)}</imsx_messageIdentifier></imsx_POXRequestHeaderInfo></imsx_POXHeader><imsx_POXBody><replaceResultRequest><resultRecord><sourcedGUID><sourcedId>${xml(sourcedId)}</sourcedId></sourcedGUID><result><resultScore><language>en</language><textString>${score}</textString></resultScore></result></resultRecord></replaceResultRequest></imsx_POXBody></imsx_POXEnvelopeRequest>`;}
function createLtiPackage(activity,appOrigin){
 const url=exactOrigin(appOrigin)+'/learn/lti/'+encodeURIComponent(activity.id),id=xml(activity.id),title=xml(activity.title);
 const description=activity.template_id==='scorm-connector-v1'?'Ungraded SCORM identity connection. Enable name sharing and a new-window launch. The original SCORM assignment keeps its grade.':'20-point shared IPv4 discussion. Configure the signed External Tool provider, name sharing, new-window launch and 20 possible points before student use.';
 const zip=new(require('adm-zip'))();
 zip.addFile('imsmanifest.xml',Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1" identifier="RG-${id}"><metadata><schema>IMS Common Cartridge</schema><schemaversion>1.1.0</schemaversion></metadata><organizations default="ORG"><organization identifier="ORG" structure="rooted-hierarchy"><item identifier="ROOT"><item identifier="ACTIVITY" identifierref="LTI"><title>${title}</title></item></item></organization></organizations><resources><resource identifier="LTI" type="imsbasiclti_xmlv1p0" href="launch.xml"><file href="launch.xml"/></resource></resources></manifest>`));
 zip.addFile('launch.xml',Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><cartridge_basiclti_link xmlns="http://www.imsglobal.org/xsd/imsbasiclti_v1p0"><title>${title}</title><description>${xml(description)}</description><launch_url>${xml(url)}</launch_url><secure_launch_url>${xml(url)}</secure_launch_url></cartridge_basiclti_link>`));
 return zip.toBuffer();
}
function validateOutcome(body,id){
 if(Buffer.byteLength(body)>65536||/<!DOCTYPE|<!ENTITY/i.test(body)||XMLValidator.validate(body)!==true)throw Error('Invalid outcome response.');
 const p=new XMLParser({removeNSPrefix:true,parseTagValue:false,processEntities:false}).parse(body);
 const e=p.imsx_POXEnvelopeResponse,h=e?.imsx_POXHeader?.imsx_POXResponseHeaderInfo,s=h?.imsx_statusInfo;
 if(Array.isArray(e)||s?.imsx_codeMajor!=='success'||s.imsx_messageRefIdentifier!==id||s.imsx_operationRefIdentifier!=='replaceResult'||!Object.hasOwn(e?.imsx_POXBody||{},'replaceResultResponse'))throw Error('Outcome save was not confirmed.');
}
async function postOutcome(url,headers,body,{lookup=dns.lookup,request=https.request}={}){
 let timer;const addresses=await Promise.race([lookup(url.hostname,{all:true,family:4}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Outcome DNS timeout.')),3000);})]).finally(()=>clearTimeout(timer));
 if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Outcome address is not public.');
 return new Promise((resolve,reject)=>{
  const req=request(url,{method:'POST',autoSelectFamily:false,headers:{...headers,'Content-Length':Buffer.byteLength(body),'Accept-Encoding':'identity'},lookup:(_host,_opts,cb)=>cb(null,addresses[0].address,4)},res=>{
   if(res.statusCode!==200||Number(res.headers['content-length'])>65536){res.destroy();reject(Error('Outcome endpoint unavailable.'));return;}
   let size=0;const chunks=[];res.on('data',c=>{size+=c.length;if(size>65536)return req.destroy(Error('Outcome response too large.'));chunks.push(c);});res.on('error',reject);res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));
  });const deadline=setTimeout(()=>req.destroy(Error('Outcome deadline exceeded.')),8000);req.on('close',()=>clearTimeout(deadline));req.on('error',reject);req.end(body);
 });
}

class LearningLti{
 constructor(learning,{send=postOutcome}={}){
  this.learning=learning;this.store=learning.store;this.db=learning.db;this.send=send;this.pending=new Map();
  this.db.exec(`CREATE TABLE IF NOT EXISTS learning_lti_nonces(activity_id TEXT NOT NULL,nonce_hash TEXT NOT NULL,expires INTEGER NOT NULL,PRIMARY KEY(activity_id,nonce_hash));
   CREATE TABLE IF NOT EXISTS learning_lti_users(class_id TEXT NOT NULL,subject_hash TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(class_id,subject_hash));
   CREATE TABLE IF NOT EXISTS learning_lti_results(activity_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),outcome_url TEXT NOT NULL,sourced_id TEXT NOT NULL,sent_fingerprint TEXT,state TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(activity_id,user_id));`);
 }
 key(id){return 'learning.lti.'+id;}
 config(id){return this.store.getPreference(this.key(id),{});}
 configure(user,id,input){
  this.learning.activity(user,id,true);const previous=this.config(id);
  const appOrigin=exactOrigin(input.appOrigin),platformOrigin=exactOrigin(input.platformOrigin),consumerKey=value(input.consumerKey,120);
  if(previous.bound&&(previous.platformOrigin!==platformOrigin||previous.appOrigin!==appOrigin))reject(409,'Create a new activity to change the connected LMS or launch origin.');
  if(!Array.isArray(input.outcomeOrigins)||input.outcomeOrigins.length>5)reject(400,'Enter up to five exact HTTPS outcome origins.');
  const outcomeOrigins=input.outcomeOrigins.map(x=>{const origin=exactOrigin(x);if(!origin.startsWith('https://'))reject(400,'Outcomes require HTTPS.');return origin;});
  const secret=input.sharedSecret?value(input.sharedSecret,512):null;if(secret&&secret.length<32)reject(400,'Use a shared secret of at least 32 characters.');
  if(input.enabled===true&&!secret&&!this.store.hasSecret(this.key(id)))reject(400,'Configure the shared secret first.');
  this.store.tx(()=>{if(secret)this.store.putSecret(this.key(id),secret,{purpose:'learning-lti'});this.store.setPreference(this.key(id),{...previous,appOrigin,platformOrigin,consumerKey,outcomeOrigins,enabled:input.enabled===true});this.learning.event(user,id,'lti.configure',id);});
  return this.settings(id);
 }
 settings(id){const observedOutcomeOrigins=[...new Set(this.db.prepare('SELECT DISTINCT outcome_url FROM learning_lti_results WHERE activity_id=?').all(id).flatMap(r=>{try{return [outcomeUrl(r.outcome_url,[new URL(r.outcome_url).origin]).origin];}catch{return [];}}))];return {...this.config(id),secretConfigured:this.store.hasSecret(this.key(id)),observedOutcomeOrigins};}
 launch(id,p,requestOrigin,requestUrl){
  const cfg=this.config(id),a=this.db.prepare('SELECT * FROM learning_activities WHERE id=?').get(id);
  if(!this.store.authEnabled()||!cfg.enabled||!a)reject(401,'This Schoology launch is not enabled.');
  if(!p||Object.keys(p).length>100||Buffer.byteLength(JSON.stringify(p))>32768||Object.entries(p).some(([k,v])=>typeof v!=='string'||!k||k.length>100))reject(400,'Invalid launch parameters.');
  const url=cfg.appOrigin+'/learn/lti/'+id;
  // Browser-only launch: exact Origin also prevents login CSRF via a copied form.
  if(requestUrl!==url||requestOrigin!==cfg.platformOrigin)reject(401,'Launch origin does not match configuration.');
  if(p.lti_message_type!=='basic-lti-launch-request'||p.lti_version!=='LTI-1p0'||p.oauth_signature_method!=='HMAC-SHA1'||p.oauth_version&&p.oauth_version!=='1.0'||p.oauth_token||p.oauth_consumer_key!==cfg.consumerKey)reject(401,'Invalid signed Schoology launch.');
  if(!/^\d{10}$/.test(p.oauth_timestamp)||Math.abs(Date.now()/1000-Number(p.oauth_timestamp))>300||!p.oauth_nonce||p.oauth_nonce.length>128)reject(401,'Expired or invalid launch.');
  const secret=this.store.getSecret(this.key(id));
  if(!secret||!constantEqual(p.oauth_signature,signature('POST',url,Object.entries(p),secret)))reject(401,'Invalid signed Schoology launch.');
  const context=value(p.context_id),resource=value(p.resource_link_id),roles=value(p.roles,1000).split(',').map(x=>x.trim());
  const instructor=roles.some(x=>['Instructor','urn:lti:role:ims/lis/Instructor','http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor'].includes(x));
  const learner=roles.some(x=>['Learner','urn:lti:role:ims/lis/Learner','http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'].includes(x));
  if(!instructor&&!learner)reject(403,'This launch needs a learner or instructor role.');
  if(cfg.bound&&(cfg.contextId!==context||cfg.resourceId!==resource))reject(403,'This activity is connected to another course or material.');
  if(!cfg.bound&&!instructor)reject(409,'Your teacher must open this Schoology tool once before students begin.');
  const nonce=digest(p.oauth_nonce);if(this.db.prepare('SELECT 1 FROM learning_lti_nonces WHERE activity_id=? AND nonce_hash=?').get(id,nonce))reject(401,'This launch has already been used. Reopen it in Schoology.');
  return this.store.tx(()=>{
   // Enrollment belongs to the class, so every signed activity in that class
   // must share the same LMS course. Recheck under the write transaction.
   for(const row of this.db.prepare('SELECT id FROM learning_activities WHERE class_id=?').all(a.class_id)){
    const connected=this.config(row.id);
    if(connected.bound&&(connected.platformOrigin!==cfg.platformOrigin||connected.contextId!==context))reject(403,'Use a separate RoomGoblin class for another Schoology course.');
   }
   this.db.prepare('DELETE FROM learning_lti_nonces WHERE expires<?').run(Date.now());
   this.db.prepare('INSERT INTO learning_lti_nonces VALUES(?,?,?)').run(id,nonce,Date.now()+610000);
   if(instructor){if(!cfg.bound)this.store.setPreference(this.key(id),{...cfg,bound:true,contextId:context,resourceId:resource});return {teacher:true};}
   if(!this.store.listAccessProfiles().some(x=>x.id==='learning-student'&&x.enabled))reject(403,'Learning access is disabled.');
   const subject=digest(JSON.stringify([cfg.platformOrigin,value(p.user_id)])),name=nameFrom(p);
   const mapping=this.db.prepare('SELECT user_id FROM learning_lti_users WHERE class_id=? AND subject_hash=?').get(a.class_id,subject);
   let user;
   if(mapping){
    user=this.store.listUsers().find(u=>u.id===mapping.user_id);
    if(!user?.enabled||user.profileId!=='learning-student'||user.role!=='viewer')reject(403,'This learning account is unavailable.');
    this.learning.membership(user,a.class_id);
    this.db.prepare('UPDATE learning_members SET alias=? WHERE class_id=? AND user_id=?').run(name,a.class_id,user.id);
   }else{
    if(!a.open||a.close_at&&Date.now()>=Date.parse(a.close_at))reject(403,'This activity is closed.');
    const count=this.db.prepare('SELECT COUNT(*) n FROM learning_members WHERE class_id=?').get(a.class_id).n;if(count>=500)reject(429,'Class account limit reached.');
    user=this.store.putUser({username:'lti-'+crypto.randomUUID(),displayName:name,role:'viewer',profileId:'learning-student'},{password:crypto.randomBytes(48).toString('base64url')});
    this.db.prepare("INSERT INTO learning_members(class_id,user_id,role,alias) VALUES(?,?,'student',?)").run(a.class_id,user.id,name);
    this.db.prepare('INSERT INTO learning_lti_users VALUES(?,?,?)').run(a.class_id,subject,user.id);
   }
   if(p.lis_outcome_service_url&&p.lis_result_sourcedid){
    const raw=value(p.lis_outcome_service_url,2048),sourcedId=value(p.lis_result_sourcedid,4096);const u=new URL(raw);
    if(u.protocol!=='https:'||u.username||u.password||u.hash||u.port&&u.port!=='443')reject(400,'Invalid outcome service.');
    // Store signed evidence; network use still requires an exact administrator allowlist.
    this.db.prepare("INSERT INTO learning_lti_results(activity_id,user_id,outcome_url,sourced_id) VALUES(?,?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET sent_fingerprint=CASE WHEN outcome_url=excluded.outcome_url AND sourced_id=excluded.sourced_id THEN sent_fingerprint ELSE NULL END,outcome_url=excluded.outcome_url,sourced_id=excluded.sourced_id").run(id,user.id,raw,sourcedId);
   }
   this.learning.platform?.signedName(a.class_id,user.id,p.lis_person_name_given);
   this.learning.event(user,id,'lti.launch',user.id);
   return {user,session:this.store.createSession(user,{ttlHours:8})};
  });
 }
 status(user,id){
  const r=this.db.prepare('SELECT * FROM learning_lti_results WHERE activity_id=? AND user_id=?').get(id,user.id);if(!r)return null;
  const grade=this.learning.currentReview(user,id),fingerprint=grade?.final?digest(JSON.stringify([grade.id,grade.updatedAt,grade.final.total])):null;
  return {state:grade?.status!=='approved'?'waiting':r.sent_fingerprint===fingerprint?'sent':r.state==='failed'?'failed':'pending'};
 }
 async sync(user,id){
  const key=id+':'+user.id,prior=this.pending.get(key)||Promise.resolve();
  const pending=prior.catch(()=>{}).then(()=>this.sendGrade(user,id));this.pending.set(key,pending);
  try{return await pending;}finally{if(this.pending.get(key)===pending)this.pending.delete(key);}
 }
 async sendGrade(user,id){
  const r=this.db.prepare('SELECT * FROM learning_lti_results WHERE activity_id=? AND user_id=?').get(id,user.id);if(!r)return null;
  const grade=this.learning.currentReview(user,id);if(grade?.status!=='approved')return this.status(user,id);
  const fingerprint=digest(JSON.stringify([grade.id,grade.updatedAt,grade.final.total]));if(r.sent_fingerprint===fingerprint)return {state:'sent'};
  try{
   const cfg=this.config(id);if(!cfg.enabled)throw Error('LTI disabled.');const url=outcomeUrl(r.outcome_url,cfg.outcomeOrigins||[]),secret=this.store.getSecret(this.key(id));if(!secret)throw Error('Missing LTI configuration.');
   const messageId=crypto.randomUUID(),body=outcomeBody(messageId,r.sourced_id,grade.final.total/20);
   const params={oauth_consumer_key:cfg.consumerKey,oauth_nonce:crypto.randomBytes(24).toString('hex'),oauth_timestamp:String(Math.floor(Date.now()/1000)),oauth_signature_method:'HMAC-SHA1',oauth_version:'1.0',oauth_body_hash:crypto.createHash('sha1').update(body).digest('base64')};
   params.oauth_signature=signature('POST',url.href,Object.entries(params),secret);
   const response=await this.send(url,{'Content-Type':'application/xml',Authorization:'OAuth '+Object.entries(params).map(([k,v])=>`${encode(k)}="${encode(v)}"`).join(', ')},body);
   validateOutcome(response,messageId);
   this.db.prepare("UPDATE learning_lti_results SET sent_fingerprint=?,state='sent' WHERE activity_id=? AND user_id=? AND outcome_url=? AND sourced_id=?").run(fingerprint,id,user.id,r.outcome_url,r.sourced_id);
  }catch{this.db.prepare("UPDATE learning_lti_results SET state='failed' WHERE activity_id=? AND user_id=? AND outcome_url=? AND sourced_id=?").run(id,user.id,r.outcome_url,r.sourced_id);}
  return this.status(user,id);
 }
}
module.exports={LearningLti,COOKIE,cookie,learningSessionUser,signature,exactOrigin,outcomeUrl,outcomeBody,validateOutcome,postOutcome,createLtiPackage};
