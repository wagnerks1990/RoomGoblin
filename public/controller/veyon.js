
const $=id=>document.getElementById(id);
let computers=[],selected=new Set(),liveId=null,liveTimer=null,roleFilter='student';
const THUMB_CONCURRENCY=4;
const THUMB_REFRESH_MS=10000;
const thumbState=new Map();
let thumbTimer=null, previewsPaused=false, thumbnailQueueBusy=false, loadBusy=false;
let liveController=null, liveObjectUrl=null, liveGeneration=0, liveFailures=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(url,opt={}){const r=await fetch(url,{...opt,headers:{'Content-Type':'application/json',...(opt.headers||{})}});const t=await r.text();let j={};try{j=t?JSON.parse(t):{}}catch{j={error:t}}if(!r.ok)throw new Error(j?.error?.message||j.error||`${r.status}`);return j}
function updateSelectionCount(){
  const visible=new Set(visibleComputers().map(c=>c.id)), hidden=[...selected].filter(id=>!visible.has(id)).length;
  $('selectionCount').textContent=`${selected.size} selected${hidden?` · ${hidden} hidden by filters`:''}`;
  document.querySelectorAll('[data-select]').forEach(el=>el.closest('.card').classList.toggle('selected',el.checked));
}
function targetIds(){return [...selected]}
function visibleComputers(){
  const query=$('deviceSearch').value.trim().toLowerCase(), connection=$('connectionFilter').value;
  return computers.filter(c=>(roleFilter==='all'||(roleFilter==='teacher'?c.role==='teacher':c.role!=='teacher'))
    &&(!query||[c.name,c.hostname,c.ip,c.user?.fullName,c.user?.login].some(x=>String(x||'').toLowerCase().includes(query)))
    &&(connection==='all'||connection==='online'&&c.online||connection==='offline'&&!c.online||connection==='attention'&&(!c.authenticated||c.error)));
}
function render(){
  const focused=document.activeElement,focusKey=focused?.closest('#grid')?[...focused.attributes].find(a=>a.name.startsWith('data-')):null;
  const expanded=new Set([...document.querySelectorAll('[data-device-menu][open]')].map(el=>el.dataset.deviceMenu));
  const students=computers.filter(x=>x.role!=='teacher').length,teachers=computers.filter(x=>x.role==='teacher').length;
  $('summary').textContent=`${students} students • ${teachers} teachers • ${computers.filter(x=>x.online).length} online • ${computers.filter(x=>x.authenticated).length} authenticated`;
  $('visibleCount').textContent=`${visibleComputers().length} of ${computers.length} computers`;
  $('grid').innerHTML=visibleComputers().map(c=>`
    <article class="card ${selected.has(c.id)?'selected':''}">
      <div class="thumb">
        <input class="check" type="checkbox" data-select="${esc(c.id)}" aria-label="Select ${esc(c.name||c.hostname||c.ip)}" ${selected.has(c.id)?'checked':''}>
        <span class="badge ${c.online?'online':'offline'}">${c.online?'ONLINE':'OFFLINE'}</span>
        ${c.online
          ?`<img data-thumb="${esc(c.id)}" alt="Screen preview for ${esc(c.name||c.ip)}" ${thumbState.get(c.id)?.url?`src="${thumbState.get(c.id).url}"`: 'hidden'}><span class="muted thumbStatus" data-thumb-status="${esc(c.id)}">${esc(thumbState.get(c.id)?.message||'Waiting for preview…')}</span><button class="thumbRetry" ${thumbState.get(c.id)?.failures?'':'hidden'} data-retry="${esc(c.id)}" aria-label="Retry screen for ${esc(c.name||c.ip)}">Retry</button>`
          :`<span class="muted">${c.online?'Veyon not authenticated':'No Veyon connection'}</span>`}
      </div>
      <div class="body">
        <div class="name">${esc(c.name||c.hostname||c.ip)} <span class="list-status ${c.online?'online':'offline'}">${c.online?'Online':'Offline'}</span></div>
        <div class="meta"><span class="${c.role==='teacher'?'roleTeacher':'roleStudent'}">${c.role==='teacher'?'TEACHER':'STUDENT'}</span> • ${esc(c.hostname||'')} ${c.hostname?'• ':''}${esc(c.ip)}</div>
        <div class="meta">User: ${esc(c.user?.fullName||c.user?.login||'No user logged in')}</div>
        <div class="meta">Screen lock: <span class="${c.featureState?.screenLock?'featureOn':'featureOff'}">${c.featureState?.screenLock?'ACTIVE':'off'}</span> • Input lock: <span class="${c.featureState?.inputLock?'featureOn':'featureOff'}">${c.featureState?.inputLock?'ACTIVE':'off'}</span></div>
        ${c.featureState?.screenLock&&!c.user?.login?`<div class="notice">Lock is active. No lock graphic can be shown until a user is logged in; input remains locked.</div>`:''}
        ${c.error?`<div class="meta offline">${esc(c.error)}</div>`:''}
        <div class="actions">
          <button data-live="${esc(c.id)}">Live View</button>
          <button data-msg="${esc(c.id)}">Message</button>
          <button data-lock="${esc(c.id)}">Lock</button>
          <button data-unlock="${esc(c.id)}">Unlock</button>
          </div><details class="device-menu" data-device-menu="${esc(c.id)}" ${expanded.has(c.id)?'open':''}><summary>Device details &amp; tools</summary><div class="actions"><button data-role="${esc(c.id)}">${c.role==='teacher'?'Make Student':'Make Teacher'}</button>
          <button data-devicefeatures="${esc(c.id)}">Features</button>
          <button data-rename="${esc(c.id)}">Rename</button>
        </div></details>
      </div>
    </article>`).join('')||'<div class="empty-inventory">No computers match these filters. Try All devices or discover computers.</div>';
  updateSelectionCount();
  if(focusKey)document.querySelector(`[${focusKey.name}="${CSS.escape(focusKey.value)}"]`)?.focus({preventScroll:true});
  document.querySelectorAll('[data-retry]').forEach(x=>x.onclick=()=>{const state=thumbState.get(x.dataset.retry);if(state)state.nextTry=0;queueVisibleThumbnails()});
  document.querySelectorAll('[data-select]').forEach(x=>x.onchange=()=>{x.checked?selected.add(x.dataset.select):selected.delete(x.dataset.select);updateSelectionCount()});
  queueVisibleThumbnails();
  document.querySelectorAll('[data-live]').forEach(x=>x.onclick=()=>openLive(x.dataset.live));
  document.querySelectorAll('[data-msg]').forEach(x=>x.onclick=()=>messageTargets([x.dataset.msg]));
  document.querySelectorAll('[data-lock]').forEach(x=>x.onclick=()=>feature([x.dataset.lock],'screenLock',true));
  document.querySelectorAll('[data-unlock]').forEach(x=>x.onclick=()=>feature([x.dataset.unlock],'screenLock',false));
  document.querySelectorAll('[data-role]').forEach(x=>x.onclick=()=>toggleRole(x.dataset.role));
  document.querySelectorAll('[data-devicefeatures]').forEach(x=>x.onclick=()=>showDeviceFeatures(x.dataset.devicefeatures));
  document.querySelectorAll('[data-rename]').forEach(x=>x.onclick=()=>renameComputer(x.dataset.rename));
}
async function status(){
  try{const x=await api('/api/v1/veyon/status');$('apiStatus').innerHTML=`Veyon API: <span class="online">CONNECTED</span> • ${esc(x.keyName||'Key not configured')}${x.scanSubnet?` • ${esc(x.scanSubnet)}.0/24`:''}`}
  catch(e){$('apiStatus').innerHTML=`Veyon API: <span class="offline">OFFLINE</span> • ${esc(e.message)}`}
}
async function load(){
  if(loadBusy)return;loadBusy=true;
  status();
  try{
    const x=await api('/api/v1/veyon/computers');computers=x.computers||[];
    const known=new Set(computers.map(c=>c.id));selected=new Set([...selected].filter(id=>known.has(id)));
    for(const [id,state] of thumbState)if(!known.has(id)){state.controller?.abort();if(state.url)URL.revokeObjectURL(state.url);thumbState.delete(id)}
    $('inventoryStatus').textContent='';render();
  }catch(e){$('inventoryStatus').textContent=`Inventory could not refresh: ${e.message}. Showing the last available inventory.`}
  finally{loadBusy=false}
}
async function discover(){
  $('discover').disabled=true;$('discover').textContent='Scanning…';
  try{await api('/api/v1/veyon/discover',{method:'POST',body:'{}'});await load()}
  catch(e){alert(e.message)}finally{$('discover').disabled=false;$('discover').textContent='Discover computers'}
}
async function feature(targets,name,active=true,args={}){
  if(!targets.length)return alert('Select at least one computer.');
  try{
    const x=await api('/api/v1/veyon/feature',{method:'POST',body:JSON.stringify({targets,feature:name,active,arguments:args})});
    const s=x.summary||{},failed=(x.results||[]).filter(r=>!r.ok&&!r.skipped),skipped=(x.results||[]).filter(r=>r.skipped);
    if(failed.length||skipped.length){
      const lines=[`Succeeded: ${s.succeeded??0}`,`Skipped: ${s.skipped??0}`,`Failed: ${s.failed??failed.length}`];
      if(s.skippedOffline)lines.push(`Offline: ${s.skippedOffline}`);
      if(s.skippedNoUser)lines.push(`No logged-in user: ${s.skippedNoUser}`);
      if(failed.length)lines.push('\nFailures:\n'+failed.map(r=>`${r.name||r.ip}: ${r.error||'command failed'}`).join('\n'));
      alert(lines.join('\n'));
    }
    setTimeout(load,500);
  }catch(e){alert(e.message)}
}
async function messageTargets(targets){
  const text=prompt('Message to display:');if(!text)return;
  await feature(targets,'textMessage',true,{text});
}
function needSel(){const ids=targetIds();if(!ids.length)alert('Select at least one computer.');return ids}

function setRoleFilter(role){
  roleFilter=role;
  $('showStudents').classList.toggle('active',role==='student');
  $('showTeachers').classList.toggle('active',role==='teacher');
  $('showAll').classList.toggle('active',role==='all');
  for(const [id,value] of [['showStudents','student'],['showTeachers','teacher'],['showAll','all']])$(id).setAttribute('aria-pressed',String(role===value));
  render();
}
async function setRole(ids,role){
  if(!ids.length)return alert('Select at least one computer.');
  try{
    await api('/api/v1/veyon/computers/role',{method:'POST',body:JSON.stringify({ids,role})});
    ids.forEach(id=>{
      const c=computers.find(x=>x.id===id);
      if(c)c.role=role;
    });
    render();
  }catch(e){alert(e.message)}
}
async function toggleRole(id){
  const c=computers.find(x=>x.id===id);
  if(!c)return;
  await setRole([id],c.role==='teacher'?'student':'teacher');
}

function openInfo(title,html){$('infoTitle').textContent=title;$('infoBody').innerHTML=html;$('infoModal').classList.add('open')}
function closeInfo(){$('infoModal').classList.remove('open');$('infoBody').innerHTML=''}
$('closeInfo').onclick=closeInfo;$('infoModal').onclick=e=>{if(e.target===$('infoModal'))closeInfo()};

async function showDeviceFeatures(id){
  const c=computers.find(x=>x.id===id);if(!c)return;
  openInfo(`Features — ${c.name||c.ip}`,'Loading…');
  try{
    const x=await api(`/api/v1/veyon/computers/${encodeURIComponent(id)}/features`);
    const rows=(x.features||[]).map(f=>{
      const name=f.name||f.Name||f.description||f.Description||'Feature';
      const uid=f.uid||f.UID||f.id||f.Id||'';
      return `<div class="featureRow"><span>${esc(name)}</span><code>${esc(uid)}</code></div>`;
    }).join('');
    $('infoBody').innerHTML=`<div class="featureList">${rows||'<span class="muted">No feature list returned.</span>'}</div>`;
  }catch(e){$('infoBody').innerHTML=`<span class="offline">${esc(e.message)}</span>`}
}
async function showFeatures(){
  const c=visibleComputers().find(x=>x.online)||computers.find(x=>x.online);
  if(!c)return alert('No online Veyon computer available.');
  await showDeviceFeatures(c.id);
}
async function showPool(){
  openInfo('Veyon Connection Pool','Loading…');
  try{
    const x=await api('/api/v1/veyon/connections');
    $('infoBody').innerHTML=`<div class="notice">${x.size} / ${x.max} cached connections</div><div class="featureList">${(x.connections||[]).map(r=>`<div class="featureRow"><span>${esc(r.host)}</span><span>idle ${r.idleSeconds}s • lifetime ${r.secondsRemaining}s</span></div>`).join('')}</div><div class="toolbar"><button id="closePool">Close All Cached Connections</button></div>`;
    $('closePool').onclick=async()=>{if(!confirm('Close all cached Veyon connections? Active previews will reconnect.'))return;try{await api('/api/v1/veyon/connections/close',{method:'POST',body:JSON.stringify({ids:['all']})});closeInfo();await load()}catch(error){alert(error.message)}};
  }catch(e){$('infoBody').innerHTML=`<span class="offline">${esc(e.message)}</span>`}
}
let veyonLoginTargets=[];
function clearVeyonLogin(){veyonLoginTargets=[];$('veyonLoginPassword').value=''}
function closeVeyonLogin(){$('loginDialog').close();clearVeyonLogin()}
function loginSelected(){
  const ids=needSel();if(!ids.length)return;
  veyonLoginTargets=[...ids];$('loginDialogTargets').textContent=`${ids.length} selected computer${ids.length===1?'':'s'}`;
  $('veyonLoginPassword').value='';$('loginDialog').showModal();$('veyonLoginUsername').focus();
}
async function submitVeyonLogin(event){
  event.preventDefault();const ids=[...veyonLoginTargets],username=$('veyonLoginUsername').value.trim(),password=$('veyonLoginPassword').value;
  if(!ids.length||!username||!password)return;
  $('veyonLoginPassword').value='';$('loginDialog').close();veyonLoginTargets=[];
  try{await feature(ids,'userLogin',true,{username,password})}finally{$('veyonLoginPassword').value=''}
}
$('loginForm').addEventListener('submit',submitVeyonLogin);
$('cancelLogin').onclick=closeVeyonLogin;
$('loginDialog').addEventListener('close',clearVeyonLogin);
async function downloadScreenshots(){
  const ids=needSel();if(!ids.length)return;
  const failed=[];
  for(const id of ids){
    const c=computers.find(x=>x.id===id);let url;
    try{
      url=await imageFrame(`/api/v1/veyon/computers/${encodeURIComponent(id)}/framebuffer?format=png&t=${Date.now()}`,new AbortController());
      const a=document.createElement('a');a.href=url;
      a.download=`${(c?.name||c?.ip||id).replace(/[^a-z0-9._-]/gi,'_')}-${new Date().toISOString().replace(/[:.]/g,'-')}.png`;
      document.body.appendChild(a);a.click();a.remove();
    }catch(error){failed.push(`${c?.name||id}: ${error.message}`)}
    finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000)}
  }
  if(failed.length)alert('Screenshots unavailable:\n'+failed.join('\n'));
}
async function pickTeacherAndBroadcast(mode){
  const students=needSel().filter(id=>computers.find(c=>c.id===id)?.role!=='teacher');
  if(!students.length)return alert('Select at least one student device.');
  const teachers=computers.filter(c=>c.role==='teacher'&&c.online);
  if(!teachers.length)return alert('No online device is marked Teacher.');
  const choices=teachers.map((c,i)=>`${i+1}. ${c.name||c.ip} (${c.ip})`).join('\n');
  const n=Number(prompt(`Teacher source:\n${choices}\n\nEnter number:`,'1')),teacher=teachers[n-1];
  if(!teacher)return;
  try{
    const x=await api('/api/v1/veyon/demo/start',{method:'POST',body:JSON.stringify({teacherId:teacher.id,studentIds:students,mode})});
    const bad=(x.results||[]).filter(r=>!r.ok);
    if(bad.length)alert(`${bad.length} demo client(s) failed:\n`+bad.map(x=>`${x.ip}: ${x.error}`).join('\n'));
  }catch(e){alert(e.message)}
}
async function stopBroadcast(){
  const students=computers.filter(c=>c.role!=='teacher'&&c.online).map(c=>c.id);
  const teachers=computers.filter(c=>c.role==='teacher'&&c.online);
  const failed=[];
  for(const teacher of teachers){
    try{const x=await api('/api/v1/veyon/demo/stop',{method:'POST',body:JSON.stringify({teacherId:teacher.id,studentIds:students})});for(const r of x.results||[])if(!r.ok)failed.push(`${r.name||r.ip}: ${r.error||'Stop failed'}`)}catch(error){failed.push(`${teacher.name||teacher.ip}: ${error.message}`)}
  }
  if(failed.length)alert('Broadcast stop errors:\n'+failed.join('\n'));
}
async function renameComputer(id){
  const c=computers.find(x=>x.id===id);const name=prompt('Display name:',c?.name||'');if(!name)return;
  try{await api('/api/v1/veyon/computers/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({name})});await load()}catch(e){alert(e.message)}
}

function thumbnailUrl(id){return `/api/v1/veyon/computers/${encodeURIComponent(id)}/framebuffer?format=jpeg&width=480&quality=55&t=${Date.now()}`}
function setThumbStatus(id,text){
  const state=thumbState.get(id);if(state)state.message=text;
  const retry=document.querySelector(`[data-retry="${CSS.escape(id)}"]`);if(retry)retry.hidden=!state?.failures;
  const el=document.querySelector(`[data-thumb-status="${CSS.escape(id)}"]`);if(el)el.textContent=text;
}
// Decode before swapping images: a JSON error or corrupt payload must never replace a valid frame.
async function imageFrame(url,controller){
  let objectUrl;
  const timeout=setTimeout(()=>controller.abort(),30000);
  try{
    const response=await fetch(url,{cache:'no-store',signal:controller.signal});
    if(!response.ok){let body;try{body=await response.json()}catch{}throw new Error(body?.error?.message||body?.error||`HTTP ${response.status}`)}
    const blob=await response.blob();
    if(!blob.size||!/^image\/(jpeg|png|webp|bmp)$/i.test(blob.type))throw new Error('No valid screen image returned');
    objectUrl=URL.createObjectURL(blob);
    const probe=new Image();probe.src=objectUrl;
    await Promise.race([probe.decode(),new Promise((_,reject)=>{
      if(controller.signal.aborted)return reject(new Error('Screen request timed out'));
      controller.signal.addEventListener('abort',()=>reject(new Error('Screen request timed out')),{once:true});
    })]);
    return objectUrl;
  }catch(error){if(objectUrl)URL.revokeObjectURL(objectUrl);throw error}
  finally{clearTimeout(timeout)}
}
function previewSurfaceVisible(){
  if(document.hidden)return false;
  try{const frame=window.frameElement;if(frame&&!frame.getClientRects().length)return false}catch{}
  return true;
}
function cancelThumbnailRequests(){
  for(const state of thumbState.values()){
    state.nextTry=0;
    state.controller?.abort('preview-cancelled');
  }
}
async function fetchThumbnail(id){
  const computer=computers.find(x=>x.id===id);
  if(previewsPaused||!previewSurfaceVisible()||liveId||$('grid').dataset.layout==='list'||!computer?.online||!document.querySelector(`[data-thumb="${CSS.escape(id)}"]`))return;
  const state=thumbState.get(id)||{failures:0,nextTry:0,busy:false};
  if(state.busy||Date.now()<state.nextTry)return;
  state.busy=true;const controller=new AbortController();state.controller=controller;thumbState.set(id,state);
  try{
    const url=await imageFrame(thumbnailUrl(id),controller),oldUrl=state.url;
    if(thumbState.get(id)!==state){URL.revokeObjectURL(url);return}
    state.url=url;state.failures=0;state.nextTry=Date.now()+THUMB_REFRESH_MS;
    const img=document.querySelector(`[data-thumb="${CSS.escape(id)}"]`);
    if(img){img.src=url;img.hidden=false;img.classList.remove('stale')}
    if(oldUrl)URL.revokeObjectURL(oldUrl);
    setThumbStatus(id,`Updated ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`);
  }catch(error){
    if(controller.signal.reason==='preview-cancelled'){state.nextTry=0;return}
    state.failures++;const delay=Math.min(120000,THUMB_REFRESH_MS*2**Math.min(4,state.failures-1));state.nextTry=Date.now()+delay;
    document.querySelector(`[data-thumb="${CSS.escape(id)}"]`)?.classList.add('stale');
    setThumbStatus(id,`${state.url?'Last frame · ':''}${error.message}. Retry in ${Math.round(delay/1000)}s`);
  }finally{state.busy=false;state.controller=null;if(controller.signal.reason==='preview-cancelled')setTimeout(queueVisibleThumbnails,0)}
}
async function mapThumbLimit(ids,limit,worker){
  const queue=[...ids];await Promise.all(Array.from({length:Math.min(limit,queue.length)},async()=>{while(queue.length)await worker(queue.shift())}));
}
function visibleAuthenticatedThumbnailIds(){
  return [...document.querySelectorAll('[data-thumb]')].filter(el=>{
    const rect=el.closest('.card').getBoundingClientRect();return rect.bottom>=0&&rect.top<=innerHeight+240;
  }).map(el=>el.dataset.thumb);
}
async function queueVisibleThumbnails(){
  if(thumbnailQueueBusy||previewsPaused||!previewSurfaceVisible()||liveId||$('grid').dataset.layout==='list')return;
  thumbnailQueueBusy=true;
  try{await mapThumbLimit(visibleAuthenticatedThumbnailIds(),THUMB_CONCURRENCY,fetchThumbnail)}finally{thumbnailQueueBusy=false}
}
function startThumbnailTimer(){clearInterval(thumbTimer);thumbTimer=setInterval(queueVisibleThumbnails,2000)}
function liveInterval(){return Math.max(250,Number($('liveRefreshMs').value||1000))}
function startLiveTimer(){clearTimeout(liveTimer);if(liveId)liveTimer=setTimeout(refreshLive,liveFailures?Math.min(30000,2000*2**Math.min(4,liveFailures-1)):liveInterval())}
function openLive(id){
  closeLive();liveFailures=0;const c=computers.find(x=>x.id===id);liveId=id;
  cancelThumbnailRequests();
  $('liveTitle').textContent=`Live View — ${c?.name||c?.ip||id}`;
  $('liveStatus').textContent='Connecting…';$('modal').classList.add('open');fitLive();refreshLive();
}
async function refreshLive(){
  if(!liveId||liveController)return;
  if(!previewSurfaceVisible()){startLiveTimer();return}
  const generation=liveGeneration,controller=new AbortController();liveController=controller;
  try{
    const width=Math.max(640,Math.min(2560,Math.round(($('liveStage').clientWidth||1280)*devicePixelRatio)));
    const url=await imageFrame(`/api/v1/veyon/computers/${encodeURIComponent(liveId)}/framebuffer?format=jpeg&width=${width}&quality=78&t=${Date.now()}`,controller);
    if(generation!==liveGeneration){URL.revokeObjectURL(url);return}
    const old=liveObjectUrl;liveObjectUrl=url;$('liveImg').src=url;if(old)URL.revokeObjectURL(old);
    liveFailures=0;$('liveStatus').textContent=`Live · updated ${new Date().toLocaleTimeString()}`;
  }catch(error){if(generation===liveGeneration){liveFailures++;$('liveStatus').textContent=`${liveObjectUrl?'Last frame · ':''}${error.message}. Retrying…`}}
  finally{if(generation===liveGeneration){liveController=null;startLiveTimer()}}
}
function closeLive(){
  liveGeneration++;liveId=null;clearTimeout(liveTimer);liveController?.abort();liveController=null;
  $('modal').classList.remove('open','fullscreen');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  $('liveImg').removeAttribute('src');if(liveObjectUrl)URL.revokeObjectURL(liveObjectUrl);liveObjectUrl=null;
}
function fitLive(){
  const img=$('liveImg');
  $('liveStage').classList.remove('actual-size');img.style.width='100%';img.style.height='100%';img.style.objectFit='contain';
}
function actualLive(){
  const img=$('liveImg');
  $('liveStage').classList.add('actual-size');img.style.width='auto';img.style.height='auto';img.style.objectFit='none';
  img.style.maxWidth='none';img.style.maxHeight='none';
}
function resetLiveSize(){
  const box=$('liveModalBox');
  box.style.width='min(1600px,97vw)';
  box.style.height='min(900px,94vh)';
  fitLive();
}
async function toggleLiveFullscreen(){
  const modal=$('modal');
  if(!document.fullscreenElement){
    modal.classList.add('fullscreen');
    try{await modal.requestFullscreen()}catch{}
  }else{
    try{await document.exitFullscreen()}catch{}
    modal.classList.remove('fullscreen');
  }
  setTimeout(refreshLive,150);
}
$('closeLive').onclick=closeLive;
$('modal').onclick=e=>{if(e.target===$('modal'))closeLive()};
$('liveRefreshMs').onchange=()=>{if(liveId)startLiveTimer()};
$('liveFit').onclick=fitLive;
$('liveActual').onclick=actualLive;
$('liveResetSize').onclick=resetLiveSize;
$('liveFullscreen').onclick=toggleLiveFullscreen;
document.addEventListener('fullscreenchange',()=>{
  if(!document.fullscreenElement)$('modal').classList.remove('fullscreen');
  if(liveId)setTimeout(refreshLive,100);
});
$('showStudents').onclick=()=>setRoleFilter('student');
$('showTeachers').onclick=()=>setRoleFilter('teacher');
$('showAll').onclick=()=>setRoleFilter('all');
$('markStudent').onclick=()=>setRole(needSel(),'student');
$('markTeacher').onclick=()=>setRole(needSel(),'teacher');
$('discover').onclick=discover;$('refresh').onclick=load;
$('selectAll').onclick=()=>{visibleComputers().filter(x=>x.online).forEach(x=>selected.add(x.id));render()};
$('clearSel').onclick=()=>{selected.clear();render()};
$('message').onclick=()=>messageTargets(needSel());
$('lock').onclick=()=>feature(needSel(),'screenLock',true);
$('unlock').onclick=()=>feature(needSel(),'screenLock',false);
$('inputLock').onclick=()=>feature(needSel(),'inputLock',true);
$('inputUnlock').onclick=()=>feature(needSel(),'inputLock',false);
$('login').onclick=loginSelected;
$('screenshot').onclick=downloadScreenshots;
$('broadcastFull').onclick=()=>pickTeacherAndBroadcast('fullscreen');
$('broadcastWindow').onclick=()=>pickTeacherAndBroadcast('window');
$('stopBroadcast').onclick=stopBroadcast;
$('features').onclick=showFeatures;
$('pool').onclick=showPool;
$('openSite').onclick=()=>{const ids=needSel();if(!ids.length)return;const u=prompt('Website URL:','https://');if(u)feature(ids,'openWebsite',true,{websiteUrls:[u]})};
$('startApp').onclick=()=>{const ids=needSel();if(!ids.length)return;const a=prompt('Application path / command:','notepad.exe');if(a)feature(ids,'startApp',true,{applications:[a]})};
$('logoff').onclick=()=>{const ids=needSel();if(ids.length&&confirm(`Log off ${ids.length} computer(s)?`))feature(ids,'userLogoff',true)};
$('reboot').onclick=()=>{const ids=needSel();if(ids.length&&confirm(`Reboot ${ids.length} computer(s)?`))feature(ids,'reboot',true)};
$('shutdown').onclick=()=>{const ids=needSel();if(ids.length&&confirm(`POWER DOWN ${ids.length} computer(s)?`))feature(ids,'powerDown',true)};
if(matchMedia('(max-width:680px)').matches)$('selectionCommands').open=false;
$('liveRetry').onclick=()=>{clearTimeout(liveTimer);refreshLive()};
$('deviceSearch').oninput=render;$('connectionFilter').onchange=render;
$('deviceLayout').onchange=()=>{$('grid').dataset.layout=$('deviceLayout').value;if($('deviceLayout').value==='list')cancelThumbnailRequests();queueVisibleThumbnails()};
$('pausePreviews').onclick=()=>{previewsPaused=!previewsPaused;if(previewsPaused)cancelThumbnailRequests();$('pausePreviews').textContent=previewsPaused?'Resume previews':'Pause previews';$('pausePreviews').setAttribute('aria-pressed',String(previewsPaused));if(!previewsPaused)queueVisibleThumbnails()};
document.addEventListener('visibilitychange',()=>{if(!document.hidden){queueVisibleThumbnails();if(liveId)refreshLive()}});
window.addEventListener('pagehide',()=>{closeLive();for(const state of thumbState.values()){state.controller?.abort();if(state.url)URL.revokeObjectURL(state.url)}thumbState.clear()});
load();startThumbnailTimer();setInterval(()=>{if(!document.hidden)load()},30000);
