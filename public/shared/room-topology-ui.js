"use strict";

(function installRoomTopologyUi(){
  const state={topology:null,installed:false};
  const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  const cleanId=value=>String(value||"").trim().toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80);
  const values=map=>Object.values(map||{});
  const clone=value=>JSON.parse(JSON.stringify(value));
  function normalize(raw={}){
    const objectify=(value,prefix)=>Array.isArray(value)?Object.fromEntries(value.map((x,i)=>[cleanId(x?.id||`${prefix}${i+1}`),{...x,id:cleanId(x?.id||`${prefix}${i+1}`)}])):{...(value||{})};
    const topology={version:1,tvs:objectify(raw.tvs,"tv"),displays:objectify(raw.displays,"display"),sources:objectify(raw.sources,"source"),groups:objectify(raw.groups,"group")};
    for(const [id,row] of Object.entries(topology.tvs)){row.id=id;row.name=String(row.name||id);row.enabled=row.enabled!==false;row.transport={adapter:String(row.transport?.adapter||"pluto"),connection:String(row.transport?.connection||"hdbt"),...(Number(row.transport?.output)>0?{output:Number(row.transport.output)}:{})};}
    for(const [id,row] of Object.entries(topology.displays)){row.id=id;row.name=String(row.name||id);row.enabled=row.enabled!==false;row.physicalTvId=row.physicalTvId&&topology.tvs[row.physicalTvId]?row.physicalTvId:null;}
    for(const [id,row] of Object.entries(topology.sources)){row.id=id;row.name=String(row.name||id);row.enabled=row.enabled!==false;row.endpointId=String(row.endpointId||id);row.transport={adapter:String(row.transport?.adapter||"pluto"),...(Number(row.transport?.input)>0?{input:Number(row.transport.input)}:{})};}
    return topology;
  }
  function deriveFallback(config={}){
    const devices=config?.devices?.devices||{},groups=config?.devices?.displayGroups||{},tvs={},displays={},sources={};
    const maxOutput=Math.max(8,...Object.values(devices).map(d=>Number(d?.avOutput)||0));
    for(let output=1;output<=maxOutput;output++){
      const hit=Object.entries(devices).find(([,d])=>Number(d?.avOutput)===output),id=hit?.[0]||`tv${output}`,d=hit?.[1]||{};
      tvs[id]={id,name:d.name||`TV ${output}`,enabled:d.enabled!==false,transport:{adapter:"pluto",connection:d.avConnection||"hdbt",output}};
    }
    for(const [id,d] of Object.entries(devices)){
      const tv=values(tvs).find(x=>Number(x.transport?.output)===Number(d?.avOutput));
      displays[id]={id,name:d.name||id,enabled:d.enabled!==false,physicalTvId:tv?.id||null};
    }
    for(let input=1;input<=8;input++)sources[`source${input}`]={id:`source${input}`,name:`Content Source ${input}`,enabled:true,endpointId:`source${input}`,transport:{adapter:"pluto",input}};
    const typedGroups={};for(const [id,members] of Object.entries(groups))typedGroups[`display-${id}`]={id:`display-${id}`,name:id,type:"display",members:Array.isArray(members)?members:[]};
    return normalize({tvs,displays,sources,groups:typedGroups});
  }
  function setTopology(value){state.topology=normalize(value||{});window.ROOM_TOPOLOGY=state.topology;return state.topology}
  function displayRows(){return values(state.topology?.displays).filter(x=>x.enabled!==false).sort((a,b)=>a.name.localeCompare(b.name,{numeric:true}))}
  function tvRows(){return values(state.topology?.tvs).filter(x=>x.enabled!==false).sort((a,b)=>(Number(a.transport?.output)||999)-(Number(b.transport?.output)||999)||a.name.localeCompare(b.name,{numeric:true}))}
  function sourceRows(){return values(state.topology?.sources).filter(x=>x.enabled!==false).sort((a,b)=>(Number(a.transport?.input)||999)-(Number(b.transport?.input)||999)||a.name.localeCompare(b.name,{numeric:true}))}
  function projection(topology=state.topology){
    const t=normalize(topology),devices={},displayGroups={all:displayRows().map(x=>x.id)};
    for(const display of values(t.displays)){
      const tv=display.physicalTvId?t.tvs[display.physicalTvId]:null;
      devices[display.id]={name:display.name,enabled:display.enabled!==false,avOutput:tv?.transport?.output||null,avConnection:tv?.transport?.connection||null,tags:display.tags||[]};
    }
    for(const group of values(t.groups))if(group.type==="display")displayGroups[group.name||group.id]=[...(group.members||[])];
    const plutoTvs=values(t.tvs).filter(x=>x.transport?.adapter==="pluto"&&x.transport?.output),plutoSources=values(t.sources).filter(x=>x.transport?.adapter==="pluto"&&x.transport?.input);
    const maxOutput=Math.max(8,...plutoTvs.map(x=>Number(x.transport.output)||0)),maxInput=Math.max(8,...plutoSources.map(x=>Number(x.transport.input)||0));
    const labels={outputs:Array.from({length:maxOutput},(_,i)=>plutoTvs.find(x=>Number(x.transport.output)===i+1)?.name||`TV ${i+1}`),inputs:Array.from({length:maxInput},(_,i)=>plutoSources.find(x=>Number(x.transport.input)===i+1)?.name||`Content Source ${i+1}`),sourceEndpoints:Array.from({length:maxInput},(_,i)=>plutoSources.find(x=>Number(x.transport.input)===i+1)?.endpointId||`source${i+1}`)};
    return {devices,displayGroups,labels};
  }
  function nextId(map,prefix){let n=1,id;do{id=`${prefix}${n++}`}while(map[id]);return id}
  function addItem(kind){
    const t=state.topology;if(!t)return;
    if(kind==="tv"){
      const id=nextId(t.tvs,"tv"),used=new Set(values(t.tvs).map(x=>Number(x.transport?.output)||0));let output=1;while(used.has(output))output++;
      t.tvs[id]={id,name:`TV ${output}`,enabled:true,transport:{adapter:"pluto",connection:"hdbt",output}};
    }else if(kind==="display"){
      const id=nextId(t.displays,"display");t.displays[id]={id,name:`Display ${values(t.displays).length+1}`,enabled:true,physicalTvId:null};
    }else{
      const id=nextId(t.sources,"source"),used=new Set(values(t.sources).map(x=>Number(x.transport?.input)||0));let input=1;while(used.has(input))input++;
      t.sources[id]={id,name:`Content Source ${input}`,enabled:true,endpointId:id,transport:{adapter:"pluto",input}};
    }
    renderEditors();
  }
  function removeItem(kind,id){
    const t=state.topology;if(!t)return;
    if(kind==="tv"){
      for(const display of values(t.displays))if(display.physicalTvId===id)display.physicalTvId=null;
      delete t.tvs[id];
    }else if(kind==="display"){
      delete t.displays[id];for(const group of values(t.groups))if(group.type==="display")group.members=(group.members||[]).filter(x=>x!==id);
    }else delete t.sources[id];
    renderEditors();
  }
  function rowInput(kind,id,field,value,type="text",extra=""){return `<label>${esc(field)}<input data-topology-kind="${kind}" data-topology-id="${esc(id)}" data-topology-field="${esc(field)}" type="${type}" value="${esc(value??"")}" ${extra}></label>`}
  function editorHtml(){
    const t=state.topology||normalize({});
    const tvOptions=`<option value="">No physical TV link</option>`+values(t.tvs).map(tv=>`<option value="${esc(tv.id)}">${esc(tv.name)} (${esc(tv.id)})</option>`).join("");
    const tvs=values(t.tvs).map(tv=>`<div class="card" data-topology-row="tv:${esc(tv.id)}" style="box-shadow:none;margin:7px 0"><div class="toolbar" style="justify-content:space-between"><b>${esc(tv.name)}</b><button type="button" class="danger" data-topology-remove="tv:${esc(tv.id)}">Remove</button></div><div class="grid2">${rowInput("tv",tv.id,"name",tv.name)}${rowInput("tv",tv.id,"output",tv.transport?.output||"","number",'min="1" max="64"')}<label>Transport<select data-topology-kind="tv" data-topology-id="${esc(tv.id)}" data-topology-field="connection"><option value="hdbt" ${tv.transport?.connection!=="hdmi"?"selected":""}>HDBT</option><option value="hdmi" ${tv.transport?.connection==="hdmi"?"selected":""}>HDMI</option></select></label>${rowInput("tv",tv.id,"adapter",tv.transport?.adapter||"pluto")}</div><label><input data-topology-kind="tv" data-topology-id="${esc(tv.id)}" data-topology-field="enabled" type="checkbox" ${tv.enabled!==false?"checked":""}> Enabled physical TV</label><div class="muted">Stable ID: ${esc(tv.id)}</div></div>`).join("");
    const displays=values(t.displays).map(display=>`<div class="card" data-topology-row="display:${esc(display.id)}" style="box-shadow:none;margin:7px 0"><div class="toolbar" style="justify-content:space-between"><b>${esc(display.name)}</b><button type="button" class="danger" data-topology-remove="display:${esc(display.id)}">Remove</button></div><div class="grid2">${rowInput("display",display.id,"name",display.name)}<label>Physical TV<select data-topology-kind="display" data-topology-id="${esc(display.id)}" data-topology-field="physicalTvId">${tvOptions}</select></label></div><label><input data-topology-kind="display" data-topology-id="${esc(display.id)}" data-topology-field="enabled" type="checkbox" ${display.enabled!==false?"checked":""}> Enabled content display</label><div class="muted">Display URL ID: ${esc(display.id)}</div></div>`).join("");
    const sources=values(t.sources).map(source=>`<div class="card" data-topology-row="source:${esc(source.id)}" style="box-shadow:none;margin:7px 0"><div class="toolbar" style="justify-content:space-between"><b>${esc(source.name)}</b><button type="button" class="danger" data-topology-remove="source:${esc(source.id)}">Remove</button></div><div class="grid2">${rowInput("source",source.id,"name",source.name)}${rowInput("source",source.id,"input",source.transport?.input||"","number",'min="1" max="64"')}${rowInput("source",source.id,"endpointId",source.endpointId||source.id)}${rowInput("source",source.id,"adapter",source.transport?.adapter||"pluto")}</div><label><input data-topology-kind="source" data-topology-id="${esc(source.id)}" data-topology-field="enabled" type="checkbox" ${source.enabled!==false?"checked":""}> Enabled content source</label><div class="muted">Stable ID: ${esc(source.id)}</div></div>`).join("");
    return `<div class="top" style="position:static;box-shadow:none"><div><h2 class="sectionTitle">Room topology</h2><div class="muted">Physical TVs, browser content displays, and AV content sources are independent inventories. Stable IDs survive renames.</div></div><div class="toolbar"><button type="button" data-topology-add="tv">+ Physical TV</button><button type="button" data-topology-add="display">+ Content Display</button><button type="button" data-topology-add="source">+ Content Source</button><button type="button" class="primary" data-topology-save>Save Topology</button></div></div><div class="grid" style="align-items:start"><div><h3>Physical TVs</h3>${tvs||'<div class="muted">No physical TVs configured.</div>'}</div><div><h3>Content Displays</h3>${displays||'<div class="muted">No content displays configured.</div>'}</div><div><h3>Content Sources</h3>${sources||'<div class="muted">No content sources configured.</div>'}</div></div><div data-topology-status class="status"></div>`;
  }
  function readEditor(container){
    const t=clone(state.topology);
    container.querySelectorAll("[data-topology-kind]").forEach(el=>{
      const kind=el.dataset.topologyKind,id=el.dataset.topologyId,field=el.dataset.topologyField,map=kind==="tv"?t.tvs:kind==="display"?t.displays:t.sources,row=map[id];if(!row)return;
      const value=el.type==="checkbox"?el.checked:el.value;
      if(kind==="tv"&&["output","connection","adapter"].includes(field)){row.transport=row.transport||{};row.transport[field]=field==="output"?Number(value)||null:value;}
      else if(kind==="source"&&["input","adapter"].includes(field)){row.transport=row.transport||{};row.transport[field]=field==="input"?Number(value)||null:value;}
      else row[field]=value;
    });
    setTopology(t);return t;
  }
  async function saveTopology(container){
    const status=container.querySelector("[data-topology-status]");
    try{
      const topology=readEditor(container),p=projection(topology);if(status)status.textContent="Saving topology…";
      await window.api("/api/v1/admin/displays",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({topology})});
      try{await window.api("/api/v1/pluto/labels",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(p.labels)})}catch{}
      if(window.S){window.S.displayDevices=p.devices;if(window.S.avConfig){window.S.avConfig.devices=p.devices;window.S.avConfig.displayGroups=p.displayGroups}}
      if(status){status.textContent="Topology saved and application target inventories updated.";status.className="status ok";}
      refreshDependentUi();
    }catch(error){if(status){status.textContent=error.message;status.className="status bad";}}
  }
  function bindEditor(container){
    container.querySelectorAll("[data-topology-add]").forEach(button=>button.onclick=()=>addItem(button.dataset.topologyAdd));
    container.querySelectorAll("[data-topology-remove]").forEach(button=>button.onclick=()=>{const [kind,id]=button.dataset.topologyRemove.split(":");if(confirm(`Remove ${id}? Existing references will be pruned from compatible target lists.`))removeItem(kind,id)});
    container.querySelector("[data-topology-save]")?.addEventListener("click",()=>saveTopology(container));
    for(const display of values(state.topology?.displays)){const select=container.querySelector(`[data-topology-kind="display"][data-topology-id="${CSS.escape(display.id)}"][data-topology-field="physicalTvId"]`);if(select)select.value=display.physicalTvId||"";}
  }
  function renderEditors(){document.querySelectorAll("[data-room-topology-editor]").forEach(container=>{container.innerHTML=editorHtml();bindEditor(container)})}
  function refreshDependentUi(){
    try{if(typeof window.renderClassDefaultTargets==="function")window.renderClassDefaultTargets(window.selectedClassDefaultTargets?.()||["all"])}catch{}
    try{if(typeof window.renderAutomationFields==="function")window.renderAutomationFields(window.currentAutomationPayload||{})}catch{}
    try{if(typeof window.renderAutomationSteps==="function")window.renderAutomationSteps()}catch{}
    try{if(typeof window.renderMatrix==="function")window.renderMatrix()}catch{}
    try{if(typeof window.loadPresentations==="function"&&document.getElementById("presentations")?.classList.contains("active"))window.loadPresentations()}catch{}
    try{if(typeof window.loadMedia==="function"&&document.getElementById("media")?.classList.contains("active"))window.loadMedia()}catch{}
  }
  function patchController(){
    if(!location.pathname.startsWith("/controller"))return;
    const install=()=>{
      if(typeof window.api!=="function"||typeof window.configuredDisplayTargets!=="function"||!window.S){setTimeout(install,50);return}
      if(window.__ROOM_TOPOLOGY_CONTROLLER__)return;window.__ROOM_TOPOLOGY_CONTROLLER__=true;
      const originalApi=window.api;
      window.api=async function topologyAwareApi(url,opt={}){const body=await originalApi(url,opt);if(body?.topology)setTopology(body.topology);return body};
      const originalConfigured=window.configuredDisplayTargets;
      window.configuredDisplayTargets=function(includeAll=true){const rows=displayRows().map(x=>[x.id,x.name]);return state.topology?(includeAll?[["all","All Displays"],...rows]:rows):originalConfigured(includeAll)};
      const originalAutoTargets=window.autoTargetValues;
      window.autoTargetValues=function(){if(state.topology&&window.autoAction?.value==="tv.power")return [["all","All Physical TVs"],["hdmi-all","All HDMI TVs"],["hdbt-all","All HDBT TVs"],...tvRows().map(x=>[x.id,x.name])];return originalAutoTargets()};
      const originalStepTargets=window.stepTargetValues;
      window.stepTargetValues=function(step){if(state.topology&&window.automationActionDomain?.(step?.action)==="tv")return [["all","All Physical TVs"],["hdmi-all","All HDMI TVs"],["hdbt-all","All HDBT TVs"],...tvRows().map(x=>[x.id,x.name])];return originalStepTargets(step)};
      const av=document.querySelector("#av .avRoutingPanel");if(av&&!document.querySelector("#av [data-room-topology-editor]")){const panel=document.createElement("section");panel.className="panel";panel.dataset.roomTopologyEditor="1";av.before(panel);}
      originalApi("/api/v1/admin/config").then(body=>{setTopology(body.topology||deriveFallback(body));renderEditors();refreshDependentUi()}).catch(()=>{});
    };install();
  }
  function patchSetup(){
    if(!location.pathname.startsWith("/setup"))return;
    const install=()=>{
      if(typeof window.api!=="function"||typeof window.save!=="function"||!document.getElementById("display-setup")){setTimeout(install,50);return}
      if(window.__ROOM_TOPOLOGY_SETUP__)return;window.__ROOM_TOPOLOGY_SETUP__=true;
      const card=document.getElementById("display-setup"),legacyFields=card.querySelector(".row");if(legacyFields)legacyFields.hidden=true;
      card.querySelector("h2").textContent="Room topology";const note=card.querySelector("p.muted");if(note)note.textContent="Configure physical TVs, RoomGoblin content displays, and AV content sources separately. Add or remove them later without changing unrelated device identities.";
      const editor=document.createElement("div");editor.dataset.roomTopologyEditor="1";card.append(editor);
      const originalSave=window.save;
      window.save=async function topologySetupSave(){
        if(state.topology){const p=projection(readEditor(editor)),ids=Object.keys(p.devices);window.displayCount.value=Math.max(1,ids.length);window.receiverIds.value=(ids.length?ids:["display1"]).join(", ");}
        await originalSave();
        if(state.topology){const p=projection(state.topology);await window.api("/api/v1/admin/displays",{method:"PUT",body:JSON.stringify({topology:state.topology})});try{await window.api("/api/v1/pluto/labels",{method:"PUT",body:JSON.stringify(p.labels)})}catch{}}
      };
      window.api("/api/v1/admin/config").then(body=>{setTopology(body.topology||deriveFallback(body));renderEditors()}).catch(()=>{setTopology(deriveFallback({devices:{devices:{}}}));renderEditors()});
    };install();
  }
  patchController();patchSetup();
  window.RoomGoblinTopology={get:()=>state.topology,set:setTopology,projection,render:renderEditors};
})();
