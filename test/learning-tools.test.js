'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./helpers/learning-fixture');
const {PREFERENCE,normalizeTools,readTools}=require('../src/learning-tools');
const {allowedPath}=require('../src/learning-public');
const endpoint='/api/v1/learning/platform/tools';

test('AI shortcuts are administrator-managed and cannot change student connection settings',async t=>{
 const f=await fixture();t.after(f.close);
 const settings={publicOrigin:'https://learn.example.test',publicEnabled:true,presenceOrigin:'http://192.168.50.2:3000'};
 f.learning.platform.saveSettings(f.admin,settings);
 const before=f.learning.platform.settings(),tools={aiChatUrl:'https://ai.example.test/',mediaStudioUrl:'https://images.example.test/'};
 assert.equal((await f.request(null,endpoint)).status,401);
 assert.equal((await f.request(f.a,endpoint)).status,403);
 assert.equal((await f.request(f.a,endpoint,'PUT',tools)).status,403);
 assert.equal((await f.request(f.admin,endpoint,'PUT',tools)).status,200);
 assert.deepEqual(readTools(f.store),tools);
 assert.deepEqual(f.learning.platform.settings(),before);
 assert.equal((await f.request(f.admin,endpoint)).status,200);
 f.freeze(true);
 assert.equal((await f.request(f.admin,endpoint,'PUT',{})).status,423);
 assert.deepEqual(readTools(f.store),tools);
 assert.equal(allowedPath('GET',endpoint),false);
 assert.equal(allowedPath('PUT',endpoint),false);
});

test('tool addresses reject executable URLs and embedded credentials',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,test','http://ai.example.test','https://user:secret@ai.example.test','https://ai.example.test/?token=secret','https://ai.example.test/#token','https://ai.example.test/\npath',42,'x'.repeat(2049)]){
  assert.throws(()=>normalizeTools({aiChatUrl:value}),{status:400});
 }
 assert.deepEqual(normalizeTools({aiChatUrl:' https://ai.example.test '}),{aiChatUrl:'https://ai.example.test/',mediaStudioUrl:''});
});

test('malformed saved tool links fail closed independently of classroom progress',async t=>{
 const f=await fixture();t.after(f.close);
 const before=f.learning.platform.settings();
 for(const bad of [null,[],{aiChatUrl:'javascript:alert(1)'},{mediaStudioUrl:{url:'https://images.example.test'}}]){
  f.store.setPreference(PREFERENCE,bad);
  assert.deepEqual(readTools(f.store),{aiChatUrl:'',mediaStudioUrl:''});
  assert.deepEqual(f.learning.platform.settings(),before);
 }
});
