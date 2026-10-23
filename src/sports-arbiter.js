"use strict";
// Public, server-rendered team schedules only. Never execute provider scripts.
const {elements,strip}=require('./sports-html');
const {key,zoned,decode}=require('./sports-import');
const clean=s=>decode(strip(s)).replace(/\s+/g,' ').trim();
const tokens=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function sourceUrl(raw){const u=require('./sports-fetch').safeUrl(raw);if(!['www.arbiterlive.com','arbiterlive.com'].includes(u.hostname)||!/^\/Teams\/Schedule\/\d+\/?$/i.test(u.pathname)||[...u.searchParams].some(([k,v])=>k!=='activeEntityId'||!/^\d+$/.test(v)))throw Error('Choose a public Arbiter team schedule URL');return u}
function arbiter(html,url,team,timezone){
 sourceUrl(url);
 const header=elements(html,['div'],a=>String(a.class||'').split(/\s+/).includes('sport-header'));
 const label=tokens(header[0]?.content?clean(header[0].content):'');
 const sport=tokens(team.sport).replace(/^(boys|girls) /,'');
 const level=/\bjunior varsity\b|\bjv\b/.test(label)?'jv':/\bvarsity\b/.test(label)?'varsity':/\bmiddle school\b|\b7 8\b/.test(label)?'middle':'unknown';
 if(header.length!==1||!sport||!(' '+label+' ').includes(' '+sport+' ')||level!==team.level||(['boys','girls'].includes(tokens(team.category))&&!label.split(' ').includes(tokens(team.category))))throw Error('Arbiter sport, category or level does not match this team');
 const select=elements(html,['select'],a=>a.id==='SelectedSchoolYearID')[0];
 const selected=select&&elements(select.content,['option'],a=>Object.hasOwn(a,'selected'));
 const season=selected?.length===1?clean(selected[0].content):'';
 const years=season.match(/^(20\d{2})-(\d{2}|20\d{2})$/),configured=String(team.season).match(/20\d{2}/)?.[0];
 if(!years||!configured||years[1]!==configured)throw Error('Arbiter season does not match the configured team');
 const firstYear=Number(years[1]),lastYear=Number(years[2].length===2?'20'+years[2]:years[2]);
 if(lastYear!==firstYear+1)throw Error('Unsupported Arbiter school year');
 const tables=elements(html,['table'],a=>String(a.class||'').split(/\s+/).includes('table-schedule'));
 if(tables.length!==1)throw Error('Arbiter schedule table unavailable');
 const rows=elements(tables[0].content,['tr']);if(rows.length>501)throw Error('Arbiter schedule exceeds 500 events');
 const headings=elements(rows[0]?.content||'',['th']).map(x=>clean(x.content).toLowerCase());
 const required=['date/time','home or away','opponent','location','results'];
 if(required.some(h=>!headings.includes(h)))throw Error('Arbiter schedule columns changed');
 const events=[],months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 for(const row of rows.slice(1)){
  if(row.attributes['data-isgame']!=='true')continue;
  const game=row.attributes['data-gameid'];if(!/^\d+$/.test(game||''))throw Error('Arbiter game identifier missing');
  const cells=elements(row.content,['td']).map(x=>clean(x.content)),cell=h=>cells[headings.indexOf(h)]||'';
  const date=cell('date/time').match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  // Unknown/TBA times need review, never silently become midnight.
  if(!date)continue;
  const month=months.indexOf(date[1].toLowerCase())+1,day=Number(date[2]),hour=Number(date[3]),minute=Number(date[4]),year=month>=7?firstYear:lastYear;
  if(hour<1||hour>12||minute>59||new Date(Date.UTC(year,month-1,day)).getUTCMonth()!==month-1)throw Error('Invalid Arbiter game date');
  const local=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour%12+(date[5].toUpperCase()==='PM'?12:0)).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  const result=cell('results'),scores=result.match(/^([WLT])\s+(\d{1,5})\s*[-–]\s*(\d{1,5})(?:\s+SETS)?(?:\s*\([^)]{0,40}\))?$/i),state=cell('status').toLowerCase();
  let status=/cancel/.test(state)?'cancelled':/postpon/.test(state)?'postponed':'scheduled',score=null,opponentScore=null;
  if(scores&&!['cancelled','postponed'].includes(status)){
   score=Number(scores[2]);opponentScore=Number(scores[3]);const outcome=scores[1].toUpperCase();
   if((outcome==='W'&&score<=opponentScore)||(outcome==='L'&&score>=opponentScore)||(outcome==='T'&&score!==opponentScore))throw Error('Arbiter result and score disagree');
   status='final';
  }
  const opponent=cell('opponent').replace(/^@\s*/, '');if(!opponent)continue;
  events.push({id:key('arbiter:'+game),sourceId:'arbiter:'+game,startAt:zoned(local,timezone),opponent,homeAway:cell('home or away').includes('@')?'away':cell('home or away').toLowerCase()==='vs'?'home':'neutral',venue:cell('location'),status,score,opponentScore});
 }
 return {events,roster:null,media:[],season};
}
module.exports={arbiter,sourceUrl};
