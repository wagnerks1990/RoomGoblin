'use strict';
(()=>{const $=id=>document.getElementById(id),api='/api/v1/learning',icons={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
let selected='',classId='',busy=false,closed=false;
const el=(tag,text)=>{const e=document.createElement(tag);e.textContent=String(text??'');return e;};
async function request(path){const res=await fetch(api+path,{credentials:'same-origin',cache:'no-store',headers:{'X-RoomGoblin-Learning':'1'},signal:AbortSignal.timeout(12000)}),data=await res.json();
 if(res.status===401||res.status===403){closed=true;location.assign('/learn');throw Error('Teacher sign-in required.');}
 if(!res.ok)throw Error(data.error||'Chess server unavailable.');return data;}
function board(fen){const root=$('board');root.replaceChildren();const rows=fen.split(' ')[0].split('/');for(let y=0;y<8;y++){const expanded=rows[y].replace(/[1-8]/g,n=>'.'.repeat(Number(n)));for(let x=0;x<8;x++){const cell=el('div',icons[expanded[x]]||'');cell.className='sq '+((x+y)%2?'dark':'light');cell.setAttribute('aria-label','abcdefgh'[x]+(8-y)+' '+(expanded[x]==='.'?'empty':expanded[x]));root.append(cell);}}}
function render(data){
 $('active').textContent=data.matches.filter(m=>m.status==='active').length;
 $('waiting').textContent=data.matches.filter(m=>m.status==='waiting').length;
 $('connected').textContent=data.connected.length;
 const games=$('games');games.replaceChildren();
 if(!data.matches.length)games.append(el('p','No chess games in this class.'));
 for(const m of data.matches){const b=el('button',m.white.name+' vs '+(m.black?.name||'Waiting')+' · '+m.status+' · '+m.moves.length+' moves');b.style.cssText='display:block;width:100%;margin:6px 0;text-align:left';b.setAttribute('aria-pressed',String(selected===m.id));b.onclick=()=>{selected=m.id;render(data);};games.append(b);}
 const active=data.matches.find(m=>m.id===selected);if(active){$('game-title').textContent=active.white.name+' (White) vs '+(active.black?.name||'Waiting')+' (Black) · '+(active.result?active.result+' · '+active.reason:active.turn+' to move');board(active.fen);$('moves').textContent=active.moves.map((m,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+m).join(' ');}
 else{$('game-title').textContent='Select a match.';$('board').replaceChildren();$('moves').textContent='';}
 const people=$('people');people.replaceChildren();if(!data.connected.length)people.append(el('p','No recent student heartbeats.'));
 for(const person of data.connected){people.append(el('p',person.name+' · last seen '+Math.round((Date.now()-person.lastSeen)/1000)+'s ago'));}
}
async function poll(){if(busy||!classId||closed||document.hidden)return;busy=true;try{const id=classId;const data=await request('/teacher/classes/'+encodeURIComponent(id)+'/chess');if(classId!==id)return;render(data);$('status').textContent='Updated '+new Date().toLocaleTimeString();}catch(e){$('status').textContent=e.message;}finally{busy=false;}}
async function init(){try{const data=await request('/teacher/classes');const select=$('class');for(const c of data.classes)select.append(new Option(c.title,c.id));classId=select.value;select.onchange=()=>{classId=select.value;selected='';poll();};$('refresh').onclick=poll;await poll();setInterval(poll,3000);}catch(e){$('status').textContent=e.message;}}
init();
})();