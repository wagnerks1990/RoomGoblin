'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {PassThrough,Writable}=require('node:stream');
const {StockfishComputer,EXECUTABLE,LIMITS,positionCommand}=require('../src/learning-chess-stockfish');
const {PROFILES,LEVELS,optionCommands}=require('../src/learning-chess-stockfish-profiles');
const {ChessComputer,LEGACY_LEVELS,selectMove}=require('../src/learning-chess-ai');
const {START}=require('../src/learning-chess');
function harness({answer='e2e4',respond=true,exit=true,ignoreKill=false,infoLines=[]}={}){
 const calls=[],children=[];
 const spawn=(file,args,options)=>{
  calls.push({file,args,options});const child=new EventEmitter();child.commands=[];child.signals=[];child.stdout=new PassThrough();child.stderr=new PassThrough();
  child.stdin=new Writable({write(chunk,_,done){const commands=String(chunk).trim().split('\n');child.commands.push(...commands);for(const cmd of commands)queueMicrotask(()=>{if(!respond)return;if(cmd==='uci')child.stdout.write('id name Stockfish 15.1\nuciok\n');else if(cmd==='isready')child.stdout.write('readyok\n');else if(cmd.startsWith('go '))child.stdout.write(infoLines.join('\n')+'\nbestmove '+answer+'\n');else if(cmd==='quit'&&exit)child.emit('close',0,null);});done();}});
  child.kill=signal=>{child.signals.push(signal);if(!ignoreKill)queueMicrotask(()=>child.emit('close',null,signal));return true;};children.push(child);return child;
 };
 return {spawn,calls,children};
}
test('strong profiles are bounded genuine-engine settings without rating claims or legacy ID changes',()=>{
 assert.deepEqual(LEGACY_LEVELS,['beginner','standard','advanced']);assert.deepEqual(LEVELS,['normal','intermediate','stockfish-advanced','expert','master','grandmaster']);
 let skill=-1,budget=0;for(const id of LEVELS){const p=PROFILES[id];assert.ok(p.skill>skill&&p.skill<=20);assert.ok(p.movetime>=budget&&p.movetime<=1200);assert.ok(p.nodes<=1000000);assert.equal('elo' in p,false);assert.ok(optionCommands(id).includes('setoption name Hash value 32'));skill=p.skill;budget=p.movetime;}
 assert.throws(()=>optionCommands('__proto__'),/available computer level/);assert.throws(()=>selectMove(START,'grandmaster'),/Invalid chess level/);
});
test('native UCI handshake uses fixed executable, bounded options, minimal environment and legal output',async()=>{
 const h=harness(),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});assert.equal(await engine.choose(START,'grandmaster',{moves:[]}), 'e2e4');
 assert.equal(h.calls[0].file,EXECUTABLE);assert.deepEqual(h.calls[0].args,[]);assert.equal(h.calls[0].options.shell,false);assert.equal(h.calls[0].options.windowsHide,true);assert.deepEqual(h.calls[0].options.env,{LANG:'C',LC_ALL:'C'});
 const commands=h.children[0].commands;assert.ok(commands.indexOf('setoption name Threads value 1')<commands.indexOf('setoption name Hash value 32'));assert.ok(commands.includes('position startpos'));assert.ok(commands.includes('go movetime 1200 nodes 1000000'));assert.equal(commands.at(-1),'quit');assert.equal(engine.jobs.size,0);
});
test('disabled engine never executes and malformed position/history cannot inject UCI commands',async()=>{
 const h=harness(),engine=new StockfishComputer({spawnProcess:h.spawn});await assert.rejects(engine.choose(START,'normal'),{status:503});assert.equal(h.calls.length,0);
 assert.throws(()=>positionCommand(START+'\nquit'),/Invalid chess position/);assert.throws(()=>positionCommand(START,['e2e4\nquit']),/Invalid saved chess history/);assert.throws(()=>positionCommand('x'.repeat(129)),/Invalid chess position/);
});
test('untrusted JSON cancellation objects are rejected before native process admission',async()=>{
 const h=harness(),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});
 for(const signal of [{},null,[],{aborted:false},'abort'])await assert.rejects(engine.analyze(START,{signal}),{status:400});
 assert.equal(h.calls.length,0);assert.equal(engine.jobs.size,0);
 const controller=new AbortController();assert.equal(await engine.choose(START,'normal',{signal:controller.signal}),'e2e4');
});
test('adaptive modes use trusted bounded profile and MultiPV while fixed profiles stay fixed',async()=>{
 for(const mode of ['adaptive','adaptive-coach','adaptive-practice']){const h=harness(),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});assert.equal(await engine.choose(START,mode,{adaptive:{band:4,style:'solid'}}),'e2e4');assert.ok(h.children[0].commands.includes('setoption name MultiPV value 3'));assert.ok(h.children[0].commands.includes('setoption name Skill Level value 19'));}
 const h=harness(),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});await engine.choose(START,'normal',{adaptive:{band:5,style:'attacking'}});assert.ok(h.children[0].commands.includes('setoption name MultiPV value 1'));assert.ok(h.children[0].commands.includes('setoption name Skill Level value 3'));
});
test('illegal, malformed or premature engine moves fail closed and do not leak engine output',async()=>{
 for(const answer of ['e2e5','(none)','e2e4 unexpected secret']){const h=harness({answer}),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});await assert.rejects(engine.choose(START,'normal'),error=>error.status===503&&!error.message.includes('secret'));await engine.drain();assert.equal(engine.jobs.size,0);}
 const h=harness({respond:false}),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});const pending=engine.choose(START,'normal');h.children[0].stdout.write('bestmove e2e4\n');await assert.rejects(pending,{status:503});await engine.drain();
});
test('stdout and stderr output are bounded before accepting a move',async()=>{
 for(const kind of ['line','total']){const h=harness({respond:false}),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});const pending=engine.choose(START,'normal');if(kind==='line')h.children[0].stdout.write('x'.repeat(LIMITS.lineBytes+1));else h.children[0].stderr.write('x'.repeat(LIMITS.outputBytes+1));await assert.rejects(pending,{status:503});await engine.drain();assert.ok(h.children[0].signals.includes('SIGTERM'));}
});
test('abort and close cancel searches, drain subprocesses, and reject later admission',async()=>{
 const h=harness({respond:false}),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn}),abort=new AbortController();const first=engine.choose(START,'normal',{signal:abort.signal}),second=engine.choose(START,'master');
 await assert.rejects(engine.choose(START,'expert'),{status:429});abort.abort();await assert.rejects(first,{status:503});engine.close();await assert.rejects(second,{status:503});await engine.drain();assert.equal(engine.jobs.size,0);await assert.rejects(engine.choose(START,'normal'),{status:503});
});
test('deadline escalates termination but retains capacity until actual process close',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const h=harness({respond:false,ignoreKill:true}),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn}),pending=engine.choose(START,'normal');const rejection=assert.rejects(pending,{status:503});t.mock.timers.tick(LIMITS.deadlineMs);await rejection;assert.equal(engine.jobs.size,1);t.mock.timers.tick(LIMITS.killDelayMs);assert.deepEqual(h.children[0].signals,['SIGTERM','SIGKILL']);h.children[0].emit('close',null,'SIGKILL');await engine.drain();assert.equal(engine.jobs.size,0);
});
test('cancellation after bestmove but before exit cannot return a stale result',async()=>{
 const h=harness({exit:false}),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn}),abort=new AbortController(),pending=engine.choose(START,'normal',{signal:abort.signal});await new Promise(resolve=>setImmediate(resolve));abort.abort();await assert.rejects(pending,{status:503});await engine.drain();
});
test('legacy and strong engine calls share the existing two-search admission limit',async()=>{
 let release;const native={choose:()=>new Promise(resolve=>release=resolve),close(){},async drain(){}},computer=new ChessComputer({stockfish:native});
 const first=computer.choose(START,'normal'),second=computer.choose(START,'advanced');await assert.rejects(computer.choose(START,'grandmaster'),{status:429});release('e2e4');assert.equal(await first,'e2e4');assert.match(await second,/^[a-h][1-8][a-h][1-8][qrbn]?$/);assert.equal(computer.active,0);computer.close();await assert.rejects(computer.choose(START,'beginner'),{status:503});
});
test('unclosed cancelled native children still block legacy worker over-admission',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const h=harness({respond:false,ignoreKill:true}),native=new StockfishComputer({enabled:true,spawnProcess:h.spawn}),computer=new ChessComputer({stockfish:native});
 const a=computer.choose(START,'normal'),b=computer.choose(START,'expert'),checks=Promise.all([assert.rejects(a,{status:503}),assert.rejects(b,{status:503})]);t.mock.timers.tick(LIMITS.deadlineMs);await checks;assert.equal(computer.active,0);assert.equal(native.jobs.size,2);await assert.rejects(computer.choose(START,'beginner'),{status:429});for(const child of h.children)child.emit('close',null,'SIGKILL');await computer.drain();assert.equal(native.jobs.size,0);
});
test('ordinary writer drain waits for legacy work without cancelling its move',async()=>{
 const computer=new ChessComputer(),move=computer.choose(START,'advanced');await computer.drain();assert.match(await move,/^[a-h][1-8][a-h][1-8][qrbn]?$/);computer.close();await computer.drain();
});
test('bounded analysis returns exact current score and rejects missing or bound-only evaluation',async()=>{
 const h=harness({infoLines:['info depth 10 score cp 24 pv e2e4 e7e5']}),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});assert.deepEqual(await engine.analyze(START),{move:'e2e4',depth:10,score:{type:'cp',value:24}});assert.ok(h.children[0].commands.includes('setoption name Skill Level value 20'));assert.ok(h.children[0].commands.includes('go movetime 350 nodes 75000'));
 for(const infoLines of [[],['info depth 8 score cp 20 lowerbound pv e2e4'],['info depth 8 score cp 20 pv d2d4']]){const h=harness({infoLines}),engine=new StockfishComputer({enabled:true,spawnProcess:h.spawn});await assert.rejects(engine.analyze(START),{status:503});await engine.drain();}
});
test('review analysis shares two-slot admission with ongoing computer games',async()=>{
 let release;const native={jobs:new Set(),analyze:()=>new Promise(resolve=>release=resolve),choose:async()=> 'e2e4',close(){},async drain(){}};const c=new ChessComputer({stockfish:native});const a=c.analyze(START),b=c.choose(START,'advanced');await assert.rejects(c.analyze(START),{status:429});release({move:'e2e4',depth:8,score:{type:'cp',value:0}});await a;await b;assert.equal(c.active,0);
});
