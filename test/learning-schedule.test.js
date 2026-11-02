'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {LearningPlatform}=require('../src/learning-platform');
const {LearningSchedule,KEY}=require('../src/learning-schedule');
const {LearningPresence}=require('../src/learning-presence');
const {allowedPath}=require('../src/learning-public');
const {resolveLearningSchedule}=require('../src/learning-schedule-source');
const campus={socket:{remoteAddress:'192.0.2.10'},headers:{}},remote={socket:{remoteAddress:'198.51.100.10'},headers:{}};

async function setup(t){
 let now=Date.now();const initial=now,sent=[];
 const source={day:new Date(now).toISOString().slice(0,10),classes:[{id:'p7',title:'Planning Period 7',enabled:true},{id:'p8',title:'Planning Period 8',enabled:true}],active:[{scheduleId:'p7',key:'p7-first',startAt:now-60000,endAt:now+3600000}]};
 const options={clock:()=>now,scheduleSource:()=>source,options:()=>({displays:[{id:'screen-a'}],lights:[],assets:[]}),dispatch:async(action,context)=>{sent.push({action,context});return {ok:true};}};
 const f=await fixture({platformOptions:options});t.after(f.close);const p=f.learning.platform,s=f.learning.schedule;
 const id=f.learning.createActivity(f.admin,f.classId,{title:'Connected SCORM',templateId:'scorm-connector-v1'});
 p.configure(f.admin,id,{points:50});p.saveSettings(f.admin,{classroomNetworks:['192.0.2.0/24'],networksConfirmed:true});
 const learner={...f.a,learningSso:true,sessionId:crypto.randomUUID()};
 const enable=()=>s.configure(f.admin,{enabled:true,links:[{scheduleId:'p7',classId:f.classId}]});
 const event=(sequence,extra={})=>({id:crypto.randomUUID(),learnerKey:f.a.id,sequence,kind:'score',raw:80,occurredAt:new Date(now).toISOString(),...extra});
 return {...f,p,s,id,source,options,learner,sent,enable,event,initial,advance:ms=>now+=ms};
}

test('one-time setup imports classes by stable source ID and retains existing activities',async t=>{
 const f=await setup(t);f.enable();const imported=f.s.links().find(l=>l.schedule_id==='p8').class_id;
 assert.equal(f.learning.classes(f.admin).length,2);assert.equal(f.learning.activity(f.admin,f.id).class_id,f.classId);
 f.s.reconcile();assert.equal(f.learning.classes(f.admin).length,2);
 f.source.classes[1].title='Renamed planning class';f.s.reconcile();
 assert.equal(f.learning.classes(f.admin).find(c=>c.id===imported).title,'Renamed planning class');
 assert.equal(f.learning.classes(f.admin).find(c=>c.id===f.classId).title,'Synthetic Period 7');
 f.source.classes.splice(1,1);f.s.reconcile();assert.ok(f.learning.classes(f.admin).find(c=>c.id===imported));
 assert.equal(f.learning.activity(f.admin,f.id).class_id,f.classId);
});

test('scheduled sessions start without a teacher tab and end exactly at the class boundary',async t=>{
 const f=await setup(t);f.enable();const first=f.p.currentSession(f.classId);
 assert.ok(first);assert.equal(first.expires_at,f.initial+3600000);
 f.s.reconcile();assert.equal(f.p.currentSession(f.classId).id,first.id);
 f.advance(3600000);assert.equal(f.p.currentSession(f.classId),null);
 f.source.active=[{scheduleId:'p8',key:'p8-next',startAt:f.initial+3600000,endAt:f.initial+7200000}];f.s.reconcile();
 const next=f.s.links().find(l=>l.schedule_id==='p8').class_id;assert.ok(f.p.currentSession(next));
 assert.equal(f.p.currentSession(f.classId),null);assert.equal(f.sent.length,0);
});

test('signed learners join the live board only after fresh local presence; offsite progress still saves',async t=>{
 const f=await setup(t);f.enable();f.p.saveRecipe(f.admin,f.classId,{label:'Approved score',eventKind:'score',enabled:true,actions:[{kind:'leaderboard',targets:['screen-a']}]});
 assert.deepEqual(f.p.session(f.admin,f.classId).attending,[]);
 assert.equal((await f.p.record(f.learner,f.id,f.event(1),remote)).classroom,false);
 assert.deepEqual(f.p.session(f.admin,f.classId).attending,[]);
 assert.equal((await f.p.record(f.a,f.id,f.event(2),campus)).classroom,false);
 const event=f.event(3),challenge=f.p.presence.challenge(f.learner,f.id,event.id);
 assert.equal(challenge.available,true);f.p.presence.attest(challenge.id,campus);
 const result=await f.p.record(f.learner,f.id,{...event,presenceId:challenge.id},remote);
 assert.equal(result.classroom,true);assert.equal(f.sent.length,1);
 assert.deepEqual(f.p.session(f.admin,f.classId).attending,[f.a.id]);
 assert.equal(f.p.session(f.admin,f.classId).board[0].earned,40);
 assert.throws(()=>f.p.admit(f.admin,f.classId,[f.b.id]),{status:409});
});

test('a presence challenge cannot cross classroom sessions, including a restart',async t=>{
 const f=await setup(t);f.enable();const event=f.event(1),challenge=f.p.presence.challenge(f.learner,f.id,event.id),before=f.p.currentSession(f.classId).id;
 f.p.presence.attest(challenge.id,campus);f.p.stop(f.admin,f.classId);f.s.resume(f.admin,f.classId);
 assert.notEqual(f.p.currentSession(f.classId).id,before);
 assert.equal((await f.p.record(f.learner,f.id,{...event,presenceId:challenge.id},remote)).classroom,false);
 const newer=f.event(2),proof=f.p.presence.challenge(f.learner,f.id,newer.id);f.p.presence.attest(proof.id,campus);
 const p=new LearningPlatform(f.learning,f.options),s=new LearningSchedule(p,{source:()=>f.source});p.schedule=s;p.presence=new LearningPresence(p);s.reconcile();
 assert.ok(p.currentSession(f.classId));assert.deepEqual(p.session(f.admin,f.classId).attending,[]);
 assert.equal((await p.record(f.learner,f.id,{...newer,presenceId:proof.id},remote)).classroom,false);
 assert.equal(f.sent.length,0);
});

test('pause persists through reconciliation and restart but does not require a daily restart click',async t=>{
 const f=await setup(t);f.enable();f.p.stop(f.admin,f.classId);f.s.reconcile();assert.equal(f.p.currentSession(f.classId),null);
 assert.equal(f.s.visibleActiveClass(f.admin),f.classId);assert.equal(f.s.visibleActiveClass(f.a),null);
 const p=new LearningPlatform(f.learning,f.options),s=new LearningSchedule(p,{source:()=>f.source});p.schedule=s;s.reconcile();assert.equal(p.currentSession(f.classId),null);
 f.advance(86400000);f.source.day=new Date(f.initial+86400000).toISOString().slice(0,10);f.source.active=[{scheduleId:'p7',key:'p7-tomorrow',startAt:f.initial+86400000,endAt:f.initial+90000000}];s.reconcile();
 assert.ok(p.currentSession(f.classId));assert.equal(f.sent.length,0);
});

test('additive session proof bindings preserve the legacy challenge row shape and expire together',async t=>{
 const f=await setup(t);f.enable();const event=f.event(1),challenge=f.p.presence.challenge(f.learner,f.id,event.id),db=f.learning.db;
 assert.ok(db.prepare('SELECT 1 FROM learning_presence_sessions WHERE challenge_id=?').get(challenge.id));
 db.prepare('DELETE FROM learning_presence_challenges WHERE id=?').run(challenge.id);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_presence_sessions').get().n,0);
 const legacy=crypto.randomUUID();
 db.prepare('INSERT INTO learning_presence_challenges VALUES(?,?,?,?,?,?,NULL,NULL,?)').run(legacy,f.a.id,f.learner.sessionId,f.id,event.id,f.initial,'legacy-network');
 assert.equal(f.p.presence.consume(f.learner,f.id,event.id,legacy),false);
 new LearningPresence(f.p);assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_presence_challenges').get().n,0);
});

test('remote days, removed classes, overlap, and revoked teacher access fail closed immediately',async t=>{
 const f=await setup(t);f.enable();f.source.blocked=true;assert.equal(f.p.currentSession(f.classId),null);f.s.reconcile();
 f.source.blocked=false;f.s.reconcile();assert.ok(f.p.currentSession(f.classId));
 f.source.active.push({scheduleId:'p8',key:'overlap',startAt:f.initial,endAt:f.initial+3600000});assert.equal(f.p.currentSession(f.classId),null);
 f.source.active.pop();f.s.reconcile();f.source.classes[0].enabled=false;assert.equal(f.p.currentSession(f.classId),null);
 f.source.classes[0].enabled=true;f.s.reconcile();f.learning.db.prepare('DELETE FROM learning_members WHERE class_id=? AND user_id=?').run(f.classId,f.admin.id);
 assert.equal(f.p.currentSession(f.classId),null);assert.equal(f.sent.length,0);
});

test('schedule administration respects authentication, source mapping and the recovery freeze',async t=>{
 const f=await setup(t),url='/api/v1/learning/platform/schedule';
 assert.equal((await f.request(null,url)).status,401);assert.equal((await f.request(f.a,url)).status,403);
 assert.equal((await f.request(f.a,url,'PUT',{enabled:true})).status,403);
 assert.equal(allowedPath('GET',url),false);assert.equal(allowedPath('PUT',url),false);
 assert.equal((await f.request(f.admin,url,'PUT',{enabled:true,links:[{scheduleId:'unknown',classId:f.classId}]})).status,400);
 f.freeze(true);assert.equal((await f.request(f.admin,url,'PUT',{enabled:true})).status,423);assert.equal(f.s.reconcile().deferred,true);
 assert.equal(f.s.links().length,0);f.freeze(false);f.enable();
 f.freeze(true);f.source.classes.push({id:'new',title:'Later class',enabled:true});f.s.reconcile();assert.equal(f.s.links().length,2);
 f.freeze(false);f.s.reconcile();assert.equal(f.s.links().length,3);
});

test('malformed preferences and missing or invalid timetable snapshots cannot arm sessions',async t=>{
 const f=await setup(t);for(const bad of [null,[],{enabled:true},{enabled:true,ownerId:'missing'}]){f.store.setPreference(KEY,bad);f.s.reconcile();assert.equal(f.p.currentSession(f.classId),null);}
 f.enable();f.source.day='2026-99-99';assert.equal(f.p.currentSession(f.classId),null);f.s.reconcile();
 f.source.day=new Date(f.initial).toISOString().slice(0,10);f.source.classes.push({...f.source.classes[0]});assert.equal(f.p.currentSession(f.classId),null);
 assert.equal(f.sent.length,0);
});

test('automatic mode preserves closed assignments and never replays old progress as an effect',async t=>{
 const f=await setup(t),old=f.event(1);await f.p.record(f.learner,f.id,old,remote);f.enable();
 f.p.saveRecipe(f.admin,f.classId,{label:'Approved score',eventKind:'score',enabled:true,actions:[{kind:'leaderboard',targets:['screen-a']}]});
 assert.equal((await f.p.record(f.learner,f.id,old,campus)).duplicate,true);assert.equal(f.sent.length,0);
 f.learning.settings(f.admin,f.id,{open:false});f.s.reconcile();await assert.rejects(()=>f.p.record(f.learner,f.id,f.event(2),campus),{status:409});
});

test('a failed timetable or malformed overlapping occurrence never blocks ordinary progress saves',async t=>{
 const f=await setup(t);f.enable();
 f.source.active.push({scheduleId:'missing',key:'invalid',startAt:f.initial,endAt:f.initial+3600000});
 assert.equal(f.p.currentSession(f.classId),null);
 assert.equal((await f.p.record(f.learner,f.id,f.event(1),campus)).classroom,false);
 f.s.source=()=>{throw Error('Synthetic planner unavailable');};
 assert.equal((await f.p.record(f.learner,f.id,f.event(2),remote)).classroom,false);
 assert.equal(f.p.state(f.learner,f.id).progress.raw,80);assert.equal(f.sent.length,0);
});

test('mapping another timetable entry preserves course identity and retained membership',async t=>{
 const f=await setup(t);f.enable();const roster=()=>f.learning.db.prepare('SELECT * FROM learning_members WHERE class_id=? ORDER BY user_id').all(f.classId),members=roster();
 f.s.configure(f.admin,{enabled:true,links:[{scheduleId:'p8',classId:f.classId}]});
 assert.equal(f.s.links().filter(l=>l.class_id===f.classId).length,2);
 assert.deepEqual(roster(),members);
 assert.equal(f.learning.activity(f.admin,f.id).class_id,f.classId);
 assert.equal(f.learning.classes(f.admin).length,2);
});

test('schedule source uses each resolved segment and excludes transitions and remote days',()=>{
 const date=new Date('2026-11-02T14:30:00Z'),classes=[{id:'p7',name:'Period 7'},{id:'break',name:'Transition'}];
 const args={classes,date,day:'2026-11-02',suppression:{blocked:false},isTransition:c=>c.id==='break',matches:()=>true,
  segments:()=>[{startTime:'14:00',endTime:'14:20',segmentId:'first'},{startTime:'14:25',endTime:'15:00',segmentId:'second'}],
  start:(_c,_d,s)=>new Date('2026-11-02T'+s.startTime+':00Z'),end:(_c,_d,s)=>new Date('2026-11-02T'+s.endTime+':00Z')};
 const result=resolveLearningSchedule(args);assert.equal(result.active.length,1);assert.equal(result.active[0].scheduleId,'p7');assert.equal(result.active[0].startAt,Date.parse('2026-11-02T14:25:00Z'));
 assert.deepEqual(resolveLearningSchedule({...args,suppression:{blocked:true,reason:'Remote day'}}).active,[]);
});
