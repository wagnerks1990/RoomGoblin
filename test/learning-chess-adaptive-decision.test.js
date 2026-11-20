'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {START}=require('../src/learning-chess');
const {resolveAdaptive,collectVariation,styledMove}=require('../src/learning-chess-adaptive-decision');
const snapshot=()=>({depth:-1,values:new Map()});
const info=(s,rank,move,cp=20,depth=8,extra='')=>collectVariation(s,`info depth ${depth} multipv ${rank} score cp ${cp} ${extra} pv ${move}`);
const complete=()=>{const s=snapshot();info(s,3,'g1f3',0);info(s,1,'e2e4',30);info(s,2,'d2d4',20);return s;};
test('adaptive material adjustment is bounded, waits until opening and preserves trusted style',()=>{
 assert.equal(resolveAdaptive(START).band,1);
 const ahead='4k3/8/8/8/8/8/8/3QK3 b - - 0 3',behind='3qk3/8/8/8/8/8/8/4K3 b - - 0 3';
 assert.equal(resolveAdaptive(ahead,{band:2,style:'solid'}).band,3);
 assert.equal(resolveAdaptive(ahead,{band:2,style:'solid'}).style,'attacking');
 assert.equal(resolveAdaptive(behind,{band:2,style:'attacking'}).style,'solid');
 assert.equal(resolveAdaptive('4k3/8/8/8/8/8/4R3/4K3 b - - 0 3',{style:'attacking'}).style,'solid');
 assert.equal(resolveAdaptive(behind,{band:2}).band,1);
 assert.equal(resolveAdaptive(ahead,{band:5}).band,5);
 assert.equal(resolveAdaptive(behind,{band:0}).band,0);
 assert.equal(resolveAdaptive(ahead,{band:2,style:'solid'},'adaptive-practice').band,2);
 assert.equal(resolveAdaptive(ahead,{band:2,style:'solid'},'adaptive-practice').style,'solid');
 assert.equal(resolveAdaptive(ahead.replace('0 3','0 2'),{band:2}).band,2);
 for(const adaptive of [{band:-1},{band:6},{band:1.5},{style:'secret'}])assert.throws(()=>resolveAdaptive(START,adaptive),{status:400});
});
test('complete out-of-order MultiPV allows only evaluated near-best legal moves',()=>{
 const s=complete();assert.ok(['e2e4','d2d4','g1f3'].includes(styledMove(START,'e2e4',s,'exploratory')));
 assert.equal(styledMove(START,'e2e4',s,'balanced'),'e2e4');
 info(s,2,'d2d4',-100);info(s,3,'g1f3',-100);assert.equal(styledMove(START,'e2e4',s,'exploratory'),'e2e4');
});
test('partial newer depth, stale depth, bounds, duplicates and illegal PV fall back to engine move',()=>{
 for(const mutate of [s=>info(s,1,'e2e4',30,9),s=>info(s,2,'d2d4',20,8,'lowerbound'),s=>info(s,2,'d2d4',20,8,'upperbound'),s=>info(s,2,'e2e4'),s=>info(s,2,'e2e5')]){
  const s=complete();mutate(s);info(s,2,'d2d4',20,7);assert.equal(styledMove(START,'e2e4',s,'exploratory'),'e2e4');
 }
});
test('any mate candidate preserves engine selection and invalid scores invalidate old rank',()=>{
 const s=complete();collectVariation(s,'info depth 8 multipv 2 score mate -3 pv d2d4');assert.equal(styledMove(START,'e2e4',s,'attacking'),'e2e4');
 info(s,2,'d2d4',100001);assert.equal(s.values.has(2),false);
});
