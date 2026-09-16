"use strict";

(function(){
  let installed=false;
  async function request(path,options={}){
    const response=await fetch(path,{credentials:"same-origin",cache:"no-store",...options,headers:{...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})}});
    let body={};try{body=await response.json()}catch{}
    if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`);
    return body;
  }
  function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function status(text,bad=false){const node=document.getElementById("rgVeyonKeyringStatus");if(node){node.textContent=text||"";node.className=bad?"bad":"muted"}}
  async function refresh(){
    const list=document.getElementById("rgVeyonKeyringList");if(!list)return;
    try{
      const data=await request("/api/v1/admin/veyon-keys"),names=data.keyNames||[],preferred=data.preferredKeyName||"";
      list.innerHTML=names.length?names.map(name=>`<div class="toolbar" data-rg-veyon-key="${esc(name)}" style="justify-content:space-between;margin:6px 0"><span><code>${esc(name)}</code> ${name===preferred?'<span class="pill ok">PREFERRED</span>':''}</span><span class="toolbar"><button type="button" data-rg-veyon-prefer="${esc(name)}" ${name===preferred?'disabled':''}>Use first</button><button type="button" class="danger" data-rg-veyon-remove="${esc(name)}">Remove</button></span></div>`).join(""):'<span class="muted">No keyring entries yet. The existing default Veyon key remains compatible and will be captured automatically.</span>';
      list.querySelectorAll("[data-rg-veyon-prefer]").forEach(button=>button.addEventListener("click",()=>prefer(button.dataset.rgVeyonPrefer)));
      list.querySelectorAll("[data-rg-veyon-remove]").forEach(button=>button.addEventListener("click",()=>remove(button.dataset.rgVeyonRemove)));
      status(`${Number(data.count||0)} named Veyon key${Number(data.count||0)===1?"":"s"} available.`);
    }catch(error){list.innerHTML='<span class="muted">Sign in as an administrator to manage additional Veyon keys.</span>';status(error.message,true)}
  }
  async function importKey(){
    const name=document.getElementById("rgVeyonKeyName")?.value.trim(),privateKey=document.getElementById("rgVeyonPrivateKey")?.value||"",preferred=document.getElementById("rgVeyonPreferred")?.checked===true;
    if(!name||!privateKey){status("Enter a key name and PEM private key.",true);return}
    try{
      status("Encrypting and storing key…");
      await request("/api/v1/admin/veyon-keys",{method:"POST",body:JSON.stringify({keyName:name,privateKey,preferred})});
      document.getElementById("rgVeyonPrivateKey").value="";document.getElementById("rgVeyonKeyName").value="";
      await refresh();status(`Stored ${name}. Private key material is not returned to the browser.`);
    }catch(error){status(error.message,true)}
  }
  async function prefer(name){
    try{await request("/api/v1/admin/veyon-keys/preferred",{method:"PUT",body:JSON.stringify({keyName:name})});await refresh();status(`${name} will be tried first unless a workstation has a previously successful key.`)}
    catch(error){status(error.message,true)}
  }
  async function remove(name){
    if(!confirm(`Remove stored Veyon key "${name}"? Workstations that require only this key will stop authenticating.`))return;
    try{await request(`/api/v1/admin/veyon-keys/${encodeURIComponent(name)}`,{method:"DELETE"});await refresh();status(`${name} removed from the encrypted keyring.`)}
    catch(error){status(error.message,true)}
  }
  function install(){
    if(installed)return;
    const legacy=document.getElementById("cfgVeyonPrivateKey"),field=legacy?.closest(".formField");if(!legacy||!field)return;
    installed=true;
    const panel=document.createElement("div");panel.id="rgVeyonKeyringPanel";panel.className="formField";panel.style.gridColumn="1 / -1";
    panel.innerHTML=`<label>Additional Veyon authentication keys</label><div class="subtle"><div id="rgVeyonKeyringList"><span class="muted">Loading keyring…</span></div><div class="grid2" style="margin-top:10px"><label>Key name<input id="rgVeyonKeyName" autocomplete="off" placeholder="Example: lab-secondary"></label><label>Private key (PEM)<textarea id="rgVeyonPrivateKey" rows="4" autocomplete="off" placeholder="Paste another Veyon private key PEM"></textarea></label></div><div class="toolbar" style="margin-top:8px"><label class="pill"><input id="rgVeyonPreferred" type="checkbox"> Prefer this key for new authentications</label><button id="rgVeyonImport" type="button" class="primary">Import / Replace Key</button><button id="rgVeyonRefresh" type="button">Refresh Keys</button></div><div id="rgVeyonKeyringStatus" class="muted" style="margin-top:7px"></div><div class="muted" style="margin-top:7px">Every PEM is encrypted in RoomGoblin's secret store. Workstations remember their last successful key; fallback to another key occurs only when Veyon explicitly rejects authentication. Key material is never displayed after import.</div></div>`;
    field.after(panel);
    document.getElementById("rgVeyonImport").addEventListener("click",importKey);
    document.getElementById("rgVeyonRefresh").addEventListener("click",refresh);
    refresh();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
  const observer=new MutationObserver(()=>{install();if(installed)observer.disconnect()});observer.observe(document.documentElement,{childList:true,subtree:true});
})();
