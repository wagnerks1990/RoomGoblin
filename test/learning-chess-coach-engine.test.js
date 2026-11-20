'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {START,parse,legal,uci}=require('../src/learning-chess');
const {explainPosition,explainMove}=require('../src/learning-chess-coach');

test('position coaching is deterministic, bounded and suggests server-legal examples',()=>{
 const hint=explainPosition(START);
 assert.deepEqual(hint,explainPosition(START));assert.equal(hint.turn,'white');assert.equal(hint.inCheck,false);assert.equal(hint.legalMoveCount,20);
 assert.equal(hint.suggestions.length,3);assert.ok(hint.suggestions.some(m=>m.tags.includes('development')));assert.ok(hint.suggestions.some(m=>m.tags.includes('center')));
 const allowed=new Set(legal(parse(START)).map(uci));
 for(const move of hint.suggestions){assert.ok(allowed.has(move.move));assert.equal(move.kingSafe,true);assert.ok(move.reasons.length<=6);}
 assert.ok(JSON.stringify(hint).length<8000);assert.match(hint.notice,/not best-move/);
});

test('castling explanation describes both pieces and checks without promising safety',()=>{
 const hint=explainMove('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1','e1c1');
 assert.equal(hint.castling,true);assert.match(hint.reasons.join(' '),/rook/);assert.match(hint.reasons.join(' '),/cross/);
 assert.throws(()=>explainMove('5rk1/8/8/8/8/8/8/R3K2R w KQ - 0 1','e1g1'),{status:409});
});

test('en passant and promotion explanations use the actual captured square and chosen piece',()=>{
 const ep=explainMove('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1','e5d6');
 assert.equal(ep.capture,'pawn');assert.match(ep.reasons.join(' '),/d5/);assert.match(ep.reasons.join(' '),/destination d6 was empty/);
 for(const [suffix,name]of [['q','queen'],['r','rook'],['b','bishop'],['n','knight']])assert.equal(explainMove('7k/P7/8/8/8/8/8/7K w - - 0 1','a7a8'+suffix).promotion,name);
 assert.throws(()=>explainMove('k7/8/8/r4pPK/8/8/8/8 w - f6 0 1','g5f6'),{status:409});
});

test('checks and check responses are facts rather than speculative tactics',()=>{
 const check=explainMove('7k/8/5KQ1/8/8/8/8/8 w - - 0 1','g6g7');assert.equal(check.givesCheck,true);assert.match(check.reasons.join(' '),/does not by itself mean checkmate/);
 const hints=explainPosition('4r1k1/8/8/8/8/8/8/4K3 w - - 0 1');assert.equal(hints.inCheck,true);
 for(const hint of hints.suggestions)assert.ok(hint.tags.includes('check-response'));
 const mate=explainPosition('7k/6Q1/5K2/8/8/8/8/8 b - - 0 1');assert.equal(mate.legalMoveCount,0);assert.deepEqual(mate.suggestions,[]);
});

test('input validation rejects oversized, impossible, malformed and illegal requests',()=>{
 for(const fen of [null,{},'x'.repeat(121),'8/8/8/8/8/8/8/8 w - - 0 1','4k3/8/8/8/8/8/8/4K3 w K - 0 1','4k3/8/8/8/8/8/8/4K3 w - e6 0 1','4k3/8/8/8/8/8/4K3/8 w - - 999999999999999999999 1','4k3/8/8/8/8/8/8/P3K3 w - - 0 1','8/8/8/8/8/8/4k3/4K3 w - - 0 1'])assert.throws(()=>explainPosition(fen),{status:400});
 for(const move of [null,{},'e2e4;run','e2e4'.repeat(100),'E2E4'])assert.throws(()=>explainMove(START,move),{status:400});
 assert.throws(()=>explainMove(START,'e2e5'),{status:409});
});
