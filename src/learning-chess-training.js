'use strict';
// Original, fixed-position teaching drills. Never reads or writes a live match.
const crypto=require('node:crypto');
const {parse,fen,legal,apply,uci,checked}=require('./learning-chess');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NOTICE='Private guided practice only. Assistance is recorded; drills do not change grades, competitive results or chess ratings.';
const LESSONS=[
 {id:'escape-check',title:'Move your king out of check',stage:'Safety',concept:'Check and legal replies',objective:'Move the white king to a safe square.',description:'The rook attacks your king along the e-file. A legal reply must remove that attack.',evidence:'Choose a legal king escape while recognizing that staying on the attacked file does not answer check.',fen:'k3r3/8/8/8/8/8/8/4K3 w - - 0 1',example:'e1d1',hints:['Trace the black rook’s file to your king.','Look for a king move onto a neighboring file.','Try moving the king from e1 to d1.'],goal:(s,m,n)=>s.b[m[0]]==='K'&&!checked(n,s.t),success:'Your king is no longer attacked. Answering check is required before pursuing another plan.'},
 {id:'castle-safely',title:'Castle with king and rook',stage:'Special rules',concept:'Castling',objective:'Castle White’s king on either side.',description:'Both castling rights are available in this prepared position. Check the empty path and the king’s safety.',evidence:'Use a legal two-square king move that also moves the rook.',fen:'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1',example:'e1g1',hints:['Castling moves the king and one rook in the same turn.','Select the king, then a destination two files away.','Try moving the king from e1 to g1; the rook moves from h1 to f1.'],goal:(_s,m)=>m[3]==='castle',success:'Both pieces moved correctly. Castling is legal only with the required rights, clear path and safe king squares.'},
 {id:'en-passant',title:'Capture en passant',stage:'Special rules',concept:'En passant',objective:'Use White’s immediate en-passant opportunity.',description:'Black has just advanced its pawn from d7 to d5. The saved position includes the one-turn en-passant right.',evidence:'Capture the passed pawn on its correct square despite an initially empty destination.',fen:'4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',example:'e5d6',hints:['The opportunity exists only immediately after the two-square pawn advance.','The white pawn can move diagonally to the square the black pawn crossed.','Move e5 to d6. The black pawn on d5 is removed.'],goal:(_s,m)=>m[3]==='ep',success:'The pawn on d5 was captured while your pawn moved to d6. This special right cannot be saved for a later turn.'},
 {id:'promote-pawn',title:'Choose a promotion',stage:'Endgames',concept:'Pawn promotion',objective:'Promote the white pawn to any legal promotion piece.',description:'A pawn reaching the last rank must become a queen, rook, bishop or knight.',evidence:'Submit a legal promotion with an explicit piece choice.',fen:'4k3/P7/8/8/8/8/8/4K3 w - - 0 1',example:'a7a8q',hints:['Find the pawn that is one step from the last rank.','Choose a promotion piece before moving the pawn.','Move a7 to a8 and choose queen, rook, bishop or knight.'],goal:(_s,m)=>!!m[2],success:'Your promotion choice was applied. A queen is common, but a different piece can be useful in some positions.'},
 {id:'mate-in-one',title:'Finish with checkmate',stage:'Endgames',concept:'Queen-and-king coordination',objective:'Deliver checkmate in one move.',description:'Coordinate the queen with the nearby king. A checking move is not enough if the opponent still has an escape.',evidence:'Reach a server-verified position with check and no legal reply.',fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1',example:'g6g7',hints:['Find a checking square that also covers the black king’s escape squares.','Your king can protect a queen placed diagonally next to it.','Try Qg7: move the queen from g6 to g7.'],goal:(_s,_m,n)=>checked(n)&&legal(n).length===0,success:'Checkmate: the black king is attacked and has no legal reply. This is distinct from stalemate, where the king is not in check.'},
 {id:'knight-fork',title:'Fork king and queen',stage:'Tactics',concept:'Knight fork',objective:'Use the knight to attack Black’s king and queen at once.',description:'A knight can attack two valuable targets from one landing square. Find the checking fork in this prepared position.',evidence:'Create a legal knight check that simultaneously attacks the queen; this drill does not claim a searched best continuation.',fen:'4k3/7q/8/7N/8/8/8/K7 w - - 0 1',example:'h5f6',hints:['Compare the knight’s L-shaped destinations with both black pieces.','Look for a destination that checks the king; then inspect its other attacks.','Try Nf6+: move the knight from h5 to f6.'],goal:(s,m,n)=>s.b[m[0]]==='N'&&checked(n)&&[-33,-31,-18,-14,14,18,31,33].some(d=>n.b[m[1]+d]==='q'),success:'The knight attacks both king and queen. Because the king is in check, Black must answer the check before making another plan.'},
];
const LESSON_MAP=new Map(LESSONS.map(lesson=>[lesson.id,lesson]));
for(const lesson of LESSONS){const s=parse(lesson.fen),m=legal(s).find(m=>uci(m)===lesson.example);if(!m||!lesson.goal(s,m,apply(s,m)))throw Error('Invalid authored chess lesson: '+lesson.id);Object.freeze(lesson.hints);Object.freeze(lesson);}

function input(body,fields){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==fields.length||fields.some(k=>!Object.hasOwn(body,k)))fail(400,'Use only the documented training request fields.');
 let bytes;try{bytes=Buffer.byteLength(JSON.stringify(body));}catch{fail(400,'Invalid training request.');}
 if(bytes>1024||typeof body.requestId!=='string'||!UUID.test(body.requestId)||!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>=1000000000)fail(400,'Provide the current training revision and a request UUID.');
}
const fingerprint=(action,body)=>crypto.createHash('sha256').update(JSON.stringify([action,body.revision,body.lessonId||null,body.move||null])).digest('hex');

class ChessTraining{
 constructor(learning,{chess=learning.chess,available=()=>true}={}){
  this.learning=learning;this.store=learning.store;this.db=learning.db;this.chess=chess;this.available=available;this.rates=new Map();
  this.db.exec(`CREATE TABLE IF NOT EXISTS learning_chess_training(
   user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
   activity_id TEXT NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
   lesson_id TEXT NOT NULL,lesson_version INTEGER NOT NULL DEFAULT 1,
   session_id TEXT NOT NULL UNIQUE,revision INTEGER NOT NULL,
   status TEXT NOT NULL CHECK(status IN ('active','solved')),hint_level INTEGER NOT NULL DEFAULT 0,
   session_attempts INTEGER NOT NULL DEFAULT 0,total_attempts INTEGER NOT NULL DEFAULT 0,
   completions INTEGER NOT NULL DEFAULT 0,unassisted_completions INTEGER NOT NULL DEFAULT 0,
   assisted_completions INTEGER NOT NULL DEFAULT 0,first_try_completions INTEGER NOT NULL DEFAULT 0,
   best_hint_level INTEGER,solved_fen TEXT,last_move TEXT,feedback TEXT NOT NULL DEFAULT '',
   last_request_id TEXT NOT NULL,last_fingerprint TEXT NOT NULL,last_response_json TEXT NOT NULL,
   updated_at TEXT NOT NULL,PRIMARY KEY(user_id,activity_id,lesson_id),
   CHECK(hint_level BETWEEN 0 AND 3),CHECK(length(last_response_json)<=32768));
   CREATE INDEX IF NOT EXISTS learning_chess_training_scope ON learning_chess_training(activity_id,user_id);`);
 }
 authorize(user,activityId,write,options){
  if(write&&!this.available())fail(423,'Training is temporarily unavailable while the application is saving or shutting down.');
  const fresh=user?.id&&this.db.prepare('SELECT id,username,display_name displayName,role,profile_id profileId,enabled FROM users WHERE id=? AND enabled=1').get(user.id);
  if(!fresh)fail(401,'Your training connection is no longer authorized.');
  const participant=this.db.prepare('SELECT activity_id,revoked FROM learning_direct_participants WHERE user_id=?').get(fresh.id);
  if(participant){if(participant.activity_id!==activityId||participant.revoked||!this.learning.direct.available(activityId))fail(401,'Your training connection is no longer authorized.');fresh.directParticipant=true;}
  this.chess.authorize(fresh,activityId,write,options);return fresh;
 }
 row(userId,activityId,lessonId){return this.db.prepare('SELECT * FROM learning_chess_training WHERE user_id=? AND activity_id=? AND lesson_id=?').get(userId,activityId,lessonId);}
 totals(row){return {attempts:row?.total_attempts||0,completions:row?.completions||0,unassistedCompletions:row?.unassisted_completions||0,assistedCompletions:row?.assisted_completions||0,firstTryCompletions:row?.first_try_completions||0,bestHintLevel:row?.best_hint_level??null,lastPracticedAt:row?.updated_at||null};}
 project(row){
  const lesson=LESSON_MAP.get(row.lesson_id);if(!lesson||row.lesson_version!==1)fail(409,'This lesson has changed. Start its current version again.');
  const state=parse(row.solved_fen||lesson.fen);
  return {session:{id:row.session_id,lessonId:row.lesson_id,revision:row.revision,status:row.status,fen:fen(state),turn:state.t===1?'white':'black',legalMoves:row.status==='active'?legal(state).map(uci):[],inCheck:checked(state),attempts:row.session_attempts,hintLevel:row.hint_level,hints:lesson.hints.slice(0,row.hint_level),feedback:row.feedback,lastMove:row.last_move,assisted:row.hint_level>0},progress:this.totals(row),notice:NOTICE};
 }
 catalogue(user,activityId,options={}){
  const fresh=this.authorize(user,activityId,false,options);
  return {version:1,notice:NOTICE,lessons:LESSONS.map(lesson=>{const row=this.row(fresh.id,activityId,lesson.id);return {id:lesson.id,title:lesson.title,stage:lesson.stage,concept:lesson.concept,objective:lesson.objective,description:lesson.description,evidence:lesson.evidence,revision:row?.revision||0,progress:this.totals(row),session:row?this.project(row).session:null};})};
 }
 progress(user,activityId,options={}){return this.catalogue(user,activityId,options);}
 replay(row,body,action){
  if(row?.last_request_id!==body.requestId)return null;
  if(row.last_fingerprint!==fingerprint(action,body))fail(409,'That request ID already belongs to a different training action.');
  return JSON.parse(row.last_response_json);
 }
 budget(userId){
  const now=performance.now();for(const [id,bucket]of this.rates)if(now-bucket.at>=60000)this.rates.delete(id);
  let bucket=this.rates.get(userId);if(!bucket){if(this.rates.size>=512)fail(429,'Training is busy. Try again shortly.');bucket={at:now,count:0};this.rates.set(userId,bucket);}
  if(bucket.count>=60)fail(429,'Take a moment to review the lesson before trying again.');bucket.count++;
 }
 saveReply(user,activityId,lessonId,body,action,details){
  const row=this.row(user.id,activityId,lessonId),reply=this.project(row),json=JSON.stringify(reply);
  if(json.length>32768)fail(409,'Training response exceeds its supported bound.');
  this.db.prepare('UPDATE learning_chess_training SET last_request_id=?,last_fingerprint=?,last_response_json=? WHERE user_id=? AND activity_id=? AND lesson_id=?').run(body.requestId,fingerprint(action,body),json,user.id,activityId,lessonId);
  this.learning.event(user,activityId,'chess.training.'+action,row.session_id,{lessonId,revision:row.revision,...details});return reply;
 }
 startLesson(user,activityId,body,options={}){
  input(body,['lessonId','revision','requestId']);const lesson=LESSON_MAP.get(body.lessonId);if(!lesson)fail(404,'Choose an available chess lesson.');
  return this.store.tx(()=>{
   const fresh=this.authorize(user,activityId,true,options),row=this.row(fresh.id,activityId,lesson.id),replay=this.replay(row,body,'start');if(replay)return replay;
   if((row?.revision||0)!==body.revision)fail(409,'Your lesson changed. Refresh before restarting.');this.budget(fresh.id);
   const sessionId=crypto.randomUUID(),at=new Date().toISOString();
   if(row){const changed=this.db.prepare("UPDATE learning_chess_training SET session_id=?,revision=revision+1,status='active',hint_level=0,session_attempts=0,solved_fen=NULL,last_move=NULL,feedback='',updated_at=? WHERE user_id=? AND activity_id=? AND lesson_id=? AND revision=?").run(sessionId,at,fresh.id,activityId,lesson.id,body.revision);if(!changed.changes)fail(409,'Your lesson changed. Refresh before restarting.');}
   else this.db.prepare("INSERT INTO learning_chess_training(user_id,activity_id,lesson_id,session_id,revision,status,last_request_id,last_fingerprint,last_response_json,updated_at) VALUES(?,?,?,?,1,'active',?,?,?,?)").run(fresh.id,activityId,lesson.id,sessionId,body.requestId,'','{}',at);
   return this.saveReply(fresh,activityId,lesson.id,body,'start',{reset:!!row});
  });
 }
 mutate(user,activityId,sessionId,body,action,options){
  input(body,action==='attempt'?['revision','requestId','move']:['revision','requestId']);if(typeof sessionId!=='string'||!UUID.test(sessionId))fail(404,'Your training session was not found.');
  if(action==='attempt'&&(typeof body.move!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(body.move)))fail(400,'Provide a UCI chess move.');
  return this.store.tx(()=>{
   const fresh=this.authorize(user,activityId,true,options),row=this.db.prepare('SELECT * FROM learning_chess_training WHERE session_id=? AND user_id=? AND activity_id=?').get(sessionId,fresh.id,activityId);
   if(!row)fail(404,'Your training session was not found.');const replay=this.replay(row,body,action);if(replay)return replay;
   if(row.revision!==body.revision||row.status!=='active')fail(409,'Your lesson changed or is complete. Refresh or start a new attempt.');
   const lesson=LESSON_MAP.get(row.lesson_id);if(!lesson||row.lesson_version!==1)fail(409,'This lesson version is unavailable.');
   if(row.session_attempts>=100||row.total_attempts>=1000000000||row.completions>=1000000000)fail(409,'Start a fresh lesson attempt or ask your teacher for help.');
   const at=new Date().toISOString();let details={},changed;
   if(action==='hint'){
    if(row.hint_level>=lesson.hints.length)fail(409,'All three hints have already been revealed.');this.budget(fresh.id);
    changed=this.db.prepare('UPDATE learning_chess_training SET hint_level=hint_level+1,revision=revision+1,updated_at=? WHERE session_id=? AND revision=?').run(at,sessionId,row.revision);details={hintLevel:row.hint_level+1,assisted:true};
   }else{
    const state=parse(lesson.fen),move=legal(state).find(m=>uci(m)===body.move);if(!move)fail(409,'That move is not legal in this lesson position. Your king must remain safe.');
    const next=apply(state,move),correct=!!lesson.goal(state,move,next),assisted=row.hint_level>0;this.budget(fresh.id);
    changed=this.db.prepare(`UPDATE learning_chess_training SET revision=revision+1,session_attempts=session_attempts+1,total_attempts=total_attempts+1,status=?,solved_fen=?,last_move=?,feedback=?,completions=completions+?,unassisted_completions=unassisted_completions+?,assisted_completions=assisted_completions+?,first_try_completions=first_try_completions+?,best_hint_level=?,updated_at=? WHERE session_id=? AND revision=?`).run(correct?'solved':'active',correct?fen(next):null,body.move,correct?lesson.success:'That move is legal, but it does not meet this lesson’s objective. The starting position is restored so you can try again.',Number(correct),Number(correct&&!assisted),Number(correct&&assisted),Number(correct&&!assisted&&row.session_attempts===0),correct?Math.min(row.best_hint_level??3,row.hint_level):row.best_hint_level,at,sessionId,row.revision);details={correct,assisted};
   }
   if(!changed?.changes)fail(409,'Your lesson changed. Refresh before continuing.');
   return this.saveReply(fresh,activityId,row.lesson_id,body,action,details);
  });
 }
 attempt(user,activityId,sessionId,body,options={}){return this.mutate(user,activityId,sessionId,body,'attempt',options);}
 hint(user,activityId,sessionId,body,options={}){return this.mutate(user,activityId,sessionId,body,'hint',options);}
}
module.exports={ChessTraining};
