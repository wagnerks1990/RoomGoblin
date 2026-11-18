'use strict';
(()=>{
const cfg=window.ROOMGOBLIN_SCORM,$=id=>document.getElementById(id),sdk=window.RoomGoblinSCORM;
let api=null,modern=false,actor='',review=false,ready=false,matches=[],selected='',busy=false,lastScore=-1,validatedMoves=0,mutating=false,retired=false,paused=false;
const board=new RoomGoblinChessBoard($('board'),{topPlayer:$('player-top'),bottomPlayer:$('player-bottom'),status:$('turn'),promotion:$('promotion'),onViewChange:active=>{$('cinematic').setAttribute('aria-pressed',String(active));$('cinematic').textContent=active?'Switch to 2D':'Fantasy 3D';},onMove:({move,revision,matchId})=>action('/matches/'+matchId+'/move','POST',{move,revision})});
const el=(tag,text)=>{const e=document.createElement(tag);e.textContent=String(text??'');return e;};
function renderLeaderboard(data){
 $('leaderboard-info').textContent=data.rules+' '+data.identity;RoomGoblinChessUI.leaderboard($('leaderboard'),data);
}
async function refreshLeaderboard(){
 if(!ready||retired||!sameActor()||document.hidden)return;
 try{const response=await sdk.request('/activities/'+cfg.activityId+'/chess/leaderboard');if(!retired&&sameActor())renderLeaderboard(response);}
 catch(e){$('leaderboard-info').textContent='Leaderboard is unavailable: '+e.message;}
}
function findApi(){const starts=[window];try{if(window.opener)starts.push(window.opener);}catch{}for(let w of starts)for(let i=0;w&&i<32;i++){try{if(w.API)return {api:w.API,modern:false};if(w.API_1484_11)return {api:w.API_1484_11,modern:true};if(w.parent===w)break;w=w.parent;}catch{break;}}return null;}
const get=key=>api?.[modern?'GetValue':'LMSGetValue'](key),set=(key,value)=>api?.[modern?'SetValue':'LMSSetValue'](key,String(value)),commit=()=>api?.[modern?'Commit':'LMSCommit']('');
function sameActor(){return !!actor&&!retired&&String(get(modern?'cmi.learner_id':'cmi.core.student_id')||'')===actor;}
function saveCredential(){if(review||!sameActor())return;const credential=sdk.credential();if(!credential)return;try{const payload=JSON.stringify({actor,credential,selectedMatch:selected});if(payload.length>3900)throw Error('Resume data too large.');if(![true,'true'].includes(set('cmi.suspend_data',payload))||![true,'true'].includes(commit()))throw Error('Schoology did not confirm the resume save.');}catch(e){$('status').textContent=e.message;}}
function reportScore(own){if(review||!sameActor())return;const score=Math.max(lastScore,Math.min(100,own*20));if(score<=lastScore&&(own<5||get(modern?'cmi.completion_status':'cmi.core.lesson_status')==='completed'))return;
 try{set(modern?'cmi.score.min':'cmi.core.score.min',0);set(modern?'cmi.score.max':'cmi.core.score.max',100);
  if(![true,'true'].includes(set(modern?'cmi.score.raw':'cmi.core.score.raw',score)))throw Error('Grade write failed.');
  if(own>=5&&![true,'true'].includes(set(modern?'cmi.completion_status':'cmi.core.lesson_status','completed')))throw Error('Completion write failed.');
  if(![true,'true'].includes(commit()))throw Error('Grade commit failed.');lastScore=score;sdk.progress(Math.min(5,own),5);
 }catch(e){$('status').textContent='Schoology grade not confirmed: '+e.message;}}
function renderBoard(m){
 $('stage').hidden=false;$('match-title').textContent=m.mode==='computer'?'You vs Computer · '+m.difficulty:m.mode==='solo'?'Solo practice':m.white.name+' vs '+(m.black?.name||'Waiting for opponent');
 board.update(m,{disabled:review||paused||mutating,reason:review?'Read-only review':paused?'Paused by your teacher':'Sending your move…'});
 RoomGoblinChessUI.drawControls($('draw-actions'),m,{disabled:review||paused||mutating,onAction:body=>action('/matches/'+m.id+'/draw','POST',body)});
 $('moves').textContent=m.moves.map((move,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+move.slice(0,2)+'–'+move.slice(2)).join(' ');
 $('leave').disabled=!m.myColor||m.status==='finished'||review||paused||mutating;
 $('leave').onclick=()=>action('/matches/'+m.id+'/leave','POST',{revision:m.revision});
}
function render(){
 const lobby=$('lobby'),signature=JSON.stringify([selected,review,paused,mutating,matches.map(m=>[m.id,m.revision,m.myColor,m.white.name,m.black?.name])]);
 if(lobby.dataset.signature!==signature){lobby.dataset.signature=signature;lobby.replaceChildren();
 if(!matches.length)lobby.append(el('p','No matches yet.'));
 for(const m of matches){const own=!!m.myColor,b=el('button',m.white.name+' vs '+(m.black?.name||'Waiting'));b.className='match';b.type='button';b.dataset.matchId=m.id;b.setAttribute('aria-pressed',String(selected===m.id));b.append(el('span',RoomGoblinChessUI.gameSummary(m)));
  b.onclick=async()=>{if(m.status==='waiting'&&!own){await action('/matches/'+m.id+'/join','POST');return;}selected=m.id;saveCredential();render();};b.disabled=mutating||(!own&&(m.status!=='waiting'||review||paused));lobby.append(b);
 }}
 const current=matches.find(m=>m.id===selected);if(current)renderBoard(current);else{$('stage').hidden=true;$('turn').textContent='Select or create a match.';$('leave').disabled=true;}
}
async function pull(){if(!ready||busy||retired||document.hidden||!sameActor())return;busy=true;try{const data=await sdk.request('/activities/'+cfg.activityId+'/chess');if(retired||!sameActor())return;validatedMoves=data.validatedMoves;matches=data.matches.map(m=>{const local=matches.find(x=>x.id===m.id);return local&&local.revision>m.revision?local:m;});$('grade').textContent=validatedMoves+' / 5 moves';$('progress').textContent='Your validated moves: '+validatedMoves+' / 5';if(!selected||!matches.some(m=>m.id===selected)){selected=matches.find(m=>m.myColor&&m.status!=='finished')?.id||'';}render();$('status').textContent='Connected. Match state updated '+new Date().toLocaleTimeString();reportScore(validatedMoves);}catch(e){$('status').textContent=e.message;}finally{busy=false;}}
async function action(path,method,body){
 if(!ready||review||paused||mutating||!sameActor())return;mutating=true;render();
 try{const r=await sdk.request('/activities/'+cfg.activityId+'/chess'+path,method,body);if(!sameActor())return;if(r.match){selected=r.match.id;const i=matches.findIndex(m=>m.id===selected);if(i<0)matches.unshift(r.match);else matches[i]=r.match;}mutating=false;saveCredential();render();await pull();refreshLeaderboard();}
 catch(e){mutating=false;render();$('status').textContent=e.message;}finally{mutating=false;}
}
function init(){const found=findApi();if(!found){$('status').textContent='Launch this lesson from Schoology SCORM.';return;}api=found.api;modern=found.modern;
 try{api[modern?'Initialize':'LMSInitialize']('');actor=String(get(modern?'cmi.learner_id':'cmi.core.student_id')||'');review=['browse','review'].includes(get(modern?'cmi.mode':'cmi.core.lesson_mode'));const stored=JSON.parse(get('cmi.suspend_data')||'{}');if(stored.actor===actor){cfg.participantCredential=stored.credential;if(typeof stored.selectedMatch==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(stored.selectedMatch))selected=stored.selectedMatch;}}catch{}
 const savedScore=Number(get(modern?'cmi.score.raw':'cmi.core.score.raw'));if(Number.isFinite(savedScore)&&savedScore>=0&&savedScore<=100)lastScore=savedScore;
 if(!actor){$('status').textContent='Schoology learner identity is unavailable.';return;}
 $('cinematic').onclick=()=>board.setCinematic(!board.cinematicMode);$('flip').onclick=()=>board.flip();$('auto-view').onclick=()=>board.resetView();$('effects').onchange=()=>board.setEffects($('effects').checked);$('sound').onchange=()=>board.setSound($('sound').checked);
 $('create').onclick=()=>action('','POST',{mode:'multiplayer',timeControl:$('time-control').value,requestId:RoomGoblinChessUI.requestId()});$('computer').onclick=()=>action('','POST',{mode:'computer',difficulty:$('difficulty').value,timeControl:$('time-control').value,requestId:RoomGoblinChessUI.requestId()});$('solo').onclick=()=>action('','POST',{mode:'solo',timeControl:'none',requestId:RoomGoblinChessUI.requestId()});$('refresh').onclick=pull;
 window.addEventListener('roomgoblin:ready',()=>{ready=true;$('create').disabled=review||paused;$('computer').disabled=review||paused;$('solo').disabled=review||paused;$('refresh').disabled=false;saveCredential();pull();refreshLeaderboard();});
 window.addEventListener('roomgoblin:credential',saveCredential);
 window.addEventListener('roomgoblin:status',e=>{if(!retired)$('status').textContent=e.detail.message;});
 window.addEventListener('roomgoblin:identity-changed',()=>{retired=true;ready=false;matches=[];board.clear();$('lobby').replaceChildren();$('leaderboard').replaceChildren();$('leaderboard-info').textContent='';$('draw-actions').replaceChildren();$('match-title').textContent='Learner changed';$('moves').textContent='';for(const id of ['create','computer','solo','refresh','leave'])$(id).disabled=true;$('status').textContent='Learner changed. Reopen the assignment.';});
 window.addEventListener('roomgoblin:control',e=>{paused=!!e.detail.paused;$('create').disabled=review||paused;$('computer').disabled=review||paused;$('solo').disabled=review||paused;render();});
 window.addEventListener('pagehide',()=>{if(!review&&sameActor()){saveCredential();set(modern?'cmi.exit':'cmi.core.exit','suspend');commit();api?.[modern?'Terminate':'LMSFinish']('');}retired=true;board.destroy();});
 setInterval(()=>{if(ready&&sameActor()&&!review&&!document.hidden)sdk.request('/activities/'+cfg.activityId+'/chess/heartbeat','POST').catch(()=>{});},10000);
 setInterval(pull,2500);setInterval(refreshLeaderboard,12000);
}
init();
})();
