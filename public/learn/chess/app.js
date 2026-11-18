'use strict';
(()=>{
 const $=id=>document.getElementById(id),base='/api/v1/learning';
 const pieces={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
 let selected='',classId='',selectedFrom='',busy=false,closed=false,latest={matches:[],connected:[]},inFlight=false;
 const el=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value??'');return n;};
 const msg=v=>$('status').textContent=v;
 async function request(path,method='GET',body){
  const response=await fetch(base+path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-RoomGoblin-Learning':'1'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  if(response.status===401||response.status===403){closed=true;location.assign('/learn');throw Error('Teacher login required.');}
  const data=await response.json();if(!response.ok||data.ok===false)throw Error(data.error||'Chess request was not accepted.');return data;
 }
 function renderLeaderboard(data){
  const root=$('leaderboard');root.replaceChildren();
  $('leaderboard-info').textContent=data.rules+' '+data.identity;
  const table=el('table'),thead=el('thead'),head=el('tr');
  for(const name of ['Rank','Player','Games','Wins','Losses','Draws','Win %','Practice'])head.append(el('th',name));
  thead.append(head);table.append(thead);
  const tbody=el('tbody');
  for(const p of data.players){const tr=el('tr');if(p.me)tr.style.fontWeight='bold';
   for(const value of [p.rank,p.label,p.games,p.wins,p.losses,p.draws,p.winRate+'%',p.practice])tr.append(el('td',value));
   tbody.append(tr);}
  table.append(tbody);root.append(table);
  if(!data.players.length)root.append(el('p','No recorded games yet.'));
 }
 async function refreshLeaderboard(){
  if(closed||document.hidden)return;
  try{renderLeaderboard(await request('/teacher/chess/leaderboard'));}
  catch(e){$('leaderboard-info').textContent='Leaderboard is unavailable: '+e.message;}
 }
 const mine=m=>!!m.myColor;
 function drawBoard(m){
  const root=$('board');root.replaceChildren();const rows=m.fen.split(' ')[0].split('/').map(row=>row.replace(/[1-8]/g,n=>'.'.repeat(Number(n))));
  const turn=m.myColor===m.turn||m.mode==='solo'&&mine(m);
  for(let y=0;y<8;y++)for(let x=0;x<8;x++){
   const cellName='abcdefgh'[x]+(8-y),piece=rows[y][x],cell=el('button',pieces[piece]||'');
   cell.type='button';cell.className='sq '+((x+y)%2?'dark':'light')+(selectedFrom===cellName?' selected':'');
   cell.setAttribute('aria-label',cellName+(piece==='.'?' empty':' '+piece));
   cell.disabled=!turn||m.status!=='active';cell.style.cursor=cell.disabled?'default':'pointer';
   cell.onclick=()=>{if(inFlight)return;
    if(!selectedFrom){if(piece!=='.'&&(m.mode==='solo'||(m.turn==='white'?piece===piece.toUpperCase():piece===piece.toLowerCase()))){selectedFrom=cellName;drawBoard(m);}return;}
    if(selectedFrom===cellName){selectedFrom='';drawBoard(m);return;}
    const start=selectedFrom;selectedFrom='';
    const source=rows[8-Number(start[1])]['abcdefgh'.indexOf(start[0])];
    const promotion=source.toLowerCase()==='p'&&['1','8'].includes(cellName[1])?$('promotion').value:'';
    mutate('/teacher/classes/'+(m.seatClassId||classId)+'/chess/matches/'+m.id+'/move',{move:start+cellName+promotion,revision:m.revision});
   };
   root.append(cell);
  }
 }
 function render(){
  const data=latest;
  $('active').textContent=data.matches.filter(m=>m.status==='active').length;
  $('waiting').textContent=data.matches.filter(m=>m.status==='waiting').length;
  $('connected').textContent=data.connected.length;
  const games=$('games');games.replaceChildren();
  if(!data.matches.length)games.append(el('p','No games on the server.'));
  for(const m of data.matches){
   const label=m.white.name+' vs '+(m.black?.name||'Waiting')+' · '+m.status+' · '+m.mode+' · '+m.moves.length+' half-moves';
   const b=el('button',label);b.type='button';b.style.cssText='display:block;width:100%;margin:6px 0;text-align:left';
   b.setAttribute('aria-pressed',String(m.id===selected));
   b.onclick=()=>{if(m.canJoin&&!inFlight){mutate('/teacher/classes/'+classId+'/chess/matches/'+m.id+'/join');return;}selected=m.id;selectedFrom='';render();};
   games.append(b);
  }
  const active=data.matches.find(m=>m.id===selected);
  if(active){
   $('game-title').textContent=active.white.name+' (White) vs '+(active.black?.name||'Waiting')+' (Black) · '+(active.status==='finished'?(active.result+' '+active.reason):(active.turn+' to move'))+(mine(active)?' · You are '+active.myColor:' · Spectating');
   drawBoard(active);
   $('leave').disabled=!mine(active)||active.status==='finished';
   $('leave').onclick=()=>mutate('/teacher/classes/'+(active.seatClassId||classId)+'/chess/matches/'+active.id+'/leave',{revision:active.revision});
   $('moves').textContent=active.moves.map((move,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+move).join(' ');
  }else{$('game-title').textContent='Select a match to play or spectate.';$('board').replaceChildren();$('moves').textContent='';$('leave').disabled=true;}
  const people=$('people');people.replaceChildren();if(!data.connected.length)people.append(el('p','No recent connections.'));
  for(const person of data.connected)people.append(el('p',person.name+' · '+Math.max(0,Math.round((Date.now()-person.lastSeen)/1000))+' seconds ago'));
 }
 async function poll(){
  if(busy||closed||document.hidden)return;busy=true;
  try{latest=await request('/teacher/chess');render();msg('Updated '+new Date().toLocaleTimeString());}catch(e){msg(e.message);}finally{busy=false;}
 }
 async function mutate(path,body={}){
  if(closed||inFlight)return;inFlight=true;
  try{const result=await request(path,'POST',body);if(result.match)selected=result.match.id;selectedFrom='';inFlight=false;await poll();}
  catch(e){inFlight=false;msg(e.message);}
 }
 async function init(){
  try{
   const classes=await request('/teacher/classes');
   for(const c of classes.classes)$('class').append(new Option(c.title,c.id));
   classId=$('class').value;$('class').onchange=()=>{classId=$('class').value;};
   $('refresh').onclick=poll;
   $('queue').onclick=()=>mutate('/teacher/classes/'+classId+'/chess',{mode:'multiplayer'});
   $('computer').onclick=()=>mutate('/teacher/classes/'+classId+'/chess',{mode:'computer'});
   $('solo').onclick=()=>mutate('/teacher/classes/'+classId+'/chess',{mode:'solo'});
   await poll();await refreshLeaderboard();setInterval(poll,3000);setInterval(refreshLeaderboard,12000);
   setInterval(()=>{if(classId&&!closed&&!document.hidden)request('/teacher/classes/'+classId+'/chess/heartbeat','POST',{}).catch(()=>{});},10000);
  }catch(e){msg(e.message);}
 }
 init();
})();