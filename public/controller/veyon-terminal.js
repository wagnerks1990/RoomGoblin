/* Administrator-only command sessions transported through the Veyon native bridge. */
(() => {
  'use strict';
  const dialog=$('terminalDialog'),output=$('terminalOutput'),status=$('terminalStatus'),form=$('terminalForm'),input=$('terminalInput');
  let current=null,opening=false;
  const submit=form.querySelector('button[type="submit"]');
  const call=(s,action,data={})=>{
    const task=s.tail.catch(()=>{}).then(()=>{
      if(current!==s&&action!=='close')throw Error('Terminal session closed');
      return api(`/api/v1/veyon/computers/${encodeURIComponent(s.id)}/terminal/${action}`,{method:'POST',body:JSON.stringify({...data,session:s.session})});
    });s.tail=task;return task;
  };
  async function close(){
    const s=current;if(!s)return;current=null;clearTimeout(s.timer);submit.disabled=true;input.disabled=true;
    // Cleanup must not wait behind state/read polling. Dispatch close immediately so
    // leaving the terminal starts native-session teardown in every browser.
    try{await api(`/api/v1/veyon/computers/${encodeURIComponent(s.id)}/terminal/close`,{method:'POST',body:JSON.stringify({session:s.session})})}catch(e){$('commandFeedback').textContent=`Terminal cleanup could not be confirmed: ${e.message}. The native session expires after ten minutes.`}
    finally{dialog.close();output.textContent='';status.textContent='';input.value='';input.disabled=false;submit.disabled=false}
  }
  async function poll(s){
    if(current!==s)return;
    const state=await call(s,'state'),part=await call(s,'read',{offset:s.cursor});
    if(current!==s)return;
    if(part.reset)output.textContent='[Earlier output discarded by the 128 KiB session limit.]\n';
    if(part.text){output.append(document.createTextNode(part.text));output.scrollTop=output.scrollHeight}
    s.cursor=part.cursor;
    if(state.error||part.error)status.textContent=state.error||part.error;
    else if(state.terminalExited||part.exited){status.textContent='The remote shell exited. Close this session to reopen it.';input.disabled=true;submit.disabled=true;return}
    else if(state.terminalReady||part.ready){status.textContent=`${s.shell==='cmd'?'CMD':'Windows PowerShell'} connected through Veyon. Session expires automatically.`;input.disabled=false;submit.disabled=false}
    else status.textContent='Waiting for the Windows endpoint to start the shell…';
    s.timer=setTimeout(()=>poll(s).catch(e=>{status.textContent=e.message}),750);
  }
  async function open(){
    if(opening)return;
    const ids=targetIds();if(ids.length!==1)return alert('Select exactly one computer.');
    const computer=computers.find(c=>c.id===ids[0]);
    const shell=prompt('Enter cmd or powershell:','powershell')?.trim().toLowerCase();
    if(!shell)return;if(!['cmd','powershell'].includes(shell))return alert('Choose cmd or powershell.');
    if(!confirm(`Open an administrator-authorized ${shell==='cmd'?'CMD':'Windows PowerShell'} session on ${computer?.name||ids[0]}? It runs as the signed-in user and closes after ten minutes.`))return;
    opening=true;$('liveTerminal').disabled=true;
    try{
      if(current)await close();
      const result=await api(`/api/v1/veyon/computers/${encodeURIComponent(ids[0])}/terminal/open`,{method:'POST',body:JSON.stringify({shell})});
      const s={id:ids[0],session:result.session,shell,cursor:0,tail:Promise.resolve(),timer:null};current=s;
      $('terminalTitle').textContent=`${shell==='cmd'?'CMD':'Windows PowerShell'} — ${computer?.name||ids[0]}`;
      output.textContent='';status.textContent='Waiting for the Windows endpoint to start the shell…';input.disabled=true;submit.disabled=true;
      dialog.showModal();await poll(s);
    }catch(e){if(current)await close();alert(e.message)}finally{opening=false;$('liveTerminal').disabled=false}
  }
  form.onsubmit=async event=>{
    event.preventDefault();const s=current;if(!s)return;const command=input.value;if(!command)return;
    input.value='';submit.disabled=true;
    try{await call(s,'write',{text:`${command}\r\n`});input.focus()}catch(e){status.textContent=e.message}
    finally{if(current===s&&!input.disabled)submit.disabled=false}
  };
  const terminalButton=$('liveTerminal');terminalButton.onclick=open;$('terminalClose').onclick=close;
  api('/api/v1/auth/status').then(auth=>{
    const user=auth?.user,caps=Array.isArray(user?.capabilities)?user.capabilities:[];
    terminalButton.hidden=!(user?.role==='admin'&&caps.includes('*'));
  }).catch(()=>{terminalButton.hidden=true});
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
  dialog.addEventListener('close',()=>{if(current)close()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&current)close()});
})();
