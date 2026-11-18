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
// Conservative dead-position proof for completely locked pawn barriers.
function lockedPawns(s){
 const pawns=[];for(let i=0;i<128;i++)if(on(i)&&s.b[i]!=='.'&&s.b[i].toLowerCase()!=='k'){if(s.b[i].toLowerCase()!=='p')return false;pawns.push(i);}
 if(!pawns.length)return false;
 for(const i of pawns){const dir=-16*side(s.b[i]),forward=i+dir;if(!on(forward)||s.b[forward].toLowerCase()!=='p')return false;for(const d of [-1,1]){const t=forward+d;if(on(t)&&side(s.b[t])===-side(s.b[i]))return false;}if(s.ep>=0&&[forward-1,forward+1].includes(s.ep))return false;}
 for(const by of [1,-1]){
  const queue=[s.b.indexOf(by===1?'K':'k')],seen=new Set(queue);
  for(let n=0;n<queue.length;n++)for(const d of dirs.k){const t=queue[n]+d;if(!on(t)||seen.has(t))continue;seen.add(t);const p=s.b[t];if(p.toLowerCase()==='p'){
   if(side(p)===by)continue;const defended=pawns.some(f=>side(s.b[f])===-by&&[f+16*by-1,f+16*by+1].includes(t));if(!defended)return false;continue;
  }queue.push(t);}
 }
 return true;
}
function canMate(s,by){
 if(insufficient(s)||lockedPawns(s))return false;
 const own=[],other=[];for(let i=0;i<128;i++)if(on(i)&&s.b[i]!=='.'&&s.b[i].toLowerCase()!=='k')(side(s.b[i])===by?own:other).push(s.b[i].toLowerCase());
 if(!own.length)return false;if(own.length===1&&['b','n'].includes(own[0])&&!other.length)return false;return true;
}
function historyOf(moves){let state=parse(),history=[state];for(const move of moves){const m=legal(state).find(x=>uci(x)===move);if(!m)error(409,'Chess history invalid.');state=apply(state,m);history.push(state);}return history;}
function claimable(history){const s=history.at(-1),key=positionKey(s);return {repetition:history.filter(p=>positionKey(p)===key).length>=3,fiftyMove:s.half>=100};}
const TIME_CONTROLS=Object.freeze({'none':[0,0],'3+0':[180000,0],'5+0':[300000,0],'5+3':[300000,3000],'10+0':[600000,0],'15+10':[900000,10000]});
function positionKey(s){return s.b.join('')+':'+s.t+':'+s.c+':'+(s.ep>=0&&legal(s).some(m=>m[3]==='ep')?s.ep:-1);}
function outcome(history){
 const s=history.at(-1),l=legal(s);
 if(!l.length)return checked(s)?{status:'finished',result:s.t===1?'black':'white',reason:'checkmate'}:{status:'finished',result:'draw',reason:'stalemate'};
 if(insufficient(s))return {status:'finished',result:'draw',reason:'insufficient material'};
 if(lockedPawns(s))return {status:'finished',result:'draw',reason:'dead position'};
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
  if(!columns.has('difficulty'))this.db.exec("ALTER TABLE learning_chess_matches ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'beginner'");
  for(const [name,type] of [['time_control',"TEXT NOT NULL DEFAULT 'none'"],['white_ms','INTEGER'],['black_ms','INTEGER'],['turn_started_at','INTEGER'],['draw_offer','TEXT']])if(!columns.has(name))this.db.exec('ALTER TABLE learning_chess_matches ADD COLUMN '+name+' '+type);
  this.db.exec(`CREATE TABLE IF NOT EXISTS learning_chess_requests(user_id TEXT NOT NULL,request_id TEXT NOT NULL,match_id TEXT NOT NULL REFERENCES learning_chess_matches(id) ON DELETE CASCADE,fingerprint TEXT NOT NULL,PRIMARY KEY(user_id,request_id));`);
  this.positions=new Map();this.pendingSearch=new Map();
  this.db.exec(`CREATE INDEX IF NOT EXISTS learning_chess_global_status ON learning_chess_matches(status,updated_at);
   CREATE TRIGGER IF NOT EXISTS learning_chess_user_delete BEFORE DELETE ON users BEGIN
    DELETE FROM learning_chess_matches WHERE white_id=OLD.id OR black_id=OLD.id;
    DELETE FROM learning_chess_presence WHERE user_id=OLD.id;
   END;
   CREATE TRIGGER IF NOT EXISTS learning_chess_activity_delete BEFORE DELETE ON learning_activities BEGIN
    DELETE FROM learning_chess_matches WHERE activity_id=OLD.id OR black_activity_id=OLD.id;
    DELETE FROM learning_chess_presence WHERE activity_id=OLD.id;
   END;`);
 }
 teacher(user){return !!user&&!user.directParticipant&&user.profileId!=='learning-student'&&this.learning.teacherCapability?.(user);}
 authorize(user,activityId,write=false,{teacher=false}={}){
  const a=this.learning.activity(user,activityId,teacher);
  if(a.template_id!=='scorm-connector-v1')error(409,'Use a SCORM assignment for chess.');
  if(write)this.learning.writable(a);
  if(!teacher&&a.member.role!=='student')error(403,'Student activity access required.');
  if(teacher&&!this.teacher(user))error(403,'Teacher access required.');
  return a;
 }
 teacherActivity(user,classId,matchId=null){
  if(!this.teacher(user))error(403,'Teacher access required.');
  this.learning.membership(user,classId,true);
  if(matchId){
   const match=this.row(matchId);
   const activityId=match?.white_id===user.id?match.activity_id:match?.black_id===user.id?(match.black_activity_id||match.activity_id):null;
   const activity=activityId&&this.learning.activity(user,activityId,true);
   if(!activity||activity.class_id!==classId)error(404,'Your chess seat was not found in this class.');
   return activityId;
  }
  const row=this.db.prepare("SELECT id FROM learning_activities WHERE class_id=? AND template_id='scorm-connector-v1' ORDER BY created_at DESC LIMIT 1").get(classId);
  if(!row)error(409,'Create a SCORM assignment for this class before joining chess.');
  return row.id;
 }
 seatInActivity(m,user,activityId){return m.white_id===user.id&&m.activity_id===activityId||m.black_id===user.id&&(m.black_activity_id||m.activity_id)===activityId;}
 seatAvailable(m,color){
  const id=color==='white'?m.white_id:m.black_id;
  const activityId=color==='white'?m.activity_id:(m.black_activity_id||m.activity_id);
  if(!id)return false;
  const user=this.store.listUsers().find(u=>u.id===id&&u.enabled);
  if(!user)return false;
  try{
   this.authorize(user,activityId,true,{teacher:this.teacher(user)});
   if(this.learning.direct.isParticipant(id)){
    if(!this.learning.direct.available(activityId))return false;
    if(this.db.prepare('SELECT revoked FROM learning_direct_participants WHERE user_id=?').get(id)?.revoked)return false;
   }
   return true;
  }catch{return false;}
 }
 isSeat(m,user){return m.white_id===user.id||m.black_id===user.id;}
 state(m){const key=m.id+':'+m.revision;if(this.positions.has(key))return this.positions.get(key);const state=playHistory(JSON.parse(m.moves_json));this.positions.set(key,state);if(this.positions.size>300)this.positions.delete(this.positions.keys().next().value);return state;}
 clock(m,now=Date.now()){
  if(m.time_control==='none'||!m.time_control)return null;const turn=JSON.parse(m.moves_json).length%2?'black':'white';
  const clocks={white:m.white_ms,black:m.black_ms,increment:TIME_CONTROLS[m.time_control][1],running:m.status==='active'&&m.turn_started_at!==null?turn:null,serverNow:now,unavailable:!!this.clockError};
  if(clocks.running&&m.turn_started_at!==null)clocks[turn]=Math.max(0,clocks[turn]-Math.max(0,now-m.turn_started_at));return clocks;
 }
 clockPaused(m,now){
  if(!this.seatAvailable(m,'white')||m.mode==='multiplayer'&&!this.seatAvailable(m,'black'))return true;
  for(const [id,userId] of [[m.activity_id,m.white_id],[m.black_activity_id||m.activity_id,m.black_id]]){
   if(!userId)continue;const a=this.db.prepare('SELECT a.open,a.close_at,COALESCE(c.paused,0) paused,m.role,m.exempt FROM learning_activities a JOIN learning_members m ON m.class_id=a.class_id AND m.user_id=? LEFT JOIN learning_portal_commands c ON c.activity_id=a.id WHERE a.id=?').get(userId,id);
   if(!a)return true;if(a.role==='student'&&(a.paused||!a.open||a.close_at&&now>=Date.parse(a.close_at)&&!a.exempt))return true;
  }return false;
 }
 expireClocks(now=Date.now()){
  return this.store.tx(()=>{for(const m of this.db.prepare("SELECT * FROM learning_chess_matches WHERE status='active' AND time_control<>'none'").all()){
   if(this.pendingSearch.has(m.id+':'+m.revision))continue;
   const clock=this.clock(m,now),loser=JSON.parse(m.moves_json).length%2?'black':'white';
   if(this.clockPaused(m,now)){
    if(m.turn_started_at!==null)this.db.prepare('UPDATE learning_chess_matches SET white_ms=?,black_ms=?,turn_started_at=NULL,revision=revision+1 WHERE id=? AND revision=?').run(clock.white,clock.black,m.id,m.revision);
    continue;
   }
   if(m.turn_started_at===null){this.db.prepare('UPDATE learning_chess_matches SET turn_started_at=?,revision=revision+1 WHERE id=? AND revision=?').run(now,m.id,m.revision);continue;}
   if(clock[loser]>0)continue;const winner=loser==='white'?'black':'white',result=canMate(this.state(m),winner==='white'?1:-1)?winner:'draw';
   this.db.prepare("UPDATE learning_chess_matches SET status='finished',result=?,reason='timeout',white_ms=?,black_ms=?,turn_started_at=NULL,draw_offer=NULL,revision=revision+1,updated_at=? WHERE id=? AND revision=?").run(result,clock.white,clock.black,new Date(now).toISOString(),m.id,m.revision);
  }});
 }
 startClocks(available){this.clockTimer=setInterval(()=>{if(available())try{this.expireClocks();this.clockError=false;}catch{this.clockError=true;}},1000);this.clockTimer.unref?.();}
 close(){clearInterval(this.clockTimer);}

 queueFresh(m){return Date.now()-Math.max(Date.parse(m.updated_at),this.db.prepare('SELECT last_seen FROM learning_chess_presence WHERE activity_id=? AND user_id=?').get(m.activity_id,m.white_id)?.last_seen||0)<35000;}
 capacity(user){if(this.db.prepare("SELECT COUNT(*) n FROM learning_chess_matches WHERE status IN ('waiting','active') AND (white_id=? OR black_id=?)").get(user.id,user.id).n>=12)error(429,'You have 12 open games. Finish or forfeit one before starting another.');}
 row(id){return this.db.prepare('SELECT * FROM learning_chess_matches WHERE id=?').get(id);}
 names(m,viewer){
  // The SCO sends the LMS-reported name on enrollment, not proof of identity.
  // Teachers see full aliases only for their authorized classes.
  const label=(id,role,activityId)=>{
   if(!id)return null;
   if(id===viewer.id)return 'You';
   if(this.teacher(viewer)){
    const a=this.db.prepare('SELECT class_id FROM learning_activities WHERE id=?').get(activityId);
    try{if(a){this.learning.membership(viewer,a.class_id,true);return this.alias(id,activityId);}}catch{}
   }
   return this.publicName(id,activityId,role);
  };
  return {white:{id:m.white_id===viewer.id?viewer.id:null,name:label(m.white_id,'white',m.activity_id)},
   black:m.mode==='computer'?{id:'computer',name:'Computer'}:m.mode==='solo'?{id:m.white_id===viewer.id?viewer.id:null,name:'Practice (Black)'}:m.black_id?{id:m.black_id===viewer.id?viewer.id:null,name:label(m.black_id,'black',m.black_activity_id||m.activity_id)}:null};
 }
 publicName(userId,activityId,role){
  const display=this.alias(userId,activityId).trim();
  // SCORM 1.2 commonly reports learner names as "Family, Given".
  // Keep the original LMS attribution stored unchanged; normalize only the visible nickname.
  const comma=display.indexOf(',');
  const given=comma>=0?display.slice(comma+1).trim():display;
  const family=comma>=0?display.slice(0,comma).trim():display;
  const first=given.split(/\s+/u).filter(Boolean)[0];
  const surname=comma>=0?family.split(/\s+/u).filter(Boolean)[0]:given.split(/\s+/u).filter(Boolean).at(-1);
  if(!first)return role==='white'?'Player White':'Player Black';
  const initial=surname&&surname!==first?' '+Array.from(surname)[0].toUpperCase()+'.':'';
  return first.slice(0,32)+initial;
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
  const moves=JSON.parse(m.moves_json),state=this.state(m),names=this.names(m,viewer);
  return {id:m.id,status:m.status,mode:m.mode||'multiplayer',result:m.result,reason:m.reason,
   timeControl:m.time_control||'none',clocks:this.clock(m),drawOffer:m.draw_offer===viewer.id?'you':m.draw_offer?'opponent':null,drawClaims:m.status==='active'?claimable(historyOf(moves)):{repetition:false,fiftyMove:false},
   legalMoves:m.status==='active'?legal(state).map(uci):[],inCheck:checked(state),difficulty:m.difficulty||'beginner',
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
  if(!m||!teacher&&(!this.isSeat(m,user)||!this.seatInActivity(m,user,activityId)))error(404,'Chess match not found.');
  return this.render(m,user);
 }
 list(user,activityId,{teacher=false}={}){
  this.authorize(user,activityId,false,{teacher});
  const mine=this.db.prepare("SELECT * FROM learning_chess_matches WHERE white_id=? OR black_id=? ORDER BY CASE WHEN status='finished' THEN 1 ELSE 0 END,updated_at DESC LIMIT 100").all(user.id,user.id).filter(m=>this.seatInActivity(m,user,activityId));
  const waiting=this.db.prepare("SELECT * FROM learning_chess_matches WHERE status='waiting' AND white_id<>? ORDER BY updated_at DESC LIMIT 100").all(user.id).filter(m=>this.seatAvailable(m,'white')&&this.queueFresh(m));
  return [...new Map([...mine,...waiting].map(m=>[m.id,m])).values()].map(m=>this.render(m,user));
 }
 teacherList(user){
  if(!this.teacher(user))error(403,'Teacher access required.');
  const rows=this.db.prepare('SELECT * FROM learning_chess_matches ORDER BY updated_at DESC LIMIT 200').all();
  return rows.map(m=>this.render(m,user));
 }
 progress(user,activityId){
  const rows=this.db.prepare('SELECT * FROM learning_chess_matches WHERE (white_id=? AND activity_id=?) OR (black_id=? AND COALESCE(black_activity_id,activity_id)=?)').all(user.id,activityId,user.id,activityId);
  return Math.min(5,rows.reduce((total,m)=>{const n=JSON.parse(m.moves_json).length;return total+(m.mode==='solo'?n:m.white_id===user.id?Math.ceil(n/2):Math.floor(n/2));},0));
 }
 leaderboard(viewer,activityId=null,{teacher=false}={}){
  if(teacher){
   if(!this.teacher(viewer))error(403,'Teacher access required.');
  }else this.authorize(viewer,activityId,false);
  return this.standings(viewer,{teacher});
 }
 standings(viewer,{teacher=false}={}){
  const emptyPractice=()=>({started:0,active:0,games:0,wins:0,losses:0,draws:0,stopped:0,winRate:0});
  const players=new Map(),ensure=(id,activity)=>{
   if(!players.has(id))players.set(id,{id,sourceActivityId:activity,games:0,wins:0,losses:0,draws:0,mateWins:0,forfeitWins:0,timeoutWins:0,mateLosses:0,forfeitLosses:0,timeoutLosses:0,movesTotal:0,winMovesTotal:0,mateMovesTotal:0,fastestMate:null,currentWinStreak:0,bestWinStreak:0});
   const p=players.get(id);if(activity)p.sourceActivityId=activity;return p;
  };
  const games=this.db.prepare("SELECT id,activity_id,black_activity_id,white_id,black_id,result,reason,json_array_length(moves_json) plies FROM learning_chess_matches WHERE status='finished' AND mode='multiplayer' AND black_id IS NOT NULL AND result IN ('white','black','draw') AND reason NOT IN ('queue cancelled','queue expired','inactive game','move limit') ORDER BY updated_at,id").all();
  for(const game of games)for(const seat of ['white','black']){
   const p=ensure(game[seat+'_id'],seat==='white'?game.activity_id:game.black_activity_id||game.activity_id),moves=seat==='white'?Math.ceil(game.plies/2):Math.floor(game.plies/2);
   p.games++;p.movesTotal+=moves;
   const category=game.reason==='checkmate'?'mate':game.reason==='resignation'||game.reason==='forfeit'?'forfeit':game.reason==='timeout'?'timeout':null;
   if(game.result===seat){p.wins++;p.winMovesTotal+=moves;p.currentWinStreak++;p.bestWinStreak=Math.max(p.bestWinStreak,p.currentWinStreak);if(category)p[category+'Wins']++;if(category==='mate'){p.mateMovesTotal+=moves;p.fastestMate=p.fastestMate===null?moves:Math.min(p.fastestMate,moves);}}
   else{p.currentWinStreak=0;if(game.result==='draw')p.draws++;else{p.losses++;if(category)p[category+'Losses']++;}}
  }
  for(const row of this.db.prepare("SELECT white_id,activity_id,mode,status,result,reason FROM learning_chess_matches WHERE mode IN ('computer','solo') AND json_array_length(moves_json)>0").all()){
   const p=ensure(row.white_id,row.activity_id);p.practice=(p.practice||0)+1;p[row.mode]=(p[row.mode]||0)+1;const stats=p[row.mode+'Stats']||emptyPractice();stats.started++;
   if(row.status==='active')stats.active++;else if(['practice ended','inactive game'].includes(row.reason))stats.stopped++;else if(row.status==='finished'){stats.games++;stats[row.result==='draw'?'draws':row.result==='white'?'wins':'losses']++;}
   stats.winRate=stats.games?Math.round(100*stats.wins/stats.games):0;p[row.mode+'Stats']=stats;
  }
  const average=(total,count)=>count?Math.round(total/count*10)/10:null;
  const result=[...players.values()].map(p=>{
   const playerKey='Player-'+crypto.createHash('sha256').update(p.id).digest('hex').slice(0,8).toUpperCase();let label=this.publicName(p.id,p.sourceActivityId,'white');
   if(teacher){try{const a=this.db.prepare('SELECT class_id FROM learning_activities WHERE id=?').get(p.sourceActivityId);if(a){this.learning.membership(viewer,a.class_id,true);label=this.alias(p.id,p.sourceActivityId);}}catch{}}
   const {id,sourceActivityId,movesTotal,winMovesTotal,mateMovesTotal,...publicStats}=p;
   return {...publicStats,playerKey,label,me:p.id===viewer.id,winRate:p.games?Math.round(100*p.wins/p.games):0,avgGameMoves:average(movesTotal,p.games),avgMovesPerWin:average(winMovesTotal,p.wins),avgMovesToMate:average(mateMovesTotal,p.mateWins),practice:p.practice||0,computer:p.computer||0,solo:p.solo||0,computerStats:p.computerStats||emptyPractice(),soloStats:p.soloStats||emptyPractice()};
  }).sort((a,b)=>b.mateWins-a.mateWins||b.wins-a.wins||b.games-a.games||b.winRate-a.winRate||a.playerKey.localeCompare(b.playerKey));
  return {players:result.slice(0,100).map((p,i)=>({rank:i+1,...p})),totalPlayers:result.length,rankedPlayers:result.filter(p=>p.games>0).length,rules:'Checkmate wins rank first. Total wins include separately labeled forfeits and time-outs. Move averages count each player’s own moves. Practice results are separate.',identity:'LMS-reported player accounts are not verified unique people.'};
 }
 displayLeaderboard(){
  const now=performance.now(),change=this.db.prepare('SELECT total_changes() n').get().n,version=this.db.prepare('PRAGMA data_version').get().data_version;
  if(this.displayCache&&this.displayCache.change===change&&this.displayCache.version===version&&now-this.displayCache.at<2000)return this.displayCache.value;
  const board=this.standings({id:null}),value={players:board.players.filter(p=>p.games>0).map(({rank,playerKey,label,games,wins,losses,draws,winRate,mateWins,forfeitWins,timeoutWins,mateLosses,forfeitLosses,timeoutLosses,avgGameMoves,avgMovesPerWin,avgMovesToMate,fastestMate,currentWinStreak,bestWinStreak})=>({rank,playerKey,label,games,wins,losses,draws,winRate,mateWins,forfeitWins,timeoutWins,mateLosses,forfeitLosses,timeoutLosses,avgGameMoves,avgMovesPerWin,avgMovesToMate,fastestMate,currentWinStreak,bestWinStreak})),totalPlayers:board.rankedPlayers,updatedAt:new Date().toISOString()};
  this.displayCache={at:now,change,version,value};return value;
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
   let name=this.publicName(r.user_id,r.activity_id,'white')+' (other class)';
   if(r.user_id===user.id)name='You';
   else try{this.learning.membership(user,r.class_id,true);name=this.alias(r.user_id,r.activity_id);}catch{}
   return {name,lastSeen:r.last_seen};
  });
 }
 create(user,activityId,{teacher=false,mode='multiplayer',difficulty='beginner',timeControl='none',requestId=null}={}){
  this.authorize(user,activityId,true,{teacher});
  if(!['beginner','standard','advanced'].includes(difficulty))error(400,'Choose an available computer level.');
  if(!['multiplayer','computer','solo'].includes(mode))error(400,'Choose multiplayer, computer, or solo practice.');
  if(!Object.hasOwn(TIME_CONTROLS,timeControl)||mode==='solo'&&timeControl!=='none')error(400,'Choose an available time control. Solo practice is untimed.');
  if(requestId!==null&&(typeof requestId!=='string'||!/^[-a-f0-9]{36}$/.test(requestId)))error(400,'A valid game request ID is required.');
  return this.store.tx(()=>{
   this.expireClocks();const fingerprint=JSON.stringify([activityId,mode,difficulty,timeControl]);
   if(requestId){const old=this.db.prepare('SELECT * FROM learning_chess_requests WHERE user_id=? AND request_id=?').get(user.id,requestId);if(old){if(old.fingerprint!==fingerprint)error(409,'This game request was already used with different settings.');return this.render(this.row(old.match_id),user);}}
   else{const old=this.db.prepare("SELECT * FROM learning_chess_matches WHERE mode=? AND time_control=? AND status IN ('waiting','active') AND ((white_id=? AND activity_id=?) OR (black_id=? AND COALESCE(black_activity_id,activity_id)=?)) LIMIT 1").get(mode,timeControl,user.id,activityId,user.id,activityId);if(old)return this.render(old,user);}
   this.capacity(user);
   const remember=m=>{if(requestId)this.db.prepare('INSERT INTO learning_chess_requests(user_id,request_id,match_id,fingerprint) VALUES(?,?,?,?)').run(user.id,requestId,m.id,fingerprint);return this.render(m,user);};
   if(mode==='multiplayer'){
    const available=this.db.prepare("SELECT * FROM learning_chess_matches WHERE mode='multiplayer' AND time_control=? AND status='waiting' AND white_id<>? ORDER BY created_at,id").all(timeControl,user.id).find(m=>this.seatAvailable(m,'white')&&this.queueFresh(m));
    if(available){const stamp=new Date().toISOString();const change=this.db.prepare("UPDATE learning_chess_matches SET black_id=?,black_activity_id=?,status='active',turn_started_at=?,revision=revision+1,updated_at=? WHERE id=? AND status='waiting' AND black_id IS NULL").run(user.id,activityId,timeControl==='none'?null:Date.now(),stamp,available.id);if(!change.changes)error(409,'Match queue changed. Try again.');this.learning.event(user,activityId,'chess.join',available.id,{matchedFromQueue:true});return remember(this.row(available.id));}
   }
   if(this.db.prepare("SELECT COUNT(*) n FROM learning_chess_matches WHERE status IN ('waiting','active')").get().n>=250)error(429,'Chess service is at capacity.');
   const id=crypto.randomUUID(),stamp=new Date().toISOString(),status=mode==='multiplayer'?'waiting':'active',base=TIME_CONTROLS[timeControl][0];
   this.db.prepare('INSERT INTO learning_chess_matches(id,activity_id,white_id,black_id,status,moves_json,created_at,updated_at,mode,difficulty,time_control,white_ms,black_ms,turn_started_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,activityId,user.id,mode==='solo'?user.id:null,status,'[]',stamp,stamp,mode,difficulty,timeControl,base||null,base||null,status==='active'&&base?Date.now():null);
   this.learning.event(user,activityId,'chess.create',id,{mode,difficulty,timeControl});return remember(this.row(id));
  });
 }
 leave(user,activityId,matchId,revision,{teacher=false}={}){
  this.authorize(user,activityId,true,{teacher});this.expireClocks();
  if(!Number.isSafeInteger(revision)||revision<0)error(400,'Current match revision required.');
  return this.store.tx(()=>{
   const m=this.row(matchId);
   if(!m||m.status==='finished'||!this.isSeat(m,user))error(409,'Match is no longer active.');
   if(m.revision!==revision)error(409,'Match state changed. Refresh before leaving.');
   const permitted=m.white_id===user.id&&m.activity_id===activityId||
    m.black_id===user.id&&(m.black_activity_id||m.activity_id)===activityId;
   if(!permitted)error(403,'Match belongs to another assignment.');
   const cancel=m.status==='waiting',winner=m.white_id===user.id?'black':'white',result=cancel||m.mode!=='multiplayer'||!canMate(this.state(m),winner==='white'?1:-1)?'draw':winner;
   const reason=cancel?'queue cancelled':m.mode==='multiplayer'?'resignation':'practice ended';
   this.db.prepare("UPDATE learning_chess_matches SET status='finished',result=?,reason=?,turn_started_at=NULL,draw_offer=NULL,revision=revision+1,updated_at=? WHERE id=? AND revision=?")
    .run(result,reason,new Date().toISOString(),matchId,revision);
   this.learning.event(user,activityId,'chess.leave',matchId,{reason});
   return this.render(this.row(matchId),user);
  });
 }
 join(user,activityId,matchId,{teacher=false}={}){
  this.authorize(user,activityId,true,{teacher});
  return this.store.tx(()=>{
   const row=this.row(matchId);
   if(!row||row.status!=='waiting'||row.mode!=='multiplayer'||row.white_id===user.id||!this.queueFresh(row)||!this.seatAvailable(row,'white'))error(409,'Match unavailable.');
   this.capacity(user);
   const stamp=new Date().toISOString();
   const change=this.db.prepare("UPDATE learning_chess_matches SET black_id=?,black_activity_id=?,status='active',turn_started_at=?,revision=revision+1,updated_at=? WHERE id=? AND status='waiting' AND black_id IS NULL").run(user.id,activityId,row.time_control==='none'?null:Date.now(),stamp,matchId);
   if(!change.changes)error(409,'Another player joined first.');
   this.learning.event(user,activityId,'chess.join',matchId,{otherActivity:row.activity_id});
   return this.render(this.row(matchId),user);
  });
 }
 draw(user,activityId,matchId,input,{teacher=false}={}){
  this.authorize(user,activityId,true,{teacher});this.expireClocks();
  if(!Number.isSafeInteger(input?.revision)||input.revision<0)error(400,'Current match revision required.');
  return this.store.tx(()=>{
   const m=this.row(matchId);if(!m||m.status!=='active'||!this.seatInActivity(m,user,activityId))error(404,'Your active chess match was not found.');if(m.revision!==input.revision)error(409,'The board changed. Refresh first.');
   const history=historyOf(JSON.parse(m.moves_json)),state=history.at(-1);let reason=null,offer=m.draw_offer;
   if(input.action==='claim'){
    if(m.mode!=='solo'&&(state.t===1?m.white_id:m.black_id)!==user.id)error(403,'Only the player to move may claim a draw.');
    let claims=claimable(history);if(input.move!==undefined){const next=legal(state).find(x=>uci(x)===input.move);if(!next)error(409,'The intended move is not legal.');claims=claimable([...history,apply(state,next)]);}
    if(input.kind==='repetition'&&claims.repetition)reason='threefold repetition';else if(input.kind==='fifty-move'&&claims.fiftyMove)reason='fifty-move rule';else error(409,'This position does not support that draw claim.');
   }else{
    if(m.mode!=='multiplayer'||history.length<3)error(409,'Draw agreements require both players to have moved.');
    if(input.action==='offer')offer=user.id;
    else if(input.action==='accept'&&offer&&offer!==user.id)reason='agreement';
    else if(input.action==='decline'&&offer&&offer!==user.id)offer=null;
    else error(409,'There is no opponent draw offer to answer.');
   }
   this.db.prepare("UPDATE learning_chess_matches SET status=?,result=?,reason=?,draw_offer=?,turn_started_at=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?").run(reason?'finished':'active',reason?'draw':null,reason,reason?null:offer,reason?null:m.turn_started_at,new Date().toISOString(),m.id,m.revision);
   this.learning.event(user,activityId,'chess.draw',matchId,{action:input.action,reason});return this.render(this.row(matchId),user);
  });
 }
 move(user,activityId,matchId,requested,revision,{teacher=false}={}){
  this.expireClocks();const receivedAt=Date.now();
  if(!Number.isSafeInteger(revision)||revision<0)error(400,'Current match revision required.');
  const prepare=()=>{
   this.authorize(user,activityId,true,{teacher});
   const m=this.row(matchId);
   if(!m||m.status!=='active'||!this.isSeat(m,user))error(404,'Active chess match not found.');
   // A participant can only act through their original scoped assignment bearer.
   const permitted=(m.white_id===user.id&&m.activity_id===activityId)||
    (m.black_id===user.id&&(m.black_activity_id||m.activity_id)===activityId);
   if(!permitted)error(403,'This match belongs to a different assignment session.');
   if(m.revision!==revision)error(409,'The board changed. Refresh before moving.');
   if(!this.seatAvailable(m,'white')||m.mode==='multiplayer'&&!this.seatAvailable(m,'black'))error(409,'A player assignment is paused, closed, or unavailable.');
   const prior=JSON.parse(m.moves_json);
   if(prior.length>=20000)error(409,'Maximum match length reached.');
   const whiteTurn=prior.length%2===0;
   if(m.mode==='multiplayer'&&(whiteTurn?m.white_id:m.black_id)!==user.id)error(403,'It is not your turn.');
   if(m.mode==='computer'&&!whiteTurn)error(409,'Computer turn is already in progress.');
   const initial=play(START,prior,requested),moves=[...prior,requested];let state=initial;
   return {m,moves,state};
  };
  const initial=prepare();
  const commit=computerMove=>this.store.tx(()=>{
   // Search owns no SQLite transaction. Recheck access and revision after it.
   const prepared=prepare(),{m,moves}=prepared;let {state}=prepared;const clock=this.clock(m,receivedAt);
   if(clock){const moving=JSON.parse(m.moves_json).length%2?'black':'white';if(clock[moving]<=0)error(409,'Your clock has expired.');clock[moving]+=clock.increment;}
   if(m.mode==='computer'&&state.outcome.status==='active'){
    if(clock&&clock.black<=Date.now()-receivedAt){clock.black=0;state.outcome={status:'finished',result:canMate(parse(state.fen),1)?'white':'draw',reason:'timeout'};}
    else{state=play(START,moves,computerMove);moves.push(computerMove);if(clock)clock.black=clock.black-(Date.now()-receivedAt)+clock.increment;}
   }
   const offer=state.outcome.status==='active'&&m.draw_offer===user.id?m.draw_offer:null;
   const changed=this.db.prepare('UPDATE learning_chess_matches SET moves_json=?,status=?,result=?,reason=?,white_ms=?,black_ms=?,turn_started_at=?,draw_offer=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
    .run(JSON.stringify(moves),state.outcome.status,state.outcome.result,state.outcome.reason,clock?.white??m.white_ms,clock?.black??m.black_ms,clock&&state.outcome.status==='active'?Date.now():null,offer,new Date().toISOString(),matchId,revision);
   if(!changed.changes)error(409,'The board changed.');
   this.learning.event(user,activityId,'chess.move',matchId,{ply:moves.length,ended:state.outcome.status==='finished'});
   return this.render(this.row(matchId),user);
  });
  if(initial.m.mode==='computer'&&initial.state.outcome.status==='active'){
   this.computer??=new(require('./learning-chess-ai').ChessComputer)();
   const key=matchId+':'+revision;if(this.pendingSearch.has(key))error(409,'This computer move is already being processed.');this.pendingSearch.set(key,receivedAt);
   return this.computer.choose(initial.state.fen,initial.m.difficulty||'beginner').then(commit).finally(()=>this.pendingSearch.delete(key));
  }
  return commit(null);
 }
}

function playHistory(moves){
 let s=parse();for(const move of moves){const m=legal(s).find(x=>uci(x)===move);if(!m)error(409,'Chess history invalid.');s=apply(s,m);}return s;
}
module.exports={ChessMatches,START,parse,fen,legal,apply,uci,play,outcome,checked,claimable,historyOf,canMate,lockedPawns,TIME_CONTROLS,error};
