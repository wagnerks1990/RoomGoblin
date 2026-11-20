'use strict';
const crypto=require('node:crypto');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const ENGINE='stockfish-15.1-4;skill20;threads1;hash32;multipv1;350ms;75000nodes;review-v2';
const fingerprint=row=>crypto.createHash('sha256').update(row.moves_json).digest('hex');
class ChessReviewInsights{
 constructor(learning,{review,available=()=>true}){this.learning=learning;this.store=learning.store;this.db=learning.db;this.review=review;this.available=available;this.pending=new Map();this.db.exec(`CREATE TABLE IF NOT EXISTS learning_chess_review_evidence(match_id TEXT NOT NULL REFERENCES learning_chess_matches(id) ON DELETE CASCADE,ply INTEGER NOT NULL,history_hash TEXT NOT NULL,engine_key TEXT NOT NULL,evidence_json TEXT NOT NULL CHECK(length(evidence_json)<32768),created_at TEXT NOT NULL,PRIMARY KEY(match_id,ply));`);}
 read(user,activityId,matchId,options={}){
  const {row}=this.review.owned(user,activityId,matchId,options),timeline=this.review.timeline(row,user.id),hash=fingerprint(row);
  const evidence=this.db.prepare('SELECT ply,evidence_json FROM learning_chess_review_evidence WHERE match_id=? AND history_hash=? AND engine_key=? ORDER BY ply LIMIT 2000').all(matchId,hash,ENGINE).map(x=>JSON.parse(x.evidence_json));
  const analyzed=new Set(evidence.map(x=>x.ply));let nextPly=0;while(nextPly<timeline.moves.length&&analyzed.has(nextPly))nextPly++;
  const moments=evidence.filter(x=>x.lossCp>=80||x.facts.length).sort((a,b)=>(b.lossCp||0)-(a.lossCp||0)||a.ply-b.ply).slice(0,3);
  const recommendations=[];if(evidence.some(x=>x.facts.some(f=>f.includes('can be captured legally'))))recommendations.push({lessonId:'queen-capture',title:'Spot the loose rook',reason:'An analyzed move left its piece legally capturable. Practice checking captures; this is not proof that the move was a mistake.'});if(evidence.some(x=>x.facts.some(f=>f.includes('fork pattern'))))recommendations.push({lessonId:'knight-fork',title:'Fork king and queen',reason:'An analyzed position contains a fork pattern. Explore how one piece can attack multiple targets.'});if(evidence.some(x=>x.facts.some(f=>f.includes('checkmate'))))recommendations.push({lessonId:'mate-in-one',title:'Finish with checkmate',reason:'A reviewed move delivered checkmate. Practice verifying that every escape is covered.'});
  return {matchId,engine:ENGINE,analyzed:evidence.length,totalPlies:timeline.moves.length,complete:nextPly>=timeline.moves.length,nextPly:nextPly<timeline.moves.length?nextPly:null,graph:evidence.map(x=>({ply:x.ply,whiteCp:x.before.score.type==='cp'?x.before.score.value*(x.ply%2?-1:1):null,mate:x.before.score.type==='mate'?x.before.score.value*(x.ply%2?-1:1):null,depth:x.before.depth})),moments,recommendations,notice:'Saved bounded engine evidence. Missing positions remain unanalyzed. The graph is from White’s perspective; positive favors White. No accuracy rating or guaranteed improvement is claimed.'};
 }
 coaching(user,activityId,options={}){
  const fresh=this.review.authorize(user,activityId,options);
  // Select only this participant's original assignment seats, even for teachers.
  const games=this.db.prepare("SELECT * FROM learning_chess_matches WHERE status='finished' AND ((white_id=? AND activity_id=?) OR (mode='multiplayer' AND black_id=? AND COALESCE(black_activity_id,activity_id)=?)) ORDER BY updated_at DESC,id DESC LIMIT 64").all(fresh.id,activityId,fresh.id,activityId);
  let remaining=512;const counts={'piece-safety-review':[0,0],'candidate-fork-review':[0,0],'king-safety-review':[0,0]};
  for(const row of games){
   if(!remaining)break;if(typeof row.moves_json!=='string'||row.moves_json.length>200000)continue;
   let moves;try{moves=JSON.parse(row.moves_json);}catch{continue;}if(!Array.isArray(moves)||moves.length>2000)continue;
   const side=row.mode==='solo'?null:row.mode==='computer'?(row.human_color==='black'?1:0):(row.white_id===fresh.id?0:1);
   const evidence=this.db.prepare('SELECT ply,evidence_json FROM learning_chess_review_evidence WHERE match_id=? AND history_hash=? AND engine_key=? ORDER BY ply LIMIT ?').all(row.id,fingerprint(row),ENGINE,remaining);remaining-=evidence.length;
   for(const saved of evidence){
    if(!Number.isSafeInteger(saved.ply)||saved.ply<0||saved.ply>=moves.length||side!==null&&saved.ply%2!==side)continue;
    let value;try{value=JSON.parse(saved.evidence_json);}catch{continue;}
    const before=value?.before,after=value?.after;
    if(value?.ply!==saved.ply||value?.played!==moves[saved.ply]||!Array.isArray(value.facts)||!value.facts.every(f=>typeof f==='string'&&f.length<=1000)||before?.score?.type!=='cp'||after?.score?.type!=='cp'||!Number.isFinite(before.score.value)||!Number.isFinite(after.score.value)||!Number.isSafeInteger(before.depth)||before.depth<1||!Number.isSafeInteger(after.depth)||after.depth<1)continue;
    const loss=Math.max(0,before.score.value+after.score.value);
    if(!Number.isFinite(value.lossCp)||value.lossCp!==loss||loss<80)continue;
    const codes=Array.isArray(value.factCodes)&&value.factCodes.length<=16?value.factCodes:[],index=side===null?1:0;
    if(codes.includes('moved-piece-capturable'))counts['piece-safety-review'][index]++;
    if(codes.includes('candidate-fork-evaluation-loss'))counts['candidate-fork-review'][index]++;
    if(codes.includes('king-neighborhood-evaluation-loss'))counts['king-safety-review'][index]++;
   }
  }
  const patterns=[],recommendations=[];
  const suggestions={
   'piece-safety-review':{lessonId:'queen-capture',title:'Check piece safety',reason:'Repeated reviewed moves combined a legal capture threat with an engine evaluation drop. Revisit capture safety; this does not prove the piece was undefended or that capture caused the loss.'},
   'candidate-fork-review':{lessonId:'knight-fork',title:'Explore fork opportunities',reason:'Repeated engine candidates offered fork patterns absent from the played moves alongside evaluation drops. Practice spotting multiple targets; these observations do not prove forced wins or missed material.'},
   'king-safety-review':{lessonId:'castle-safely',title:'Review squares around your king',reason:'Repeated moves increased attacked neighboring king squares alongside evaluation drops. Practice king safety; this does not establish causation or count legal king escapes.'}
  };
  for(const [id,[count,soloCount]] of Object.entries(counts))if(count>=3||soloCount>=3){patterns.push({id,count,practiceBothSides:soloCount});recommendations.push(suggestions[id]);}
  return {patterns,recommendations,notice:'Private reviewed evidence from at most 64 finished games and 512 analyzed positions in this assignment. Suggestions require at least three matching observations on your played side, or three separately counted solo-practice observations. Partial analysis can miss patterns; no rating, diagnosis or forced line is inferred.'};
 }
 async advance(user,activityId,matchId,{teacher=false}={}){
  if(!this.available())fail(423,'Game review is temporarily unavailable.');const {row}=this.review.owned(user,activityId,matchId,{teacher});const key=matchId+':'+fingerprint(row);
  if(this.pending.has(key))fail(409,'This game is already being analyzed. Refresh its progress shortly.');if(this.pending.size>=2)fail(429,'Game review is busy. Try again shortly.');
  this.pending.set(key,true);try{
   let state=this.read(user,activityId,matchId,{teacher});for(let n=0;n<3&&state.nextPly!==null;n++){
    const evidence=await this.review.analyze(user,activityId,matchId,{teacher,ply:state.nextPly});
    this.store.tx(()=>{if(!this.available())fail(423,'Game review is temporarily unavailable.');const fresh=this.review.owned(user,activityId,matchId,{teacher}).row;if(fresh.revision!==row.revision||fresh.moves_json!==row.moves_json)fail(409,'Saved game changed during analysis.');const json=JSON.stringify(evidence);if(json.length>=32768)fail(409,'Review evidence exceeded its bound.');this.db.prepare('INSERT INTO learning_chess_review_evidence(match_id,ply,history_hash,engine_key,evidence_json,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(match_id,ply) DO UPDATE SET history_hash=excluded.history_hash,engine_key=excluded.engine_key,evidence_json=excluded.evidence_json,created_at=excluded.created_at').run(matchId,evidence.ply,fingerprint(row),ENGINE,json,new Date().toISOString());this.learning.event(user,activityId,'chess.review.evidence',matchId,{ply:evidence.ply,engine:ENGINE});});
    state=this.read(user,activityId,matchId,{teacher});
   }return state;
  }finally{this.pending.delete(key);}
 }
}
module.exports={ChessReviewInsights,ENGINE};
