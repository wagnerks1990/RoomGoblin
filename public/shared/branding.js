"use strict";

(function(){
  if(!document.documentElement.lang)document.documentElement.lang="en";

  const ROOMGOBLIN={
    productName:"RoomGoblin",
    descriptor:"Classroom & Lab Management Hub",
    tagline:"Run the room. Manage the lab.",
    school:"Your School",
    room:"Classroom",
    logoUrl:"/brand/roomgoblin_app_192x192.png",
    faviconUrl:"/brand/roomgoblin_app_32x32.png",
    theme:{mode:"dark",primary:"#0F766E",accent:"#22C55E",background:"#0B1320",surface:"#1E293B",text:"#F8FAFC"}
  };
  const renderer=/\/(display|document-viewer|antmedia-player)(\/|$)/.test(location.pathname);
  document.documentElement.dataset.brandSurface=renderer?"renderer":"operator";

  function normalize(branding={}){
    const incoming={...branding};
    // Product identity is fixed; school, room and theme remain site settings.
    for(const key of ["productName","descriptor","tagline","logoUrl","faviconUrl"])incoming[key]=ROOMGOBLIN[key];
    const theme={...ROOMGOBLIN.theme,...(incoming.theme||{})};
    if(theme.primary==="#2aa866")theme.primary=ROOMGOBLIN.theme.primary;
    if(theme.accent==="#1b7a49")theme.accent=ROOMGOBLIN.theme.accent;
    if(theme.background==="#040705")theme.background=ROOMGOBLIN.theme.background;
    if(theme.surface==="#121923")theme.surface=ROOMGOBLIN.theme.surface;
    if(theme.text==="#eef4f8")theme.text=ROOMGOBLIN.theme.text;
    return {...ROOMGOBLIN,...incoming,theme};
  }

  function ensureBrandStyles(){
    if(!document.querySelector('link[data-roomgoblin-brand]')){
      const css=document.createElement("link");css.rel="stylesheet";css.href="/shared/roomgoblin.css";css.dataset.roomgoblinBrand="1";document.head.append(css);
    }
  }

  function replaceLegacyPresentationText(root,productName){
    if(!root||!document.createTreeWalker)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
      const parent=node.parentElement;
      if(!parent||/^(SCRIPT|STYLE|CODE|PRE)$/.test(parent.tagName))return NodeFilter.FILTER_REJECT;
      return /Classroom Control Hub|Classroom Hub/.test(node.nodeValue||"")?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    for(const node of nodes)node.nodeValue=node.nodeValue.replace(/Classroom Control Hub|Classroom Hub/g,productName);
  }

  function applyArtwork(profile){
    // Opt-in product marks keep page layout under each workspace's ownership.
    document.querySelectorAll("[data-brand-lockup]").forEach(lockup=>{
      if(!lockup.querySelector("[data-brand-logo]")){
        const mark=document.createElement("img");mark.dataset.brandLogo="";
        mark.width=32;mark.height=32;mark.decoding="async";
        const name=document.createElement("span");name.dataset.brandProduct="";
        lockup.append(mark,name);
      }
      lockup.querySelector("[data-brand-product]").textContent=profile.productName;
    });
    document.querySelectorAll("[data-brand-logo], .brandWrap .logo img").forEach(mark=>{
      mark.src=profile.logoUrl;
      mark.alt=`${ROOMGOBLIN.productName} logo`;
      mark.onerror=()=>{mark.onerror=null;mark.hidden=true;};
      mark.hidden=false;
    });
    let icons=[...document.querySelectorAll("link[rel~='icon']")];
    if(!icons.length){const icon=document.createElement("link");icon.rel="icon";document.head.append(icon);icons=[icon];}
    for(const icon of icons){icon.href=ROOMGOBLIN.faviconUrl;icon.type="image/png";icon.sizes="32x32";}
  }

  function apply(branding={}){
    ensureBrandStyles();
    const profile=normalize(branding),root=document.documentElement,theme=profile.theme;
    root.dataset.brandMode=theme.mode;root.dataset.product="roomgoblin";root.style.colorScheme=theme.mode==="system"?"light dark":theme.mode;
    for(const [key,value] of Object.entries(theme))if(key!=="mode")root.style.setProperty(`--brand-${key}`,value);
    root.style.setProperty("--green",theme.primary);root.style.setProperty("--green2",theme.accent);root.style.setProperty("--text",theme.text);root.style.setProperty("--accent",theme.accent);
    document.querySelectorAll("[data-brand-product]").forEach(x=>x.textContent=profile.productName);
    document.querySelectorAll("[data-brand-school]").forEach(x=>x.textContent=profile.school);
    document.querySelectorAll("[data-brand-room]").forEach(x=>x.textContent=profile.room);
    document.querySelectorAll("[data-brand-descriptor]").forEach(x=>x.textContent=profile.descriptor);
    document.querySelectorAll("[data-brand-tagline]").forEach(x=>x.textContent=profile.tagline);
    replaceLegacyPresentationText(document.body,profile.productName);

    if(document.title.includes("Classroom Control Hub"))document.title=document.title.replace("Classroom Control Hub",profile.productName);
    else if(document.title.includes("Classroom Hub"))document.title=document.title.replace("Classroom Hub",profile.productName);


    for(const button of document.querySelectorAll("button")){if(/Open Classroom Control Hub|Open Classroom Hub/i.test(button.textContent||""))button.textContent=`Open ${profile.productName}`;}
    const setupTheme={themePrimary:ROOMGOBLIN.theme.primary,themeAccent:ROOMGOBLIN.theme.accent,themeBackground:ROOMGOBLIN.theme.background,themeSurface:ROOMGOBLIN.theme.surface,themeText:ROOMGOBLIN.theme.text};
    for(const [id,value] of Object.entries(setupTheme)){const field=document.getElementById(id),legacy={themePrimary:"#2aa866",themeAccent:"#1b7a49",themeBackground:"#040705",themeSurface:"#121923",themeText:"#eef4f8"}[id];if(field&&(!field.value||field.value.toLowerCase()===legacy))field.value=value;}

    window.CONTROL_HUB_BRANDING=profile;
    window.ROOMGOBLIN_BRANDING=profile;
    window.dispatchEvent(new CustomEvent("controlhub:branding",{detail:profile}));
    window.dispatchEvent(new CustomEvent("roomgoblin:branding",{detail:profile}));
    applyArtwork(profile);
    return profile;
  }

  function managedDisplaysOverviewLink(){
    if(!location.pathname.startsWith("/controller"))return;
    const overview=document.getElementById("overview"),toolbar=overview?.querySelector(":scope > .top .toolbar");if(!toolbar||document.querySelector('[data-managed-displays-link]'))return;
    const link=document.createElement("a");link.className="buttonLink";link.href="/managed-displays/";link.textContent="Managed Displays";link.dataset.managedDisplaysLink="1";
    const refresh=[...toolbar.querySelectorAll("button")].find(button=>String(button.getAttribute("onclick")||"").includes("refreshOverview"));if(refresh)refresh.after(link);else toolbar.prepend(link);
  }

  window.RoomGoblinBranding={apply,normalize,load:async()=>{try{const response=await fetch("/api/v1/branding",{credentials:"same-origin",cache:"no-store"});if(!response.ok)throw Error(`HTTP ${response.status}`);const value=await response.json();return apply(value.branding||{})}catch{return apply(ROOMGOBLIN)}}};
  window.ControlHubBranding=window.RoomGoblinBranding;
  apply(ROOMGOBLIN);
  window.RoomGoblinBranding.load();
  window.addEventListener("load",()=>{const p=window.ROOMGOBLIN_BRANDING||ROOMGOBLIN;replaceLegacyPresentationText(document.body,p.productName);applyArtwork(p);});

  if(!renderer&&location.pathname.startsWith("/controller"))managedDisplaysOverviewLink();
  if(!renderer&&!document.querySelector('script[data-controlhub-integration-setup]')){const script=document.createElement("script");script.src="/shared/integration-setup.js";script.defer=true;script.dataset.controlhubIntegrationSetup="1";document.head.append(script);}
  if(!renderer&&!document.querySelector('script[data-controlhub-automation-fix]')){const script=document.createElement("script");script.src="/shared/automation-hotfix.js";script.defer=true;script.dataset.controlhubAutomationFix="1";document.head.append(script);}
})();
