"use strict";

const crypto=require("node:crypto");
const {rateLimit}=require("express-rate-limit");
const {CASE,RUBRIC,validateGrade,gradeWriting,localBaseURL}=require("./learning-grader");
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
      CREATE UNIQUE INDEX IF NOT EXISTS learning_one_initial ON learning_posts(activity_id,user_id) WHERE kind='initial';
      CREATE INDEX IF NOT EXISTS learning_post_feed ON learning_posts(activity_id,created_at);
      CREATE TABLE IF NOT EXISTS learning_reviews(id TEXT PRIMARY KEY,activity_id TEXT NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL,snapshot_json TEXT NOT NULL,status TEXT NOT NULL,ai_json TEXT,final_json TEXT,reviewer_id TEXT REFERENCES users(id),model TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS learning_review_user ON learning_reviews(activity_id,user_id,created_at);
      CREATE TABLE IF NOT EXISTS learning_events(id INTEGER PRIMARY KEY,at TEXT NOT NULL,actor_id TEXT,activity_id TEXT,kind TEXT NOT NULL,record_id TEXT,details_json TEXT NOT NULL);
    `);
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
  activity(user,id,teacher=false){const row=this.db.prepare("SELECT * FROM learning_activities WHERE id=?").get(id);if(!row)fail(404,"Assigned activity not found.");return {...row,member:this.membership(user,row.class_id,teacher)};}
  writable(a){if(a.member.role==="student"&&(!a.open||a.close_at&&Date.now()>=Date.parse(a.close_at)&&!a.member.exempt))fail(409,"This activity is closed. Ask your teacher about an approved exception.");}
  classes(user){return this.db.prepare("SELECT c.*,m.role,m.alias FROM learning_classes c JOIN learning_members m ON m.class_id=c.id WHERE m.user_id=? ORDER BY c.created_at DESC").all(user.id);}
  createClass(user,title){const id=crypto.randomUUID();this.store.tx(()=>{this.db.prepare("INSERT INTO learning_classes VALUES(?,?,?)").run(id,text(title,100),now());this.db.prepare("INSERT INTO learning_members(class_id,user_id,role,alias) VALUES(?,?,?,?)").run(id,user.id,"teacher",text(user.displayName||"Teacher",40));});return id;}
  enroll(user,classId,input,allowTeacher=false){
    this.membership(user,classId,true);const target=this.store.listUsers().find(x=>x.id===input.userId&&x.enabled);
    if(!target)fail(400,"Enabled account not found.");
    const role=input.role==="teacher"?"teacher":"student";
    if(role==="teacher"?(!allowTeacher||target.profileId==="learning-student"||!["operator","admin"].includes(target.role)):target.profileId!=="learning-student")fail(400,"Select an eligible account. Only administrators may assign another teacher.");
    this.db.prepare("INSERT INTO learning_members(class_id,user_id,role,alias,exempt) VALUES(?,?,?,?,?) ON CONFLICT(class_id,user_id) DO UPDATE SET alias=excluded.alias,exempt=excluded.exempt,role=excluded.role").run(classId,target.id,role,text(input.alias,40),input.exempt===true?1:0);
    this.event(user,null,"member.assign",target.id,{classId,exempt:input.exempt===true});
  }
  createActivity(user,classId,input){this.membership(user,classId,true);const id=crypto.randomUUID();this.db.prepare("INSERT INTO learning_activities(id,class_id,title,template_id,created_at) VALUES(?,?,?,?,?)").run(id,classId,text(input.title||CASE.title,120),CASE.id,now());this.event(user,id,"activity.create",id);return id;}
  settings(user,id,input){const a=this.activity(user,id,true),due=isoDate(input.dueAt),close=isoDate(input.closeAt);if(due&&close&&Date.parse(close)<=Date.parse(due))fail(400,"Close time must follow due time.");this.db.prepare("UPDATE learning_activities SET open=?,due_at=?,close_at=? WHERE id=?").run(input.open===true?1:0,due,close,a.id);this.event(user,id,"activity.settings",id,{open:input.open===true,due,close});}
  posts(user,id){
    const a=this.activity(user,id);const rows=this.db.prepare("SELECT p.*,m.alias,m.role FROM learning_posts p JOIN learning_members m ON m.user_id=p.user_id AND m.class_id=? WHERE p.activity_id=? ORDER BY p.created_at,p.id LIMIT 1000").all(a.class_id,id);
    return rows.filter(p=>a.member.role==="teacher"||!p.hidden&&(!p.parent_id||!rows.find(x=>x.id===p.parent_id)?.hidden)).map(p=>({id:p.id,parentId:p.parent_id,kind:p.kind,body:p.body,alias:p.kind==="ai"?"Mr. Wagner":p.alias,role:p.kind==="ai"?"ai":p.role,mine:p.user_id===user.id,revision:p.revision,hidden:!!p.hidden,createdAt:p.created_at,...(a.member.role==="teacher"?{userId:p.user_id}:{})}));
  }
  post(user,id,input){
    const a=this.activity(user,id);this.writable(a);const teacher=a.member.role==="teacher";
    const kind=teacher?"teacher":input.kind;
    if(!(teacher?["teacher"]:["initial","reply","critique"]).includes(kind))fail(400,"Choose a post type.");
    const body=text(input.body,kind==="initial"?6000:3000),parentId=input.parentId||null;
    if(parentId){const p=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND hidden=0").get(parentId,id);if(!p||p.parent_id||p.kind!=="initial")fail(400,"Choose a visible initial post.");if(!teacher&&p.user_id===user.id)fail(400,"Reply to a classmate, not your own post.");}
    if(kind==="reply"&&!parentId)fail(400,"Choose a classmate's post.");
    if(["initial","critique"].includes(kind)&&parentId)fail(400,"This post type cannot have a parent.");
    if(kind==="critique"&&this.db.prepare("SELECT 1 FROM learning_posts WHERE activity_id=? AND kind='initial' AND hidden=0 AND user_id<>?").get(id,user.id))fail(409,"A peer post is available. Respond to a classmate.");
    if(this.db.prepare("SELECT COUNT(*) n FROM learning_posts WHERE activity_id=? AND user_id=?").get(id,user.id).n>=30)fail(429,"Post limit reached. Revise an existing post or ask your teacher.");
    if(kind==="initial"&&this.db.prepare("SELECT 1 FROM learning_posts WHERE activity_id=? AND user_id=? AND kind='initial'").get(id,user.id))fail(409,"Revise your existing initial post.");
    const postId=crypto.randomUUID(),time=now();this.db.prepare("INSERT INTO learning_posts(id,activity_id,user_id,parent_id,kind,body,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").run(postId,id,user.id,parentId,kind,body,time,time);this.event(user,id,"post.create",postId);return postId;
  }
  edit(user,id,postId,input){
    const a=this.activity(user,id);this.writable(a);const p=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND user_id=? AND hidden=0 AND kind IN ('initial','reply','critique')").get(postId,id,user.id);if(!p)fail(404,"Your editable post was not found.");
    if(input.revision!==p.revision)fail(409,"This post changed. Refresh before editing.");
    this.db.prepare("UPDATE learning_posts SET body=?,revision=revision+1,updated_at=? WHERE id=?").run(text(input.body,p.kind==="initial"?6000:3000),now(),p.id);
    this.db.prepare("UPDATE learning_reviews SET status='superseded',updated_at=? WHERE activity_id=? AND user_id=? AND status<>'superseded'").run(now(),id,user.id);this.event(user,id,"post.edit",p.id,{revision:p.revision+1});
  }
  moderate(user,id,postId,hidden){this.activity(user,id,true);const p=this.db.prepare("SELECT * FROM learning_posts WHERE activity_id=? AND id=?").get(id,postId);if(!p)fail(404,"Post not found.");this.db.prepare("UPDATE learning_posts SET hidden=? WHERE id=?").run(hidden?1:0,p.id);this.event(user,id,"post.moderate",p.id,{hidden});}
  snapshot(user,id,replyId){
    const initial=this.db.prepare("SELECT * FROM learning_posts WHERE activity_id=? AND user_id=? AND kind='initial' AND hidden=0").get(id,user.id);if(!initial)fail(400,"Publish your initial explanation first.");
    let reply=null,parent=null;
    if(replyId){reply=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND user_id=? AND kind IN ('reply','critique') AND hidden=0").get(replyId,id,user.id);if(!reply)fail(400,"Choose your own reply or independent critique.");if(reply.parent_id){parent=this.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND kind='initial' AND hidden=0").get(reply.parent_id,id);if(!parent)fail(409,"The peer post is no longer available. Choose another reply.");}}
    return {initial:initial.body,initialId:initial.id,initialRevision:initial.revision,reply:reply?.body||"",replyId:reply?.id||null,replyRevision:reply?.revision||0,parent:parent?.body||(reply?.kind==="critique"?CASE.alternate:""),parentId:parent?.id||null,parentRevision:parent?.revision||0};
  }
  currentReview(user,id){this.activity(user,id);const r=this.db.prepare("SELECT * FROM learning_reviews WHERE activity_id=? AND user_id=? ORDER BY rowid DESC LIMIT 1").get(id,user.id);if(!r)return null;try{if(hash(this.snapshot(user,id,parse(r.snapshot_json).replyId))!==r.fingerprint)return {...this.projectReview(r),status:"superseded",final:null};}catch{return {...this.projectReview(r),status:"superseded",final:null};}return this.projectReview(r);}
  projectReview(r){return {id:r.id,status:r.status,replyId:parse(r.snapshot_json).replyId,automated:!!parse(r.final_json)&&parse(r.final_json).source==="ai",createdAt:r.created_at,updatedAt:r.updated_at,ai:parse(r.ai_json),final:parse(r.final_json)};}
  approve(user,id,reviewId,input){
    const a=this.activity(user,id,true),r=this.db.prepare("SELECT * FROM learning_reviews WHERE id=? AND activity_id=?").get(reviewId,id);if(!r)fail(404,"Review not found.");if(!["needs_review","unavailable","approved"].includes(r.status))fail(409,"Refresh and select a pending review.");
    const target=this.store.listUsers().find(x=>x.id===r.user_id&&x.enabled);if(!target)fail(409,"Learner account is disabled.");this.membership(target,a.class_id);
    const snap=parse(r.snapshot_json);if(hash(this.snapshot(target,id,snap.replyId))!==r.fingerprint)fail(409,"The writing changed. Request a fresh review.");
    let grade;try{grade=validateGrade({criteria:input.criteria,summary:input.summary});}catch{fail(400,"Use the listed rubric scores and feedback limits.");}const member=this.membership(target,a.class_id),late=!!(a.due_at&&Date.parse(r.created_at)>Date.parse(a.due_at)&&!member.exempt&&input.waiveLate!==true);
    const final={...grade,earned:grade.total,lateMultiplier:late?.5:1,total:grade.total*(late?.5:1),possible:20,approvedAt:now(),source:"teacher"};
    this.db.prepare("UPDATE learning_reviews SET final_json=?,status='approved',reviewer_id=?,updated_at=? WHERE id=?").run(JSON.stringify(final),user.id,now(),r.id);this.event(user,id,"grade.approve",r.id,{earned:grade.total,total:final.total,waiveLate:input.waiveLate===true});return final;
  }
}

function restrictedStudentGate(req,res,next){
  if(req.authUser?.profileId!=="learning-student")return next();
  const allowed=/^\/api\/v1\/learning(?:\/|$)/.test(req.path)||/^\/api\/v1\/auth\/(?:status|me|login|logout|change-password|sessions|logout-others)$/.test(req.path)||/^\/learn(?:\/|$)/.test(req.path)||req.path==="/favicon.ico";
  return allowed?next():res.status(403).json({ok:false,error:"Student accounts can access assigned learning activities only."});
}

function registerLearning(app,{store,requestUser,hasCapability,grade=gradeWriting,freezeRequested=()=>false,publicDir}){
  const learning=new LearningStore(store),busy=new Set();
  const wrap=fn=>async(req,res,next)=>{try{await fn(req,res,next);}catch(e){res.status(e.status||500).json({ok:false,error:e.status?e.message:"Learning service could not complete the request."});}};
  const teacher=u=>u.profileId!=="learning-student"&&(hasCapability(u,"*")||hasCapability(u,"classroom.control"));
  const api="/api/v1/learning";
  const requireLearning=(req,res,next)=>{const u=requestUser(req);if(!store.authEnabled()||!u)return res.status(401).json({ok:false,error:"Sign in to your assigned RoomGoblin account."});if(!teacher(u)&&!hasCapability(u,"learning.participate"))return res.status(403).json({ok:false,error:"Learning access is not enabled."});req.learner=u;res.setHeader("Cache-Control","no-store");next();};
  const requireTeacher=(req,res,next)=>teacher(req.learner)?next():res.status(403).json({ok:false,error:"Teacher access required."});
  const requireAdministrator=(req,res,next)=>hasCapability(req.learner,"*")?next():res.status(403).json({ok:false,error:"Administrator access required."});
  app.use(api,requireLearning,rateLimit({windowMs:60000,limit:180,keyGenerator:req=>req.learner.id,standardHeaders:true,legacyHeaders:false}),(req,res,next)=>{
    if(["POST","PUT","PATCH","DELETE"].includes(req.method)){
      if(freezeRequested())return res.status(423).json({ok:false,error:"Backup in progress; try again shortly."});
      if(req.get("x-roomgoblin-learning")!=="1")return res.status(403).json({ok:false,error:"Learning request header required."});
      const supplied=req.get("origin");if(supplied){try{if(new URL(supplied).host.toLowerCase()!==String(req.get("host")).toLowerCase())throw Error();}catch{return res.status(403).json({ok:false,error:"Cross-site learning request blocked."});}}
    }next();
  });
  app.get(api+"/me",wrap((req,res)=>res.json({ok:true,user:{alias:req.learner.displayName,teacher:teacher(req.learner),admin:hasCapability(req.learner,"*")},classes:learning.classes(req.learner),case:CASE,aiConfigured:!!store.getPreference("learning.ai",{}).enabled,bridgeOrigins:store.getPreference("learning.bridgeOrigins",[])})));
  app.post(api+"/classes",requireTeacher,wrap((req,res)=>res.json({ok:true,id:learning.createClass(req.learner,req.body.title)})));
  app.get(api+"/classes/:id",wrap((req,res)=>{const m=learning.membership(req.learner,req.params.id);res.json({ok:true,activities:learning.db.prepare("SELECT * FROM learning_activities WHERE class_id=? ORDER BY created_at DESC").all(req.params.id),members:m.role==="teacher"?learning.db.prepare("SELECT m.*,u.username FROM learning_members m JOIN users u ON u.id=m.user_id WHERE m.class_id=?").all(req.params.id):undefined});}));
  app.post(api+"/classes/:id/members",requireTeacher,wrap((req,res)=>{learning.enroll(req.learner,req.params.id,req.body,hasCapability(req.learner,"*"));res.json({ok:true});}));
  app.delete(api+"/classes/:id/members/:userId",requireTeacher,wrap((req,res)=>{learning.membership(req.learner,req.params.id,true);learning.db.prepare("DELETE FROM learning_members WHERE class_id=? AND user_id=? AND role='student'").run(req.params.id,req.params.userId);learning.event(req.learner,null,"member.remove",req.params.userId,{classId:req.params.id});res.json({ok:true});}));
  app.post(api+"/classes/:id/activities",requireTeacher,wrap((req,res)=>res.json({ok:true,id:learning.createActivity(req.learner,req.params.id,req.body)})));
  app.get(api+"/accounts",requireAdministrator,wrap((_req,res)=>res.json({ok:true,users:store.listUsers().filter(u=>u.enabled&&(u.profileId==="learning-student"||teacher(u))).map(u=>({id:u.id,username:u.username,enabled:u.enabled,role:u.profileId==="learning-student"?"student":"teacher"}))})));
  app.post(api+"/accounts",requireAdministrator,wrap((req,res)=>{if(store.listUsers().some(u=>u.username.toLowerCase()===String(req.body.username).toLowerCase()))fail(409,"Account already exists. Assign it to the class instead.");const u=store.putUser({username:text(req.body.username,80),displayName:text(req.body.alias,40),role:"viewer",profileId:"learning-student"},{password:req.body.password});res.json({ok:true,user:{id:u.id,username:u.username}});}));
  app.get(api+"/settings",requireAdministrator,wrap((_req,res)=>res.json({ok:true,ai:store.getPreference("learning.ai",{}),keyConfigured:store.hasSecret("learning.openai.key"),localKeyConfigured:store.hasSecret("learning.local.key"),bridgeOrigins:store.getPreference("learning.bridgeOrigins",[])})));
  app.put(api+"/settings",requireAdministrator,wrap((req,res)=>{
    const provider=req.body.provider||"openai";if(!["openai","local","ollama"].includes(provider))fail(400,"Choose ollama, local, or openai.");let baseURL=null;if(provider!=="openai"){try{baseURL=localBaseURL(req.body.baseURL,provider);}catch(e){fail(400,e.message);}}
    const model=text(req.body.model,150);if(!/^[a-zA-Z0-9._:/-]+$/.test(model))fail(400,"Enter a model ID.");
    const origins=req.body.bridgeOrigins;if(!Array.isArray(origins)||origins.length>10)fail(400,"Enter up to ten exact LMS origins.");const checked=origins.map(origin);
    const dailyLimit=Number(req.body.dailyLimit);if(!Number.isInteger(dailyLimit)||dailyLimit<1||dailyLimit>1000)fail(400,"Daily grading limit must be 1–1000.");
    if(req.body.apiKey){const key=text(req.body.apiKey,500);if(/[\r\n]/.test(key))fail(400,"Invalid key.");store.putSecret(provider!=="openai"?"learning.local.key":"learning.openai.key",key,{purpose:"learning-grading"});}
    if(req.body.enabled===true&&provider==="openai"&&!store.hasSecret("learning.openai.key"))fail(400,"Configure the server-side grading key first.");
    store.setPreference("learning.ai",{enabled:req.body.enabled===true,provider,baseURL,model,dailyLimit,autonomous:req.body.autonomous!==false});store.setPreference("learning.bridgeOrigins",checked);res.json({ok:true});
  }));
  app.get(api+"/activities/:id",wrap((req,res)=>{const a=learning.activity(req.learner,req.params.id);res.json({ok:true,activity:{...a,case:CASE},posts:learning.posts(req.learner,a.id),review:learning.currentReview(req.learner,a.id)});}));
  app.put(api+"/activities/:id",requireTeacher,wrap((req,res)=>{learning.settings(req.learner,req.params.id,req.body);res.json({ok:true});}));
  app.post(api+"/activities/:id/posts",wrap(async(req,res)=>{
    const id=learning.post(req.learner,req.params.id,req.body);
    if(learning.activity(req.learner,req.params.id).member.role!=="student")return res.json({ok:true,id});
    const reply=learning.db.prepare("SELECT id FROM learning_posts WHERE activity_id=? AND user_id=? AND kind IN ('reply','critique') AND hidden=0 ORDER BY rowid DESC LIMIT 1").get(req.params.id,req.learner.id);
    await submitWriting({...req,body:{replyId:reply?.id||null}}, {json:value=>res.json({...value,id}),status:status=>({json:()=>res.json({ok:true,id,gradingPending:true,retryable:status===503})})});
  }));
  app.put(api+"/activities/:id/posts/:postId",wrap(async(req,res)=>{learning.edit(req.learner,req.params.id,req.params.postId,req.body);const reply=learning.db.prepare("SELECT id FROM learning_posts WHERE activity_id=? AND user_id=? AND kind IN ('reply','critique') AND hidden=0 ORDER BY rowid DESC LIMIT 1").get(req.params.id,req.learner.id);await submitWriting({...req,body:{replyId:reply?.id||null}}, {json:value=>res.json(value),status:status=>({json:()=>res.json({ok:true,gradingPending:true,retryable:status===503})})});}));
  app.put(api+"/activities/:id/posts/:postId/moderation",requireTeacher,wrap((req,res)=>{learning.moderate(req.learner,req.params.id,req.params.postId,req.body.hidden===true);res.json({ok:true});}));
  app.put(api+"/activities/:id/posts/:postId/teacher-edit",requireTeacher,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);const p=learning.db.prepare("SELECT * FROM learning_posts WHERE id=? AND activity_id=? AND kind IN ('ai','teacher')").get(req.params.postId,req.params.id);if(!p)fail(404,"Teacher response not found.");learning.db.prepare("UPDATE learning_posts SET body=?,revision=revision+1,updated_at=? WHERE id=?").run(text(req.body.body,3000),now(),p.id);learning.event(req.learner,req.params.id,"coach.teacher-edit",p.id);res.json({ok:true});}));
  const submitWriting=wrap(async(req,res)=>{
    const user=req.learner,a=learning.activity(user,req.params.id);learning.writable(a);if(a.member.role!=="student")fail(403,"Only a student can submit for grading.");
    const replyId=req.body.replyId===undefined?learning.db.prepare("SELECT id FROM learning_posts WHERE activity_id=? AND user_id=? AND kind IN ('reply','critique') AND hidden=0 ORDER BY rowid DESC LIMIT 1").get(a.id,user.id)?.id:req.body.replyId;
    const snapshot=learning.snapshot(user,a.id,replyId),fingerprint=hash(snapshot);
    const last=learning.db.prepare("SELECT * FROM learning_reviews WHERE activity_id=? AND user_id=? ORDER BY rowid DESC LIMIT 1").get(a.id,user.id);
    if(last&&last.fingerprint===fingerprint&&["grading","needs_review","approved"].includes(last.status))return res.json({ok:true,review:learning.projectReview(last)});
    if(busy.size>=2||busy.has(user.id))fail(503,"Grading is busy. Your writing is saved; try again shortly.");
    const since=new Date(Date.now()-86400000).toISOString(),cfg=store.getPreference("learning.ai",{});
    if(learning.db.prepare("SELECT COUNT(*) n FROM learning_reviews WHERE user_id=? AND created_at>?").get(user.id,since).n>=5)fail(429,"Daily grading request limit reached. Ask your teacher to review the saved work.");
    if(learning.db.prepare("SELECT COUNT(*) n FROM learning_reviews WHERE model IS NOT NULL AND created_at>?").get(since).n>=(cfg.dailyLimit||100))fail(429,"The automatic grading budget is reached. Your teacher can review the saved work.");
    const id=crypto.randomUUID(),time=now(),enabled=cfg.enabled&&(["local","ollama"].includes(cfg.provider)||store.hasSecret("learning.openai.key"));
    learning.db.prepare("INSERT INTO learning_reviews(id,activity_id,user_id,fingerprint,snapshot_json,status,model,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").run(id,a.id,user.id,fingerprint,JSON.stringify(snapshot),enabled?"grading":"unavailable",enabled?cfg.model:null,time,time);
    learning.event(user,a.id,"grade.request",id);busy.add(user.id);
    try{
      if(enabled){const result=await grade({apiKey:store.getSecret(["local","ollama"].includes(cfg.provider)?"learning.local.key":"learning.openai.key"),provider:cfg.provider||"openai",baseURL:cfg.baseURL,model:cfg.model,initial:snapshot.initial,reply:snapshot.reply,parent:snapshot.parent});const validated=validateGrade({criteria:result.criteria,summary:result.summary});if(!snapshot.reply){validated.criteria.reply={points:0,feedback:"No reply was submitted."};validated.total=Object.values(validated.criteria).reduce((n,c)=>n+c.points,0);}
        const still=store.listUsers().find(u=>u.id===user.id&&u.enabled);if(!still)fail(409,"Account no longer active.");learning.membership(still,a.class_id);
        if(hash(learning.snapshot(user,a.id,snapshot.replyId))!==fingerprint)fail(409,"Writing changed during grading.");
        learning.store.tx(()=>{
          const changed=learning.db.prepare("UPDATE learning_reviews SET status='needs_review',ai_json=?,updated_at=? WHERE id=? AND status='grading'").run(JSON.stringify(validated),now(),id).changes;
          if(!changed)return;
          if(typeof result.coachResponse!=="string"||!result.coachResponse.trim()||result.coachResponse.length>1800)throw Error("Invalid coach output");
          const stamp=now(),coachId=crypto.randomUUID();
          learning.db.prepare("INSERT INTO learning_posts(id,activity_id,user_id,parent_id,kind,body,created_at,updated_at) VALUES(?,?,?,?,'ai',?,?,?)").run(coachId,a.id,user.id,snapshot.initialId,result.coachResponse,stamp,stamp);
          learning.event(user,a.id,"coach.automated",coachId,{reviewId:id});
          if(cfg.autonomous!==false){
            const currentActivity=learning.activity(user,a.id),member=currentActivity.member;
            const late=!!(currentActivity.due_at&&Date.parse(time)>Date.parse(currentActivity.due_at)&&!member.exempt);
            const final={...validated,earned:validated.total,lateMultiplier:late?.5:1,total:validated.total*(late?.5:1),possible:20,approvedAt:stamp,source:"ai"};
            learning.db.prepare("UPDATE learning_reviews SET status='approved',final_json=?,updated_at=? WHERE id=?").run(JSON.stringify(final),stamp,id);
            learning.event(user,a.id,"grade.automated",id,{earned:validated.total,total:final.total});
          }
        });
      }
    }catch{learning.db.prepare("UPDATE learning_reviews SET status='unavailable',updated_at=? WHERE id=? AND status='grading'").run(now(),id);}finally{busy.delete(user.id);}
    res.json({ok:true,review:learning.currentReview(user,a.id)});
  });
  app.post(api+"/activities/:id/submit",submitWriting);
  app.get(api+"/activities/:id/reviews",requireTeacher,wrap((req,res)=>{const a=learning.activity(req.learner,req.params.id,true);res.json({ok:true,reviews:learning.db.prepare("SELECT r.*,m.alias FROM learning_reviews r JOIN learning_members m ON m.user_id=r.user_id AND m.class_id=? WHERE r.activity_id=? AND r.rowid IN (SELECT MAX(rowid) FROM learning_reviews WHERE activity_id=? GROUP BY user_id) ORDER BY r.created_at LIMIT 200").all(a.class_id,a.id,a.id).map(r=>({...learning.projectReview(r),alias:r.alias,snapshot:parse(r.snapshot_json)}))});}));
  app.post(api+"/activities/:id/reviews/:reviewId/approve",requireTeacher,wrap((req,res)=>res.json({ok:true,grade:learning.approve(req.learner,req.params.id,req.params.reviewId,req.body)})));
  app.get(api+"/activities/:id/receipt",wrap((req,res)=>{const r=learning.currentReview(req.learner,req.params.id);if(!r||r.status!=="approved")fail(409,"A published grade is not available yet.");res.json({ok:true,activityId:req.params.id,reviewId:r.id,score:r.final.total,possible:20,raw:r.final.total*5,approvedAt:r.final.approvedAt});}));
  if(publicDir){app.get(api+"/activities/:id/scorm",requireTeacher,wrap((req,res)=>{learning.activity(req.learner,req.params.id,true);const AdmZip=require("adm-zip"),fs=require("node:fs"),path=require("node:path"),zip=new AdmZip();const base=origin(`${req.protocol}://${req.get("host")}`);for(const file of ["index.html","bridge.js","imsmanifest.xml"])zip.addFile(file,fs.readFileSync(path.join(publicDir,"scorm",file)));zip.addFile("config.js",Buffer.from(`window.LEARNING_CONFIG=${JSON.stringify({origin:base,activityId:req.params.id})};`));res.setHeader("Content-Disposition",'attachment; filename="Subnet-Case-Files-SCORM12.zip"');res.type("application/zip").send(zip.toBuffer());}));}
  return learning;
}
module.exports={LearningStore,registerLearning,restrictedStudentGate,hash,origin};
