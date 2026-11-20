// Visual interpolation only. Inputs must be server-confirmed snapshots; this
// never generates legal moves, submits a move, or predicts a computer reply.
const squares=Array.from({length:64},(_,i)=>'abcdefgh'[i%8]+(8-Math.floor(i/8)));
function board(fen){
 const value=String(fen||'').split(' ')[0].replace(/[1-8]/g,n=>'.'.repeat(Number(n))).replaceAll('/','');
 if(!/^[prnbqkPRNBQK.]{64}$/.test(value))return null;
 return new Map(squares.flatMap((square,i)=>value[i]==='.'?[]:[[square,value[i]]]));
}
function placement(pieces){return Array.from({length:8},(_,rank)=>squares.slice(rank*8,rank*8+8).map(s=>pieces.get(s)||'.').join('').replace(/\.+/g,s=>String(s.length))).join('/');}
function project(pieces,move){
 if(!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move||''))return false;
 const from=move.slice(0,2),to=move.slice(2,4),piece=pieces.get(from);if(!piece)return false;
 if(piece.toLowerCase()==='p'&&from[0]!==to[0]&&!pieces.has(to))pieces.delete(to[0]+from[1]);
 if(piece.toLowerCase()==='k'&&Math.abs(from.charCodeAt(0)-to.charCodeAt(0))===2){
  const rookFrom=(to[0]==='g'?'h':'a')+from[1],rookTo=(to[0]==='g'?'f':'d')+from[1],rook=pieces.get(rookFrom);
  if(rook!==(piece==='K'?'R':'r'))return false;pieces.delete(rookFrom);pieces.set(rookTo,rook);
 }
 pieces.delete(from);pieces.set(to,move.length===5?(piece===piece.toUpperCase()?move[4].toUpperCase():move[4]):piece);return true;
}
export function confirmedPresentations(old,next,{animate=true}={}){
 if(!animate||!old||old.id!==next?.id||!Number.isSafeInteger(next.revision)||next.revision!==old.revision+1||!Array.isArray(old.moves)||!Array.isArray(next.moves))return [];
 const count=next.moves.length-old.moves.length;
 if(count!==1&&!(count===2&&next.mode==='computer'))return [];
 if(!old.moves.every((move,i)=>move===next.moves[i]))return [];
 const pieces=board(old.fen),target=board(next.fen);if(!pieces||!target)return [];
 const frames=[];
 for(const move of next.moves.slice(old.moves.length)){
  if(!project(pieces,move))return [];
  frames.push({move,fen:placement(pieces)});
 }
 // A malformed or unexpected transition snaps to the supplied final snapshot.
 // The intermediate diagram is used only when it reconstructs that exact board.
 return placement(pieces)===placement(target)?frames:[];
}
