'use strict';
// Bounded, local classroom adaptation. No model training, telemetry, public
// ratings, player identification by reported name, or live multiplayer advice.
const crypto=require('node:crypto');
const {legal,uci}=require('./learning-chess');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const UCI=/^[a-h][1-8][a-h][1-8][qrbn]?$/;
const ENDINGS=new Set(['checkmate','stalemate','insufficient material','dead position','automatic draw','threefold repetition','fifty-move rule','agreement']);
const STYLES=new Set(['balanced','attacking','solid','exploratory']);
const FIXED_BANDS=Object.freeze({beginner:0,standard:1,advanced:2,normal:0,intermediate:1,'stockfish-advanced':2,expert:3,master:4,grandmaster:5});
const NOTICE='Private adaptive practice uses recent eligible game outcomes, not a measured chess rating. Assisted, unfinished, forfeited and timed-out games do not estimate strength.';
function movesOf(row){
 if(typeof row?.moves_json!=='string'||row.moves_json.length>200000)fail(409,'Saved chess history exceeds its supported bound.');
 let moves;try{moves=JSON.parse(row.moves_json);}catch{fail(409,'Saved chess history is invalid.');}
 if(!Array.isArray(moves)||moves.length>20000||moves.some(move=>typeof move!=='string'||!UCI.test(move)))fail(409,'Saved chess history is invalid.');return moves;
}
function habits(moves,side){const own=moves.filter((_move,i)=>i%2===(side==='white'?0:1)),opening=own.slice(0,8);return {ownMoves:own.length,openingMoves:opening.length,centerMoves:opening.filter(move=>['d4','e4','d5','e5'].includes(move.slice(2,4))).length};}
class ChessAdaptive{
 constructor(learning,{chess=learning.chess,available=()=>true}={}){
  this.learning=learning;this.store=learning.store;this.db=learning.db;this.chess=chess;this.available=available;
  this.db.exec(`CREATE TABLE IF NOT EXISTS learning_chess_adaptive_provenance(
   match_id TEXT PRIMARY KEY REFERENCES learning_chess_matches(id) ON DELETE CASCADE,
   known INTEGER NOT NULL CHECK(known IN (0,1)),assisted INTEGER NOT NULL CHECK(assisted IN (0,1)),last_revision INTEGER,last_decision_json TEXT,start_decision_json TEXT,band_sum INTEGER NOT NULL DEFAULT 0,band_turns INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS learning_chess_adaptive_receipts(
   match_id TEXT PRIMARY KEY REFERENCES learning_chess_matches(id) ON DELETE CASCADE,
   fingerprint TEXT NOT NULL,completed_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS learning_chess_adaptive_quarantine(
   match_id TEXT PRIMARY KEY REFERENCES learning_chess_matches(id) ON DELETE CASCADE,
   history_fingerprint TEXT NOT NULL,reason TEXT NOT NULL CHECK(reason='invalid-history'));
   CREATE TABLE IF NOT EXISTS learning_chess_adaptive_samples(
   match_id TEXT NOT NULL REFERENCES learning_chess_adaptive_receipts(match_id) ON DELETE CASCADE,
   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   activity_id TEXT NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
   eligible INTEGER NOT NULL CHECK(eligible IN (0,1)),exclusion TEXT NOT NULL,
   score REAL,challenge_band REAL NOT NULL DEFAULT 1,own_moves INTEGER NOT NULL,opening_moves INTEGER NOT NULL,center_moves INTEGER NOT NULL,
   completed_at TEXT NOT NULL,PRIMARY KEY(match_id,user_id,activity_id));
   CREATE INDEX IF NOT EXISTS learning_chess_adaptive_own ON learning_chess_adaptive_samples(user_id,activity_id,completed_at DESC);
   CREATE INDEX IF NOT EXISTS learning_chess_adaptive_recent ON learning_chess_adaptive_samples(eligible,completed_at DESC);
   CREATE INDEX IF NOT EXISTS learning_chess_adaptive_pending ON learning_chess_matches(status,updated_at,id);`);
  const columns=new Set(this.db.prepare('PRAGMA table_info(learning_chess_adaptive_provenance)').all().map(column=>column.name));
  if(!columns.has('last_revision'))this.db.exec('ALTER TABLE learning_chess_adaptive_provenance ADD COLUMN last_revision INTEGER');
  if(!columns.has('last_decision_json'))this.db.exec('ALTER TABLE learning_chess_adaptive_provenance ADD COLUMN last_decision_json TEXT');
  if(!columns.has('start_decision_json'))this.db.exec('ALTER TABLE learning_chess_adaptive_provenance ADD COLUMN start_decision_json TEXT');
  if(!columns.has('band_sum'))this.db.exec('ALTER TABLE learning_chess_adaptive_provenance ADD COLUMN band_sum INTEGER NOT NULL DEFAULT 0');
  if(!columns.has('band_turns'))this.db.exec('ALTER TABLE learning_chess_adaptive_provenance ADD COLUMN band_turns INTEGER NOT NULL DEFAULT 0');
  if(!this.db.prepare('PRAGMA table_info(learning_chess_adaptive_samples)').all().some(column=>column.name==='challenge_band'))this.db.exec('ALTER TABLE learning_chess_adaptive_samples ADD COLUMN challenge_band REAL NOT NULL DEFAULT 1');
 }
 writable(){if(!this.available())fail(423,'Adaptive practice is temporarily unavailable while the application is saving or shutting down.');}
 authorize(user,activityId,options={}){
  const fresh=user?.id&&this.db.prepare('SELECT id,username,display_name displayName,role,profile_id profileId,enabled FROM users WHERE id=? AND enabled=1').get(user.id);if(!fresh)fail(401,'Your practice connection is no longer authorized.');
  const direct=this.db.prepare('SELECT activity_id,revoked FROM learning_direct_participants WHERE user_id=?').get(fresh.id);
  if(direct){if(direct.activity_id!==activityId||direct.revoked||!this.learning.direct.available(activityId))fail(401,'Your practice connection is no longer authorized.');fresh.directParticipant=true;}
  this.chess.authorize(fresh,activityId,false,options);return fresh;
 }
 trackMatch(matchId){
  this.writable();return this.store.tx(()=>{const row=this.chess.row(matchId);if(!row)return false;const moves=movesOf(row),known=moves.length===0;
   const own=this.own(row.white_id,row.activity_id),initial=row.mode==='computer'&&row.difficulty==='adaptive-practice'?JSON.stringify({band:own.band,style:require('./learning-chess-adaptive-decision').PERSONALITIES[row.personality||'dynamic']||(own.eligibleGames>=3?own.style:this.aggregateStyle()),confidence:own.confidence}):null;
   return !!this.db.prepare('INSERT OR IGNORE INTO learning_chess_adaptive_provenance(match_id,known,assisted,start_decision_json) VALUES(?,?,0,?)').run(row.id,Number(known),initial).changes;
  });
 }
 markAssisted(matchId){
  this.writable();return this.store.tx(()=>{if(!this.chess.row(matchId))return false;
   this.db.prepare('INSERT INTO learning_chess_adaptive_provenance(match_id,known,assisted) VALUES(?,0,1) ON CONFLICT(match_id) DO UPDATE SET assisted=1').run(matchId);
   // If a terminal result was already summarized, safely remove its former
   // strength evidence before exposing the newly marked assisted result.
   this.db.prepare("UPDATE learning_chess_adaptive_samples SET eligible=0,exclusion='assisted',score=NULL WHERE match_id=?").run(matchId);return true;
  });
 }
 saveDecision(matchId,decision){
  this.writable();if(!Number.isSafeInteger(decision?.band)||decision.band<0||decision.band>5||!STYLES.has(decision.style))fail(400,'Use a bounded server-owned adaptive decision.');
  return this.store.tx(()=>{const row=this.chess.row(matchId);if(!row||row.mode!=='computer')return null;
   const value={band:decision.band,style:decision.style,revision:row.revision};
   const prior=this.db.prepare('SELECT last_revision,last_decision_json FROM learning_chess_adaptive_provenance WHERE match_id=?').get(matchId);
   if(prior?.last_revision!==null&&prior?.last_revision!==undefined&&prior.last_revision>=row.revision){if(prior.last_decision_json===JSON.stringify(value))return value;fail(409,'That confirmed turn already has its adaptive decision.');}
   this.db.prepare('INSERT INTO learning_chess_adaptive_provenance(match_id,known,assisted,last_revision,last_decision_json,band_sum,band_turns) VALUES(?,0,0,?,?,?,1) ON CONFLICT(match_id) DO UPDATE SET last_revision=excluded.last_revision,last_decision_json=excluded.last_decision_json,band_sum=band_sum+excluded.band_sum,band_turns=band_turns+1').run(matchId,row.revision,JSON.stringify(value),decision.band);return value;
  });
 }
 lastDecision(user,activityId,matchId,options={}){
  const fresh=this.authorize(user,activityId,options),row=this.chess.row(matchId);
  if(!row||row.mode!=='computer'||row.white_id!==fresh.id||row.activity_id!==activityId)fail(404,'Your computer practice game was not found.');
  const saved=this.db.prepare('SELECT last_decision_json FROM learning_chess_adaptive_provenance WHERE match_id=?').get(matchId);if(!saved?.last_decision_json)return null;
  try{const value=JSON.parse(saved.last_decision_json);return Number.isSafeInteger(value.band)&&value.band>=0&&value.band<=5&&STYLES.has(value.style)?{band:value.band,style:value.style,revision:value.revision}:null;}catch{return null;}
 }
 recordCompleted(matchId){
  this.writable();return this.store.tx(()=>{
   const row=this.chess.row(matchId);if(!row||row.status!=='finished')return {recorded:false,reason:'unfinished'};
   const moves=movesOf(row),provenance=this.db.prepare('SELECT known,assisted,band_sum,band_turns FROM learning_chess_adaptive_provenance WHERE match_id=?').get(matchId);
   // An explicit successful retry after operator repair clears quarantine in the
   // same transaction as the evidence. Automatic sweeps never retry bad history.
   this.db.prepare('DELETE FROM learning_chess_adaptive_quarantine WHERE match_id=?').run(matchId);
   const fingerprint=crypto.createHash('sha256').update(JSON.stringify([row.mode,row.result,row.reason,row.revision,moves,provenance||null])).digest('hex');
   const prior=this.db.prepare('SELECT fingerprint FROM learning_chess_adaptive_receipts WHERE match_id=?').get(matchId);if(prior?.fingerprint===fingerprint)return {recorded:false,reason:'already-recorded'};
   if(prior)this.db.prepare('DELETE FROM learning_chess_adaptive_receipts WHERE match_id=?').run(matchId);
   const at=row.updated_at;this.db.prepare('INSERT INTO learning_chess_adaptive_receipts(match_id,fingerprint,completed_at) VALUES(?,?,?)').run(matchId,fingerprint,at);
   let exclusion='';
   if(row.mode==='solo')exclusion='solo';
   else if(provenance?.assisted)exclusion='assisted';
   else if(row.mode==='computer'&&!provenance?.known)exclusion='unknown-assistance';
   else if(!['multiplayer','computer'].includes(row.mode)||!['white','black','draw'].includes(row.result)||!ENDINGS.has(row.reason)||moves.length<2||row.mode==='multiplayer'&&!row.black_id)exclusion='non-strength-ending';
   const eligible=!exclusion;
   const priorBands=row.mode==='multiplayer'?{white:this.own(row.white_id,row.activity_id).band,black:row.black_id?this.own(row.black_id,row.black_activity_id||row.activity_id).band:1}:null;
   const computerBand=provenance?.band_turns?provenance.band_sum/provenance.band_turns:FIXED_BANDS[row.difficulty]??1;
   for(const side of row.mode==='multiplayer'?['white','black']:['white']){
    const userId=row[side+'_id'],activityId=side==='white'?row.activity_id:row.black_activity_id||row.activity_id;if(!userId||!activityId)continue;
    const playedSide=row.mode==='computer'?(row.human_color||'white'):side;
    const h=habits(moves,playedSide),score=eligible?(row.result==='draw'?0.5:row.result===playedSide?1:0):null;
    const challengeBand=row.mode==='multiplayer'?priorBands[side==='white'?'black':'white']:computerBand;
    this.db.prepare('INSERT INTO learning_chess_adaptive_samples(match_id,user_id,activity_id,eligible,exclusion,score,challenge_band,own_moves,opening_moves,center_moves,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(matchId,userId,activityId,Number(eligible),exclusion,score,challengeBand,h.ownMoves,h.openingMoves,h.centerMoves,at);
   }
   this.learning.event({id:null},row.activity_id,'chess.adaptive.record',matchId,{eligible,exclusion:exclusion||null,corrected:!!prior});
   return {recorded:true,eligible,exclusion:exclusion||null};
  });
 }
 backfill({limit=25}={}){
  this.writable();if(!Number.isSafeInteger(limit)||limit<1||limit>50)fail(400,'Adaptive backfill accepts between 1 and 50 games.');
  const rows=this.db.prepare("SELECT m.id FROM learning_chess_matches m LEFT JOIN learning_chess_adaptive_receipts r ON r.match_id=m.id LEFT JOIN learning_chess_adaptive_quarantine q ON q.match_id=m.id WHERE m.status='finished' AND r.match_id IS NULL AND q.match_id IS NULL ORDER BY m.updated_at,m.id LIMIT ?").all(limit);
  let recorded=0;for(const row of rows){
   // Validate only history here, so audit/storage errors from recordCompleted
   // remain visible and are never misclassified as corrupt game data.
   const match=this.chess.row(row.id);let invalid=false;try{movesOf(match);}catch(error){if(error.status!==409)throw error;invalid=true;}
   if(invalid){this.store.tx(()=>{
    const fingerprint=crypto.createHash('sha256').update(String(match.moves_json)).digest('hex');
    this.db.prepare("INSERT INTO learning_chess_adaptive_quarantine(match_id,history_fingerprint,reason) VALUES(?,?,'invalid-history')").run(match.id,fingerprint);
    this.learning.event({id:null},match.activity_id,'chess.adaptive.quarantine',match.id,{reason:'invalid-history'});
   });continue;}
   if(this.recordCompleted(row.id).recorded)recorded++;
  }return {scanned:rows.length,recorded,limit};
 }
 own(userId,activityId){
  const rows=this.db.prepare('SELECT eligible,exclusion,score,challenge_band,own_moves,opening_moves,center_moves FROM learning_chess_adaptive_samples WHERE user_id=? AND activity_id=? ORDER BY completed_at DESC,match_id DESC LIMIT 64').all(userId,activityId),eligible=rows.filter(row=>row.eligible);
  let weighted=0,weight=0,challenge=0;for(let i=0;i<eligible.length;i++){const w=Math.pow(0.94,i);weighted+=eligible[i].score*w;weight+=w;challenge+=Math.max(0,Math.min(5,eligible[i].challenge_band+(eligible[i].score-0.5)*2))*w;}
  const success=weight?weighted/weight:0.5;
  // Two neutral prior samples temper early evidence. More games alone never add
  // strength; outcome targets are relative to the actual opponent challenge.
  const band=eligible.length?Math.max(0,Math.min(5,Math.round((2+challenge)/(2+weight)))):1;
  const opening=eligible.reduce((sum,row)=>sum+row.opening_moves,0),center=eligible.reduce((sum,row)=>sum+row.center_moves,0);
  let style='balanced';if(eligible.length>=3){if(success<0.35)style='solid';else if(success>0.7)style='attacking';else if(opening&&center/opening<0.15)style='exploratory';}
  const recommendations=eligible.length>=3&&success<0.35?['escape-check','mate-in-one']:['castle-safely','en-passant','promote-pawn'];
  return {band,style,confidence:eligible.length<3?'new':eligible.length<12?'developing':'established',recentGames:rows.length,eligibleGames:eligible.length,assistedGames:rows.filter(r=>r.exclusion==='assisted').length,excludedGames:rows.length-eligible.length,window:64,recommendations,recommendationReason:eligible.length>=3&&success<0.35?'Review king safety and finishing patterns after recent difficult results. These results do not diagnose a specific mistake.':'Optional rules practice; no specific weakness is inferred.'};
 }
 aggregateStyle(){
  const rows=this.db.prepare('SELECT match_id,user_id,opening_moves,center_moves FROM learning_chess_adaptive_samples WHERE eligible=1 ORDER BY completed_at DESC,match_id DESC LIMIT 2048').all();
  if(new Set(rows.map(row=>row.match_id)).size<10||new Set(rows.map(row=>row.user_id)).size<5)return 'balanced';
  const opening=rows.reduce((sum,row)=>sum+row.opening_moves,0),center=rows.reduce((sum,row)=>sum+row.center_moves,0);
  return opening&&center/opening<0.15?'exploratory':'balanced';
 }
 profile(user,activityId,options={}){
  const fresh=this.authorize(user,activityId,options),own=this.own(fresh.id,activityId),reviewCoaching=this.learning.chessInsights?.coaching(fresh,activityId,options);return {...own,...(reviewCoaching?{reviewCoaching,recommendations:[...new Set([...own.recommendations,...reviewCoaching.recommendations.map(item=>item.lessonId)])]}:{}),notice:NOTICE,scope:'This participant in this assignment',rating:null};
 }
 decision(user,activityId,match,postHumanMoves,options={}){
  this.writable();const fresh=this.authorize(user,activityId,options),row=this.chess.row(match?.id);
  if(!row||row.mode!=='computer'||row.status!=='active'||row.white_id!==fresh.id||row.activity_id!==activityId)fail(404,'Your active computer practice game was not found.');
  if(row.revision!==match.revision)fail(409,'Your practice game changed. Refresh before moving.');
  const saved=movesOf(row);
  if(!Array.isArray(postHumanMoves)||postHumanMoves.length!==saved.length+1||!saved.every((move,i)=>postHumanMoves[i]===move)||!UCI.test(postHumanMoves.at(-1)||''))fail(409,'Use the server-confirmed practice history.');
  const state=this.chess.state(row);if(state.t!==(row.human_color==='black'?-1:1)||!legal(state).some(move=>uci(move)===postHumanMoves.at(-1)))fail(409,'The human move is not legal in this practice position.');
  const own=this.own(fresh.id,activityId);
  let selected={band:own.band,style:own.eligibleGames>=3?own.style:this.aggregateStyle(),confidence:own.confidence};
  if(row.difficulty==='adaptive-practice'){
   // Missing historical provenance uses a stable neutral fallback; a GET or
   // move-decision read must never silently write a new game baseline.
   selected={band:1,style:'balanced',confidence:'new'};
   const saved=this.db.prepare('SELECT start_decision_json FROM learning_chess_adaptive_provenance WHERE match_id=?').get(row.id);
   try{const value=JSON.parse(saved?.start_decision_json||'null');if(Number.isSafeInteger(value?.band)&&value.band>=0&&value.band<=5&&STYLES.has(value.style))selected={band:value.band,style:value.style,confidence:['new','developing','established'].includes(value.confidence)?value.confidence:'new'};}catch{}
  }
  const personality=require('./learning-chess-adaptive-decision').PERSONALITIES[row.personality||'dynamic'];if(personality)selected.style=personality;
  return {...selected,...(row.human_color==='black'?{humanColor:'black'}:{}),basis:row.difficulty==='adaptive-practice'?'Private practice snapshot at game creation':'Recent private classroom practice',notice:NOTICE};
 }
}
module.exports={ChessAdaptive};
