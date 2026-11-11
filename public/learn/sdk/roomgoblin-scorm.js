/* RoomGoblin SCORM connector. Include after config, before the game's scripts.
 * No credentials. Native LMS calls and their return values remain authoritative. */
(function(root){
 'use strict';
 const cfg=root.ROOMGOBLIN_SCORM;if(!cfg)return;
 const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(v);
 let origin;try{origin=new URL(cfg.origin);if(origin.protocol!=='https:'||origin.origin!==cfg.origin||!uuid(cfg.activityId))return;}catch{return;}
 const key='roomgoblin.scorm.'+cfg.activityId;
 let popup=null,nonce='',learner=null,sequence=0,queue=[],unbound=[],sending=null,button=null,status=null,lastScore=null,lastProgress='',lastResume='',closed=false;
 let campaign=null,grade=null,connectionFrame=null,lastContact=0,reconnectAfter=45000,controlVersion=-1;const arcadeWaiters=new Map(),gradeWaiters=new Map();
 const announce=(type,detail)=>{if(typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent(type,{detail}));};
 function control(command){if(!command||!Number.isInteger(command.version)||command.version===controlVersion||![0,1,false,true].includes(command.paused)||!Number.isInteger(command.stage)||command.stage<1||command.stage>20||typeof command.hint!=='string'||command.hint.length>300)return;controlVersion=command.version;announce('roomgoblin:control',command);}
 const say=text=>{if(status)status.textContent=text;announce('roomgoblin:status',{message:text});};
 const persist=()=>{if(learner)try{root.sessionStorage.setItem(key,JSON.stringify({learner,sequence,queue:queue.slice(-100)}));}catch{say('Keep this assignment open to finish sending progress.');}};
 function emit(kind,data){
  const item={id:root.crypto.randomUUID(),kind,occurredAt:new Date().toISOString(),...data};
  if(!learner){unbound.push(item);unbound=unbound.slice(-100);return item.id;}
  queue.push({...item,learnerKey:learner,sequence:++sequence});queue=queue.slice(-100);persist();pump();return item.id;
 }
 function pump(){
  if(!learner||!popup||popup.closed||!queue.length||closed)return;
  if(sending&&Date.now()-sending.at<10000)return;
  const event=queue[0];sending={id:event.id,at:Date.now()};
  popup.postMessage({type:'roomgoblin.connector.event',activityId:cfg.activityId,nonce,event},origin.origin);
 }
 function connect(){
  const bytes=new Uint8Array(16);root.crypto.getRandomValues(bytes);nonce=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
  learner=null;sending=null;closed=false;lastContact=Date.now();
  const hash=new URLSearchParams({activity:cfg.activityId,nonce,parent:root.location.origin});
  if(cfg.connectionMode==='embedded'){
   hash.set('embedded','1');if(!connectionFrame){connectionFrame=document.createElement('iframe');connectionFrame.title='Schoology connection';connectionFrame.style.cssText='width:100%;height:150px;border:0;background:white;color:black';document.body.append(connectionFrame);}
   connectionFrame.hidden=false;connectionFrame.src=origin.origin+'/learn/connect/#'+hash;popup=connectionFrame.contentWindow;
  }else popup=root.open(origin.origin+'/learn/connect/#'+hash,'roomgoblin-'+cfg.activityId,'width=560,height=680');
  say(popup?'Connecting through Schoology…':'Allow the connection window, then select Connect again.');
  return !!popup;
 }
 root.addEventListener('message',e=>{
  const m=e.data;if(!popup||e.source!==popup||e.origin!==origin.origin||!m||m.nonce!==nonce||m.activityId!==cfg.activityId)return;
  lastContact=Date.now();
  if(m.type==='roomgoblin.connector.control'){control(m.command);return;}
  if(m.type==='roomgoblin.connector.ready'){
   reconnectAfter=45000;controlVersion=-1;control(m.state?.command);
   if(!uuid(m.state?.learnerKey)||!Number.isInteger(m.state.sequence))return;
   learner=m.state.learnerKey;sequence=m.state.sequence;let stored=null;try{stored=JSON.parse(root.sessionStorage.getItem(key));}catch{}
   // Never carry another learner's queued events across a signed identity change.
   queue=stored?.learner===learner&&Array.isArray(stored.queue)?stored.queue.filter(x=>uuid(x.id)&&x.learnerKey===learner&&Number.isInteger(x.sequence)).slice(-100):[];
   sequence=Math.max(sequence,...queue.map(x=>x.sequence),0);
   for(const item of unbound)queue.push({...item,learnerKey:learner,sequence:++sequence});unbound=[];persist();
   campaign=m.state.arcade||null;grade=m.state.grade||null;if(connectionFrame)connectionFrame.hidden=true;
   say('Connected, '+String(m.state.firstName||'Student')+'.');if(button)button.textContent='Reconnect';sending=null;pump();announce('roomgoblin:ready',{arcade:campaign,firstName:m.state.firstName||'Student',progress:m.state.progress||{},grade});
  }else if(m.type==='roomgoblin.connector.saved'&&sending?.id===m.id){
   if(queue.find(item=>item.id===m.id)?.kind==='assessment'){grade=m.state?.grade||null;const waiter=gradeWaiters.get(m.id);if(waiter){clearTimeout(waiter.timer);gradeWaiters.delete(m.id);grade?waiter.resolve(grade):waiter.reject(Error('Automatic grading needs teacher setup.'));}if(grade)announce('roomgoblin:grade',{grade});}
   campaign=m.state?.arcade||campaign;const waiter=arcadeWaiters.get(m.id);if(waiter){clearTimeout(waiter.timer);arcadeWaiters.delete(m.id);waiter.resolve(campaign);}
   queue=queue.filter(item=>item.id!==m.id);sending=null;persist();say(queue.length?'Sending saved progress…':'Progress saved to RoomGoblin.');pump();
  }else if(m.type==='roomgoblin.connector.error'&&sending?.id===m.id){
   say(String(m.message||'RoomGoblin is unavailable. Schoology saving continues.'));
   const waiter=arcadeWaiters.get(m.id);if(waiter){clearTimeout(waiter.timer);arcadeWaiters.delete(m.id);waiter.reject(Error(String(m.message||'Campaign save was not confirmed.')));}
   const gradeWaiter=gradeWaiters.get(m.id);if(gradeWaiter){clearTimeout(gradeWaiter.timer);gradeWaiters.delete(m.id);gradeWaiter.reject(Error(String(m.message||'Grade save is pending.')));}
   if(m.conflict&&queue.find(item=>item.id===m.id)?.kind==='arcade'){queue=queue.filter(item=>item.id!==m.id);sending=null;campaign=null;persist();announce('roomgoblin:conflict',{});}
   if(m.reconnect){learner=null;sending=null;}
  }
 });
 function findApi(){const starts=[root];try{if(root.opener)starts.push(root.opener);}catch{}for(let w of starts)for(let i=0;w&&i<32;i++){try{if(w.API)return {api:w.API,modern:false};if(w.API_1484_11)return {api:w.API_1484_11,modern:true};if(w.parent===w)break;w=w.parent;}catch{break;}}return null;}
 function install(){
  const found=findApi();if(!found)return false;const {api,modern}=found;
  const commit=modern?'Commit':'LMSCommit',finish=modern?'Terminate':'LMSFinish',get=modern?'GetValue':'LMSGetValue',set=modern?'SetValue':'LMSSetValue';
  const values=Object.create(null),read=name=>values[name]??'';
  function snapshot(){
   try{
    const rawText=read(modern?'cmi.score.raw':'cmi.core.score.raw'),scaled=read('cmi.score.scaled'),raw=Number(rawText),minText=read(modern?'cmi.score.min':'cmi.core.score.min'),maxText=read(modern?'cmi.score.max':'cmi.core.score.max');
    let percent=raw;
    if(modern&&scaled!==''&&Number.isFinite(Number(scaled)))percent=Number(scaled)*100;
    else if(minText!==''&&maxText!==''&&Number(maxText)>Number(minText))percent=(raw-Number(minText))*100/(Number(maxText)-Number(minText));
    const completion=read(modern?'cmi.completion_status':'cmi.core.lesson_status'),complete=['completed','passed','failed'].includes(completion),signature=percent+':'+complete;
    if(rawText!==''&&Number.isFinite(percent)&&percent>=0&&percent<=100&&lastScore!==signature){lastScore=signature;emit(complete?'completed':'score',{raw:percent});}
    const location=read(modern?'cmi.location':'cmi.core.lesson_location'),match=String(location).match(cfg.locationFormat==='run:step'?/^\d+:(\d+)$/:/^(\d+)$/);
    if(match&&Number.isInteger(cfg.progressTotal))root.RoomGoblinSCORM.progress(Number(match[1]),cfg.progressTotal);
    const resume=read('cmi.suspend_data');if(cfg.captureResume===true&&typeof resume==='string'&&resume&&new TextEncoder().encode(resume).length<=4096&&resume!==lastResume){lastResume=resume;emit('checkpoint',{state:resume});}
   }catch{ /* Optional telemetry must never interrupt the LMS. */ }
  }
  // Reuse originals when another SCO in this frame already installed a wrapper.
  let holder=api.__roomgoblinScorm;
  if(holder){holder.snapshot=snapshot;holder.observe=(name,value)=>{values[name]=String(value);};return true;}
  holder={snapshot,observe:(name,value)=>{values[name]=String(value);}};
  try{
   Object.defineProperty(api,'__roomgoblinScorm',{value:holder,configurable:true});
   for(const name of [commit,finish,set,get]){const original=api[name];if(typeof original!=='function')continue;api[name]=function(...args){const value=original.apply(this,args);try{if(name===get&&value!=='')holder.observe(args[0],value);else if(value===true||value==='true'){if(name===set)holder.observe(args[0],args[1]);else if(name===commit||name===finish)holder.snapshot();}}catch{}return value;};}
  }catch{return false;}
  return true;
 }
 const installed=install();
 function mount(){
  if(cfg.connectionUi==='embedded'){if(!installed)install();return;}
  if(!findApi())return;const panel=document.createElement('aside');panel.setAttribute('aria-label','RoomGoblin connection');
  panel.style.cssText='display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin:10px;padding:10px;border:1px solid #63e6be;border-radius:12px;background:#10232f;color:white;font:13px/1.4 system-ui;box-shadow:0 4px 24px #0006';
  button=document.createElement('button');button.type='button';button.textContent='Connect to RoomGoblin';button.style.cssText='border:0;border-radius:6px;padding:8px;background:#a3f5d0;color:#10232f;cursor:pointer;font-weight:bold';button.onclick=connect;
  status=document.createElement('p');status.style.margin='6px 0 0';status.setAttribute('role','status');status.textContent='Schoology saves your grade. Connect for classroom progress.';panel.append(button,status);document.body.prepend(panel);if(!installed)install();
 }
 root.RoomGoblinSCORM={submit(answers,raw){
  if(!Number.isFinite(raw)||raw<0||raw>100||!answers||typeof answers!=='object'||Array.isArray(answers))throw Error('Use written answers and a provisional percentage.');
  const entries=Object.entries(answers);if(entries.length<1||entries.length>12||entries.some(([key,value])=>!key.trim()||key.length>80||/[\u0000-\u001f]/.test(key)||typeof value!=='string'||value.length>2000)||new TextEncoder().encode(JSON.stringify(answers)).length>16000)throw Error('Written answers exceed the submission limit.');
  return emit('submission',{answers,raw});
 },connect,connected:()=>!!learner&&!!popup&&!popup.closed,connecting:()=>!learner&&!!popup&&!popup.closed,campaign:()=>campaign,grade:()=>grade,assessment(data){
  if(!Number.isFinite(data.raw)||data.raw<0||data.raw>100||!Number.isInteger(data.current)||!Number.isInteger(data.total)||data.total<1||data.current<0||data.current>data.total)return Promise.reject(Error('Invalid assessment result.'));
  const existing=queue.concat(unbound).find(item=>item.kind==='assessment'&&item.raw===data.raw&&item.current===data.current&&item.total===data.total);
  if(existing)return Promise.reject(Error('Grade save is already queued and will retry automatically.'));
  const id=emit('assessment',data);return new Promise((resolve,reject)=>{const timer=root.setTimeout(()=>{gradeWaiters.delete(id);reject(Error('Grade save is queued; reconnecting automatically.'));},20000);gradeWaiters.set(id,{resolve,reject,timer});});
 },arcade(data){
  if(!learner||!campaign)return Promise.reject(Error('Connect through Schoology before saving a continuing campaign.'));
  if(arcadeWaiters.size||queue.some(item=>item.kind==='arcade'))return Promise.reject(Error('A campaign save is still pending. Reconnect and wait for confirmation before playing in another assignment.'));
  const id=emit('arcade',{...data,revision:campaign.revision});
  return new Promise((resolve,reject)=>{const timer=root.setTimeout(()=>{arcadeWaiters.delete(id);reject(Error('Campaign save is still pending. Reconnect before playing in another assignment.'));},20000);arcadeWaiters.set(id,{resolve,reject,timer});});
 },progress(current,total){if(!Number.isInteger(current)||!Number.isInteger(total)||total<1||current<0||current>total||total>10000)return;const signature=current+'/'+total;if(signature===lastProgress)return;lastProgress=signature;emit('progress',{current,total});}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 function maintain(){if(cfg.connectionMode==='embedded'&&!closed&&popup&&(!learner||queue.length)&&Date.now()-lastContact>=reconnectAfter){reconnectAfter=Math.min(120000,reconnectAfter*2);connect();}pump();}
 root.setInterval(maintain,3000);root.addEventListener('online',()=>{if(cfg.connectionMode==='embedded'&&!closed&&popup&&(!learner||queue.length)){connect();}else pump();});root.addEventListener('pagehide',()=>{persist();closed=true;});
})(window);
