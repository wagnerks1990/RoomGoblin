'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./helpers/learning-fixture');
const {LearningPlatform}=require('../src/learning-platform');
const {normalizeArcade}=require('../src/learning-arcade');
const campus={socket:{remoteAddress:'192.0.2.10'},headers:{}},remote={socket:{remoteAddress:'198.51.100.10'},headers:{}};
const options=()=>({displays:[{id:'screen-a',label:'Synthetic display'}],lights:[],assets:[]});
function checkpoint(score=1200,level=1,board=1){const ram=Buffer.alloc(5120);ram[5]=3;ram[10]=12;ram[0x227]=board;ram[0x229]=level;let n=score;for(let i=0;i<3;i++){const x=n%100;ram[0xb2+i]=(Math.floor(x/10)<<4)|(x%10);n=Math.floor(n/100);}return JSON.stringify({v:1,engine:'174d526f',ram:ram.toString('base64'),score,level,board});}
async function setup(t){let now=Date.now();const sent=[];const f=await fixture({platformOptions:{clock:()=>now,options,dispatch:async(action,context)=>{sent.push({action,context});return {ok:true};}}});t.after(f.close);const p=f.learning.platform,classes=[f.classId],activities=[];
 for(const label of ['P3','P4'])classes.push(f.learning.createClass(f.admin,'Synthetic '+label));
 for(const classId of classes){const ids=[];for(let i=0;i<2;i++){const id=f.learning.createActivity(f.admin,classId,{title:'Checkpoint '+i,templateId:'scorm-connector-v1'});p.configure(f.admin,id,{points:i?50:20});ids.push(id);}activities.push(ids);}
 f.learning.enroll(f.admin,classes[1],{userId:f.b.id,alias:'Learner B'});f.learning.enroll(f.admin,classes[2],{userId:f.outside.id,alias:'Learner C'});
 const c=p.arcade.configure(f.admin,{title:'Continuing arcade',classes:classes.map((classId,i)=>({classId,label:'P'+(i+2)})),targets:['screen-a'],enabled:true});for(const id of activities.flat())p.arcade.bind(f.admin,id,c.id);
 p.saveSettings(f.admin,{classroomNetworks:['192.0.2.0/24'],networksConfirmed:true});
 const event=(user,sequence,revision=0,score=1200,extra={})=>({id:crypto.randomUUID(),learnerKey:user.id,sequence,kind:'arcade',occurredAt:new Date(now).toISOString(),revision,arcadeScore:score,level:1,board:1,current:2,total:5,checkpoint:checkpoint(score),...extra});
 const start=(i,user)=>{p.start(f.admin,classes[i],60);p.admit(f.admin,classes[i],[user.id]);p.signedName(classes[i],user.id,['Alex','Blair','Casey'][i]);};return {...f,p,classes,activities,c,event,start,sent,advance:ms=>now+=ms};
}
test('campaign score and checkpoint continue across assignments, sessions and restart',async t=>{
 const f=await setup(t),[first,next]=f.activities[0];f.start(0,f.a);await f.p.record(f.a,first,f.event(f.a,1),campus);assert.equal(f.p.state(f.a,next).arcade.arcadeScore,1200);
 f.p.stop(f.admin,f.classId);f.start(0,f.a);await f.p.record(f.a,next,f.event(f.a,1,1,1800),campus);assert.equal(f.p.state(f.a,first).arcade.revision,2);
 const p=new LearningPlatform(f.learning,{options});assert.equal(p.state(f.a,next).arcade.arcadeScore,1800);assert.equal(p.arcade.board(f.c.id)[0].arcadeScore,1800);assert.equal(p.currentSession(f.classId),null);
});
test('P2 P3 P4 share a persistent board while learner checkpoints and grades stay private',async t=>{
 const f=await setup(t);for(const [i,u] of [f.a,f.b,f.outside].entries()){f.start(i,u);await f.p.record(u,f.activities[i][0],f.event(u,1,0,1000+i*100),campus);f.p.stop(f.admin,f.classes[i]);}
 const rows=f.p.arcade.board(f.c.id);assert.deepEqual(rows.map(r=>r.period),['P4','P3','P2']);const json=JSON.stringify(rows);for(const forbidden of ['checkpoint','ram','raw','earned',f.a.id,f.b.id])assert.ok(!json.includes(forbidden));
 assert.equal(f.p.state(f.b,f.activities[1][0]).arcade.arcadeScore,1100);assert.throws(()=>f.p.state(f.a,f.activities[1][0]),{status:404});
});
test('stale parallel tab cannot replace a newer campaign; duplicate save remains idempotent',async t=>{
 const f=await setup(t),[a,b]=f.activities[0],event=f.event(f.a,1);await f.p.record(f.a,a,event,remote);assert.equal((await f.p.record(f.a,a,event,remote)).duplicate,true);
 await assert.rejects(()=>f.p.record(f.a,b,f.event(f.a,1,0,9000),remote),{status:409});assert.equal(f.p.state(f.a,b).sequence,0);assert.equal(f.p.state(f.a,b).arcade.arcadeScore,1200);
 await f.p.record(f.a,b,f.event(f.a,1,1,1500),remote);assert.equal(f.p.state(f.a,a).arcade.revision,2);
});
test('offsite and delayed checkpoints save privately without updating the TV projection',async t=>{
 const f=await setup(t),id=f.activities[0][0];f.start(0,f.a);await f.p.record(f.a,id,f.event(f.a,1),campus);await f.p.record(f.a,id,f.event(f.a,2,1,5000),remote);assert.equal(f.p.arcade.board(f.c.id)[0].arcadeScore,1200);
 const e=f.event(f.a,3,2,6000);f.advance(31000);await f.p.record(f.a,id,e,campus);assert.equal(f.p.arcade.board(f.c.id)[0].arcadeScore,1200);assert.equal(f.p.state(f.a,id).arcade.arcadeScore,6000);
});
test('question completion combines assignments; academic scores do not affect arcade rank',async t=>{
 const f=await setup(t),[a,b]=f.activities[0];f.start(0,f.a);await f.p.record(f.a,a,f.event(f.a,1,0,1200,{current:5}),campus);await f.p.record(f.a,b,f.event(f.a,1,1,1300,{current:12,total:50}),campus);
 const row=f.p.arcade.board(f.c.id)[0];assert.equal(row.completed,1);assert.equal(row.assignments,2);assert.equal(row.answered,17);assert.equal(row.total,55);
 await f.p.record(f.a,b,{id:crypto.randomUUID(),learnerKey:f.a.id,sequence:2,occurredAt:new Date().toISOString(),kind:'completed',raw:100},campus);assert.equal(f.p.arcade.board(f.c.id)[0].arcadeScore,1300);
});
test('board tick requires an active linked session and stops when disabled or frozen',async t=>{
 const f=await setup(t);await f.p.arcade.tick();assert.equal(f.sent.length,0);f.start(0,f.a);await f.p.arcade.tick();assert.equal(f.sent[0].action.kind,'arcade-board');assert.equal(f.sent[0].context.admitted(),true);
 f.p.arcade.configure(f.admin,{...f.c,enabled:false});assert.equal(f.sent[0].context.admitted(),false);await f.p.arcade.tick();assert.equal(f.sent.length,1);
});
test('teacher campaign routes reject students, cross-owner access and export freeze',async t=>{
 const f=await setup(t),base='/api/v1/learning/platform/campaigns';assert.equal((await f.request(f.a,base)).status,403);assert.equal((await f.request(f.admin,base)).body.campaigns.length,1);assert.equal((await f.request(f.a,base+'/'+f.c.id+'/activities/'+f.activities[0][0],'PUT',{})).status,403);
 f.freeze(true);assert.equal((await f.request(f.admin,base,'POST',{...f.c,title:'Changed'})).status,423);assert.equal(f.p.arcade.list(f.admin)[0].title,'Continuing arcade');
});
test('campaign validation rejects bad targets, class changes and a second enabled board on the same receiver',async t=>{
 const f=await setup(t);assert.throws(()=>f.p.arcade.configure(f.admin,{...f.c,targets:['unknown']}),{status:400});assert.throws(()=>f.p.arcade.configure(f.admin,{...f.c,classes:f.c.classes.slice(1)}),{status:409});assert.throws(()=>f.p.arcade.configure(f.admin,{...f.c,id:undefined}),{status:409});
 assert.throws(()=>f.p.arcade.bind(f.admin,f.activityId,f.c.id),{status:400});
});
test('malformed, mismatched and oversized game checkpoints are rejected',()=>{
 const good={revision:0,arcadeScore:1200,level:1,board:1,current:2,total:5,checkpoint:checkpoint()};assert.equal(normalizeArcade(good).arcadeScore,1200);
 for(const patch of [{checkpoint:'broken'},{checkpoint:'x'.repeat(16001)},{arcadeScore:5000},{revision:-1},{board:5},{current:6},{level:'1'}])assert.throws(()=>normalizeArcade({...good,...patch}),{status:400});
});
test('losing campaign class ownership removes its projection and teacher access',async t=>{
 const f=await setup(t);f.start(0,f.a);await f.p.record(f.a,f.activities[0][0],f.event(f.a,1),campus);f.p.db.prepare('DELETE FROM learning_members WHERE class_id=? AND user_id=?').run(f.classId,f.admin.id);
 assert.equal(f.p.arcade.board(f.c.id).length,0);assert.equal(f.p.arcade.list(f.admin).length,0);assert.throws(()=>f.p.arcade.configure(f.admin,f.c),{status:404});assert.equal(f.p.state(f.a,f.activities[0][0]).arcade,null);
});
