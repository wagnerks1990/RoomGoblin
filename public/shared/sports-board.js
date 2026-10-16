/* Sports is a scene widget, not an iframe or a second display layout engine. */
"use strict";
(()=>{
 const instances=new Map(),previewCache=new Map();
 async function loadBoard(id,signal){
  const cached=previewCache.get(id);if(cached&&cached.until>Date.now())return cached.value;
  const r=await fetch('/api/v1/sports/boards/'+encodeURIComponent(id)+'/display',{credentials:'same-origin',signal});if(!r.ok)throw Error('Sports data unavailable');const value=await r.json();
  if(value.ok&&Array.isArray(value.pages)){if(previewCache.size>=30)previewCache.delete(previewCache.keys().next().value);previewCache.set(id,{until:Date.now()+30000,value})}return value;
 }
 window.addEventListener('roomgoblin:authchange',()=>previewCache.clear());
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
 function mount(host,boardId,{resolveAsset=n=>'/media/'+encodeURIComponent(n),loadSports=loadBoard,preview=false,audio=false,volume=1}={}){
  host.classList.add('rg-sports');host.replaceChildren();host.style.alignItems='stretch';host.style.whiteSpace='normal';
  const header=el('header'),brand=el('div',null,'rg-sports-brand'),logo=el('img'),school=el('strong','Sports'),weather=el('div',null,'rg-sports-weather'),clock=el('time');logo.alt='School athletics';brand.append(logo,school);header.append(brand,weather,clock);
  const title=el('div',null,'rg-sports-heading'),heading=el('h2'),level=el('span');title.append(heading,level);
  const games=el('section',null,'rg-sports-games'),previous=el('article'),next=el('article');games.append(previous,next);
  const media=el('section',null,'rg-sports-media'),photo=el('img'),video=el('video'),caption=el('div',null,'rg-sports-caption'),recap=el('p',null,'rg-sports-recap');photo.alt='Team photo or highlight';video.playsInline=true;video.preload='metadata';media.append(photo,video,caption,recap);
  const roster=el('section',null,'rg-sports-roster'),rosterTitle=el('h3','MEET THE TEAM'),rosterLabel=el('small'),window=el('div',null,'rg-sports-window'),track=el('div',null,'rg-sports-roster-track');window.append(track);roster.append(rosterTitle,rosterLabel,window);
  const ticker=el('div',null,'rg-sports-ticker'),tickerText=el('span'),footer=el('footer','RoomGoblin · Kyle Wagner');ticker.append(tickerText);host.append(header,title,games,media,roster,ticker,footer);
  let snapshot=null,pending=null,index=0,page=null,elapsed=0,last=performance.now(),cycle=0,frame=null,fetchTimer=null,dead=false,busy=false,abort=null,currentMedia=-1,lastMediaAt=-20,playing=false,videoStarted=0,videoProgress=0,progressAt=0,tries=0,epoch=0;
  function stop(){if(dead)return;dead=true;epoch++;document.removeEventListener('visibilitychange',visibility);abort?.abort();clearTimeout(fetchTimer);cancelAnimationFrame(frame);video.pause();video.removeAttribute('src');video.load();instances.delete(host)}
  instances.set(host,stop);
  const date=(value,time=false)=>{try{return new Date(value).toLocaleString(undefined,{timeZone:snapshot.timezone,weekday:'short',month:'short',day:'numeric',...(time?{hour:'numeric',minute:'2-digit'}:{})})}catch{return 'Date unavailable'}};
  function renderGame(node,event,upcoming){node.replaceChildren(el('h3',upcoming?'NEXT UP':'PREVIOUS GAME'));if(!event){node.append(el('p',upcoming?'Next game not published':'Result not published'));return}
   node.append(el('small',(upcoming?event.status.toUpperCase():'FINAL')+' · '+date(event.startAt),upcoming?'rg-sports-future':'rg-sports-past'));
   if(upcoming){node.append(el('strong',(event.homeAway==='away'?'at ':'vs ')+event.opponent),el('b',new Date(event.startAt).toLocaleTimeString(undefined,{timeZone:snapshot.timezone,hour:'numeric',minute:'2-digit'})),el('p',event.venue))}
   else{for(const [name,value]of [[snapshot.school||page.name,event.score],[event.opponent,event.opponentScore]]){const row=el('div',null,'rg-sports-score');row.append(el('span',name),el('b',value));node.append(row)}}
  }
  function finish(){epoch++;playing=false;video.pause();video.hidden=true;photo.hidden=false;lastMediaAt=elapsed;tries=0}
  video.addEventListener('ended',()=>{if(video.ended&&playing)finish()});video.addEventListener('error',()=>{if(video.error&&playing)finish()});
  async function play(){if(dead||!page)return;const generation=++epoch;const items=page.media;if(!items.length)return;currentMedia=(currentMedia+1)%items.length;const item=items[currentMedia];caption.textContent=[item.archive?'ARCHIVE':'',item.date?date(item.date):'',item.caption].filter(Boolean).join(' · ');
   if(!/\.(mp4|webm)$/i.test(item.asset)){photo.src=resolveAsset(item.asset);photo.hidden=false;video.hidden=true;lastMediaAt=elapsed;return}
   if(preview){lastMediaAt=elapsed;return}playing=true;videoStarted=elapsed;progressAt=elapsed;videoProgress=0;video.hidden=false;photo.hidden=true;video.src=resolveAsset(item.asset);video.volume=volume;video.muted=true;
   try{await video.play();if(dead||generation!==epoch)return;if(audio)video.muted=false}catch{if(dead||generation!==epoch)return;video.muted=true;try{await video.play()}catch{if(generation===epoch&&!dead)finish()}}
  }
  function fitBox(node){
   const children=[...node.querySelectorAll('h2,h3,strong,b,small,p,span')];if(!children.length)children.push(node);
   for(const n of children)n.style.fontSize='';
   const sizes=children.map(n=>parseFloat(getComputedStyle(n).fontSize));
   for(let scale=1;scale>.22&&(node.scrollHeight>node.clientHeight+1||node.scrollWidth>node.clientWidth+1);scale-=.05)children.forEach((n,i)=>n.style.fontSize=(sizes[i]*scale)+'px');
  }
  function draw(){if(!snapshot?.pages.length){heading.textContent='Sports';previous.replaceChildren(el('p','Choose teams and add their schedule to this board.'));return}
   epoch++;rosterTitle.textContent=snapshot.board.rosterHeading||'MEET THE TEAM';page=snapshot.pages[index%snapshot.pages.length];elapsed=0;lastMediaAt=-20;currentMedia=-1;playing=false;video.pause();video.removeAttribute('src');video.hidden=true;photo.hidden=false;if(snapshot.logo)photo.src=resolveAsset(snapshot.logo);else photo.removeAttribute('src');photo.hidden=!snapshot.logo;caption.textContent='';
   heading.textContent=page.sport+' · '+page.name;level.textContent=({varsity:'VARSITY',jv:'JUNIOR VARSITY',middle:'MIDDLE SCHOOL',program:'SCHOOL PROGRAM ROSTER'})[page.level]||'';
   renderGame(previous,page.previous,false);renderGame(next,page.next,true);recap.textContent=page.previous?.recap||'';recap.hidden=!recap.textContent;if(!recap.hidden)fitBox(recap);
   track.replaceChildren();for(const p of page.roster){const row=el('div',null,'rg-sports-player'),number=el('b',p.number||'—'),details=el('div');details.append(el('strong',p.name),el('small',[p.role==='manager'?'Manager':p.position,p.grade?'Grade '+p.grade:''].filter(Boolean).join(' · ')));if(p.stats)details.append(el('small',p.stats,'rg-sports-stat'));row.append(number,details);track.append(row)}
   roster.hidden=!page.roster.length;rosterLabel.textContent=page.programRoster||page.level==='program'?'Program roster · '+page.season:page.season;cycle=track.scrollHeight;
   const copy=el('div',null,'rg-sports-copy');copy.setAttribute('aria-hidden','true');for(const n of Array.from(track.children))copy.append(n.cloneNode(true));track.append(copy);track.style.transform=`translateY(${window.clientHeight}px)`;
   tickerText.textContent=snapshot.pages.filter(p=>p.next).map(p=>[p.sport,p.level.toUpperCase(),date(p.next.startAt,true),p.next.opponent].join(' · ')).join('     •     ');
   host.style.setProperty('--sports-bg',snapshot.board.background);host.style.setProperty('--sports-accent',snapshot.board.accent);school.textContent=snapshot.school||'School athletics';logo.hidden=!snapshot.logo;if(snapshot.logo)logo.src=resolveAsset(snapshot.logo);
   fitBox(title);fitBox(previous);fitBox(next);fitBox(brand);if(page.media.length)play();
  }
  async function refresh(){if(dead||busy)return;busy=true;abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),8000);try{
    const data=await loadSports(boardId,abort.signal);if(dead||!host.isConnected)return;if(!data.ok||!Array.isArray(data.pages))throw Error('Sports data unavailable');
    if(!snapshot){snapshot=data;draw()}else if(data.revision!==snapshot.revision)pending=data;else snapshot.weather=data.weather;
    footer.textContent='RoomGoblin · Kyle Wagner'+(data.weather?.source?' · '+data.weather.source:'');
   }catch{if(!dead)footer.textContent='RoomGoblin · Kyle Wagner · Showing saved content; refresh unavailable'}finally{clearTimeout(timeout);busy=false;if(!dead)fetchTimer=setTimeout(refresh,60000)}
  }
  function tick(at){if(dead)return;if(!host.isConnected){stop();return}const dt=Math.min(.5,Math.max(0,(at-last)/1000));last=at;
   if(snapshot&&!document.hidden){elapsed+=dt;try{clock.textContent=new Date().toLocaleTimeString(undefined,{timeZone:snapshot.timezone,hour:'numeric',minute:'2-digit',second:'2-digit'})}catch{}
    const w=snapshot.weather;const weatherText=w?[w.widgets?.['weather-temperature'],w.widgets?.['weather-condition'],w.widgets?.['weather-precipitation-today'],w.widgets?.['weather-sports-evening']?.split('\n').slice(0,4).join(' · ')].filter(Boolean).join(' · ')+(Date.now()-w.updatedAt>3600000?' · stale':''):'';
    if(weather.textContent!==weatherText){weather.textContent=weatherText;fitBox(weather)}
    if(cycle){const travel=Math.max(0,elapsed-snapshot.board.entryDelay)*snapshot.board.rosterSpeed,height=window.clientHeight;track.style.transform=`translateY(${travel<=height?height-travel:-((travel-height)%cycle)}px)`}
    if(playing){if(video.currentTime>videoProgress+.1){videoProgress=video.currentTime;progressAt=elapsed;tries=0}if(elapsed-videoStarted>120)finish();else if(elapsed-progressAt>12){if(tries++<2){progressAt=elapsed;((generation)=>video.play().catch(()=>{if(generation===epoch&&!dead)finish()}))(epoch)}else finish()}}
    else if(elapsed-lastMediaAt>=16&&page?.media.length)play();
    const duration=Math.max(snapshot.board.minimumSeconds,cycle?4+(window.clientHeight+cycle)/snapshot.board.rosterSpeed:0);if(elapsed>=duration&&!playing){if(pending){const teamId=page?.id;snapshot=pending;pending=null;index=Math.max(0,snapshot.pages.findIndex(p=>p.id===teamId))}index=(index+1)%Math.max(1,snapshot.pages.length);draw()}
   }else if(playing&&!video.paused)video.pause();frame=requestAnimationFrame(tick);
  }
  function visibility(){if(!dead&&playing&&!document.hidden){const generation=epoch;video.play().catch(()=>{if(!dead&&generation===epoch)finish()})}}document.addEventListener('visibilitychange',visibility);refresh();frame=requestAnimationFrame(tick);return stop;
 }
 // Disconnect immediately on scene replacement, including announcement takeover.
 const observer=new MutationObserver(()=>{for(const [node,stop]of instances)if(!node.isConnected)stop()});observer.observe(document.documentElement,{childList:true,subtree:true});
 window.RoomGoblinSportsBoard={mount};
})();
