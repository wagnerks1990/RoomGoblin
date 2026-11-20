/* Original offline square practice. No game API, identity, grade or storage access. */
(()=>{
 'use strict';
 const squares=Array.from({length:64},(_,i)=>'abcdefgh'[i%8]+(8-Math.floor(i/8)));
 const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
 class Vision{
  constructor(container){
   this.root=container;this.destroyed=false;this.running=false;this.paused=false;this.timer=null;this.attempts=0;this.correct=0;this.target=null;this.focusSquare='a8';this.remaining=null;this.deadline=null;
   this.root.classList.add('rg-chess-vision');this.root.replaceChildren();
   const heading=node('h3','Square finder'),intro=node('p','Find the named square on an empty board. Turn the board around to practice from either side. This exercise does not suggest moves in your game.');
   const controls=node('div',undefined,'vision-options');
   this.orientation=node('select');for(const [value,label]of [['white','White at bottom'],['black','Black at bottom']]){const option=node('option',label);option.value=value;this.orientation.append(option);}this.orientation.setAttribute('aria-label','Practice board orientation');
   this.duration=node('select');for(const [value,label]of [['0','Untimed'],['30','30 seconds'],['60','60 seconds']]){const option=node('option',label);option.value=value;this.duration.append(option);}this.duration.setAttribute('aria-label','Practice round length');
   const orientationLabel=node('label','View ');orientationLabel.append(this.orientation);const durationLabel=node('label','Round ');durationLabel.append(this.duration);
   this.coordinates=node('input');this.coordinates.type='checkbox';this.coordinates.checked=true;const coordinateLabel=node('label','');coordinateLabel.append(this.coordinates,document.createTextNode(' Show square names'));
   controls.append(orientationLabel,durationLabel,coordinateLabel);
   this.prompt=node('p','Press Start to find your first square.','vision-prompt');this.prompt.setAttribute('aria-live','polite');this.prompt.setAttribute('aria-atomic','true');
   this.board=node('div',undefined,'vision-board');this.board.setAttribute('role','group');this.board.setAttribute('aria-label','Square finder practice board');this.cells=new Map();
   for(const square of squares){const cell=node('button',undefined,'vision-square');cell.type='button';cell.dataset.square=square;cell.tabIndex=square===this.focusSquare?0:-1;cell.setAttribute('aria-label',square);cell.setAttribute('aria-disabled','true');const file=square.charCodeAt(0)-97,rank=Number(square[1]);cell.classList.add((file+rank)%2?'dark':'light');cell.append(node('span',square,'vision-square-name'));this.board.append(cell);this.cells.set(square,cell);}
   this.feedback=node('p','Use a mouse, touch, or arrow keys and Enter to choose a square.','vision-feedback');this.feedback.setAttribute('role','status');this.feedback.setAttribute('aria-live','polite');
   this.clock=node('p','Untimed practice','vision-clock');this.clock.setAttribute('aria-live','off');
   this.results=node('p',undefined,'vision-results');
   const actions=node('div',undefined,'vision-actions');this.startButton=node('button','Start practice');this.pauseButton=node('button','Pause');this.stopButton=node('button','Stop');this.resetButton=node('button','Reset results');
   for(const button of [this.startButton,this.pauseButton,this.stopButton,this.resetButton]){button.type='button';actions.append(button);}
   this.root.append(heading,intro,controls,this.prompt,this.board,this.feedback,this.clock,actions,this.results,node('p','Results stay in this open practice panel only. They are not grades, game results, leaderboard points or a chess rating.','vision-note'));
   this.click=e=>{const cell=e.target.closest('button[data-square]');if(cell&&this.board.contains(cell))this.choose(cell.dataset.square);};
   this.key=e=>this.navigate(e);this.focus=e=>{const square=e.target.closest('[data-square]')?.dataset.square;if(square)this.setFocus(square);};
   this.visibility=()=>{if(document.hidden)this.pause('Practice paused while this page is hidden. Select Resume when you are ready.');};
   this.board.addEventListener('click',this.click);this.board.addEventListener('keydown',this.key);this.board.addEventListener('focusin',this.focus);document.addEventListener('visibilitychange',this.visibility);
   this.startButton.onclick=()=>this.start();this.pauseButton.onclick=()=>this.paused?this.resume():this.pause();this.stopButton.onclick=()=>this.stop();this.resetButton.onclick=()=>this.reset();
   this.orientation.onchange=()=>this.renderOrientation();this.coordinates.onchange=()=>this.board.classList.toggle('hide-square-names',!this.coordinates.checked);this.duration.onchange=()=>this.paint();
   this.paint();
  }
  getStats(){return {attempts:this.attempts,correct:this.correct,running:this.running,paused:this.paused,remainingSeconds:this.remaining===null?null:Math.ceil(this.remaining/1000)};}
  visible(){return !document.hidden&&!!this.root.getClientRects().length;}
  clearTimer(){if(this.timer!==null)clearInterval(this.timer);this.timer=null;}
  armTimer(){this.clearTimer();this.timer=setInterval(()=>this.tick(),250);}
  start(){
   if(this.destroyed||this.running)return;
   this.running=true;this.paused=false;const seconds=Number(this.duration.value);this.remaining=[30,60].includes(seconds)?seconds*1000:null;this.deadline=this.remaining===null?null:performance.now()+this.remaining;
   this.feedback.textContent='Find the square named above. A wrong answer keeps the same target so you can try again.';this.nextTarget();this.paint();this.armTimer();
   if(!this.visible())this.pause('Practice paused while hidden. Select Resume when you are ready.');
  }
  pause(message='Practice paused. Select Resume when you are ready.'){
   if(this.destroyed||!this.running||this.paused)return;
   if(this.deadline!==null)this.remaining=Math.max(0,this.deadline-performance.now());
   if(this.remaining===0){this.stop('Round complete. Start another round whenever you are ready.');return;}
   this.paused=true;this.deadline=null;this.clearTimer();this.feedback.textContent=message;this.paint();
  }
  resume(){
   if(this.destroyed||!this.running||!this.paused||!this.visible())return;
   this.paused=false;this.deadline=this.remaining===null?null:performance.now()+this.remaining;this.feedback.textContent='Practice resumed. Find '+this.target+'.';this.paint();this.armTimer();
  }
  stop(message='Practice stopped. Your results remain here until Reset or closing this panel.'){
   if(this.destroyed)return;this.clearTimer();this.running=false;this.paused=false;this.deadline=null;this.target=null;this.prompt.textContent='Press Start when you want another square.';this.feedback.textContent=message;this.clearMarks();this.paint();
  }
  reset(){
   if(this.destroyed)return;this.stop('Results reset. Take your time and practice again when you are ready.');this.attempts=0;this.correct=0;this.remaining=null;this.paint();
  }
  tick(){
   if(this.destroyed||!this.running||this.paused){this.clearTimer();return;}
   if(!this.visible()){this.pause('Practice paused while hidden. Select Resume when you are ready.');return;}
   if(this.deadline!==null){this.remaining=Math.max(0,this.deadline-performance.now());if(this.remaining===0){this.stop('Round complete. Start another round whenever you are ready.');return;}this.paintClock();}
  }
  nextTarget(){let index=Math.floor(Math.random()*squares.length);if(squares[index]===this.target)index=(index+1)%squares.length;this.target=squares[index];this.prompt.textContent='Find '+this.target;}
  clearMarks(){for(const cell of this.cells.values())cell.classList.remove('last-correct','last-wrong');}
  choose(square){
   if(this.destroyed||!this.running||this.paused||!this.cells.has(square))return;this.tick();if(!this.running||this.paused)return;
   this.attempts++;this.clearMarks();const correct=square===this.target;this.cells.get(square).classList.add(correct?'last-correct':'last-wrong');
   if(correct){this.correct++;this.feedback.textContent='Correct: '+square+'. Find the next named square.';this.nextTarget();}
   else this.feedback.textContent='You selected '+square+'. Find '+this.target+': file '+this.target[0]+' and rank '+this.target[1]+'. Try again.';
   this.paint();
  }
  setFocus(square){this.focusSquare=square;for(const [name,cell]of this.cells)cell.tabIndex=name===square?0:-1;}
  navigate(event){
   const cell=event.target.closest('[data-square]');if(!cell)return;const order=[...this.board.children],index=order.indexOf(cell);if(index<0)return;let next=index;
   if(event.key==='ArrowLeft'&&index%8>0)next--;
   else if(event.key==='ArrowRight'&&index%8<7)next++;
   else if(event.key==='ArrowUp'&&index>=8)next-=8;
   else if(event.key==='ArrowDown'&&index<56)next+=8;
   else if(event.key==='Home')next=event.ctrlKey?0:Math.floor(index/8)*8;
   else if(event.key==='End')next=event.ctrlKey?63:Math.floor(index/8)*8+7;
   else if(event.key==='Escape'){event.preventDefault();this.pause();return;}
   else if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
   event.preventDefault();this.setFocus(order[next].dataset.square);order[next].focus();
  }
  renderOrientation(){const order=this.orientation.value==='black'?[...squares].reverse():squares;for(const square of order)this.board.append(this.cells.get(square));this.board.setAttribute('aria-label','Square finder practice board, '+(this.orientation.value==='black'?'Black':'White')+' at bottom');}
  paintClock(){this.clock.textContent=this.remaining===null?'Untimed practice':Math.ceil(this.remaining/1000)+' seconds remaining'+(this.paused?' · Paused':'');}
  paint(){
   if(this.destroyed)return;this.startButton.disabled=this.running;this.pauseButton.disabled=!this.running;this.pauseButton.textContent=this.paused?'Resume':'Pause';this.stopButton.disabled=!this.running;this.duration.disabled=this.running;
   for(const cell of this.cells.values())cell.setAttribute('aria-disabled',String(!this.running||this.paused));
   this.results.textContent=this.correct+' correct / '+this.attempts+' attempts'+(this.attempts?' · '+Math.round(this.correct/this.attempts*100)+'% accuracy':'');this.paintClock();
  }
  destroy(){
   if(this.destroyed)return;this.clearTimer();this.destroyed=true;this.running=false;this.paused=false;this.target=null;this.deadline=null;this.remaining=null;this.attempts=0;this.correct=0;
   document.removeEventListener('visibilitychange',this.visibility);this.board.removeEventListener('click',this.click);this.board.removeEventListener('keydown',this.key);this.board.removeEventListener('focusin',this.focus);
   this.startButton.onclick=this.pauseButton.onclick=this.stopButton.onclick=this.resetButton.onclick=null;this.orientation.onchange=this.coordinates.onchange=this.duration.onchange=null;this.root.replaceChildren();this.root.classList.remove('rg-chess-vision');this.cells.clear();
  }
 }
 window.RGChessVision=Vision;
})();
