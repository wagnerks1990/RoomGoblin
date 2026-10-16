"use strict";
const {randomUUID}=require('node:crypto');
const KEY='sports.workspace.v1';
const text=(v,n=160)=>String(v??'').trim().slice(0,n);
const id=v=>{const s=text(v,80);if(!/^[\w-]{1,80}$/.test(s))throw Error('Invalid Sports identifier');return s};
const list=(v,n)=>{if(!Array.isArray(v)||v.length>n)throw Error(`Expected at most ${n} entries`);return v};
const finite=(v,min,max,fallback)=>{const x=Number(v);if(!Number.isFinite(x))return fallback;return Math.max(min,Math.min(max,x))};
function asset(v){const s=text(v,200);if(s&&(!/^[\w][\w.-]*\.(png|jpe?g|webp|gif|mp4|webm)$/i.test(s)||s.includes('..')))throw Error('Choose an uploaded image or video');return s}
function instant(v){if(!v)return null;const n=Date.parse(v);if(!Number.isFinite(n)||!/[zZ]|[+-]\d\d:\d\d$/.test(String(v)))throw Error('Event dates require a time zone');return new Date(n).toISOString()}
const normalizePlayer=p=>({id:id(p.id||randomUUID()),name:text(p.name,100),number:text(p.number,16),grade:text(p.grade,20),position:text(p.position,80),role:p.role==='manager'?'manager':'player',stats:text(p.stats,200)});
const normalizeEvent=e=>({id:id(e.id||randomUUID()),teamId:id(e.teamId),opponent:text(e.opponent),startAt:instant(e.startAt),status:['scheduled','final','postponed','cancelled','unknown'].includes(e.status)?e.status:'scheduled',homeAway:['home','away','neutral'].includes(e.homeAway)?e.homeAway:'home',venue:text(e.venue,240),score:e.score===''||e.score==null?null:finite(e.score,0,99999,null),opponentScore:e.opponentScore===''||e.opponentScore==null?null:finite(e.opponentScore,0,99999,null),recap:text(e.recap,1200),source:text(e.source,1600),sourceId:text(e.sourceId,200),reportedAt:e.reportedAt?instant(e.reportedAt):null,locked:e.locked===true});
function normalize(input={}){
 if(!input||typeof input!=='object'||JSON.stringify(input).length>1500000)throw Error('Sports configuration is too large');
 const teams=list(input.teams||[],80).map(t=>({id:id(t.id||randomUUID()),name:text(t.name),sport:text(t.sport,60),category:text(t.category,30),level:['varsity','jv','middle','program'].includes(t.level)?t.level:'program',season:text(t.season,20),enabled:t.enabled!==false,rosterLocked:t.rosterLocked===true,rosterSource:text(t.rosterSource,1600),rosterUpdatedAt:text(t.rosterUpdatedAt,40),roster:list(t.roster||[],150).map(normalizePlayer),sources:list(t.sources||[],8).map(s=>{if(s.enabled||s.approved||text(s.url,1600))require('./sports-fetch').safeUrl(s.url);return {id:id(s.id||randomUUID()),url:text(s.url,1600),kind:['website','calendar','json','pdf'].includes(s.kind)?s.kind:'website',enabled:s.enabled===true,approved:s.approved===true,autoMedia:s.autoMedia===true,mediaRights:s.mediaRights===true,mediaOrigins:list(s.mediaOrigins||[],8).map(o=>require('./sports-fetch').safeUrl(o).origin),priority:finite(s.priority,0,100,10)}})}));
 for(let i=0;i<teams.length;i++)teams[i].rosterTeamId=input.teams[i].rosterTeamId?id(input.teams[i].rosterTeamId):'';
 for(const t of teams){if(t.roster.some(p=>!p.name)||new Set(t.roster.map(p=>p.id)).size!==t.roster.length||new Set(t.sources.map(s=>s.id)).size!==t.sources.length)throw Error('Roster names and unique roster/source IDs are required')}
 const tids=new Set(teams.map(t=>t.id));if(tids.size!==teams.length||teams.some(t=>!t.name||!t.sport))throw Error('Teams need unique IDs, a name and a sport');
 for(const t of teams)if(t.rosterTeamId&&!teams.some(p=>p.id===t.rosterTeamId&&p.level==='program'&&p.sport===t.sport&&p.season===t.season&&p.category===t.category&&!p.rosterTeamId))throw Error('Shared rosters must reference a program team of the same sport and season');
 const events=list(input.events||[],1500).map(normalizeEvent);
 if(events.some(e=>!tids.has(e.teamId))||new Set(events.map(e=>e.id)).size!==events.length)throw Error('Events need unique IDs and a configured team');
 const media=list(input.media||[],500).map(m=>({id:id(m.id||randomUUID()),teamId:id(m.teamId),asset:asset(m.asset),caption:text(m.caption,240),date:m.date?instant(m.date):null,approved:m.approved===true,archive:m.archive===true,source:text(m.source,1600),sourceKey:text(m.sourceKey,200)}));
 if(media.some(m=>!tids.has(m.teamId)))throw Error('Media must belong to a configured team');
 const boards=list(input.boards||[],30).map(b=>({id:id(b.id||randomUUID()),name:text(b.name)||'Sports board',rosterHeading:text(b.rosterHeading,60)||'MEET THE TEAM',teamIds:list(b.teamIds||[],80).map(id).filter(t=>tids.has(t)),minimumSeconds:finite(b.minimumSeconds,10,180,20),rosterSpeed:finite(b.rosterSpeed,12,80,30),entryDelay:finite(b.entryDelay,1,5,2),volume:finite(b.volume,0,1,1),audio:b.audio===true,weather:b.weather!==false,archive:b.archive===true,background:/^#[0-9a-f]{6}$/i.test(b.background||'')?b.background:'#091e16',accent:/^#[0-9a-f]{6}$/i.test(b.accent||'')?b.accent:'#b1d872'}));
 if(new Set(boards.map(b=>b.id)).size!==boards.length||new Set(media.map(m=>m.id)).size!==media.length)throw Error('Sports IDs must be unique');
 let timezone=text(input.timezone,80)||'UTC';try{new Intl.DateTimeFormat('en',{timeZone:timezone}).format()}catch{throw Error('Choose a valid time zone')}
 return {version:1,revision:Number.isSafeInteger(input.revision)?input.revision:0,timezone,school:text(input.school,120),logo:asset(input.logo),teams,events,media,boards};
}
function project(config,boardId,{now=Date.now(),weather=null}={}){
 const b=config.boards.find(b=>b.id===boardId);if(!b)throw Error('Sports board not found');
 const pages=b.teamIds.map(teamId=>config.teams.find(t=>t.id===teamId)).filter(t=>t?.enabled).map(t=>{
  const events=config.events.filter(e=>e.teamId===t.id&&e.startAt).sort((a,b)=>Date.parse(a.startAt)-Date.parse(b.startAt));
  const previous=events.filter(e=>e.status==='final'&&Date.parse(e.startAt)<=now&&e.score!==null&&e.opponentScore!==null).at(-1)||null;
 const next=events.find(e=>Date.parse(e.startAt)>=now&&['scheduled','postponed'].includes(e.status))||null;
  const eventProjection=e=>e?{id:e.id,opponent:e.opponent,startAt:e.startAt,status:e.status,homeAway:e.homeAway,venue:e.venue,score:e.score,opponentScore:e.opponentScore,recap:e.recap}:null;
  const program=config.teams.find(p=>p.id===t.rosterTeamId);
  return {id:t.id,name:t.name,sport:t.sport,level:t.level,season:t.season,programRoster:!!program,roster:program?.roster||t.roster,previous:eventProjection(previous),next:eventProjection(next),media:config.media.filter(m=>m.teamId===t.id&&m.approved&&m.asset&&(b.archive||!m.archive)).slice(0,12).map(m=>({id:m.id,asset:m.asset,caption:m.caption,date:m.date,archive:m.archive}))};
 });
 return {board:{...b,teamIds:undefined},school:config.school,logo:config.logo,timezone:config.timezone,pages,weather:b.weather&&weather?{text:weather.text,widgets:weather.widgets,updatedAt:weather.updatedAt,source:weather.source}:null,revision:config.revision,generatedAt:now};
}
function scene(board){return require('../public/shared/scene').normalize({background:board.background,layers:[{id:'sports-board',type:'widget',widget:'sports-board',sportsBoardId:board.id,sportsAudio:board.audio,sportsVolume:board.volume,name:board.name,x:0,y:0,w:100,h:100}]})}
module.exports={KEY,normalize,normalizePlayer,normalizeEvent,project,scene,id,text};
