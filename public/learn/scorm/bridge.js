"use strict";
(()=>{
 const $=id=>document.getElementById(id),cfg=window.LEARNING_CONFIG;let api=null,popup=null,nonce=null,pending=null,finished=false,savedKey=null,frame=null;
 if(typeof cfg?.title==='string'){$('discussion-title').textContent=cfg.title;document.title=cfg.title+' - 20 points';}
 if(cfg?.embedded){$('window-directions').textContent='Work inside this assignment. Your signed Schoology connection, written responses, feedback and grade sync stay here.';$('open').hidden=true;}
 if(cfg?.signedLaunch)$('identity-directions').textContent='Start the discussion. Your existing Schoology session connects automatically; no RoomGoblin password or typed name is required.';
 const receiptKey=r=>[r.reviewId,r.approvedAt,r.raw].join('|');
 function confirm(saved){if(pending&&popup)popup.postMessage({type:'roomgoblin.grade.result',nonce,activityId:cfg.activityId,reviewId:pending.reviewId,approvedAt:pending.approvedAt,raw:pending.raw,saved},cfg.origin);}
 function find(w){for(let i=0;i<15&&w;i++){try{if(w.API)return w.API;if(w.parent===w)break;w=w.parent;}catch{break;}}return null;}
 function set(k,v){if(String(api.LMSSetValue(k,String(v)))!=='true')throw Error('Schoology did not confirm the grade. Keep this page open and retry.');}
 function save(){try{if(!pending||finished)return;if(savedKey===receiptKey(pending)){confirm(true);return;}set('cmi.core.score.min',0);set('cmi.core.score.max',100);set('cmi.core.score.raw',pending.raw);set('cmi.suspend_data',JSON.stringify({v:1,activityId:cfg.activityId,reviewId:pending.reviewId}));set('cmi.core.lesson_status','completed');if(String(api.LMSCommit(''))!=='true'||String(api.LMSGetLastError())!=='0')throw Error('Schoology save is not confirmed. Retrying automatically; keep this page open.');savedKey=receiptKey(pending);$('status').textContent=`Saved to the LMS: ${pending.score}/20. Check the Schoology gradebook after exiting.`;$('retry').hidden=true;confirm(true);}catch(e){$('status').textContent=e.message;$('retry').hidden=false;confirm(false);}}
 try{if(!cfg||!/^https?:\/\//.test(cfg.origin)||new URL(cfg.origin).origin!==cfg.origin||!/^[-a-z0-9]+$/i.test(cfg.activityId))throw Error('Download a configured launcher from the RoomGoblin teacher desk.');api=find(window)||find(window.opener);if(!api||String(api.LMSInitialize(''))!=='true')throw Error('Open this ZIP as a graded SCORM activity in Schoology.');const mode=String(api.LMSGetValue('cmi.core.lesson_mode'));if(String(api.LMSGetLastError())!=='0'||['review','browse'].includes(mode))throw Error('Read-only review: no new grade can be sent from this launch.');$('open').disabled=false;$('status').textContent='Ready. Open the discussion to begin.';}catch(e){$('status').textContent=e.message;}
 $('origin').textContent='Launcher origin: '+location.origin;
 $('open').onclick=()=>{const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);nonce=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');const url=cfg.signedLaunch?cfg.origin+'/learn/connect/#activity='+encodeURIComponent(cfg.activityId)+'&nonce='+nonce+'&parent='+encodeURIComponent(location.origin)+(cfg.embedded?'&embedded=1':''):cfg.origin+'/learn/?activity='+encodeURIComponent(cfg.activityId)+'#bridge='+nonce+'&parent='+encodeURIComponent(location.origin);if(cfg.embedded){if(!frame){frame=document.createElement('iframe');frame.title='Written discussion';frame.style.cssText='width:100%;height:80vh;min-height:600px;border:0';$('discussion-frame').append(frame);}frame.src=url;popup=frame.contentWindow;}else popup=window.open(url,'roomgoblin-learning-'+cfg.activityId);if(!popup)$('status').textContent='Your browser blocked the discussion window. Your saved writing and grade remain in RoomGoblin.';};
 window.addEventListener('message',e=>{
  const d=e.data;
  if(!api||finished||!popup||e.source!==popup||e.origin!==cfg.origin||!d||d.nonce!==nonce||d.activityId!==cfg.activityId)return;
  if(d.type==='roomgoblin.learner.request'){
   // Name is optional. Never request a student ID or put names in URLs/storage.
   try{const name=api.LMSGetValue('cmi.core.student_name');if(String(api.LMSGetLastError())==='0'&&typeof name==='string'&&name.trim()&&name.length<=255)popup.postMessage({type:'roomgoblin.learner',nonce,activityId:cfg.activityId,name},cfg.origin);}catch{}
   return;
  }
  if(d.type!=='roomgoblin.grade'||d.possible!==20||!Number.isFinite(d.score)||d.score<0||d.score>20||d.raw!==d.score*5||typeof d.reviewId!=='string'||!d.reviewId||d.reviewId.length>80||typeof d.approvedAt!=='string'||d.approvedAt.length>40||!Number.isFinite(Date.parse(d.approvedAt)))return;
  pending=d;save();
 });
 $('retry').onclick=save;
 if(cfg?.embedded&&$('open').disabled===false)$('open').onclick();
 const retryTimer=setInterval(()=>{if(pending&&receiptKey(pending)!==savedKey)save();},15000);
 window.addEventListener('pagehide',()=>{clearInterval(retryTimer);if(api&&!finished){try{api.LMSFinish('');}catch{}finished=true;}});
})();
