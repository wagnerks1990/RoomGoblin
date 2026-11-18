'use strict';
// The server owns chess rules, turns, and outcomes. Client moves are untrusted.
const crypto=require('node:crypto');
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const dirs={n:[-33,-31,-18,-14,14,18,31,33],b:[-17,-15,15,17],r:[-16,-1,1,16],k:[-17,-16,-15,-1,1,15,16,17]};
const on=i=>i>=0&&i<128&&!(i&0x88),side=p=>!p||p==='.'?0:p===p.toUpperCase()?1:-1;
const index=s=>(8-Number(s[1]))*16+'abcdefgh'.indexOf(s[0]);
const square=i=>'abcdefgh'[i&7]+(8-(i>>4)),uci=m=>square(m[0])+square(m[1])+m[2];
function error(status,message){throw Object.assign(Error(message),{status});}
function parse(fen=START){
 const parts=fen.split(' ');if(parts.length!==6)error(400,'Invalid chess position.');
 const [placement,turn,castling,ep,half,full]=parts,rows=placement.split('/');
 if(rows.length!==8||!['w','b'].includes(turn)||!/^(?:-|K?Q?k?q?)$/.test(castling)||!/^(?:-|[a-h][36])$/.test(ep)||!/^\d+$/.test(half)||!/^\d+$/.test(full))error(400,'Invalid chess position.');
 const b=Array(128).fill('.');
 rows.forEach((r,y)=>{let x=0;for(const p of r){if(/^[1-8]$/.test(p))x+=Number(p);else{if(!/^[prnbqkPRNBQK]$/.test(p)||x>=8)error(400,'Invalid rank.');b[y*16+x++]=p;}}if(x!==8)error(400,'Invalid rank.');});
 if(b.filter(p=>p==='K').length!==1||b.filter(p=>p==='k').length!==1)error(400,'King missing.');
 return {b,t:turn==='w'?1:-1,c:(castling.includes('K')?1:0)|(castling.includes('Q')?2:0)|(castling.includes('k')?4:0)|(castling.includes('q')?8:0),ep:ep==='-'?-1:index(ep),half:+half,full:+full};
}
function attacked(s,target,by){
 for(let f=0;f<128;f++){if(!on(f)||side(s.b[f])!==by)continue;
  const p=s.b[f].toLowerCase();
  if(p==='p'){if(target===f-16*by-1||target===f-16*by+1)return true;continue;}
  for(const d of dirs[p]||dirs.k)for(let t=f+d;on(t);t+=d){if(t===target)return true;if(s.b[t]!=='.'||p==='n'||p==='k')break;}
 }return false;
}
const checked=(s,color=s.t)=>attacked(s,s.b.indexOf(color===1?'K':'k'),-color);
function apply(s,m){
 const [f,t,promo,flag]=m,b=s.b.slice(),piece=b[f],captured=b[t];let c=s.c;
 b[f]='.';b[t]=promo?(s.t===1?promo.toUpperCase():promo):piece;
 if(flag==='ep')b[t+16*s.t]='.';
 if(flag==='castle'){const rf=t>f?f+3:f-4,rt=t>f?f+1:f-1;b[rt]=b[rf];b[rf]='.';}
 if(piece==='K')c&=~3;if(piece==='k')c&=~12;
 const rookBit={119:1,112:2,7:4,0:8};
 if(piece.toLowerCase()==='r')c&=~(rookBit[f]||0);
 if(captured.toLowerCase()==='r')c&=~(rookBit[t]||0);
 return {b,t:-s.t,c,ep:piece.toLowerCase()==='p'&&Math.abs(t-f)===32?(t+f)/2:-1,half:piece.toLowerCase()==='p'||captured!=='.'||flag==='ep'?0:s.half+1,full:s.full+(s.t===-1?1:0)};
}
function pseudo(s){
 const out=[];
 for(let f=0;f<128;f++){if(!on(f)||side(s.b[f])!==s.t)continue;
  const p=s.b[f].toLowerCase();
  const add=(t,flag='')=>{if(s.b[t].toLowerCase()==='k')return;if(p==='p'&&((t>>4)===0||(t>>4)===7))for(const q of ['q','r','b','n'])out.push([f,t,q,flag]);else out.push([f,t,'',flag]);};
  if(p==='p'){const t=f-16*s.t;if(on(t)&&s.b[t]==='.'){add(t);const u=t-16*s.t;if((f>>4)===(s.t===1?6:1)&&s.b[u]==='.')add(u);}
   for(const d of [-1,1]){const u=t+d;if(!on(u))continue;if(side(s.b[u])===-s.t)add(u);else if(u===s.ep&&s.b[u]==='.'&&s.b[u+16*s.t]===(s.t===1?'p':'P'))add(u,'ep');}
  }else{
   for(const d of dirs[p]||dirs.k)for(let t=f+d;on(t);t+=d){if(side(s.b[t])===s.t)break;add(t);if(s.b[t]!=='.'||p==='n'||p==='k')break;}
   const home=s.t===1?116:4,rook=s.t===1?'R':'r',bits=s.t===1?[1,2]:[4,8];
   if(p==='k'&&f===home&&!checked(s)){
    if((s.c&bits[0])&&s.b[f+3]===rook&&s.b[f+1]==='.'&&s.b[f+2]==='.'&&!attacked(s,f+1,-s.t)&&!attacked(s,f+2,-s.t))add(f+2,'castle');
    if((s.c&bits[1])&&s.b[f-4]===rook&&s.b[f-1]==='.'&&s.b[f-2]==='.'&&s.b[f-3]==='.'&&!attacked(s,f-1,-s.t)&&!attacked(s,f-2,-s.t))add(f-2,'castle');
   }
  }
 }return out;
}
const legal=s=>pseudo(s).filter(m=>!checked(apply(s,m),s.t));
function fen(s){
 const rows=[];for(let y=0;y<8;y++){let r='',empty=0;for(let x=0;x<8;x++){const p=s.b[y*16+x];if(p==='.')empty++;else{if(empty)r+=empty;empty=0;r+=p;}}if(empty)r+=empty;rows.push(r);}
 return rows.join('/')+' '+(s.t===1?'w':'b')+' '+(['K','Q','k','q'].filter((_,i)=>s.c&(1<<i)).join('')||'-')+' '+(s.ep<0?'-':square(s.ep))+' '+s.half+' '+s.full;
}
function insufficient(s){const p=[];for(let i=0;i<128;i++)if(on(i)&&s.b[i]!=='.'&&s.b[i].toLowerCase()!=='k')p.push([s.b[i].toLowerCase(),((i>>4)+(i&7))%2]);return !p.length||(p.length===1&&['b','n'].includes(p[0][0]))||(p.every(x=>x[0]==='b')&&new Set(p.map(x=>x[1])).size===1);}
function positionKey(s){return s.b.join('')+':'+s.t+':'+s.c+':'+(s.ep>=0&&legal(s).some(m=>m[3]==='ep')?s.ep:-1);}
function outcome(history){
 const s=history.at(-1),l=legal(s);
 if(!l.length)return checked(s)?{status:'finished',result:s.t===1?'black':'white',reason:'checkmate'}:{status:'finished',result:'draw',reason:'stalemate'};
 if(insufficient(s))return {status:'finished',result:'draw',reason:'insufficient material'};
 if(s.half>=150||history.filter(p=>positionKey(p)===positionKey(s)).length>=5)return {status:'finished',result:'draw',reason:'automatic draw'};
 return {status:'active',result:null,reason:null};
}
function play(fenString,moves,requested){
 if(typeof requested!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(requested))error(400,'Provide a UCI chess move.');
 let s=parse(fenString),history=[s];for(const move of moves){const m=legal(s).find(x=>uci(x)===move);if(!m)error(409,'Saved match history is inconsistent.');s=apply(s,m);history.push(s);}
 if(outcome(history).status!=='active')error(409,'This match has ended.');
 const selected=legal(s).find(m=>uci(m)===requested);if(!selected)error(409,'Illegal move.');
 const next=apply(s,selected);history.push(next);
 return {fen:fen(next),outcome:outcome(history),turn:next.t===1?'white':'black'};
}
class ChessMatches {
 constructor(learning){
  this.learning=learning;this.db=learning.db;this.store=learning.store;
  this.db.exec(`CREATE TABLE IF NOT EXISTS learning_chess_matches(
   id TEXT PRIMARY KEY,activity_id TEXT NOT NULL REFERENCES learning_activities(id) ON DELETE CASCADE,
   white_id TEXT NOT NULL REFERENCES users(id),black_id TEXT REFERENCES users(id),
   status TEXT NOT NULL CHECK(status IN ('waiting','active','finished')),
   result TEXT,reason TEXT,moves_json TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,
   created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS learning_chess_activity ON learning_chess_matches(activity_id,updated_at);
  `);
 }
 activity(user,id,write=false){const a=this.learning.activity(user,id);if(write)this.learning.writable(a);return a;}
 get(user,activityId,matchId,{teacher=false}={}){
  const a=this.learning.activity(user,activityId,teacher),m=this.db.prepare('SELECT * FROM learning_chess_matches WHERE id=? AND activity_id=?').get(matchId);
  if(!m)error(404,'Chess match not found.');
  if(!teacher&&m.white_id!==user.id&&m.black_id!==user.id)error(404,'Chess match not found.');
  return this.render(m);
 }
 render(m){
  const moves=JSON.parse(m.moves_json),state=playHistory(moves);
  return {id:m.id,activityId:m.activity_id,status:m.status,result:m.result,reason:m.reason,fen:fen(state),turn:state.t===1?'white':'black',moves,revision:m.revision,createdAt:m.created_at,updatedAt:m.updated_at,
   white:{id:m.white_id,name:this.alias(m.white_id,m.activity_id)},black:m.black_id?{id:m.black_id,name:this.alias(m.black_id,m.activity_id)}:null};
 }
 alias(userId,activityId){const row=this.db.prepare('SELECT m.alias FROM learning_members m JOIN learning_activities a ON a.class_id=m.class_id WHERE a.id=? AND m.user_id=?').get(activityId,userId);return row?.alias||'Student';}
 list(user,activityId,{teacher=false}={}){
  this.learning.activity(user,activityId,teacher);
  const rows=this.db.prepare('SELECT * FROM learning_chess_matches WHERE activity_id=? ORDER BY updated_at DESC LIMIT 100').all(activityId);
  return rows.filter(m=>teacher||m.white_id===user.id||m.black_id===user.id).map(m=>this.render(m));
 }
 create(user,id){
  const a=this.activity(user,id,true);
  if(a.member.role!=='student')error(403,'Student participation required.');
  const count=this.db.prepare("SELECT COUNT(*) n FROM learning_chess_matches WHERE activity_id=? AND status IN ('waiting','active')").get(id).n;
  if(count>=100)error(429,'Too many open matches.');
  const existing=this.db.prepare("SELECT id FROM learning_chess_matches WHERE activity_id=? AND white_id=? AND status='waiting'").get(id,user.id);
  if(existing)return this.get(user,id,existing.id);
  const matchId=crypto.randomUUID(),now=new Date().toISOString();
  this.db.prepare("INSERT INTO learning_chess_matches(id,activity_id,white_id,status,moves_json,created_at,updated_at) VALUES(?,?,?,'waiting','[]',?,?)").run(matchId,id,user.id,now,now);
  this.learning.event(user,id,'chess.create',matchId);return this.get(user,id,matchId);
 }
 join(user,id,matchId){
  const a=this.activity(user,id,true);if(a.member.role!=='student')error(403,'Student participation required.');
  return this.store.tx(()=>{
   const row=this.db.prepare('SELECT * FROM learning_chess_matches WHERE id=? AND activity_id=?').get(matchId,id);
   if(!row||row.status!=='waiting'||row.white_id===user.id)error(409,'Match unavailable.');
   const now=new Date().toISOString();
   const changed=this.db.prepare("UPDATE learning_chess_matches SET black_id=?,status='active',revision=revision+1,updated_at=? WHERE id=? AND status='waiting' AND black_id IS NULL").run(user.id,now,matchId);
   if(!changed.changes)error(409,'Another student joined.');
   this.learning.event(user,id,'chess.join',matchId);return this.get(user,id,matchId);
  });
 }
 move(user,id,matchId,requested,revision){
  const a=this.activity(user,id,true);if(a.member.role!=='student')error(403,'Student participation required.');
  if(!Number.isSafeInteger(revision)||revision<0)error(400,'Match revision required.');
  return this.store.tx(()=>{
   const row=this.db.prepare('SELECT * FROM learning_chess_matches WHERE id=? AND activity_id=?').get(matchId,id);
   if(!row||row.status!=='active')error(409,'Match is not active.');
   if(row.revision!==revision)error(409,'The board has changed. Refresh it.');
   const moves=JSON.parse(row.moves_json),whiteTurn=moves.length%2===0;
   if((whiteTurn?row.white_id:row.black_id)!==user.id)error(403,'It is not your turn.');
   const state=play(START,moves,requested),next=[...moves,requested],now=new Date().toISOString();
   const changed=this.db.prepare('UPDATE learning_chess_matches SET moves_json=?,status=?,result=?,reason=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
    .run(JSON.stringify(next),state.outcome.status,state.outcome.result,state.outcome.reason,now,matchId,revision);
   if(!changed.changes)error(409,'The board has changed.');
   this.learning.event(user,id,'chess.move',matchId,{ply:next.length,ended:state.outcome.status==='finished'});
   return this.get(user,id,matchId);
  });
 }
}
function playHistory(moves){
 let s=parse();for(const move of moves){const m=legal(s).find(x=>uci(x)===move);if(!m)error(409,'Chess history invalid.');s=apply(s,m);}return s;
}
module.exports={ChessMatches,START,parse,fen,legal,apply,uci,play,outcome,error};
