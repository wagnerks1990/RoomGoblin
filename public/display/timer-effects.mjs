// Presentation only. Deadlines, scheduler state, media and room audio remain owned
// by their existing components. Geometry and font fitting stay in layout.mjs.
export function createTimerEffects({stage,overlay,label,value,requestLayout,format,preview=false,canSound=()=>true,storage}){
  const model=globalThis.RoomGoblinTimerEffects,region=overlay.parentElement;
  const message=document.createElement('span'),track=document.createElement('div'),progress=document.createElement('div'),dimmer=document.createElement('div');
  message.id='timerMessage';track.id='timerTrack';progress.id='timerProgress';dimmer.id='timerDimmer';track.append(progress);overlay.append(message,track);stage.append(dimmer);
  message.hidden=true;track.hidden=true;
  let identity='',previous=null,visualKey='',finishTask=null,fadeTask=null,audio=null,utterance=null,seen=new Set(),records={},lastVisual=null,fallbackEndAt=0;
  const storeKey='roomgoblin.timer-effects.seen.v1';
  try{storage??=globalThis.sessionStorage;records=JSON.parse(storage?.getItem(storeKey)||'{}');if(!records||typeof records!=='object'||Array.isArray(records))records={}}catch{records={}}
  function persist(){records[identity]=[...seen].slice(-9);const entries=Object.entries(records).slice(-48);records=Object.fromEntries(entries);try{storage?.setItem(storeKey,JSON.stringify(records))}catch{}}
  function stopSound(){if(audio){audio.close().catch(()=>{});audio=null}if(utterance){globalThis.speechSynthesis?.cancel();utterance=null}}
  function sound(kind,spoken,volume){
    if(kind==='none'||!volume||preview||!canSound()||document.hidden)return;
    stopSound();
    if(kind==='speak'){
      if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance)return;
      utterance=new SpeechSynthesisUtterance(String(spoken||'Time remaining').slice(0,160));utterance.volume=volume;utterance.rate=1;const cueUtterance=utterance;cueUtterance.onend=()=>{if(utterance===cueUtterance)utterance=null};cueUtterance.onerror=()=>{if(utterance===cueUtterance)utterance=null};speechSynthesis.speak(cueUtterance);return;
    }
    try{const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return;const context=audio=new Context();context.resume().then(()=>{if(audio!==context||!canSound()||document.hidden){context.close().catch(()=>{});return}const at=context.currentTime;for(const [i,f]of (kind==='bell'?[880,1320]:[660,880]).entries()){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=f;gain.gain.setValueAtTime(0,at+i*.18);gain.gain.linearRampToValueAtTime(volume*.3,at+i*.18+.02);gain.gain.exponentialRampToValueAtTime(.001,at+i*.18+.5);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(at+i*.18);oscillator.stop(at+i*.18+.52)}setTimeout(()=>{if(audio===context)audio=null;context.close().catch(()=>{})},1100)}).catch(()=>{context.close().catch(()=>{});if(audio===context)audio=null})}catch{stopSound()}
  }
  function clear(){clearTimeout(finishTask);clearTimeout(fadeTask);finishTask=fadeTask=null;stopSound();overlay.removeAttribute('data-timer-style');overlay.removeAttribute('data-timer-phase');region.removeAttribute('data-timer-reduced');overlay.style.removeProperty('--timer-cue');overlay.style.removeProperty('--timer-progress');overlay.style.removeProperty('opacity');overlay.classList.remove('timer-cue');value.classList.remove('timer-digit-cue');overlay.style.animation='';message.hidden=true;track.hidden=true;dimmer.style.opacity='0';visualKey='';lastVisual=null;}
  function paint(timer,seconds){
    let state;try{state=model.resolve(timer,seconds)}catch{state=null}
    if(!state||!timer.visible){if(lastVisual)clear();return timer}
    const {effects:e,stage:s}=state,now=Date.now(),key=String(timer.automationOccurrence||timer.timerInstanceId||timer.endAt||'timer').slice(0,240)+':'+String(timer.effectsEndAt||timer.endAt||'');
    const changedIdentity=identity!==key;
    if(changedIdentity){clear();identity=key;seen=new Set(Array.isArray(records[key])?records[key]:[]);previous=null;fallbackEndAt=0}
    if(seconds<=0&&!timer.effectsEndAt&&!timer.endAt){fallbackEndAt||=now;timer={...timer,effectsEndAt:fallbackEndAt};state=model.resolve(timer,seconds,now)}
    const crossed=previous!==null&&timer.running&&seconds<=previous;
    const currentId=state.stageId;
    if(previous===null){for(const rule of e.stages)if(seconds<=rule.seconds)seen.add(rule.id);if(seconds<=0)seen.add('finished');persist()}
    let cue=false;
    if(crossed&&!seen.has(currentId)&&currentId!=='normal'){
      const threshold=s?.seconds||0,deadline=Number(timer.effectsEndAt||timer.endAt)||0;
      cue=!deadline||Math.abs(now-(deadline-threshold*1000))<3500;
      for(const rule of e.stages)if(seconds<=rule.seconds)seen.add(rule.id);seen.add(currentId);persist();
    }
    const reduced=e.motion!=='full'||matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(cue){
      const motion=s?.effect||'pop';
      if(!reduced&&motion!=='none'){overlay.classList.remove('timer-cue');void overlay.offsetWidth;overlay.dataset.timerMotion=motion;overlay.classList.add('timer-cue')}
      sound(s?.sound||e.finish.sound,s?.message||s?.label||e.finish.message,e.volume);
    }
    if((document.hidden||!canSound())&&(audio||utterance))stopSound();
    overlay.dataset.timerStyle=e.style;overlay.dataset.timerPhase=currentId;overlay.dataset.timerReduced=String(reduced);region.dataset.timerReduced=String(reduced);dimmer.style.transition=reduced?'none':'opacity .6s';
    overlay.style.setProperty('--timer-cue',state.color);overlay.style.setProperty('--timer-progress',String(state.progress));overlay.style.setProperty('--timer-intensity',String(e.intensity));overlay.style.setProperty('--timer-transition',`${e.transitionMs}ms`);
    overlay.style.color=state.color;overlay.style.borderColor=state.color;
    message.textContent=state.message;message.hidden=!state.message;track.hidden=!e.progress;progress.style.width=`${state.progress*100}%`;
    dimmer.style.opacity=state.visible&&state.scale>1?String(e.dim):'0';
    label.textContent=state.label;label.style.display=state.label?'block':'none';
    const nextValue=state.value??format(seconds),digitsChanged=value.textContent!==nextValue;value.textContent=nextValue;
    if(digitsChanged&&e.digitEffect&&!reduced){value.classList.remove('timer-digit-cue');void value.offsetWidth;value.classList.add('timer-digit-cue')}
    const visual={...timer,visible:state.visible,label:state.label,fontSize:Math.min(360,Number(timer.fontSize||64)*state.scale),effectsGeometry:state.geometry,effectsStyle:e.style,effectsMessage:state.message};
    // Leave the fitted region alive during its opacity transition, then hide it.
    // Replayed/expired timers are hidden immediately, without replaying a fade.
    if(state.fade&&!state.visible&&previous!==null&&lastVisual?.visible&&!reduced){visual.visible=true;if(!fadeTask)fadeTask=setTimeout(()=>{fadeTask=null;lastVisual={...visual,visible:false};dimmer.style.opacity='0';requestLayout(lastVisual)},520)}
    const signature=JSON.stringify([state.visible,state.label,state.message,state.value,state.scale,state.geometry,e.style,reduced]);
    lastVisual=visual;
    if(signature!==visualKey){visualKey=signature;requestLayout(visual)}
    if(seconds<=0&&state.visible&&e.finish.behavior==='fade'&&!finishTask){const end=Number(timer.effectsEndAt||timer.endAt)||now,delay=Math.max(0,end+e.finish.seconds*1000-now);finishTask=setTimeout(()=>{finishTask=null;paint({...timer,running:false},0)},Math.min(120000,delay+20))}
    overlay.style.opacity=state.visible?'1':'0';
    previous=seconds;return visual;
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopSound()});
  new MutationObserver(()=>{if((audio||utterance)&&!canSound())stopSound()}).observe(stage,{childList:true,subtree:true});
  return {paint,clear};
}
