'use strict';
const {spawn}=require('node:child_process');
const {parse,legal,uci}=require('./learning-chess');
const {profile,optionCommands}=require('./learning-chess-stockfish-profiles');
const {ADAPTIVE_LEVELS,resolveAdaptive,collectVariation,styledMove}=require('./learning-chess-adaptive-decision');
const EXECUTABLE='/usr/local/libexec/roomgoblin-stockfish/stockfish';
const LIMITS=Object.freeze({active:2,deadlineMs:5000,killDelayMs:200,outputBytes:524288,lineBytes:16384});
const unavailable=()=>Object.assign(Error('The stronger computer engine is unavailable. Your board is unchanged; try again later.'),{status:503});
function positionCommand(position,moves){
 if(typeof position!=='string'||position.length>128||/[\r\n\0]/.test(position))throw Object.assign(Error('Invalid chess position.'),{status:400});
 const state=parse(position);if(!Number.isSafeInteger(state.half)||!Number.isSafeInteger(state.full)||state.full<1)throw Object.assign(Error('Invalid chess position.'),{status:400});
 if(moves===undefined)return 'position fen '+position;
 if(!Array.isArray(moves)||moves.length>20000||moves.some(move=>typeof move!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)))throw Object.assign(Error('Invalid saved chess history.'),{status:400});
 // Integration supplies the already server-validated complete history that
 // produced position. Never use an LMS/browser position or history here.
 return 'position startpos'+(moves.length?' moves '+moves.join(' '):'');
}
class StockfishComputer{
 constructor({enabled=false,spawnProcess=spawn}={}){this.enabled=enabled===true;this.spawnProcess=spawnProcess;this.jobs=new Set();this.closed=false;}
 async choose(position,difficulty,{signal,moves,adaptive}={}){
  const command=positionCommand(position,moves),decision=ADAPTIVE_LEVELS.includes(difficulty)?resolveAdaptive(position,adaptive,difficulty):null,settings=decision?.profile||profile(difficulty),allowed=new Set(legal(parse(position)).map(uci));
  if(!allowed.size)throw Object.assign(Error('No computer move is available.'),{status:409});
  if(!this.enabled||this.closed||signal?.aborted)throw unavailable();
  if(this.jobs.size>=LIMITS.active)throw Object.assign(Error('Computer players are busy. Try your move again shortly.'),{status:429});
  let child;try{child=this.spawnProcess(EXECUTABLE,[],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],cwd:'/usr/local/libexec/roomgoblin-stockfish',env:{LANG:'C',LC_ALL:'C'}});}catch{throw unavailable();}
  let finishClose;const closed=new Promise(resolve=>finishClose=resolve),job={cancel:null,closed};this.jobs.add(job);
  return new Promise((resolve,reject)=>{
   let settled=false,ending=false,terminating=false,phase='uci',buffer='',bytes=0,result=null,deadline,killTimer;
   const variations={depth:-1,values:new Map()};
   const settle=(error,move)=>{if(settled)return;settled=true;error?reject(error):resolve(move);};
   const kill=()=>{try{child.kill('SIGKILL');}catch{}};
   const terminate=()=>{if(terminating)return;terminating=true;ending=true;try{child.stdin.end('stop\nquit\n');}catch{}try{child.kill('SIGTERM');}catch{}clearTimeout(killTimer);killTimer=setTimeout(kill,LIMITS.killDelayMs);killTimer.unref?.();};
   const fail=()=>{settle(unavailable());terminate();};job.cancel=fail;
   const send=lines=>{if(ending)return;try{child.stdin.write(lines+'\n');}catch{fail();}};
   const line=value=>{
    if(ending)return;
    if(phase==='uci'&&value==='uciok'){phase='ready';const options=optionCommands(settings.id);if(decision)options[3]='setoption name MultiPV value 3';send(options.join('\n')+'\nucinewgame\nisready');return;}
    if(phase==='ready'&&value==='readyok'){phase='search';send(command+'\ngo movetime '+settings.movetime+' nodes '+settings.nodes);return;}
    if(phase==='search'&&decision)collectVariation(variations,value);
    if(value.startsWith('bestmove ')){
     const match=/^bestmove ([a-h][1-8][a-h][1-8][qrbn]?)(?: ponder [a-h][1-8][a-h][1-8][qrbn]?)?$/.exec(value);
     if(phase!=='search'||!match||!allowed.has(match[1])){fail();return;}
     result=decision?styledMove(position,match[1],variations,decision.style):match[1];phase='quitting';ending=true;try{child.stdin.end('quit\n');}catch{fail();return;}
     killTimer=setTimeout(()=>{settle(unavailable());kill();},LIMITS.killDelayMs);killTimer.unref?.();
    }
   };
   child.stdout.on('data',chunk=>{
    if(ending)return;bytes+=chunk.length;if(bytes>LIMITS.outputBytes){fail();return;}
    buffer+=chunk.toString('utf8');let end;
    while((end=buffer.indexOf('\n'))!==-1){const current=buffer.slice(0,end).replace(/\r$/,'');buffer=buffer.slice(end+1);if(current.length>LIMITS.lineBytes){fail();return;}line(current);if(ending)return;}
    if(buffer.length>LIMITS.lineBytes)fail();
   });
   child.stderr.on('data',chunk=>{bytes+=chunk.length;if(bytes>LIMITS.outputBytes)fail();});
   child.stdin.on('error',fail);child.stdout.on('error',fail);child.stderr.on('error',fail);child.once('error',fail);
   child.once('close',(code)=>{clearTimeout(deadline);clearTimeout(killTimer);signal?.removeEventListener('abort',fail);this.jobs.delete(job);finishClose();if(!settled){if(code===0&&result)settle(null,result);else settle(unavailable());}});
   deadline=setTimeout(fail,LIMITS.deadlineMs);deadline.unref?.();signal?.addEventListener('abort',fail,{once:true});
   if(signal?.aborted)fail();else send('uci');
  });
 }
 close(){this.closed=true;for(const job of this.jobs)job.cancel();}
 async drain(){await Promise.all([...this.jobs].map(job=>job.closed));}
}
module.exports={StockfishComputer,EXECUTABLE,LIMITS,positionCommand};
