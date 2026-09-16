(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports){module.exports=api;return;}
  root.RoomGoblinVeyonInventorySync=api;
  api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const AUTO_DISCOVERY_MS=30000;
  const CACHE_KEY='roomgoblin.veyon.hostname-identity.v1';

  function hostKey(value){
    const raw=typeof value==='string'?value:value?.hostname;
    const host=String(raw||'').trim().replace(/\.$/,'').toLowerCase();
    if(!host||/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host))return '';
    return host;
  }

  function identitySnapshot(rows,cached={}){
    const next={};
    for(const [key,value] of Object.entries(cached||{})){
      const normalized=hostKey(key);
      if(normalized&&value&&typeof value==='object')next[normalized]={...value};
    }
    for(const row of Array.isArray(rows)?rows:[]){
      const key=hostKey(row);if(!key)continue;
      const prior=next[key],rowId=String(row.id||'');
      if(prior?.id&&rowId&&String(prior.id)!==rowId)continue;
      next[key]={
        hostname:String(row.hostname||'').trim(),
        name:String(row.name||row.hostname||'').trim(),
        role:row.role==='teacher'?'teacher':'student',
        id:rowId,
        updatedAt:new Date().toISOString()
      };
    }
    return next;
  }

  // Kept for compatibility tests and older cached data migrations. The browser
  // no longer applies these patches; server-side DHCP reconciliation is authoritative.
  function reconciliationPlan(identity,discovered){
    const patches=[];
    for(const row of Array.isArray(discovered)?discovered:[]){
      const key=hostKey(row),saved=identity?.[key];
      if(!key||!saved||!row?.id)continue;
      const patch={};
      if((saved.role==='teacher'||saved.role==='student')&&saved.role!==row.role)patch.role=saved.role;
      const desiredName=String(saved.name||'').trim();
      if(desiredName&&desiredName!==String(row.name||''))patch.name=desiredName;
      if(Object.keys(patch).length)patches.push({id:String(row.id),hostname:key,patch});
    }
    return patches;
  }

  function dedupeInventory(rows){
    const list=Array.isArray(rows)?rows:[];
    const groups=new Map();
    for(const row of list){
      const key=hostKey(row);if(!key)continue;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(row);
    }
    const hidden=new Set();
    for(const group of groups.values()){
      if(group.length<2)continue;
      const online=group.filter(row=>row.online===true);
      if(online.length===1)for(const row of group)if(row!==online[0]&&row.online!==true)hidden.add(row);
    }
    return list.filter(row=>!hidden.has(row));
  }

  function install(){
    if(typeof window==='undefined'||typeof document==='undefined')return;
    if(typeof api!=='function'||typeof load!=='function'||typeof render!=='function')return;

    let discoveryBusy=false,lastDiscoveryAt=0;

    function readCache(){
      try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{}}catch{return {}}
    }
    function writeCache(value){
      try{localStorage.setItem(CACHE_KEY,JSON.stringify(value||{}))}catch{}
    }
    function selectionHostKeys(rows){
      const byId=new Map((Array.isArray(rows)?rows:[]).map(row=>[String(row.id),row]));
      return new Set([...selected].map(id=>hostKey(byId.get(String(id)))).filter(Boolean));
    }
    function restoreSelection(keys){
      if(!keys?.size)return;
      selected.clear();
      for(const row of computers)if(keys.has(hostKey(row)))selected.add(row.id);
      render();
    }
    function dedupeAndRemember(){
      const deduped=dedupeInventory(computers);
      if(deduped.length!==computers.length){computers=deduped;render();}
      writeCache(identitySnapshot(computers,readCache()));
    }

    const baseLoad=load;
    load=async function(){
      await baseLoad();
      dedupeAndRemember();
    };

    async function runDiscovery({interactive=false}={}){
      if(discoveryBusy||(!interactive&&document.hidden))return;
      discoveryBusy=true;
      const button=document.getElementById('discover');
      const oldLabel=button?.textContent;
      if(interactive&&button){button.disabled=true;button.textContent='Scanning…';}
      try{
        const status=await api('/api/v1/veyon/status');
        if(!String(status?.scanSubnet||'').trim()){
          throw new Error('Veyon discovery is disabled until a scan subnet prefix is configured in Settings → Integrations & Hardware → Veyon Classroom Computers.');
        }
        const selectedHosts=selectionHostKeys(computers);
        await api('/api/v1/veyon/discover',{method:'POST',body:'{}'});
        lastDiscoveryAt=Date.now();
        await load();
        restoreSelection(selectedHosts);
        writeCache(identitySnapshot(computers,{}));
      }catch(error){
        if(interactive)alert(error.message);
      }finally{
        discoveryBusy=false;
        if(interactive&&button){button.disabled=false;button.textContent=oldLabel||'Discover computers';}
      }
    }

    const refresh=document.getElementById('refresh');if(refresh)refresh.onclick=()=>load();
    const discover=document.getElementById('discover');if(discover)discover.onclick=()=>runDiscovery({interactive:true});
    setTimeout(()=>runDiscovery({interactive:false}),1500);
    setInterval(()=>runDiscovery({interactive:false}),AUTO_DISCOVERY_MS);
    document.addEventListener('visibilitychange',()=>{
      if(!document.hidden&&Date.now()-lastDiscoveryAt>=AUTO_DISCOVERY_MS)runDiscovery({interactive:false});
    });
  }

  return {hostKey,identitySnapshot,reconciliationPlan,dedupeInventory,install};
});
