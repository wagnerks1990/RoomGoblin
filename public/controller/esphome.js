/* Native ESPHome device workspace. No credentials in browser storage or URLs. */
(()=>{
  "use strict";
  const page=document.getElementById("esphome"),inventory=document.getElementById("espInventory"),form=document.getElementById("espForm");
  if(!page||!form)return;
  const $=id=>document.getElementById(id),cards=new Map(),busy=new Set();
  let devices=[],loading=false,stale=true,editing=null,saving=false,discovering=false,discovered=[],lastDiscovery=0;
  let inventoryRevision=0,authRevision=0,managementBusy=false,inventoryMessage="",managementMessage="";
  const admin=()=>userCan("admin")&&userCan("*");
  const active=()=>page.classList.contains("active")&&!document.hidden&&userCan("classroom.read");
  const element=(tag,content,className)=>{const node=document.createElement(tag);if(content!==undefined)node.textContent=content;if(className)node.className=className;return node};
  const button=(label,run)=>{const b=element("button",label);b.type="button";b.addEventListener("click",run);return b};
  const write=(url,body,method="POST")=>api(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const endpoint=id=>`/api/v1/esphome/devices/${encodeURIComponent(id)}`;

  const discoveryCard=element("section",undefined,"card"),discoveryHead=element("div",undefined,"toolbar"),discoveryTitle=element("h2","Discovered ESPHome devices"),discoveryButton=button("Scan network",()=>scanDiscovery(true)),discoveryStatus=element("p","RoomGoblin can find ESPHome native API devices advertised by mDNS on the classroom network.","muted"),discoveryRows=element("div");
  discoveryHead.append(discoveryTitle,discoveryButton);discoveryCard.append(discoveryHead,discoveryStatus,discoveryRows);
  $("espEnrollment").before(discoveryCard);
  const enrollmentHelp=$("espEnrollment").querySelector("p");
  if(enrollmentHelp)enrollmentHelp.textContent="Choose a discovered device or enter a private IPv4 address manually. Leave the API key blank only when the device intentionally uses an unencrypted ESPHome native API; encrypted devices require their exact api.encryption.key.";

  function resetEditor(){editing=null;form.reset();$("espFormMessage").textContent="";$("espKey").required=false;$("espSave").textContent="Verify & add device";$("espKeyHelp").textContent="Optional for intentionally unencrypted native API devices. Encrypted devices require the exact 32-byte base64 api.encryption.key."}
  function edit(device){
    if(!device||saving||managementBusy||!admin())return;
    resetEditor();editing=device.id;$("espName").value=device.name;$("espAddress").value=device.address;$("espPort").value=device.port;
    $("espSave").textContent="Verify & save changes";
    $("espKeyHelp").textContent=device.hasKey?"Leave blank to keep the stored encryption key. Enter a replacement only when rotating the device key.":"No encryption key is stored for this device. Leave blank to keep using an intentionally unencrypted API, or enter the device’s existing key.";
    $("espEnrollment").open=true;$("espName").focus();
  }
  function useDiscovered(device){
    if(saving||managementBusy||!admin())return;
    resetEditor();const address=(device.addresses||[]).find(value=>/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(value));
    if(!address){$("espFormMessage").textContent="This discovery result has no supported private IPv4 address yet.";return}
    $("espName").value=device.name||device.host?.replace(/\.local$/i,"")||"ESPHome device";$("espAddress").value=address;$("espPort").value=device.port||6053;
    $("espEnrollment").open=true;$("espFormMessage").textContent="Device selected from mDNS discovery. Try Verify & add with the key blank first if you know its native API is unencrypted; otherwise enter its existing encryption key.";$("espKey").focus();
  }
  function renderDiscovery(){
    discoveryCard.hidden=!admin();discoveryButton.disabled=discovering||saving||managementBusy;discoveryButton.textContent=discovering?"Scanning…":"Scan network";
    if(!admin()){discoveryRows.replaceChildren();return}
    if(!discovered.length){discoveryRows.replaceChildren(element("p",discovering?"Listening for ESPHome mDNS advertisements…":"No ESPHome native API advertisements found yet. mDNS must reach this RoomGoblin host; routed VLANs may need an mDNS reflector.","muted"));return}
    const rows=discovered.map(device=>{
      const row=element("div",undefined,"card"),title=element("strong",device.name||device.host||"ESPHome device"),meta=element("p",`${(device.addresses||[]).join(", ")}:${device.port||6053}${device.mac?" · "+device.mac:""}${device.version?" · ESPHome "+device.version:""}${device.platform?" · "+device.platform:""}`,"muted"),actions=element("div",undefined,"toolbar");
      if(device.enrolled)actions.append(element("span","Already enrolled","pill"));else{const adopt=button("Configure / adopt",()=>useDiscovered(device));adopt.disabled=saving||managementBusy;actions.append(adopt)}
      row.append(title,meta,actions);return row;
    });
    discoveryRows.replaceChildren(...rows);
  }
  async function scanDiscovery(force=false){
    if(!admin()||discovering||!active()||saving||managementBusy)return;if(!force&&Date.now()-lastDiscovery<15000)return;
    const revision=inventoryRevision,owner=authRevision;
    discovering=true;renderDiscovery();
    try{const result=await api(`/api/v1/esphome/discovery${force?"?force=1":""}`);if(owner!==authRevision||revision!==inventoryRevision||!admin()||!active())return;discovered=result.devices||[];lastDiscovery=Date.now();discoveryStatus.textContent=`${discovered.length} ESPHome advertisement(s) found. Discovery does not expose encryption keys.`}
    catch(error){if(owner===authRevision&&revision===inventoryRevision&&admin()&&active())discoveryStatus.textContent=`Discovery failed: ${error.message}`}
    finally{discovering=false;renderDiscovery()}
  }
  async function change(device,remove=false){
    if(!device||!admin()||saving||managementBusy||busy.has(device.id))return;
    if(remove&&!confirm(`Remove ${device.name} from RoomGoblin and delete its stored API key? This does not reset or power off the hardware.`))return;
    const owner=authRevision;managementBusy=true;inventoryRevision++;managementMessage="";
    busy.add(device.id);render();
    try{
      const result=remove?await api(endpoint(device.id),{method:"DELETE"}):await write(endpoint(device.id)+"/enabled",{enabled:!device.enabled});
      if(owner!==authRevision||!userCan("classroom.read"))return;
      devices=result.devices;stale=false;inventoryMessage=result.workerError||"";managementMessage=remove?"Device removed.":`Device ${device.enabled?"disabled":"enabled"}.`;
      if(remove&&editing===device.id){resetEditor();$("espEnrollment").open=false}lastDiscovery=0;
    }catch(error){if(owner===authRevision&&userCan("classroom.read"))managementMessage=error.message}
    finally{managementBusy=false;busy.delete(device.id);render();refresh();scanDiscovery().catch(()=>{})}
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
      if(entity.domain==="number"){input.type="number";input.min=entity.min;input.max=entity.max;input.step=entity.step}else for(const option of entity.options||[]){const node=element("option",option);node.value=option;input.append(node)}
      controls.append(input,button("Set value",()=>{if(input.value!==""&&input.reportValidity()){input.dataset.dirty="";send(device,entity,{state:entity.domain==="number"?Number(input.value):input.value},message)}}));
    }else if(writable&&entity.domain==="button")controls.append(button("Press button",()=>send(device,entity,{press:true},message)));else controls.append(element("span","Read only","muted"));
    input?.addEventListener("input",()=>{input.dataset.dirty="true"});input?.addEventListener("change",()=>{input.dataset.dirty="true"});
    return {root,value,controls,input,entity};
  }
  function makeCard(device){
    const card=element("article",undefined,"card esp-device"),title=element("h2",device.name),meta=element("p","","muted"),status=element("p"),manage=element("div",undefined,"toolbar"),detail=element("details"),summary=element("summary","Entities"),rows=element("div",undefined,"esp-entities");
    manage.append(button("Edit",()=>edit(devices.find(d=>d.id===device.id))),button("Disable",()=>change(devices.find(d=>d.id===device.id))),button("Remove",()=>change(devices.find(d=>d.id===device.id),true)));
    detail.append(summary,rows);card.append(title,meta,status,manage,detail);return {card,title,meta,status,manage,detail,summary,rows,signature:"",entities:[]};
  }
  function render(){
    $("espMessage").textContent=[managementMessage,inventoryMessage].filter(Boolean).join(" ");
    $("espSave").disabled=saving||managementBusy;
    $("espEnrollment").hidden=!admin();renderDiscovery();
    const query=$("espSearch").value.toLowerCase().trim(),filter=$("espFilter").value,ids=new Set();let visible=0;
    for(const device of devices){
      ids.add(device.id);let view=cards.get(device.id);if(!view){view=makeCard(device);cards.set(device.id,view);inventory.append(view.card)}
      const match=[device.name,device.address,device.mac,device.info?.model].join(" ").toLowerCase().includes(query)&&(filter==="all"||(filter==="online"&&device.online)||(filter==="offline"&&!device.online));
      view.card.hidden=!match;if(match)visible++;
      view.title.textContent=device.name;view.meta.textContent=`${device.address}:${device.port} · ${device.mac} · ${device.info?.model||"ESPHome"} · firmware ${device.info?.esphome_version||"unknown"}`;
      view.status.textContent=stale?"Inventory stale — controls paused":device.online?`Connected · ${device.hasKey?"encrypted":"unencrypted"} native API`:`${device.enabled?"Not connected":"Disabled"} · ${device.error||"waiting for connection"}`;
      view.manage.hidden=!admin();view.manage.children[1].textContent=device.enabled?"Disable":"Enable";
      for(const b of view.manage.querySelectorAll("button"))b.disabled=busy.has(device.id)||saving||managementBusy;
      const signature=JSON.stringify([device.generation,device.entities]);
      if(signature!==view.signature){view.signature=signature;view.entities=(device.entities||[]).map(e=>entityCard(device,e));view.rows.replaceChildren(...view.entities.map(e=>e.root))}
      view.summary.textContent=`Entities (${view.entities.length})`;
      for(const row of view.entities){
        const state=device.states?.[row.entity.id],value=state&&!state.missing_state?state.state:null,label=value===true?"On":value===false?"Off":value===null||value===undefined?"No state received":String(value);
        row.value.textContent=`${label}${row.entity.unit?" "+row.entity.unit:""}${!device.online&&state?" (last reported)":""}${state?.updatedAt?" · "+new Date(state.updatedAt).toLocaleTimeString():""}`;
        const allowed=!stale&&device.online&&device.enabled&&userCan("integrations.control")&&(!row.entity.adminOnly||admin())&&!busy.has(device.id)&&!saving&&!managementBusy;
        for(const control of row.controls.querySelectorAll("button,input,select"))control.disabled=!allowed;
        if(row.input&&!row.input.dataset.dirty&&document.activeElement!==row.input){const next=row.entity.domain==="light"&&typeof state?.brightness==="number"?Math.round(state.brightness*100):value;if(next!==null&&next!==undefined)row.input.value=String(next)}
      }
    }
    for(const [id,view] of cards)if(!ids.has(id)){view.card.remove();cards.delete(id)}
    $("espSummary").textContent=`${devices.length} enrolled · ${devices.filter(d=>d.online).length} connected · ${visible} shown`;
    $("espEmpty").hidden=visible>0;$("espEmpty").textContent=devices.length?"No devices match these filters.":"No ESPHome devices enrolled. RoomGoblin will automatically scan for native API advertisements when an administrator opens this page.";
  }
  async function refresh(){
    if(!active()||loading||saving||managementBusy)return;loading=true;
    const revision=inventoryRevision,owner=authRevision;
    try{const result=await api("/api/v1/esphome/devices");if(!active()||revision!==inventoryRevision||owner!==authRevision)return;devices=result.devices||[];stale=false;inventoryMessage=result.workerError||""}
    catch(error){if(active()&&revision===inventoryRevision&&owner===authRevision){stale=true;inventoryMessage=`${error.message} Last inventory retained; controls are paused.`}}
    finally{loading=false;render()}
  }
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(saving||managementBusy||!admin()||!form.reportValidity())return;
    const owner=authRevision,acceptedEditing=editing;inventoryRevision++;managementMessage="";
    const payload={name:$("espName").value,address:$("espAddress").value,port:Number($("espPort").value),key:$("espKey").value};
    $("espKey").value="";saving=true;$("espSave").disabled=true;$("espFormMessage").textContent="Verifying native API access and device identity…";render();
    try{
      const result=await write(acceptedEditing?endpoint(acceptedEditing):"/api/v1/esphome/devices",payload,acceptedEditing?"PUT":"POST");
      if(owner!==authRevision||!admin())return;
      devices=result.devices;stale=false;inventoryMessage=result.workerError||"";
      const unchanged=editing===acceptedEditing&&$("espName").value===payload.name&&$("espAddress").value===payload.address&&Number($("espPort").value)===payload.port&&$("espKey").value==="";
      if(unchanged)resetEditor();
      else if(editing===acceptedEditing){
        const saved=devices.find(device=>acceptedEditing?device.id===acceptedEditing:device.address===payload.address&&Number(device.port)===payload.port);
        if(saved){editing=saved.id;$("espSave").textContent="Verify & save changes"}
      }
      $("espFormMessage").textContent=unchanged?"Saved. The native connection will populate entities when ready.":"Saved. Your newer edits remain in the form.";lastDiscovery=0;
    }
    catch(error){if(owner===authRevision&&admin())$("espFormMessage").textContent=error.message.includes("encryption-failed")?"This device requires ESPHome API encryption. Enter its existing api.encryption.key; RoomGoblin cannot discover that secret from the network.":error.message}
    finally{payload.key="";saving=false;render();refresh();scanDiscovery().catch(()=>{})}
  });
  $("espCancel").addEventListener("click",()=>{if(!saving&&!managementBusy){resetEditor();$("espEnrollment").open=false}});$("espEnrollment").addEventListener("toggle",()=>{if(!$("espEnrollment").open)$("espKey").value=""});
  $("espRefresh").addEventListener("click",refresh);$("espSearch").addEventListener("input",render);$("espFilter").addEventListener("change",render);
  window.addEventListener("roomgoblin:authchange",()=>{authRevision++;inventoryRevision++;lastDiscovery=0;managementMessage="";inventoryMessage="";$("espFormMessage").textContent="";$("espKey").value="";if(!admin()){discovered=[];resetEditor()}if(!userCan("classroom.read")){devices=[];stale=true}render();refresh();scanDiscovery()});
  new MutationObserver(()=>{if(active()){refresh();scanDiscovery()}else $("espKey").value=""}).observe(page,{attributes:true,attributeFilter:["class"]});
  document.addEventListener("visibilitychange",()=>{if(active()){refresh();scanDiscovery()}});
  setInterval(refresh,3000);setInterval(()=>scanDiscovery(),30000);resetEditor();render();
})();
