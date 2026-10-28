"use strict";
(() => {
  const page=document.getElementById("music"),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
  const send=(url,body,method="POST")=>api(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  let bg=null,status=null,busy=false,dirty=false,initialized=false,selected="listen",searchGeneration=0,queue=null,selectedOutput="",lastQueueLoad=0,connectionDirty=false;
  let scheduleRevision=0,connectionRevision=0,tokenRevision=0,scheduleSaving=false,connectionSaving=false,loadGeneration=0,refreshPending=false,loadPromise=null,queueGeneration=0;
  const panels=[...page.querySelectorAll(".panel")],schedule=panels.find(p=>p.querySelector("#bgmStart")),favorites=panels.find(p=>p.querySelector("#bgmFavorites")),search=panels.find(p=>p.querySelector("#maSearch")),outputs=panels.find(p=>p.querySelector("#maPlayers")),connection=page.querySelector("details");
  const nav=el("div",undefined,"musicTabs"),sections={};page.querySelector(".top").after(nav);
  function button(parent,text,fn,cls=""){const b=el("button",text,cls);b.type="button";b.dataset.musicControl="true";b.addEventListener("click",async()=>{try{await fn()}catch(error){message(error.message,true)}});parent.append(b);return b}
  function label(parent,text,input){const wrap=el("label",text);input.setAttribute("aria-label",text);wrap.append(input);parent.append(wrap);return input}
  function message(text,error=false){notice.textContent=text;notice.classList.toggle("bad",error)}
  for(const [key,title]of [["listen","Now playing"],["discover","Find music"],["favorites","Favorites"],["schedule","Schedule"],["outputs","Outputs & connection"]]){
    const pane=el("section",undefined,"musicPane");pane.hidden=key!==selected;sections[key]=pane;
    const tab=button(nav,title,()=>{selected=key;for(const [id,p]of Object.entries(sections))p.hidden=id!==key;for(const b of nav.children)b.setAttribute("aria-pressed",String(b===tab));if(key==="listen")loadQueue()});tab.dataset.musicControl="false";tab.setAttribute("aria-pressed",String(key===selected));page.append(pane);
  }
  sections.schedule.append(schedule);sections.favorites.append(favorites);sections.discover.append(search);sections.outputs.append(outputs,connection);connection.addEventListener("input",event=>{connectionDirty=true;connectionRevision++;if(event.target.id==="maToken")tokenRevision++});
  for(const grid of page.querySelectorAll(":scope > .grid2"))if(!grid.querySelector(".panel"))grid.remove();
  const notice=el("div",undefined,"musicNotice");notice.setAttribute("role","status");nav.after(notice);
  page.querySelector(".top .muted").textContent="Your music, your outputs, one clear view. Music gives way to classroom priority audio and recovers afterward.";
  const hero=el("article",undefined,"musicHero"),disc=el("div","♫","musicDisc"),info=el("div",undefined,"musicTrackInfo"),eyebrow=el("span","BACKGROUND MUSIC","musicEyebrow"),title=el("h2","Choose what plays next"),detail=el("p","Play a saved station or find a song.");
  const runtime=document.getElementById("bgmRuntime");info.append(eyebrow,title,detail,runtime);hero.append(disc,info);sections.listen.append(hero);
  schedule.querySelector(".toolbar > .toolbar")?.remove();
  const controls=el("div",undefined,"musicTransport"),output=label(controls,"Listening output",el("select"));output.id="musicOutput";
  output.addEventListener("change",()=>{selectedOutput=output.value;MA_SELECTED_PLAYER=output.value;queue=null;renderNow();loadQueue()});
  button(controls,"Previous",()=>queueCommand("previous"));const play=button(controls,"Play",()=>control(bg?.runtime?.paused?"resume":"play"),"primary");
  button(controls,"Pause",()=>control("pause"));button(controls,"Stop",()=>control("stop"));button(controls,"Next",()=>queueCommand("next"));
  const volume=label(controls,"Listening volume",el("input"));volume.type="range";volume.min="0";volume.max="100";volume.step="1";volume.value="20";
  volume.addEventListener("change",()=>task(()=>maApi("players/cmd/volume_set",{player_id:output.value,volume_level:Number(volume.value)})));
  const mute=button(controls,"Mute",()=>{const p=MA_PLAYERS.find(p=>playerId(p)===output.value);return maMute(output.value,!(p?.volume_muted??p?.muted))});
  const tools=el("div",undefined,"musicTools"),sleep=label(tools,"Sleep timer",el("select"));for(const [value,text]of [[0,"Off"],[15,"15 minutes"],[30,"30 minutes"],[60,"1 hour"],[120,"2 hours"]]){const o=el("option",text);o.value=value;sleep.append(o)}
  sleep.addEventListener("change",()=>task(()=>send("/api/v1/music-assistant/background/control",{action:"sleep",minutes:Number(sleep.value)})));
  button(tools,"Recover playback",()=>control("retry"));button(tools,"Refresh queue",loadQueue);
  const favoritesQuick=el("div",undefined,"musicQuick"),queuePanel=el("article",undefined,"panel musicQueue"),queueHeading=el("div",undefined,"toolbar"),queueRows=el("ol"),shuffle=button(queueHeading,"Shuffle off",()=>queueCommand("shuffle",{shuffle_enabled:!queue?.shuffle})),repeat=label(queueHeading,"Repeat",el("select"));
  for(const value of ["off","one","all"]){const o=el("option",value==="one"?"One track":value==="all"?"All":"Off");o.value=value;repeat.append(o)}repeat.addEventListener("change",()=>queueCommand("repeat",{repeat_mode:repeat.value}).catch(error=>message(error.message,true)));
  const seek=label(queueHeading,"Track position",el("input"));seek.type="range";seek.min="0";seek.step="1";seek.closest("label").hidden=true;seek.addEventListener("change",()=>queueCommand("seek",{position:Number(seek.value)}).catch(error=>message(error.message,true)));
  queuePanel.append(el("h3","Up next"),queueHeading,queueRows);sections.listen.append(controls,tools,favoritesQuick,queuePanel);
  const kind=label(search,"Search for",el("select"));for(const [value,text]of [["all","Everything"],["radio","Stations"],["track","Songs"],["playlist","Playlists"],["album","Albums"],["artist","Artists"]]){const o=el("option",text);o.value=value;kind.append(o)}
  search.querySelector("h2").textContent="Find music & stations";search.querySelector(".toolbar").before(kind);document.getElementById("maSearch").placeholder="Song, artist, playlist, album, or station name";
  const custom=el("details"),customTitle=el("summary","Add a radio stream URL"),customName=el("input"),customUrl=el("input");customUrl.type="url";custom.append(customTitle);label(custom,"Station name",customName);label(custom,"Radio stream URL",customUrl);button(custom,"Save station",()=>{if(!customName.value.trim()||!/^https?:\/\//i.test(customUrl.value.trim()))throw Error("Enter a station name and HTTP(S) audio stream URL");return task(()=>send("/api/v1/music-assistant/background/favorites",{name:customName.value.trim(),uri:customUrl.value.trim(),mediaType:"radio",detail:"Radio stream"}))});search.append(custom);
  const reliability=el("details",undefined,"musicReliability"),summary=el("summary","Recovery & listening details"),health=el("p");reliability.append(summary,health);sections.listen.append(reliability);
  const auto=el("input");auto.type="checkbox";auto.id="musicAutoRecover";label(schedule,"Automatically recover interrupted playback",auto);
  const stall=el("input");stall.type="number";stall.min="60";stall.max="600";stall.id="musicStallSeconds";label(schedule,"Detect stopped progress after seconds",stall);
  schedule.append(el("p","Recovery manages the chosen output or Music Assistant group. Use a group configured in Music Assistant for synchronized speakers. It cannot prove audible sound or fix a weak Wi-Fi link.","muted"));
  function markScheduleDirty(){dirty=true;scheduleRevision++;document.getElementById("bgmSaveMsg").textContent="Unsaved schedule changes"}
  schedule.addEventListener("input",markScheduleDirty);schedule.addEventListener("change",markScheduleDirty);
  const reloadSchedule=button(schedule,"Reload saved schedule",()=>{if(scheduleSaving)return;if(dirty&&!confirm("Discard unsaved music schedule changes?"))return;dirty=false;initialized=false;scheduleRevision++;loadGeneration++;return loadMusicAssistant()});
  function playerId(p){return String(p?.player_id||p?.playerId||p?.id||"")}
  function options(select,items,value){if(value&&!items.some(([id])=>id===value))items.push([value,"Saved selection · currently unavailable"]);const key=JSON.stringify(items);if(select.dataset.items!==key){select.replaceChildren();for(const [id,name]of items){const o=el("option",name);o.value=id;select.append(o)}select.dataset.items=key}select.value=value}
  function renderNow(){
    if(!bg)return;const r=bg.runtime||{},p=(status?.players||[]).find(p=>playerId(p)===output.value),media=p?.current_media||{},recovery=r.recovery||{},owned=output.value===r.activePlayerId;
    title.textContent=media.title||(owned?r.activeMedia?.name:"")||"Choose what plays next";detail.textContent=[media.artist,media.album,p?.display_name||p?.name].filter(Boolean).join(" · ")||"Choose a station or song to start listening.";
    const state=owned?(r.manualStopped?(r.paused?"Paused by you":String(p?.playback_state||p?.state||"")==="playing"?"Stop requested; player still reports playing":"Stopped by you"):r.pausedForPriority?"Paused for priority audio":recovery.state||"idle"):String(p?.playback_state||p?.state||"idle");
    runtime.textContent=state==="playing"?"Player reports playing":state.replaceAll("-"," ");runtime.dataset.state=state;
    disc.classList.toggle("playing",state==="playing");play.textContent=owned&&r.paused?"Resume":"Play";
    if(document.activeElement!==volume)volume.value=String(p?.volume_level??20);mute.textContent=(p?.volume_muted??p?.muted)?"Unmute":"Mute";
    health.textContent=[recovery.reason,r.lastError,r.playerProbeError,recovery.lastProgressAt?`Last progress ${new Date(recovery.lastProgressAt).toLocaleTimeString()}`:"",recovery.retryAt>Date.now()?`Next recovery ${new Date(recovery.retryAt).toLocaleTimeString()}`:"",r.sleepUntil?`Sleep ends ${new Date(r.sleepUntil).toLocaleTimeString()}`:""].filter(Boolean).join(" · ")||"No recovery events. Player status does not prove audible output.";
    if(document.activeElement!==sleep){const remaining=Math.max(0,(Number(r.sleepUntil)||0)-Date.now())/60000;sleep.value=String(remaining?[15,30,60,120].find(n=>n>=remaining)||120:0)}
    if(r.lastError)message(r.lastError,true);else if(notice.textContent.startsWith("Request accepted"))message(state==="playing"?"Player reports playing":recovery.reason||"");
    const favorites=bg.favorites||[],key=JSON.stringify(favorites);if(favoritesQuick.dataset.key!==key){favoritesQuick.dataset.key=key;favoritesQuick.replaceChildren();for(const favorite of favorites.slice(0,8))button(favoritesQuick,favorite.name,()=>playItem({...favorite,mediaType:favorite.mediaType||(/:\/\/radio\//.test(favorite.uri)?"radio":"unknown")}))}
    permissions();
  }
  function permissions(){
    for(const input of connection.querySelectorAll("#maUrl,#maBrowserUrl,#maToken"))input.disabled=!userCan("admin");
    for(const b of page.querySelectorAll('[data-music-control="true"]'))b.disabled=busy||!userCan("classroom.control");
    connection.querySelector('button[onclick*="saveMusicAssistantConfig"]').disabled=connectionSaving||!userCan("admin");
    schedule.querySelector('button[onclick*="saveBackgroundMusicSchedule"]').disabled=scheduleSaving||!userCan("classroom.control");
    reloadSchedule.disabled=busy||scheduleSaving||!userCan("classroom.control");
  }
  async function task(fn){if(busy)return;busy=true;permissions();try{const result=await fn();message("Request accepted. Checking the player…");return result}catch(error){message(error.message,true)}finally{busy=false;permissions();loadMusicAssistant()}}
  async function control(action){
    if(["pause","stop","resume"].includes(action)&&output.value!==bg?.runtime?.activePlayerId)return task(()=>maApi(`players/cmd/${action==="resume"?"play":action}`,{player_id:output.value}));
    if(action==="retry"&&output.value!==bg?.runtime?.activePlayerId)throw Error("Start Background Music on this output before recovering it");
    if(action==="play"){const favorite=bg?.favorites?.find(f=>f.id===(bgmFavorite.value||bg?.schedule?.favoriteId));if(!favorite)throw Error("Choose a favorite or find music first");return playItem(favorite)}
    return task(()=>send("/api/v1/music-assistant/background/control",{action,playerId:output.value}));
  }
  async function playItem(item){if(!output.value)throw Error("Choose a listening output first");return task(()=>send("/api/v1/music-assistant/background/control",{action:"play",playerId:output.value,uri:item.uri,name:item.name,mediaType:item.mediaType||"unknown"}));}
  async function queueCommand(command,args={}){if(!queue?.id)throw Error("Choose an output with an active queue first");await task(()=>maApi(`player_queues/${command}`,{queue_id:queue.id,...args}));await loadQueue()}
  async function loadQueue(){
    const generation=++queueGeneration;
    if(!output.value)return;const pid=output.value;lastQueueLoad=Date.now();
    try{const data=await api(`/api/v1/music-assistant/background/queue?playerId=${encodeURIComponent(pid)}`);if(generation!==queueGeneration||pid!==output.value)return;queue=data.queue;queueRows.replaceChildren();
      shuffle.textContent=queue?.shuffle?"Shuffle on":"Shuffle off";repeat.value=queue?.repeat||"off";seek.closest("label").hidden=!(queue?.current?.duration>0);if(document.activeElement!==seek){seek.max=String(queue?.current?.duration||1);seek.value=String(Math.max(0,queue?.elapsed||0))}
      for(const [index,item]of (data.items||[]).entries()){const row=el("li"),text=el("span",item.name);row.append(text);button(row,index===0?"Play current":"Play this",()=>queueCommand("play_index",{index:item.id||index+(queue?.currentIndex||0)}));queueRows.append(row)}
      if(!data.items?.length)queueRows.append(el("li","No queued items. Live stations may not have an upcoming track list."));
    }catch(error){if(generation===queueGeneration&&pid===output.value)queueRows.replaceChildren(el("li",error.message))}
  }
  function cards(parent,items,{saved=false}={}){
    const key=JSON.stringify(items);if(parent.dataset.key===key)return;parent.dataset.key=key;parent.replaceChildren();for(const item of items){const card=el("article",undefined,"musicItem"),content=el("div");content.append(el("h3",item.name),el("p",item.detail||item.mediaType||"Music"));card.append(content);const actions=el("div",undefined,"toolbar");button(actions,"Play",()=>playItem(item),"primary");
      button(actions,"Play next",()=>{if(!queue?.id)throw Error("Start playback before adding to the queue");return task(()=>maApi("player_queues/play_media",{queue_id:queue.id,media:item.uri,option:"next"}))});
      if(saved){button(actions,"Use in schedule",()=>{bgmFavorite.value=item.id;markScheduleDirty();message("Favorite selected in Schedule. Save the schedule to apply it.")});button(actions,"Remove",()=>deleteBgmFavorite(item.id))}
      else button(actions,"Save favorite",()=>task(()=>send("/api/v1/music-assistant/background/favorites",item)));
      card.append(actions);parent.append(card);
    }
    if(!items.length)parent.append(el("p",saved?"No favorites yet. Find music and save the sources you use most.":"No results. Try another title or station name.","muted"));permissions();
  }
  window.searchMusicAssistant=async function(){const query=maSearch.value.trim(),generation=++searchGeneration;delete maSearchResults.dataset.key;if(query.length<2){maSearchResults.replaceChildren();message("Enter at least two characters to search");return}maSearchResults.textContent="Searching music providers…";
    try{const result=await maApi("music/search",{search_query:query,media_types:kind.value==="all"?["track","radio","album","playlist","artist"]:[kind.value],limit:20});if(generation!==searchGeneration)return;
      const rows=[];for(const [type,list]of Object.entries(result||{}))if(Array.isArray(list))for(const item of list.slice(0,20))if(item.uri)rows.push({uri:item.uri,name:item.name||"Music item",mediaType:item.media_type||type.replace(/s$/,""),detail:[type,Array.isArray(item.artists)?item.artists.map(a=>a.name).join(", "):item.artist?.name,item.album?.name].filter(Boolean).join(" · ")});cards(maSearchResults,rows);
    }catch(error){if(generation===searchGeneration)maSearchResults.textContent=error.message}
  };
  const classicSchedule=window.renderBgmSchedule;
  window.renderBgmFavorites=function(){options(bgmFavorite,[["","Choose a saved source…"],...BGM_FAVORITES.map(f=>[f.id,f.name])],dirty?bgmFavorite.value:BGM_SCHEDULE.favoriteId||"");cards(bgmFavorites,BGM_FAVORITES,{saved:true})};
  const playerCards=new Map();
  window.renderMaPlayers=function(){
    if(!playerCards.size)maPlayers.replaceChildren();const ids=new Set();for(const p of MA_PLAYERS){const id=playerId(p);ids.add(id);let card=playerCards.get(id);
      if(!card){const root=el("article",undefined,"musicItem"),content=el("div"),name=el("h3"),state=el("p"),actions=el("div",undefined,"toolbar"),level=el("input");level.type="number";level.min="0";level.max="100";
        content.append(name,state);button(actions,"Listen here",()=>{selectedOutput=id;output.value=id;queue=null;renderNow();loadQueue();message("Listening output selected. Choose music to start it.")});button(actions,"Play / pause",()=>maPlayerCmd(id,"players/cmd/play_pause"));button(actions,"Stop",()=>maPlayerCmd(id,"players/cmd/stop"));button(actions,"Mute / unmute",()=>{const current=MA_PLAYERS.find(p=>playerId(p)===id);return maMute(id,!(current?.volume_muted??current?.muted))});label(actions,"Volume",level);level.addEventListener("change",()=>maSetVolume(id,level.value));root.append(content,actions);card={root,name,state,level};playerCards.set(id,card);maPlayers.append(root)}
      card.name.textContent=p.display_name||p.name||id;card.state.textContent=`${p.playback_state||p.state||"unknown"} · ${p.available===false?"unavailable":"available"}${p.provider?" · "+p.provider:""}`;card.level.setAttribute("aria-label",`Volume for ${p.display_name||p.name||id}`);if(document.activeElement!==card.level)card.level.value=String(p.volume_level??20);
    }
    for(const [id,card]of playerCards)if(!ids.has(id)){card.root.remove();playerCards.delete(id)}
    if(!MA_PLAYERS.length&&!maPlayers.querySelector(".musicEmpty"))maPlayers.append(el("p","No registered outputs. Check the connection or attach a RoomGoblin display.","musicEmpty"));if(MA_PLAYERS.length)maPlayers.querySelector(".musicEmpty")?.remove();permissions();
  };
  window.loadMusicAssistant=function(){
    if(scheduleSaving||connectionSaving){refreshPending=true;return Promise.resolve()}
    if(loadPromise){refreshPending=true;return loadPromise}
    window.musicStudioLoading=true;
    loadPromise=(async()=>{do{
      refreshPending=false;const generation=loadGeneration;
    try{
      const data=await Promise.all([api("/api/v1/music-assistant/status"),api("/api/v1/music-assistant/background")]);
      if(generation!==loadGeneration||scheduleSaving||connectionSaving)continue;
      status=data[0];bg=data[1];MA_PLAYERS=status.players||[];
      if(!initialized&&!dirty){classicSchedule(bg);auto.checked=bg.schedule.autoRecover!==false;stall.value=String(bg.schedule.stallSeconds||120);initialized=true}
      BGM_FAVORITES=bg.favorites||[];BGM_SCHEDULE=bg.schedule||{};
      options(output,[["","Choose output…"],...MA_PLAYERS.map(p=>[playerId(p),`${p.display_name||p.name||playerId(p)}${p.available===false?" · offline":""}`])],selectedOutput||bg.runtime?.activePlayerId||bg.schedule.playerId||"");selectedOutput=output.value;
      if(!dirty){const current=bgmPlayer.value;options(bgmPlayer,[["","Choose scheduled output…"],...MA_PLAYERS.map(p=>[playerId(p),p.display_name||p.name||playerId(p)])],current||bg.schedule.playerId||"")}
      maStatus.textContent=status.online?"Music Assistant connected":"Music Assistant unavailable";
      if(!connectionDirty){maUrl.value=status.url||"";maBrowserUrl.value=status.browserUrl||""}
      const bridgeRows=Object.entries(status.bridgeStatus||{}),bridgeKey=JSON.stringify(bridgeRows.map(([id])=>id));
      if(maTvTargets.dataset.inventory!==bridgeKey){
        const prior=new Set([...maTvTargets.querySelectorAll('.maTvTarget:checked')].map(n=>n.value)),first=maTvTargets.dataset.inventory===undefined,attached=new Set(status.attachedTargets||[]);maTvTargets.replaceChildren();
        for(const [id,state]of bridgeRows){const input=el("input");input.type="checkbox";input.className="maTvTarget";input.value=id;input.checked=first?attached.has(id):prior.has(id);label(maTvTargets,`${id} · ${state?.state||"detached"}${state?.audioRestoreUnconfirmed?" · Audio settings unconfirmed; reconnect the display to retry":""}`,input)}maTvTargets.dataset.inventory=bridgeKey;
      }

      for(const [id,state]of bridgeRows){const input=[...maTvTargets.querySelectorAll("input")].find(n=>n.value===id);if(input?.parentElement.firstChild?.nodeType===3)input.parentElement.firstChild.textContent=`${id} · ${state?.state||"detached"}${state?.audioRestoreUnconfirmed?" · Audio settings unconfirmed; reconnect the display to retry":""}`}
      renderBgmFavorites();renderMaPlayers();renderNow();
      if(selected==="listen"&&(!queue||Date.now()-lastQueueLoad>15000))loadQueue();
    }catch(error){if(generation===loadGeneration)message(error.message,true)}
    }while(refreshPending&&!scheduleSaving&&!connectionSaving)})().finally(()=>{loadPromise=null;window.musicStudioLoading=false});
    return loadPromise;
  };
  window.saveBackgroundMusicSchedule=async function(){
    if(scheduleSaving||!userCan("classroom.control"))return;
    scheduleSaving=true;const revision=scheduleRevision;loadGeneration++;permissions();
    try{
    const body={enabled:bgmEnabled.value==="1",startTime:bgmStart.value,endTime:bgmEnd.value,days:[...page.querySelectorAll('.bgmDay:checked')].map(x=>Number(x.value)),schoolDaysOnly:bgmSchoolDays.checked,playerId:bgmPlayer.value,favoriteId:bgmFavorite.value,volume:Number(bgmVolume.value),pauseForPriorityAudio:bgmPausePriority.checked,autoRecover:auto.checked,stallSeconds:Number(stall.value)};
    await send("/api/v1/music-assistant/background/schedule",body,"PUT");
    if(revision===scheduleRevision)dirty=false;
    document.getElementById("bgmSaveMsg").textContent=dirty?"Saved earlier changes; newer schedule edits are unsaved":"Saved";
    message(dirty?"Earlier schedule saved. Save again to apply your newer edits.":"Music schedule saved");
  }catch(error){document.getElementById("bgmSaveMsg").textContent=error.message}
    finally{loadGeneration++;scheduleSaving=false;permissions();await loadMusicAssistant()}
  };
  window.saveMusicAssistantConfig=async function(){
    if(connectionSaving||!userCan("admin"))return;
    connectionSaving=true;const revision=connectionRevision,submittedTokenRevision=tokenRevision;loadGeneration++;permissions();
    try{
      await send("/api/v1/music-assistant/config",{url:maUrl.value.trim(),browserUrl:maBrowserUrl.value.trim(),token:maToken.value||undefined,tvBridgeEnabled:status?.tvBridgeEnabled!==false},"PUT");
      if(revision===connectionRevision)connectionDirty=false;
      message(connectionDirty?"Earlier connection settings saved. Newer edits are unsaved.":"Music Assistant connection saved");
    }catch(error){message(error.message,true)}finally{
      if(submittedTokenRevision===tokenRevision)maToken.value="";
      loadGeneration++;connectionSaving=false;permissions();await loadMusicAssistant();
    }
  };
  window.bgmControl=control;window.bgmPlayFavorite=id=>{const item=bg?.favorites?.find(f=>f.id===id);if(item)return playItem(item)};
  window.playMaUri=uri=>playItem({uri,name:"Selected music"});
  window.addEventListener("roomgoblin:authchange",()=>{permissions();if(!userCan("classroom.control"))maToken.value=""});
  setInterval(()=>{if(page.classList.contains("active")&&!document.hidden&&userCan("classroom.control"))loadMusicAssistant()},7000);
})();
