
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
          ?`<img data-thumb="${esc(c.id)}" alt="Screen preview for ${esc(c.name||c.ip)}" ${thumbState.get(c.id)?.url?`src="${thumbState.get(c.id).url}"`: 'hidden'}>`
          :`<span class="muted">${c.online?'Veyon not authenticated':'No Veyon connection'}</span>`}
      </div>
      ${c.online?`<div class="previewFeedback"><span class="muted thumbStatus" data-thumb-status="${esc(c.id)}">${esc(thumbState.get(c.id)?.message||'Waiting for preview…')}</span><button class="thumbRetry" ${thumbState.get(c.id)?.failures?'':'hidden'} data-retry="${esc(c.id)}" aria-label="Retry screen for ${esc(c.name||c.ip)}">Retry</button></div>`:''}
      <div class="body">
        <div class="name">${esc(c.name||c.hostname||c.ip)} <span class="list-status ${c.online?'online':'offline'}">${c.online?'Online':'Offline'}</span></div>
        <div class="meta"><span class="${c.role==='teacher'?'roleTeacher':'roleStudent'}">${c.role==='teacher'?'TEACHER':'STUDENT'}</span> • ${esc(c.hostname||'')} ${c.hostname?'• ':''}${esc(c.ip)}</div>
        <div class="meta">User: ${esc(c.user?.fullName||c.user?.login||'No user logged in')}</div>
        <div class="meta">Screen lock: <span class="${c.featureState?.screenLock?'featureOn':'featureOff'}">${c.featureState?.screenLock===true?'ACTIVE':c.featureState?.screenLock===false?'off':'unknown'}</span> • Input lock: <span class="${c.featureState?.inputLock?'featureOn':'featureOff'}">${c.featureState?.inputLock===true?'ACTIVE':c.featureState?.inputLock===false?'off':'unknown'}</span></div>
        ${c.featureState?.screenLock&&!c.user?.login?`<div class="notice">Lock is active. No lock graphic can be shown until a user is logged in; input remains locked.</div>`:''}
        ${c.error?`<div class="meta offline">${esc(c.error)}</div>`:''}
        <div class="computerCommand" data-command-computer="${esc(c.id)}" hidden></div>
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
  updateSelectionCount();renderCommandJobs();
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
  try{const x=await api('/api/v1/veyon/status');$('apiStatus').innerHTML=`Veyon service: <span class="online">REACHABLE</span> • Screens verified per computer`;$('apiStatus').title=`Service HTTP ${x.httpStatus??'unknown'}; ${Number(x.authenticatedConnections??x.pool?.size??0)} cached authenticated connections. Service reachability alone does not verify a screen preview.`}
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
const commandJobs=new Map(),commandSubmissions=new Set(),uncertainLockRequests=new Map(),commandIntents=new Map();
let commandOwnedLocks=[],commandSubmissionEpoch=0,commandPollTimer=null,commandPollController=null,commandPollFailures=0;
const COMMAND_PENDING=new Set(['queued','running','retrying']);
function commandTitle(job){
 const names={clipboardWrite:'Send clipboard text',screenLock:job.active?'Lock screens':'Unlock screens',inputLock:job.active?'Lock input':'Unlock input',textMessage:'Send message',userLogin:'Log in user',userLogoff:'Log off',reboot:'Reboot',powerDown:'Shut down',powerDownNow:'Immediate shutdown',powerDownConfirmed:'Ask student to shut down',powerDownDelayed:'Delayed shutdown',installUpdatesAndPowerDown:'Updates then shutdown',openWebsite:'Open website',startApp:'Start app',demoServer:job.active?'Start teacher broadcast':'Stop teacher broadcast',fullScreenDemoClient:job.active?'Join full-screen broadcast':'Stop full-screen broadcast',windowDemoClient:job.active?'Join window broadcast':'Stop window broadcast'};
 return names[job.feature]||job.feature||'Computer command';
}
function commandResultLabel(result){return result.state==='succeeded'?(result.verified?'Confirmed':'Accepted'):({queued:'Queued',running:'Running',retrying:'Retrying',failed:'Failed',unknown:'Outcome unknown',skipped:'Skipped',cancelled:result.reason==='superseded'?'Superseded':'Cancelled'}[result.state]||'Unknown')}
function orderedCommandJobs(){return [...commandJobs.values()].reverse().sort((a,b)=>Number(b.sequence||0)-Number(a.sequence||0)||String(b.createdAt).localeCompare(String(a.createdAt)))}
function commandRetryTargets(job){
 if(!['screenLock','inputLock'].includes(job.feature))return [];
 const ordered=orderedCommandJobs(),index=ordered.findIndex(other=>other.id===job.id);
 const newer=ordered.slice(0,index).filter(other=>other.feature===job.feature);
 return (job.results||[]).filter(result=>['failed','unknown'].includes(result.state)&&!newer.some(other=>(other.results||[]).some(row=>row.id===result.id))).map(result=>result.id);
}
function renderCommandJobs(){
 const jobs=orderedCommandJobs(),host=$('commandJobs'),expanded=new Set([...host.querySelectorAll('details[open]')].map(el=>el.dataset.job));
 const focused=document.activeElement?.closest('#commandJobs')?{job:document.activeElement.dataset.jobId,action:document.activeElement.dataset.jobAction}:null;
 let waiting=0,issues=0;
 for(const job of jobs)for(const result of job.results||[]){if(COMMAND_PENDING.has(result.state))waiting++;if(['failed','unknown'].includes(result.state))issues++}
 const recovery=commandOwnedLocks.filter(lock=>lock.recoveryPending===true),recoveryIds=new Set(recovery.map(lock=>lock.id));
 $('commandSummary').textContent=(jobs.length?`${waiting} pending · ${issues} need attention · ${jobs.length} recent actions`:'No recent commands')+(recovery.length?` · ${recovery.length} control recoveries pending`:'');
 $('commandRecoveryState').textContent=recovery.length?`${recovery.length} RoomGoblin-owned controls are waiting for reconnect cleanup. Locks or broadcasts may still be active until cleanup is confirmed.`:'';
 const signature=JSON.stringify(jobs);
 if(host.dataset.signature!==signature){
  host.dataset.signature=signature;
  host.innerHTML=jobs.map(job=>{
   const rows=job.results||[],pending=rows.some(row=>COMMAND_PENDING.has(row.state)),counts={};
   for(const row of rows){const label=commandResultLabel(row);counts[label]=(counts[label]||0)+1}
   const countText=Object.entries(counts).map(([label,count])=>`${count} ${label.toLowerCase()}`).join(' · ');
   const retry=commandRetryTargets(job),cancel=rows.some(row=>['queued','retrying'].includes(row.state));
   return `<details class="commandJob" data-job="${esc(job.id)}" ${expanded.has(job.id)?'open':''}><summary><b>${esc(commandTitle(job))}</b><span>${esc(countText||job.state)}</span></summary><div class="commandJobMeta muted">${esc(new Date(job.createdAt).toLocaleString())} · ${rows.length} computers${pending?' · Continues on the server if you leave this page':''}</div><div class="commandJobActions">${cancel?`<button data-job-action="cancel" data-job-id="${esc(job.id)}">Cancel waiting targets</button>`:''}${retry.length?`<button data-job-action="retry" data-job-id="${esc(job.id)}">Retry ${retry.length} failed target${retry.length===1?'':'s'}</button>`:''}</div><div class="commandResults">${rows.map(row=>`<div class="commandResult" data-command-target="${esc(row.id)}"><span>${esc(row.name||row.id)}</span><strong data-command-phase="${esc(row.state)}">${esc(commandResultLabel(row))}</strong>${row.error||row.reason?`<small>${esc(row.error||row.reason)}</small>`:''}</div>`).join('')}</div></details>`;
  }).join('');
  host.querySelectorAll('[data-job-action]').forEach(button=>button.onclick=()=>button.dataset.jobAction==='cancel'?cancelCommandJob(button.dataset.jobId,button):retryCommandJob(button.dataset.jobId));
  if(focused?.job&&focused?.action)host.querySelector(`[data-job-id="${CSS.escape(focused.job)}"][data-job-action="${CSS.escape(focused.action)}"]`)?.focus({preventScroll:true});
 }
 const latest=new Map();for(const job of jobs)for(const result of job.results||[])if(!latest.has(result.id))latest.set(result.id,{job,result});
 document.querySelectorAll('[data-command-computer]').forEach(el=>{const entry=latest.get(el.dataset.commandComputer);el.hidden=!entry&&!recoveryIds.has(el.dataset.commandComputer);if(recoveryIds.has(el.dataset.commandComputer)){el.textContent='Control recovery · Waiting for reconnect';el.dataset.commandPhase='retrying';el.title='RoomGoblin will retry clearing its owned lock or broadcast when this computer is available.'}else if(entry){el.textContent=`${commandTitle(entry.job)} · ${commandResultLabel(entry.result)}`;el.dataset.commandPhase=entry.result.state;el.title=entry.result.error||entry.result.reason||''}});
}
function rememberCommandJob(job){if(!job?.id)return;commandJobs.set(job.id,job);if(commandJobs.size>128){const oldest=orderedCommandJobs().at(-1);commandJobs.delete(oldest.id)}renderCommandJobs()}
function scheduleCommandPoll(){
 clearTimeout(commandPollTimer);if(!previewSurfaceVisible())return;
 const pending=[...commandJobs.values()].some(job=>(job.results||[]).some(row=>COMMAND_PENDING.has(row.state)));
 const delay=commandPollFailures?Math.min(30000,2000*2**Math.min(4,commandPollFailures)):(pending?2000:10000);
 commandPollTimer=setTimeout(refreshCommandJobs,delay);
}
async function refreshCommandJobs(){
 if(commandPollController||!previewSurfaceVisible())return;
 const controller=new AbortController(),knownAtStart=new Set(commandJobs.keys());commandPollController=controller;
 const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await api('/api/v1/veyon/jobs',{signal:controller.signal});
  const jobs=Array.isArray(response.jobs)?response.jobs:[];
  commandOwnedLocks=Array.isArray(response.ownedLocks)?response.ownedLocks:[];
  let completed=false;
  for(const job of jobs){const previous=commandJobs.get(job.id);if(previous?.state!=='completed'&&job.state==='completed')completed=true;if((job.results||[]).some(row=>row.state==='succeeded'&&row.verified===true&&!(previous?.results||[]).some(old=>old.id===row.id&&old.verified===true&&old.state==='succeeded')))completed=true}
  const returned=new Set(jobs.map(job=>job.id));for(const id of knownAtStart)if(!returned.has(id))commandJobs.delete(id);
  for(const job of jobs.slice(0,128))if(job?.id)commandJobs.set(job.id,job);
  commandPollFailures=0;$('commandHistoryError').textContent='';renderCommandJobs();
  if(completed)load();
 }catch(error){if(previewSurfaceVisible()){commandPollFailures++;$('commandHistoryError').textContent=`Command history could not refresh: ${error.message}. Last shown progress may be stale.`}}
 finally{clearTimeout(timeout);commandPollController=null;scheduleCommandPoll()}
}
function syncCommandVisibility(){
 if(previewSurfaceVisible())refreshCommandJobs();
 else{clearTimeout(commandPollTimer);commandPollController?.abort()}
}
async function feature(targets,name,active=true,args={}){
 if(!targets.length)return alert('Select at least one computer.');
 const unique=[...new Set(targets)],key=JSON.stringify([name,active,[...unique].sort()]);
 if(commandSubmissions.has(key))return;
 const latest=orderedCommandJobs().find(job=>job.feature===name&&(job.results||[]).some(row=>unique.includes(row.id)));
 if(['screenLock','inputLock'].includes(name)&&latest&&latest.active===active&&(latest.results||[]).some(row=>COMMAND_PENDING.has(row.state))&&JSON.stringify((latest.results||[]).map(row=>row.id).sort())===JSON.stringify([...unique].sort())){$('commandFeedback').textContent='This command is already queued. Watch its progress below.';return latest}
 commandSubmissions.add(key);
 const safeLock=['screenLock','inputLock'].includes(name),requestId=(safeLock&&uncertainLockRequests.get(key))||Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''),label=commandTitle({feature:name,active});
 const epoch=++commandSubmissionEpoch;
 if(safeLock){for(const id of unique)commandIntents.set(`${name}:${id}`,epoch);for(const other of uncertainLockRequests.keys()){const [feature,otherActive,ids]=JSON.parse(other);if(feature===name&&otherActive!==active&&ids.some(id=>unique.includes(id)))uncertainLockRequests.delete(other)}}
 $('commandFeedback').textContent=`Submitting ${label.toLowerCase()} for ${unique.length} computers…`;
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await api('/api/v1/veyon/feature',{method:'POST',signal:controller.signal,body:JSON.stringify({targets:unique,feature:name,active,arguments:args,requestId})});
  if(!response.job?.id)throw new Error('The server did not return a tracked command');
  uncertainLockRequests.delete(key);rememberCommandJob(response.job);
  $('commandFeedback').textContent=`Queued: ${label} for ${unique.length} computers. Progress appears below.`;
  refreshCommandJobs();scheduleCommandPoll();
  return response.job;
 }catch(error){
  if(safeLock&&unique.every(id=>commandIntents.get(`${name}:${id}`)===epoch)){uncertainLockRequests.set(key,requestId);if(uncertainLockRequests.size>128)uncertainLockRequests.delete(uncertainLockRequests.keys().next().value)}
  $('commandFeedback').textContent=`${label}: ${error.message}. Submission outcome is unconfirmed; refresh command history before sending again.`;
  refreshCommandJobs();
 }finally{clearTimeout(timeout);commandSubmissions.delete(key)}
}
async function cancelCommandJob(id,button){
 if(!confirm('Cancel targets still waiting? Commands already running will finish and report their outcome.'))return;
 button.disabled=true;
 try{const response=await api(`/api/v1/veyon/jobs/${encodeURIComponent(id)}/cancel`,{method:'POST',body:'{}'});rememberCommandJob(response.job);$('commandFeedback').textContent='Waiting targets cancelled. Running commands remain tracked.';refreshCommandJobs()}
 catch(error){$('commandFeedback').textContent=`Cancellation could not be confirmed: ${error.message}. Refresh command history.`}
 finally{if(button.isConnected)button.disabled=false}
}
function retryCommandJob(id){
 const job=commandJobs.get(id);if(!job)return;const targets=commandRetryTargets(job);if(!targets.length)return;
 if(!confirm(`Retry ${commandTitle(job).toLowerCase()} for ${targets.length} failed targets? A newer command excludes its targets from this retry.`))return;
 feature(targets,job.feature,job.active);
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
    if(!response.ok){
      let body;try{body=await response.json()}catch{}
      const message=typeof body?.error?.message==='string'?body.error.message:typeof body?.error==='string'?body.error:'Screen request failed';
      const detail=[body?.stage==='authentication'?'Authentication':body?.stage==='framebuffer'?'Screen capture':'',Number.isInteger(body?.code)?`Veyon ${body.code}`:'',`HTTP ${response.status}`].filter(Boolean).join(' · ');
      throw new Error(`${message} (${detail})`);
    }
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
  if(document.hidden||window.RoomGoblinEmbeddedViewport?.visible===false)return false;
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
    const rect=el.closest('.card').getBoundingClientRect(),viewport=window.RoomGoblinEmbeddedViewport;
    return rect.bottom>=(viewport?.top??0)-120&&rect.top<=(viewport?.bottom??innerHeight)+240;
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
    const old=liveObjectUrl;liveObjectUrl=url;$('liveImg').src=url;$('liveImg').hidden=false;if(old)URL.revokeObjectURL(old);
    liveFailures=0;$('liveStatus').textContent=`Live · updated ${new Date().toLocaleTimeString()}`;
  }catch(error){if(generation===liveGeneration){liveFailures++;$('liveStatus').textContent=`${liveObjectUrl?'Last frame · ':''}${error.message}. Retrying…`}}
  finally{if(generation===liveGeneration){liveController=null;startLiveTimer()}}
}
function closeLive(){
  liveGeneration++;liveId=null;clearTimeout(liveTimer);liveController?.abort();liveController=null;
  $('modal').classList.remove('open','fullscreen');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});
  $('liveImg').hidden=true;$('liveImg').removeAttribute('src');if(liveObjectUrl)URL.revokeObjectURL(liveObjectUrl);liveObjectUrl=null;
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
window.addEventListener('roomgoblin:viewport',()=>{if(previewSurfaceVisible()){queueVisibleThumbnails();if(liveId)refreshLive()}else cancelThumbnailRequests()});
window.addEventListener('scroll',queueVisibleThumbnails,{passive:true});
window.addEventListener('resize',queueVisibleThumbnails);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){queueVisibleThumbnails();if(liveId)refreshLive()}});
window.addEventListener('pagehide',()=>{closeLive();for(const state of thumbState.values()){state.controller?.abort();if(state.url)URL.revokeObjectURL(state.url)}thumbState.clear()});
$('refreshCommandJobs').onclick=refreshCommandJobs;
window.addEventListener('roomgoblin:viewport',syncCommandVisibility);
document.addEventListener('visibilitychange',syncCommandVisibility);
window.addEventListener('pagehide',()=>{clearTimeout(commandPollTimer);commandPollController?.abort()});
refreshCommandJobs();load();startThumbnailTimer();setInterval(()=>{if(!document.hidden)load()},30000);
