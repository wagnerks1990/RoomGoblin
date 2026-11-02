/* Displays & AV owns matrix controls and receiver drafts; transport and authorization remain in app.js. */
async function plutoAction(p,refresh=true){
 try{
  const j=await jpost('/api/v1/pluto',p);
  if(j?.ok===false)throw new Error(j.error||j.message||'Matrix rejected the command.');
  const ack=j.pendingVerify?'sent; verification pending':(Number(j.result??j.data?.result)===1?'acknowledged by matrix':'sent');
  avMsg.textContent=`${friendlyAvAction(p)} — ${ack}`;
  if(refresh)setTimeout(refreshPluto,180);
  return j;
 }catch(e){avMsg.textContent=e.message;throw e}
}
function friendlyAvAction(p){
 if(p.action==='route')return `${avOutputLabel(p.output)} → ${avInputLabel(p.input)}`;
 if(p.action==='cecOutput')return `${avOutputLabel(p.output)} power ${Number(p.index)===0?'on':'off'}`;
 if(p.action==='cecInput')return `${avInputLabel(p.input)} power ${Number(p.index)===1?'on':'off'}`;
 return String(p.action||'Matrix command');
}
function defaultAvLabels(){return {outputs:Array.from({length:8},(_,i)=>`TV ${i+1}`),inputs:Array.from({length:8},(_,i)=>`Content Source ${i+1}`),sourceEndpoints:Array.from({length:8},(_,i)=>`source${i+1}`)}}
function avLabels(){const d=defaultAvLabels(),x=S.pluto?.labels||{};return {outputs:Array.from({length:8},(_,i)=>String(x.outputs?.[i]||d.outputs[i])),inputs:Array.from({length:8},(_,i)=>String(x.inputs?.[i]||d.inputs[i])),sourceEndpoints:Array.from({length:8},(_,i)=>String(x.sourceEndpoints?.[i]||d.sourceEndpoints[i]))}}
function avOutputLabel(n){return avLabels().outputs[Number(n)-1]||`TV ${n}`}
function avInputLabel(n){return avLabels().inputs[Number(n)-1]||`Content Source ${n}`}
let avRefreshPromise=null;
const avReadErrors={};
function renderAvReadFeedback(){
 avReadMsg.textContent=Object.values(avReadErrors).filter(Boolean).join(' ');
}
function refreshPluto(){
 if(avRefreshPromise)return avRefreshPromise;
 const read=async(key,url,timeout,apply)=>{
  try{
   const value=await api(url,{signal:AbortSignal.timeout(timeout)}),record=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
   if(!record(value)||key==='Matrix'&&typeof value.ok!=='boolean'||key==='Receiver configuration'&&!record(value.devices)||key==='Receiver status'&&!record(value.status))throw new Error('Invalid status response');
   delete avReadErrors[key];apply(value);
  }
  catch(error){
   avReadErrors[key]=`${key} unavailable: ${error.message}. Existing readings may be stale.`;
   if(key==='Matrix'){S.avMatrixAvailable=false;avHealth.textContent='Matrix unavailable';avHealth.className='pill bad';}
   if(key==='Receiver configuration')S.avConfigAvailable=false;
   if(key==='Receiver status')S.avDeviceStatusAvailable=false;
  }finally{renderMatrix();renderAvReadFeedback();}
 };
 avRefreshPromise=Promise.all([
  read('Matrix','/api/v1/pluto/status',30000,j=>{S.pluto=j;S.avMatrixAvailable=true;if(!j.ok)avReadErrors.Matrix='Matrix status is partial. Open diagnostics for failed queries.';syncAvOutputLabelsFromDisplays();renderTV();avHealth.textContent=j.ok?'Matrix Online':'Matrix Partial';avHealth.className='pill '+(j.ok?'ok':'bad');}),
  read('Receiver configuration','/api/v1/config',10000,cfg=>{S.avConfig=cfg||{};S.avConfigAvailable=true;syncDisplayTargetNames(cfg.devices||{});syncAvOutputLabelsFromDisplays();}),
  read('Receiver status','/api/v1/devices',10000,dev=>{S.avDeviceStatus=dev.status||{};S.avDeviceStatusAvailable=true;})
 ]).finally(()=>{avRefreshPromise=null});
 return avRefreshPromise;
}
setInterval(()=>{const page=document.getElementById('av');if(!document.hidden&&window.AUTH_STATUS?.user&&page?.dataset.authorized==='true'&&page.classList.contains('active'))refreshPluto()},5000);
function avTvDisplayId(output){return displayByAvOutput(output)?.[0]||null}
function avTvOnline(output){const id=avTvDisplayId(output);return !!id&&S.avConfig?.devices?.[id]?.enabled!==false&&!!S.avDeviceStatus?.[id]?.online}
function requireAvReceiver(output){
 if(S.avConfigAvailable===false)throw new Error('Receiver configuration is unavailable. Refresh before using display tools or saving mappings.');
 const id=avTvDisplayId(output);
 if(!id)throw new Error(`HDBT ${output} has no unique receiver mapping. Open Edit Receivers & Groups before using display tools or groups.`);
 if(S.avConfig?.devices?.[id]?.enabled===false)throw new Error(`Receiver ${id} is disabled. Open Edit Receivers & Groups.`);
 return id;
}
function avBinaryState(value){if(value===true||value===1||value==='1')return 1;if(value===false||value===0||value==='0')return 0;return null}
function avReportedPowerState(output){
 const o=Number(output),sources=[S.pluto?.cecStatus||{},S.pluto?.outputStatus||{}];
 for(const src of sources){for(const key of ['hdbtPower','hdbt_power','hdbtPowerState','hdbt_power_state','allhdbtpower','allhdbtpowerstate']){const a=src?.[key];if(Array.isArray(a)&&a.length>=o){const v=avBinaryState(a[o-1]);if(v===1)return {known:true,on:true,source:key};if(v===0)return {known:true,on:false,source:key}}}}
 return {known:false,on:null,source:null};
}
function storedAvPowerStates(){try{const value=JSON.parse(localStorage.getItem('classroomHub.avPowerStates')||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}catch{return {}}}
function avPowerStateInfo(output){const live=S.avMatrixAvailable===false?{known:false}:avReportedPowerState(output);if(live.known)return {...live,verified:true,label:live.on?'On':'Off'};const m=storedAvPowerStates(),v=m[output];if(v&&typeof v==='object'&&(v.on===true||v.on===false))return {known:true,on:v.on,verified:false,label:v.on?'On':'Off',at:v.at||null};if(v===true||v===false)return {known:true,on:v,verified:false,label:v?'On':'Off'};return {known:false,on:null,verified:false,label:'Unknown'}}
function avPowerState(output){return avPowerStateInfo(output).on===true}
function saveAvPowerState(output,on){const m=storedAvPowerStates();m[output]={on:!!on,at:new Date().toISOString()};try{localStorage.setItem('classroomHub.avPowerStates',JSON.stringify(m))}catch{}}
let avMatrixMarkup='',avRouteAllMarkup='';
// Matrix positions are fixed ports. Patch those nodes so another port's status
// change cannot detach the operator's focused routing or power control.
function reconcileAvMarkup(root,markup){
 const template=document.createElement('template');template.innerHTML=markup;
 const update=(parent,incoming)=>{
  const next=[...incoming.childNodes];
  next.forEach((node,index)=>{
   const current=parent.childNodes[index];
   if(!current){parent.appendChild(node);return}
   if(current.nodeType!==node.nodeType||current.nodeName!==node.nodeName){current.replaceWith(node);return}
   if(node.nodeType===Node.TEXT_NODE){if(current.nodeValue!==node.nodeValue)current.nodeValue=node.nodeValue;return}
   if(node.nodeType!==Node.ELEMENT_NODE)return;
   for(const attribute of node.attributes)if(current.getAttribute(attribute.name)!==attribute.value)current.setAttribute(attribute.name,attribute.value);
   update(current,node);
  });
  while(parent.childNodes.length>next.length)parent.lastChild.remove();
 };
 update(root,template.content);
}

function renderMatrix(){
 const routes=S.pluto.videoStatus?.allsource||[],L=avLabels();
 let markup='<div class="mh">TV / SOURCE →</div>'+L.inputs.map((n,i)=>`<div class="mh"><button class="av40SourceHead" onclick="openAvSourceDrawer(${i+1})">${esc(n)}</button><small>Input ${i+1}</small></div>`).join('');
 for(let o=1;o<=8;o++){
  const online=avTvOnline(o),ps=avPowerStateInfo(o),cls=ps.known?(ps.on?'on':'off'):'unknown',title=ps.verified?`Live reported power: ${ps.label}. Click to toggle.`:ps.known?`Last RoomGoblin command: ${ps.label}. Hardware does not currently report live TV power. Click to toggle.`:'TV power state is not reported by the matrix. Click to send Power On.';
  markup+=`<div class="mh av40TvCell"><button class="av40TvName" onclick="openAvTvDrawer(${o})"><b>${esc(L.outputs[o-1])}</b><small>HDBT ${o} • ${esc(avReceiverSummary(o,online))}</small></button><button class="av40PowerMini ${cls} ${ps.verified?'reported':''}" title="${esc(title)}" onclick="event.stopPropagation();toggleRowTvPower(${o})">⏻</button></div>`;
  for(let i=1;i<=8;i++)markup+=`<button class="route ${Number(routes[o-1])===i?'active':''}" onclick="route(${o},${i})">${Number(routes[o-1])===i?'●':'○'} ${esc(L.inputs[i-1])}</button>`;
 }
 // Avoid repeatedly parsing the growing grid and replacing unchanged controls on polling.
 if(markup!==avMatrixMarkup){reconcileAvMarkup(matrix,markup);avMatrixMarkup=markup;}
 const allMarkup='<b>Route all TVs:</b>'+L.inputs.map((n,i)=>`<button onclick="routeAllTo(${i+1})">All → ${esc(n)}</button>`).join('');
 if(allMarkup!==avRouteAllMarkup){reconcileAvMarkup(routeAll,allMarkup);avRouteAllMarkup=allMarkup;}
 renderAv40Summary();
}
async function toggleRowTvPower(output){const ps=avPowerStateInfo(output),turnOn=ps.known?!ps.on:true;try{await plutoAction({action:'cecOutput',output:Number(output),connection:'hdbt',index:turnOn?0:1},false);saveAvPowerState(output,turnOn);renderMatrix();avMsg.textContent=`${avOutputLabel(output)} power ${turnOn?'on':'off'} sent`;}catch(e){notify(e.message,'error')}}
function renderAv40Summary(){const routes=S.pluto.videoStatus?.allsource||[],L=avLabels(),counts={};routes.forEach(x=>counts[x]=(counts[x]||0)+1);const best=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];av40MatrixSummary.textContent=S.avMatrixAvailable===false?'Unavailable':S.pluto?.ok?'Operational':'Needs Attention';av40MatrixSummary.className='kpi '+(S.avMatrixAvailable!==false&&S.pluto?.ok?'ok':'bad');av40Firmware.textContent=`Firmware ${S.pluto.systemStatus?.main||'—'}`;av40RouteSummary.textContent=best?`${best[1]} TV(s) → ${L.inputs[Number(best[0])-1]||'Unknown'}`:'No routes reported'}
async function route(o,i){try{if(!Number.isInteger(o)||o<1||o>8||!Number.isInteger(i)||i<1||i>8)throw new Error('Choose a valid matrix output and source.');await plutoAction({action:'route',output:o,input:i},false);for(let n=0;n<4;n++){await new Promise(r=>setTimeout(r,120*(n+1)));const v=(await jpost('/api/v1/pluto',{action:'videoStatus'})).data;if(Number(v.allsource?.[o-1])===i){S.pluto.videoStatus=v;renderMatrix();avMsg.textContent=`Verified: ${avOutputLabel(o)} → ${avInputLabel(i)}`;if(S.avDrawerOutput===o)renderAvDrawer({preserveDraft:true});return true}}avMsg.textContent=`Route sent but not verified: ${avOutputLabel(o)} → ${avInputLabel(i)}`;return false}catch(error){notify(error.message,'error');return false}}
async function routeAllTo(i){if(!confirm(`Route all TVs to ${avInputLabel(i)}?`))return;for(let o=1;o<=8;o++)if(!await route(o,i))return;refreshPluto()}
async function powerAllAvTvs(index){try{if(!confirm(`Power all TVs ${index===0?'on':'off'}?`))return;for(let o=1;o<=8;o++){await plutoAction({action:'cecOutput',output:o,connection:'hdbt',index},false);saveAvPowerState(o,index===0)}renderMatrix();setTimeout(refreshPluto,300)}catch(error){notify(error.message,'error')}}
function toggleAvAdvanced(){avAdvanced.open=!avAdvanced.open;if(avAdvanced.open)avAdvanced.scrollIntoView({behavior:'smooth',block:'start'})}
function openAvTvDrawer(output){closeAvSourceDrawer();S.avDrawerOutput=Number(output);renderAvDrawer();avTvDrawer.classList.add('open');avTvDrawer.showModal();avDrawerTvName.focus()}
function closeAvTvDrawer(){avTvDrawer.close();avTvDrawer.classList.remove('open')}
function openAvSourceDrawer(input){closeAvTvDrawer();S.avDrawerInput=Number(input);renderAvSourceDrawer();avSourceDrawer.classList.add('open');avSourceDrawer.showModal();avSourceDrawerName.focus()}
function closeAvSourceDrawer(){avSourceDrawer.close();avSourceDrawer.classList.remove('open')}
function renderAvSourceDrawer(){const i=Number(S.avDrawerInput||1),L=avLabels(),x=S.pluto.inputStatus||{},inactive=avBinaryState(x.inactive?.[i-1]),edid=x.edid?.[i-1];avSourceDrawerTitle.textContent=L.inputs[i-1];avSourceDrawerSubtitle.textContent=`Matrix Input ${i}`;avSourceDrawerName.value=L.inputs[i-1];avSourceDrawerEndpoint.value=L.sourceEndpoints[i-1]||`source${i}`;avSourceDrawerEdid.value=edid??15;avSourceDrawerInfo.innerHTML=`Signal: <b>${inactive===0?'Detected':inactive===1?'No signal':'Unknown'}</b><br>EDID profile: ${esc(edid??'Unknown')}<br>Endpoint: ${esc(L.sourceEndpoints[i-1]||`source${i}`)}`}
async function sourceDrawerPower(index){try{const i=Number(S.avDrawerInput||1);await plutoAction({action:'cecInput',input:i,index},false);notify(`${avInputLabel(i)} power ${index===1?'on':'off'} command sent.`,'success')}catch(error){notify(error.message,'error')}}
async function saveSourceDrawerEdid(){try{const i=Number(S.avDrawerInput||1),profile=Number(avSourceDrawerEdid.value);if(!Number.isInteger(profile)||profile<0||profile>255)return notify('EDID profile must be a whole number from 0 to 255.','error');if(!confirm(`Change ${avInputLabel(i)} EDID profile to ${profile}? Only change EDID when troubleshooting source compatibility.`))return;await plutoAction({action:'setEdid',input:i,profile});setTimeout(refreshPluto,250)}catch(error){notify(error.message,'error')}}
async function saveSourceDrawer(){
 try{
  const i=Number(S.avDrawerInput),L=avLabels(),name=avSourceDrawerName.value.trim()||`Content Source ${i}`,endpoint=avSourceDrawerEndpoint.value.trim()||`source${i}`;
  L.inputs[i-1]=name;L.sourceEndpoints[i-1]=endpoint;
  const j=await api('/api/v1/pluto/labels',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(L)});
  S.pluto.labels=j.labels;renderMatrix();renderAvSourceDrawer();notify('Source saved.','success');
 }catch(e){notify(`Source was not saved: ${e.message}`,'error')}
}
function renderAvDrawer({preserveDraft=false}={}){const o=Number(S.avDrawerOutput||1),L=avLabels(),input=Number(S.pluto.videoStatus?.allsource?.[o-1]||0),hit=displayByAvOutput(o),id=hit?.[0]||null,st=S.avDeviceStatus?.[id]||{},sig=avBinaryState(S.pluto.inputStatus?.inactive?.[input-1]),ps=avPowerStateInfo(o);avDrawerTitle.textContent=L.outputs[o-1];if(!preserveDraft)avDrawerTvName.value=L.outputs[o-1];avDrawerSubtitle.textContent=`HDBT ${o} • ${id?'Receiver '+id:'No unique receiver mapping'}`;avDrawerCurrentSource.textContent=L.inputs[input-1]||'Unknown';if(!preserveDraft)avDrawerSource.innerHTML=(input?'':'<option value="" selected>Select a source</option>')+L.inputs.map((n,i)=>`<option value="${i+1}" ${i+1===input?'selected':''}>${esc(n)} (Input ${i+1})</option>`).join('');avDrawerPowerStatus.textContent=ps.verified?`Power: ${ps.label} • live matrix report`:(ps.known?`Power: ${ps.label} • last RoomGoblin command; not hardware-confirmed`:'Power: Unknown • this matrix firmware is not reporting live TV power');avDrawerInfo.innerHTML=`Receiver: <b>${S.avConfigAvailable===false?'Mapping unavailable':!id?'No unique mapping':hit[1].enabled===false?'Disabled':S.avDeviceStatusAvailable===false?'Status unavailable':st.online?'Online':'Offline'}</b><br>Current Source: ${esc(L.inputs[input-1]||'—')}<br>Source Signal: ${sig===0?'Detected':sig===1?'Not detected':'Unknown'}<br>Resolution: ${esc(st.meta?.resolution||'Unknown')}<br>Last Seen: ${esc(overviewLastSeen(st))}`;if(!preserveDraft)renderDrawerTvGroups(id);syncAvDrawerPermissions()}
async function drawerTvPower(index){try{const o=Number(S.avDrawerOutput);await plutoAction({action:'cecOutput',output:o,connection:'hdbt',index},false);saveAvPowerState(o,index===0);renderMatrix();renderAvDrawer({preserveDraft:true});notify(`${avOutputLabel(o)} power ${index===0?'on':'off'} sent.`,'success')}catch(error){notify(error.message,'error')}}
async function saveDrawerTvName(){
 let receiverSaved=false;
 try{
  if(S.avConfigAvailable===false)throw new Error('Receiver configuration is unavailable. Refresh before saving a TV name.');
  const o=Number(S.avDrawerOutput),name=avDrawerTvName.value.trim()||`TV ${o}`,hit=displayByAvOutput(o);
  // A matrix output can exist without a RoomGoblin receiver. Rename its label only.
  if(hit){
   const [id]=hit,devices={...(S.avConfig.devices||{})};devices[id]={...devices[id],name};
   const saved=await api('/api/v1/admin/displays',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({devices,displayGroups:S.avConfig?.displayGroups||{}})});
   S.avConfig.devices=saved.devices;syncDisplayTargetNames(saved.devices);receiverSaved=true;
  }
  const L=avLabels();L.outputs[o-1]=name;
  const j=await api('/api/v1/pluto/labels',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(L)});
  S.pluto.labels=j.labels;renderMatrix();renderAvDrawer({preserveDraft:true});notify('TV name saved.','success');
 }catch(e){notify(`${receiverSaved?'Receiver name saved, but the matrix label was not saved':'TV name was not saved'}: ${e.message}`,'error')}
}
function renderDrawerTvGroups(id){const groups=S.avConfig?.displayGroups||{};avDrawerGroups.innerHTML=id?Object.entries(groups).filter(([n])=>n!=='all').map(([name,members])=>`<label><input type="checkbox" data-drawer-tv-group="${esc(name)}" ${(members||[]).includes(id)?'checked':''}><span>${esc(name)}</span></label>`).join('')||'<span class="muted">No optional groups configured.</span>':'<span class="muted">No unique receiver mapping. Open Edit Receivers & Groups.</span>'}
async function saveDrawerTvGroups(){try{const o=Number(S.avDrawerOutput),id=requireAvReceiver(o),groups={...(S.avConfig?.displayGroups||{})};document.querySelectorAll('[data-drawer-tv-group]').forEach(cb=>{const n=cb.dataset.drawerTvGroup,m=new Set(groups[n]||[]);cb.checked?m.add(id):m.delete(id);groups[n]=[...m]});if(groups.all&&!groups.all.includes(id))groups.all=[...groups.all,id];const saved=await api('/api/v1/admin/displays',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:S.avConfig?.room,devices:S.avConfig?.devices||{},displayGroups:groups,lightingGroups:S.avConfig?.lightingGroups||[]})});S.avConfig.displayGroups=saved.displayGroups;notify('TV groups saved.','success')}catch(e){notify(`TV groups were not saved: ${e.message}`,'error')}}
function drawerUpdateRoute(){return route(Number(S.avDrawerOutput),Number(avDrawerSource.value))}
async function sendTvTestImage(id,output){return api('/api/v1/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'display.image',target:id,payload:{url:`/test-images/tv${output}.svg`,fit:'contain'}})})}
async function drawerTestImage(){try{const o=Number(S.avDrawerOutput),id=requireAvReceiver(o);if(S.avDeviceStatusAvailable===false)throw new Error('Receiver status is unavailable. Refresh before sending display commands.');if(!S.avDeviceStatus?.[id]?.online)throw new Error(`${avOutputLabel(o)} receiver ${id} is offline`);await sendTvTestImage(id,o);avDrawerToolStatus.textContent=`Test image sent to ${id}`;notify(`Test image sent to ${avOutputLabel(o)}.`,'success')}catch(e){avDrawerToolStatus.textContent=e.message;notify(e.message,'error')}}
async function drawerDisplayCommand(type,label){const o=Number(S.avDrawerOutput),id=requireAvReceiver(o),st=S.avDeviceStatus?.[id];if(S.avDeviceStatusAvailable===false)throw new Error('Receiver status is unavailable. Refresh before sending display commands.');if(!st?.online)throw new Error(`${avOutputLabel(o)} receiver ${id} is offline`);avDrawerToolStatus.textContent=`Sending ${label} to ${id}…`;const j=await api('/api/v1/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,target:id,payload:{requestedAt:new Date().toISOString()}})});avDrawerToolStatus.textContent=`${label} sent to ${id}`;notify(`${label} sent to ${avOutputLabel(o)}.`,'success');return j}
async function drawerClearDisplay(){try{return await drawerDisplayCommand('display.clear','Clear Display')}catch(e){avDrawerToolStatus.textContent=e.message;notify(e.message,'error')}}
async function drawerReloadDisplay(){try{return await drawerDisplayCommand('display.reload','Reload Display')}catch(e){avDrawerToolStatus.textContent=e.message;notify(e.message,'error')}}
function renderAvTargets(){
 const L=avLabels();
 avTvTargets.innerHTML=L.outputs.map((n,i)=>`<label class="avTarget"><input type="checkbox" class="avTvTarget" value="${i+1}"><b>${esc(n)}</b><span class="muted">HDBT ${i+1}</span></label>`).join('');
 avBulkSource.innerHTML=L.inputs.map((n,i)=>`<option value="${i+1}">${esc(n)} (Input ${i+1})</option>`).join('');
}
function selectedAvTvs(){return [...document.querySelectorAll('.avTvTarget:checked')].map(x=>Number(x.value))}
function setAllAvTvTargets(state){document.querySelectorAll('.avTvTarget').forEach(x=>x.checked=state)}
async function routeSelectedTvs(){const outs=selectedAvTvs(),input=Number(avBulkSource.value);if(!outs.length)return alert('Select at least one TV.');for(const o of outs)await route(o,input);refreshPluto()}
async function powerSelectedTvs(index){try{const outs=selectedAvTvs();if(!outs.length)return alert('Select at least one TV.');for(const o of outs)await plutoAction({action:'cecOutput',output:o,connection:'hdbt',index},false);avMsg.textContent=`Power ${index===0?'On':'Off'} sent to ${outs.map(avOutputLabel).join(', ')}`;setTimeout(refreshPluto,250)}catch(error){notify(error.message,'error')}}
function renderSourceSelector(){
 const L=avLabels(),old=Number(avSourceDevice.value)||1;
 avSourceDevice.innerHTML=L.inputs.map((n,i)=>`<option value="${i+1}">${esc(n)} (Input ${i+1})</option>`).join('');avSourceDevice.value=String(Math.min(8,Math.max(1,old)));updateSourceSignal();
 avSourceDevice.onchange=updateSourceSignal;
}
function updateSourceSignal(){const i=Number(avSourceDevice.value)||1,x=S.pluto.inputStatus||{},inactive=avBinaryState(x.inactive?.[i-1]);avSourceSignal.textContent=inactive===0?'Signal detected':inactive===1?'No signal':'Unknown';avSourceSignal.className='pill '+(inactive===0?'ok':'')}
function sourcePower(index){return plutoAction({action:'cecInput',input:Number(avSourceDevice.value),index})}
function selScaler(type,o,val){return `<select onchange="plutoAction({action:'${type}Scaler',output:${o},mode:Number(this.value)})"><option value="0" ${val==0?'selected':''}>Bypass</option><option value="1" ${val==1?'selected':''}>4K→1080p</option><option value="3" ${val==3?'selected':''}>Auto</option></select>`}
function renderOutputs(){
 const x=S.pluto.outputStatus||{},r=x.allsource||S.pluto.videoStatus?.allsource||[],L=avLabels();outputRows.innerHTML='';
 for(let o=1;o<=8;o++)outputRows.innerHTML+=`<tr><td><b>${esc(L.outputs[o-1])}</b><br><span class="muted">HDBT ${o}</span></td><td>${esc(avInputLabel(r[o-1]??0))}</td>
 <td><button onclick="plutoAction({action:'hdbtStream',output:${o},state:${!Number(x.allhdbtout?.[o-1])}})">${Number(x.allhdbtout?.[o-1])?'ON':'OFF'}</button></td>
 <td>${selScaler('hdbt',o,x.allhdbtscaler?.[o-1]??0)}</td>
 <td><button onclick="plutoAction({action:'txHdcp',output:${o},state:${!Number(x.allhdcp?.[o-1])}})">${Number(x.allhdcp?.[o-1])?'ON':'OFF'}</button></td></tr>`;
}
function renderInputs(){
 const x=S.pluto.inputStatus||{},L=avLabels();inputRows.innerHTML='';
 for(let i=1;i<=8;i++){
  const inactive=avBinaryState(x.inactive?.[i-1]),signal=inactive===0?'Detected':inactive===1?'None':'?';
  inputRows.innerHTML+=`<tr><td><b>${esc(L.inputs[i-1])}</b><br><span class="muted">Input ${i}</span></td><td><span class="pill ${inactive===0?'ok':''}">${signal}</span></td><td>${x.edid?.[i-1]??'?'}</td><td><input id="edid${i}" type="number" min="0" max="255" value="${x.edid?.[i-1]??15}" style="width:70px"><button onclick="plutoAction({action:'setEdid',input:${i},profile:Number(edid${i}.value)})">Set</button></td><td><button class="on" onclick="plutoAction({action:'cecInput',input:${i},index:1})">On</button><button class="danger" onclick="plutoAction({action:'cecInput',input:${i},index:2})">Off</button></td></tr>`;
 }
}
function displaysByAvOutput(output){return Object.entries(S.avConfig?.devices||{}).filter(([,d])=>Number(d?.avOutput)===Number(output))}
function displayByAvOutput(output){const hits=displaysByAvOutput(output);return hits.length===1?hits[0]:null}
function avReceiverSummary(output,online){if(S.avConfigAvailable===false)return 'Receiver mapping unavailable';if(S.avDeviceStatusAvailable===false)return 'Receiver status unavailable';const hits=displaysByAvOutput(output);return hits.length>1?`Multiple receivers: ${hits.map(([id])=>id).join(', ')}`:hits.length?`${hits[0][0]} • Receiver ${online?'online':'offline'}`:'No receiver assigned'}
function syncDisplayTargetNames(devices){
 const changed=JSON.stringify(S.displayDevices)!==JSON.stringify(devices);S.displayDevices=devices;
 if(!changed)return;
 const selected=[...document.querySelectorAll('[data-classtarget]:checked')].map(x=>x.dataset.classtarget);
 renderClassDefaultTargets(selected.length?selected:['all']);populateDisplaySelect(window.mediaTarget);
 if(window.autoTargets&&window.autoAction&&!autoAction.value.startsWith('govee.'))renderAutoTargets([...document.querySelectorAll('[data-autotarget]:checked')].map(x=>x.dataset.autotarget));
}
function syncAvOutputLabelsFromDisplays(){
 const L=avLabels();
 const outputs=L.outputs.map((fallback,i)=>{const hit=displayByAvOutput(i+1);return hit?String(hit[1]?.name||hit[0]):fallback;});
 S.pluto.labels={...L,outputs};
}
function renderDisplayAvConfiguration(){
 const cfg=S.avConfig||{},ds=cfg.devices||{},groups=cfg.displayGroups||{},L=avLabels();
 avTvConfig.innerHTML=Array.from({length:8},(_,idx)=>{
   const out=idx+1,hit=displayByAvOutput(out),id=hit?.[0]||`tv${out}`,d=hit?.[1]||{};
   return `<div class="card" data-av-tv-output="${out}" style="box-shadow:none;margin:7px 0"><div class="row"><b>HDBT ${out}</b><span class="pill">TV</span></div><label>Friendly name<input data-av-tv-name value="${esc(d.name||`TV ${out}`)}"></label><div class="grid2" style="margin-top:7px"><label>Receiver ID<input data-av-tv-id value="${esc(id)}" ${hit?'readonly':''}></label><label>Lighting mapping<input data-av-tv-light value="${esc(d.lightingAlias||'')}" placeholder="optional"></label></div><label style="display:flex;gap:7px;align-items:center;margin-top:7px"><input type="checkbox" data-av-tv-enabled ${d.enabled!==false?'checked':''}> Enabled</label></div>`;
 }).join('');
 avSourceConfig.innerHTML=Array.from({length:8},(_,idx)=>`<div class="card" data-av-source-input="${idx+1}" style="box-shadow:none;margin:7px 0"><div class="row"><b>Input ${idx+1}</b><span class="pill">SOURCE</span></div><label>Friendly name<input data-av-source-name value="${esc(L.inputs[idx])}"></label><label style="margin-top:7px">Browser / kiosk endpoint ID<input data-av-source-endpoint value="${esc(L.sourceEndpoints[idx])}" placeholder="source${idx+1}"></label></div>`).join('');
 avGroupEditor.innerHTML=Object.entries(groups).map(([name,members])=>avGroupCard(name,members,ds)).join('')||'<div class="muted">No TV groups configured.</div>';
}
function avGroupCard(name,members,devices){return `<div class="groupCard" data-av-group="${esc(name)}"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(name)}</b>${name==='all'?'<span class="pill">Core</span>':`<button class="danger" onclick="removeAvDisplayGroup(${inlineJsArg(name)})">Remove</button>`}</div><div class="checkGrid">${Object.keys(devices).map(id=>`<label class="checkItem"><input type="checkbox" value="${esc(id)}" ${(members||[]).includes(id)?'checked':''}>${esc(devices[id]?.name||id)}</label>`).join('')}</div></div>`}
function addAvDisplayGroup(){const n=avNewGroup.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-');if(!n)return;S.avConfig.displayGroups=S.avConfig.displayGroups||{};if(S.avConfig.displayGroups[n])return alert('That group already exists.');S.avConfig.displayGroups[n]=[];avNewGroup.value='';renderDisplayAvConfiguration()}
function removeAvDisplayGroup(name){if(!confirm(`Remove TV group ${name}?`))return;delete S.avConfig.displayGroups[name];renderDisplayAvConfiguration()}
async function saveDisplayAvConfiguration(){
 try{
   const old=S.avConfig?.devices||{},devices={...old};
   document.querySelectorAll('[data-av-tv-output]').forEach(card=>{const output=Number(card.dataset.avTvOutput),id=card.querySelector('[data-av-tv-id]').value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-')||`tv${output}`,base={...(old[id]||{})};base.name=card.querySelector('[data-av-tv-name]').value.trim()||`TV ${output}`;base.enabled=card.querySelector('[data-av-tv-enabled]').checked;base.avOutput=output;base.lightingAlias=card.querySelector('[data-av-tv-light]').value.trim()||null;base.tags=Array.from(new Set([...(base.tags||[]),'classroom']));devices[id]=base});
   const displayGroups={};avGroupEditor.querySelectorAll('[data-av-group]').forEach(card=>displayGroups[card.dataset.avGroup]=[...card.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value));
   if(!displayGroups.all)displayGroups.all=Object.keys(devices).filter(id=>devices[id].enabled!==false);
   const inputs=[],sourceEndpoints=[];document.querySelectorAll('[data-av-source-input]').forEach(card=>{inputs.push(card.querySelector('[data-av-source-name]').value.trim()||`Content Source ${card.dataset.avSourceInput}`);sourceEndpoints.push(card.querySelector('[data-av-source-endpoint]').value.trim()||`source${card.dataset.avSourceInput}`)});
   const outputs=Array.from({length:8},(_,i)=>displayByAvOutput(i+1)?.[1]?.name||document.querySelector(`[data-av-tv-output="${i+1}"] [data-av-tv-name]`)?.value.trim()||`TV ${i+1}`);
   await api('/api/v1/admin/displays',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:S.avConfig?.room,devices,displayGroups,lightingGroups:S.avConfig?.lightingGroups||[]})});
   const lab=await api('/api/v1/pluto/labels',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({outputs,inputs,sourceEndpoints})});S.pluto.labels=lab.labels;avConfigMsg.textContent='TV, source and group mapping saved.';await refreshPluto();
 }catch(e){avConfigMsg.textContent=e.message}
}
function renderAvRawStatus(){avRawStatus.style.display='block';avRawStatus.textContent=JSON.stringify({video:S.pluto.videoStatus,outputs:S.pluto.outputStatus,inputs:S.pluto.inputStatus,cec:S.pluto.cecStatus,system:S.pluto.systemStatus,network:S.pluto.networkStatus},null,2)}
function renderTV(){const s=S.pluto.systemStatus||{},n=S.pluto.networkStatus||{};systemInfo.innerHTML=`Power: <b>${esc(s.power)}</b><br>Firmware: ${esc(s.main)}<br>Sub1: ${esc(s.sub1)}<br>Sub2: ${esc(s.sub2)}<br>CPLD: ${esc(s.cpld)}<br>Panel Lock: ${esc(s.lock)}<br>Beep: ${esc(s.beep)}`;networkInfo.innerHTML=`Model: <b>${esc(n.model)}</b><br>Hostname: ${esc(n.hostname)}<br>IP: ${esc(n.ipaddress)}<br>Subnet: ${esc(n.subnet)}<br>Gateway: ${esc(n.gateway)}<br>MAC: ${esc(n.macaddress)}<br>TCP: ${esc(n.tcpport)} • Telnet: ${esc(n.telnetport)}`}
async function toggleSystem(action){try{const s=S.pluto.systemStatus||{},state=action==='panelLock'?!Number(s.lock):!Number(s.beep);await plutoAction({action,state})}catch(error){notify(error.message,'error')}}


let RECEIVERCFG=null,receiverSettingsLoading=false;
async function loadReceiverSettings(){
 if(RECEIVERCFG||receiverSettingsLoading)return;
 receiverSettingsLoading=true;cfgDisplaysMsg.textContent='Loading receivers…';
 try{RECEIVERCFG=await api('/api/v1/config');renderAdminDisplayEditor();cfgDisplaysMsg.textContent='';}
 catch(e){cfgDisplaysMsg.textContent=`Could not load receivers: ${e.message}`}
 finally{receiverSettingsLoading=false}
}
async function reloadReceiverSettings(){if(RECEIVERCFG&&!confirm('Discard unsaved receiver and group edits and reload saved settings?'))return;RECEIVERCFG=null;await loadReceiverSettings()}
function openReceiverSettings(){closeAvTvDrawer();receiverSettings.open=true;loadReceiverSettings();receiverSettings.scrollIntoView({block:'start'})}
function isEmptyLegacyDisplayGroup(name,members){return /^(?:display-){2,}/.test(name)&&Array.isArray(members)&&members.length===0}
function renderAdminDisplayEditor(){
 const ds=RECEIVERCFG?.devices||{},groups=RECEIVERCFG?.displayGroups||{};
 cfgDisplayEditor.innerHTML=Object.entries(ds).map(([id,d])=>`<div class="receiverRow" data-display-id="${esc(id)}"><div class="receiverId"><b>Receiver ID:</b> <code>${esc(id)}</code></div><label>Name<input data-f="name" value="${esc(d.name||id)}"></label><label>Enabled<select data-f="enabled"><option value="1" ${d.enabled!==false?'selected':''}>Yes</option><option value="0" ${d.enabled===false?'selected':''}>No</option></select></label><label>AV Output<input data-f="avOutput" type="number" min="1" max="64" value="${esc(d.avOutput??'')}" placeholder="Not assigned"></label><label>Lighting<input data-f="lightingAlias" value="${esc(d.lightingAlias||'')}"></label><label>Tags<input data-f="tags" value="${esc((d.tags||[]).join(', '))}"></label><label>Audio priority<select data-f="audioScope"><option value="room" ${d.audioScope!=='independent'?'selected':''}>Classroom (shared)</option><option value="independent" ${d.audioScope==='independent'?'selected':''}>Independent (hallway)</option></select></label><button class="danger" onclick="removeAdminDisplay(${inlineJsArg(id)})">Remove Receiver</button></div>`).join('');
 cfgGroupEditor.innerHTML=Object.entries(groups).map(([name,members])=>adminGroupCard(name,members,ds)).join('')||'<div class="muted">No groups configured.</div>';
 const outputs=new Map();for(const [id,d] of Object.entries(ds)){if(d.avOutput){const n=Number(d.avOutput);outputs.set(n,[...(outputs.get(n)||[]),id])}}
 const shared=[...outputs].filter(([,ids])=>ids.length>1).map(([n,ids])=>`Output ${n}: ${ids.join(', ')}`);
 cfgMappingWarnings.textContent=shared.length?`Shared output assignments — review if unintended. ${shared.join('; ')}. Receiver tools need a unique assignment; routing still works.`:'';
}
function adminGroupCard(name,members,devices){return `<div class="groupCard" data-group="${esc(name)}"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(name)}</b>${name==='all'?'<span class="pill">Core</span>':`<button class="danger" onclick="removeAdminDisplayGroup(${inlineJsArg(name)})">Remove</button>`}</div><div class="checkGrid">${Object.keys(devices).map(id=>`<label class="checkItem"><input type="checkbox" value="${esc(id)}" ${(members||[]).includes(id)?'checked':''}>${esc(devices[id]?.name||id)} (${esc(id)})</label>`).join('')}</div></div>`}
function collectAdminDisplays(){
 if(!RECEIVERCFG)throw Error('Load receiver settings first.');
 const old=RECEIVERCFG.devices||{},devices=Object.create(null);
 cfgDisplayEditor.querySelectorAll('[data-display-id]').forEach(row=>{const id=row.dataset.displayId,d={...(old[id]||{})};d.name=row.querySelector('[data-f="name"]').value.trim()||id;d.enabled=row.querySelector('[data-f="enabled"]').value==='1';const av=row.querySelector('[data-f="avOutput"]').value;d.avOutput=av===''?null:Number(av);if(d.avOutput!==null&&(!Number.isInteger(d.avOutput)||d.avOutput<1||d.avOutput>64))throw Error(`Invalid AV output for ${id}. Use 1–64 or leave blank.`);d.lightingAlias=row.querySelector('[data-f="lightingAlias"]').value.trim()||null;d.tags=row.querySelector('[data-f="tags"]').value.split(',').map(x=>x.trim()).filter(Boolean);d.audioScope=row.querySelector('[data-f="audioScope"]').value;devices[id]=d});
 const displayGroups=Object.create(null);cfgGroupEditor.querySelectorAll('[data-group]').forEach(card=>{displayGroups[card.dataset.group]=[...card.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.value)});
 return {...RECEIVERCFG,devices,displayGroups};
}
async function saveAdminDisplaysStructured(){try{const v=collectAdminDisplays();const j=await api('/api/v1/admin/displays',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({devices:v.devices,displayGroups:v.displayGroups})});RECEIVERCFG={...v,devices:j.devices,displayGroups:j.displayGroups};S.avConfig=RECEIVERCFG;syncDisplayTargetNames(j.devices);syncAvOutputLabelsFromDisplays();renderMatrix();renderAdminDisplayEditor();cfgDisplaysMsg.textContent='Receivers and groups saved.';}catch(e){cfgDisplaysMsg.textContent=`Not saved: ${e.message}`}}
function removeAdminDisplay(id){if(!RECEIVERCFG||!confirm(`Remove display ${id}? Existing schedules referencing it may need review. Save to apply.`))return;RECEIVERCFG=collectAdminDisplays();delete RECEIVERCFG.devices[id];for(const g of Object.keys(RECEIVERCFG.displayGroups||{}))RECEIVERCFG.displayGroups[g]=(RECEIVERCFG.displayGroups[g]||[]).filter(x=>x!==id);renderAdminDisplayEditor()}
function addAdminDisplayGroup(){if(!RECEIVERCFG)return;const n=cfgNewGroup.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,'-');if(!n)return;RECEIVERCFG=collectAdminDisplays();if(Object.prototype.hasOwnProperty.call(RECEIVERCFG.displayGroups,n))return alert('That group already exists.');Object.defineProperty(RECEIVERCFG.displayGroups,n,{value:[],enumerable:true,writable:true,configurable:true});cfgNewGroup.value='';renderAdminDisplayEditor()}
function removeAdminDisplayGroup(name){if(!RECEIVERCFG||name==='all'||!confirm(`Remove display group ${name}? Existing schedules referencing it may need review. Save to apply.`))return;RECEIVERCFG=collectAdminDisplays();delete RECEIVERCFG.displayGroups[name];renderAdminDisplayEditor()}
function removeEmptyLegacyDisplayGroups(){if(!RECEIVERCFG)return;const v=collectAdminDisplays(),names=Object.entries(v.displayGroups).filter(([n,m])=>isEmptyLegacyDisplayGroup(n,m)).map(([n])=>n);if(!names.length)return notify('No empty legacy groups found.');if(!confirm(`Remove these empty legacy groups: ${names.join(', ')}? Existing schedule references remain unchanged. Save to apply.`))return;for(const n of names)delete v.displayGroups[n];RECEIVERCFG=v;renderAdminDisplayEditor();cfgDisplaysMsg.textContent='Empty legacy groups removed from draft. Save to apply.'}

// Native modal focus stays inside the active drawer and returns on Escape/close.
for(const drawer of [avTvDrawer,avSourceDrawer]){
 drawer.addEventListener('close',()=>drawer.classList.remove('open'));
 drawer.addEventListener('click',event=>{
  const box=drawer.getBoundingClientRect();
  if(event.target===drawer&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))drawer.close();
 });
}
window.addEventListener('roomgoblin:modalopen',()=>{closeAvTvDrawer();closeAvSourceDrawer()});

function syncAvDrawerPermissions(){
 const save=avTvDrawer.querySelector('button[onclick="saveDrawerTvName()"]');
 if(save)save.dataset.commandUnavailable=String(S.avConfigAvailable===false||!!displayByAvOutput(S.avDrawerOutput)&&!userCan('admin'));
 enforceCapabilityControls(avTvDrawer);
 enforceCapabilityControls(avSourceDrawer);
}
window.addEventListener('roomgoblin:authchange',syncAvDrawerPermissions);
