'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {credit,titleDate}=require('../src/learning-grade-policy'),{fixture}=require('./helpers/learning-fixture');
const remote={socket:{remoteAddress:'198.51.100.10'},headers:{}};
const policy={enabled:true,assignmentDate:'2026-11-03',timeZone:'America/New_York'};
test('title parsing rejects missing, ambiguous and impossible dates',()=>{
 assert.equal(titleDate('11/03/2026 · Donkey Kong · Do Now'),'2026-11-03');assert.equal(titleDate('Class 11/03/2026'),null);assert.throws(()=>titleDate('2/30/2026 · Class'));
});
test('school calendar days enforce full, half and zero at exact local midnights',()=>{
 for(const [stamp,factor] of [['2026-11-04T04:59:59Z',1],['2026-11-04T05:00:00Z',.5],['2026-11-05T04:59:59Z',.5],['2026-11-05T05:00:00Z',0]])assert.equal(credit(policy,Date.parse(stamp)).multiplier,factor);
 assert.equal(credit({...policy,assignmentDate:'2026-11-01'},Date.parse('2026-11-02T04:59:59Z')).multiplier,1);
 assert.equal(credit({...policy,assignmentDate:'2026-11-01'},Date.parse('2026-11-02T05:00:00Z')).multiplier,.5);
});
async function setup(t){let now=Date.parse('2026-11-03T16:00:00Z');const f=await fixture({platformOptions:{clock:()=>now}});t.after(f.close);const p=f.learning.platform,id=f.learning.createActivity(f.admin,f.classId,{title:'11/03/2026 · Synthetic assessment',templateId:'scorm-connector-v1'});p.configure(f.admin,id,{points:20});
 const event=(sequence,raw,current=5,total=5,extra={})=>({id:crypto.randomUUID(),kind:'assessment',sequence,learnerKey:f.a.id,occurredAt:new Date(now).toISOString(),raw,current,total,...extra});
 return {...f,p,id,event,setNow:s=>{now=Date.parse(s);}};
}
test('live score begins at zero, improves per answer, and a lower retry never reduces it',async t=>{
 const f=await setup(t);f.p.grading.configure(f.admin,f.id,policy);
 for(const [seq,raw,current,best] of [[1,0,0,0],[2,40,2,40],[3,80,5,80],[4,20,1,80]]){const r=await f.p.record(f.a,f.id,f.event(seq,raw,current),remote);assert.equal(r.state.grade.bestPercent,best);}
 assert.equal(f.p.state(f.a,f.id).grade.completed,true);assert.equal(f.p.state(f.b,f.id).grade.recorded,false);
});
test('late new points use receipt time and cannot reduce an earlier score',async t=>{
 const f=await setup(t);f.p.grading.configure(f.admin,f.id,policy);await f.p.record(f.a,f.id,f.event(1,40),remote);f.setNow('2026-11-04T16:00:00Z');
 const e=f.event(2,100,5,5,{occurredAt:'2026-11-03T16:00:00Z'});assert.equal((await f.p.record(f.a,f.id,e,remote)).state.grade.bestPercent,50);
 f.setNow('2026-11-05T16:00:00Z');assert.equal((await f.p.record(f.a,f.id,f.event(3,100),remote)).state.grade.bestPercent,50);
 assert.equal((await f.p.record(f.a,f.id,e,remote)).duplicate,true);
});
test('teacher exception is scoped to one student and does not rewrite earned grades',async t=>{
 const f=await setup(t);f.p.grading.configure(f.admin,f.id,policy);f.setNow('2026-11-05T16:00:00Z');f.p.grading.override(f.admin,f.id,{userId:f.a.id,creditDate:'2026-11-05',reason:'Approved extension'});
 assert.equal(f.p.state(f.a,f.id).grade.multiplier,1);assert.equal(f.p.state(f.b,f.id).grade.multiplier,0);await f.p.record(f.a,f.id,f.event(1,80),remote);
 f.p.grading.override(f.admin,f.id,{userId:f.a.id,creditDate:null});assert.equal(f.p.state(f.a,f.id).grade.bestPercent,80);assert.equal(f.p.state(f.a,f.id).grade.multiplier,0);
 assert.throws(()=>f.p.grading.override(f.a,f.id,{userId:f.a.id,creditDate:'2026-11-06',reason:'Forbidden'}),{status:404});
});
test('enabling policy preserves historical completed work but later legacy telemetry cannot bypass it',async t=>{
 const f=await setup(t);await f.p.record(f.a,f.id,f.event(1,60,5,5,{kind:'completed'}),remote);f.p.grading.configure(f.admin,f.id,policy);assert.equal(f.p.state(f.a,f.id).grade.bestPercent,60);
 await f.p.record(f.a,f.id,f.event(2,100,5,5,{kind:'completed'}),remote);assert.equal(f.p.state(f.a,f.id).grade.bestPercent,60);f.p.grading.configure(f.admin,f.id,policy);assert.equal(f.p.state(f.a,f.id).grade.bestPercent,60);
});
test('policy and exception routes require teacher access and respect backup freeze',async t=>{
 const f=await setup(t),base='/api/v1/learning/platform/activities/'+f.id;assert.equal((await f.request(f.a,base+'/grade-policy','PUT',policy)).status,403);assert.equal((await f.request(f.admin,base+'/grade-policy','PUT',policy)).status,200);
 f.freeze(true);assert.equal((await f.request(f.admin,base+'/grade-override','PUT',{userId:f.a.id,creditDate:'2026-11-05',reason:'Extension'})).status,423);
});


test('documented grade restoration preserves higher grades, completion and an audit trail without late penalties',async t=>{
 const f=await setup(t);f.p.grading.configure(f.admin,f.id,policy);f.setNow('2026-11-05T16:00:00Z');const input={sourceDigest:'a'.repeat(64),records:[{userId:f.a.id,earned:16,possible:20,completed:true,sourceAssignment:'12345'}]};
 assert.equal(f.p.grading.restoreRecorded(f.admin,f.id,input).restored,1);const audit=f.store.db.prepare("SELECT details_json FROM learning_events WHERE activity_id=? AND kind='grading.restore'").get(f.id);assert.equal(JSON.parse(audit.details_json).sourceDigest,input.sourceDigest);assert.equal(f.p.state(f.a,f.id).grade.bestPercent,80);assert.equal(f.p.state(f.a,f.id).grade.completed,true);
 input.records[0].earned=4;input.records[0].completed=false;f.p.grading.restoreRecorded(f.admin,f.id,input);assert.equal(f.p.state(f.a,f.id).grade.bestPercent,80);assert.equal(f.p.state(f.a,f.id).grade.completed,true);
 await f.p.record(f.a,f.id,f.event(1,100),remote);assert.equal(f.p.state(f.a,f.id).grade.bestPercent,80);
});
test('restoration validates the full batch before writing and rejects students, wrong courses and wrong points',async t=>{
 const f=await setup(t);f.p.grading.configure(f.admin,f.id,policy);const row={userId:f.a.id,earned:16,possible:20,completed:true,sourceAssignment:'12345'},input={sourceDigest:'a'.repeat(64),records:[row]};
 assert.throws(()=>f.p.grading.restoreRecorded(f.a,f.id,input),{status:404});
 for(const bad of [{...row,userId:f.outside.id},{...row,userId:f.b.id,possible:100},{...row,userId:f.b.id,earned:21},{...row,userId:f.b.id,completed:'true'}]){assert.throws(()=>f.p.grading.restoreRecorded(f.admin,f.id,{...input,records:[row,bad]}));assert.equal(f.p.state(f.a,f.id).grade.recorded,false);}
 const path='/api/v1/learning/platform/activities/'+f.id+'/grade-restore';assert.equal((await f.request(f.a,path,'POST',input)).status,403);f.freeze(true);assert.equal((await f.request(f.admin,path,'POST',input)).status,423);
});
