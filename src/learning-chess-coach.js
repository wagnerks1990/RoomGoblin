'use strict';
// A small, deterministic teaching aid. It describes legal moves, never searches
// for the best move or establishes game results. Callers own access and game mode.
const {parse,legal,apply,uci,checked,error}=require('./learning-chess');
const NAMES={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const NOTICE='These are legal examples to explore, not best-move rankings or a prediction of who will win. Check what your opponent can do next.';
const square=i=>'abcdefgh'[i&7]+(8-(i>>4));
const central=s=>/^[c-f][3-6]$/.test(s);

function readPosition(input){
 if(typeof input!=='string'||input.length>120)error(400,'Provide a bounded chess FEN position.');
 const state=parse(input),counts={1:0,'-1':0},pawns={1:0,'-1':0};
 if(!Number.isSafeInteger(state.half)||state.half>20000||!Number.isSafeInteger(state.full)||state.full<1||state.full>20000)error(400,'Invalid chess move counters.');
 for(let i=0;i<128;i++){
  if(i&0x88){i+=7;continue;}const piece=state.b[i];if(piece==='.')continue;
  const side=piece===piece.toUpperCase()?1:-1;counts[side]++;
  if(piece.toLowerCase()==='p'){pawns[side]++;if((i>>4)===0||(i>>4)===7)error(400,'A pawn on its last rank must be promoted.');}
 }
 if(counts[1]>16||counts[-1]>16||pawns[1]>8||pawns[-1]>8)error(400,'Too many chess pieces.');
 if(checked(state,-state.t))error(400,'The player who just moved cannot leave their king in check.');
 const rights=[[1,116,'K',119,'R'],[2,116,'K',112,'R'],[4,4,'k',7,'r'],[8,4,'k',0,'r']];
 for(const [bit,k,king,r,rook]of rights)if(state.c&bit&&(state.b[k]!==king||state.b[r]!==rook))error(400,'Castling rights do not match the pieces.');
 if(state.ep>=0&&((state.ep>>4)!==(state.t===1?2:5)||state.b[state.ep]!=='.'||state.b[state.ep+16*state.t]!==(state.t===1?'p':'P')))error(400,'Invalid en passant position.');
 return state;
}

function describe(state,move,inCheck){
 const [fromIndex,toIndex,promotion,flag]=move,from=square(fromIndex),to=square(toIndex),kind=state.b[fromIndex].toLowerCase();
 const captured=flag==='ep'?state.b[toIndex+16*state.t]:state.b[toIndex];
 const capture=captured==='.'?null:NAMES[captured.toLowerCase()];
 const next=apply(state,move),givesCheck=checked(next),tags=[],reasons=[];
 if(inCheck){tags.push('check-response');reasons.push('Your king is in check. This legal move answers that check without leaving your king attacked.');}
 if(flag==='castle'){tags.push('castling');reasons.push(`Castling moves the king from ${from} to ${to} and moves the rook beside it. The king does not start in, cross, or finish in check.`);}
 if(capture){tags.push('capture');reasons.push(flag==='ep'?`En passant captures the pawn on ${square(toIndex+16*state.t)}, even though the destination ${to} was empty.`:`This move captures the opposing ${capture} on ${to}. A capture alone does not tell us whether the exchange is favorable.`);}
 if(promotion){tags.push('promotion');reasons.push(`The pawn reaches its last rank and becomes a ${NAMES[promotion]}. You may choose a queen, rook, bishop, or knight.`);}
 if(givesCheck){tags.push('check');reasons.push('After this move, the opposing king is in check. The opponent must make a legal response; check does not by itself mean checkmate.');}
 const development=['n','b'].includes(kind)&&(fromIndex>>4)===(state.t===1?7:0)&&(toIndex>>4)!==(fromIndex>>4)&&state.full<=12;
 if(development){tags.push('development');reasons.push(`This brings a ${NAMES[kind]} off the back rank and into play. Look for useful squares and avoid moving the same piece repeatedly without a reason.`);}
 if(central(to)){tags.push('center');reasons.push(`The destination ${to} is near the center. Central squares can give pieces more useful choices, but you still need to consider your opponent's reply.`);}
 if(!inCheck){tags.push('king-safety');reasons.push('This move keeps your own king out of check. That does not guarantee that the moved piece or another piece cannot be captured next.');}
 if(!reasons.length)reasons.push(`The ${NAMES[kind]} can legally move from ${from} to ${to}.`);
 const title=promotion?'Explore a promotion':flag==='castle'?'Explore castling':inCheck?'Answer the check':capture?'Examine a capture':givesCheck?'Explore a checking move':development?'Develop a piece':central(to)?'Explore the center':'Compare a legal move';
 return {move:uci(move),from,to,piece:NAMES[kind],title,reasons:reasons.slice(0,6),tags,capture,promotion:promotion?NAMES[promotion]:null,givesCheck,castling:flag==='castle',kingSafe:true};
}

function explainPosition(input){
 const state=readPosition(input),moves=legal(state),inCheck=checked(state);
 // One legal-move generation and at most one check test per candidate. No
 // recursive search, opponent move generation, history walk, or network call.
 const options=moves.map(move=>describe(state,move,inCheck));
 const score=hint=>Number(hint.tags.includes('promotion'))*50+Number(hint.givesCheck)*40+Number(!!hint.capture)*30+Number(hint.castling)*25+Number(hint.tags.includes('development'))*20+Number(hint.tags.includes('center'))*8;
 options.sort((a,b)=>score(b)-score(a)||(a.move<b.move?-1:a.move>b.move?1:0));
 const suggestions=[],seen=new Set(),category=hint=>['promotion','castling','capture','check','development','center'].find(tag=>hint.tags.includes(tag))||'legal';
 for(const hint of options)if(!seen.has(category(hint))){suggestions.push(hint);seen.add(category(hint));if(suggestions.length===3)break;}
 for(const hint of options)if(suggestions.length<3&&!suggestions.includes(hint))suggestions.push(hint);
 return {turn:state.t===1?'white':'black',inCheck,legalMoveCount:moves.length,
  summary:!moves.length?(inCheck?'The side to move is in check and has no legal moves.':'The side to move has no legal moves and is not in check.'):
   inCheck?'First, find a legal way to get your king out of check.':'Compare a few legal moves and think about your opponent\'s reply.',
  suggestions,notice:NOTICE};
}

function explainMove(input,requested){
 const state=readPosition(input);
 if(typeof requested!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(requested))error(400,'Provide a UCI chess move.');
 const move=legal(state).find(candidate=>uci(candidate)===requested);
 if(!move)error(409,'That move is not legal in this position.');
 return {...describe(state,move,checked(state)),notice:NOTICE};
}
module.exports={explainPosition,explainMove};
