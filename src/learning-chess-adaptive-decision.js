'use strict';
const {parse,legal,apply,uci,checked}=require('./learning-chess');
const {LEVELS,profile}=require('./learning-chess-stockfish-profiles');
const ADAPTIVE_LEVELS=Object.freeze(['adaptive','adaptive-coach','adaptive-practice']);
const STYLES=Object.freeze(['balanced','attacking','solid','exploratory']);
const VALUES=Object.freeze({p:100,n:320,b:335,r:500,q:900,k:0});
function resolveAdaptive(position,adaptive={},mode='adaptive'){
 if(!adaptive||typeof adaptive!=='object'||Array.isArray(adaptive))throw Object.assign(Error('Invalid adaptive computer profile.'),{status:400});
 const baseBand=adaptive.band===undefined?1:adaptive.band,style=adaptive.style===undefined?'balanced':adaptive.style;
 if(!Number.isInteger(baseBand)||baseBand<0||baseBand>=LEVELS.length||!STYLES.includes(style))throw Object.assign(Error('Invalid adaptive computer profile.'),{status:400});
 const state=parse(position);let material=0;
 for(const piece of state.b)if(piece!=='.')material+=(piece===piece.toUpperCase()?1:-1)*VALUES[piece.toLowerCase()];
 // The computer is Black in RoomGoblin practice. A coarse, disclosed material
 // signal changes at most one band during play; this is not an engine rating.
 const adjustment=mode!=='adaptive-practice'&&state.full>=3?(material>=300?1:material<=-300?-1:0):0;
 const band=Math.max(0,Math.min(LEVELS.length-1,baseBand+adjustment));
 const effectiveStyle=mode==='adaptive-practice'?style:checked(state)||adjustment<0?'solid':adjustment>0?'attacking':style;
 return Object.freeze({baseBand,band,style:effectiveStyle,profile:profile(LEVELS[band]),reason:(band>baseBand?'Your material lead raised the current challenge one band.':band<baseBand?'The current material balance lowered the challenge one band.':'The current challenge follows your saved adaptive band.')+(effectiveStyle!==style?' The current position changed the computer style to '+effectiveStyle+'.':'')});
}
function collectVariation(state,line){
 if(!line.startsWith('info '))return;
 const depth=Number(/(?:^| )depth (\d+)(?: |$)/.exec(line)?.[1]);if(!Number.isInteger(depth)||depth<0||depth>128)return;
 if(depth>state.depth){state.depth=depth;state.values.clear();}if(depth!==state.depth)return;
 const rank=Number(/(?:^| )multipv (\d+)(?: |$)/.exec(line)?.[1]),score=/(?:^| )score (cp|mate) (-?\d+)(?: |$)/.exec(line),move=/(?:^| )pv ([a-h][1-8][a-h][1-8][qrbn]?)(?: |$)/.exec(line)?.[1];
 if(!Number.isInteger(rank)||rank<1||rank>3)return;
 state.values.delete(rank);
 if(!score||!move||/(?:^| )(?:lowerbound|upperbound)(?: |$)/.test(line))return;
 const value=Number(score[2]);if(!Number.isSafeInteger(value)||Math.abs(value)>100000)return;
 state.values.set(rank,{rank,depth,move,[score[1]]:value});
}
function styledMove(position,bestmove,variations,style){
 if(style==='balanced'||!STYLES.includes(style))return bestmove;
 const state=parse(position),moves=new Map(legal(state).map(move=>[uci(move),move])),required=Math.min(3,moves.size);
 const candidates=Array.from({length:required},(_,i)=>variations.values.get(i+1));
 if(required<2||candidates.some(candidate=>!candidate||candidate.depth!==variations.depth||!moves.has(candidate.move))||new Set(candidates.map(candidate=>candidate.move)).size!==required)return bestmove;
 // Mate scores are not interchangeable with centipawns. Keep the engine's
 // selected move whenever any current candidate contains a mate result.
 if(candidates.some(candidate=>candidate.mate!==undefined))return bestmove;
 const top=Math.max(...candidates.map(candidate=>candidate.cp)),baseline=candidates.find(candidate=>candidate.move===bestmove);
 if(!baseline||baseline.cp<top-35)return bestmove;
 const choices=candidates.filter(candidate=>candidate.cp>=top-35);
 const score=candidate=>{
  const move=moves.get(candidate.move),piece=state.b[move[0]].toLowerCase(),capture=VALUES[state.b[move[1]].toLowerCase()]|| (move[3]==='ep'?100:0),next=apply(state,move);
  if(style==='attacking')return (checked(next)?8:0)+capture/100+(move[2]?5:0);
  if(style==='solid'){const threatened=legal(next).some(reply=>reply[1]===move[1]);return (move[3]==='castle'?8:0)-(threatened?6:0)+(piece==='p'?1:0)-capture/1000;}
  // Deterministic position-based variety avoids identity-dependent randomness.
  let hash=2166136261;for(const c of position+'|'+candidate.move)hash=Math.imul(hash^c.charCodeAt(0),16777619);return hash>>>0;
 };
 return choices.reduce((chosen,candidate)=>score(candidate)>score(chosen)?candidate:chosen,baseline).move;
}
module.exports={ADAPTIVE_LEVELS,STYLES,resolveAdaptive,collectVariation,styledMove};
