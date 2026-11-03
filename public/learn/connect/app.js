"use strict";
const $=id=>document.getElementById(id),API='/api/v1/learning',pendingPresence=new Map();
let flow=null,config=null,state=null,presenceWindow=null,busy=false;
const validId=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const validFlow=v=>v&&validId(v.activityId)&&/^[a-f0-9]{32}$/.test(v.nonce)&&typeof v.parent==='string'&&Date.now()-v.created<600000;
function say(text){$('status').textContent=text;}
async function api(path,method='GET',body){const r=await fetch(API+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','x-roomgoblin-learning':'1','x-roomgoblin-connection':flow?.connectionId||''},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'Connection unavailable.'),{status:r.status});return data;}
function send(type,data={}){if(window.opener&&flow)window.opener.postMessage({type,nonce:flow.nonce,activityId:flow.activityId,...data},flow.parent);}
function ready(){send('roomgoblin.connector.ready',{state});}
async function presenceFor(eventId){
 if(!presenceWindow||presenceWindow.closed)return undefined;
 const proof=await api('/platform/activities/'+flow.activityId+'/presence','POST',{eventId});if(!proof.available)return undefined;
 return new Promise(resolve=>{const timeout=setTimeout(()=>{pendingPresence.delete(proof.id);resolve(undefined);},4500);pendingPresence.set(proof.id,{resolve,timeout});presenceWindow.postMessage({type:'roomgoblin.presence.check',id:proof.id},config.presenceOrigin);});
}
window.addEventListener('message',async e=>{
 const message=e.data;
 if(e.source===presenceWindow&&e.origin===config?.presenceOrigin&&message?.type==='roomgoblin.presence.result'){
  const pending=pendingPresence.get(message.id);if(!pending)return;clearTimeout(pending.timeout);pendingPresence.delete(message.id);pending.resolve(message.ok===true?message.id:undefined);$('presence-status').textContent=message.ok===true?'Classroom network verified for this event.':'Classroom presence was not verified. Your work is still saved.';return;
 }
 if(!flow||!state||!window.opener||e.source!==window.opener||e.origin!==flow.parent||!message||message.nonce!==flow.nonce||message.activityId!==flow.activityId)return;
 if(message.type==='roomgoblin.connector.hello'){ready();return;}
 if(message.type!=='roomgoblin.connector.event'||busy||!message.event||!validId(message.event.id))return;
 busy=true;
 try{
  const input={...message.event,learnerKey:state.learnerKey};
  // An event saved under another account must never be rebound to this session.
  if(message.event.learnerKey!==state.learnerKey)throw Error('Saved work belongs to a different connection. Reopen the assignment.');
  if(input.kind!=='checkpoint')try{input.presenceId=await presenceFor(input.id);}catch{}
  const result=await api('/platform/activities/'+flow.activityId+'/events','POST',input);state=result.state;say('Connected. Your progress is saved.');send('roomgoblin.connector.saved',{id:input.id,state,classroom:result.classroom===true});
 }catch(error){send('roomgoblin.connector.error',{id:message.event.id,message:error.message,reconnect:error.status===401,conflict:error.status===409});say(error.message);}finally{busy=false;}
});
$('classroom').onclick=()=>{
 if(!config?.presenceOrigin)return;presenceWindow=window.open(config.presenceOrigin+'/learn/presence/','roomgoblin-presence','width=440,height=360');
 $('presence-status').textContent=presenceWindow?'Keep the local presence window open. It carries no password or login cookie.':'Allow this local presence window to use classroom effects. Progress saving remains available.';
};
async function start(){
 const hash=new URLSearchParams(location.hash.slice(1));
 if(hash.has('nonce'))flow={activityId:hash.get('activity'),nonce:hash.get('nonce'),parent:hash.get('parent'),created:Date.now()};
 else{try{flow=JSON.parse(sessionStorage.getItem('roomgoblin.connector.flow'));}catch{}}
 if(location.hash)history.replaceState(null,'',location.pathname+location.search);
 if(!validFlow(flow)){say('Schoology connection ready.');$('detail').textContent='Return to the SCORM assignment and select Connect to RoomGoblin. No RoomGoblin password is needed.';return;}
 const response=await fetch('/learn/connect-info/'+flow.activityId,{credentials:'omit'});config=await response.json();if(!response.ok)throw Error(config.error||'Assignment is not available.');
 if(!config.bridgeOrigins.includes(flow.parent)||new URL(flow.parent).origin!==flow.parent)throw Error('This Schoology origin has not been approved by your teacher.');
 sessionStorage.setItem('roomgoblin.connector.flow',JSON.stringify(flow));
  async function signIn(){
    const r=await fetch('/learn/connect/start',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','x-roomgoblin-learning':'1'},body:JSON.stringify({activityId:flow.activityId,parent:flow.parent})});const next=await r.json();if(!r.ok)throw Error(next.error||'Connection is not configured.');flow.launched=true;flow.connectionId=next.id;sessionStorage.setItem('roomgoblin.connector.flow',JSON.stringify(flow));location.assign(next.launchUrl);
  }
  $('connect-schoology').onclick=()=>signIn().catch(error=>say(error.message));
  if(!flow.connectionId){await signIn();return;}
 try{state=await api('/platform/activities/'+flow.activityId+'/state');}
 catch(error){
  if(error.status!==401)throw error;
  say('Connecting through Schoology…');$('connect-schoology').hidden=!config.launchUrl;
  $('detail').textContent=config.launchUrl?'Continue through your existing Schoology session.':'Your teacher needs to configure the signed Schoology connection first. Your SCORM game can still save its normal Schoology grade.';return;
 }
 config.presenceOrigin=state.presenceOrigin||'';say('Connected, '+state.firstName+'.');$('classroom').hidden=!config.presenceOrigin;
 if(!window.opener){$('detail').textContent='Your browser separated the sign-in window. Return to the game and select Connect to RoomGoblin again; your signed-in session is ready.';return;}
 ready();
}
start().catch(error=>say(error.message||'The connection is unavailable. Your normal SCORM assignment remains usable.'));
