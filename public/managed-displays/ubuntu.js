/* Ubuntu computers and their independent physical screens. No saved SSH bootstrap credentials. */
(()=>{
  "use strict";
  const $=id=>document.getElementById(id),base="/api/v1/ubuntu-displays";
  let inventory={devices:[],receivers:{}},probe=null,editing=null,repairing=null,step=0,polling=false;
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function request(path="",method="GET",body){
    const response=await fetch(base+path,{method,credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
    const value=await response.json();if(!response.ok||value.ok===false)throw Error(value.error||`Request failed (${response.status})`);return value;
  }
  function message(text){$("ubuntuMessage").textContent=text}
  function wizardStep(value){step=value;document.querySelectorAll("[data-ubuntu-step]").forEach(el=>el.hidden=Number(el.dataset.ubuntuStep)!==value);$("ubuntuStep").textContent=["1 · Connect","2 · Assign screens","3 · Review installation","4 · Installation"][value];$("ubuntuBack").hidden=value===0||value===3;$("ubuntuNext").hidden=value===3;$("ubuntuNext").textContent=value===0?"Check computer":value===1?"Review installation":editing?"Save screen assignments":"Install RoomGoblin";message("")}
  function clearCredentials(){for(const id of ["ubuntuPassword","ubuntuKey","ubuntuPassphrase"])$(id).value="";$("ubuntuKeyFile").value=""}
  function closeWizard(){clearCredentials();probe=null;editing=null;repairing=null;$("ubuntuWizard").close()}
  function auth(){return {address:$("ubuntuAddress").value.trim(),port:Number($("ubuntuPort").value),username:$("ubuntuUsername").value.trim(),password:$("ubuntuPassword").value,privateKey:$("ubuntuKey").value,passphrase:$("ubuntuPassphrase").value,fingerprint:$("ubuntuFingerprint").value.trim()}}
  function assignments(){return [...$("ubuntuOutputRows").querySelectorAll("[data-connector]")].filter(row=>row.querySelector('[name="use"]').checked).map(row=>({connector:row.dataset.connector,monitorId:row.dataset.monitor,
    receiverId:row.querySelector('[name="receiver"]').value.trim(),name:row.querySelector('[name="screenName"]').value.trim(),mode:row.querySelector('[name="mode"]').value,rotation:row.querySelector('[name="rotation"]').value,audioSink:row.querySelector('[name="audioSink"]').value,enabled:true}))}
  function screenRows(config=null){
    const connected=(probe.outputs||[]).filter(o=>o.connected);
    $("ubuntuProbeSummary").textContent=`${probe.hostname} · Ubuntu ${probe.version} · ${connected.length} connected screen${connected.length===1?"":"s"}`;
    $("ubuntuOutputRows").innerHTML=connected.map((output,index)=>{
      const saved=config?.screens.find(s=>s.connector===output.connector),receiver=saved?.receiverId||"";
      return `<fieldset class="ubuntu-output" data-connector="${esc(output.connector)}" data-monitor="${esc(output.monitorId)}"><legend>Screen ${index+1} · ${esc(output.connector)}</legend><label class="ubuntu-checkbox"><input type="checkbox" name="use" ${output.monitorId?"checked":"disabled"}>Use this output</label>${!output.monitorId?'<p class="warning">Monitor identity unavailable. Check its cable/adapter before enrollment.</p>':""}<div class="grid"><label>Screen name<input name="screenName" value="${esc(saved?.name||`${probe.hostname} screen ${index+1}`)}" maxlength="100"></label><label>Receiver ID<input name="receiver" list="ubuntuReceivers" value="${esc(receiver)}" placeholder="Unique existing or new ID" pattern="[a-zA-Z0-9_-]{1,40}" maxlength="40"></label><label>Resolution<select name="mode"><option value="auto">Recommended</option>${output.modes.map(m=>`<option ${saved?.mode===m?"selected":""}>${esc(m)}</option>`).join("")}</select></label><label>Rotation<select name="rotation">${[["normal","Landscape"],["left","Portrait left"],["right","Portrait right"],["inverted","Upside down"]].map(([v,label])=>`<option value="${v}" ${saved?.rotation===v?"selected":""}>${label}</option>`).join("")}</select></label><label class="wide">Audio output<select name="audioSink">${[{name:"default",description:"Computer default"},{name:"muted",description:"Muted"},...(probe.audio?.sinks||[])].map(sink=>`<option value="${esc(sink.name)}" ${(saved?.audioSink||"default")===sink.name?"selected":""}>${esc(sink.description)}</option>`).join("")}</select></label></div></fieldset>`;
    }).join("")||'<p class="warning">This computer needs its Xorg kiosk session prepared first. Continue to install, activate the kiosk, then use Assign screens to map the detected monitors. Existing desktop configuration is saved for rollback.</p>';
    $("ubuntuReceivers").innerHTML=Object.entries(inventory.receivers).map(([id,d])=>`<option value="${esc(id)}">${esc(d.name||id)}</option>`).join("");
  }
  async function load(){
    if(polling)return;polling=true;
    try{inventory=await request();render();$("ubuntuStatus").textContent=`${inventory.devices.length} computers · ${inventory.devices.reduce((n,d)=>n+d.config.screens.length,0)} screens`}
    catch(e){$("ubuntuStatus").textContent=e.message}
    finally{polling=false}
  }
  function render(){
    const root=$("ubuntuComputers"),open=new Set([...root.querySelectorAll("details[open]")].map(d=>d.dataset.computer));
    root.innerHTML=inventory.devices.map(device=>{
      const status=device.live?.status,online=device.live?.online,session=status?.session;
      return `<article class="card ubuntu-computer" data-id="${esc(device.id)}"><div class="card-head"><div><h3>${esc(device.name)}</h3><small>${esc(device.address)} · Ubuntu computer</small></div><span class="pill ${online?"ok":"warn"}">${online?"Computer connected":"Connection unconfirmed"}</span></div><p class="subtle">${online?(session?.online?"Display session running":"Display session needs attention"):esc(device.live?.error||device.state)}</p><div class="ubuntu-screens">${device.config.screens.map(screen=>{
        const live=session?.screens?.find(s=>s.receiverId===screen.receiverId);
        return `<section class="ubuntu-screen"><div><strong>${esc(screen.name)}</strong><small>${esc(screen.connector)} → ${esc(screen.receiverId)}</small></div><div class="ubuntu-screen-state">${screen.receiverOnline?"Receiver connected":"Receiver disconnected"} · ${live?.browserRunning?"Browser running":"Browser unconfirmed"}${live?.error?` · ${esc(live.error)}`:""}</div><div class="controls"><button data-action="screenshot" data-screen="${esc(screen.receiverId)}" ${online?"":"disabled"}>Preview</button><button data-action="restart-screen" data-screen="${esc(screen.receiverId)}" ${online?"":"disabled"}>Restart screen</button></div></section>`;
      }).join("")}</div><div class="controls"><button data-action="refresh">Refresh status</button><button data-action="edit" ${online?"":"disabled"}>Assign screens</button><button data-action="identify" ${online?"":"disabled"}>Identify screens</button></div><details data-computer="${esc(device.id)}" ${open.has(device.id)?"open":""}><summary>Computer maintenance</summary><div class="controls"><button data-action="activate">Activate kiosk</button><button data-action="repair">Repair / update agent</button><button data-action="reboot">Reboot computer</button><button data-action="shutdown">Shut down</button><button data-action="rollback">Restore previous desktop</button><button data-action="remove">Remove enrollment</button></div><p class="subtle">Computer actions affect all its screens. Restoring the previous desktop uses the snapshot made before installation.</p></details><p class="ubuntu-card-message" role="status"></p></article>`;
    }).join("")||'<p class="empty">Add an Ubuntu computer to manage each connected monitor as an independent screen.</p>';
  }
  async function openWizard(device=null,repair=false){
    clearCredentials();$("ubuntuForm").reset();editing=null;repairing=null;probe=null;
    $("ubuntuHubUrl").value=location.origin;$("ubuntuUsername").value="root";$("ubuntuPort").value="22";$("ubuntuFingerprint").value="";$("ubuntuHostVerified").checked=false;
    wizardStep(0);$("ubuntuWizard").showModal();
    if(device){
      $("ubuntuName").value=device.name;$("ubuntuAddress").value=device.address;$("ubuntuPort").value=device.port;
      $("ubuntuFingerprint").value=device.fingerprint;$("ubuntuHubUrl").value=device.config.hubUrl;
      if(repair){repairing=device.id;message("Use the original administrator SSH access to repair/update this computer. Its management identity and browser profiles will be retained.")}
      else{
        editing=device.id;
        try{await request(`/${device.id}/refresh`,"POST",{});inventory=await request();const fresh=inventory.devices.find(d=>d.id===device.id);probe=fresh.live?.status;if(!probe)throw Error("Computer could not be checked.");screenRows(device.config);wizardStep(1)}catch(e){message(e.message)}
      }
    }
  }
  $("ubuntuAdd").addEventListener("click",()=>openWizard());
  $("ubuntuClose").addEventListener("click",closeWizard);
  $("ubuntuWizard").addEventListener("cancel",clearCredentials);
  $("ubuntuBack").addEventListener("click",()=>wizardStep(Math.max(editing?1:0,step-1)));
  $("ubuntuKeyFile").addEventListener("change",async()=>{const file=$("ubuntuKeyFile").files[0];if(file&&file.size<=32768)$("ubuntuKey").value=await file.text();else message("Choose an SSH private key under 32 KiB.")});
  for(const id of ["ubuntuAddress","ubuntuPort"])$(id).addEventListener("input",()=>{$("ubuntuFingerprint").value="";$("ubuntuHostVerified").checked=false});
  $("ubuntuGetFingerprint").addEventListener("click",async()=>{try{message("Reading SSH host fingerprint…");const result=await request("/host-key","POST",{address:$("ubuntuAddress").value.trim(),port:Number($("ubuntuPort").value)});$("ubuntuFingerprint").value=result.fingerprint;$("ubuntuHostVerified").checked=false;message("Compare this fingerprint with the computer or your trusted SSH inventory, then accept it.")}catch(e){message(e.message)}});
  $("ubuntuForm").addEventListener("submit",async event=>{
    event.preventDefault();const button=$("ubuntuNext");button.disabled=true;
    try{
      if(step===0){
        if(!$("ubuntuHostVerified").checked)throw Error("Verify and accept the SSH fingerprint before continuing.");
        message("Checking Ubuntu, permissions and physical outputs…");probe=await request("/probe","POST",auth());screenRows(repairing?inventory.devices.find(d=>d.id===repairing)?.config:null);wizardStep(1);
      }else if(step===1){
        const screens=assignments();if((!screens.length&&(editing||probe.graphics==="x11"))||screens.some(s=>!s.receiverId))throw Error("Assign a unique receiver ID to every selected screen.");
        if(new Set(screens.map(s=>s.receiverId)).size!==screens.length)throw Error("Each output needs a different receiver ID.");
        $("ubuntuReview").textContent=screens.map(s=>`${s.connector} → ${s.name} (${s.receiverId}) · ${s.mode} · ${s.rotation}`).join("\n")||"Prepare the Xorg kiosk. Assign its physical screens after activation.";
        $("ubuntuInstallDetails").hidden=Boolean(editing);wizardStep(2);
      }else if(step===2){
        const body={hubUrl:$("ubuntuHubUrl").value,screens:assignments()};
        if(editing){await request(`/${editing}/screens`,"PUT",body);closeWizard();await load();return}
        if(!$("ubuntuConsent").checked)throw Error("Confirm the installation changes before continuing.");
        const result=await request("","POST",{...auth(),...body,name:$("ubuntuName").value,id:repairing||undefined,confirm:true});
        clearCredentials();wizardStep(3);watchJob(result.job.id);
      }
    }catch(e){message(e.message)}finally{button.disabled=false}
  });
  async function watchJob(id){
    try{
      const {job}=await request(`/jobs/${id}`);$("ubuntuJobStatus").textContent=job.error||job.stage;
      if(job.state==="running"){setTimeout(()=>watchJob(id),3000);return}
      $("ubuntuActivate").hidden=job.state!=="completed";$("ubuntuActivate").dataset.device=job.deviceId;await load();
    }catch(e){$("ubuntuJobStatus").textContent=e.message}
  }
  $("ubuntuActivate").addEventListener("click",async()=>{
    if(!confirm("Activate the RoomGoblin kiosk now? This restarts the computer’s graphical session and affects all attached screens."))return;
    try{await request(`/${$("ubuntuActivate").dataset.device}/command`,"POST",{action:"activate",confirm:true});$("ubuntuJobStatus").textContent="Activation requested. Refresh status to verify every screen.";$("ubuntuActivate").hidden=true}catch(e){message(e.message)}
  });
  $("ubuntuComputers").addEventListener("click",async event=>{
    const button=event.target.closest("button[data-action]"),card=button?.closest("[data-id]");if(!card)return;
    const device=inventory.devices.find(d=>d.id===card.dataset.id),action=button.dataset.action,notice=card.querySelector(".ubuntu-card-message");
    if(action==="edit"||action==="repair"){openWizard(device,action==="repair");return}
    const confirmations={activate:"Activate this computer’s RoomGoblin kiosk? Its graphical session will restart.",reboot:"Reboot this computer and interrupt all its screens?",shutdown:"Shut down this computer and all its screens? Remote power-on is not guaranteed.",rollback:"Restore the computer’s pre-installation desktop configuration? This stops all RoomGoblin screen sessions.",remove:"Remove management enrollment? The computer keeps running and receiver assignments/data remain. Restore its previous desktop first if you also want to stop the kiosk."};
    if(confirmations[action]&&!confirm(confirmations[action]))return;
    button.disabled=true;notice.textContent="Working…";
    try{
      if(action==="refresh"){await request(`/${device.id}/refresh`,"POST",{});await load();return}
      if(action==="remove"){await request(`/${device.id}`,"DELETE",{confirm:true});await load();return}
      const result=await request(`/${device.id}/command`,"POST",{action,receiverId:button.dataset.screen,confirm:Boolean(confirmations[action])});
      if(action==="screenshot"){$("ubuntuPreviewImage").src="data:image/png;base64,"+result.png;$("ubuntuPreview").showModal()}
      notice.textContent=result.accepted?"Command accepted. Refresh status to verify its result.":"Completed.";
    }catch(e){notice.textContent=e.message}finally{button.disabled=false}
  });
  $("ubuntuPreviewClose").addEventListener("click",()=>{$("ubuntuPreview").close();$("ubuntuPreviewImage").removeAttribute("src")});
  $("refresh").addEventListener("click",load);
  setInterval(()=>{if(!document.hidden&&!$("ubuntuWizard").open&&!$("ubuntuComputers").contains(document.activeElement))load()},30000);
  load();
})();
