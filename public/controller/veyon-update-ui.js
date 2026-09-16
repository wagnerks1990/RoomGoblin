"use strict";

(function installVeyonLifecycleUi(){
  if(window.__ROOMGOBLIN_VEYON_LIFECYCLE_UI__)return;
  window.__ROOMGOBLIN_VEYON_LIFECYCLE_UI__=true;

  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  async function request(path,opt={}){
    const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...opt,headers:{"content-type":"application/json",...(opt.headers||{})}});
    const text=await response.text();let body={};try{body=text?JSON.parse(text):{}}catch{body={error:text}}
    if(!response.ok)throw new Error(body?.error||`HTTP ${response.status}`);
    return body;
  }
  function versionLine(status){
    const current=status.mixedInstalledVersions?'Mixed installed Veyon package versions · ':status.installedVersion?`Installed ${esc(status.installedVersion)} · `:'Installed version unavailable · ';
    if(status.aptUpdateAvailable){
      return `${current}Package update available: <b>${esc(status.candidateVersion||"newer version")}</b>`;
    }
    if(status.upstream?.ok&&status.upstream.version)return `${current}No apt update currently offered. Latest upstream release: <b>${esc(status.upstream.version)}</b>.`;
    return `${current}No Veyon package update is currently offered by the configured apt sources.`;
  }
  function detailsLine(status){
    const bits=[];
    if(status.upstream?.ok&&status.upstream.version)bits.push(`Upstream ${status.upstream.version}`);
    if(status.newerUpstreamThanApt===true)bits.push("configured apt source is behind upstream");
    if(status.hostUpdateJob?.running)bits.push("host update is running");
    if(status.rebootRequired)bits.push("reboot required");
    return bits.join(" · ");
  }
  function findAnchor(){return document.getElementById("cfgVeyonPrivateKey")?.closest(".card")||document.getElementById("cfgVeyonUrl")?.closest(".card")}
  function ensurePanel(){
    const anchor=findAnchor();if(!anchor)return null;
    let panel=document.getElementById("rgVeyonLifecycle");if(panel)return panel;
    panel=document.createElement("div");panel.id="rgVeyonLifecycle";panel.className="subtle";panel.style.marginTop="12px";
    panel.innerHTML=`<div class="toolbar" style="justify-content:space-between;align-items:flex-start"><div><b>Veyon lifecycle</b><div id="rgVeyonVersion" class="muted">Check the installed package feed and latest upstream release.</div><div id="rgVeyonLifecycleDetail" class="muted" style="margin-top:4px"></div></div><div class="toolbar"><button id="rgVeyonCheck" type="button">Check Veyon updates</button><button id="rgVeyonInstall" type="button" class="primary" disabled>Install available update</button></div></div><div class="muted" style="margin-top:8px">Veyon is a native host service. Installation uses RoomGoblin's guarded host-update workflow, which may also install other pending Ubuntu/third-party package updates and can require a reboot.</div>`;
    anchor.append(panel);
    panel.querySelector("#rgVeyonCheck").onclick=()=>refresh();
    panel.querySelector("#rgVeyonInstall").onclick=()=>install();
    return panel;
  }
  async function refresh(){
    const panel=ensurePanel();if(!panel)return;
    const check=panel.querySelector("#rgVeyonCheck"),installButton=panel.querySelector("#rgVeyonInstall"),version=panel.querySelector("#rgVeyonVersion"),detail=panel.querySelector("#rgVeyonLifecycleDetail");
    check.disabled=true;version.textContent="Checking Veyon package and upstream release…";detail.textContent="";
    try{
      const status=await request("/api/v1/admin/veyon-update-status");
      version.innerHTML=versionLine(status);detail.textContent=detailsLine(status);
      installButton.disabled=!status.aptUpdateAvailable||status.hostUpdateJob?.running===true;
      panel.dataset.status=JSON.stringify({aptUpdateAvailable:!!status.aptUpdateAvailable,candidateVersion:status.candidateVersion||""});
    }catch(error){version.textContent=`Veyon update check failed: ${error.message}`;installButton.disabled=true}
    finally{check.disabled=false}
  }
  async function install(){
    const panel=ensurePanel();if(!panel)return;
    const state=(()=>{try{return JSON.parse(panel.dataset.status||"{}")||{}}catch{return {}}})();
    const suffix=state.candidateVersion?` ${state.candidateVersion}`:"";
    if(!confirm(`Install the available Veyon${suffix} update using the guarded host package updater? Other pending Ubuntu/third-party package updates may also be installed.`))return;
    const button=panel.querySelector("#rgVeyonInstall"),version=panel.querySelector("#rgVeyonVersion");button.disabled=true;version.textContent="Starting guarded host update…";
    try{await request("/api/v1/admin/veyon-update",{method:"POST",body:JSON.stringify({confirm:"UPDATE_VEYON_AND_HOST"})});version.textContent="Veyon/host update started. Use Infrastructure & Recovery → Appliance Health for progress.";setTimeout(refresh,3000)}
    catch(error){version.textContent=`Veyon update could not start: ${error.message}`;button.disabled=false}
  }
  function boot(){
    if(!["/controller/","/controller/index.html"].includes(location.pathname))return;
    if(ensurePanel())refresh();
    else setTimeout(boot,500);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
