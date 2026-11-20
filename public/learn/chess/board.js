/* Shared, offline-packaged chess interaction. The server owns legal moves. */
(()=>{
 'use strict';
 const glyph={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
 const color=p=>p&&p!=='.'?(p===p.toUpperCase()?'white':'black'):null;
 const pieces=fen=>fen.split(' ')[0].split('/').flatMap(row=>[...row.replace(/[1-8]/g,n=>'.'.repeat(+n))]);
 const coords=Array.from({length:64},(_,i)=>'abcdefgh'[i%8]+(8-Math.floor(i/8)));
 const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const scriptUrl=document.currentScript?.src||document.baseURI;
 const make=(tag,text)=>{const n=document.createElement(tag);n.textContent=String(text??'');return n;};
 const number=n=>Number.isFinite(Number(n))?Number(n):0;
 const average=n=>n===null||n===undefined?'—':number(n).toFixed(1);
 let activeConfirmation=null,confirmationId=0;const leaderboardCache=new WeakMap(),drawCache=new WeakMap();
 const resultText=m=>m.status!=='finished'?'':m.reason==='queue expired'?'WAITING REQUEST EXPIRED · Start a new queue':m.reason==='queue cancelled'?'QUEUE CANCELLED':m.reason==='practice ended'?'PRACTICE ENDED':!m.result?'GAME CLOSED · '+m.reason:m.result==='draw'?'DRAW · '+m.reason:(m.reason==='checkmate'?'CHECKMATE · ':['resignation','forfeit'].includes(m.reason)?'FORFEIT · ':m.reason==='timeout'?'TIME OUT · ':'')+(m.result==='white'?'White':'Black')+' wins';
 class Board{
  constructor(root,{onMove,topPlayer,bottomPlayer,status,promotion,onViewChange}={}){
   Object.assign(this,{root,onMove,topPlayer,bottomPlayer,status,promotion,onViewChange});
   this.alive=true;this.epoch=0;this.cinematicMode=false;this.battleCamera=false;this.fastAnimations=false;this.clockReceived=0;this.clockSource=null;
   this.view='auto';this.selected='';this.cells=new Map();this.effects=true;this.sound=false;this.timers=new Set();
   root.classList.add('rg-chess-board');root.setAttribute('role','group');root.setAttribute('aria-label','Interactive chessboard');
   root.replaceChildren();
   for(const square of coords){
    const cell=document.createElement('button');cell.type='button';cell.dataset.square=square;cell.className='sq';cell.tabIndex=-1;cell.setAttribute('aria-disabled','true');
    const piece=document.createElement('span');piece.className='piece';piece.setAttribute('aria-hidden','true');cell.append(piece);
    const label=document.createElement('span');label.className='coordinate';label.setAttribute('aria-hidden','true');cell.append(label);
    this.cells.set(square,cell);root.append(cell);
   }
   root.addEventListener('click',e=>{const square=e.target.closest('[data-square]')?.dataset.square;if(square&&!this.suppressClick)this.choose(square);});
   root.addEventListener('pointerdown',e=>this.down(e));
   root.addEventListener('pointermove',e=>this.drag(e));
   root.addEventListener('pointerup',e=>this.up(e));
   root.addEventListener('pointercancel',()=>this.cancelDrag());
   root.addEventListener('lostpointercapture',e=>{if(e.target===root)this.cancelDrag();});
   root.addEventListener('focusin',e=>{const square=e.target.closest('[data-square]')?.dataset.square;if(square){this.focusSquare=square;for(const [id,cell]of this.cells)cell.tabIndex=id===square?0:-1;}});
   root.addEventListener('keydown',e=>{
    if(e.key==='Escape'){this.selected='';this.paintSelection();this.cancelDrag();return;}
    const cells=[...root.children],index=cells.indexOf(e.target.closest('[data-square]'));if(index<0)return;
    const row=Math.floor(index/8),col=index%8;let next=index;
    if(e.key==='ArrowLeft')next=row*8+Math.max(0,col-1);else if(e.key==='ArrowRight')next=row*8+Math.min(7,col+1);else if(e.key==='ArrowUp')next=Math.max(0,row-1)*8+col;else if(e.key==='ArrowDown')next=Math.min(7,row+1)*8+col;else if(e.key==='Home')next=e.ctrlKey?0:row*8;else if(e.key==='End')next=e.ctrlKey?63:row*8+7;else return;
    e.preventDefault();cells[next]?.focus();
   });
   this.onBlur=()=>this.cancelDrag();window.addEventListener('blur',this.onBlur);
   this.clockTimer=setInterval(()=>this.paintClocks(),100);
   this.notice=make('p','');this.notice.className='cinema-notice';this.notice.setAttribute('role','status');root.after(this.notice);this.keyHelp=make('p','Keyboard: arrow keys move between squares; Enter or Space selects. Home/End moves along a row; Escape clears selection.');this.keyHelp.className='chess-key-help';root.after(this.keyHelp);
  }
  orientation(){return this.view==='auto'?(this.match?.mode==='solo'?this.match.turn:this.match?.myColor||'white'):this.view;}
  flip(){this.view=this.orientation()==='white'?'black':'white';if(this.match)this.update(this.match,this.options);}
  resetView(){this.view='auto';if(this.match)this.update(this.match,this.options);}
  setCinemaOptions({battleCamera=this.battleCamera,fast=this.fastAnimations}={}){this.battleCamera=!!battleCamera;this.fastAnimations=!!fast;this.paintCinema();}
  setEffects(enabled){this.effects=enabled;this.root.classList.toggle('effects-off',!enabled);if(this.match)this.paintCinema();}
  setSound(enabled){
   this.sound=enabled;
   if(enabled){const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){this.audio??=new Audio();this.audio.resume().catch(()=>{});}}
  }
  tone(capture=false){
   if(!this.sound||!this.audio||document.hidden)return;
   const now=this.audio.currentTime,o=this.audio.createOscillator(),gain=this.audio.createGain();
   o.type='sine';o.frequency.setValueAtTime(capture?220:520,now);o.frequency.exponentialRampToValueAtTime(capture?110:340,now+.1);
   gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+.12);o.connect(gain).connect(this.audio.destination);o.start(now);o.stop(now+.13);o.onended=()=>{o.disconnect();gain.disconnect();};
  }
  later(fn,ms){const timer=setTimeout(()=>{this.timers.delete(timer);fn();},ms);this.timers.add(timer);return timer;}
  update(match,options={}){
   if(!this.alive||!this.cells.size)return;
   const previous=this.match,newGame=previous?.id!==match.id,changed=newGame||previous?.revision!==match.revision;
   if(changed){this.cancelDrag();this.selected='';}if(newGame)this.view='auto';
   this.match=match;this.options=options;if(this.clockSource!==match.clocks){this.clockSource=match.clocks;this.clockReceived=performance.now();}this.position=pieces(match.fen);this.moves=new Set(match.legalMoves||[]);
   this.canMove=!!match.myColor&&match.status==='active'&&(match.mode==='solo'||match.turn===match.myColor)&&!options.disabled&&!this.pending;
   const orientation=this.orientation();this.root.dataset.orientation=orientation;
   this.root.classList.toggle('is-interactive',this.canMove);this.root.classList.toggle('in-check',!!match.inCheck&&match.status==='active');this.root.classList.toggle('is-checkmate',match.reason==='checkmate');
   this.root.setAttribute('aria-busy',String(!!this.pending));this.root.dataset.sync=options.reconnecting?'reconnecting':'live';
   const order=orientation==='black'?[...coords].reverse():coords;
   const focusedSquare=this.root.contains(document.activeElement)?document.activeElement.closest('[data-square]')?.dataset.square:null;
   if(this.drawnOrientation!==orientation){for(const square of order)this.root.append(this.cells.get(square));this.drawnOrientation=orientation;if(focusedSquare)this.cells.get(focusedSquare)?.focus({preventScroll:true});}
   this.focusSquare??=match.myColor==='black'?'e7':'e2';for(const [square,cell]of this.cells)cell.tabIndex=square===this.focusSquare?0:-1;
   const last=match.moves.at(-1)||'';
   for(const [i,square] of coords.entries()){
    const cell=this.cells.get(square),piece=this.position[i],pieceNode=cell.querySelector('.piece');
    cell.classList.toggle('dark',!!((i+Math.floor(i/8))%2));cell.classList.toggle('light',!((i+Math.floor(i/8))%2));
    const isLast=last.slice(0,2)===square||last.slice(2,4)===square;cell.classList.toggle('last-move',isLast);cell.classList.toggle('last-opponent',isLast&&!!match.myColor&&match.mode!=='solo'&&(match.moves.length%2?'white':'black')!==match.myColor);
    cell.classList.toggle('checked-king',!!match.inCheck&&piece===(match.turn==='white'?'K':'k'));
    pieceNode.textContent=piece==='.'?'':glyph[piece.toLowerCase()];pieceNode.dataset.color=color(piece)||'';
    cell.dataset.piece=piece;cell.setAttribute('aria-label',square+' '+(piece==='.'?'empty':color(piece)+' '+({k:'king',q:'queen',r:'rook',b:'bishop',n:'knight',p:'pawn'})[piece.toLowerCase()]));
    cell.setAttribute('aria-disabled',String(!this.canMove));
    const bottom=orientation==='black'?square[1]==='8':square[1]==='1';
    const left=orientation==='black'?square[0]==='h':square[0]==='a';
    cell.querySelector('.coordinate').textContent=(left?square[1]:'')+(bottom?square[0]:'');
   }
   this.paintSelection();this.player(this.topPlayer,orientation==='white'?'black':'white');this.player(this.bottomPlayer,orientation);
   if(this.status){this.status.dataset.state=match.status==='finished'?match.reason:match.inCheck?'check':this.canMove?'your-turn':'waiting';this.status.textContent=match.status==='finished'?resultText(match):this.pending?'Sending your move…':options.disabled?(options.reason||'Read-only view'):match.status==='waiting'?(match.myColor?'Finding your opponent…':'Waiting for a player · Watch or join this game.'):(this.canMove?'Your turn — ':match.myColor?'Opponent’s turn — ':'Watching — ')+(match.turn==='white'?'White':'Black')+(match.inCheck?' · CHECK!':'');}
   this.paintClocks();this.paintCinema();
   if(changed&&!newGame&&match.moves.length>previous.moves.length&&match.moves.length-previous.moves.length<=2){
    const old=pieces(previous.fen),capture=old.filter(p=>p!=='.').length>this.position.filter(p=>p!=='.').length;
    this.tone(capture);
    if(this.effects&&!reduced()){
     const from=this.cells.get(last.slice(0,2))?.getBoundingClientRect(),to=this.cells.get(last.slice(2,4))?.getBoundingClientRect();
     if(from&&to)this.cells.get(last.slice(2,4)).querySelector('.piece').animate?.([{transform:`translate(${from.x-to.x}px,${from.y-to.y}px) scale(1.08)`},{transform:'translate(0,0) scale(1)'}],{duration:180,easing:'ease-out'});
     this.flash(capture?'capture':'move');if(match.inCheck)this.flash('check');
    }
   }
   if(changed&&!newGame&&match.status==='finished'&&previous.status!=='finished'&&match.reason==='checkmate'&&(match.mode==='solo'||!match.myColor||match.result===match.myColor)&&this.effects&&!reduced())this.celebrate();
  }
  player(node,side){
   if(!node)return;const m=this.match,seat=m[side],mine=!!m.myColor&&(m.myColor===side||m.mode==='solo');
   node.replaceChildren();node.className='player-card '+(m.status==='active'&&m.turn===side?'is-turn':'');node.dataset.color=side;
   const avatar=document.createElement('span');avatar.className='player-piece';avatar.textContent='♚';avatar.setAttribute('aria-hidden','true');
   const info=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('span');
   name.textContent=seat?.name||'Waiting for an opponent';detail.textContent=(mine?'YOU · ':m.mode==='computer'&&side==='black'?'COMPUTER · ':'')+side.toUpperCase()+(m.status==='active'&&m.turn===side?' · TO MOVE':'');
   info.append(name,detail);node.append(avatar,info);if(m.clocks){const clock=make('time','');clock.className='chess-clock';clock.dataset.side=side;clock.setAttribute('aria-live','off');node.append(clock);}
  }
  paintSelection(){
   const targets=new Set([...this.moves].filter(m=>m.startsWith(this.selected)&&this.selected).map(m=>m.slice(2,4)));
   for(const [square,cell] of this.cells){cell.classList.toggle('selected',square===this.selected);cell.setAttribute('aria-pressed',String(square===this.selected));cell.setAttribute('aria-description',this.canMove&&targets.has(square)?'Legal destination for the selected piece.':'');cell.classList.toggle('legal-target',this.canMove&&targets.has(square));}
   this.paintCinema();
  }
  own(square){const p=this.position?.[coords.indexOf(square)];return color(p)===this.match?.turn;}
  choose(square){
   if(!this.canMove)return;
   if(this.selected&&square!==this.selected&&[...this.moves].some(m=>m.startsWith(this.selected+square))){this.submit(this.selected,square);return;}
   this.selected=this.own(square)&&this.selected!==square?square:'';this.paintSelection();
  }
  async submit(from,to){
   if(!this.canMove||this.pending)return;
   const base=from+to,promotion=[...this.moves].some(m=>m.startsWith(base)&&m.length===5)?this.promotion?.value||'q':'';
   if(!this.moves.has(base+promotion))return;
   const m=this.match;this.selected='';this.pending=true;this.update(m,this.options);
   try{await this.onMove?.({move:base+promotion,revision:m.revision,matchId:m.id});}
   catch(error){if(this.status)this.status.textContent=error.message||'Your move was not confirmed. Refresh the board before trying again.';}
   finally{this.pending=false;if(this.match)this.update(this.match,this.options);}
  }
  down(e){
   if(e.button!==0||!this.canMove)return;const square=e.target.closest('[data-square]')?.dataset.square;if(!square||!this.own(square))return;
   this.cancelDrag();this.pointer={id:e.pointerId,from:square,x:e.clientX,y:e.clientY,revision:this.match.revision,matchId:this.match.id};
  }
  drag(e){
   const p=this.pointer;if(!p||p.id!==e.pointerId)return;
   if(!this.ghost&&Math.hypot(e.clientX-p.x,e.clientY-p.y)<6)return;
   e.preventDefault();
   if(!this.ghost){
    try{this.root.setPointerCapture(e.pointerId);}catch{this.cancelDrag();return;}
    this.selected=p.from;this.paintSelection();const source=this.cells.get(p.from);source.classList.add('drag-source');
    this.ghost=source.querySelector('.piece').cloneNode(true);this.ghost.classList.add('drag-ghost');const size=source.getBoundingClientRect().width;
    this.ghost.style.width=this.ghost.style.height=size+'px';this.ghost.style.fontSize=size*.76+'px';document.body.append(this.ghost);
   }
   this.ghost.style.left=e.clientX+'px';this.ghost.style.top=e.clientY+'px';
  }
  up(e){
   const p=this.pointer;if(!p||p.id!==e.pointerId)return;const dragged=!!this.ghost;
   const r=this.root.getBoundingClientRect(),col=Math.floor((e.clientX-r.left)/r.width*8),row=Math.floor((e.clientY-r.top)/r.height*8);
   const square=col>=0&&col<8&&row>=0&&row<8?[...this.root.children][row*8+col]?.dataset.square:null;
   this.cancelDrag();if(!dragged)return;
   this.suppressClick=true;this.later(()=>{this.suppressClick=false;},0);
   if(p.revision===this.match.revision&&p.matchId===this.match.id&&square)this.submit(p.from,square);
  }
  cancelDrag(){
   this.ghost?.remove();this.ghost=null;
   for(const cell of this.cells.values())cell.classList.remove('drag-source');
   const p=this.pointer;this.pointer=null;if(p&&this.root.hasPointerCapture?.(p.id))this.root.releasePointerCapture(p.id);
  }
  flash(kind){const cell=this.cells.get(this.match.moves.at(-1)?.slice(2,4));if(cell){cell.classList.remove('effect-move','effect-capture','effect-check');cell.classList.add('effect-'+kind);this.later(()=>cell.classList.remove('effect-'+kind),650);}}
  celebrate(){
   const host=this.root.parentElement;
   for(let i=0;i<18;i++){const bit=document.createElement('i');bit.className='chess-confetti';bit.style.setProperty('--x',(i%6*17)+'%');bit.style.setProperty('--delay',(i%4*.05)+'s');bit.style.setProperty('--drift',((i%5-2)*35)+'px');host.append(bit);this.later(()=>bit.remove(),1400);}
  }
  paintClocks(){
   const clock=this.clockSource;if(!clock||!this.match)return;
   const elapsed=Math.max(0,performance.now()-this.clockReceived);
   for(const node of [this.topPlayer,this.bottomPlayer]){const time=node?.querySelector('.chess-clock');if(!time)continue;const side=time.dataset.side,remaining=Math.max(0,Number(clock[side])-(clock.running===side?elapsed:0));const seconds=Math.ceil(remaining/1000),text=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');const awaiting=remaining===0&&this.match.status==='active'&&clock.running===side,display=clock.unavailable?'Clock temporarily unavailable — awaiting server':awaiting?'0:00 · Awaiting server':text;if(time.textContent!==display)time.textContent=display;time.classList.toggle('awaiting-server',!!clock.unavailable||awaiting);time.classList.toggle('running',clock.running===side);time.classList.toggle('low',clock.running===side&&remaining<30000);time.setAttribute('aria-label',side+' '+display+(this.options?.reconnecting?' · local estimate while reconnecting':''));time.title=this.options?.reconnecting?'Local estimate while reconnecting; the server confirms clock results.':'Server clock with a local countdown estimate.';}
  }
  async setCinematic(enabled){
   this.cancelDrag();this.wantCinema=!!enabled;const epoch=++this.epoch;
   if(!enabled){this.cinema?.destroy();this.cinema=null;this.notice.textContent='';this.cinematicMode=false;this.root.parentElement.classList.remove('cinematic-mode');this.cinemaHost?.setAttribute('hidden','');this.onViewChange?.(false);return false;}
   if(!this.match){this.notice.textContent='Select a game before opening the 3D board.';return false;}
   this.notice.textContent='Opening the 3D arena…';
   try{
    const module=await import(new URL('cinematic/view.mjs',scriptUrl).href);
    if(!this.alive||epoch!==this.epoch||!this.wantCinema)return false;
    if(!this.cinemaHost){this.cinemaHost=make('div','');this.cinemaHost.className='cinema-host';this.cinemaHost.setAttribute('aria-hidden','true');this.root.before(this.cinemaHost);}
    this.cinemaHost.hidden=false;
    if(!this.cinema)this.cinema=new module.ChessCinema(this.cinemaHost,{onSquare:square=>this.choose(square),onFailure:()=>this.cinemaFailed()});
    this.cinematicMode=true;this.root.parentElement.classList.add('cinematic-mode');this.notice.textContent='3D fantasy view · Switch to 2D anytime for keyboard play.';this.paintCinema();this.onViewChange?.(true);return true;
   }catch{if(epoch===this.epoch)this.cinemaFailed();return false;}
  }
  cinemaFailed(){
   this.epoch++;this.wantCinema=false;this.cinematicMode=false;this.cinema?.destroy();this.cinema=null;if(this.cinemaHost)this.cinemaHost.hidden=true;this.root.parentElement.classList.remove('cinematic-mode');this.notice.textContent='3D is unavailable on this device. The 2D board is ready.';this.onViewChange?.(false);
  }
  paintCinema(){
   if(!this.cinematicMode||!this.cinema||!this.match)return;
   const targets=[...new Set([...(this.moves||[])].filter(m=>this.selected&&m.startsWith(this.selected)).map(m=>m.slice(2,4)))];
   try{this.cinema.update(this.match,{orientation:this.orientation(),effects:this.effects&&!reduced(),battleCamera:this.battleCamera,fast:this.fastAnimations,selected:this.selected,targets,disabled:!this.canMove});}catch{this.cinemaFailed();}
  }
  clear(){this.epoch++;this.wantCinema=false;this.cinema?.destroy();this.cinema=null;this.cinemaHost?.remove();this.cinemaHost=null;this.cinematicMode=false;this.root.parentElement.classList.remove('cinematic-mode');this.cancelDrag();this.match=null;this.clockSource=null;this.selected='';this.focusSquare=null;this.root.replaceChildren();this.cells.clear();this.topPlayer?.replaceChildren();this.bottomPlayer?.replaceChildren();this.notice.textContent='';this.keyHelp.textContent='';this.onViewChange?.(false);}
  destroy(){this.alive=false;this.clear();clearInterval(this.clockTimer);for(const timer of this.timers)clearTimeout(timer);this.timers.clear();window.removeEventListener('blur',this.onBlur);this.audio?.close().catch(()=>{});}

 }
 window.RoomGoblinChessBoard=Board;
 window.RoomGoblinChessUI={resultText,
  closeConfirmation(){activeConfirmation?.(false);},
  leaveLabel(m){return m.status==='waiting'?'Cancel queue':m.mode==='multiplayer'?'Forfeit game':'Stop practice';},
  confirmLeave(m){
   if(!m||m.status==='finished'||activeConfirmation)return Promise.resolve(false);
   const queue=m.status==='waiting',practice=m.mode!=='multiplayer',title=queue?'Cancel this queue?':practice?'Stop this practice game?':'Forfeit this game?',description=queue?'This removes your waiting slot. It does not count as a competitive game.':practice?'Stopping closes this practice game. Choose Keep practicing to leave it saved and resumable. Practice results stay separate from multiplayer.':'Forfeiting ends this game and records the server-confirmed result. Your opponent may receive a forfeit win. Choose Keep playing to leave the game saved.',cancel=queue?'Keep waiting':practice?'Keep practicing':'Keep playing';
   return this.confirmAction({title,description,confirmLabel:this.leaveLabel(m),cancelLabel:cancel});
  },
  confirmQueueCleanup(m){if(!m?.canCancelQueue||!m.cleanupClassId||m.status!=='waiting')return Promise.resolve(false);return this.confirmAction({title:'Remove this waiting request?',description:'No game result is recorded. The student can queue again.',confirmLabel:'Remove waiting request',cancelLabel:'Keep waiting request'});},
  confirmAction({title,description,confirmLabel,cancelLabel}){
   if(activeConfirmation)return Promise.resolve(false);
   return new Promise(resolve=>{const previous=document.activeElement,dialog=make('dialog',''),heading=make('h2',title),message=make('p',description),controls=make('div',''),back=make('button',cancelLabel),confirm=make('button',confirmLabel);const id='chess-confirm-'+(++confirmationId);heading.id=id;message.id=id+'-description';dialog.className='chess-confirm';dialog.setAttribute('aria-labelledby',id);dialog.setAttribute('aria-describedby',message.id);back.type=confirm.type='button';confirm.className='danger';controls.append(back,confirm);dialog.append(heading,message,controls);let done=false;const finish=choice=>{if(done)return;done=true;activeConfirmation=null;if(dialog.open)dialog.close();dialog.remove();if(previous?.isConnected&&!previous.disabled)previous.focus({preventScroll:true});else document.getElementById('refresh')?.focus({preventScroll:true});resolve(choice);};activeConfirmation=finish;back.onclick=()=>finish(false);confirm.onclick=()=>finish(true);dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});document.body.append(dialog);if(dialog.showModal){dialog.showModal();back.focus();}else finish(window.confirm(title+' '+description));});
  },
  requestId(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);},
  gameSummary(m){return m.status==='finished'?resultText(m):m.status==='waiting'?'Waiting · '+(m.timeControl==='none'?'Untimed':m.timeControl):m.turn.toUpperCase()+' to move · '+(m[m.turn]?.name||m.turn)+' · '+(m.timeControl==='none'?'Untimed':m.timeControl)+(m.mode==='computer'?' · '+m.difficulty:'');},
  leaderboard(root,data,{practice=true}={}){
   const signature=JSON.stringify(data.players);if(leaderboardCache.get(root)===signature&&root.firstElementChild)return;leaderboardCache.set(root,signature);root.replaceChildren();
   const table=make('table',''),head=make('tr',''),caption=make('caption',"Multiplayer standings · W/L/D = wins/losses/draws · Own-move averages");table.append(caption);const columns=['Rank','Player','Played','Total wins','Checkmate W','Forfeit W','Time W','Total losses','Checkmate L','Forfeit L','Time L','Draws','Win %','Avg game moves','Avg moves / win','Avg moves / mate','Fastest mate','Win streak','Best streak'];if(practice)columns.push('Computer W/L/D','Solo W/L/D');for(const title of columns){const th=make('th',title);th.scope='col';head.append(th);}const thead=make('thead','');thead.append(head);table.append(thead);const body=make('tbody','');
   for(const p of data.players){const row=make('tr','');if(p.me)row.className='is-me';const values=[p.rank,p.label+(p.me?' · YOU':''),p.games,p.wins,p.mateWins||0,p.forfeitWins||0,p.timeoutWins||0,p.losses,p.mateLosses||0,p.forfeitLosses||0,p.timeoutLosses||0,p.draws,p.winRate+'%',average(p.avgGameMoves),average(p.avgMovesPerWin),average(p.avgMovesToMate),p.fastestMate??'—',p.currentWinStreak||0,p.bestWinStreak||0];if(practice)for(const key of ['computerStats','soloStats']){const stats=p[key]||{};values.push((stats.wins||0)+'/'+(stats.losses||0)+'/'+(stats.draws||0));}for(const value of values)row.append(make('td',value));body.append(row);}table.append(body);root.append(table);if(!data.players.length)root.append(make('p','Complete a game to start the leaderboard.'));
  },
  drawControls(root,m,{disabled=false,onAction}={}){
   const signature=JSON.stringify([m?.id,m?.revision,m?.drawOffer,m?.drawClaims,m?.myColor,m?.turn,disabled]);if(drawCache.get(root)===signature)return;drawCache.set(root,signature);root.replaceChildren();
   if(!m||m.status!=='active'||!m.myColor)return;
   const button=(label,body)=>{const b=make('button',label);b.type='button';b.disabled=disabled;b.onclick=()=>onAction({...body,revision:m.revision});root.append(b);return b;};
   if(m.mode==='multiplayer'&&m.moves.length>=2){if(m.drawOffer==='opponent'){root.append(make('span','Your opponent offered a draw.'));button('Accept draw',{action:'accept'});button('Decline draw',{action:'decline'});}else if(m.drawOffer==='you')root.append(make('span','Draw offered · waiting for your opponent.'));else button('Offer draw',{action:'offer'});}
   if(m.mode==='solo'||m.myColor===m.turn){if(m.drawClaims?.repetition)button('Claim repetition draw',{action:'claim',kind:'repetition'});if(m.drawClaims?.fiftyMove)button('Claim 50-move draw',{action:'claim',kind:'fifty-move'});
    const details=make('details',''),summary=make('summary','Claim a draw with an intended move'),label=make('label','Intended move (for example g1f3) '),input=make('input',''),kind=make('select',''),claim=make('button','Submit draw claim');input.type='text';input.maxLength=5;input.pattern='[a-h][1-8][a-h][1-8][qrbn]?';input.autocomplete='off';input.disabled=disabled;label.append(input);for(const [value,text] of [['repetition','Threefold repetition'],['fifty-move','50-move rule']]){const option=make('option',text);option.value=value;kind.append(option);}kind.setAttribute('aria-label','Draw claim type');kind.disabled=disabled;claim.type='button';claim.disabled=disabled;claim.onclick=()=>{if(!input.checkValidity()||!input.value){input.reportValidity();return;}onAction({action:'claim',kind:kind.value,move:input.value.trim().toLowerCase(),revision:m.revision});};details.append(summary,label,kind,claim);root.append(details);
   }
  }
 };

})();
