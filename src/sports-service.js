"use strict";
const model=require('./sports'),imports=require('./sports-import'),{fetchPublic,safeUrl}=require('./sports-fetch');
const clone=v=>JSON.parse(JSON.stringify(v));
function createSportsService({store,fetchImpl=fetchPublic,ingestMedia=async()=>{throw Error('Media cache unavailable')},now=Date.now,canRun=()=>true}){
 let config=model.normalize(store.getPreference(model.KEY,{})),pending=null;
 const status=new Map();
 function commit(next){next=model.normalize({...next,revision:config.revision+1});store.setPreference(model.KEY,next);config=next;return clone(config)}
 function save(input){if(input.revision!==config.revision)throw Object.assign(Error('Sports changed. Reload before saving to avoid overwriting another edit.'),{status:409});const next=model.normalize(input);store.setPreference(model.KEY+'.previous',config);return commit(next)}
 function undo(revision){if(revision!==config.revision)throw Object.assign(Error('Reload Sports before undoing'),{status:409});const previous=store.getPreference(model.KEY+'.previous',null);if(!previous)throw Error('No previous Sports save');store.setPreference(model.KEY+'.previous',config);return commit(previous)}
 async function refresh(force=false){if(pending)return pending;
  pending=(async()=>{
   const initial=clone(config),working=clone(config),rosterChosen=new Set();let changed=false,downloads=0,requests=0;
   sources: for(const team of initial.teams.filter(t=>t.enabled))for(const source of [...team.sources].sort((a,b)=>a.priority-b.priority)){
    if(!canRun()||requests>=12)break sources;if(!source.enabled||!source.approved)continue;const key=team.id+':'+source.id,prior=status.get(key);if(!force&&prior&&now()-prior.at<1800000)continue;
    requests++;status.set(key,{at:now(),state:'loading'});
    try{
     const origins=[safeUrl(source.url).origin],r=await fetchImpl(source.url,{origins,maxBytes:source.kind==='pdf'?5242880:2097152});let parsed;
     if(source.kind==='pdf'){const p=await imports.rosterPDF(r.body);parsed={roster:p.rows,season:p.season,events:[],media:[]}}
     else if(source.kind==='json')parsed=imports.structured(JSON.parse(r.body.toString('utf8')));
     else if(source.kind==='calendar')parsed=imports.calendar(r.body.toString('utf8'));
     else{
      parsed=imports.website(r.body.toString('utf8'),source.url,team);
      const year=team.season.match(/20\d{2}/)?.[0];const doc=parsed.documents?.find(d=>(d.label+' '+d.url).toLowerCase().includes(team.sport.toLowerCase())&&(!year||(d.label+' '+d.url).includes(year))&&new URL(d.url).origin===origins[0]);
      if(doc){const p=await imports.rosterPDF((await fetchImpl(doc.url,{origins,maxBytes:5242880})).body);parsed.roster=p.rows;parsed.season=p.season}
     }
     const target=working.teams.find(t=>t.id===team.id);
     if(parsed.roster?.length&&!target.rosterLocked&&!rosterChosen.has(team.id)){
      const year=team.season.match(/20\d{2}/)?.[0];if(!year||!String(parsed.season).includes(year))throw Error('Roster season does not match the configured team');
      const rows=parsed.roster.filter(p=>team.level==='program'||p.level===team.level);if(!rows.length)throw Error('Roster has no confirmed entries for this team level');
      target.roster=rows;target.rosterSource=source.url;target.rosterUpdatedAt=new Date(now()).toISOString();rosterChosen.add(team.id);changed=true;
     }
     let accepted=0;
     for(const e of (parsed.events||[]).slice(0,500)){
      const sourceId=imports.key(source.id+':'+(e.sourceId||e.id||e.startAt+':'+e.opponent)),existing=working.events.find(x=>x.teamId===team.id&&x.sourceId===sourceId);
      if(existing?.locked)continue;const incoming={...e,id:existing?.id||imports.key(team.id+':'+sourceId),teamId:team.id,sourceId,source:source.url,locked:false,startAt:e.startAt||(e.localStart?imports.zoned(e.localStart,working.timezone):null)};
      if(!incoming.startAt)continue;
      // A schedule-only refresh must not erase a previously verified final.
      if(existing?.status==='final'&&(incoming.status!=='final'||incoming.score==null||incoming.opponentScore==null))continue;
      const index=working.events.indexOf(existing);if(index<0)working.events.push(incoming);else working.events[index]=incoming;accepted++;changed=true;
     }
     if(source.autoMedia&&source.mediaRights)for(const m of (parsed.media||[]).slice(0,12)){
      if(downloads>=4||!canRun())break;if(String(m.sport||'').toLowerCase()!==team.sport.toLowerCase()||m.level!==team.level)continue;
      const date=Date.parse(m.date);if(!Number.isFinite(date)||date>now()+86400000)continue;const archive=now()-date>45*86400000;if(archive&&!m.archive)continue;
      const sourceKey=imports.key(m.url);if(working.media.some(x=>x.teamId===team.id&&x.sourceKey===sourceKey))continue;
      const allowed=[...origins,...source.mediaOrigins],url=safeUrl(m.url,allowed),asset=await ingestMedia(url.href,{origins:allowed,fetchImpl});downloads++;
      working.media.push({id:imports.key(team.id+':'+sourceKey),teamId:team.id,sourceKey,asset,caption:model.text(m.caption,240),date:new Date(date).toISOString(),approved:true,archive,source:source.url});changed=true;
     }
     status.set(key,{at:now(),state:accepted||parsed.roster?.length||parsed.media?.length?'ready':'no-data',events:accepted,media:downloads});
    }catch(error){status.set(key,{at:now(),state:'unavailable',error:model.text(error.message,120)})}
   }
   // Never let an old in-flight fetch overwrite an operator edit.
   if(changed&&config.revision===initial.revision)commit(working);
   return {config:clone(config),status:Object.fromEntries(status)};
  })().finally(()=>{pending=null});return pending;
 }
 return {read:()=>clone(config),save,undo,refresh,status:()=>Object.fromEntries(status)};
}
module.exports={createSportsService};
