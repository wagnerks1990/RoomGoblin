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
   CREATE TABLE IF NOT EXISTS learning_chess_presence(
    activity_id TEXT NOT NULL,user_id TEXT NOT NULL,last_seen INTEGER NOT NULL,
    PRIMARY KEY(activity_id,user_id));`);
  // Non-destructive, additive upgrade from the first private-match prototype.
  const columns=new Set(this.db.prepare('PRAGMA table_info(learning_chess_matches)').all().map(c=>c.name));
  if(!columns.has('mode'))this.db.exec("ALTER TABLE learning_chess_matches ADD COLUMN mode TEXT NOT NULL DEFAULT 'multiplayer'");
  if(!columns.has('black_activity_id'))this.db.exec("ALTER TABLE learning_chess_matches ADD COLUMN black_activity_id TEXT");
  this.db.exec('CREATE INDEX IF NOT EXISTS learning_chess_global_status ON learning_chess_matches(status,updated_at)');
 }
 teacher(user){return !!user&&!user.directParticipant&&user.profileId!=='learning-student'&&this.learning.teacherCapability?.(user);}
 authorize(user,activityId,write=false,{teacher=false}={}){
  const a=this.learning.activity(user,activityId,teacher);
  if(write)this.learning.writable(a);
  if(!teacher&&a.member.role!=='student')error(403,'Student activity access required.');
  if(teacher&&!this.teacher(user))error(403,'Teacher access required.');
  return a;
 }
 teacherActivity(user,classId){
  if(!this.teacher(user))error(403,'Teacher access required.');
  this.learning.membership(user,classId,true);
  const row=this.db.prepare("SELECT id FROM learning_activities WHERE class_id=? AND template_id='scorm-connector-v1' ORDER BY created_at DESC LIMIT 1").get(classId);
  if(!row)error(409,'Create a SCORM assignment for this class before joining chess.');
  return row.id;
 }
 isSeat(m,user){return m.white_id===user.id||m.black_id===user.id;}
 row(id){return this.db.prepare('SELECT * FROM learning_chess_matches WHERE id=?').get(id);}
 names(m,viewer){
  // Learners see nicknames with no cross-class identity or roster details.
  const label=(id,role,activityId)=>{
   if(!id)return null;
   if(id===viewer.id)return 'You';
   if(this.teacher(viewer)){
    const a=this.db.prepare('SELECT class_id FROM learning_activities WHERE id=?').get(activityId);
    try{if(a){this.learning.membership(viewer,a.class_id,true);return this.alias(id,activityId);}}catch{}
   }
   return role==='white'?'Player White':'Player Black';
  };
  return {white:{id:m.white_id===viewer.id?viewer.id:null,name:label(m.white_id,'white',m.activity_id)},
   black:m.mode==='computer'?{id:'computer',name:'Computer'}:m.mode==='solo'?{id:m.white_id===viewer.id?viewer.id:null,name:'Practice (Black)'}:m.black_id?{id:m.black_id===viewer.id?viewer.id:null,name:label(m.black_id,'black',m.black_activity_id||m.activity_id)}:null};
 }
 seatClass(user,m){
  const activityId=m.white_id===user.id?m.activity_id:m.black_id===user.id?(m.black_activity_id||m.activity_id):null;
  if(!activityId)return null;
  return this.db.prepare('SELECT class_id FROM learning_activities WHERE id=?').get(activityId)?.class_id||null;
 }
 alias(userId,activityId){
  const row=this.db.prepare('SELECT m.alias FROM learning_members m JOIN learning_activities a ON a.class_id=m.class_id WHERE a.id=? AND m.user_id=?').get(activityId,userId);
  if(row?.alias)return row.alias;
  return this.db.prepare('SELECT display_name name FROM users WHERE id=?').get(userId)?.name||'Player';
 }
 render(m,viewer){
  const moves=JSON.parse(m.moves_json),state=playHistory(moves),names=this.names(m,viewer);
  return {id:m.id,status:m.status,mode:m.mode||'multiplayer',result:m.result,reason:m.reason,
   fen:fen(state),turn:state.t===1?'white':'black',moves,revision:m.revision,
   createdAt:m.created_at,updatedAt:m.updated_at,white:names.white,black:names.black,
   myColor:m.white_id===viewer.id?'white':m.black_id===viewer.id?'black':null,
   canJoin:m.status==='waiting'&&m.white_id!==viewer.id,
   // Activity identifiers stay private to the teacher operator API.
   ...(this.teacher(viewer)?{activityId:m.activity_id,seatClassId:this.seatClass(viewer,m)}:{}),
  };
 }
 get(user,activityId,matchId,{teacher=false}={}){
  this.authorize(user,activityId,false,{teacher});
  const m=this.row(matchId);
  if(!m||!this.isSeat(m,user)&&!teacher)error(404,'Chess match not found.');
  return this.render(m,user);
 }
 list(user,activityId,{teacher=false}={}){
  this.authorize(user,activityId,false,{teacher});
  const rows=this.db.prepare("SELECT * FROM learning_chess_matches WHERE status='waiting' OR white_id=? OR black_id=? ORDER BY updated_at DESC LIMIT 200").all(user.id,user.id);
  return rows.map(m=>this.render(m,user));
 }
 teacherList(user){
  if(!this.teacher(user))error(403,'Teacher access required.');
  const rows=this.db.prepare('SELECT * FROM learning_chess_matches ORDER BY updated_at DESC LIMIT 200').all();
  return rows.map(m=>this.render(m,user));
 }
 heartbeat(user,activityId,{teacher=false}={}){
  this.authorize(user,activityId,false,{teacher});
  this.db.prepare('INSERT INTO learning_chess_presence(activity_id,user_id,last_seen) VALUES(?,?,?) ON CONFLICT(activity_id,user_id) DO UPDATE SET last_seen=excluded.last_seen').run(activityId,user.id,Date.now());
  return {connected:true};
 }
 connected(user){
  if(!this.teacher(user))error(403,'Teacher access required.');
  const rows=this.db.prepare('SELECT p.activity_id,p.user_id,p.last_seen,a.class_id FROM learning_chess_presence p JOIN learning_activities a ON a.id=p.activity_id WHERE p.last_seen>=? ORDER BY p.last_seen DESC LIMIT 200').all(Date.now()-35000);
  return rows.map(r=>{
   let name='Student (other class)';
   if(r.user_id===user.id)name='You';
   else try{this.learning.membership(user,r.class_id,true);name=this.alias(r.user_id,r.activity_id);}catch{}
   return {name,lastSeen:r.last_seen};
  });
 }
 create(user,activityId,{teacher=false,mode='multiplayer'}={}){
  this.authorize(user,activityId,true,{teacher});
  if(!['multiplayer','computer','solo'].includes(mode))error(400,'Choose multiplayer, computer, or solo practice.');
  return this.store.tx(()=>{
   const cutoff=new Date(Date.now()-30*60*1000).toISOString();
   const abandoned=new Date(Date.now()-7*24*60*60*1000).toISOString();
   // Bounded cleanup on creation, not a scheduler that can affect other services.
   this.db.prepare("UPDATE learning_chess_matches SET status='finished',result='draw',reason='queue expired',revision=revision+1 WHERE status='waiting' AND updated_at<?").run(cutoff);
   this.db.prepare("UPDATE learning_chess_matches SET status='finished',result='draw',reason='inactive game',revision=revision+1 WHERE status='active' AND updated_at<?").run(abandoned);
   if(this.db.prepare("SELECT COUNT(*) n FROM learning_chess_matches WHERE status IN ('waiting','active')").get().n>=250)error(429,'Chess service is at capacity.');
   // One waiting queue slot per user, globally, including across SCORM classes.
   if(mode==='multiplayer'){
    const prior=this.db.prepare("SELECT * FROM learning_chess_matches WHERE white_id=? AND mode='multiplayer' AND status='waiting' LIMIT 1").get(user.id);
    if(prior)return this.render(prior,user);
   }
   const id=crypto.randomUUID(),stamp=new Date().toISOString(),status=mode==='multiplayer'?'waiting':'active';
   this.db.prepare('INSERT INTO learning_chess_matches(id,activity_id,white_id,black_id,status,moves_json,created_at,updated_at,mode) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(id,activityId,user.id,mode==='solo'?user.id:null,status,'[]',stamp,stamp,mode);
   this.learning.event(user,activityId,'chess.create',id,{mode});
   return this.render(this.row(id),user);
  });
 }
 leave(user,activityId,matchId,revision,{teacher=false}={}){
  this.authorize(user,activityId,true,{teacher});
  if(!Number.isSafeInteger(revision)||revision<0)error(400,'Current match revision required.');
  return this.store.tx(()=>{
   const m=this.row(matchId);
   if(!m||m.status==='finished'||!this.isSeat(m,user))error(409,'Match is no longer active.');
   if(m.revision!==revision)error(409,'Match state changed. Refresh before leaving.');
   const permitted=m.white_id===user.id&&m.activity_id===activityId||
    m.black_id===user.id&&(m.black_activity_id||m.activity_id)===activityId;
   if(!permitted)error(403,'Match belongs to another assignment.');
   const cancel=m.status==='waiting',result=cancel||m.mode!=='multiplayer'?'draw':m.white_id===user.id?'black':'white';
   const reason=cancel?'queue cancelled':m.mode==='multiplayer'?'resignation':'practice ended';
   this.db.prepare("UPDATE learning_chess_matches SET status='finished',result=?,reason=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?")
    .run(result,reason,new Date().toISOString(),matchId,revision);
   this.learning.event(user,activityId,'chess.leave',matchId,{reason});
   return this.render(this.row(matchId),user);
  });
 }
 join(user,activityId,matchId,{teacher=false}={}){
  this.authorize(user,activityId,true,{teacher});
  return this.store.tx(()=>{
   const row=this.row(matchId);
   if(!row||row.status!=='waiting'||row.mode!=='multiplayer'||row.white_id===user.id||Date.now()-Date.parse(row.updated_at)>30*60*1000)error(409,'Match unavailable.');
   const stamp=new Date().toISOString();
   const change=this.db.prepare("UPDATE learning_chess_matches SET black_id=?,black_activity_id=?,status='active',revision=revision+1,updated_at=? WHERE id=? AND status='waiting' AND black_id IS NULL").run(user.id,activityId,stamp,matchId);
   if(!change.changes)error(409,'Another player joined first.');
   this.learning.event(user,activityId,'chess.join',matchId,{otherActivity:row.activity_id});
   return this.render(this.row(matchId),user);
  });
 }
 move(user,activityId,matchId,requested,revision,{teacher=false}={}){
  this.authorize(user,activityId,true,{teacher});
  if(!Number.isSafeInteger(revision)||revision<0)error(400,'Current match revision required.');
  return this.store.tx(()=>{
   const m=this.row(matchId);
   if(!m||m.status!=='active'||!this.isSeat(m,user))error(404,'Active chess match not found.');
   // A participant can only act through their original scoped assignment bearer.
   const permitted=(m.white_id===user.id&&m.activity_id===activityId)||
    (m.black_id===user.id&&(m.black_activity_id||m.activity_id)===activityId);
   if(!permitted)error(403,'This match belongs to a different assignment session.');
   if(m.revision!==revision)error(409,'The board changed. Refresh before moving.');
   const prior=JSON.parse(m.moves_json);
   if(prior.length>=512)error(409,'Maximum match length reached.');
   const whiteTurn=prior.length%2===0;
   if(m.mode==='multiplayer'&&(whiteTurn?m.white_id:m.black_id)!==user.id)error(403,'It is not your turn.');
   if(m.mode==='computer'&&!whiteTurn)error(409,'Computer turn is already in progress.');
   const initial=play(START,prior,requested),moves=[...prior,requested];let state=initial;
   if(m.mode==='computer'&&state.outcome.status==='active'){
    const computer=playHistory(moves),candidates=legal(computer);
    // Simple deterministic material-aware baseline AI. The server selects and validates its move.
    const value={p:1,n:3,b:3,r:5,q:9,k:0};
    const ranked=candidates.map(mv=>({mv,score:(computer.b[mv[1]]==='.'?0:value[computer.b[mv[1]].toLowerCase()]*100)
     +(mv[2]?value[mv[2]]*90:0)+(square(mv[1]).charCodeAt(0)%3)})).sort((a,b)=>b.score-a.score||uci(a.mv).localeCompare(uci(b.mv)));
    state=play(START,moves,uci(ranked[0].mv));moves.push(uci(ranked[0].mv));
   }
   const stamp=new Date().toISOString();
   const changed=this.db.prepare('UPDATE learning_chess_matches SET moves_json=?,status=?,result=?,reason=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
    .run(JSON.stringify(moves),state.outcome.status,state.outcome.result,state.outcome.reason,stamp,matchId,revision);
   if(!changed.changes)error(409,'The board changed.');
   this.learning.event(user,activityId,'chess.move',matchId,{ply:moves.length,ended:state.outcome.status==='finished'});
   return this.render(this.row(matchId),user);
  });
 }
}

function playHistory(moves){
 let s=parse();for(const move of moves){const m=legal(s).find(x=>uci(x)===move);if(!m)error(409,'Chess history invalid.');s=apply(s,m);}return s;
}
module.exports={ChessMatches,START,parse,fen,legal,apply,uci,play,outcome,error};
