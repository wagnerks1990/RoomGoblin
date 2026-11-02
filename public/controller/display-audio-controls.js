"use strict";
(() => {
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node};
  function labelled(parent,text,node){const label=el('label',text);node.setAttribute('aria-label',text);node.dataset.ephemeral='true';label.append(node);parent.append(label);return node}
  function button(parent,text,fn){const node=el('button',text);node.type='button';node.dataset.control='true';node.addEventListener('click',fn);parent.append(node);return node}

  function settings(parent,{volume=1,muted=false,label='Volume (%)',change}){
    const slider=labelled(parent,label,el('input')),value=el('output');slider.type='range';slider.min=0;slider.max=100;slider.step=1;slider.value=Math.round(volume*100);value.textContent=slider.value+'%';slider.after(value);
    const mute=labelled(parent,'Muted',el('input'));mute.type='checkbox';mute.checked=muted;
    delete slider.dataset.ephemeral;delete mute.dataset.ephemeral;
    const update=()=>{value.textContent=slider.value+'%';change({volume:Number(slider.value)/100,muted:mute.checked})};
    slider.addEventListener('input',update);mute.addEventListener('change',update);
    return {slider,mute};
  }

  function mount(parent,{boardId}={}){
    if(!userCan('classroom.control'))return;
    const panel=el('section');panel.className='panel';panel.dataset.liveAudio='true';
    panel.append(el('h3','Live audio'),el('p','Adjust the current playback on a display. Saved automation settings apply again on the next run. These are requested settings; browser or website restrictions may prevent sound.'));
    const target=labelled(panel,'Audio display',el('select')),summary=el('p'),controls=el('div');controls.className='toolbar';
    const volume=labelled(controls,'Live volume (%)',el('input')),value=el('output');volume.type='range';volume.min=0;volume.max=100;volume.step=1;volume.value=100;volume.after(value);
    const down=button(controls,'Volume down',()=>send({volume:Math.max(0,Number(volume.value)-10)/100,muted:false}));
    const up=button(controls,'Volume up',()=>send({volume:Math.min(100,Number(volume.value)+10)/100,muted:false}));
    const mute=button(controls,'Mute',()=>send({muted:true})),unmute=button(controls,'Unmute',()=>send({muted:false}));
    const feedback=el('p');feedback.setAttribute('role','status');panel.append(summary,controls,feedback);parent.append(panel);
    let rows=[],current=null,busy=false,ready=false,optionsKey='',timer=null,requestVersion=0;
    function paint(){
      current=rows.find(row=>row.id===target.value)||null;
      for(const node of [volume,down,up,mute,unmute])node.disabled=busy||!ready||!current||current.locked;
      if(current){volume.value=Math.round(current.volume*100);value.textContent=volume.value+'%';summary.textContent=`${current.kinds.map(kind=>({sports:'Sports',video:'Video',web:'Website'})[kind]).join(' + ')} · ${current.mixed?'Mixed audio settings':current.muted?'Muted':current.volume===0?'Silent (0%)':'Sound enabled'}${current.online?'':' · Display offline; setting will apply on reconnect'}${current.locked?' · Morning Announcements has priority':''}`}
      else{value.textContent='';summary.textContent=rows.length?'Choose a display to control its current audio.':'No matching playback. Start the automation or send a Sports board, then refresh.'}
    }
    async function refresh(){
      if(busy)return;
      const version=++requestVersion;
      try{
        const result=await api('/api/v1/displays/audio');
        if(!panel.isConnected||busy||version!==requestVersion||document.activeElement===volume)return;
        rows=(result.displays||[]).filter(row=>row.available&&(!boardId||row.boardIds.includes(boardId)));ready=true;
        const key=JSON.stringify(rows.map(row=>[row.id,row.name]));
        if(key!==optionsKey){const selected=target.value;target.replaceChildren();const placeholder=el('option','Choose a display');placeholder.value='';target.append(placeholder);for(const row of rows){const option=el('option',row.name);option.value=row.id;target.append(option)}target.value=rows.some(row=>row.id===selected)?selected:'';optionsKey=key}
        paint();
      }catch(error){ready=false;paint();feedback.textContent=error.message}
    }
    async function send(payload){
      if(busy||!ready||!current||current.locked)return;
      const selected=current;busy=true;requestVersion++;paint();
      try{
        const result=await api('/api/v1/displays/'+encodeURIComponent(selected.id)+'/audio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,contentKey:selected.contentKey})});
        Object.assign(selected,result.audio);feedback.textContent='Audio setting sent.'+(result.result?.warnings?.length?' '+result.result.warnings.join(' '):'');
      }catch(error){feedback.textContent=error.message}
      finally{busy=false;paint();await refresh()}
    }
    target.addEventListener('change',()=>{feedback.textContent='';paint()});
    volume.addEventListener('input',()=>value.textContent=volume.value+'%');
    volume.addEventListener('change',()=>send({volume:Number(volume.value)/100,muted:Number(volume.value)===0}));
    button(panel,'Refresh live audio',refresh);
    function poll(){clearTimeout(timer);if(!panel.isConnected)return;const page=panel.closest('.page');if((!page||page.classList.contains('active'))&&document.activeElement!==volume)refresh();timer=setTimeout(poll,5000)}
    paint();poll();
    return ()=>clearTimeout(timer);
  }
  window.RoomGoblinAudioControls={mount,settings};
})();
