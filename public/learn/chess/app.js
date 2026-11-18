'use strict';
(()=>{
 const $=id=>document.getElementById(id),base='/api/v1/learning',el=(tag,text)=>{const n=document.createElement(tag);n.textContent=String(text??'');return n;};
 let selected='',classId='',busy=false,closed=false,inFlight=false,pollAgain=false,latest={matches:[],connected:[]},gamesSignature='';
 const msg=text=>$('status').textContent=text;
 const board=new RoomGoblinChessBoard($('board'),{topPlayer:$('player-top'),bottomPlayer:$('player-bottom'),status:$('turn'),promotion:$('promotion'),onViewChange:active=>{$('cinematic').setAttribute('aria-pressed',String(active));$('cinematic').textContent=active?'Switch to 2D':'Fantasy 3D';},onMove:({move,revision,matchId})=>{const m=latest.matches.find(x=>x.id===matchId);return mutate('/teacher/classes/'+(m?.seatClassId||classId)+'/chess/matches/'+matchId+'/move',{move,revision});}});
 function retire(){closed=true;latest={matches:[],connected:[]};board.clear();for(const id of ['games','people','leaderboard','moves','game-title'])$(id).replaceChildren();location.assign('/learn');}
 async function request(path,method='GET',body){
  const response=await fetch(base+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-RoomGoblin-Learning':'1'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(response.status===401||response.status===403){retire();throw Error('Teacher login required.');}
  const data=await response.json();if(!response.ok||data.ok===false)throw Error(data.error||'Chess request was not accepted.');return data;
 }
 function renderLeaderboard(data){
  $('leaderboard-info').textContent=data.rules;RoomGoblinChessUI.leaderboard($('leaderboard'),data);
 }
 async function refreshLeaderboard(){if(closed||document.hidden)return;try{const data=await request('/teacher/chess/leaderboard');if(!closed)renderLeaderboard(data);}catch(e){$('leaderboard-info').textContent=e.message;}}
 function render(){
  $('active').textContent=latest.matches.filter(m=>m.status==='active').length;$('waiting').textContent=latest.matches.filter(m=>m.status==='waiting').length;$('connected').textContent=latest.connected.length;
  const sig=JSON.stringify(latest.matches.map(m=>[m.id,m.revision,m.white.name,m.black?.name,m.myColor,selected]));
  if(sig!==gamesSignature){gamesSignature=sig;const games=$('games');games.replaceChildren();if(!latest.matches.length)games.append(el('p','The arena is ready for its first game.'));
   for(const m of latest.matches){const b=el('button',m.white.name+' vs '+(m.black?.name||'Waiting for an opponent'));b.type='button';b.dataset.matchId=m.id;b.setAttribute('aria-pressed',String(selected===m.id));b.append(el('span',m.status+' · '+m.mode+(m.mode==='computer'?' · '+m.difficulty:'')));b.lastChild.className='match-meta';b.onclick=()=>{if(m.canJoin){mutate('/teacher/classes/'+classId+'/chess/matches/'+m.id+'/join');return;}selected=m.id;render();};games.append(b);}
  }
  const m=latest.matches.find(x=>x.id===selected);$('stage').hidden=!m;$('board-empty').hidden=!!m;
  if(m){$('game-title').textContent=m.myColor?(m.mode==='computer'?'You vs Computer · '+m.difficulty:m.mode==='solo'?'Solo practice':m.white.name+' vs '+(m.black?.name||'Waiting')):'Watching · '+m.white.name+' vs '+(m.black?.name||'Waiting');board.update(m,{disabled:inFlight});RoomGoblinChessUI.drawControls($('draw-actions'),m,{disabled:inFlight,onAction:body=>mutate('/teacher/classes/'+(m.seatClassId||classId)+'/chess/matches/'+m.id+'/draw',body)});$('leave').disabled=!m.myColor||m.status==='finished'||inFlight;$('leave').onclick=()=>mutate('/teacher/classes/'+(m.seatClassId||classId)+'/chess/matches/'+m.id+'/leave',{revision:m.revision});$('moves').textContent=m.moves.map((x,i)=>(i%2?'':' '+(Math.floor(i/2)+1)+'. ')+x.slice(0,2)+'–'+x.slice(2)).join(' ');}
  else{$('game-title').textContent='Your next move starts here.';$('leave').disabled=true;}
  const people=$('people');people.replaceChildren();if(!latest.connected.length)people.append(el('p','No recent connections.'));for(const p of latest.connected)people.append(el('p',p.name+' · '+Math.max(0,Math.round((Date.now()-p.lastSeen)/1000))+'s ago'));
 }
 async function poll(){
  if(closed||document.hidden)return;if(busy){pollAgain=true;return;}busy=true;
  try{const data=await request('/teacher/chess');if(closed)return;data.matches=data.matches.map(m=>{const local=latest.matches.find(x=>x.id===m.id);return local&&local.revision>m.revision?local:m;});latest=data;render();msg('Live · Updated '+new Date().toLocaleTimeString());}catch(e){msg(e.message);}finally{busy=false;if(pollAgain){pollAgain=false;poll();}}
 }
 async function mutate(path,body={}){
  if(closed||inFlight)return;inFlight=true;render();
  try{const r=await request(path,'POST',body);if(closed)return;if(r.match){selected=r.match.id;const i=latest.matches.findIndex(m=>m.id===r.match.id);if(i<0)latest.matches.unshift(r.match);else latest.matches[i]=r.match;}inFlight=false;render();await poll();refreshLeaderboard();}
  catch(e){inFlight=false;render();msg(e.message);}finally{inFlight=false;}
 }
 async function init(){
  $('cinematic').onclick=()=>board.setCinematic(!board.cinematicMode);$('flip').onclick=()=>board.flip();$('auto-view').onclick=()=>board.resetView();$('effects').onchange=()=>board.setEffects($('effects').checked);$('sound').onchange=()=>board.setSound($('sound').checked);
  $('board-size').oninput=()=>$('stage').style.setProperty('--board-size',$('board-size').value+'px');
  $('expand').onclick=()=>{const expanded=document.body.classList.toggle('board-focus');$('expand').setAttribute('aria-pressed',String(expanded));$('expand').textContent=expanded?'Restore dashboard':'Expand board';};
  $('tv-url').value=new URL('/chess/leaderboard',location.origin).href;$('copy-tv').onclick=async()=>{try{await navigator.clipboard.writeText($('tv-url').value);msg('TV leaderboard URL copied.');}catch{$('tv-url').focus();$('tv-url').select();msg('Select and copy the TV URL shown here.');}};
  try{const classes=await request('/teacher/classes');for(const c of classes.classes)$('class').append(new Option(c.title,c.id));classId=$('class').value;$('class').onchange=()=>classId=$('class').value;
   $('refresh').onclick=()=>{poll();refreshLeaderboard();};$('queue').onclick=()=>mutate('/teacher/classes/'+classId+'/chess',{mode:'multiplayer',timeControl:$('time-control').value,requestId:RoomGoblinChessUI.requestId()});$('computer').onclick=()=>mutate('/teacher/classes/'+classId+'/chess',{mode:'computer',difficulty:$('difficulty').value,timeControl:$('time-control').value,requestId:RoomGoblinChessUI.requestId()});$('solo').onclick=()=>mutate('/teacher/classes/'+classId+'/chess',{mode:'solo',timeControl:'none',requestId:RoomGoblinChessUI.requestId()});
   await poll();await refreshLeaderboard();setInterval(poll,2500);setInterval(refreshLeaderboard,10000);setInterval(()=>{if(classId&&!closed&&!document.hidden)request('/teacher/classes/'+classId+'/chess/heartbeat','POST',{}).catch(()=>{});},10000);
  }catch(e){msg(e.message);}
 }
 window.addEventListener('pagehide',()=>{closed=true;board.destroy();});init();
})();
