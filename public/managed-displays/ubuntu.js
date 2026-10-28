/* Ubuntu computers and their independent physical screens. No saved SSH bootstrap credentials. */
(()=>{
  "use strict";
  const $=id=>document.getElementById(id),base="/api/v1/ubuntu-displays";
  let inventory={devices:[],receivers:{}},probe=null,editing=null,repairing=null,step=0,polling=false,wizardVersion=0;
  const currentWizard=version=>version===wizardVersion&&$("ubuntuWizard").open;
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const date=value=>value?new Date(typeof value==="number"?value*1000:value).toLocaleString():"Not yet checked";
  const percent=(part,total)=>Number.isFinite(part)&&total>0?Math.round(100*part/total)+"%":"Unavailable";
  const maintenanceCopy={"check-updates":"Refresh Ubuntu’s package lists and report available updates. This does not install packages.","update-os":"Install available updates from this computer’s configured Ubuntu package sources. Preserve configuration files; do not remove packages or upgrade Ubuntu to another release. A reboot may be required and remains a separate action. Package updates do not have an automatic OS rollback.","update-browser":"Update the installed Chromium Snap. Stop and restart the managed graphical session so every screen can use the new browser.","revert-browser":"Ask Snap to restore its previous retained Chromium revision. Restart all screen sessions. A retained revision must be available.","update-agent":"Install the agent package matching this Hub from trusted RoomGoblin main. Verify its content, retain the previous agent and restart all screen sessions. A failed package verification restores the previous agent.","revert-agent":"Restore the previous retained RoomGoblin agent and restart all screen sessions. Screen assignments and browser profiles are preserved."};
  let maintenanceDevice=null,detailsDevice=null,dialogVersion=0;
  let inventoryVersion=0,inventoryWrites=0,loadAgain=false;
  const pendingCommands=new Set(),computerMessages=new Map();
  let previewVersion=0,previewFocus=null;
  async function request(path="",method="GET",body){
    const options={method,credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})};
    const writes=method!=="GET"&&path!=="/host-key"&&path!=="/probe"&&!(path.endsWith("/command")&&body?.action==="screenshot");
    if(writes){inventoryVersion++;inventoryWrites++;loadAgain=true}
    try{
      const response=await fetch(base+path,options);
      let value;try{value=await response.json()}catch{throw Error(`Request failed (${response.status}). Refresh computer status before retrying; delivery may be unconfirmed.`)}
      if(!response.ok||value.ok===false)throw Error(value.error||`Request failed (${response.status})`);return value;
    }finally{if(writes){inventoryVersion++;inventoryWrites--;if(!inventoryWrites)void load()}}
  }
  function computerMessage(id,text){computerMessages.set(id,text);for(const card of $("ubuntuComputers").querySelectorAll("[data-id]"))if(card.dataset.id===id)card.querySelector(".ubuntu-card-message").textContent=text}
  function message(text){$("ubuntuMessage").textContent=text}
  function wizardStep(value){step=value;document.querySelectorAll("[data-ubuntu-step]").forEach(el=>el.hidden=Number(el.dataset.ubuntuStep)!==value);$("ubuntuStep").textContent=["1 · Connect","2 · Assign screens","3 · Review installation","4 · Installation"][value];$("ubuntuBack").hidden=value===0||value===3;$("ubuntuNext").hidden=value===3;$("ubuntuNext").textContent=value===0?"Check computer":value===1?"Review installation":editing?"Save screen assignments":"Install RoomGoblin";message("")}
  function clearCredentials(){for(const id of ["ubuntuPassword","ubuntuKey","ubuntuPassphrase"])$(id).value="";$("ubuntuKeyFile").value=""}
  function closeWizard(){wizardVersion++;clearCredentials();probe=null;editing=null;repairing=null;$("ubuntuActivate").hidden=true;delete $("ubuntuActivate").dataset.device;$("ubuntuWizard").close()}
  function auth(){return {address:$("ubuntuAddress").value.trim(),port:Number($("ubuntuPort").value),username:$("ubuntuUsername").value.trim(),password:$("ubuntuPassword").value,privateKey:$("ubuntuKey").value,passphrase:$("ubuntuPassphrase").value,fingerprint:$("ubuntuFingerprint").value.trim()}}
  function assignments(){return [...$("ubuntuOutputRows").querySelectorAll("[data-connector]")].filter(row=>row.querySelector('[name="use"]').checked).map(row=>({connector:row.dataset.connector,monitorId:row.dataset.monitor,
    receiverId:row.querySelector('[name="receiver"]').value.trim(),name:row.querySelector('[name="screenName"]').value.trim(),mode:row.querySelector('[name="mode"]').value,rotation:row.querySelector('[name="rotation"]').value,audioSink:row.querySelector('[name="audioSink"]').value,graphicsMode:row.querySelector('[name="graphicsMode"]').value,enabled:row.querySelector('[name="enabled"]').checked}))}
  function screenRows(config=null){
    const connected=(probe.outputs||[]).filter(o=>o.connected);
    for(const saved of config?.screens||[])if(!connected.some(o=>o.connector===saved.connector))connected.push({connector:saved.connector,monitorId:saved.monitorId,modes:saved.mode==="auto"?[]:[saved.mode],connected:false});
    $("ubuntuProbeSummary").textContent=`${probe.hostname} · Ubuntu ${probe.version} · ${connected.filter(o=>o.connected).length} connected screens`;
    $("ubuntuOutputRows").innerHTML=connected.map((output,index)=>{
      const saved=config?.screens.find(s=>s.connector===output.connector),receiver=saved?.receiverId||"";
      return `<fieldset class="ubuntu-output" data-connector="${esc(output.connector)}" data-monitor="${esc(output.monitorId)}"><legend>Screen ${index+1} · ${esc(output.connector)}</legend><label class="ubuntu-checkbox"><input type="checkbox" name="use" ${!output.monitorId?"disabled":(!config||saved)?"checked":""}>Use this output</label>${!output.monitorId?'<p class="warning">Monitor identity unavailable. Check its cable/adapter before enrollment.</p>':""}<div class="grid"><label>Screen name<input name="screenName" value="${esc(saved?.name||`${probe.hostname} screen ${index+1}`)}" maxlength="100"></label><label>Receiver ID<input name="receiver" list="ubuntuReceivers" value="${esc(receiver)}" placeholder="Unique existing or new ID" pattern="[a-zA-Z0-9_-]{1,40}" maxlength="40"></label><label>Resolution<select name="mode"><option value="auto">Recommended</option>${output.modes.map(m=>`<option ${saved?.mode===m?"selected":""}>${esc(m)}</option>`).join("")}</select></label><label>Rotation<select name="rotation">${[["normal","Landscape"],["left","Portrait left"],["right","Portrait right"],["inverted","Upside down"]].map(([v,label])=>`<option value="${v}" ${saved?.rotation===v?"selected":""}>${label}</option>`).join("")}</select></label><label class="wide">Audio output<select name="audioSink">${[{name:"default",description:"Computer default"},{name:"muted",description:"Muted"},...(probe.audio?.sinks||[])].map(sink=>`<option value="${esc(sink.name)}" ${(saved?.audioSink||"default")===sink.name?"selected":""}>${esc(sink.description)}</option>`).join("")}</select></label></div></fieldset>`;
    }).join("")||'<p class="warning">This computer needs its Xorg kiosk session prepared first. Continue to install, activate the kiosk, then use Assign screens to map the detected monitors. Existing desktop configuration is saved for rollback.</p>';
    $("ubuntuReceivers").innerHTML=Object.entries(inventory.receivers).map(([id,d])=>`<option value="${esc(id)}">${esc(d.name||id)}</option>`).join("");
    for(const row of $("ubuntuOutputRows").querySelectorAll("[data-connector]")){
      const saved=config?.screens.find(s=>s.connector===row.dataset.connector),sink=row.querySelector('[name="audioSink"]');
      if(saved?.audioSink&&![...sink.options].some(o=>o.value===saved.audioSink)){sink.add(new Option(saved.audioSink+" · unavailable; kept muted",saved.audioSink));sink.value=saved.audioSink}
      row.querySelector('.grid').insertAdjacentHTML('beforeend',`<label>Graphics<select name="graphicsMode"><option value="auto" ${(saved?.graphicsMode||(saved?"software":"auto"))==="auto"?"selected":""}>Automatic hardware acceleration</option><option value="software" ${(saved?.graphicsMode||(saved?"software":"auto"))==="software"?"selected":""}>Software compatibility</option></select></label><label class="ubuntu-checkbox"><input type="checkbox" name="enabled" ${saved?.enabled===false?"":"checked"}>Run this screen</label>`);
    }
    for(const output of connected.filter(o=>!o.connected)){
      const row=[...$("ubuntuOutputRows").querySelectorAll("[data-connector]")].find(r=>r.dataset.connector===output.connector);
      const saved=config.screens.find(s=>s.connector===output.connector),sink=row.querySelector('[name="audioSink"]');
      if(saved.audioSink&&![...sink.options].some(o=>o.value===saved.audioSink)){sink.add(new Option(saved.audioSink,saved.audioSink));sink.value=saved.audioSink}
      row.querySelector("legend").textContent+=" · disconnected; assignment retained";
      row.querySelectorAll("input,select").forEach(el=>el.disabled=true);
    }
  }
  async function load(){
    if(inventoryWrites){loadAgain=true;return false}
    if(polling)return polling;
    loadAgain=false;const version=inventoryVersion;
    const pending=(async()=>{
      let accepted=false;
      try{const value=await request();if(version===inventoryVersion&&!inventoryWrites){inventory=value;render();accepted=true}else loadAgain=true}
      catch(e){if(version===inventoryVersion&&!inventoryWrites)$("ubuntuStatus").textContent=e.message+" Showing last available inventory.";else loadAgain=true}
      finally{polling=false}
      return loadAgain&&!inventoryWrites?load():accepted;
    })();
    polling=pending;return pending;
  }
  function render(){
    const root=$("ubuntuComputers"),open=new Set([...root.querySelectorAll("details[open]")].map(d=>d.dataset.computer));
    const focus=document.activeElement,focused=root.contains(focus)?{id:focus.closest('[data-id]')?.dataset.id,action:focus.dataset.action,screen:focus.dataset.screen,detail:focus.tagName==="SUMMARY"?focus.parentElement.dataset.computer:null}:null;
    const query=$("ubuntuSearch").value.trim().toLowerCase(),filter=$("ubuntuFilter").value;
    const visible=inventory.devices.filter(d=>(filter==="all"||(d.health?.state||(d.live?.online?"healthy":"offline"))===filter)&&(!query||[d.name,d.address,d.location,...d.config.screens.flatMap(s=>[s.name,s.receiverId,s.connector])].join(" ").toLowerCase().includes(query)));
    const healthy=inventory.devices.filter(d=>d.health?.state==="healthy").length;
    $("ubuntuStatus").textContent=`${visible.length} of ${inventory.devices.length} computers · ${inventory.devices.reduce((n,d)=>n+d.config.screens.length,0)} screens · ${healthy} healthy`;
    root.innerHTML=visible.map(device=>{
      const status=device.live?.status,online=device.live?.online,session=status?.session,h=status?.health,job=status?.maintenance?.job,updates=status?.maintenance?.updates;
      const state=device.health?.state||(online?"healthy":"offline"),busy=["running","queued"].includes(job?.state),modern=Number(status?.protocolVersion||device.reported?.protocolVersion)>=2;
      const gb=value=>Number.isFinite(value)?(value/1073741824).toFixed(1)+" GiB":"Unavailable";
      const details=(key,label,content)=>`<details data-computer="${esc(device.id+key)}" ${open.has(device.id+key)?"open":""}><summary>${label}</summary>${content}</details>`;
      return `<article class="card ubuntu-computer" data-id="${esc(device.id)}"><div class="card-head"><div><h3>${esc(device.name)}</h3><small>${esc(device.location||"Location not set")} · ${esc(device.address)}</small></div><span class="pill ${state==="healthy"?"ok":"warn"}">${state==="healthy"?"Healthy":state==="attention"?"Needs attention":"Offline / unconfirmed"}</span></div><p class="subtle">${online?(session?.online?"Computer connected · Display session running":"Computer connected · Display session needs attention"):esc(device.live?.error||device.state)} · Last seen ${esc(date(online?device.live.at/1000:device.lastSeenAt))}</p>
      <div class="ubuntu-metrics"><div><small>CPU usage</small><strong>${h?.cpuPercent==null?"Measuring…":Math.round(h.cpuPercent)+"%"}</strong></div><div><small>Memory used</small><strong>${percent(h?.memoryTotalKiB-h?.memoryAvailableKiB,h?.memoryTotalKiB)}</strong></div><div><small>Disk free</small><strong>${gb(h?.diskFreeBytes)}</strong></div><div><small>Uptime</small><strong>${h?Math.floor(h.uptimeSeconds/3600)+"h "+Math.floor(h.uptimeSeconds%3600/60)+"m":"Unavailable"}</strong></div></div>
      ${device.health?.alerts?.length?`<ul class="ubuntu-alerts">${device.health.alerts.map(a=>`<li>${esc(a.text)}</li>`).join("")}</ul>`:""}
      <div class="ubuntu-screens">${device.config.screens.map(screen=>{
        const live=session?.screens?.find(s=>s.receiverId===screen.receiverId);
        return `<section class="ubuntu-screen"><div><strong>${esc(screen.name)}</strong><small>${esc(screen.connector)} → ${esc(screen.receiverId)}</small><small>${esc(screen.mode)} · ${esc(screen.rotation)} · ${screen.enabled===false?"Paused":"Enabled"}</small></div><div class="ubuntu-screen-state">${screen.receiverOnline?"Receiver connected":"Receiver disconnected"} · ${live?.browserRunning?"Browser running":"Browser unconfirmed"}${live?.error?` · ${esc(live.error)}`:""}</div><div class="controls"><button data-action="screenshot" data-screen="${esc(screen.receiverId)}" ${online&&!busy?"":"disabled"}>Preview</button><button data-action="restart-screen" data-screen="${esc(screen.receiverId)}" ${online&&!busy?"":"disabled"}>Restart screen</button></div></section>`;
      }).join("")}</div><div class="controls"><button data-action="refresh">Refresh status</button><button data-action="edit" ${online&&!busy?"":"disabled"}>Assign screens</button><button data-action="identify" ${online&&!busy?"":"disabled"}>Identify screens</button><button data-action="details">Edit computer</button></div>
      ${details("updates","Software & updates",`<dl class="ubuntu-software"><dt>Ubuntu / kernel</dt><dd>${esc(status?.version||"Unknown")} · ${esc(status?.kernel||"Unknown")}</dd><dt>Chromium</dt><dd>${esc(status?.browser?.version||"Unknown")} · revision ${esc(status?.browser?.revision||"unknown")}</dd><dt>RoomGoblin agent</dt><dd>${esc(status?.agentVersion||"Unknown")} · ${!online||!status?.packageDigest?"Package not verified":device.agentUpdateAvailable?"Update available":"Matches Hub package"}</dd><dt>Ubuntu updates</dt><dd>${updates?.checkedAt?`${updates.count} available · ${updates.securityCount} from security sources · checked ${esc(date(updates.checkedAt))}`:"Not checked yet"}</dd><dt>Chromium update</dt><dd>${updates?.browser?.available===true?esc(updates.browser.version)+" available":updates?.browser?.available===false?"Up to date at last check":"Not confirmed"}</dd><dt>Reboot</dt><dd>${status?.rebootRequired?"Required":"Not currently reported"}</dd></dl>${!modern?'<p class="warning">Use Repair once to enable managed updates on this older agent.</p>':""}<div class="controls"><button data-action="maintenance" ${modern&&!busy?"":"disabled"}>Manage updates</button><button data-action="repair">Repair / update agent</button></div>${job?.id?`<p class="ubuntu-job"><strong>${esc(job.operation)} · ${esc(job.state)}</strong><br>${esc(job.stage)}<br><small>Started ${esc(date(job.startedAt))}</small></p>`:""}${device.scheduled?`<p class="ubuntu-job">${esc(device.scheduled.operation)} · ${esc(device.scheduled.state)} · ${esc(date(device.scheduled.at))}${device.scheduled.error?`<br>${esc(device.scheduled.error)}`:""}</p>${device.scheduled.state==="scheduled"?'<button data-action="cancel-schedule">Cancel scheduled maintenance</button>':""}`:""}${updates?.packages?.length?`<details data-computer="${esc(device.id+"packages")}" ${open.has(device.id+"packages")?"open":""}><summary>Available package details (${updates.count})</summary><ul class="ubuntu-packages">${updates.packages.slice(0,100).map(p=>`<li>${esc(p.name)} · ${esc(p.installed)} → ${esc(p.candidate)}${p.security?" · security":""}</li>`).join("")}</ul>${updates.count>100?'<p>Showing the first 100 packages.</p>':""}</details>`:""}`)}
      ${details("maintenance","Computer maintenance",'<div class="controls"><button data-action="activate">Activate / restart kiosk</button><button data-action="reboot">Reboot computer</button><button data-action="shutdown">Shut down</button><button data-action="rollback">Restore previous desktop</button><button data-action="remove">Remove enrollment</button></div><p class="subtle">Computer actions affect all its screens. Desktop rollback restores the pre-installation configuration; it does not roll back Ubuntu packages.</p>')}
      ${details("history","Health & maintenance history",`<ol class="ubuntu-history">${[...(status?.maintenance?.history||[]).map(e=>({at:e.finishedAt,kind:e.operation,state:e.state})),...(device.history||[])].sort((a,b)=>new Date(typeof b.at==="number"?b.at*1000:b.at)-new Date(typeof a.at==="number"?a.at*1000:a.at)).slice(0,30).map(e=>`<li><time>${esc(date(e.at))}</time> · ${esc(e.kind)} · ${esc(e.state||e.operation||e.action||e.message||"")}${e.alerts?.length?`<br>${e.alerts.map(a=>esc(a.text)).join(" · ")}`:""}</li>`).join("")||'<li>No recorded events yet.</li>'}</ol>`)}<p class="ubuntu-card-message" role="status"></p></article>`;
    }).join("")||`<p class="empty">${inventory.devices.length?"No computers match these filters.":"Add an Ubuntu computer to manage each connected monitor as an independent screen."}</p>`;
    for(const id of computerMessages.keys())if(!pendingCommands.has(id)&&!inventory.devices.some(d=>d.id===id))computerMessages.delete(id);
    for(const card of root.querySelectorAll("[data-id]")){
      card.querySelector(".ubuntu-card-message").textContent=computerMessages.get(card.dataset.id)||"";
      if(pendingCommands.has(card.dataset.id))card.querySelectorAll("button").forEach(button=>button.disabled=true);
    }
    if(focused?.detail)[...root.querySelectorAll("details[data-computer]")].find(d=>d.dataset.computer===focused.detail)?.querySelector("summary")?.focus({preventScroll:true});
    if(focused?.action){const button=[...root.querySelectorAll('button[data-action]')].find(b=>b.closest('[data-id]').dataset.id===focused.id&&b.dataset.action===focused.action&&b.dataset.screen===focused.screen);(button&&!button.disabled?button:$("ubuntuSearch")).focus({preventScroll:true})}
  }
  async function openWizard(device=null,repair=false){
    const version=++wizardVersion;$("ubuntuActivate").hidden=true;delete $("ubuntuActivate").dataset.device;$("ubuntuJobStatus").textContent="";$("ubuntuNext").disabled=false;
    clearCredentials();$("ubuntuForm").reset();editing=null;repairing=null;probe=null;
    $("ubuntuHubUrl").value=location.origin;$("ubuntuUsername").value="root";$("ubuntuPort").value="22";$("ubuntuFingerprint").value="";$("ubuntuHostVerified").checked=false;
    wizardStep(0);$("ubuntuWizard").showModal();
    if(device){
      $("ubuntuName").value=device.name;$("ubuntuAddress").value=device.address;$("ubuntuPort").value=device.port;
      $("ubuntuFingerprint").value=device.fingerprint;$("ubuntuHubUrl").value=device.config.hubUrl;
      if(repair){repairing=device.id;message("Use the original administrator SSH access to repair/update this computer. Its management identity and browser profiles will be retained.")}
      else{
        editing=device.id;
        try{await request(`/${device.id}/refresh`,"POST",{});const accepted=await load();if(!currentWizard(version))return;if(!accepted)throw Error("Computer status could not be refreshed. Try again.");const fresh=inventory.devices.find(d=>d.id===device.id);probe=fresh?.live?.status;if(!probe)throw Error("Computer could not be checked.");screenRows(fresh.config);wizardStep(1)}catch(e){if(currentWizard(version))message(e.message)}
      }
    }
  }
  $("ubuntuAdd").addEventListener("click",()=>openWizard());
  $("ubuntuClose").addEventListener("click",closeWizard);
  $("ubuntuWizard").addEventListener("cancel",event=>{event.preventDefault();closeWizard()});
  $("ubuntuBack").addEventListener("click",()=>wizardStep(Math.max(editing?1:0,step-1)));
  $("ubuntuKeyFile").addEventListener("change",async()=>{const version=wizardVersion,file=$("ubuntuKeyFile").files[0];if(file&&file.size<=32768){const key=await file.text();if(currentWizard(version)&&$("ubuntuKeyFile").files[0]===file)$("ubuntuKey").value=key}else message("Choose an SSH private key under 32 KiB.")});
  for(const id of ["ubuntuAddress","ubuntuPort"])$(id).addEventListener("input",()=>{$("ubuntuFingerprint").value="";$("ubuntuHostVerified").checked=false});
  $("ubuntuGetFingerprint").addEventListener("click",async()=>{const version=wizardVersion,address=$("ubuntuAddress").value.trim(),port=Number($("ubuntuPort").value);try{message("Reading SSH host fingerprint…");const result=await request("/host-key","POST",{address,port});if(!currentWizard(version)||address!==$("ubuntuAddress").value.trim()||port!==Number($("ubuntuPort").value))return;$("ubuntuFingerprint").value=result.fingerprint;$("ubuntuHostVerified").checked=false;message("Compare this fingerprint with the computer or your trusted SSH inventory, then accept it.")}catch(e){if(currentWizard(version))message(e.message)}});
  $("ubuntuForm").addEventListener("submit",async event=>{
    event.preventDefault();const button=$("ubuntuNext"),version=wizardVersion;button.disabled=true;
    try{
      if(step===0){
        if(!$("ubuntuHostVerified").checked)throw Error("Verify and accept the SSH fingerprint before continuing.");
        message("Checking Ubuntu, permissions and physical outputs…");const result=await request("/probe","POST",auth());if(!currentWizard(version))return;probe=result;screenRows(repairing?inventory.devices.find(d=>d.id===repairing)?.config:null);wizardStep(1);
      }else if(step===1){
        const screens=assignments();if((!screens.length&&(editing||probe.graphics==="x11"))||screens.some(s=>!s.receiverId))throw Error("Assign a unique receiver ID to every selected screen.");
        if(new Set(screens.map(s=>s.receiverId)).size!==screens.length)throw Error("Each output needs a different receiver ID.");
        $("ubuntuReview").textContent=screens.map(s=>`${s.connector} → ${s.name} (${s.receiverId}) · ${s.mode} · ${s.rotation}`).join("\n")||"Prepare the Xorg kiosk. Assign its physical screens after activation.";
        $("ubuntuInstallDetails").hidden=Boolean(editing);wizardStep(2);
      }else if(step===2){
        const body={hubUrl:$("ubuntuHubUrl").value,screens:assignments()};
        if(editing){await request(`/${editing}/screens`,"PUT",body);if(currentWizard(version))closeWizard();await load();return}
        if(!$("ubuntuConsent").checked)throw Error("Confirm the installation changes before continuing.");
        const result=await request("","POST",{...auth(),...body,name:$("ubuntuName").value,id:repairing||undefined,confirm:true});
        if(!currentWizard(version))return;clearCredentials();wizardStep(3);watchJob(result.job.id,version);
      }
    }catch(e){if(currentWizard(version))message(e.message)}finally{if(currentWizard(version))button.disabled=false}
  });
  async function watchJob(id,version){
    if(!currentWizard(version))return;
    try{
      const {job}=await request(`/jobs/${id}`);if(!currentWizard(version))return;$("ubuntuJobStatus").textContent=job.error||job.stage;
      if(job.state==="running"){setTimeout(()=>watchJob(id,version),3000);return}
      $("ubuntuActivate").hidden=job.state!=="completed";$("ubuntuActivate").dataset.device=job.deviceId;await load();
    }catch(e){if(currentWizard(version))$("ubuntuJobStatus").textContent=e.message}
  }
  $("ubuntuActivate").addEventListener("click",async()=>{
    const version=wizardVersion,deviceId=$("ubuntuActivate").dataset.device;if(!currentWizard(version)||!deviceId||$("ubuntuActivate").hidden)return;
    if(!confirm("Activate the RoomGoblin kiosk now? This restarts the computer’s graphical session and affects all attached screens."))return;
    try{await request(`/${deviceId}/command`,"POST",{action:"activate",confirm:true});if(!currentWizard(version))return;$("ubuntuJobStatus").textContent="Activation requested. Refresh status to verify every screen.";$("ubuntuActivate").hidden=true}catch(e){if(currentWizard(version))message(e.message)}
  });
  $("ubuntuComputers").addEventListener("click",async event=>{
    const button=event.target.closest("button[data-action]"),card=button?.closest("[data-id]");if(!card)return;
    const device=inventory.devices.find(d=>d.id===card.dataset.id),action=button.dataset.action;
    if(!device||pendingCommands.has(device.id))return;
    if(action==="edit"||action==="repair"){openWizard(device,action==="repair");return}
    if(action==="details"){
      dialogVersion++;detailsDevice=device.id;$("ubuntuDetailsForm").reset();$("ubuntuDetailsMessage").textContent="";$("ubuntuDetailsSubmit").disabled=false;
      for(const [field,key] of [["Name","name"],["Location","location"],["Address","address"],["Port","port"],["Notes","notes"]])$("ubuntuDetail"+field).value=device[key]||"";
      $("ubuntuDetails").showModal();return;
    }
    if(action==="maintenance"){
      dialogVersion++;maintenanceDevice=device.id;$("ubuntuMaintenanceForm").reset();$("ubuntuMaintenanceMessage").textContent="";$("ubuntuMaintenanceSubmit").disabled=false;
      $("ubuntuMaintenanceComputer").textContent=device.name+" · "+device.config.screens.length+" screens";updateMaintenanceForm();$("ubuntuMaintenance").showModal();return;
    }
    if(action==="cancel-schedule"){
      if(!confirm("Cancel this computer’s scheduled maintenance?"))return;
      pendingCommands.add(device.id);computerMessage(device.id,"Cancelling scheduled maintenance…");render();
      try{await request(`/${device.id}/schedule`,"DELETE",{});computerMessage(device.id,"Scheduled maintenance cancelled.");await load()}catch(e){computerMessage(device.id,e.message)}finally{pendingCommands.delete(device.id);render()}return;
    }
    const confirmations={activate:"Activate this computer’s RoomGoblin kiosk? Its graphical session will restart.",reboot:"Reboot this computer and interrupt all its screens?",shutdown:"Shut down this computer and all its screens? Remote power-on is not guaranteed.",rollback:"Restore the computer’s pre-installation desktop configuration? This stops all RoomGoblin screen sessions.",remove:"Remove management enrollment? The computer keeps running and receiver assignments/data remain. Restore its previous desktop first if you also want to stop the kiosk."};
    if(confirmations[action]&&!confirm(confirmations[action]))return;
    pendingCommands.add(device.id);computerMessage(device.id,"Working…");render();
    let capture=0;
    if(action==="screenshot"){capture=++previewVersion;previewFocus={id:device.id,screen:button.dataset.screen};$("ubuntuPreviewImage").removeAttribute("src");$("ubuntuPreviewStatus").textContent="Capturing "+device.name+"…";$("ubuntuPreview").showModal()}
    try{
      if(action==="refresh"){await request(`/${device.id}/refresh`,"POST",{});computerMessage(device.id,"Computer status refreshed.");await load();return}
      if(action==="remove"){await request(`/${device.id}`,"DELETE",{confirm:true});await load();return}
      const result=await request(`/${device.id}/command`,"POST",{action,receiverId:button.dataset.screen,confirm:Boolean(confirmations[action])});
      if(action==="screenshot"&&capture===previewVersion&&$("ubuntuPreview").open){$("ubuntuPreviewImage").src="data:image/png;base64,"+result.png;$("ubuntuPreviewStatus").textContent=device.name+" · "+button.dataset.screen}
      computerMessage(device.id,result.accepted?"Command accepted. Refresh status to verify its result.":"Completed.");
    }catch(e){computerMessage(device.id,e.message);if(capture===previewVersion&&$("ubuntuPreview").open)$("ubuntuPreviewStatus").textContent=e.message}finally{pendingCommands.delete(device.id);render()}
  });
  function closePreview(){
    previewVersion++;$("ubuntuPreview").close();$("ubuntuPreviewImage").removeAttribute("src");$("ubuntuPreviewStatus").textContent="";
    const button=[...$("ubuntuComputers").querySelectorAll('[data-action="screenshot"]')].find(b=>b.closest('[data-id]').dataset.id===previewFocus?.id&&b.dataset.screen===previewFocus?.screen);
    (button&&!button.disabled?button:$("ubuntuSearch")).focus({preventScroll:true});previewFocus=null;
  }
  $("ubuntuPreviewClose").addEventListener("click",closePreview);
  $("ubuntuPreview").addEventListener("cancel",event=>{event.preventDefault();closePreview()});
  function updateMaintenanceForm(){
    $("ubuntuOperationDetail").textContent=maintenanceCopy[$("ubuntuOperation").value];
    $("ubuntuScheduleLabel").hidden=$("ubuntuMaintenanceWhen").value!=="later";
    $("ubuntuScheduleAt").required=!$("ubuntuScheduleLabel").hidden;
    $("ubuntuMaintenanceSubmit").textContent=$("ubuntuScheduleLabel").hidden?"Start maintenance":"Schedule maintenance";
  }
  for(const id of ["ubuntuOperation","ubuntuMaintenanceWhen"])$(id).addEventListener("change",()=>{$("ubuntuMaintenanceConfirm").checked=false;updateMaintenanceForm()});
  for(const [dialog,button] of [["ubuntuMaintenance","ubuntuMaintenanceClose"],["ubuntuDetails","ubuntuDetailsClose"]]){
    $(button).addEventListener("click",()=>{dialogVersion++;$(dialog).close()});
    $(dialog).addEventListener("cancel",()=>{dialogVersion++});
  }
  function maintenanceDraft(){return {operation:$("ubuntuOperation").value,confirm:$("ubuntuMaintenanceConfirm").checked,when:$("ubuntuMaintenanceWhen").value,at:$("ubuntuScheduleAt").value}}
  function detailsDraft(){return {name:$("ubuntuDetailName").value,location:$("ubuntuDetailLocation").value,address:$("ubuntuDetailAddress").value,port:Number($("ubuntuDetailPort").value),notes:$("ubuntuDetailNotes").value}}
  $("ubuntuMaintenanceForm").addEventListener("submit",async event=>{
    event.preventDefault();const version=dialogVersion,id=maintenanceDevice,button=$("ubuntuMaintenanceSubmit");if(!id||pendingCommands.has(id))return;
    const draft=maintenanceDraft();pendingCommands.add(id);button.disabled=true;computerMessage(id,"Submitting maintenance request…");render();
    try{
      const body={operation:draft.operation,confirm:draft.confirm};
      if(draft.when==="later")body.scheduleAt=new Date(draft.at).toISOString();
      await request(`/${id}/maintenance`,"POST",body);
      computerMessage(id,"Maintenance request accepted. Refresh status to verify its result.");
      if(version===dialogVersion){if(JSON.stringify(draft)===JSON.stringify(maintenanceDraft())){$("ubuntuMaintenance").close();dialogVersion++}else $("ubuntuMaintenanceMessage").textContent="Submitted maintenance accepted. Your newer choices have not been sent."}await load();
    }catch(e){computerMessage(id,e.message);if(version===dialogVersion)$("ubuntuMaintenanceMessage").textContent=e.message}
    finally{pendingCommands.delete(id);render();if(version===dialogVersion)button.disabled=false}
  });
  $("ubuntuDetailsForm").addEventListener("submit",async event=>{
    event.preventDefault();const version=dialogVersion,id=detailsDevice,button=$("ubuntuDetailsSubmit");if(!id||pendingCommands.has(id))return;
    const draft=detailsDraft();pendingCommands.add(id);button.disabled=true;computerMessage(id,"Saving computer details…");render();
    try{
      await request(`/${id}`,"PUT",draft);
      computerMessage(id,"Computer details saved.");
      if(version===dialogVersion){if(JSON.stringify(draft)===JSON.stringify(detailsDraft())){$("ubuntuDetails").close();dialogVersion++}else $("ubuntuDetailsMessage").textContent="Submitted changes saved. Your newer edits remain unsaved."}await load();
    }catch(e){computerMessage(id,e.message);if(version===dialogVersion)$("ubuntuDetailsMessage").textContent=e.message}
    finally{pendingCommands.delete(id);render();if(version===dialogVersion)button.disabled=false}
  });
  $("ubuntuSearch").addEventListener("input",render);$("ubuntuFilter").addEventListener("change",render);
  $("refresh").addEventListener("click",load);
  setInterval(()=>{if(!document.hidden&&!$("ubuntuWizard").open)load()},15000);
  load();
})();
