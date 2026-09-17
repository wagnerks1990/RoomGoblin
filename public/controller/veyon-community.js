/* Authenticated community tools; private Veyon connection identifiers stay on the Hub. */
(() => {
  'use strict';
  $('analyzeScreen').onclick=async()=>{
    const ids=targetIds();if(ids.length!==1)return alert('Select exactly one computer.');
    const computer=computers.find(c=>c.id===ids[0]);
    if(!confirm(`Analyze one current screen from ${computer?.name||ids[0]} using the local pilot model? The result is an estimate for human review.`))return;
    const button=$('analyzeScreen');button.disabled=true;
    try{
      const result=await api(`/api/v1/veyon/computers/${encodeURIComponent(ids[0])}/analyze`,{method:'POST',body:'{}'});
      openInfo('Local screen analysis',`<p>One capture; no screenshot or result archive. Detections are estimates, not evidence of misconduct. Original model labels are preserved.</p><ul>${result.detections.map(d=>`<li>${esc(d.label)} — ${Math.round(d.confidence*100)}%</li>`).join('')||'<li>No detections above the model threshold.</li>'}</ul><p><a href="${esc(result.source)}" target="_blank" rel="noopener">Pinned model provenance (AGPL)</a></p>`);
    }catch(e){alert(e.message)}finally{button.disabled=false}
  };
  const dialog=$('communityDialog'),body=$('communityBody'),status=$('communityStatus');
  let current=null,opening=false;
  function button(label,run){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await run()}catch(e){status.textContent=e.message}finally{b.disabled=false}};return b}
  function call(s,action,args={}){
    const task=s.tail.catch(()=>{}).then(()=>{
      if(current!==s&&action!=='close')throw Error('Browser session closed');
      return api(`/api/v1/veyon/computers/${encodeURIComponent(s.id)}/browser/${action}`,{method:'POST',body:JSON.stringify({...args,session:s.session})});
    });s.tail=task;return task;
  }
  async function close(){
    const s=current;if(!s)return;current=null;clearTimeout(s.timer);if(s.downloadUrl)URL.revokeObjectURL(s.downloadUrl);body.replaceChildren();dialog.close();
    try{await call(s,'close')}catch(e){$('commandFeedback').textContent=`Session close could not be confirmed: ${e.message} Native chat expires after 15 minutes.`}
  }
  $('communityClose').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close()});
  async function refresh(s){
    if(current!==s)return;
    const state=await call(s,'state');
    if(current!==s)return;
    const nextStatus=state.error|| (state.pending?'Waiting for endpoint response…':s.kind==='chat'?'Messages sent by the teacher are unverified until checked on the student screen.':'Ready. Downloads are limited to 8 MiB.');
    if(status.textContent!==nextStatus)status.textContent=nextStatus;
    if(s.kind==='chat'){
      const nextLog=state.messages.map(m=>`${m.from}: ${m.text}`).join('\n');if(s.log.textContent!==nextLog){s.log.textContent=nextLog;s.log.scrollTop=s.log.scrollHeight}
    }else{
      const signature=JSON.stringify([state.pending,state.error,state.path,state.entries]);
      if(signature!==s.entriesSignature){
        const focused=document.activeElement?.dataset?.pilotPath;s.entriesSignature=signature;s.list.replaceChildren();
        if(!state.pending&&!state.error)for(const entry of state.entries){
          const path=state.path?`${state.path.replace(/[\\/]$/,'')}/${entry.name}`:entry.name;
          const row=document.createElement('div'),entryButton=button(`${entry.dir?'Folder: ':'Download: '}${entry.name}`,async()=>{
            await call(s,entry.dir?'list':'download',{path});s.download=!entry.dir;await refresh(s);
          });entryButton.dataset.pilotPath=path;row.append(entryButton);s.list.append(row);
        }
        if(focused)s.list.querySelector(`[data-pilot-path="${CSS.escape(focused)}"]`)?.focus();
      }
      if(s.download&&state.complete){
        s.download=false;
        const size=state.size;if(!Number.isSafeInteger(size)||size<0||size>8*1024*1024)throw Error('Invalid download size');
        const chunks=[];let offset=0;
        while(offset<size){const part=await call(s,'chunk',{offset});const bytes=Uint8Array.from(atob(part.data),c=>c.charCodeAt(0));if(!bytes.length||offset+bytes.length>size)throw Error('Incomplete file; download discarded');chunks.push(bytes);offset+=bytes.length}
        if(current!==s)return;
        const blob=new Blob(chunks),url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=state.fileName||'pilot-download';a.textContent=`Save ${state.fileName||'download'}`;s.list.append(a);
        // Keep the completed download available until the next user action or close.
        clearTimeout(s.timer);s.timer=null;s.downloadUrl=url;status.textContent='Complete file received. Select Save to download.';s.saved=true;
      }
    }
  }
  async function open(kind){
    if(opening)return;
    const ids=targetIds();if(ids.length!==1)return alert('Select exactly one computer.');
    opening=true;$('communityChat').disabled=true;$('communityFiles').disabled=true;
    if(current)await close();
    const id=ids[0],computer=computers.find(c=>c.id===id);
    let created=null;
    try{
      const result=await api(`/api/v1/veyon/computers/${encodeURIComponent(id)}/browser/open`,{method:'POST',body:JSON.stringify({kind})});
      const s={id,session:result.session,kind,tail:Promise.resolve(),timer:null};created=s;current=s;
      body.replaceChildren();status.textContent='Session opened; endpoint support is not yet verified.';
      $('communityTitle').textContent=`${kind==='chat'?'Two-way chat':'Pilot files'} — ${computer?.name||id}`;
      if(kind==='chat'){
        s.log=document.createElement('pre');s.log.style.whiteSpace='pre-wrap';s.log.style.maxHeight='35vh';s.log.style.overflow='auto';s.log.setAttribute('aria-live','polite');
        const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('textarea'),send=document.createElement('button');
        label.textContent='Message (up to 2000 characters)';input.maxLength=2000;input.required=true;input.autocomplete='off';label.append(input);send.type='submit';send.textContent='Send';form.append(label,send);
        form.onsubmit=async e=>{e.preventDefault();const text=input.value;input.value='';send.disabled=true;try{await call(s,'send',{text});await refresh(s)}catch(error){status.textContent=error.message}finally{send.disabled=false}};
        body.append(s.log,form);
      }else{
        s.list=document.createElement('div');body.append(button('Pilot folder',async()=>{if(s.downloadUrl)URL.revokeObjectURL(s.downloadUrl);s.saved=false;await call(s,'roots');await refresh(s);schedule(s)}),s.list);
        await call(s,'roots');
      }
      dialog.showModal();await refresh(s);schedule(s);
    }catch(e){if(created&&current===created)await close();alert(e.message)}
    finally{opening=false;$('communityChat').disabled=false;$('communityFiles').disabled=false}
  }
  function schedule(s){clearTimeout(s.timer);if(current!==s||s.saved)return;s.timer=setTimeout(async()=>{try{if(!previewSurfaceVisible())return await close();await refresh(s);schedule(s)}catch(e){status.textContent=e.message}},2000)}
  $('communityChat').onclick=()=>open('chat');$('communityFiles').onclick=()=>open('files');
  dialog.addEventListener('close',()=>{if(current)close()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)close()});
})();
