"use strict";
const model=require('./sports'),imports=require('./sports-import'),{fetchPublic,safeUrl}=require('./sports-fetch');
const clone=v=>JSON.parse(JSON.stringify(v));
function createSportsService({store,fetchImpl=fetchPublic,ingestMedia=async()=>{throw Error('Media cache unavailable')},now=Date.now,canRun=()=>true}){
 let config=model.normalize(store.getPreference(model.KEY,{})),pending=null;
 const status=new Map(Object.entries(store.getPreference(model.KEY+'.sources',{})||{}).slice(0,640));
 function commit(next){next=model.assertBoardBounds(model.normalize({...next,revision:config.revision+1}));store.setPreference(model.KEY,next);config=next;return clone(config)}
 function save(input){if(input.revision!==config.revision)throw Object.assign(Error('Sports changed. Reload before saving to avoid overwriting another edit.'),{status:409});const next=model.assertBoardBounds(model.normalize(input));store.setPreference(model.KEY+'.previous',config);return commit(next)}
 function undo(revision){if(revision!==config.revision)throw Object.assign(Error('Reload Sports before undoing'),{status:409});const previous=store.getPreference(model.KEY+'.previous',null);if(!previous)throw Error('No previous Sports save');store.setPreference(model.KEY+'.previous',config);return commit(previous)}
 async function refresh(force=false){if(pending)return pending;
  pending=(async()=>{
   const initial=clone(config),rosterChosen=new Set();let working=clone(config);let changed=false,downloads=0,requests=0;
   // Visit the least recently attempted teams first, including forced refreshes.
   // Keep each team's preferred roster sources in their existing priority order.
   const lastAttempt=team=>Math.min(...team.sources.filter(s=>s.enabled&&s.approved).map(s=>status.get(team.id+':'+s.id)?.at||0));
   sources: for(const team of initial.teams.filter(t=>t.enabled).sort((a,b)=>lastAttempt(a)-lastAttempt(b)))for(const source of [...team.sources].sort((a,b)=>a.priority-b.priority)){
    if(!canRun()||requests>=12)break sources;if(!source.enabled||!source.approved)continue;const key=team.id+':'+source.id,fingerprint=imports.key(JSON.stringify([team.sport,team.category,team.level,team.season,source])),saved=status.get(key),prior=saved?.fingerprint===fingerprint?saved:null;if(!force&&prior&&now()-prior.at<300000)continue;
    requests++;status.set(key,{at:now(),state:'loading',fingerprint,lastSuccessAt:prior?.lastSuccessAt||null});
    const staged=clone(working),chosen=new Set(rosterChosen);let sourceChanged=false;
    try{
     const origins=[safeUrl(source.url).origin],r=await fetchImpl(source.url,{origins,maxBytes:source.kind==='pdf'?5242880:2097152});let parsed;
     if(source.kind==='pdf'){const p=await imports.rosterPDF(r.body);parsed={roster:p.rows,season:p.season,events:[],media:[]}}
     else if(source.kind==='json')parsed=imports.structured(JSON.parse(r.body.toString('utf8')));
     else if(source.kind==='calendar')parsed=imports.calendar(r.body.toString('utf8'));
     else if(source.kind==='arbiter')parsed=require('./sports-arbiter').arbiter(r.body.toString('utf8'),source.url,team,staged.timezone);
     else{
      parsed=imports.website(r.body.toString('utf8'),source.url,team);
      const year=team.season.match(/20\d{2}/)?.[0];const doc=parsed.documents?.find(d=>(d.label+' '+d.url).toLowerCase().includes(team.sport.toLowerCase())&&(!['girls','boys'].includes(team.category.toLowerCase())||(d.label+' '+d.url).toLowerCase().includes(team.category.toLowerCase()))&&(!year||(d.label+' '+d.url).includes(year))&&new URL(d.url).origin===origins[0]);
      if(doc){const p=await imports.rosterPDF((await fetchImpl(doc.url,{origins,maxBytes:5242880})).body);parsed.roster=p.rows;parsed.season=p.season}
     }
     const target=staged.teams.find(t=>t.id===team.id);
     if(parsed.roster?.length&&!target.rosterLocked&&!chosen.has(team.id)){
      const year=team.season.match(/20\d{2}/)?.[0];if(!year||!String(parsed.season).includes(year))throw Error('Roster season does not match the configured team');
      const rows=parsed.roster.filter(p=>team.level==='program'||p.level===team.level);if(!rows.length)throw Error('Roster has no confirmed entries for this team level');
      const roster=rows.map(p=>model.normalizePlayer({...p,id:p.id||imports.key([p.name,p.number,p.role].join('|'))}));chosen.add(team.id);if(JSON.stringify(target.roster)!==JSON.stringify(roster)||target.rosterSource!==source.url){target.roster=roster;target.rosterSource=source.url;target.rosterUpdatedAt=new Date(now()).toISOString();sourceChanged=true;}
     }
     let accepted=0;
     for(const e of (parsed.events||[]).slice(0,500)){
      const sourceId=imports.key(source.id+':'+(e.sourceId||e.id||e.startAt+':'+e.opponent)),existing=staged.events.find(x=>x.teamId===team.id&&x.sourceId===sourceId);
      if(existing?.locked)continue;const incoming={...e,id:existing?.id||imports.key(team.id+':'+sourceId),teamId:team.id,sourceId,source:source.url,locked:false,startAt:e.startAt||(e.localStart?imports.zoned(e.localStart,staged.timezone):null)};
      if(!incoming.startAt)continue;
      // A schedule-only refresh must not erase a previously verified final.
      const normalized=model.normalizeEvent(incoming);if(existing?.status==='final'&&(normalized.status!=='final'||normalized.score===null||normalized.opponentScore===null))continue;
      accepted++;if(existing&&JSON.stringify(existing)===JSON.stringify(normalized))continue;const index=staged.events.indexOf(existing);if(index<0)staged.events.push(normalized);else staged.events[index]=normalized;sourceChanged=true;
     }
     if(source.autoMedia&&source.mediaRights)for(const m of (parsed.media||[]).slice(0,12)){
      if(downloads>=4||!canRun())break;if(String(m.sport||'').toLowerCase()!==team.sport.toLowerCase()||m.level!==team.level)continue;
      const date=Date.parse(m.date);if(!Number.isFinite(date)||date>now()+86400000)continue;const archive=now()-date>45*86400000;if(archive&&!m.archive)continue;
      const sourceKey=imports.key(m.url);if(staged.media.some(x=>x.teamId===team.id&&x.sourceKey===sourceKey))continue;
      const allowed=[...origins,...source.mediaOrigins],url=safeUrl(m.url,allowed);downloads++;const asset=await ingestMedia(url.href,{origins:allowed,fetchImpl});
      staged.media.push({id:imports.key(team.id+':'+sourceKey),teamId:team.id,sourceKey,asset,caption:model.text(m.caption,240),date:new Date(date).toISOString(),approved:true,archive,source:source.url});sourceChanged=true;
     }
     if(sourceChanged){working=model.assertBoardBounds(model.normalize(staged));changed=true;}for(const id of chosen)rosterChosen.add(id);
     status.set(key,{at:now(),state:accepted||parsed.roster?.length||parsed.media?.length?'ready':'no-data',events:accepted,media:downloads,fingerprint,lastSuccessAt:now()});
    }catch(error){status.set(key,{at:now(),state:'unavailable',error:model.text(error.message,120),fingerprint,lastSuccessAt:prior?.lastSuccessAt||null})}
   }
   // Never let an old in-flight fetch overwrite an operator edit.
   if(changed&&config.revision===initial.revision)commit(working);
   const configured=new Set(config.teams.flatMap(t=>t.sources.map(s=>t.id+':'+s.id)));for(const k of status.keys())if(!configured.has(k))status.delete(k);
   if(requests)store.setPreference(model.KEY+'.sources',Object.fromEntries(status));
   return {config:clone(config),status:Object.fromEntries(status)};
  })().finally(()=>{pending=null});return pending;
 }
 return {read:()=>clone(config),save,undo,refresh,status:()=>Object.fromEntries(status)};
}
module.exports={createSportsService};
