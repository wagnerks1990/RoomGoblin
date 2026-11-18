'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {parse,legal,uci,START}=require('../src/learning-chess');
const {ChessComputer,LEVELS,selectMove}=require('../src/learning-chess-ai');

test('computer levels are fixed and every level chooses a server-legal move',()=>{
 assert.deepEqual(LEVELS,['beginner','standard','advanced']);
 for(const level of LEVELS)for(const position of [START,'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'])assert.ok(legal(parse(position)).map(uci).includes(selectMove(position,level)),level);
 assert.throws(()=>selectMove(START,'arbitrary-script'));
});

test('tactical computer levels recognize an immediate mate rather than capturing lower-value material',()=>{
 const position='7k/8/5KQ1/8/8/8/8/r7 w - - 0 1';
 for(const level of ['standard','advanced'])assert.equal(selectMove(position,level),'g6g7',level);
});

test('worker search returns a legal result and releases its bounded slot',async()=>{
 const ai=new ChessComputer(),move=await ai.choose(START,'advanced');assert.ok(legal(parse(START)).map(uci).includes(move));assert.equal(ai.active,0);
 await assert.rejects(ai.choose(START,'unrecognized'),{status:400});assert.equal(ai.active,0);
});

test('worker capacity rejects excess concurrent work instead of blocking room-control work',async()=>{
 const ai=new ChessComputer();const first=ai.choose(START,'advanced'),second=ai.choose(START,'advanced');
 await assert.rejects(ai.choose(START,'advanced'),{status:429});
 const results=await Promise.all([first,second]);for(const result of results)assert.ok(legal(parse(START)).map(uci).includes(result));assert.equal(ai.active,0);
});

test('worker failure leaves the service reusable and does not retain a slot',async()=>{
 const ai=new ChessComputer();await assert.rejects(ai.choose('not-a-position','advanced'),{status:503});assert.equal(ai.active,0);
 assert.ok(legal(parse(START)).map(uci).includes(await ai.choose(START,'beginner')));assert.equal(ai.active,0);
});
