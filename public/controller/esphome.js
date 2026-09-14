/* Native ESPHome device workspace. No credentials in browser storage or URLs. */
(()=>{
  "use strict";
  const page=document.getElementById("esphome"),inventory=document.getElementById("espInventory"),form=document.getElementById("espForm");
  if(!page||!form)return;
  const $=id=>document.getElementById(id),cards=new Map(),busy=new Set();
  let devices=[],loading=false,stale=true,editing=null,saving=false;
  const admin=()=>userCan("admin")&&userCan("*");
  const active=()=>page.classList.contains("active")&&!document.hidden&&userCan("classroom.read");
  const element=(tag,content,className)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(className)node.className=className;return node};
  const button=(label,run)=>{const b=element("button",label);b.type="button";b.addEventListener("click",run);return b};
  const write=(url,body,method="POST")=>api(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const endpoint=id=>`/api/v1/esphome/devices/${encodeURIComponent(id)}`;
  function resetEditor(){editing=null;form.reset();$("espKey").required=true;$("espSave").textContent="Verify & add device";$("espKeyHelp").textContent="Use the device’s api.encryption.key (32-byte base64 key), not its Wi-Fi or OTA password."}
  function edit(device){
    resetEditor();editing=device.id;$("espName").value=device.name;$("espAddress").value=device.address;$("espPort").value=device.port;
    $("espKey").required=false;$("espSave").textContent="Verify & save changes";
    $("espKeyHelp").textContent="Leave the key blank to keep the stored key. The hardware MAC must still match.";
    $("espEnrollment").open=true;$("espName").focus();
  }
  async function change(device,remove=false){
    if(remove&&!confirm(`Remove ${device.name} from RoomGoblin and delete its stored API key? This does not reset or power off the hardware.`))return;
    busy.add(device.id);render();
    try{
      const result=remove?await api(endpoint(device.id),{method:"DELETE"}):await write(endpoint(device.id)+"/enabled",{enabled:!device.enabled});
      devices=result.devices;stale=false;if(editing===device.id){resetEditor();$("espEnrollment").open=false}
    }catch(error){$("espMessage").textContent=error.message}
    finally{busy.delete(device.id);render()}
  }
  async function send(device,entity,command,message){
    if(busy.has(device.id))return;
    if(entity.adminOnly){if(!admin()||!confirm(`Run ${entity.name} on ${device.name}? Configuration and button actions can restart or change device behavior.`))return;command.confirm=true}
    const random=Array.from(crypto.getRandomValues(new Uint32Array(3))).join("-");
    busy.add(device.id);render();message.textContent="Sending…";
    try{
      const result=await write(`${endpoint(device.id)}/entities/${encodeURIComponent(entity.id)}/command`,{command,requestId:`esp-${Date.now()}-${random}`});
      message.textContent=result.confirmed?"Device reported the requested state.":"Sent, not confirmed. Check the device before repeating.";
    }catch(error){message.textContent=`${error.message} No automatic retry was made.`}
    finally{busy.delete(device.id);render();refresh()}
  }
  function entityCard(device,entity){
    const root=element("div",undefined,"esp-entity"),title=element("strong",entity.name||entity.id),value=element("div","No state received","esp-state"),controls=element("div",undefined,"toolbar"),message=element("p","","muted");
    root.append(title,element("span",`${entity.domain}${entity.adminOnly?" · administrator control":""}`,"muted"),value,controls,message);
    const writable=entity.writable&&!entity.disabledByDefault;
    let input=null;
    if(writable&&["switch","light"].includes(entity.domain)){
      controls.append(button("On",()=>send(device,entity,{state:true},message)),button("Off",()=>send(device,entity,{state:false},message)));
      if(entity.domain==="light"&&entity.brightness){
        input=element("input");input.type="number";input.min=0;input.max=100;input.step=1;input.setAttribute("aria-label",`${entity.name} brightness percent`);
        controls.append(input,button("Set brightness",()=>{if(input.value!==""&&input.reportValidity()){input.dataset.dirty="";send(device,entity,{brightness:Number(input.value)/100},message)}}));
      }
    }else if(writable&&["number","select"].includes(entity.domain)){
      input=element(entity.domain==="number"?"input":"select");input.setAttribute("aria-label",`${entity.name} value`);
      if(entity.domain==="number"){input.type="number";input.min=entity.min;input.max=entity.max;input.step=entity.step}
      else for(const option of entity.options||[]){const node=element("option",option);node.value=option;input.append(node)}
      controls.append(input,button("Set value",()=>{if(input.value!==""&&input.reportValidity()){input.dataset.dirty="";send(device,entity,{state:entity.domain==="number"?Number(input.value):input.value},message)}}));
    }else if(writable&&entity.domain==="button")controls.append(button("Press button",()=>send(device,entity,{press:true},message)));
    else controls.append(element("span","Read only","muted"));
    input?.addEventListener("input",()=>{input.dataset.dirty="true"});input?.addEventListener("change",()=>{input.dataset.dirty="true"});
    return {root,value,controls,input,entity};
  }
  function makeCard(device){
    const card=element("article",undefined,"card esp-device"),title=element("h2",device.name),meta=element("p","","muted"),status=element("p"),manage=element("div",undefined,"toolbar"),detail=element("details"),summary=element("summary","Entities"),rows=element("div",undefined,"esp-entities");
    manage.append(button("Edit",()=>edit(devices.find(d=>d.id===device.id))),button("Disable",()=>change(devices.find(d=>d.id===device.id))),button("Remove",()=>change(devices.find(d=>d.id===device.id),true)));
    detail.append(summary,rows);card.append(title,meta,status,manage,detail);
    return {card,title,meta,status,manage,detail,summary,rows,signature:"",entities:[]};
  }
  function render(){
    $("espEnrollment").hidden=!admin();
    const query=$("espSearch").value.toLowerCase().trim(),filter=$("espFilter").value,ids=new Set();let visible=0;
    for(const device of devices){
      ids.add(device.id);let view=cards.get(device.id);if(!view){view=makeCard(device);cards.set(device.id,view);inventory.append(view.card)}
      const match=[device.name,device.address,device.mac,device.info?.model].join(" ").toLowerCase().includes(query)&&(filter==="all"||(filter==="online"&&device.online)||(filter==="offline"&&!device.online));
      view.card.hidden=!match;if(match)visible++;
      view.title.textContent=device.name;view.meta.textContent=`${device.address}:${device.port} · ${device.mac} · ${device.info?.model||"ESPHome"} · firmware ${device.info?.esphome_version||"unknown"}`;
      view.status.textContent=stale?"Inventory stale — controls paused":device.online?"Connected · encrypted native API":`${device.enabled?"Not connected":"Disabled"} · ${device.error||"waiting for connection"}`;
      view.manage.hidden=!admin();view.manage.children[1].textContent=device.enabled?"Disable":"Enable";
      for(const b of view.manage.querySelectorAll("button"))b.disabled=busy.has(device.id)||saving;
      const signature=JSON.stringify([device.generation,device.entities]);
      if(signature!==view.signature){view.signature=signature;view.entities=(device.entities||[]).map(e=>entityCard(device,e));view.rows.replaceChildren(...view.entities.map(e=>e.root))}
      view.summary.textContent=`Entities (${view.entities.length})`;
      for(const row of view.entities){
        const state=device.states?.[row.entity.id],value=state&&!state.missing_state?state.state:null;
        const label=value===true?"On":value===false?"Off":value===null||value===undefined?"No state received":String(value);
        row.value.textContent=`${label}${row.entity.unit?" "+row.entity.unit:""}${!device.online&&state?" (last reported)":""}${state?.updatedAt?" · "+new Date(state.updatedAt).toLocaleTimeString():""}`;
        const allowed=!stale&&device.online&&device.enabled&&device.hasKey&&userCan("integrations.control")&&(!row.entity.adminOnly||admin())&&!busy.has(device.id)&&!saving;
        for(const control of row.controls.querySelectorAll("button,input,select"))control.disabled=!allowed;
        if(row.input&&!row.input.dataset.dirty&&document.activeElement!==row.input){
          const next=row.entity.domain==="light"&&typeof state?.brightness==="number"?Math.round(state.brightness*100):value;
          if(next!==null&&next!==undefined)row.input.value=String(next);
        }
      }
    }
    for(const [id,view] of cards)if(!ids.has(id)){view.card.remove();cards.delete(id)}
    $("espSummary").textContent=`${devices.length} enrolled · ${devices.filter(d=>d.online).length} connected · ${visible} shown`;
    $("espEmpty").hidden=visible>0;$("espEmpty").textContent=devices.length?"No devices match these filters.":"No ESPHome devices enrolled. An administrator can add an encrypted native API device below.";
  }
  async function refresh(){
    if(!active()||loading)return;loading=true;
    try{const result=await api("/api/v1/esphome/devices");if(!active())return;devices=result.devices||[];stale=false;$("espMessage").textContent=result.workerError||""}
    catch(error){stale=true;$("espMessage").textContent=`${error.message} Last inventory retained; controls are paused.`}
    finally{loading=false;render()}
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(saving||!admin()||!form.reportValidity())return;
    const payload={name:$("espName").value,address:$("espAddress").value,port:Number($("espPort").value),key:$("espKey").value};
    $("espKey").value="";saving=true;$("espSave").disabled=true;$("espFormMessage").textContent="Verifying encrypted connection and device identity…";render();
    try{const result=await write(editing?endpoint(editing):"/api/v1/esphome/devices",payload,editing?"PUT":"POST");devices=result.devices;stale=false;resetEditor();$("espFormMessage").textContent="Saved. The native connection will populate entities when ready."}
    catch(error){$("espFormMessage").textContent=error.message}
    finally{payload.key="";saving=false;$("espSave").disabled=false;render()}
  });
  $("espCancel").addEventListener("click",()=>{if(!saving){resetEditor();$("espEnrollment").open=false}});
  $("espEnrollment").addEventListener("toggle",()=>{if(!$("espEnrollment").open)$("espKey").value=""});
  $("espRefresh").addEventListener("click",refresh);$("espSearch").addEventListener("input",render);$("espFilter").addEventListener("change",render);
  window.addEventListener("roomgoblin:authchange",()=>{$("espKey").value="";if(!userCan("classroom.read")){devices=[];stale=true;resetEditor()}render();refresh()});
  new MutationObserver(()=>{if(active())refresh();else $("espKey").value=""}).observe(page,{attributes:true,attributeFilter:["class"]});
  document.addEventListener("visibilitychange",()=>{if(active())refresh()});
  setInterval(refresh,3000);render();
})();
