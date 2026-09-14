"use strict";
(()=>{
  const root=document.getElementById("devices");
  if(!root)return;

  function terminal(title,value){
    const shell=document.getElementById("remoteShell");if(shell)shell.open=true;
    const el=document.getElementById("terminal");if(el)el.textContent=`${title}\n${typeof value==='string'?value:JSON.stringify(value,null,2)}`;
  }

  function decorate(){
    for(const card of root.querySelectorAll(".card[data-id]")){
      const box=card.querySelector("[data-v2-controls]");
      if(!box||box.querySelector("button[data-device-admin-remove]"))continue;
      const b=document.createElement("button");
      b.type="button";
      b.dataset.deviceAdminRemove="1";
      b.textContent="Remove Device Admin";
      b.title="Opens Android's Device Administrator screen for the active RoomGoblin/Classroom Hub package so you can deactivate it safely.";
      box.appendChild(b);
    }
  }

  root.addEventListener("click",async event=>{
    const button=event.target.closest("button[data-device-admin-remove]");
    if(!button)return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    const card=button.closest(".card[data-id]");
    const id=card?.dataset.id;if(!id)return;
    if(!window.confirm("Open Android Device Administrator controls on this TV so RoomGoblin/Classroom Hub Device Admin can be deactivated? Android still requires confirmation on the TV."))return;
    button.disabled=true;
    try{
      const r=await fetch(`/api/v1/maintenance/android/devices/${encodeURIComponent(id)}/agent/v2/device-admin/deactivate`,{
        method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:"{}"
      });
      const text=await r.text();let json={};try{json=JSON.parse(text)}catch{throw Error(text||`HTTP ${r.status}`)}
      if(!r.ok||json.ok===false)throw Error(json.error||`HTTP ${r.status}`);
      terminal("Device Admin deactivation",json);
      window.alert("RoomGoblin opened Android's Device Administrator controls on the TV. Deactivate the listed RoomGoblin/Classroom Hub administrator, then retry the agent install.");
    }catch(error){window.alert(`Device Admin removal: ${error.message}`)}finally{button.disabled=false}
  },true);

  new MutationObserver(decorate).observe(root,{childList:true});
  decorate();
})();
