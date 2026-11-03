'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {allowedTargets,waitingState}=require('../src/learning-display-policy');
test('dedicated receiver excludes ordinary content and music, including all-target expansions',()=>{
 const reserved=new Map([['board','campaign']]);
 for(const type of ['display.text','display.timer','display.clear','display.layers','display.video','display.presentation','voice.speak','sfx.play','legacy.raw','music.assistant.attach']){
  assert.deepEqual(allowedTargets({type,payload:{}},['board','other'],reserved),['other']);
 }
 assert.deepEqual(allowedTargets({type:'display.reload'},['board'],reserved),['board']);
 assert.deepEqual(allowedTargets({type:'music.assistant.detach'},['board'],reserved),['board']);
});
test('only trusted owning campaign can address its reservation; spoofed payload or source cannot',()=>{
 const reserved=new Map([['board','campaign']]),cmd={type:'display.text',source:'learning-effects',payload:{arcade:{version:1}}};
 assert.deepEqual(allowedTargets(cmd,['board'],reserved),[]);
 assert.deepEqual(allowedTargets(cmd,['board'],reserved,'wrong'),[]);
 assert.deepEqual(allowedTargets(cmd,['board'],reserved,'campaign'),['board']);
 assert.deepEqual(allowedTargets({...cmd,type:'display.video'},['board'],reserved,'campaign'),[]);
 assert.deepEqual(allowedTargets(cmd,['board'],new Map()),['board']);
});
test('reconnect fallback is generic, silent and contains no replayed learner data',()=>{
 const s=waitingState();assert.equal(s.media,null);assert.equal(s.timer.visible,false);assert.equal(JSON.stringify(s).includes('firstName'),false);
});
