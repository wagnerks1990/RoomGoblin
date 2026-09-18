"use strict";
(()=>{
  const root=document.getElementById("devices");
  if(!root)return;
  const cache=new Map();
  const REFRESH_MS=30000;
  async function getCaps(id){
    const old=cache.get(id);if(old&&Date.now()-old.at<REFRESH_MS)return old.value;
    const r=await fetch(`/api/v1/maintenance/android/devices/${encodeURIComponent(id)}/agent/v2/capabilities`,{credentials:"same-origin",cache:"no-store"});
    const j=await r.json();if(!r.ok||j.ok===false)throw Error(j.error||`HTTP ${r.status}`);
    const value=j.capabilities||{};cache.set(id,{at:Date.now(),value});return value;
  }
  function set(card,op,enabled,label,title){
    const b=card.querySelector(`button[data-v2-action="${op}"]`);if(!b)return;
    b.disabled=!enabled;if(label&&b.textContent!==label)b.textContent=label;if(b.title!==(title||""))b.title=title||"";
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
  async function scanCard(card){if(card.dataset.capUiBusy)return;card.dataset.capUiBusy="1";try{render(card,await getCaps(card.dataset.id));}catch{}finally{delete card.dataset.capUiBusy;}}
  function scan(){root.querySelectorAll(".card[data-id]").forEach(scanCard);}
  // Inventory refresh replaces cards directly under #devices. Do not observe subtree
  // mutations: capability rendering itself changes descendants and would recursively
  // schedule more probes, producing a request/DOM feedback loop and browser stalls.
  new MutationObserver(scan).observe(root,{childList:true});
  scan();setInterval(scan,REFRESH_MS);
})();
