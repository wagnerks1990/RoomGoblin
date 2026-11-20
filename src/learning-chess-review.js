'use strict';
// Private finished-game review; no live position advice or game/grade mutation.
const {START,parse,fen,legal,apply,uci,checked,attacked}=require('./learning-chess');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const UUID=/^[a-f0-9-]{36}$/;
const MAX_PLIES=2000;
const integer=value=>typeof value==='string'&&/^(0|[1-9]\d{0,6})$/.test(value)?Number(value):value;
const square=i=>'abcdefgh'[i&7]+(8-(i>>4));
function tacticalDetails(state,move,next){
 const facts=[],codes=[],piece=state.b[move[0]].toUpperCase(),enemy=next.t;
 const replies=legal(next),captures=replies.filter(reply=>reply[1]===move[1]);
 if(captures.length)codes.push('moved-piece-capturable');
 if(captures.length)facts.push('The moved '+piece+' on '+square(move[1])+' can be captured legally on the next turn. This alone does not prove a bad move or an undefended piece.');
 const ownTurn={...next,t:-enemy},targets=legal(ownTurn).filter(reply=>reply[0]===move[1]&&next.b[reply[1]]!=='.').map(reply=>({square:square(reply[1]),piece:next.b[reply[1]].toUpperCase()}));
 // Attribute check to this piece only; discovered checks are not its fork.
 const removed={...next,b:next.b.slice()};removed.b[move[1]]='.';const directCheck=checked(next)&&!checked(removed);
 const valuable=targets.filter(target=>target.piece!=='P');
 if(valuable.length+(directCheck?1:0)>=2)codes.push('fork-pattern');
 if(valuable.length+(directCheck?1:0)>=2)facts.push('The moved '+piece+' attacks multiple valuable targets'+(directCheck?', including the king':'')+': '+valuable.map(x=>x.piece+' on '+x.square).join(', ')+'. This is a fork pattern, not a guaranteed material win.');
 return {facts,codes};
}
function tacticalFacts(state,move,next){return tacticalDetails(state,move,next).facts;}
function kingExposure(state,color){const king=state.b.indexOf(color===1?'K':'k');if(king<0)return null;return [-17,-16,-15,-1,1,15,16,17].filter(d=>!((king+d)&0x88)&&attacked(state,king+d,-color)).length;}
function diagnosticFacts(state,selected,next,bestMove,loss){
 const played=tacticalDetails(state,selected,next),codes=[...played.codes],facts=[];
 if(Number.isFinite(loss)&&loss>=80){
  const candidate=legal(state).find(move=>uci(move)===bestMove);
  if(candidate&&uci(candidate)!==uci(selected)&&tacticalDetails(state,candidate,apply(state,candidate)).codes.includes('fork-pattern')&&!codes.includes('fork-pattern')){codes.push('candidate-fork-evaluation-loss');facts.push('The engine candidate offered a fork pattern while the played move did not, alongside an evaluation drop. This does not prove a forced material win or that the fork caused the difference.');}
  const before=kingExposure(state,state.t),after=kingExposure(next,state.t);
  if(before!==null&&after!==null&&after>before){codes.push('king-neighborhood-evaluation-loss');facts.push('More squares next to your king were attacked after this move, alongside an evaluation drop. Attacked squares are not necessarily legal king escapes; this observation does not prove the cause of the loss.');}
 }return {codes,facts};
}
function san(state,move,moves){
 const piece=state.b[move[0]].toUpperCase(),capture=state.b[move[1]]!=='.'||move[3]==='ep';let value;
 if(move[3]==='castle')value=move[1]>move[0]?'O-O':'O-O-O';
 else{let qualifier='';if(piece!=='P'){const alternatives=moves.filter(m=>m[0]!==move[0]&&m[1]===move[1]&&state.b[m[0]]===state.b[move[0]]);if(alternatives.length)qualifier=alternatives.every(m=>(m[0]&7)!==(move[0]&7))?square(move[0])[0]:alternatives.every(m=>(m[0]>>4)!==(move[0]>>4))?square(move[0])[1]:square(move[0]);}value=(piece==='P'?(capture?square(move[0])[0]:''):piece+qualifier)+(capture?'x':'')+square(move[1])+(move[2]?'='+move[2].toUpperCase():'');}
 const next=apply(state,move);if(checked(next))value+=legal(next).length?'+':'#';return value;
}
const result=row=>row.moves_json==='[]'||['queue cancelled','queue expired','practice ended','inactive game'].includes(row.reason)?'*':row.result==='white'?'1-0':row.result==='black'?'0-1':row.result==='draw'?'1/2-1/2':'*';
class ChessReview{
 constructor(learning,{chess=learning.chess,available=()=>true}={}){this.learning=learning;this.chess=chess;this.db=learning.db;this.available=available;this.cache=new Map();this.rates=new Map();}
 authorize(user,activityId,{teacher=false}={}){
  const fresh=user?.id&&this.db.prepare('SELECT id,username,display_name displayName,role,profile_id profileId,enabled FROM users WHERE id=? AND enabled=1').get(user.id);if(!fresh)fail(401,'Your review connection is no longer authorized.');
  const direct=this.db.prepare('SELECT activity_id,revoked FROM learning_direct_participants WHERE user_id=?').get(fresh.id);if(direct){if(direct.activity_id!==activityId||direct.revoked||!this.learning.direct.available(activityId))fail(401,'Your review connection is no longer authorized.');fresh.directParticipant=true;}
  this.chess.authorize(fresh,activityId,false,{teacher});return fresh;
 }
 scope(row,user,activityId,teacher){if(!teacher)return this.chess.seatInActivity(row,user,activityId);return !!this.db.prepare('SELECT 1 FROM learning_activities original JOIN learning_activities authorized ON authorized.class_id=original.class_id WHERE authorized.id=? AND original.id IN (?,?)').get(activityId,row.activity_id,row.black_activity_id);}
 owned(user,activityId,matchId,options={}){
  const fresh=this.authorize(user,activityId,options);if(typeof matchId!=='string'||!UUID.test(matchId))fail(404,'Finished game not found.');const row=this.chess.row(matchId);
  if(!row||row.status!=='finished'||!this.scope(row,fresh,activityId,options.teacher))fail(404,'Finished game not found.');return {fresh,row};
 }
 summary(row){const value={id:row.id,mode:row.mode,result:row.result,reason:row.reason,difficulty:row.difficulty,updatedAt:row.updated_at,revision:row.revision,white:{name:this.chess.publicName(row.white_id,row.activity_id,'white')},black:{name:row.mode==='computer'?'Computer':row.mode==='solo'?'Solo practice':this.chess.publicName(row.black_id,row.black_activity_id||row.activity_id,'black')}};if(row.mode==='computer'&&row.human_color==='black')[value.white,value.black]=[value.black,value.white];return value;}
 history(user,activityId,{teacher=false,before=null,limit=20,search='',mode='',result:outcome=''}={}){
  limit=integer(limit);const fresh=this.authorize(user,activityId,{teacher});if(!Number.isInteger(limit)||limit<1||limit>50||typeof search!=='string'||search.length>80||!['','computer','solo','multiplayer'].includes(mode)||!['','white','black','draw'].includes(outcome))fail(400,'Use bounded history filters.');
  let cursor=null;if(before!==null){try{cursor=JSON.parse(Buffer.from(before,'base64url').toString('utf8'));}catch{}if(typeof before!=='string'||before.length>256||!Array.isArray(cursor)||cursor.length!==2||typeof cursor[0]!=='string'||cursor[0].length>40||!UUID.test(cursor[1]))fail(400,'Invalid history cursor.');}
  const scope=teacher?'EXISTS (SELECT 1 FROM learning_activities a JOIN learning_activities b ON a.class_id=b.class_id WHERE a.id=? AND b.id IN (m.activity_id,m.black_activity_id))':'((m.white_id=? AND m.activity_id=?) OR (m.black_id=? AND COALESCE(m.black_activity_id,m.activity_id)=?))';const args=teacher?[activityId]:[fresh.id,activityId,fresh.id,activityId];
  // Search only public game attributes, never another class's private alias.
  let where="m.status='finished' AND "+scope;if(mode){where+=' AND m.mode=?';args.push(mode);}if(outcome){where+=' AND m.result=?';args.push(outcome);}if(search){where+=' AND (m.reason LIKE ? ESCAPE \'\\\' OR m.difficulty LIKE ? ESCAPE \'\\\')';const term='%'+search.replace(/[\\%_]/g,'\\$&')+'%';args.push(term,term);}if(cursor){where+=' AND (m.updated_at<? OR (m.updated_at=? AND m.id<?))';args.push(cursor[0],cursor[0],cursor[1]);}
  const rows=this.db.prepare('SELECT m.* FROM learning_chess_matches m WHERE '+where+' ORDER BY m.updated_at DESC,m.id DESC LIMIT ?').all(...args,limit+1),more=rows.length>limit;rows.length=Math.min(rows.length,limit);const last=rows.at(-1);return {matches:rows.map(row=>({...this.summary(row),mine:this.chess.isSeat(row,fresh)})),nextCursor:more?Buffer.from(JSON.stringify([last.updated_at,last.id])).toString('base64url'):null};
 }
 timeline(row,userId){
  const key=row.id+':'+row.revision,old=this.cache.get(key);if(old&&old.history===row.moves_json)return old;
  this.budget(userId,'replay',12);if(typeof row.moves_json!=='string'||row.moves_json.length>200000)fail(409,'Saved history exceeds the supported review bound.');let moves;try{moves=JSON.parse(row.moves_json);}catch{fail(409,'Saved history is invalid.');}if(!Array.isArray(moves)||moves.length>MAX_PLIES)fail(409,'This review supports up to '+MAX_PLIES+' plies. The saved game is unchanged.');
  let state=parse(START);const positions=[START],notations=[];for(const text of moves){if(typeof text!=='string'||!/^([a-h][1-8]){2}[qrbn]?$/.test(text))fail(409,'Saved history is invalid.');const choices=legal(state),move=choices.find(m=>uci(m)===text);if(!move)fail(409,'Saved history is invalid.');notations.push(san(state,move,choices));state=apply(state,move);positions.push(fen(state));}
  const value={history:row.moves_json,moves,positions,notations};while(this.cache.size>=8)this.cache.delete(this.cache.keys().next().value);this.cache.set(key,value);return value;
 }
 replay(user,activityId,matchId,{teacher=false,offset=0,limit=40}={}){offset=integer(offset);limit=integer(limit);const {row}=this.owned(user,activityId,matchId,{teacher});if(!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>100)fail(400,'Use bounded replay pages.');const t=this.timeline(row,user.id);if(offset>t.moves.length)fail(400,'Replay position is outside this game.');return {match:this.summary(row),totalPlies:t.moves.length,positions:t.positions.slice(offset,offset+limit).map((position,i)=>({ply:offset+i,fen:position,move:offset+i?t.moves[offset+i-1]:null,san:offset+i?t.notations[offset+i-1]:null})),nextOffset:offset+limit<t.positions.length?offset+limit:null};}
 pgn(user,activityId,matchId,options={}){const {row}=this.owned(user,activityId,matchId,options),t=this.timeline(row,user.id),s=this.summary(row),escape=value=>String(value).replace(/[\r\n\x00-\x1f\x7f]/g,' ').replace(/\\/g,'\\\\').replace(/"/g,'\\"'),tags={Event:'RoomGoblin completed chess game',Site:'RoomGoblin',Date:String(row.created_at).slice(0,10).replace(/-/g,'.'),Round:'-',White:s.white.name,Black:s.black.name,Result:result(row)};let movetext='';for(let i=0;i<t.notations.length;i++)movetext+=(i%2===0?(i/2+1)+'. ':'')+t.notations[i]+' ';return {filename:'roomgoblin-chess-'+row.id+'.pgn',pgn:Object.entries(tags).map(([k,v])=>'['+k+' "'+escape(v)+'"]').join('\n')+'\n\n'+movetext+result(row)+'\n'};}
 budget(userId,kind='analysis',maximum=6){userId=kind+':'+userId;const now=Date.now();for(const [id,v]of this.rates)if(now-v.at>=60000)this.rates.delete(id);let v=this.rates.get(userId);if(!v){if(this.rates.size>=512)fail(429,'Review is busy.');this.rates.set(userId,v={at:now,n:0});}if(++v.n>maximum)fail(429,'Please wait before requesting more reviews.');}
 position(user,activityId,matchId,{teacher=false,ply}={}){ply=integer(ply);const access=this.owned(user,activityId,matchId,{teacher}),t=this.timeline(access.row,user.id);if(!Number.isInteger(ply)||ply<0||ply>=t.moves.length)fail(400,'Choose a played move to review.');return {...access,t,ply,state:parse(t.positions[ply])};}
 retry(user,activityId,matchId,options={}){const {row,t,ply,state}=this.position(user,activityId,matchId,options);return {matchId:row.id,revision:row.revision,ply,fen:t.positions[ply],turn:state.t===1?'white':'black',legalMoves:legal(state).map(uci),originalMove:t.moves[ply],notice:'Isolated replay practice. This does not change the saved game, grades or results.'};}
 attempt(user,activityId,matchId,{teacher=false,ply,move}={}){const {t,state}=this.position(user,activityId,matchId,{teacher,ply});if(typeof move!=='string')fail(400,'Choose a legal practice move.');const choices=legal(state),selected=choices.find(m=>uci(m)===move);if(!selected)fail(409,'That move is not legal in this practice position.');const next=apply(state,selected);return {ply,move,san:san(state,selected,choices),fen:fen(next),inCheck:checked(next),checkmate:checked(next)&&legal(next).length===0,sameAsPlayed:move===t.moves[ply],notice:'Legal alternative checked. This does not claim the move is best.'};}
 async analyze(user,activityId,matchId,options={}){
  if(!this.available())fail(423,'Review is temporarily unavailable.');const {fresh,row,t,ply,state}=this.position(user,activityId,matchId,options);this.budget(fresh.id);
  this.chess.computer??=new(require('./learning-chess-ai').ChessComputer)();const engine=this.chess.computer;
  const before=await engine.analyze(t.positions[ply],{moves:t.moves.slice(0,ply),signal:options.signal});
  if(!this.available())fail(423,'Review is temporarily unavailable.');this.owned(user,activityId,matchId,options);const next=parse(t.positions[ply+1]),nextLegal=legal(next);let after=null;if(nextLegal.length)after=await engine.analyze(t.positions[ply+1],{moves:t.moves.slice(0,ply+1),signal:options.signal});
  if(!this.available())fail(423,'Review is temporarily unavailable.');const latest=this.owned(user,activityId,matchId,options).row;if(latest.revision!==row.revision||latest.moves_json!==row.moves_json)fail(409,'Saved game changed during review.');
  const loss=before.score.type==='cp'&&after?.score.type==='cp'?Math.max(0,before.score.value+after.score.value):null;
  const selected=legal(state).find(m=>uci(m)===t.moves[ply]),facts=[];if(selected[3]==='castle')facts.push('Castling moved the king and rook.');if(selected[3]==='ep')facts.push('En passant removed the pawn from its passed square.');if(selected[2])facts.push('The pawn promoted to '+selected[2].toUpperCase()+'.');if(checked(next))facts.push(nextLegal.length?'The played move gave check.':'The played move delivered checkmate.');if(!nextLegal.length&&!checked(next))facts.push('The played move produced stalemate.');
  facts.push(...tacticalFacts(state,selected,next));const diagnostics=diagnosticFacts(state,selected,next,before.move,loss);facts.push(...diagnostics.facts);
  return {matchId,revision:row.revision,ply,played:t.moves[ply],bestMove:before.move,before,after,lossCp:loss,factCodes:diagnostics.codes,classification:loss===null?'forcing or terminal position':loss>=200?'large evaluation loss':loss>=80?'evaluation loss':'similar evaluation',facts,explanation:'Bounded Stockfish analysis: before score is from the mover’s perspective; after score is from the opponent’s perspective. Search estimates may change with deeper analysis; this is not a rating or proof of a specific tactical mistake.'};
 }
}
module.exports={ChessReview,san,tacticalFacts,diagnosticFacts,kingExposure,MAX_PLIES};
