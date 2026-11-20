'use strict';
(()=>{
 const $=id=>document.getElementById(id),make=(tag,text)=>{const n=document.createElement(tag);n.textContent=String(text);return n;};
 const requested=Number(new URLSearchParams(location.search).get('rows')),rows=Number.isFinite(requested)&&requested>=5?Math.min(15,Math.floor(requested)):8;
 let data=null,page=0,view=0,busy=false,timer=null,closed=false,lastSuccess=0,retry=5000;
 function paint(){
  if(!data)return;const players=data.players,pages=Math.max(1,Math.ceil(players.length/rows));page%=pages;
  $('page').textContent=(data.totalPlayers?data.totalPlayers+' players · ':'')+'Page '+(page+1)+' / '+pages;$('players').replaceChildren();
  const groups=[
   {title:'Competitive results',columns:['Rank','Player','Played','Wins','Mate W','Forfeit W','Time W','Draws','Win %'],values:p=>[p.rank,p.label,p.games,p.wins,p.mateWins||0,p.forfeitWins||0,p.timeoutWins||0,p.draws,p.winRate+'%']},
   {title:'Results and streaks',columns:['Rank','Player','Losses','Mate L','Forfeit L','Time L','Win streak','Best streak'],values:p=>[p.rank,p.label,p.losses,p.mateLosses||0,p.forfeitLosses||0,p.timeoutLosses||0,p.currentWinStreak||0,p.bestWinStreak||0]},
   {title:'Moves to victory',columns:['Rank','Player','Avg game','Avg / win','Avg / mate','Fastest mate'],values:p=>[p.rank,p.label,avg(p.avgGameMoves),avg(p.avgMovesPerWin),avg(p.avgMovesToMate),p.fastestMate??'—']}
  ],group=groups[view];$('stat-description').textContent=['Multiplayer results only. Checkmate, forfeit and time wins stay distinct.','W means wins; L means losses. Streaks include all multiplayer win types.','Move counts are each player’s own moves. Avg / win includes every win type; Avg / mate includes checkmate wins.'][view];$('stat-view').textContent=group.title;$('table-head').replaceChildren();for(const title of group.columns){const th=make('th',title);th.scope='col';$('table-head').append(th);}
  for(const p of players.slice(page*rows,(page+1)*rows)){const row=make('tr','');for(const value of group.values(p))row.append(make('td',value));$('players').append(row);}
  $('empty').hidden=players.length>0;const leader=players[0];$('leader').textContent=leader?.label||'Your name could be here.';$('leader-detail').textContent=leader?leader.games+' games · '+(leader.forfeitWins||0)+' forfeit wins · '+(leader.timeoutWins||0)+' time wins':'Finish a multiplayer game to join the leaderboard.';$('leader-wins').textContent=leader?.mateWins||0;$('leader-rate').textContent=(leader?.winRate||0)+'%';

 }
 async function poll(){
  clearTimeout(timer);if(closed)return;if(document.hidden){timer=setTimeout(poll,5000);return;}if(busy)return;busy=true;
  try{const r=await fetch('/api/v1/chess/leaderboard',{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const value=await r.json();if(closed)return;
   if(!Array.isArray(value.players))throw Error();data=value;lastSuccess=Date.now();retry=5000;paint();$('connection').textContent='LIVE · AUTO-UPDATING';$('connection').classList.remove('stale');$('updated').textContent='Updated '+new Date(lastSuccess).toLocaleTimeString();
  }catch{if(!closed){$('connection').textContent=lastSuccess?'Connection lost · Saved standings':'Waiting for the arena';$('connection').classList.add('stale');$('updated').textContent=lastSuccess?'Last update '+new Date(lastSuccess).toLocaleTimeString():'Reconnecting automatically';retry=Math.min(30000,retry*2);}}
  finally{busy=false;if(!closed)timer=setTimeout(poll,retry);}
 }
 const avg=n=>n===null||n===undefined?'—':Number(n).toFixed(1);
 const rotation=setInterval(()=>{if(!document.hidden){view=(view+1)%3;if(!view)page++;paint();}},15000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});window.addEventListener('online',poll);window.addEventListener('pagehide',()=>{closed=true;clearTimeout(timer);clearInterval(rotation);});poll();
})();
