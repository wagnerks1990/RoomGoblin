'use strict';
(()=>{
const cfg=window.ROOMGOBLIN_SCORM,$=id=>document.getElementById(id),sdk=window.RoomGoblinSCORM;
const glyph={K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
let api=null,modern=false,actor='',review=false,ready=false,matches=[],userId='',selected='',originSquare='',busy=false,lastScore=-1,retired=false,paused=false;
const el=(tag,text)=>{const e=document.createElement(tag);e.textContent=String(text??'');return e;};
function findApi(){for(let w=window,i=0;w&&i<32;i++){try{if(w.API)return {api:w.API,modern:false};if(w.API_1484_11)return {api:w.API_1484_11,modern:true};if(w.parent===w)break;w=w.parent;}catch{break;}}return null;}
const get=key=>api?.[modern?'GetValue':'LMSGetValue'](key),set=(key,value)=>api?.[modern?'SetValue':'LMSSetValue'](key,String(value)),commit=()=>api?.[modern?'Commit':'LMSCommit']('');
function sameActor(){return !!actor&&!retired&&String(get(modern?'cmi.learner_id':'cmi.core.student_id')||'')===actor;}
function saveCredential(){if(review||!sameActor())return;const credential=sdk.credential();if(!credential)return;try{const payload=JSON.stringify({actor,credential});if(payload.length>3900)throw Error('Resume data too large.');if(![true,'true'].includes(set('cmi.suspend_data',payload))||![true,'true'].includes(commit()))throw Error('Schoology did not confirm the resume save.');}catch(e){$('status').textContent=e.message;}}
function reportScore(own){if(review||!sameActor())return;const score=Math.min(100,own*20);if(score<=lastScore)return;
 try{set(modern?'cmi.score.min':'cmi.core.score.min',0);set(modern?'cmi.score.max':'cmi.core.score.max',100);
  if(![true,'true'].includes(set(modern?'cmi.score.raw':'cmi.core.score.raw',score)))throw Error('Grade write failed.');
  if(own>=5)set(modern?'cmi.completion_status':'cmi.core.lesson_status','completed');
  if(![true,'true'].includes(commit()))throw Error('Grade commit failed.');lastScore=score;sdk.progress(Math.min(5,own),5);
 }catch(e){$('status').textContent='Schoology grade not confirmed: '+e.message;}}
function ownMoves(m){if(!userId)return 0;const isWhite=m.myColor==='white',isBlack=m.myColor==='black';if(!isWhite&&!isBlack)return 0;return m.mode==='solo'?m.moves.length:m.moves.filter((_,i)=>(i%2===0)===isWhite).length;}
function renderBoard(m){
 const b=$('board');b.replaceChildren();const rows=m.fen.split(' ')[0].split('/'),mine=m.myColor,turn=m.turn===mine||m.mode==='solo'&&!!mine,canMove=!review&&!paused&&m.status==='active'&&turn;
 $('match-title').textContent=m.white.name+' vs '+(m.black?.name||'Waiting for opponent');
 $('turn').textContent=m.status==='finished'?'Result: '+m.result+' · '+m.reason:m.status==='waiting'?'Share this assignment with a classmate. Waiting for another student.':m.turn+' to move'+(turn?' · Your turn':'');
 const expanded=rows.map(r=>r.replace(/[1-8]/g,n=>'.'.repeat(Number(n))));
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const coord='abcdefgh'[x]+(8-y),piece=expanded[y][x],cell=el('button',glyph[piece]||'');cell.type='button';cell.className='sq '+((x+y)%2?'dark':'light')+(originSquare===coord?' selected':'');
  cell.setAttribute('aria-label',coord+' '+(piece==='.'?'empty':piece));cell.disabled=!canMove;
  cell.onclick=async()=>{if(!originSquare){if(piece!=='.'&&(m.mode==='solo'?m.turn==='white'?piece===piece.toUpperCase():piece===piece.toLowerCase():mine==='white'?piece===piece.toUpperCase():piece===piece.toLowerCase())){originSquare=coord;renderBoard(m);}return;}
   if(originSquare===coord){originSquare='';renderBoard(m);return;}
   const from=originSquare;originSquare='';const promo=$('promotion').value;
   const sourcePiece=expanded[8-Number(from[1])]['abcdefgh'.indexOf(from[0])],promote=sourcePiece.toLowerCase()==='p'&&(coord[1]==='1'||coord[1]==='8');
   await action('/matches/'+m.id+'/move','POST',{move:from+coord+(promote?promo:''),revision:m.revision});
  };
  b.append(cell);
 }
 $('moves').textContent=m.moves.map((move,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+move).join(' ');
 const count=ownMoves(m);$('grade').textContent=Math.min(5,count)+' / 5 moves';$('progress').textContent='Your validated moves: '+Math.min(5,count)+' / 5';reportScore(count);
}
function render(){
 const lobby=$('lobby');lobby.replaceChildren();
 if(!matches.length)lobby.append(el('p','No matches yet.'));
 for(const m of matches){const own=!!m.myColor;const b=el('button',m.white.name+' vs '+(m.black?.name||'Waiting')+' · '+m.status);b.className='match';
  b.onclick=async()=>{if(m.status==='waiting'&&!own){await action('/matches/'+m.id+'/join','POST');return;}selected=m.id;originSquare='';render();};b.disabled=!own&&m.status!=='waiting'||review||paused&&!own;lobby.append(b);
 }
 const current=matches.find(m=>m.id===selected);if(current)renderBoard(current);else{$('board').replaceChildren();$('turn').textContent='Select or create a match.';}
}
async function pull(){if(!ready||busy||retired||document.hidden||!sameActor())return;busy=true;try{const data=await sdk.request('/activities/'+cfg.activityId+'/chess');if(retired)return;userId=data.userId;matches=data.matches;if(!selected){selected=matches.find(m=>m.myColor&&m.status!=='finished')?.id||'';}render();$('status').textContent='Connected. Match state updated '+new Date().toLocaleTimeString();}catch(e){$('status').textContent=e.message;}finally{busy=false;}}
async function action(path,method,body){if(!ready||review||paused||!sameActor())return;try{const r=await sdk.request('/activities/'+cfg.activityId+'/chess'+path,method,body);if(r.match)selected=r.match.id;await pull();}catch(e){$('status').textContent=e.message;await pull();}}
function init(){const found=findApi();if(!found){$('status').textContent='Launch this lesson from Schoology SCORM.';return;}api=found.api;modern=found.modern;
 try{api[modern?'Initialize':'LMSInitialize']('');actor=String(get(modern?'cmi.learner_id':'cmi.core.student_id')||'');review=['browse','review'].includes(get(modern?'cmi.mode':'cmi.core.lesson_mode'));const stored=JSON.parse(get('cmi.suspend_data')||'{}');if(stored.actor===actor)cfg.participantCredential=stored.credential;}catch{}
 if(!actor){$('status').textContent='Schoology learner identity is unavailable.';return;}
 $('create').onclick=()=>action('','POST',{mode:'multiplayer'});$('computer').onclick=()=>action('','POST',{mode:'computer'});$('solo').onclick=()=>action('','POST',{mode:'solo'});$('refresh').onclick=pull;
 window.addEventListener('roomgoblin:ready',()=>{ready=true;$('create').disabled=review;$('computer').disabled=review;$('solo').disabled=review;$('refresh').disabled=false;saveCredential();pull();});
 window.addEventListener('roomgoblin:credential',saveCredential);
 window.addEventListener('roomgoblin:identity-changed',()=>{retired=true;ready=false;matches=[];$('board').replaceChildren();$('lobby').replaceChildren();$('status').textContent='Learner changed. Reopen the assignment.';});
 window.addEventListener('roomgoblin:control',e=>{paused=!!e.detail.paused;$('create').disabled=review||paused;$('computer').disabled=review||paused;$('solo').disabled=review||paused;});
 setInterval(()=>{if(ready&&sameActor()&&!review&&!document.hidden)sdk.request('/activities/'+cfg.activityId+'/chess/heartbeat','POST').catch(()=>{});},10000);
 setInterval(pull,2500);
}
init();
})();