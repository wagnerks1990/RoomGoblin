'use strict';
const {Worker,isMainThread,parentPort,workerData}=require('node:worker_threads');
const {parse,legal,apply,uci,checked}=require('./learning-chess');
const LEGACY_LEVELS=Object.freeze(['beginner','standard','advanced']);
const {LEVELS:STRONG_LEVELS}=require('./learning-chess-stockfish-profiles');
const {ADAPTIVE_LEVELS}=require('./learning-chess-adaptive-decision');
const LEVELS=Object.freeze([...LEGACY_LEVELS,...STRONG_LEVELS,...ADAPTIVE_LEVELS]);
const values={p:100,n:320,b:335,r:500,q:900,k:0};
function selectMove(position,difficulty){
 if(!LEGACY_LEVELS.includes(difficulty))throw Error('Invalid chess level');
 const s=parse(position),start=performance.now(),budget=difficulty==='advanced'?180:80,maxNodes=difficulty==='advanced'?18000:5000;
 let nodes=0;const stop=Symbol('budget');
 const evaluate=s=>{let score=0;for(let i=0;i<128;i++){if(i&0x88){i+=7;continue;}const p=s.b[i];if(p==='.')continue;const sign=p===p.toUpperCase()?1:-1,type=p.toLowerCase(),central=7-Math.abs((i&7)-3.5)-Math.abs((i>>4)-3.5);score+=sign*(values[type]+(type==='k'?0:central*4)+(type==='p'?(sign===1?6-(i>>4):(i>>4)-1)*6:0));}return score*s.t;};
 const order=(s,list)=>list.sort((a,b)=>((values[s.b[b[1]].toLowerCase()]||0)+(values[b[2]]||0))-((values[s.b[a[1]].toLowerCase()]||0)+(values[a[2]]||0))||uci(a).localeCompare(uci(b)));
 function search(s,depth,alpha,beta,ply){
  if(++nodes>maxNodes||performance.now()-start>budget)throw stop;
  const moves=legal(s);if(!moves.length)return checked(s)?-100000+ply:0;if(!depth)return evaluate(s);
  let best=-Infinity;for(const m of order(s,moves)){const value=-search(apply(s,m),depth-1,-beta,-alpha,ply+1);best=Math.max(best,value);alpha=Math.max(alpha,value);if(alpha>=beta)break;}return best;
 }
 const candidates=order(s,legal(s));if(!candidates.length)throw Error('No computer move');let chosen=candidates[0];
 if(difficulty==='beginner')return uci(chosen);
 for(let depth=1;depth<=(difficulty==='advanced'?3:2);depth++){
  let next=chosen,best=-Infinity;
  try{for(const move of candidates){const value=-search(apply(s,move),depth-1,-Infinity,Infinity,1);if(value>best){best=value;next=move;}}chosen=next;}catch(e){if(e!==stop)throw e;break;}
 }
 return uci(chosen);
}
class ChessComputer{
 constructor({stockfishEnabled=process.env.ROOMGOBLIN_STOCKFISH==='1',stockfish}={}){this.active=0;this.closed=false;this.workers=new Set();this.stockfish=stockfish||new(require('./learning-chess-stockfish').StockfishComputer)({enabled:stockfishEnabled});}
 async choose(position,difficulty,options={}){
  if(!LEVELS.includes(difficulty))throw Object.assign(Error('Choose an available computer level.'),{status:400});
  if(this.closed)throw Object.assign(Error('Computer players are shutting down.'),{status:503});
  // A cancelled native process still owns capacity until its close event, even
  // if its caller has already received an error and the request has unwound.
  if(Math.max(this.active,this.workers.size+(this.stockfish.jobs?.size||0))>=2)throw Object.assign(Error('Computer players are busy. Try your move again shortly.'),{status:429});
  this.active++;let worker,timer;
  try{
   if(STRONG_LEVELS.includes(difficulty)||ADAPTIVE_LEVELS.includes(difficulty))return await this.stockfish.choose(position,difficulty,options);
   worker=new Worker(__filename,{workerData:{position,difficulty},resourceLimits:{maxOldGenerationSizeMb:48,maxYoungGenerationSizeMb:8,stackSizeMb:4}});
   this.workers.add(worker);
   return await new Promise((resolve,reject)=>{
    const unavailable=()=>reject(Object.assign(Error('Computer move was not completed. Your board is unchanged; try again.'),{status:503}));
    timer=setTimeout(unavailable,2500);worker.once('error',unavailable);worker.once('exit',code=>{if(code!==0)unavailable();});
    worker.once('message',move=>typeof move==='string'&&/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)?resolve(move):unavailable());
   });
  }finally{clearTimeout(timer);if(worker){await worker.terminate();this.workers.delete(worker);}this.active--;}
 }
 close(){this.closed=true;this.stockfish.close();for(const worker of this.workers)worker.terminate();}
 async drain(){await this.stockfish.drain();await Promise.all([...this.workers].map(worker=>new Promise(resolve=>{if(worker.threadId===-1)resolve();else worker.once('exit',resolve);})));}
}
if(!isMainThread){try{parentPort.postMessage(selectMove(workerData.position,workerData.difficulty));}catch{process.exitCode=1;}}
module.exports={ChessComputer,LEVELS,LEGACY_LEVELS,selectMove};
