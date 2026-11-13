"use strict";

const crypto=require("node:crypto");
const {LearningLti,COOKIE:LEARNING_COOKIE,cookie:learningCookie}=require("./learning-lti");
const {LearningPlatform}=require('./learning-platform');
const {PREFERENCE:TOOLS_PREFERENCE,normalizeTools,readTools}=require('./learning-tools');
const {LearningPresence}=require('./learning-presence');
const {LearningSchedule}=require('./learning-schedule');
const {LearningConnection,COOKIE:FLOW_COOKIE,flowCookie}=require('./learning-connection');
const {isPublicRequest}=require('./learning-public');
const {rateLimit}=require("express-rate-limit");
const {AssignmentDefinitions,TEMPLATE:DEFINED_DISCUSSION,toCase}=require('./learning-assignment-definition');
const {CASE,CASES,caseFor,rubricFor,validateGrade,gradeWriting,localBaseURL}=require("./learning-grader");
const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
const text=(v,max=6000)=>{if(typeof v!=="string"||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))fail(400,"Enter text within the displayed length limit.");return v.trim();};
const now=()=>new Date().toISOString();
const parse=v=>v?JSON.parse(v):null;
const hash=v=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
function isoDate(v){if(v===null||v===""||v===undefined)return null;if(typeof v!=="string"||!/^\d{4}-\d\d-\d\dT/.test(v)||!Number.isFinite(Date.parse(v)))fail(400,"Use a valid date and time with timezone.");if(!/(Z|[+-]\d\d:\d\d)$/.test(v))fail(400,"A timezone is required.");return new Date(v).toISOString();}
function origin(v){try{const u=new URL(v);if(u.origin!==v||u.username||u.password||!(u.protocol==="https:"||(u.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(u.hostname))))throw Error();return u.origin;}catch{fail(400,"Use an exact HTTPS origin (or loopback HTTP for local tests).");}}

class LearningStore{
  constructor(store){
    this.store=store;this.db=store.db;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_classes(id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS learning_members(class_id TEXT NOT NULL REFERENCES learning_classes(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('teacher','student')),alias TEXT NOT NULL,exempt INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(class_id,user_id));
      CREATE TABLE IF NOT EXISTS learning_activities(id TEXT PRIMARY KEY,class_id TEXT NOT NULL REFERENCES learning_classes(id) ON DELETE CASCADE,title TEXT NOT NULL,template_id TEXT NOT NULL,open INTEGER NOT NULL DEFAULT 1,due_at TEXT,close_at TEXT,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS learning_posts(id TEXT PRIMARY KEY,activity_id TEXT NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,parent_id TEXT REFERENCES learning_posts(id),kind TEXT NOT NULL CHECK(kind IN ('initial','reply','critique','teacher','ai')),body TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,hidden INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      DROP INDEX IF EXISTS learning_one_initial;
      CREATE INDEX IF NOT EXISTS learning_initial_posts ON learning_posts(activity_id,user_id) WHERE kind='initial';
      CREATE INDEX IF NOT EXISTS learning_post_feed ON learning_posts(activity_id,created_at);
      CREATE TABLE IF NOT EXISTS learning_reviews(id TEXT PRIMARY KEY,activity_id TEXT NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL,snapshot_json TEXT NOT NULL,status TEXT NOT NULL,ai_json TEXT,final_json TEXT,reviewer_id TEXT REFERENCES users(id),model TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS learning_review_user ON learning_reviews(activity_id,user_id,created_at);
      CREATE TABLE IF NOT EXISTS learning_events(id INTEGER PRIMARY KEY,at TEXT NOT NULL,actor_id TEXT,activity_id TEXT,kind TEXT NOT NULL,record_id TEXT,details_json TEXT NOT NULL);
    `);
    this.definitions=new AssignmentDefinitions(this);
    this.modelBudget=new(require('./learning-model-budget').LearningModelBudget)(this);
    this.postHistory=new(require('./learning-post-history').PostHistory)(this);
    if(!this.db.prepare('PRAGMA table_info(learning_reviews)').all().some(c=>c.name==='started_at'))this.db.exec('ALTER TABLE learning_reviews ADD COLUMN started_at TEXT');
    // This profile can never grant appliance access, even if its config is edited.
    this.db.prepare("INSERT OR IGNORE INTO access_profiles(id,name,role,enabled,config_json,updated_at) VALUES(?,?,?,?,?,?)").run("learning-student","Learning student","viewer",1,JSON.stringify({description:"Assigned learning activities only",capabilities:["learning.participate"]}),now());
    // No automatic AI replay after a process restart (avoids duplicate charges).
    this.db.prepare("UPDATE learning_reviews SET status='unavailable' WHERE status='grading'").run();
  }
  event(user,activity,kind,id,details={}){this.db.prepare("INSERT INTO learning_events(at,actor_id,activity_id,kind,record_id,details_json) VALUES(?,?,?,?,?,?)").run(now(),user.id,activity,kind,id,JSON.stringify(details));}
  membership(user,classId,teacher=false){
    const row=this.db.prepare("SELECT * FROM learning_members WHERE class_id=? AND user_id=?").get(classId,user.id);
    if(!row||row.role==="teacher"&&(user.profileId==="learning-student"||user.role==="viewer")||teacher&&row.role!=="teacher")fail(404,"Assigned class not found.");return row;
  }
  activity(user,id,teacher=false){const row=this.db.prepare("SELECT * FROM learning_activities WHERE id=?").get(id);if(!row)fail(404,"Assigned activity not found.");const participant=this.direct?.db.prepare('SELECT activity_id FROM learning_direct_participants WHERE user_id=?').get(user.id);if(participant&&participant.activity_id!==id)fail(404,'Assigned activity not found.');return {...row,member:this.membership(user,row.class_id,teacher)};}
  writable(a,at=Date.now()){if(a.member.role==='student'&&this.portal?.command(a.id).paused)fail(409,'Your teacher has paused this activity. Your saved work is retained.');if(a.member.role==="student"&&(!a.open||a.close_at&&at>=Date.parse(a.close_at)&&!a.member.exempt))fail(409,"This activity is closed. Ask your teacher about an approved exception.");}
  classes(user){return this.db.prepare("SELECT c.*,m.role,m.alias FROM learning_classes c JOIN learning_members m ON m.class_id=c.id WHERE m.user_id=? ORDER BY c.created_at DESC").all(user.id);}
  caseForActivity(a,privateFields=false){if(a.template_id===DEFINED_DISCUSSION)return toCase(this.definitions.get(a.id),privateFields);return CASES[a.template_id]?{...caseFor(a.template_id),scoreLevels:rubricFor(a.template_id)}:null;}
  createClass(user,title){const id=crypto.randomUUID();this.store.tx(()=>{this.db.prepare("INSERT INTO learning_classes VALUES(?,?,?)").run(id,text(title,100),now());this.db.prepare("INSERT INTO learning_members(class_id,user_id,role,alias) VALUES(?,?,?,?)").run(id,user.id,"teacher",text(user.displayName||"Teacher",40));this.event(user,null,"class.create",id,{classId:id});});return id;}
  enroll(user,classId,input,allowTeacher=false){
    this.membership(user,classId,true);const target=this.store.listUsers().find(x=>x.id===input.userId&&x.enabled);
    if(!target)fail(400,"Enabled account not found.");
    const role=input.role==="teacher"?"teacher":"student";
    if(role==="teacher"?(!allowTeacher||target.profileId==="learning-student"||!["operator","admin"].includes(target.role)):target.profileId!=="learning-student")fail(400,"Select an eligible account. Only administrators may assign another teacher.");
    this.db.prepare("INSERT INTO learning_members(class_id,user_id,role,alias,exempt) VALUES(?,?,?,?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET alias=excluded.alias,exempt=excluded.exempt,role=excluded.role").run(classId,target.id,role,text(input.alias,40),input.exempt===true?1:0);
    this.event(user,null,"member.assign",target.id,{classId,exempt:input.exempt===true});
  }
  createActivity(user,classId,input){this.membership(user,classId,true);const id=crypto.randomUUID(),template=input.templateId||CASE.id;if(!Object.prototype.hasOwnProperty.call(CASES,template)&&!['scorm-connector-v1',DEFINED_DISCUSSION].includes(template))fail(400,'Choose an available activity type.');this.db.prepare("INSERT INTO learning_activities(id,class_id,title,template_id,created_at) VALUES(?,?,?,?,?)").run(id,classId,text(input.title||(CASES[template]?.title||'SCORM connection'),120),template,now());this.event(user,id,"activity.create",id);return id;}
  settings(user,id,input){const a=this.activity(user,id,true),due=isoDate(input.dueAt),close=isoDate(input.closeAt);if(due&&close&&Date.parse(close)<=Date.parse(due))fail(400,"Close time must follow due time.");this.db.prepare("UPDATE learning_activities SET open=?,due_at=?,close_at=? WHERE id=?").run(input.open===true?1:0,due,close,a.id);this.event(user,id,"activity.settings",id,{open:input.open===true,due,close});}
  posts(user,id){
    const a=this.activity(user,id);const rows=this.db.prepare("SELECT p.*,m.alias,m.role FROM learning_posts p JOIN learning_members m ON m.user_id=p.user_id AND m.class_id=? WHERE p.activity_id=? ORDER BY p.created_at,p.id LIMIT 1000").all(a.class_id,id);
    const byId=new Map(rows.map(p=>[p.id,p]));
    const visible=p=>{const seen=new Set();while(p){if(p.hidden||seen.has(p.id))return false;seen.add(p.id);if(!p.parent_id)return true;p=byId.get(p.parent_id);}return false;};
    const definition=this.caseForActivity(a);
    return rows.filter(p=>a.member.role==="teacher"||visible(p)).map(p=>({id:p.id,parentId:p.parent_id,kind:p.kind,body:p.body,alias:p.kind==="ai"?(definition?.responseLabel||this.store.getPreference("learning.responseLabel","Teacher")):p.alias,role:p.kind==="ai"?"ai":p.role,mine:p.user_id===user.id,revision:p.revision,hidden:!!p.hidden,createdAt:p.created_at,updatedAt:p.updated_at,...(a.member.role==="teacher"?{userId:p.user_id}:{})}));
  }
  latestScoredReply(user,id){return this.db.prepare("SELECT p.id FROM learning_posts p LEFT JOIN learning_posts parent ON parent.id=p.parent_id AND parent.activity_id=p.activity_id WHERE p.activity_id=? AND p.user_id=? AND p.hidden=0 AND (p.kind='critique' OR (p.kind='reply' AND parent.kind='initial' AND parent.hidden=0 AND parent.user_id<>p.user_id)) ORDER BY p.rowid DESC LIMIT 1").get(id,user.id);}
  isScoredPost(user,id,postId){const p=this.db.prepare("SELECT p.kind,parent.kind parent_kind,parent.user_id parent_user FROM learning_posts p LEFT JOIN learning_posts parent ON parent.id=p.parent_id AND parent.activity_id=p.activity_id WHERE p.id=? AND p.activity_id=? AND p.user_id=?").get(postId,id,user.id);return !!p&&(['initial','critique'].includes(p.kind)||p.kind==='reply'&&(this.definitions.get(id)?.kind==='discussion'||p.parent_kind==='initial'&&p.parent_user!==user.id));}
  post(user,id,input){
    const a=this.activity(user,id);this.writable(a);const teacher=a.member.role==="teacher";
    if(!this.caseForActivity(a))fail(409,'This SCORM connector does not accept discussion posts.');
    const kind=teacher?"teacher":input.kind;
    if(!(teacher?["teacher"]:["initial","reply","critique"]).includes(kind))fail(400,"Choose a post type.");
    const body=text(input.body,kind==="initial"?6000:3000),parentId=input.parentId||null;
    if(parentId){let p=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND hidden=0").get(parentId,id);if(!p)fail(400,"Choose a visible discussion post.");if(!teacher&&p.user_id===user.id&&p.kind!=="ai")fail(400,"Reply to a classmate or teacher, not your own post.");const seen=new Set();while(p){if(p.hidden||seen.has(p.id)||seen.size>=30)fail(400,"Choose a visible discussion thread with fewer replies in its chain.");seen.add(p.id);if(!p.parent_id)break;p=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=?").get(p.parent_id,id);if(!p)fail(400,"Choose a visible discussion thread.");}}
    if(kind==="reply"&&!parentId)fail(400,"Choose a classmate's post.");
    if(["initial","critique"].includes(kind)&&parentId)fail(400,"This post type cannot have a parent.");
    if(kind==="critique"&&this.db.prepare("SELECT 1 FROM learning_posts WHERE activity_id=? AND kind='initial' AND hidden=0 AND user_id<>?").get(id,user.id))fail(409,"A peer post is available. Respond to a classmate.");
    if(this.db.prepare("SELECT COUNT(*) n FROM learning_posts WHERE activity_id=? AND user_id=?").get(id,user.id).n>=30)fail(429,"Post limit reached. Revise an existing post or ask your teacher.");
    if(kind==="initial"&&!this.definitions.get(id)&&this.db.prepare("SELECT 1 FROM learning_posts WHERE activity_id=? AND user_id=? AND kind='initial'").get(id,user.id))fail(409,"Revise your existing initial post.");
    const postId=crypto.randomUUID(),time=now();this.db.prepare("INSERT INTO learning_posts(id,activity_id,user_id,parent_id,kind,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(postId,id,user.id,parentId,kind,body,time,time);this.event(user,id,"post.create",postId);return postId;
  }
  edit(user,id,postId,input){return this.store.tx(()=>{
    this.activity(user,id);if(this.definitions.get(id)?.kind==='discussion')fail(409,'Posts cannot be edited. Add a new post or reply with your correction.');
    const a=this.activity(user,id);this.writable(a);const p=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND user_id=? AND hidden=0 AND kind IN ('initial','reply','critique')").get(postId,id,user.id);if(!p)fail(404,"Your editable post was not found.");
    if(input.revision!==p.revision)fail(409,"This post changed. Refresh before editing.");
    if(!this.postHistory.change(p,text(input.body,p.kind==='initial'?6000:3000),user,'author'))return false;
    if(this.isScoredPost(user,id,postId))this.db.prepare("UPDATE learning_reviews SET status='superseded',updated_at=? WHERE activity_id=? AND user_id=? AND status<>'superseded'").run(now(),id,user.id);this.event(user,id,"post.edit",p.id,{revision:p.revision+1});return true;
  });}
  editInstructor(user,id,postId,input){return this.store.tx(()=>{
    this.activity(user,id,true);const p=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND kind IN ('ai','teacher')").get(postId,id);if(!p)fail(404,'Teacher response not found.');if(input.revision!==undefined&&input.revision!==p.revision)fail(409,'This response changed. Refresh before editing.');
    if(!this.postHistory.change(p,text(input.body,3000),user,'teacher'))return false;this.event(user,id,'coach.teacher-edit',p.id,{revision:p.revision+1});
  });}

  moderate(user,id,postId,hidden){this.activity(user,id,true);const p=this.db.prepare("SELECT * FROM learning_posts WHERE activity_id=? AND id=?").get(id,postId);if(!p)fail(404,"Post not found.");this.db.prepare("UPDATE learning_posts SET hidden=? WHERE id=?").run(hidden?1:0,p.id);this.event(user,id,"post.moderate",p.id,{hidden});}
  snapshot(user,id,replyId){
    const activity=this.activity(user,id);if(!this.caseForActivity(activity))fail(409,'SCORM scores stay in the original Schoology assignment.');
    const initial=this.db.prepare("SELECT * FROM learning_posts WHERE activity_id=? AND user_id=? AND kind='initial' AND hidden=0").get(id,user.id);if(!initial)fail(400,"Publish your initial explanation first.");
    let reply=null,parent=null;
    if(replyId){reply=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND user_id=? AND kind IN ('reply','critique') AND hidden=0").get(replyId,id,user.id);if(!reply)fail(400,"Choose your own reply or independent critique.");if(reply.parent_id){parent=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND kind='initial' AND hidden=0 AND user_id<>?").get(reply.parent_id,id,user.id);if(!parent)fail(409,"For grading, choose a reply to a classmate's initial post. Conversation follow-ups do not replace that reply.");}}
    const snapshot={initial:initial.body,initialId:initial.id,initialRevision:initial.revision,reply:reply?.body||"",replyId:reply?.id||null,replyRevision:reply?.revision||0,parent:parent?.body||(reply?.kind==="critique"?this.caseForActivity(activity).alternate:""),parentId:parent?.id||null,parentRevision:parent?.revision||0};
    if(this.definitions.get(id)?.kind==='discussion'){
      const contributions=this.db.prepare(`WITH RECURSIVE visible AS (
        SELECT *,0 depth FROM learning_posts WHERE activity_id=? AND parent_id IS NULL AND hidden=0
        UNION ALL SELECT p.*,v.depth+1 FROM learning_posts p JOIN visible v ON p.parent_id=v.id AND p.activity_id=v.activity_id WHERE p.hidden=0 AND v.depth<30
      ) SELECT v.*,parent.kind parent_kind,parent.user_id parent_user,parent.body parent_body,parent.revision parent_revision
        FROM visible v LEFT JOIN learning_posts parent ON parent.id=v.parent_id
        WHERE v.user_id=? AND v.kind IN ('initial','reply','critique') ORDER BY v.created_at,v.id`).all(id,user.id);
      // Only this learner's writing counts as evidence. Other authors are context.
      snapshot.initial=contributions.map(p=>p.body).join('\n\n');
      const peer=contributions.filter(p=>p.kind==='critique'||p.kind==='reply'&&p.parent_kind==='initial'&&p.parent_user!==user.id);
      snapshot.reply=peer.map(p=>p.body).join('\n\n');
      snapshot.parent=peer.map(p=>p.kind==='critique'?this.caseForActivity(activity).alternate:p.parent_body).join('\n\n');
      snapshot.contributions=contributions.map(p=>({id:p.id,revision:p.revision,parentId:p.parent_id,parentRevision:p.parent_revision}));
      snapshot.mainPostIds=contributions.filter(p=>p.kind==='initial').map(p=>p.id);
    }
    return snapshot;
  }
  currentReview(user,id){this.activity(user,id);const r=this.db.prepare("SELECT * FROM learning_reviews WHERE activity_id=? AND user_id=? ORDER BY rowid DESC LIMIT 1").get(id,user.id);if(!r)return null;try{if(hash(this.snapshot(user,id,parse(r.snapshot_json).replyId))!==r.fingerprint)return {...this.projectReview(r),status:"superseded",final:null};}catch{return {...this.projectReview(r),status:"superseded",final:null};}return this.projectReview(r);}
  projectReview(r){return {id:r.id,status:r.status,replyId:parse(r.snapshot_json).replyId,automated:!!parse(r.final_json)&&parse(r.final_json).source==="ai",createdAt:r.created_at,updatedAt:r.updated_at,ai:parse(r.ai_json),final:parse(r.final_json)};}
  approve(user,id,reviewId,input){
    const a=this.activity(user,id,true),r=this.db.prepare("SELECT * FROM learning_reviews WHERE id=? AND activity_id=?").get(reviewId,id);if(!r)fail(404,"Review not found.");if(!["needs_review","unavailable","approved"].includes(r.status))fail(409,"Refresh and select a pending review.");
    const target=this.store.listUsers().find(x=>x.id===r.user_id&&x.enabled);if(!target)fail(409,"Learner account is disabled.");this.membership(target,a.class_id);
    const snap=parse(r.snapshot_json);if(hash(this.snapshot(target,id,snap.replyId))!==r.fingerprint)fail(409,"The writing changed. Request a fresh review.");
    let grade;try{grade=validateGrade({criteria:input.criteria,summary:input.summary},a.template_id,this.definitions.get(a.id));}catch{fail(400,"Use the listed rubric scores and feedback limits.");}const member=this.membership(target,a.class_id),late=!!(a.due_at&&Date.parse(r.created_at)>Date.parse(a.due_at)&&!member.exempt&&input.waiveLate!==true);
    const final={...grade,earned:grade.total,lateMultiplier:late?.5:1,total:grade.total*(late?.5:1),possible:this.caseForActivity(a).points,approvedAt:now(),source:"teacher"};
    const response=input.response===undefined?parse(r.ai_json)?.proposedResponse:input.response;
    if(response!==undefined&&typeof response!=='string')fail(400,'Use a text response.');
    if(response?.trim())text(response,1800);
    this.store.tx(()=>{
      this.db.prepare("UPDATE learning_reviews SET final_json=?,status='approved',reviewer_id=?,updated_at=? WHERE id=?").run(JSON.stringify(final),user.id,now(),r.id);
      if(r.status!=='approved'&&response?.trim()){
        const postId=crypto.randomUUID(),stamp=now();
        this.db.prepare("INSERT INTO learning_posts(id,activity_id,user_id,parent_id,kind,body,created_at,updated_at) VALUES(?,?,?,?,'teacher',?,?,?)").run(postId,id,user.id,snap.initialId,response.trim(),stamp,stamp);
        this.event(user,id,'coach.approve',postId,{reviewId:r.id});
      }
      this.event(user,id,"grade.approve",r.id,{earned:grade.total,total:final.total,waiveLate:input.waiveLate===true});
    });return final;
  }
}

function restrictedStudentGate(req,res,next){
  if(req.authUser?.profileId!=="learning-student")return next();
  const allowed=/^\/api\/v1\/learning(?:\/|$)/.test(req.path)||/^\/api\/v1\/auth\/(?:status|me|login|logout|change-password|sessions|logout-others)$/.test(req.path)||/^\/learn(?:\/|$)/.test(req.path)||req.path==="/favicon.ico";
  return allowed?next():res.status(403).json({ok:false,error:"Student accounts can access assigned learning activities only."});
}

function registerLearning(app,{store,requestUser,hasCapability,grade=gradeWriting,freezeRequested=()=>false,publicDir,ltiOptions,platformOptions,reviewOptions={}}){
  let retryQueue,nextLocalReviewAt=0;const queued=Symbol("acceptedLearningReview");
  const learning=new LearningStore(store),busy=new Set(),lti=new LearningLti(learning,ltiOptions);learning.lti=lti;
  const platform=new LearningPlatform(learning,{available:()=>!freezeRequested(),...platformOptions});learning.platform=platform;
  const schedule=new LearningSchedule(platform,{source:platformOptions?.scheduleSource,writable:()=>!freezeRequested()&&(platformOptions?.scheduleWritable?.()??true)});platform.schedule=schedule;learning.schedule=schedule;
  const presence=new LearningPresence(platform);platform.presence=presence;
  const connection=new LearningConnection(platform);platform.connection=connection;
  const insights=require('./learning-insights').createInsights(platform);
  const direct=new(require('./learning-direct').LearningDirect)(learning);learning.direct=direct;
  const portal=new(require('./learning-teacher-portal').LearningTeacherPortal)(learning);learning.portal=portal;
  const wrap=fn=>async(req,res,next)=>{try{await fn(req,res,next);}catch(e){res.status(e.status||500).json({ok:false,error:e.status?e.message:"Learning service could not complete the request."});}};
  const teacher=u=>u.profileId!=="learning-student"&&(hasCapability(u,"*")||hasCapability(u,"classroom.control"));
  learning.teacherCapability=teacher;
  const api="/api/v1/learning";
  // The single operator workspace is served directly, without a directory redirect.
  if(publicDir)app.get(['/learn','/learn/','/learn/index.html'],rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}),(req,res)=>isPublicRequest(req)?res.sendStatus(404):res.sendFile(require('node:path').join(publicDir,'index.html')));
  const requireLearning=(req,res,next)=>{const u=req.directLearner||requestUser(req);if(!store.authEnabled()||!u||isPublicRequest(req)&&!req.directLearner&&(!u.learningSso||u.profileId!=='learning-student'))return res.status(401).json({ok:false,error:isPublicRequest(req)?'Reopen the signed Schoology connection.':'Sign in to your assigned RoomGoblin account.'});if(!teacher(u)&&!hasCapability(u,"learning.participate"))return res.status(403).json({ok:false,error:"Learning access is not enabled."});req.learner=u;res.setHeader("Cache-Control","no-store");next();};
  const requireTeacher=(req,res,next)=>teacher(req.learner)?next():res.status(403).json({ok:false,error:"Teacher access required."});
  const requireAdministrator=(req,res,next)=>hasCapability(req.learner,"*")?next():res.status(403).json({ok:false,error:"Administrator access required."});
  // This bearer-only data plane never authenticates a native cookie. Rewrite
  // only the explicit learner allowlist into the existing grading/report handlers.
  app.use(rateLimit({windowMs:60000,limit:600,standardHeaders:true,legacyHeaders:false,skip:req=>!req.path.startsWith(api+'/direct/')}),(req,res,next)=>{
    if(!req.path.startsWith(api+'/direct/'))return next();
    const transport=require('./learning-direct');transport.cors(res);
    const target=transport.route(req.method==='OPTIONS'?req.get('Access-Control-Request-Method'):req.method,req.path);
    if(!target)return res.status(404).json({ok:false,error:'Assignment API route not found.'});
    if(req.method==='OPTIONS')return res.sendStatus(204);
    if(freezeRequested()&&req.method!=='GET')return res.status(423).json({ok:false,error:'Backup in progress. Try again shortly.'});
    if(req.get('x-roomgoblin-learning')!=='1')return res.status(403).json({ok:false,error:'Assignment request header required.'});
    if(target.part==='enroll')return next();
    try{req.directLearner=direct.authorize(target.id,String(req.get('Authorization')||'').replace(/^Bearer /,''));req.url=req.url.replace('/learning/direct/','/learning/');next();}catch(error){res.status(error.status||500).json({ok:false,error:error.status?error.message:'Assignment connection failed.'});}
  });
  app.post(api+'/direct/activities/:id/enroll',rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}),wrap((req,res)=>{
    const user=direct.enroll(req.params.id,String(req.get('Authorization')||'').replace(/^RoomGoblin-Assignment /,''),req.body);
    res.json({ok:true,state:platform.state(user,req.params.id),identitySource:'SCORM-reported'});
  }));
  app.all(require('./learning-direct').presencePath,rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}),wrap((req,res)=>{
    const transport=require('./learning-direct');transport.cors(res);
    if(isPublicRequest(req)||['forwarded','x-forwarded-for','x-forwarded-proto','cf-connecting-ip'].some(k=>req.headers[k]!==undefined)||!require('./learning-platform').classroomRequest(req,platform.settings()))fail(403,'Direct classroom network required.');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, X-RoomGoblin-Presence');res.setHeader('Access-Control-Allow-Private-Network','true');
    if(req.method==='OPTIONS'){if(req.get('Access-Control-Request-Method')!=='POST')fail(403,'Presence POST required.');return res.sendStatus(204);}
    if(req.method!=='POST'||req.get('x-roomgoblin-presence')!=='1')fail(403,'Presence POST required.');if(freezeRequested())fail(423,'Backup in progress.');
    const challenge=learning.db.prepare('SELECT user_id FROM learning_presence_challenges WHERE id=?').get(req.body?.id);
    if(!challenge||!direct.isParticipant(challenge.user_id))fail(404,'Direct assignment challenge not found.');
    res.json({ok:true,...presence.attest(req.body.id,req)});
  }));
  app.post('/learn/connect/start',rateLimit({windowMs:60000,limit:30,standardHeaders:true,legacyHeaders:false}),wrap((req,res)=>{
    if(freezeRequested())fail(423,'Backup in progress.');
    if(req.get('x-roomgoblin-learning')!=='1'||req.get('origin')!==`${req.protocol}://${req.get('host')}`)fail(403,'A same-origin connector request is required.');
    const flow=connection.start(req.body?.activityId,req.body?.parent,req.body?.embedded===true,requestUser(req));
    res.setHeader('Set-Cookie',`${FLOW_COOKIE}=${flow.id}; Path=/learn/lti; HttpOnly; SameSite=None; Secure${req.body?.embedded===true?'; Partitioned':''}; Max-Age=600`);
    res.setHeader('Cache-Control','no-store');res.json({ok:true,...flow});
  }));
  app.get('/learn/connect-info/:id',rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false}),wrap((req,res)=>{
    const cfg=platform.config(req.params.id),a=learning.db.prepare('SELECT open,template_id FROM learning_activities WHERE id=?').get(req.params.id);if(!cfg||!a?.open)fail(404,'Assignment connector is not available.');
    res.setHeader('Cache-Control','no-store');res.json({ok:true,launchUrl:cfg.launch_url,kind:a.template_id==='scorm-connector-v1'?'scorm':'discussion',bridgeOrigins:store.getPreference('learning.bridgeOrigins',[])});
  }));
  app.get('/learn/presence/config',wrap((req,res)=>{
    if(isPublicRequest(req)||['forwarded','x-forwarded-for','x-forwarded-proto','cf-connecting-ip'].some(k=>req.headers[k]!==undefined)||!require('./learning-platform').classroomRequest(req,platform.settings()))fail(403,'Classroom network required.');
    res.setHeader('Cache-Control','no-store');res.json({ok:true,publicOrigin:platform.settings().publicOrigin});
  }));
  app.post('/learn/presence/attest',rateLimit({windowMs:60000,limit:120,standardHeaders:true,legacyHeaders:false}),wrap((req,res)=>{
    if(freezeRequested())fail(423,'Backup in progress.');
    if(isPublicRequest(req)||req.get('x-roomgoblin-presence')!=='1'||req.get('origin')!==`${req.protocol}://${req.get('host')}`)fail(403,'Local presence request required.');
    res.setHeader('Cache-Control','no-store');res.json({ok:true,...presence.attest(req.body?.id,req)});
  }));
  app.post('/learn/lti/:id',rateLimit({windowMs:60000,limit:60,standardHeaders:true,legacyHeaders:false}),wrap((req,res)=>{
    res.setHeader('Cache-Control','no-store');
    if(freezeRequested())fail(423,'Backup in progress; reopen the assignment shortly.');
    if(!req.is('application/x-www-form-urlencoded'))fail(415,'Open this assignment from its Schoology External Tool link.');
    const result=lti.launch(req.params.id,req.body,req.get('origin'),`${req.protocol}://${req.get('host')}${req.originalUrl}`,{candidateSessionId:connection.candidate(flowCookie(req),req.params.id)});
    if(result.teacher)return res.type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><title>RoomGoblin connected</title><h1>Schoology connection ready</h1><p>Students can now open this assignment without a RoomGoblin password. Use your existing teacher account to review the discussion.</p><a href="/learn/">Open teacher desk</a></html>');
    const secure=req.secure?'; Secure':'',embedded=connection.embedded(flowCookie(req));
    connection.signed(result.user,req.params.id,result.session.sessionId||store.sessionUser(result.session.token).sessionId,flowCookie(req));
    const cookies=[`${FLOW_COOKIE}=; Path=/learn/lti; HttpOnly; SameSite=None; Secure${embedded?'; Partitioned':''}; Max-Age=0`];
    if(result.session.token)cookies.unshift(`${LEARNING_COOKIE}=${result.session.token}; Path=/; HttpOnly; SameSite=${embedded?'None':'Lax'}${secure}${embedded?'; Partitioned':''}; Max-Age=28800`);
    res.setHeader('Set-Cookie',cookies);
    const activity=learning.activity(result.user,req.params.id);
    res.redirect(303,activity.template_id==='scorm-connector-v1'?'/learn/connect/?authenticated=1':'/learn/?lms=1&activity='+encodeURIComponent(req.params.id));
  }));
  app.use(api,requireLearning,rateLimit({windowMs:60000,limit:180,keyGenerator:req=>req.learner.id,standardHeaders:true,legacyHeaders:false}),(req,res,next)=>{
    if(["POST","PUT","PATCH","DELETE"].includes(req.method)){
      if(freezeRequested())return res.status(423).json({ok:false,error:"Backup in progress; try again shortly."});
      if(req.get("x-roomgoblin-learning")!=="1")return res.status(403).json({ok:false,error:"Learning request header required."});
      const supplied=req.get("origin");if(supplied&&!req.directLearner){try{if(new URL(supplied).host.toLowerCase()!==String(req.get("host")).toLowerCase())throw Error();}catch{return res.status(403).json({ok:false,error:"Cross-site learning request blocked."});}}
    }next();
  });
  app.put(api+'/teacher/activities/:id/direct-settings',requireTeacher,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);if(typeof req.body.enabled!=='boolean'||req.body.enabled&&!store.hasSecret(direct.key(req.params.id)))fail(400,'Download an API package before enabling this connection.');store.tx(()=>{store.setPreference(direct.key(req.params.id),{...direct.settings(req.params.id),enabled:req.body.enabled});learning.event(req.learner,req.params.id,'direct.settings',req.params.id,{enabled:req.body.enabled});});res.json({ok:true});}));
  app.get(api+'/teacher/classes',requireTeacher,wrap((req,res)=>res.json({ok:true,classes:portal.catalog(req.learner)})));
  app.post(api+'/teacher/classes/:id/assignments',requireTeacher,wrap((req,res)=>res.json({ok:true,id:portal.createAssignment(req.learner,req.params.id,req.body)})));
  app.put(api+'/teacher/connection-settings',requireAdministrator,wrap((req,res)=>{
    if(!req.body||!req.body.settings||typeof req.body.settings!=='object'||Array.isArray(req.body.settings))fail(400,'Load and enter the connection settings first.');
    const settings=require('./learning-platform').normalizeSettings(req.body.settings);
    const values=req.body.origins;if(!Array.isArray(values)||values.length>10)fail(400,'Use up to ten exact LMS origins.');
    const origins=values.map(origin);
    store.tx(()=>{platform.saveSettings(req.learner,settings);store.setPreference('learning.bridgeOrigins',origins);});
    res.json({ok:true,settings,origins});
  }));
  app.get(api+'/teacher/classes/:id',requireTeacher,wrap((req,res)=>res.json({ok:true,...portal.overview(req.learner,req.params.id)})));
  app.get(api+'/teacher/classes/:id/export',requireTeacher,wrap((req,res)=>{const data=portal.export(req.learner,req.params.id);res.setHeader('Content-Disposition','attachment; filename="RoomGoblin-submissions.csv"');res.type('text/csv').send(data);}));
  app.put(api+'/teacher/activities/:id/command',requireTeacher,wrap((req,res)=>res.json({ok:true,command:portal.saveCommand(req.learner,req.params.id,req.body)})));
  app.put(api+'/teacher/submissions/:id/review',requireTeacher,wrap((req,res)=>res.json({ok:true,review:portal.review(req.learner,Number(req.params.id),req.body)})));
  app.get(api+"/me",wrap((req,res)=>res.json({ok:true,user:{learnerKey:req.learner.id,alias:req.learner.displayName,lms:!!req.learner.learningSso,teacher:teacher(req.learner),admin:hasCapability(req.learner,"*")},classes:learning.classes(req.learner),activeClassId:teacher(req.learner)?schedule.visibleActiveClass(req.learner):null,case:CASE,cases:Object.values(CASES),assignmentDefinitions:{schemaVersion:1,kinds:['discussion','written']},aiConfigured:!!store.getPreference("learning.ai",{}).enabled,bridgeOrigins:store.getPreference("learning.bridgeOrigins",[])})));
  app.get(api+'/teacher/activities/:id/definition',requireTeacher,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);res.json({ok:true,definition:learning.definitions.get(req.params.id)});}));
  app.put(api+'/teacher/activities/:id/definition',requireTeacher,wrap((req,res)=>{const definition=store.tx(()=>{const d=learning.definitions.save(req.learner,req.params.id,req.body);if(d.kind==='written')learning.assignmentAI.configure(req.learner,req.params.id,{enabled:true,prompt:d.gradingInstructions,criteria:d.criteria.map(c=>({label:c.label,points:c.points,description:c.description}))});return d;});res.json({ok:true,definition});}));
  app.get(api+'/platform/settings',requireAdministrator,wrap((_req,res)=>res.json({ok:true,settings:platform.settings()})));
  app.put(api+'/platform/bridge-origins',requireAdministrator,wrap((req,res)=>{const values=req.body.origins;if(!Array.isArray(values)||values.length>10)fail(400,'Use up to ten exact LMS origins.');store.setPreference('learning.bridgeOrigins',values.map(origin));res.json({ok:true});}));
  app.post(api+'/platform/publish',requireAdministrator,wrap(async(_req,res)=>{if(!platformOptions?.publish)fail(503,'Public publishing is unavailable.');res.json(await platformOptions.publish());}));
  app.put(api+'/platform/settings',requireAdministrator,wrap((req,res)=>res.json({ok:true,settings:platform.saveSettings(req.learner,req.body)})));
  app.get(api+'/platform/options',requireTeacher,wrap((_req,res)=>res.json({ok:true,options:platform.options()})));
  app.get(api+'/platform/campaigns',requireTeacher,wrap((req,res)=>res.json({ok:true,campaigns:platform.arcade.list(req.learner)})));
  app.post(api+'/platform/campaigns',requireTeacher,wrap((req,res)=>res.json({ok:true,campaign:platform.arcade.configure(req.learner,req.body)})));
  app.put(api+'/platform/campaigns/:id/activities/:activityId',requireTeacher,wrap((req,res)=>{platform.arcade.bind(req.learner,req.params.activityId,req.params.id);res.json({ok:true});}));
  app.get(api+'/platform/tools',requireTeacher,wrap((_req,res)=>res.json({ok:true,tools:readTools(store)})));
  app.get(api+'/platform/schedule',requireAdministrator,wrap((req,res)=>res.json({ok:true,schedule:schedule.status(req.learner)})));
  app.put(api+'/platform/schedule',requireAdministrator,wrap((req,res)=>res.json({ok:true,schedule:schedule.configure(req.learner,req.body)})));
  app.put(api+'/platform/tools',requireAdministrator,wrap((req,res)=>{const tools=normalizeTools(req.body);store.setPreference(TOOLS_PREFERENCE,tools);learning.event(req.learner,null,'platform.tools',null);res.json({ok:true,tools});}));
  app.use(api+'/platform/activities/:id',(req,res,next)=>{try{if(isPublicRequest(req)&&!req.directLearner)connection.authorize(req.learner,req.params.id,req.get('x-roomgoblin-connection'));next();}catch(e){res.status(e.status||403).json({ok:false,error:e.message});}});
  app.get(api+'/platform/activities/:id/state',wrap((req,res)=>res.json({ok:true,...platform.state(req.learner,req.params.id)})));
  app.get(api+'/platform/activities/:id/grade-policy',requireTeacher,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);res.json({ok:true,policy:platform.grading.config(req.params.id)});}));
  app.put(api+'/platform/activities/:id/grade-policy',requireTeacher,wrap((req,res)=>res.json({ok:true,policy:platform.grading.configure(req.learner,req.params.id,req.body)})));
  app.put(api+'/platform/activities/:id/grade-override',requireTeacher,wrap((req,res)=>res.json(platform.grading.override(req.learner,req.params.id,req.body))));
  app.post(api+'/platform/activities/:id/grade-restore',requireTeacher,wrap((req,res)=>res.json(platform.grading.restoreRecorded(req.learner,req.params.id,req.body))));
  app.put(api+'/platform/activities/:id/config',requireTeacher,wrap((req,res)=>res.json({ok:true,config:platform.configure(req.learner,req.params.id,req.body)})));
  app.post(api+'/platform/activities/:id/events',wrap(async(req,res)=>res.json({ok:true,...await platform.record(req.learner,req.params.id,req.body,req)})));
  app.post(api+'/platform/activities/:id/presence',wrap((req,res)=>res.json({ok:true,...presence.challenge(req.learner,req.params.id,req.body.eventId)})));
  app.get(api+'/platform/classes/:id',requireTeacher,wrap((req,res)=>res.json({ok:true,...platform.session(req.learner,req.params.id),summary:platform.summary(req.learner,req.params.id)})));
  app.post(api+'/platform/classes/:id/insights',requireTeacher,wrap(async(req,res)=>res.json({ok:true,...await insights(req.learner,req.params.id)})));
  app.get(api+'/platform/activities/:id/config',requireTeacher,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);res.json({ok:true,config:platform.config(req.params.id)});}));
  app.post(api+'/platform/classes/:id/start',requireTeacher,wrap((req,res)=>res.json({ok:true,...platform.start(req.learner,req.params.id,req.body.minutes)})));
  app.post(api+'/platform/classes/:id/stop',requireTeacher,wrap((req,res)=>res.json({ok:true,...platform.stop(req.learner,req.params.id)})));
  app.post(api+'/platform/classes/:id/resume',requireTeacher,wrap((req,res)=>res.json({ok:true,...schedule.resume(req.learner,req.params.id)})));
  app.put(api+'/platform/classes/:id/attendance',requireTeacher,wrap((req,res)=>res.json({ok:true,...platform.admit(req.learner,req.params.id,req.body.userIds)})));
  app.post(api+'/platform/classes/:id/recipes',requireTeacher,wrap((req,res)=>res.json({ok:true,id:platform.saveRecipe(req.learner,req.params.id,req.body)})));
  app.post(api+'/logout',wrap((req,res)=>{store.deleteSession(learningCookie(req));res.setHeader('Set-Cookie',[`${LEARNING_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,`${LEARNING_COOKIE}=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0`]);res.json({ok:true});}));
  app.get(api+'/activities/:id/lti',requireAdministrator,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);res.json({ok:true,settings:lti.settings(req.params.id)});}));
  app.put(api+'/activities/:id/lti',requireAdministrator,wrap((req,res)=>res.json({ok:true,settings:lti.configure(req.learner,req.params.id,req.body)})));
  app.get(api+'/activities/:id/lti-package',requireTeacher,wrap((req,res)=>{const activity=learning.activity(req.learner,req.params.id,true);res.setHeader('Content-Disposition','attachment; filename="Subnet-Case-Files-Schoology-LTI.imscc"');res.type('application/zip').send(require('./learning-lti').createLtiPackage(activity,lti.config(activity.id).appOrigin||`${req.protocol}://${req.get('host')}`));}));
  app.post(api+'/activities/:id/lms-sync',wrap(async(req,res)=>{learning.activity(req.learner,req.params.id);res.json({ok:true,lms:await lti.sync(req.learner,req.params.id)});}));
  app.post(api+"/classes",requireTeacher,wrap((req,res)=>res.json({ok:true,id:learning.createClass(req.learner,req.body.title)})));
  app.get(api+"/classes/:id",wrap((req,res)=>{const m=learning.membership(req.learner,req.params.id);res.json({ok:true,activities:learning.db.prepare("SELECT * FROM learning_activities WHERE class_id=? ORDER BY created_at DESC").all(req.params.id),members:m.role==="teacher"?learning.db.prepare("SELECT m.*,u.username,CASE WHEN p.user_id IS NULL THEN 'Assigned account / signed LMS' ELSE 'API-reported identity' END identitySource FROM learning_members m JOIN users u ON u.id=m.user_id LEFT JOIN learning_direct_participants p ON p.user_id=m.user_id WHERE m.class_id=?").all(req.params.id):undefined});}));
  app.post(api+"/classes/:id/members",requireTeacher,wrap((req,res)=>{learning.enroll(req.learner,req.params.id,req.body,hasCapability(req.learner,"*"));res.json({ok:true});}));
  app.delete(api+"/classes/:id/members/:userId",requireTeacher,wrap((req,res)=>{learning.membership(req.learner,req.params.id,true);learning.db.prepare("DELETE FROM learning_members WHERE class_id=? AND user_id=? AND role='student'").run(req.params.id,req.params.userId);learning.event(req.learner,null,"member.remove",req.params.userId,{classId:req.params.id});res.json({ok:true});}));
  app.post(api+"/classes/:id/activities",requireTeacher,wrap((req,res)=>res.json({ok:true,id:learning.createActivity(req.learner,req.params.id,req.body)})));
  app.get(api+"/accounts",requireAdministrator,wrap((_req,res)=>res.json({ok:true,users:store.listUsers().filter(u=>u.enabled&&!direct.isParticipant(u.id)&&(u.profileId==="learning-student"||teacher(u))).map(u=>({id:u.id,username:u.username,enabled:u.enabled,role:u.profileId==="learning-student"?"student":"teacher"}))})));
  app.post(api+"/accounts",requireAdministrator,wrap((req,res)=>{if(store.listUsers().some(u=>u.username.toLowerCase()===String(req.body.username).toLowerCase()))fail(409,"Account already exists. Assign it to the class instead.");const u=store.putUser({username:text(req.body.username,80),displayName:text(req.body.alias,40),role:"viewer",profileId:"learning-student"},{password:req.body.password});res.json({ok:true,user:{id:u.id,username:u.username}});}));
  app.get(api+"/settings",requireAdministrator,wrap((_req,res)=>res.json({ok:true,ai:store.getPreference("learning.ai",{}),responseLabel:store.getPreference("learning.responseLabel","Teacher"),keyConfigured:store.hasSecret("learning.openai.key"),localKeyConfigured:store.hasSecret("learning.local.key"),bridgeOrigins:store.getPreference("learning.bridgeOrigins",[])})));
  app.put(api+"/settings",requireAdministrator,wrap((req,res)=>{
    const responseLabel=req.body.responseLabel===undefined?store.getPreference("learning.responseLabel","Teacher"):text(req.body.responseLabel,40);
    const provider=req.body.provider||"openai";if(!["openai","local","ollama"].includes(provider))fail(400,"Choose ollama, local, or openai.");let baseURL=null;if(provider!=="openai"){try{baseURL=localBaseURL(req.body.baseURL,provider);}catch(e){fail(400,e.message);}}
    const model=text(req.body.model,150);if(!/^[a-zA-Z0-9._:/-]+$/.test(model))fail(400,"Enter a model ID.");
    const origins=req.body.bridgeOrigins===undefined?store.getPreference('learning.bridgeOrigins',[]):req.body.bridgeOrigins;if(!Array.isArray(origins)||origins.length>10)fail(400,"Enter up to ten exact LMS origins.");const checked=origins.map(origin);
    const dailyLimit=Number(req.body.dailyLimit);if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>1000)fail(400,"Daily grading limit must be 1–1000.");
    store.tx(()=>{
    if(req.body.apiKey){const key=text(req.body.apiKey,500);if(/[\r\n]/.test(key))fail(400,"Invalid key.");store.putSecret(provider!=="openai"?"learning.local.key":"learning.openai.key",key,{purpose:"learning-grading"});}
    if(req.body.enabled===true&&provider==="openai"&&!store.hasSecret("learning.openai.key"))fail(400,"Configure the server-side grading key first.");
    store.setPreference("learning.ai",{enabled:req.body.enabled===true,provider,baseURL,model,dailyLimit,autonomous:req.body.autonomous!==false});store.setPreference("learning.bridgeOrigins",checked);store.setPreference("learning.responseLabel",responseLabel);learning.event(req.learner,null,"grading.settings",null,{provider,enabled:req.body.enabled===true});});res.json({ok:true});
  }));
  app.get(api+"/activities/:id",wrap((req,res)=>{const a=learning.activity(req.learner,req.params.id);res.json({ok:true,activity:{...a,case:learning.caseForActivity(a),definition:toCase(learning.definitions.get(a.id))},posts:learning.posts(req.learner,a.id),review:learning.currentReview(req.learner,a.id),commentHistory:{schemaVersion:1},gradingQueued:!!learning.db.prepare('SELECT 1 FROM learning_grading_pending WHERE activity_id=? AND user_id=?').get(a.id,req.learner.id),lms:lti.status(req.learner,a.id)});}));
  // LMS names are optional display data, never an authentication or enrollment claim.
  app.put(api+"/activities/:id/lms-name",wrap((req,res)=>{
    const a=learning.activity(req.learner,req.params.id);
    if(a.member.role!=="student"||req.learner.learningSso)fail(403,"Only an unsigned student display name can be updated.");
    const launcher=origin(req.body.launcherOrigin);
    if(!store.getPreference("learning.bridgeOrigins",[]).includes(launcher))fail(403,"The LMS launcher origin is not configured.");
    const supplied=text(req.body.name,255);
    if(/[<>\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(supplied))fail(400,"The LMS name contains unsupported characters.");
    const name=supplied.replace(/\s+/gu," ");
    if(name!==a.member.alias)store.tx(()=>{learning.db.prepare("UPDATE learning_members SET alias=? WHERE class_id=? AND user_id=? AND role='student'").run(name,a.class_id,req.learner.id);learning.event(req.learner,a.id,"member.lms-name",req.learner.id);});
    res.json({ok:true,name});
  }));
  app.put(api+"/activities/:id",requireTeacher,wrap((req,res)=>{learning.settings(req.learner,req.params.id,req.body);res.json({ok:true});}));
  app.post(api+"/activities/:id/posts",wrap(async(req,res)=>{
    const id=learning.post(req.learner,req.params.id,req.body);
    if(learning.activity(req.learner,req.params.id).member.role!=="student"||!learning.isScoredPost(req.learner,req.params.id,id))return res.json({ok:true,id});
    const reply=learning.latestScoredReply(req.learner,req.params.id);
    await acceptWriting({...req,body:{replyId:reply?.id||null}}, {json:value=>res.json({...value,id}),status:status=>({json:value=>res.json({ok:true,id,gradingPending:status===503,retryable:status===503,gradingMessage:value.error})})});
  }));
  app.put(api+"/activities/:id/posts/:postId",wrap(async(req,res)=>{const changed=learning.edit(req.learner,req.params.id,req.params.postId,req.body);if(!changed||!learning.isScoredPost(req.learner,req.params.id,req.params.postId))return res.json({ok:true});const reply=learning.latestScoredReply(req.learner,req.params.id);await acceptWriting({...req,body:{replyId:reply?.id||null}}, {json:value=>res.json(value),status:status=>({json:value=>res.json({ok:true,gradingPending:status===503,retryable:status===503,gradingMessage:value.error})})});}));
  app.put(api+"/activities/:id/posts/:postId/moderation",requireTeacher,wrap((req,res)=>{learning.moderate(req.learner,req.params.id,req.params.postId,req.body.hidden===true);res.json({ok:true});}));
  app.put(api+"/activities/:id/posts/:postId/teacher-edit",requireTeacher,wrap((req,res)=>{learning.editInstructor(req.learner,req.params.id,req.params.postId,req.body);res.json({ok:true});}));
  app.get(api+'/activities/:id/posts/:postId/history',wrap((req,res)=>res.json({ok:true,...learning.postHistory.list(req.learner,req.params.id,req.params.postId,req.query.beforeRevision)})));
  const submitWriting=wrap(async(req,res)=>{
    const user=req.learner,a=learning.activity(user,req.params.id);learning.writable(a,req[queued]?Date.parse(req[queued].acceptedAt):Date.now());if(a.member.role!=="student")fail(403,"Only a student can submit for grading.");
    const replyId=req.body.replyId===undefined?learning.latestScoredReply(user,a.id)?.id:req.body.replyId;
    const snapshot=learning.snapshot(user,a.id,replyId),fingerprint=hash(snapshot);
    if(req[queued]&&fingerprint!==req[queued].fingerprint)fail(409,"The queued writing changed.");
    const cfg=store.getPreference("learning.ai",{}),local=["local","ollama"].includes(cfg.provider),acceptedAt=req[queued]?.acceptedAt||now();
    const last=learning.db.prepare("SELECT * FROM learning_reviews WHERE activity_id=? AND user_id=? ORDER BY rowid DESC LIMIT 1").get(a.id,user.id);
    if(last&&last.fingerprint===fingerprint&&["grading","needs_review","approved"].includes(last.status)){await lti.sync(user,a.id);return res.json({ok:true,review:learning.projectReview(last)});}
    const waiting=learning.db.prepare('SELECT * FROM learning_grading_pending WHERE activity_id=? AND user_id=? AND fingerprint=?').get(a.id,user.id,fingerprint);
    if(!req[queued]&&waiting&&waiting.ready_at>Date.now())fail(503,'Writing is saved; its automatic retry is scheduled.');
    if(cfg.enabled&&(busy.size>=(local?1:2)||busy.has(user.id)||local&&Date.now()<nextLocalReviewAt)){
      if(!retryQueue.enqueue({activityId:a.id,userId:user.id,fingerprint,replyId,acceptedAt}))fail(429,"The grading queue is full. Your writing is saved for teacher review.");
      fail(503,"Writing saved and queued for automatic grading.");
    }
    const since=new Date(Date.now()-86400000).toISOString();
    if(learning.db.prepare("SELECT COUNT(*) n FROM learning_reviews WHERE user_id=? AND COALESCE(started_at,created_at)>?").get(user.id,since).n+(learning.assignmentAI?.startedSince(since,user.id)||0)>=5)fail(429,"Daily grading request limit reached. Ask your teacher to review the saved work.");
    if(learning.modelBudget.usedSince(since)>=(cfg.dailyLimit||100))fail(429,"The automatic grading budget is reached. Your teacher can review the saved work.");
    const id=crypto.randomUUID(),time=acceptedAt,enabled=cfg.enabled&&(["local","ollama"].includes(cfg.provider)||store.hasSecret("learning.openai.key"));
    learning.db.prepare("INSERT INTO learning_reviews(id,activity_id,user_id,fingerprint,snapshot_json,status,model,created_at,updated_at,started_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,a.id,user.id,fingerprint,JSON.stringify(snapshot),enabled?"grading":"unavailable",enabled?cfg.model:null,time,now(),now());
    retryQueue.remove({activityId:a.id,userId:user.id,fingerprint});
    learning.event(user,a.id,"grade.request",id);busy.add(user.id);
    let retryScheduled=false;
    try{
      if(enabled){const definition=learning.definitions.get(a.id);
        const feedbackPosts=definition?.kind==='discussion'?(snapshot.mainPostIds||[]).filter(parentId=>!learning.db.prepare("SELECT 1 FROM learning_posts WHERE activity_id=? AND parent_id=? AND kind='ai' UNION ALL SELECT 1 FROM learning_events WHERE activity_id=? AND record_id=? AND kind='coach.skipped' LIMIT 1").get(a.id,parentId,a.id,parentId)).map(postId=>({id:postId,body:learning.db.prepare('SELECT body FROM learning_posts WHERE id=?').get(postId).body})):[];
        const result=await grade({apiKey:store.getSecret(["local","ollama"].includes(cfg.provider)?"learning.local.key":"learning.openai.key"),provider:cfg.provider||"openai",baseURL:cfg.baseURL,model:cfg.model,templateId:a.template_id,definition,initial:snapshot.initial,reply:snapshot.reply,parent:snapshot.parent,feedbackPosts,consumeModelBudget:()=>{const current=store.getPreference("learning.ai",{});if(!current.enabled||["provider","baseURL","model"].some(k=>current[k]!==cfg[k]))throw Error("The grading service changed during assessment.");learning.modelBudget.reserve(id,user.id,current.dailyLimit??100);}});const validated=validateGrade({criteria:result.criteria,summary:result.summary},a.template_id,definition);if(!snapshot.reply){validated.criteria.reply={points:0,feedback:"No reply was submitted."};validated.total=Object.values(validated.criteria).reduce((n,c)=>n+c.points,0);}
        const still=store.listUsers().find(u=>u.id===user.id&&u.enabled);if(!still)fail(409,"Account no longer active.");learning.membership(still,a.class_id);
        const currentCfg=store.getPreference("learning.ai",{});
        if(!currentCfg.enabled||["provider","baseURL","model"].some(key=>currentCfg[key]!==cfg[key]))fail(409,"The grading service changed during this assessment.");
        if(hash(learning.snapshot(user,a.id,snapshot.replyId))!==fingerprint)fail(409,"Writing changed during grading.");
        const newer=learning.db.prepare('SELECT fingerprint FROM learning_grading_pending WHERE activity_id=? AND user_id=?').get(a.id,user.id);
        if(newer&&newer.fingerprint!==fingerprint)fail(409,'A newer reply selection is waiting for assessment.');
        learning.store.tx(()=>{
          const changed=learning.db.prepare("UPDATE learning_reviews SET status='needs_review',ai_json=?,updated_at=? WHERE id=? AND status='grading'").run(JSON.stringify({...validated,proposedResponse:result.coachResponse,evidenceSelection:result.evidenceSelection}),now(),id).changes;
          if(!changed)return;
          if(typeof result.coachResponse!=="string"||!result.coachResponse.trim()||result.coachResponse.length>1800)throw Error("Invalid coach output");
          const stamp=now();
          if(currentCfg.autonomous!==false){
            for(const parentId of snapshot.mainPostIds||[snapshot.initialId]){
              // Regrading updates private scores, never adds another automatic
              // comment to the same main post and never comments on replies.
              if(learning.db.prepare("SELECT 1 FROM learning_posts WHERE activity_id=? AND parent_id=? AND kind='ai' LIMIT 1").get(a.id,parentId))continue;
              if(definition?.kind==='discussion'){
                if(!feedbackPosts.some(p=>p.id===parentId))continue;
                if(result.commentDecisions?.[parentId]!=='related'){learning.event(user,a.id,'coach.skipped',parentId,{reviewId:id,reason:'relevance-not-confirmed'});continue;}
              }
              const coachId=crypto.randomUUID();
              learning.db.prepare("INSERT INTO learning_posts(id,activity_id,user_id,parent_id,kind,body,created_at,updated_at) VALUES(?,?,?,?,'ai',?,?,?)").run(coachId,a.id,user.id,parentId,result.coachResponse,stamp,stamp);
              learning.event(user,a.id,"coach.automated",coachId,{reviewId:id});
            }
            const currentActivity=learning.activity(user,a.id),member=currentActivity.member;
            const late=!!(currentActivity.due_at&&Date.parse(time)>Date.parse(currentActivity.due_at)&&!member.exempt);
            const final={...validated,earned:validated.total,lateMultiplier:late?.5:1,total:validated.total*(late?.5:1),possible:learning.caseForActivity(a).points,approvedAt:stamp,source:"ai"};
            learning.db.prepare("UPDATE learning_reviews SET status='approved',final_json=?,updated_at=? WHERE id=?").run(JSON.stringify(final),stamp,id);
            learning.event(user,a.id,"grade.automated",id,{earned:validated.total,total:final.total});
          }
        });
      }
    }catch(error){
      learning.db.prepare("UPDATE learning_reviews SET status='unavailable',updated_at=?,ai_json=COALESCE(?,ai_json) WHERE id=? AND status='grading'").run(now(),error.code==='LEARNING_MODEL_BUDGET'?JSON.stringify({budgetExceeded:true}):null,id);
      const attempts=req[queued]?.attempts||0;
      if(error.retryable===true&&attempts<2&&store.getPreference('learning.ai',{}).enabled)retryScheduled=retryQueue.enqueue({activityId:a.id,userId:user.id,fingerprint,replyId,acceptedAt,attempts:attempts+1,delayMs:60000});
    }finally{busy.delete(user.id);if(local)nextLocalReviewAt=Date.now()+(reviewOptions.cooldownMs??60000);}
    await lti.sync(user,a.id);res.json({ok:true,review:learning.currentReview(user,a.id),gradingPending:retryScheduled,retryable:retryScheduled});
  });
  const acceptWriting=wrap(async(req,res)=>{
    const user=req.learner,a=learning.activity(user,req.params.id);learning.writable(a);if(a.member.role!=='student')fail(403,'Only a student can submit for grading.');
    const replyId=req.body.replyId===undefined?learning.latestScoredReply(user,a.id)?.id:req.body.replyId;
    const snapshot=learning.snapshot(user,a.id,replyId),fingerprint=hash(snapshot),current=learning.currentReview(user,a.id);
    const previous=learning.db.prepare('SELECT fingerprint FROM learning_reviews WHERE activity_id=? AND user_id=? ORDER BY rowid DESC LIMIT 1').get(a.id,user.id);
    if(current&&previous?.fingerprint===fingerprint&&['grading','approved','needs_review'].includes(current.status))return res.json({ok:true,review:current,gradingPending:current.status==='grading'});
    if(!store.getPreference('learning.ai',{}).enabled)return submitWriting(req,res);
    if(!retryQueue.enqueue({activityId:a.id,userId:user.id,fingerprint,replyId,acceptedAt:now()}))fail(429,'The grading queue is full. Your writing is saved for teacher review.');
    res.json({ok:true,review:current,gradingPending:true,retryable:false});
  });
  app.post(api+"/activities/:id/submit",acceptWriting);
  app.get(api+"/activities/:id/reviews",requireTeacher,wrap((req,res)=>{const a=learning.activity(req.learner,req.params.id,true);res.json({ok:true,reviews:learning.db.prepare("SELECT r.*,m.alias FROM learning_reviews r JOIN learning_members m ON m.user_id=r.user_id AND m.class_id=? WHERE r.activity_id=? AND r.rowid IN (SELECT MAX(rowid) FROM learning_reviews WHERE activity_id=? GROUP BY user_id) ORDER BY r.created_at LIMIT 200").all(a.class_id,a.id,a.id).map(r=>({...learning.projectReview(r),alias:r.alias,snapshot:parse(r.snapshot_json)}))});}));
  app.post(api+"/activities/:id/reviews/:reviewId/approve",requireTeacher,wrap(async(req,res)=>{const grade=learning.approve(req.learner,req.params.id,req.params.reviewId,req.body),row=learning.db.prepare("SELECT user_id FROM learning_reviews WHERE id=?").get(req.params.reviewId),user=store.listUsers().find(u=>u.id===row.user_id);await lti.sync(user,req.params.id);res.json({ok:true,grade});}));
  app.get(api+"/activities/:id/receipt",wrap((req,res)=>{const r=learning.currentReview(req.learner,req.params.id);if(!r||r.status!=="approved")fail(409,"A published grade is not available yet.");res.json({ok:true,activityId:req.params.id,reviewId:r.id,score:r.final.total,possible:r.final.possible,raw:r.final.total*100/r.final.possible,approvedAt:r.final.approvedAt});}));
  const assignmentAI=new(require('./learning-assignment-ai').AssignmentAI)(learning,{available:()=>!freezeRequested()&&!reviewOptions.isStopping?.()&&!!store.getPreference('learning.ai',{}).enabled,track:reviewOptions.track||((p)=>p),busy,modelJSON:reviewOptions.assignmentModelJSON||require('./learning-grader').modelJSON,intervalMs:reviewOptions.intervalMs??5000});learning.assignmentAI=assignmentAI;
  app.get(api+'/teacher/activities/:id/ai-policy',requireTeacher,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);res.json({ok:true,policy:assignmentAI.policy(req.params.id)});}));
  app.put(api+'/teacher/activities/:id/ai-policy',requireTeacher,wrap((req,res)=>res.json({ok:true,policy:assignmentAI.configure(req.learner,req.params.id,req.body)})));
  if(publicDir)app.post(api+'/teacher/activities/:id/direct-package',requireTeacher,wrap((req,res)=>{
    const zip=store.tx(()=>{const activity=learning.activity(req.learner,req.params.id,true),key=direct.issue(req.learner,activity.id);
      if(!platform.config(activity.id))platform.configure(req.learner,activity.id,{points:activity.template_id==='scorm-connector-v1'?50:20});
      const settings=platform.settings(),base=origin(settings.publicOrigin||`${req.protocol}://${req.get('host')}`);
      if(!['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname)&&(!settings.publicEnabled||!settings.publicOrigin))fail(409,'Publish the student Assignment API before downloading a direct package.');
      return require('./learning-direct-package').createPackage(activity,{origin:base,enrollmentKey:key,prompt:assignmentAI.policy(activity.id).prompt},publicDir,learning.definitions.get(activity.id));
    });
    res.setHeader('Content-Disposition','attachment; filename="RoomGoblin-Direct-Assignment.zip"');res.type('application/zip').send(zip);
  }));
  app.get(api+"/activities/:id/scorm",requireTeacher,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);res.status(410).json({ok:false,error:'The old launcher has been removed. Download a direct API package from /learn.'});}));
  retryQueue=new(require('./learning-retry-queue').LearningRetryQueue)(learning.db,{
    intervalMs:reviewOptions.intervalMs??5000,
    available:()=>!freezeRequested()&&!reviewOptions.isStopping?.()&&!!store.getPreference('learning.ai',{}).enabled,
    track:reviewOptions.track||((task)=>task),
    run:async job=>{
      const user=store.listUsers().find(u=>u.id===job.userId&&u.enabled);if(!user)return 'discard';
      let status=200,requeued=false;
      await submitWriting({learner:user,params:{id:job.activityId},body:{replyId:job.replyId},[queued]:job},{json:value=>{requeued=value.retryable===true;},status:code=>{status=code;return {json:()=>{}};}});
      return status===503?'busy':status===429?'budget':requeued?'requeued':'done';
    }
  });
  const writingClose=retryQueue.close.bind(retryQueue),writingDrain=retryQueue.drain.bind(retryQueue);retryQueue.close=()=>{assignmentAI.close();writingClose();};retryQueue.drain=async()=>{await writingDrain();await assignmentAI.drain();};
  learning.reviewQueue=retryQueue;
  return learning;
}
module.exports={LearningStore,registerLearning,restrictedStudentGate,hash,origin};
