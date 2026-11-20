'use strict';
(()=>{
const cfg=window.ROOMGOBLIN_SCORM,$=id=>document.getElementById(id),sdk=window.RoomGoblinSCORM;
let api=null,modern=false,actor='',review=false,ready=false,matches=[],selected='',busy=false,lastScore=-1,validatedMoves=0,mutating=false,retired=false,paused=false,hintBusy=false,needsSync=true,stateEpoch=0,pullAgain=false,lastActionError='',lobbySignature='';
const coach=new RGChessCoach($('chess-coach'));
const board=new RoomGoblinChessBoard($('board'),{topPlayer:$('player-top'),bottomPlayer:$('player-bottom'),status:$('turn'),promotion:$('promotion'),onViewChange:active=>{$('cinematic').setAttribute('aria-pressed',String(active));$('cinematic').textContent=active?'Switch to 2D':'Fantasy 3D';},onMove:({move,revision,matchId})=>action('/matches/'+matchId+'/move','POST',{move,revision})});
const el=(tag,text)=>{const e=document.createElement(tag);e.textContent=String(text??'');return e;};
function renderLeaderboard(data){
 $('leaderboard-info').textContent=data.rules+' '+data.identity;RoomGoblinChessUI.leaderboard($('leaderboard'),data);
}
async function refreshLeaderboard(){
 if(!ready||retired||!sameActor()||document.hidden)return;
 try{const response=await sdk.request('/activities/'+cfg.activityId+'/chess/leaderboard');if(!retired&&sameActor())renderLeaderboard(response);}
 catch(e){accessFailure(e);if(!retired)$('leaderboard-info').textContent='Leaderboard is unavailable: '+e.message;}
}
function findApi(){const starts=[window];try{if(window.opener)starts.push(window.opener);}catch{}for(let w of starts)for(let i=0;w&&i<32;i++){try{if(w.API)return {api:w.API,modern:false};if(w.API_1484_11)return {api:w.API_1484_11,modern:true};if(w.parent===w)break;w=w.parent;}catch{break;}}return null;}
const get=key=>api?.[modern?'GetValue':'LMSGetValue'](key),set=(key,value)=>api?.[modern?'SetValue':'LMSSetValue'](key,String(value)),commit=()=>api?.[modern?'Commit':'LMSCommit']('');
function sameActor(){if(!actor||retired)return false;const same=String(get(modern?'cmi.learner_id':'cmi.core.student_id')||'')===actor;if(!same)retireActor();return same;}
function retireActor(reason){if(retired)return;const message=typeof reason==='string'?reason:'Learner changed. Reopen the assignment.';retired=true;ready=false;needsSync=true;stateEpoch++;matches=[];RoomGoblinChessUI.closeConfirmation();coach.destroy();board.clear();lobbySignature='';$('lobby').replaceChildren();$('lobby').removeAttribute('data-signature');$('leaderboard').replaceChildren();$('leaderboard').removeAttribute('data-signature');$('leaderboard-info').textContent='';$('draw-actions').replaceChildren();$('draw-actions').removeAttribute('data-signature');$('match-title').textContent=typeof reason==='string'?'Connection closed':'Learner changed';$('moves').textContent='';$('grade').textContent='— / 5 moves';$('progress').textContent='Reopen the assignment to load authorized progress.';for(const id of ['create','computer','solo','refresh','leave','practice-hint'])$(id).disabled=true;$('status').textContent=message;}
function accessFailure(error){if(error.status===401)retireActor('This connection is no longer authorized. Reopen the assignment or contact your teacher.');}
function saveCredential(){if(review||!sameActor())return;const credential=sdk.credential();if(!credential)return;try{const payload=JSON.stringify({actor,credential,selectedMatch:selected});if(payload.length>3900)throw Error('Resume data too large.');if(![true,'true'].includes(set('cmi.suspend_data',payload))||![true,'true'].includes(commit()))throw Error('Schoology did not confirm the resume save.');}catch(e){$('status').textContent=e.message;}}
function reportScore(own){if(review||!sameActor())return;const score=Math.max(lastScore,Math.min(100,own*20));if(score<=lastScore&&(own<5||get(modern?'cmi.completion_status':'cmi.core.lesson_status')==='completed'))return;
 try{set(modern?'cmi.score.min':'cmi.core.score.min',0);set(modern?'cmi.score.max':'cmi.core.score.max',100);
  if(![true,'true'].includes(set(modern?'cmi.score.raw':'cmi.core.score.raw',score)))throw Error('Grade write failed.');
  if(own>=5&&![true,'true'].includes(set(modern?'cmi.completion_status':'cmi.core.lesson_status','completed')))throw Error('Completion write failed.');
  if(![true,'true'].includes(commit()))throw Error('Grade commit failed.');lastScore=score;sdk.progress(Math.min(5,own),5);
 }catch(e){$('status').textContent='Schoology grade not confirmed: '+e.message;}}
function renderBoard(m){
 $('stage').hidden=false;$('match-title').textContent=m.mode==='computer'?'You vs Computer · '+m.difficulty:m.mode==='solo'?'Solo practice':m.white.name+' vs '+(m.black?.name||'Waiting for opponent');
 board.update(m,{disabled:review||paused||mutating||needsSync,reconnecting:needsSync,reason:review?'Read-only review':paused?'Paused by your teacher':needsSync?'Reconnecting · refreshing the saved board…':'Sending your move…'});
 RoomGoblinChessUI.drawControls($('draw-actions'),m,{disabled:review||paused||mutating||needsSync,onAction:body=>action('/matches/'+m.id+'/draw','POST',body)});
 $('moves').textContent=m.moves.map((move,i)=>(i%2===0?Math.floor(i/2)+1+'. ':'')+move.slice(0,2)+'–'+move.slice(2)).join(' ');
 $('leave').disabled=!m.myColor||m.status==='finished'||review||paused||mutating||needsSync;
 $('leave').textContent=RoomGoblinChessUI.leaveLabel(m);$('leave').onclick=()=>endGame(m);
}
function render(){
 for(const id of ['create','computer','solo'])$(id).disabled=!ready||review||paused||mutating||needsSync;
 const lobby=$('lobby'),signature=JSON.stringify([selected,review,paused,mutating,needsSync,matches.map(m=>[m.id,m.revision,m.myColor,m.white.name,m.black?.name])]);
 if(lobbySignature!==signature){lobbySignature=signature;const focused=lobby.contains(document.activeElement)?document.activeElement.dataset.matchId:null;lobby.replaceChildren();
 if(!matches.length)lobby.append(el('p','No matches yet.'));
 for(const m of matches){const own=!!m.myColor,b=el('button',m.white.name+' vs '+(m.black?.name||'Waiting'));b.className='match';b.type='button';b.dataset.matchId=m.id;b.setAttribute('aria-pressed',String(selected===m.id));b.append(el('span',RoomGoblinChessUI.gameSummary(m)));
  b.onclick=async()=>{if(m.status==='waiting'&&!own){await action('/matches/'+m.id+'/join','POST');return;}selected=m.id;saveCredential();render();};b.disabled=mutating||(!own&&(m.status!=='waiting'||review||paused||needsSync));lobby.append(b);
 }if(focused)lobby.querySelector('[data-match-id="'+focused+'"]')?.focus({preventScroll:true});}
 const current=matches.find(m=>m.id===selected);coach.update(current);$('practice-hint').disabled=hintBusy||!ready||review||paused||mutating||needsSync||!current?.myColor||current.status!=='active'||!['solo','computer'].includes(current.mode)||(current.mode==='computer'&&current.myColor!==current.turn);if(current)renderBoard(current);else{$('stage').hidden=true;$('turn').textContent='Select or create a match.';$('leave').disabled=true;}
}
async function pull(){
 if(!ready||retired||document.hidden||!sameActor())return;if(busy){pullAgain=true;return;}busy=true;const epoch=stateEpoch;
 try{const data=await sdk.request('/activities/'+cfg.activityId+'/chess');if(retired||!sameActor())return;if(epoch!==stateEpoch){pullAgain=true;return;}needsSync=false;validatedMoves=data.validatedMoves;matches=data.matches.map(m=>{const local=matches.find(x=>x.id===m.id);return local&&local.revision>m.revision?local:m;});$('grade').textContent=validatedMoves+' / 5 moves';$('progress').textContent='Your validated moves: '+validatedMoves+' / 5';if(!selected||!matches.some(m=>m.id===selected))selected=matches.find(m=>m.myColor&&m.status!=='finished')?.id||'';render();$('status').textContent=lastActionError?lastActionError+' · Board refreshed; no action was replayed.':'Connected. Match state updated '+new Date().toLocaleTimeString();reportScore(validatedMoves);}
 catch(e){accessFailure(e);if(!retired){needsSync=true;render();$('status').textContent='Connection not confirmed. '+e.message+' Refresh to reconnect.';}}
 finally{busy=false;if(pullAgain){pullAgain=false;pull();}}
}
async function action(path,method,body){
 if(!ready||review||paused||mutating||needsSync||!sameActor())return;const selectedAtStart=selected;stateEpoch++;lastActionError='';mutating=true;render();
 try{const r=await sdk.request('/activities/'+cfg.activityId+'/chess'+path,method,body);if(!sameActor())return;stateEpoch++;if(r.match){if(selected===selectedAtStart||!selected)selected=r.match.id;const i=matches.findIndex(m=>m.id===r.match.id);if(i<0)matches.unshift(r.match);else matches[i]=r.match;}mutating=false;needsSync=false;saveCredential();render();await pull();refreshLeaderboard();}
 catch(e){accessFailure(e);if(retired)return;stateEpoch++;mutating=false;needsSync=true;lastActionError=e.message;render();$('status').textContent=e.message+' · Refreshing the saved board…';await pull();}finally{mutating=false;}
}
async function endGame(match){
 if(!ready||review||paused||mutating||needsSync||!sameActor()||!match.myColor||!await RoomGoblinChessUI.confirmLeave(match))return;const current=matches.find(m=>m.id===match.id);if(!sameActor()||review||paused||mutating||needsSync||selected!==match.id||current?.revision!==match.revision||current.status==='finished'){$('status').textContent='The game changed. Review its current state before ending it.';return;}return action('/matches/'+current.id+'/leave','POST',{revision:current.revision});
}
async function requestHint(){
 const m=matches.find(x=>x.id===selected);if(!ready||review||paused||mutating||needsSync||hintBusy||!sameActor()||!m?.myColor||m.status!=='active'||!['solo','computer'].includes(m.mode)||(m.mode==='computer'&&m.myColor!==m.turn))return;
 const epoch=stateEpoch;hintBusy=true;$('practice-hint').textContent='Explaining…';render();
 try{const response=await sdk.request('/activities/'+cfg.activityId+'/chess/matches/'+m.id+'/hint','POST',{revision:m.revision});const current=matches.find(x=>x.id===selected);if(sameActor()&&!review&&!paused&&!mutating&&!needsSync&&epoch===stateEpoch&&current?.id===response.matchId&&current.revision===response.revision&&coach.showHint(response))$('coach-panel').open=true;}
 catch(e){accessFailure(e);if(!retired)$('status').textContent=e.message;}finally{hintBusy=false;if(!retired){$('practice-hint').textContent='Explain practice position';render();}}
}
function init(){const found=findApi();if(!found){$('status').textContent='Launch this lesson from Schoology SCORM.';return;}api=found.api;modern=found.modern;
 try{api[modern?'Initialize':'LMSInitialize']('');actor=String(get(modern?'cmi.learner_id':'cmi.core.student_id')||'');review=['browse','review'].includes(get(modern?'cmi.mode':'cmi.core.lesson_mode'));const stored=JSON.parse(get('cmi.suspend_data')||'{}');if(stored.actor===actor){cfg.participantCredential=stored.credential;if(typeof stored.selectedMatch==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(stored.selectedMatch))selected=stored.selectedMatch;}}catch{}
 const savedScore=Number(get(modern?'cmi.score.raw':'cmi.core.score.raw'));if(Number.isFinite(savedScore)&&savedScore>=0&&savedScore<=100)lastScore=savedScore;
 if(!actor){$('status').textContent='Schoology learner identity is unavailable.';return;}
 $('practice-hint').onclick=requestHint;$('cinematic').onclick=()=>board.setCinematic(!board.cinematicMode);$('flip').onclick=()=>board.flip();$('auto-view').onclick=()=>board.resetView();$('effects').onchange=()=>board.setEffects($('effects').checked);$('sound').onchange=()=>board.setSound($('sound').checked);$('battle-camera').onchange=()=>board.setCinemaOptions({battleCamera:$('battle-camera').checked});$('fast-animation').onchange=()=>board.setCinemaOptions({fast:$('fast-animation').checked});
 $('create').onclick=()=>action('','POST',{mode:'multiplayer',timeControl:$('time-control').value,requestId:RoomGoblinChessUI.requestId()});$('computer').onclick=()=>action('','POST',{mode:'computer',difficulty:$('difficulty').value,timeControl:$('time-control').value,requestId:RoomGoblinChessUI.requestId()});$('solo').onclick=()=>action('','POST',{mode:'solo',timeControl:'none',requestId:RoomGoblinChessUI.requestId()});$('refresh').onclick=pull;
 window.addEventListener('roomgoblin:ready',()=>{if(retired)return;ready=true;$('create').disabled=review||paused;$('computer').disabled=review||paused;$('solo').disabled=review||paused;$('refresh').disabled=false;render();saveCredential();pull();refreshLeaderboard();});
 window.addEventListener('roomgoblin:credential',saveCredential);
 window.addEventListener('roomgoblin:status',e=>{if(!retired)$('status').textContent=e.detail.message;});
 window.addEventListener('roomgoblin:identity-changed',retireActor);
 window.addEventListener('roomgoblin:control',e=>{if(retired)return;paused=!!e.detail.paused;$('create').disabled=review||paused;$('computer').disabled=review||paused;$('solo').disabled=review||paused;render();});
 window.addEventListener('online',()=>{pull();refreshLeaderboard();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){pull();refreshLeaderboard();}});
 window.addEventListener('pagehide',()=>{if(!review&&sameActor()){saveCredential();set(modern?'cmi.exit':'cmi.core.exit','suspend');commit();api?.[modern?'Terminate':'LMSFinish']('');}retired=true;RoomGoblinChessUI.closeConfirmation();coach.destroy();board.destroy();});
 setInterval(()=>{if(ready&&sameActor()&&!review&&!document.hidden)sdk.request('/activities/'+cfg.activityId+'/chess/heartbeat','POST').catch(()=>{});},10000);
 setInterval(pull,2500);setInterval(refreshLeaderboard,12000);
}
init();
})();
