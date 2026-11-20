'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),{spawn}=require('node:child_process');
const {StockfishComputer}=require('../src/learning-chess-stockfish');
const {LEVELS}=require('../src/learning-chess-stockfish-profiles');
const {START,parse,legal,uci,apply,fen,checked}=require('../src/learning-chess');
const enabled=process.env.ROOMGOBLIN_TEST_NATIVE_STOCKFISH==='1';
test('real pinned Stockfish fixed/adaptive levels, mate, repetition history, cancellation and capacity',{skip:!enabled},async t=>{
 let peakKiB=0,cpuTicks=0;const engine=new StockfishComputer({enabled:true,spawnProcess:(...args)=>{
  const child=spawn(...args),timer=setInterval(()=>{try{const status=fs.readFileSync(`/proc/${child.pid}/status`,'utf8');peakKiB=Math.max(peakKiB,Number(/VmRSS:\s+(\d+)/.exec(status)?.[1]||0));const stat=fs.readFileSync(`/proc/${child.pid}/stat`,'utf8').split(' ');cpuTicks=Math.max(cpuTicks,Number(stat[13])+Number(stat[14]));}catch{}},10);child.once('close',()=>clearInterval(timer));return child;
 }});const started=Date.now();
 try{
  for(const level of [...LEVELS,'adaptive','adaptive-coach','adaptive-practice']){const move=await engine.choose(START,level,{moves:[],adaptive:{band:3,style:'exploratory'}});assert.ok(legal(parse(START)).some(m=>uci(m)===move));}
  const mate='7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',move=await engine.choose(mate,'grandmaster'),next=apply(parse(mate),legal(parse(mate)).find(m=>uci(m)===move));assert.equal(legal(next).length,0);assert.equal(checked(next),true);
  const history=['g1f3','g8f6','f3g1','f6g8'];let state=parse(START);for(const m of history)state=apply(state,legal(state).find(x=>uci(x)===m));const reply=await engine.choose(fen(state),'adaptive',{moves:history});assert.ok(legal(state).some(m=>uci(m)===reply));
  const controller=new AbortController(),a=engine.choose(START,'grandmaster',{signal:controller.signal}),b=engine.choose(START,'master');await assert.rejects(engine.choose(START,'normal'),{status:429});const cancelled=assert.rejects(a,{status:503});controller.abort();await cancelled;await b;await engine.drain();assert.equal(engine.jobs.size,0);
 }finally{engine.close();await engine.drain();}
 t.diagnostic(JSON.stringify({elapsedMs:Date.now()-started,peakSingleProcessRssKiB:peakKiB,maxObservedProcessCpuTicks:cpuTicks}));
});
