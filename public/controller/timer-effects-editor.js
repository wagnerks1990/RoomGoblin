"use strict";
(() => {
 const model=RoomGoblinTimerEffects;
 const node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 window.createTimerEffectsEditor=(host,initial,{base=()=>({}),presets=()=>[],savePreset,deletePreset}={})=>{
  let data=model.normalize(initial),previewFrame=null,previewJobs=[];
  if(!data.enabled&&!data.stages.length)data={...data,stages:model.preset('lesson').stages};
  const notifyChange=()=>host.dispatchEvent(new Event('change',{bubbles:true}));
  function input(parent,title,owner,key,{type='text',options,min,max,step}={}){
   const wrap=node('label',title),n=node(options?'select':type==='textarea'?'textarea':'input');n.setAttribute('aria-label',title);
   if(options)for(const [v,t]of options){const o=node('option',t);o.value=v;n.append(o)}else if(type!=='textarea')n.type=type;
   if(type==='checkbox')n.checked=!!owner[key];else n.value=owner[key]??'';
   for(const [k,v]of Object.entries({min,max,step}))if(v!==undefined)n[k]=v;
   n.addEventListener('input',()=>{owner[key]=type==='checkbox'?n.checked:['number','range'].includes(type)?Number(n.value):n.value});wrap.append(n);parent.append(wrap);return n;
  }
  const select=items=>items.map(x=>[x,x.replaceAll('-',' ')]);
  function button(parent,title,fn){const b=node('button',title);b.type='button';b.addEventListener('click',fn);parent.append(b);return b}
  function details(parent,title,open=false){const d=node('details');d.open=open;d.append(node('summary',title));const content=node('div');content.className='timerEffectsFields';d.append(content);parent.append(d);return content}
  function stop(){previewJobs.forEach(clearTimeout);previewJobs=[]}
  function read(){return model.normalize(data)}
  function draw(){
   stop();host.replaceChildren();host.className='timerEffectsEditor';
   input(host,'Enable staged timer effects',data,'enabled',{type:'checkbox'});
   const content=node('div');content.hidden=!data.enabled;host.append(content);
   host.firstElementChild.querySelector('input').addEventListener('change',()=>content.hidden=!data.enabled);
   const bar=node('div');bar.className='toolbar';content.append(bar);const pickOwner={preset:'lesson'};
   const pick=input(bar,'Timer effect preset',pickOwner,'preset',{options:[['lesson','Classroom glow'],['broadcast','Broadcast strip'],['ring','Progress ring'],['calm','Calm / no motion'],...presets().map(p=>[p.id,p.name])]});
   button(bar,'Apply timer preset',()=>{try{const saved=presets().find(p=>p.id===pick.value);data=model.normalize(saved?saved.effects:model.preset(pick.value));draw();notifyChange()}catch(e){status.textContent=e.message}});
   const look=details(content,'Appearance & position',true);
   input(look,'Timer style',data,'style',{options:select(model.STYLES)});input(look,'Timer anchor',data,'anchor',{options:select(model.ANCHORS)});
   for(const [label,key,min,max]of [['Timer horizontal position (%)','x',0,98],['Timer vertical position (%)','y',0,98],['Timer width (%)','width',12,96],['Timer height (%)','height',8,90]])input(look,label,data,key,{type:'number',min,max,step:1});
   input(look,'Show remaining-time progress',data,'progress',{type:'checkbox'});input(look,'Animate changing digits',data,'digitEffect',{type:'checkbox'});
   input(look,'Motion preference',data,'motion',{options:[['full','Full effects'],['reduced','Reduced motion'],['off','No motion']]});input(look,'Effect intensity',data,'intensity',{type:'number',min:.25,max:2,step:.25});input(look,'Resize transition (ms)',data,'transitionMs',{type:'number',min:100,max:2000,step:50});input(look,'Dim content under enlarged timer (0–0.7)',data,'dim',{type:'number',min:0,max:.7,step:.05});input(look,'Cue volume (0–0.5)',data,'volume',{type:'number',min:0,max:.5,step:.05});
   content.append(node('h3','Countdown stages'));
   const list=node('div');content.append(list);
   data.stages.forEach((stage,index)=>{
    const group=details(list,`${stage.seconds/60} minutes · ${stage.label||stage.effect}`),prefix=`Stage ${index+1} · `,minutes={minutes:stage.seconds/60};
    input(group,prefix+'Threshold (minutes)',minutes,'minutes',{type:'number',min:1/60,max:1440,step:1/60}).addEventListener('input',()=>stage.seconds=Math.round(minutes.minutes*60));
    input(group,prefix+'Label',stage,'label');input(group,prefix+'Message',stage,'message');input(group,prefix+'Color',stage,'color',{type:'color'});
    input(group,prefix+'Size multiplier',stage,'scale',{type:'number',min:1,max:4,step:.25});input(group,prefix+'Enlarge for seconds (0 = until next stage)',stage,'largeSeconds',{type:'number',min:0,max:120});
    input(group,prefix+'Position',stage,'anchor',{options:select(model.ANCHORS)});input(group,prefix+'Effect',stage,'effect',{options:select(model.MOTIONS)});input(group,prefix+'Sound',stage,'sound',{options:select(model.SOUNDS)});
    button(group,'Remove stage',()=>{data.stages.splice(index,1);draw();notifyChange()});
   });
   const add=button(content,'+ Countdown stage',()=>{const used=new Set(data.stages.map(s=>s.seconds));let seconds=60;while(used.has(seconds))seconds+=60;data.stages.push({id:`stage-${Date.now().toString(36)}`,seconds,color:'#ffd56a',scale:1,largeSeconds:0,anchor:'inherit',effect:'pulse',label:'',message:'',sound:'none'});draw();notifyChange()});add.disabled=data.stages.length>=8;
   const finish=details(content,'When the countdown ends');
   input(finish,'Finish behavior',data.finish,'behavior',{options:[['hold','Hold 00:00'],['message','Show a message'],['hide','Hide timer'],['fade','Show message, then fade']]});input(finish,'Finish message',data.finish,'message');input(finish,'Finish label',data.finish,'label');input(finish,'Fade after seconds',data.finish,'seconds',{type:'number',min:0,max:120});input(finish,'Finish color',data.finish,'color',{type:'color'});input(finish,'Finish sound',data.finish,'sound',{options:select(model.SOUNDS)});
   content.append(node('p','Cues play once when the live countdown crosses a threshold. Reconnects restore the current look silently. Sounds are optional, may be blocked by the browser, and are suppressed during video/stream playback. A finish message never dismisses students or starts another automation.'));
   const tools=node('div');tools.className='toolbar';content.append(tools);
   button(tools,'Preview timer effects',()=>preview());
   const owner={name:''};input(tools,'Save timer preset as',owner,'name');
   const status=node('p');status.setAttribute('role','status');content.append(status);
   if(savePreset)button(tools,'Save timer preset',async()=>{try{if(!owner.name.trim())throw Error('Name the timer preset');await savePreset(owner.name.trim(),read());for(const p of presets())if(![...pick.options].some(o=>o.value===p.id)){const option=node('option',p.name);option.value=p.id;pick.append(option)}status.textContent='Timer preset saved. Existing automation timers are unchanged until you apply it.'}catch(e){status.textContent=e.message}});
   if(deletePreset)button(tools,'Delete selected saved preset',async()=>{try{const selected=presets().find(p=>p.id===pick.value);if(!selected)throw Error('Choose a saved preset first');if(!confirm(`Delete saved preset "${selected.name}"? Automation timers keep their own copies.`))return;await deletePreset(selected.id);[...pick.options].find(o=>o.value===selected.id)?.remove();status.textContent='Saved preset deleted. Automation timers are unchanged.'}catch(e){status.textContent=e.message}});
   const previewHost=node('div');previewHost.className='timerEffectsPreview';content.append(previewHost);
   function preview(){
    try{
     let effects=read(),secondsShown=600;const devices=Object.entries(S.displayDevices||{}).filter(([,d])=>d.enabled!==false);if(!devices.length)throw Error('Configure a display before opening the receiver preview');
     stop();previewHost.replaceChildren();const controls=node('div');controls.className='toolbar';previewHost.append(controls);
     const iframe=previewFrame=node('iframe');iframe.title='Timer effects receiver preview';iframe.src=`/display/${encodeURIComponent(devices[0][0])}?preview=1&timerPreview=1`;
     const placement=node('div');placement.className='timerEffectsPlacement';placement.append(iframe);previewHost.append(placement);
     const guide=button(placement,'Move timer',()=>{});guide.className='timerPlacementHandle';guide.setAttribute('aria-label','Move timer on preview');
     function guideAt(seconds){const resolved=model.resolve({...base(),visible:true,effects:read()},seconds),g=resolved?.geometry;if(g)Object.assign(guide.style,{left:g.x+'%',top:g.y+'%',width:g.w+'%',height:g.h+'%'})}
     const send=(seconds,run=true)=>{secondsShown=seconds;effects=read();guideAt(seconds);const now=Date.now(),timer={...base(),visible:true,mode:'countdown',running:run,durationSeconds:600,remainingSeconds:seconds,endAt:now+seconds*1000,effectsEndAt:now+seconds*1000,timerInstanceId:`preview-${now}`,effects};iframe.contentWindow?.postMessage({type:'roomgoblin.preview.state',state:{background:{color:'#0b2018'},textOptions:{scene:{background:'#0b2018',layers:[{id:'heading',type:'text',text:'Full-screen content stays in place',x:5,y:8,w:90,h:15,fontSize:80,bold:true}]}},timer}},location.origin);if(run)previewJobs.push(setTimeout(()=>{secondsShown=Math.max(0,seconds-2);guideAt(secondsShown)},1400))};
     function move(x,y){stop();const state=model.resolve({...base(),visible:true,effects:read()},secondsShown),g=state.geometry;if(state.stage)state.stage.anchor='custom';const current=data.stages.find(s=>s.id===state.stageId);if(current)current.anchor='custom';else data.anchor='custom';data.x=Math.max(0,Math.min(98-g.w,x));data.y=Math.max(0,Math.min(98-g.h,y));for(const [label,value]of [['Timer horizontal position (%)',data.x],['Timer vertical position (%)',data.y],['Timer anchor',data.anchor]]){const n=host.querySelector(`[aria-label="${label}"]`);if(n)n.value=String(value)}send(secondsShown,false);notifyChange()}
     let drag=null;guide.addEventListener('pointerdown',event=>{const box=placement.getBoundingClientRect();drag={x:event.clientX,y:event.clientY,left:parseFloat(guide.style.left),top:parseFloat(guide.style.top),width:box.width,height:box.height};guide.setPointerCapture(event.pointerId);event.preventDefault()});
     guide.addEventListener('pointermove',event=>{if(drag)move(drag.left+(event.clientX-drag.x)/drag.width*100,drag.top+(event.clientY-drag.y)/drag.height*100)});guide.addEventListener('pointerup',()=>drag=null);guide.addEventListener('pointercancel',()=>drag=null);
     guide.addEventListener('keydown',event=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;event.preventDefault();const step=event.shiftKey?5:1;move(parseFloat(guide.style.left)+delta[0]*step,parseFloat(guide.style.top)+delta[1]*step)});
     button(controls,'Normal timer',()=>{stop();send(600)});
     for(const s of effects.stages)button(controls,`Preview ${s.seconds/60} minutes`,()=>{stop();send(s.seconds+1)});
     button(controls,'Preview finish',()=>{stop();send(1)});
     button(controls,'Play threshold sequence',()=>{stop();send(600);effects.stages.forEach((s,i)=>previewJobs.push(setTimeout(()=>send(s.seconds+1),1500+i*4000)));previewJobs.push(setTimeout(()=>send(1),2000+effects.stages.length*4000))});
     iframe.addEventListener('load',()=>send(600));
     previewHost.append(node('p','Drag the outlined timer to position it, or focus Move timer and use arrow keys (Shift moves faster). Silent receiver preview only. Stage buttons start one second before the threshold; the sequence skips ahead between stages. No display commands are sent.'));
    }catch(error){status.textContent=error.message}
   }
  }
  draw();return {read,stop,dispose:()=>{stop();previewFrame?.remove()}};
 };
})();
