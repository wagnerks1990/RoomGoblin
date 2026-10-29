"use strict";
(() => {
  const root=document.getElementById("dailySignIn");
  const base="/api/v1/admin/daily-signin";
  if(!root){
    const link=document.getElementById("dailySignInLink");
    if(link)fetch("/api/v1/auth/me",{cache:"no-store",signal:AbortSignal.timeout(10000)}).then(r=>r.json()).then(j=>{
      link.hidden=!(j.user?.role==="admin"&&j.user?.capabilities?.includes("*"));
    }).catch(()=>{link.hidden=true});
    window.addEventListener("roomgoblin:authchange",()=>{if(link)link.hidden=true;});
    return;
  }
  const $=id=>document.getElementById(id);
  let epoch=0,accessRevision=0,busy=false,timer=null,authorized=false;
  function clear(){clearTimeout(timer);if($("code").textContent)$("status").textContent="Code hidden.";$("code").textContent="";$("codeDate").textContent="";$("passphrase").value="";}
  function retire(){epoch++;clear();}
  async function api(url,body){
    const response=await fetch(url,{method:body===undefined?"GET":"POST",cache:"no-store",credentials:"same-origin",
      headers:body===undefined?{}:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    const data=await response.json();
    if(!response.ok){if(response.status===401||response.status===403){authorized=false;retire();$("controls").hidden=true;}throw Error(data.error||"Request failed.");}
    return data;
  }
  async function action(fn){
    if(busy||!authorized)return;busy=true;const owner=++epoch;clear();
    root.querySelectorAll("button").forEach(b=>b.disabled=true);
    $("status").textContent="Working…";
    try{await fn(owner);}catch(error){if(owner===epoch)$("status").textContent=error.name==="TimeoutError"?"Request timed out. It may have completed. Refresh groups before trying again.":error.message;}
    finally{busy=false;root.querySelectorAll("button").forEach(b=>b.disabled=false);}
  }
  async function groups(owner){
    const current=$("groups").value,result=await api(base);
    if(owner!==epoch||document.hidden)return;
    $("groups").replaceChildren(...result.groups.map(g=>new Option(`${g.name} (${g.timeZone})`,g.id)));
    if(result.groups.some(g=>g.id===current))$("groups").value=current;
    $("status").textContent=result.groups.length?"Choose a group to show its code or enroll a computer.":"Create a group to get started.";
  }
  $("zone").value=Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";
  $("groups").addEventListener("change",retire);
  $("hide").addEventListener("click",retire);
  $("refresh").addEventListener("click",()=>action(groups));
  $("create").addEventListener("submit",event=>{
    event.preventDefault();const input={name:$("groupName").value,timeZone:$("zone").value};
    action(async owner=>{await api(`${base}/groups`,input);await groups(owner);});
  });
  $("reveal").addEventListener("click",()=>{
    const id=$("groups").value;if(!id)return;
    action(async owner=>{
      const result=await api(`${base}/groups/${encodeURIComponent(id)}/code`,{});
      if(owner!==epoch||document.hidden)return;
      $("code").textContent=result.code;$("codeDate").textContent=`For ${result.day} in ${result.timeZone}. Hidden automatically after one minute.`;
      $("status").textContent="Today's group code is visible.";timer=setTimeout(clear,60000);
    });
  });
  $("enroll").addEventListener("submit",event=>{
    event.preventDefault();const id=$("groups").value;if(!id)return;
    const input={computerName:$("computer").value,username:$("username").value,passphrase:$("passphrase").value};
    action(async owner=>{
      let result;try{result=await api(`${base}/groups/${encodeURIComponent(id)}/enrollment`,input);}finally{input.passphrase="";}
      if(owner!==epoch||document.hidden)return;
      const url=URL.createObjectURL(new Blob([JSON.stringify(result.enrollment)],{type:"application/json"}));
      const link=document.createElement("a");link.href=url;link.download="roomgoblin-daily-signin-enrollment.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      $("status").textContent="Encrypted enrollment downloaded. Install it locally on the selected computer within 24 hours.";
    });
  });
  document.addEventListener("visibilitychange",()=>{retire();if(!document.hidden)checkAccess();});
  window.addEventListener("pagehide",retire);
  window.addEventListener("roomgoblin:authchange",()=>{authorized=false;retire();$("controls").hidden=true;});
  async function checkAccess(){
    const owner=epoch,revision=++accessRevision;
    try{await api(base);if(owner!==epoch||revision!==accessRevision||document.hidden)return;authorized=true;$("controls").hidden=false;}
    catch(error){if(revision!==accessRevision)return;authorized=false;retire();$("controls").hidden=true;$("status").textContent=error.message;}
  }
  checkAccess().then(()=>action(groups));
  setInterval(()=>{if(!document.hidden)checkAccess();},30000);
  api("/api/v1/lab/computers").then(result=>{
    $("computers").replaceChildren(...(result.computers||[]).filter(c=>/^[a-z0-9][a-z0-9-]{0,14}$/i.test(c.hostname||"")).map(c=>new Option(c.name||c.hostname,c.hostname)));
  }).catch(()=>{});
})();
