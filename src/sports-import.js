"use strict";
const {createHash}=require('node:crypto');
const htmlSource=require('./sports-html');
const key=s=>createHash('sha256').update(String(s)).digest('hex').slice(0,24);
function csv(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>524288)throw Error('Import must be under 512 KiB');
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<raw.length;i++){const c=raw[i];if(c==='"'){if(quoted&&raw[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&raw[i+1]==='\n')i++;row.push(cell);if(row.some(c=>c.trim()))rows.push(row);row=[];cell=''}else cell+=c;if(cell.length>8000||rows.length>1500)throw Error('Import exceeds row or cell limits')}
 if(quoted)throw Error('Unclosed CSV quote');row.push(cell);if(row.some(c=>c.trim()))rows.push(row);
 const head=(rows.shift()||[]).map(s=>s.replace(/^\uFEFF/,'').trim().toLowerCase());if(new Set(head).size!==head.length)throw Error('CSV headers must be unique');
 return rows.map(row=>Object.fromEntries(head.map((name,i)=>[name,(row[i]||'').trim()])));
}
function rosterCSV(raw){return csv(raw).map(p=>{if(!p.name)throw Error('Roster CSV needs name,number,grade,position,level,role columns (name required)');return {id:key([p.name,p.number,p.level].join('|')),name:p.name,number:p.number,grade:p.grade,position:p.position,level:p.level?.toLowerCase(),role:p.role==='manager'?'manager':'player'}})}
const {rosterPDF}=require('./sports-pdf');
// Decode once: a literal &amp;lt; must not turn into a second-level entity.
const decode=s=>String(s).replace(/&(amp|quot|apos|lt|gt|nbsp|#(?:x[0-9a-f]+|[0-9]+));/gi,(_,entity)=>{
 const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '},value=entity.toLowerCase();if(value[0]!=='#')return named[value];
 const code=value[1]==='x'?parseInt(value.slice(2),16):Number(value.slice(1));return Number.isInteger(code)&&code>=0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):'\uFFFD';
});
const clean=s=>decode(htmlSource.strip(String(s)).replace(/\s+/g,' ')).trim();
function structured(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Expected a Sports JSON object');return {events:Array.isArray(raw.events)?raw.events.slice(0,500):[],roster:Array.isArray(raw.roster)?raw.roster.slice(0,150):null,media:Array.isArray(raw.media)?raw.media.slice(0,50):[],season:String(raw.season||'')}}
function website(html,url,team){
 const events=[],media=[],documents=[];const sport=team.sport.toLowerCase(),level=team.level;
 const matches=label=>{const s=label.toLowerCase(),category=team.category?.toLowerCase();if(category&&['girls','boys'].includes(category)&&!s.includes(category))return false;return s.includes(sport)&&(level==='program'||(level==='varsity'?/\bvarsity\b/.test(s)&&!/\bjv\b|junior varsity/.test(s):level==='jv'?/\bjv\b|junior varsity/.test(s):/middle school/.test(s)))};
 const entries=htmlSource.elements(html);
 for(const entry of entries.filter(e=>e.name==='a')){const href=entry.attributes.href;if(!href)continue;let target;try{target=new URL(decode(href),url)}catch{continue}const label=clean(entry.content.slice(0,10000));
  if(/\.pdf$/i.test(target.pathname)&&/roster/i.test(label+' '+target.pathname))documents.push({url:target.href,label});
  if(!matches(label))continue;
  const local=target.searchParams.get('localStartDate'),opponent=label.split(/\s(?:vs\.?|@|at)\s/i).at(-1);
  if(local&&/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(local))events.push({id:key(target.href),sourceId:key(target.href),localStart:local,opponent,homeAway:/@|\bat\b/i.test(label)?'away':'home',status:'scheduled'});
 }
 for(const entry of entries.filter(e=>e.name==='script'&&e.attributes.type?.toLowerCase()==='application/ld+json')){
  let data;try{data=JSON.parse(entry.content)}catch{continue}
  const walk=(obj,depth=0)=>{if(depth>12||!obj||typeof obj!=='object')return;if(Array.isArray(obj)){obj.slice(0,100).forEach(o=>walk(o,depth+1));return}
   if(['VideoObject','ImageObject'].includes(obj['@type'])&&matches(String(obj.name||'')+' '+String(obj.description||''))&&obj.contentUrl)media.push({url:obj.contentUrl,caption:obj.name,date:obj.uploadDate,sport:team.sport,level:team.level});
   for(const v of Object.values(obj))if(v&&typeof v==='object')walk(v,depth+1);
  };walk(data);
 }
 return {events,media:media.slice(0,50),documents:documents.slice(0,20),roster:null};
}
function calendar(raw){
 if(raw.length>2097152||!raw.includes('BEGIN:VCALENDAR'))throw Error('Choose a valid iCalendar feed');const lines=raw.replace(/\r?\n[ \t]/g,'').split(/\r?\n/),events=[];let event=null;
 for(const l of lines){if(l==='BEGIN:VEVENT')event={};else if(l==='END:VEVENT'&&event){if(event.RRULE)throw Error('Recurring sports events require expanded dates from the source');const value=event.DTSTART;if(!/^\d{8}T\d{6}Z$/.test(value||''))throw Error('Calendar event times must be UTC (TZID and date-only feeds require CSV review)');events.push({sourceId:(event.UID||key(JSON.stringify(event)))+':'+(event['RECURRENCE-ID']||''),id:key((event.UID||JSON.stringify(event))+':'+(event['RECURRENCE-ID']||'')),startAt:value.replace(/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/,'$1-$2-$3T$4:$5:$6Z'),opponent:clean(event.SUMMARY),venue:clean(event.LOCATION),status:event.STATUS==='CANCELLED'?'cancelled':'scheduled'});event=null}else if(event){const at=l.indexOf(':');if(at>0)event[l.slice(0,at).split(';')[0]]=l.slice(at+1).replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1')}}
 if(events.length>500)throw Error('Calendar exceeds 500 events');return {events,roster:null,media:[]};
}
// Convert an explicit local wall time without relying on the host timezone.
function zoned(local,timezone){const parts=local.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/);if(!parts)throw Error('Invalid local date');const wanted=Date.UTC(...parts.slice(1).map((v,i)=>i===1?Number(v)-1:Number(v)));let at=wanted;for(let i=0;i<3;i++){const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at).reduce((o,p)=>(o[p.type]=p.value,o),{});const shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);at+=wanted-shown}return new Date(at).toISOString()}
module.exports={csv,rosterCSV,rosterPDF,structured,website,calendar,zoned,key,decode};
