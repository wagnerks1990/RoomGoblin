"use strict";
let publicOrigin=null,busy=false;
const status=document.getElementById('status');
fetch('/learn/presence/config',{credentials:'omit'}).then(async r=>{const data=await r.json();if(!r.ok)throw Error();publicOrigin=data.publicOrigin;status.textContent='Local classroom network available. Return to your assignment.';}).catch(()=>{status.textContent='Classroom network was not verified. Your assignment can still save progress without room effects.';});
window.addEventListener('message',async e=>{
 const message=e.data;if(!publicOrigin||e.origin!==publicOrigin||e.source!==window.opener||message?.type!=='roomgoblin.presence.check'||typeof message.id!=='string'||!/^[a-f0-9-]{36}$/.test(message.id)||busy)return;
 busy=true;let ok=false;
 try{const r=await fetch('/learn/presence/attest',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json','x-roomgoblin-presence':'1'},body:JSON.stringify({id:message.id})});ok=r.ok;status.textContent=ok?'Classroom network verified.':'Presence check expired; waiting for the next event.';}catch{status.textContent='The local network is unavailable. Room effects stay off.';}finally{busy=false;e.source.postMessage({type:'roomgoblin.presence.result',id:message.id,ok},publicOrigin);}
});
