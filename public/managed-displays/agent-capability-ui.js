"use strict";
(()=>{
  const root=document.getElementById("devices");
  if(!root)return;
  const cache=new Map();
  const REFRESH_MS=30000;
  function capabilityIdentity(id){
    const d=deviceById(id);if(!d)return null;
    return JSON.stringify([d.createdAt,d.host,d.serial,d.androidId,d.agentPackage,d.agentV2?.port,d.agentV2?.configuredAt]);
  }
  async function getCaps(id){
    const identity=capabilityIdentity(id);
    if(identity===null){cache.delete(id);return null}
    const old=cache.get(id);
    if(old?.identity===identity){if(old.promise)return old.promise;if(performance.now()-old.at<REFRESH_MS)return old.value}
    const entry={identity};cache.set(id,entry);
    entry.promise=(async()=>{
      try{
        const r=await fetch(`/api/v1/maintenance/android/devices/${encodeURIComponent(id)}/agent/v2/capabilities`,{credentials:"same-origin",cache:"no-store"});
        const j=await r.json();if(!r.ok||j.ok===false)throw Error(j.error||`HTTP ${r.status}`);
        if(cache.get(id)!==entry||capabilityIdentity(id)!==identity)return null;
        entry.value=j.capabilities||{};entry.at=performance.now();return entry.value;
      }catch(error){if(cache.get(id)===entry)cache.delete(id);throw error}
      finally{delete entry.promise}
    })();
    return entry.promise;
  }
  function set(card,op,enabled,label,title){
    const b=card.querySelector(`button[data-v2-action="${op}"]`);if(!b)return;
    setDeviceControlDisabled(b,!enabled);if(label&&b.textContent!==label)b.textContent=label;if(b.title!==(title||""))b.title=title||"";
  }
  function badge(name,on,detail){const row=document.createElement("div"),strong=document.createElement("strong");strong.textContent=name;row.append(strong,`: ${on?"Available":"Unavailable"}${detail?` · ${String(detail)}`:""}`);return row;}
  function render(card,s){
    const c=s.capabilities||{},access=s.accessibilityEnabled===true,admin=s.deviceAdminActive===true;
    const home=c.navigationHome?.available??c.globalNavigation?.available??false;
    const back=c.navigationBack?.available??c.globalNavigation?.available??false;
    const recents=c.navigationRecents?.available??c.globalNavigation?.available??false;
    set(card,"home",home,null,home?"Accessibility Home action available.":"Requires Accessibility approval.");
    set(card,"back",back,null,back?"Accessibility Back action available.":"Requires Accessibility approval.");
    set(card,"recents",recents,null,recents?"Android accepts the Recents request when Accessibility is enabled; some TV launchers show no Recents UI.":"Requires Accessibility approval.");
    set(card,"enable-accessibility",!access,access?"Accessibility enabled":"Enable Accessibility",access?"Already enabled.":"Open Android Accessibility settings.");
    set(card,"enable-device-admin",!admin,admin?"Device Admin enabled":"Enable Device Admin",admin?"Already active.":"Open Android Device Administrator approval.");
    const panel=card.querySelector(".agent-v2-panel");if(!panel)return;
    let box=panel.querySelector("[data-capability-summary]");if(!box){box=document.createElement("div");box.dataset.capabilitySummary="1";box.style.cssText="margin-top:.7rem;padding:.7rem;border:1px solid rgba(255,255,255,.12);border-radius:.6rem;font-size:.85rem;line-height:1.55";panel.appendChild(box);}
    const title=document.createElement("strong");title.textContent="Device capabilities";
    const note=document.createElement("small");note.style.cssText="display:block;margin-top:.4rem";note.textContent="Accessibility action success means Android accepted the request; the OEM launcher may still show no visible change.";
    box.replaceChildren(title,badge("Agent API",c.agentHttpApi?.available,c.agentHttpApi?.mode),badge("Persistent ADB",c.persistentAdbSettings?.available,c.persistentAdbSettings?.mode),badge("Device Admin",admin,"sleep/lock"),badge("Accessibility",access,"Home / Back / Recents"),badge("Home",home,c.navigationHome?.mode||"accessibility"),badge("Back",back,c.navigationBack?.mode||"accessibility"),badge("Recents",recents,c.navigationRecents?.mode||"OEM-dependent"),badge("Sleep",c.sleepDisplay?.available,c.sleepDisplay?.mode),badge("Reboot",c.reboot?.available,c.reboot?.mode),badge("Arbitrary input",c.inputInjection?.available,c.inputInjection?.mode),note);
  }
  async function scanCard(card){if(card.dataset.capUiBusy)return;card.dataset.capUiBusy="1";const id=card.dataset.id,identity=capabilityIdentity(id);try{const value=await getCaps(id);if(value&&root.contains(card)&&capabilityIdentity(id)===identity)render(card,value)}catch{}finally{delete card.dataset.capUiBusy;}}
  function scan(){for(const [id,entry] of cache)if(capabilityIdentity(id)!==entry.identity)cache.delete(id);root.querySelectorAll(".card[data-id]").forEach(scanCard);}
  // Inventory refresh replaces cards directly under #devices. Do not observe subtree
  // mutations: capability rendering itself changes descendants and would recursively
  // schedule more probes, producing a request/DOM feedback loop and browser stalls.
  new MutationObserver(scan).observe(root,{childList:true});
  scan();setInterval(scan,REFRESH_MS);
})();
