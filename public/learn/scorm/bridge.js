"use strict";
(()=>{
 const $=id=>document.getElementById(id),cfg=window.LEARNING_CONFIG;let api=null,popup=null,nonce=null,pending=null,finished=false;
 function find(w){for(let i=0;i<15&&w;i++){try{if(w.API)return w.API;if(w.parent===w)break;w=w.parent;}catch{break;}}return null;}
 function set(k,v){if(String(api.LMSSetValue(k,String(v)))!=='true')throw Error('Schoology did not confirm the grade. Keep this page open and retry.');}
 function save(){try{if(!pending||finished)return;set('cmi.core.score.min',0);set('cmi.core.score.max',100);set('cmi.core.score.raw',pending.raw);set('cmi.suspend_data',JSON.stringify({v:1,activityId:cfg.activityId,reviewId:pending.reviewId}));set('cmi.core.lesson_status','completed');if(String(api.LMSCommit(''))!=='true')throw Error('Schoology save is not confirmed. Retry before closing.');$('status').textContent=`Saved to the LMS: ${pending.score}/20. Check the Schoology gradebook after exiting.`;$('retry').hidden=true;}catch(e){$('status').textContent=e.message;$('retry').hidden=false;}}
 try{if(!cfg||!/^https?:\/\//.test(cfg.origin)||new URL(cfg.origin).origin!==cfg.origin||!/^[-a-z0-9]+$/i.test(cfg.activityId))throw Error('Download a configured launcher from the RoomGoblin teacher desk.');api=find(window)||find(window.opener);if(!api||String(api.LMSInitialize(''))!=='true')throw Error('Open this ZIP as a graded SCORM activity in Schoology.');const mode=String(api.LMSGetValue('cmi.core.lesson_mode'));if(String(api.LMSGetLastError())!=='0'||['review','browse'].includes(mode))throw Error('Read-only review: no new grade can be sent from this launch.');$('open').disabled=false;$('status').textContent='Ready. Open the discussion to begin.';}catch(e){$('status').textContent=e.message;}
 $('origin').textContent='Launcher origin: '+location.origin;
 $('open').onclick=()=>{const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);nonce=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');const url=cfg.origin+'/learn/?activity='+encodeURIComponent(cfg.activityId)+'#bridge='+nonce+'&parent='+encodeURIComponent(location.origin);popup=window.open(url,'roomgoblin-learning-'+nonce,'popup,width=1200,height=900');if(!popup)$('status').textContent='Allow the discussion popup, then select Open discussion again.';};
 window.addEventListener('message',e=>{
  const d=e.data;
  if(!api||finished||!popup||e.source!==popup||e.origin!==cfg.origin||!d||d.nonce!==nonce||d.activityId!==cfg.activityId)return;
  if(d.type==='roomgoblin.learner.request'){
   // Name is optional. Never request a student ID or put names in URLs/storage.
   try{const name=api.LMSGetValue('cmi.core.student_name');if(String(api.LMSGetLastError())==='0'&&typeof name==='string'&&name.trim()&&name.length<=255)popup.postMessage({type:'roomgoblin.learner',nonce,activityId:cfg.activityId,name},cfg.origin);}catch{}
   return;
  }
  if(d.type!=='roomgoblin.grade'||d.possible!==20||!Number.isFinite(d.score)||d.score<0||d.score>20||d.raw!==d.score*5||typeof d.reviewId!=='string'||d.reviewId.length>80)return;
  pending=d;save();
 });
 $('retry').onclick=save;
 window.addEventListener('pagehide',()=>{if(api&&!finished){try{api.LMSFinish('');}catch{}finished=true;}});
})();
