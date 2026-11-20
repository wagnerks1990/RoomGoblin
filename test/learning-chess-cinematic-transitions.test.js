'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {START,play}=require('../src/learning-chess');
const transitions=import(pathToFileURL(path.resolve(__dirname,'../public/learn/chess/cinematic/transitions.mjs')));
const snapshot=(moves,{mode='multiplayer',revision=moves.length,id='synthetic',start=START}={})=>({id,mode,revision,moves,fen:moves.length?play(start,moves.slice(0,-1),moves.at(-1)).fen:start});
test('atomic computer replies produce both confirmed visual moves, unlike polling gaps',async()=>{
 const {confirmedPresentations}=await transitions,old=snapshot([],{mode:'computer'}),next=snapshot(['e2e4','e7e5'],{mode:'computer',revision:1});
 const frames=confirmedPresentations(old,next);assert.deepEqual(frames.map(f=>f.move),next.moves);assert.equal(frames[0].fen,snapshot(['e2e4']).fen.split(' ')[0]);assert.equal(frames[1].fen,next.fen.split(' ')[0]);
 assert.deepEqual(confirmedPresentations(old,{...next,mode:'multiplayer'}),[]);
 assert.deepEqual(confirmedPresentations(old,{...next,revision:2}),[]);
 assert.deepEqual(confirmedPresentations(old,next,{animate:false}),[]);
 assert.deepEqual(confirmedPresentations(null,next),[]);
 assert.deepEqual(confirmedPresentations(old,{...next,id:'another'}),[]);
});
test('visual transitions reconstruct capture, castling, en passant and promotion exactly',async()=>{
 const {confirmedPresentations}=await transitions;
 for(const [start,moves]of [[START,['e2e4','d7d5','e4d5']],['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',['e1g1']],['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',['e5d6']],['4k3/P7/8/8/8/8/8/4K3 w - - 0 1',['a7a8n']]]){
  const old=snapshot(moves.slice(0,-1),{start}),next=snapshot(moves,{start}),frames=confirmedPresentations(old,next);
  assert.equal(frames.length,1);assert.equal(frames[0].fen,next.fen.split(' ')[0]);
 }
});
test('unexpected histories and inconsistent final board snap without visual reconstruction',async()=>{
 const {confirmedPresentations}=await transitions,old=snapshot(['e2e4']),next=snapshot(['e2e4','e7e5']);
 assert.deepEqual(confirmedPresentations(old,{...next,moves:['d2d4','e7e5']}),[]);
 assert.deepEqual(confirmedPresentations(old,{...next,fen:START}),[]);
 assert.deepEqual(confirmedPresentations(old,{...next,moves:['e2e4','bad']}),[]);
 assert.deepEqual(confirmedPresentations(old,{...next,revision:1.5}),[]);
});
