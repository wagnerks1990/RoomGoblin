"use strict";
const {createHash}=require('node:crypto');
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
async function rosterPDF(bytes){
 if(bytes.length>5242880||!Buffer.from(bytes).subarray(0,5).equals(Buffer.from('%PDF-')))throw Error('Choose a PDF under 5 MiB');
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:false,stopAtErrors:true});let doc;
 try{doc=await task.promise;if(doc.numPages>5)throw Error('Roster PDFs support at most five pages');const rows=[];let title='',level='',columns=null;
  for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent();if(content.items.length>12000)throw Error('PDF text is too large');const lines=[];
   for(const item of content.items.filter(i=>i.str?.trim())){const y=Math.round(item.transform[5]/3)*3;let line=lines.find(r=>Math.abs(r.y-y)<=3);if(!line){line={y,items:[]};lines.push(line)}line.items.push({x:item.transform[4],text:item.str.trim()})}
   for(const line of lines.sort((a,b)=>b.y-a.y)){const items=line.items.sort((a,b)=>a.x-b.x),full=items.map(i=>i.text).join(' ');title+=' '+full;
    if(!columns&&/roster/i.test(full)){if(/\bjv\b|junior varsity/i.test(full))level='jv';else if(/\bvarsity\b/i.test(full))level='varsity'}
    if(/^VARSITY$/i.test(full)){level='varsity';continue}if(/^JV$/i.test(full)){level='jv';continue}
    if(/(?:Number|No\.|#).*Name.*(?:Grade|Class|Year)/i.test(full)){columns=items.map(i=>({x:i.x,name:i.text.toLowerCase()}));continue}
    if(!columns||/^(Managers?:|Head Coach|Assistant Coach)/i.test(full))continue;
    const cells=columns.map(()=>[]);for(const i of items){let selected=0;let dist=Infinity;columns.forEach((c,j)=>{if(Math.abs(c.x-i.x)<dist){dist=Math.abs(c.x-i.x);selected=j}});cells[selected].push(i.text)}
    const obj=Object.fromEntries(columns.map((c,i)=>[c.name,cells[i].join(' ')]));const name=obj.name||[obj['first name'],obj['last name']].filter(Boolean).join(' '),grade=obj.grade||obj.year||obj.class;
    if(!name||!/^\d{1,2}$/.test(grade||''))continue;const number=obj.number||obj['no.']||obj['#']||'';rows.push({id:key([name,number,level].join('|')),name,number:number.toLowerCase()==='manager'?'':number,grade,position:obj.position||'',role:number.toLowerCase()==='manager'?'manager':'player',level});
   }page.cleanup();
  }
  if(!rows.length)throw Error('No roster table was recognized. Use the CSV template for scanned or unsupported PDFs.');if(rows.length>300)throw Error('Roster has too many entries');
  const season=title.match(/\b20\d{2}\b/)?.[0]||'';return {rows,season,warnings:['Review names, numbers and team levels before applying. Blank levels mean the PDF did not specify them.']};
 }finally{await task.destroy()}
}
const decode=s=>String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n))));
const clean=s=>decode(String(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')).trim();
function structured(raw){if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Expected a Sports JSON object');return {events:Array.isArray(raw.events)?raw.events.slice(0,500):[],roster:Array.isArray(raw.roster)?raw.roster.slice(0,150):null,media:Array.isArray(raw.media)?raw.media.slice(0,50):[],season:String(raw.season||'')}}
function website(html,url,team){
 const events=[],media=[],documents=[];const sport=team.sport.toLowerCase(),level=team.level;
 const matches=label=>{const s=label.toLowerCase(),category=team.category?.toLowerCase();if(category&&['girls','boys'].includes(category)&&!s.includes(category))return false;return s.includes(sport)&&(level==='program'||(level==='varsity'?/\bvarsity\b/.test(s)&&!/\bjv\b|junior varsity/.test(s):level==='jv'?/\bjv\b|junior varsity/.test(s):/middle school/.test(s)))};
 for(const match of html.matchAll(/<a\b([^>]{0,5000})>([\s\S]{0,10000}?)<\/a>/gi)){const attrs=match[1],href=attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];if(!href)continue;let target;try{target=new URL(decode(href),url)}catch{continue}const label=clean(match[2]);
  if(/\.pdf$/i.test(target.pathname)&&/roster/i.test(label+' '+target.pathname))documents.push({url:target.href,label});
  if(!matches(label))continue;
  const local=target.searchParams.get('localStartDate'),opponent=label.split(/\s(?:vs\.?|@|at)\s/i).at(-1);
  if(local&&/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(local))events.push({id:key(target.href),sourceId:key(target.href),localStart:local,opponent,homeAway:/@|\bat\b/i.test(label)?'away':'home',status:'scheduled'});
 }
 for(const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let data;try{data=JSON.parse(match[1])}catch{continue}
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
module.exports={csv,rosterCSV,rosterPDF,structured,website,calendar,zoned,key};
