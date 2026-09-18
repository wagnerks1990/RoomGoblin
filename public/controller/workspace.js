/* Navigation presentation only; authorization and page activation stay in app.js. */
(()=>{
  'use strict';
  const sidebar=document.getElementById('workspaceSidebar');
  const menu=document.getElementById('workspaceMenu');
  const search=document.getElementById('workspaceSearch');
  const backdrop=document.getElementById('workspaceBackdrop');
  const focusButton=document.getElementById('workspaceFocus');
  const main=document.getElementById('workspaceMain');
  const groups=[...sidebar.querySelectorAll('.rg-nav-group')];
  const closeButton=document.createElement('button');closeButton.type='button';closeButton.id='workspaceClose';closeButton.className='rg-menu-close';closeButton.textContent='Close navigation';sidebar.prepend(closeButton);closeButton.addEventListener('click',()=>closeMenu(true));
  const mobile=matchMedia('(max-width:1000px)');
  function closeMenu(restore=false){document.body.classList.remove('rg-menu-open');menu.setAttribute('aria-expanded','false');backdrop.hidden=true;if(main)main.inert=false;if(restore)menu.focus()}
  menu.addEventListener('click',()=>{const open=!document.body.classList.contains('rg-menu-open');if(!open){closeMenu(true);return}document.body.classList.add('rg-menu-open');menu.setAttribute('aria-expanded','true');backdrop.hidden=false;if(main)main.inert=true;search.focus()});
  backdrop.addEventListener('click',()=>closeMenu(true));
  // Focus mode changes only shell geometry; embedded sessions stay mounted.
  focusButton?.addEventListener('click',()=>{
    const focused=document.body.classList.toggle('rg-focus');
    focusButton.setAttribute('aria-pressed',String(focused));
    focusButton.textContent=focused?'Show navigation':'Focus workspace';
    focusButton.title=focused?'Restore workspace navigation':'Hide navigation to give this workspace more room';
  });
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('rg-menu-open'))return;
    if(event.key==='Escape'){closeMenu(true);return}
    if(event.key==='Tab'){
      const items=[...sidebar.querySelectorAll('button,input,a,summary')].filter(x=>!x.hidden&&x.getClientRects().length&&!x.disabled);
      if(!items.length)return;const first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
  });
  mobile.addEventListener('change',()=>closeMenu());
  function sync(){
    const active=document.querySelector('.page.active');
    sidebar.querySelectorAll('[data-page]').forEach(button=>{if(button.dataset.page===active?.id){button.setAttribute('aria-current','page');const group=button.closest('details');if(group)group.open=true;document.getElementById('workspaceLocation').textContent=button.textContent}else button.removeAttribute('aria-current')});
    const context=document.getElementById('workspaceContext');
    if(context&&active)context.textContent=active.querySelector('h1')?.textContent||'Workspace';
  }
  sidebar.addEventListener('click',event=>{if(event.target.closest('[data-page]')){sync();if(mobile.matches){closeMenu();document.getElementById('workspaceMain').focus()}}});
  const observer=new MutationObserver(sync);document.querySelectorAll('.page').forEach(page=>observer.observe(page,{attributes:true,attributeFilter:['class']}));
  let previousOpen=null;
  function filterNavigation(){
    const query=search.value.trim().toLowerCase();
    if(query&&previousOpen===null)previousOpen=groups.map(group=>group.open);
    let matches=0;
    sidebar.querySelectorAll('nav [data-page],nav a').forEach(item=>{const match=item.textContent.toLowerCase().includes(query);item.style.display=match?'':'none';if(match&&!item.hidden)matches++});
    groups.forEach((group,index)=>{const any=[...group.querySelectorAll('[data-page],a')].some(item=>!item.hidden&&item.style.display!=='none');group.hidden=!any;if(query)group.open=any;else if(previousOpen)group.open=previousOpen[index]});
    document.getElementById('workspaceSearchEmpty').hidden=matches>0;
    if(!query){previousOpen=null;sync()}
  }
  search.addEventListener('input',filterNavigation);
  function syncAuthorization(){
    sidebar.querySelectorAll('[data-managed-displays-link]').forEach(link=>{link.hidden=typeof userCan==='function'?!userCan('admin'):true});
    document.querySelectorAll('[data-workspace-link]').forEach(link=>{
      const page=document.getElementById(link.dataset.workspaceLink);
      link.hidden=!page||page.dataset.authorized!=='true';
    });
    filterNavigation();
  }
  window.addEventListener('roomgoblin:authchange',syncAuthorization);
  document.querySelectorAll('[data-workspace-link]').forEach(link=>link.addEventListener('click',()=>{
    const page=document.getElementById(link.dataset.workspaceLink);
    if(page?.dataset.authorized==='true'&&typeof showPage==='function'){showPage(page.id);main?.focus()}
  }));
  const labLink=document.getElementById('workspaceLabLink');
  const windowsFrame=document.getElementById('labWindowsFrame');
  if(labLink&&windowsFrame){
    const updateLabLink=()=>{labLink.href=windowsFrame.hidden?'/controller/veyon.html':'/controller/lab.html'};
    new MutationObserver(updateLabLink).observe(windowsFrame,{attributes:true,attributeFilter:['hidden']});
    updateLabLink();
  }

  // Present the existing release updater with the same deployment-first hierarchy used by LabGoblin.
  // This is presentation-only: existing IDs, handlers, semantic-release checks, backup/health gates,
  // maintenance windows and rollback behavior remain owned by app.js and the updater service.
  function enhanceUpdateWorkspace(){
    const repository=document.getElementById('appUpdateRepository');
    const output=document.getElementById('updateOutput');
    const history=document.getElementById('appUpdateHistory');
    if(!repository||!output||!history)return;
    const disclosure=repository.closest('.workspaceDisclosure');
    const body=disclosure?.querySelector('.disclosureBody');
    if(!disclosure||!body||disclosure.dataset.rgUpdateEnhanced==='true')return;
    disclosure.dataset.rgUpdateEnhanced='true';
    disclosure.classList.add('rg-system-updates');
    disclosure.open=true;
    disclosure.querySelector('summary')?.setAttribute('hidden','');

    const intro=body.querySelector(':scope > .muted');
    const settingsGrid=body.querySelector(':scope > .grid2');
    const automatic=[...body.querySelectorAll(':scope > label')].find(label=>label.querySelector('#appUpdateAutomatic'));
    const toolbar=body.querySelector(':scope > .toolbar');
    if(!settingsGrid||!automatic||!toolbar)return;

    const buttonByText=text=>[...toolbar.querySelectorAll('button')].find(button=>button.textContent.trim()===text);
    const saveButton=buttonByText('Save Settings');
    const clearTokenButton=buttonByText('Clear Stored Token');
    const checkButton=buttonByText('Check GitHub');
    const installButton=document.getElementById('installAppUpdateBtn');
    const revertButton=document.getElementById('revertAppUpdateBtn');

    const header=document.createElement('header');
    header.className='rg-update-page-header';
    header.innerHTML='<div><p class="rg-update-eyebrow">Administration</p><h2>System updates</h2><p class="rg-update-description">Health-gated GitHub releases with a database-safe backup and automatic rollback point.</p></div>';

    const deployment=document.createElement('section');
    deployment.className='rg-update-card';
    deployment.setAttribute('aria-labelledby','rg-update-deployment-title');
    deployment.innerHTML='<div class="rg-update-card-header"><div><h3 id="rg-update-deployment-title">Deployment</h3><p>Review the exact release state before starting a host operation.</p></div><span id="rgUpdateOperationBadge" class="rg-update-status rg-update-status--idle">idle</span></div><dl class="rg-update-detail-list"><div><dt>Repository</dt><dd id="rgUpdateRepositoryValue"></dd></div><div><dt>Current version</dt><dd id="rgUpdateCurrentVersion">Checking…</dd></div><div><dt>Available release</dt><dd id="rgUpdateAvailableVersion">Checking…</dd></div><div><dt>Rollback point</dt><dd id="rgUpdateRollbackState">Checking…</dd></div></dl><div class="rg-update-actions"></div><details class="rg-update-status-detail"><summary><strong>Update status</strong></summary></details>';
    deployment.querySelector('#rgUpdateRepositoryValue').textContent=repository.value;
    const actions=deployment.querySelector('.rg-update-actions');
    [checkButton,installButton,revertButton].filter(Boolean).forEach(button=>actions.append(button));
    deployment.querySelector('.rg-update-status-detail').append(output);

    const settings=document.createElement('details');
    settings.className='rg-update-card rg-update-settings';
    settings.open=true;
    settings.innerHTML='<summary><strong>Automatic update settings</strong></summary><div class="rg-update-settings-body"></div>';
    const settingsBody=settings.querySelector('.rg-update-settings-body');
    settingsBody.append(automatic,settingsGrid);
    const settingsActions=document.createElement('div');settingsActions.className='rg-update-actions rg-update-settings-actions';
    [saveButton,clearTokenButton].filter(Boolean).forEach(button=>settingsActions.append(button));
    settingsBody.append(settingsActions);

    const operations=document.createElement('details');
    operations.className='rg-update-card rg-update-operations';
    operations.innerHTML='<summary><strong>Latest operation & history</strong></summary><div class="rg-update-operations-body"></div>';
    operations.querySelector('.rg-update-operations-body').append(history);

    body.replaceChildren(header,deployment,settings,operations);

    function refreshUpdateSummary(){
      const text=output.textContent||'';
      const valueFor=(...labels)=>{
        for(const label of labels){const match=text.match(new RegExp(`^${label}\\s*:\\s*(.+)$`,'mi'));if(match)return match[1].trim()}
        return '';
      };
      const current=valueFor('Current','Installed version','Current version');
      const available=valueFor('Available','Latest channel release','Latest approved release','Latest release');
      document.getElementById('rgUpdateCurrentVersion').textContent=current||'See update status';
      document.getElementById('rgUpdateAvailableVersion').textContent=available||(/no newer/i.test(text)?'Up to date':'See update status');
      document.getElementById('rgUpdateRollbackState').textContent=revertButton?.disabled?'No revert point available':'Previous upgrade available';
      const badge=document.getElementById('rgUpdateOperationBadge');
      const failed=/\b(fail|error|rollback failed|unhealthy)\b/i.test(text);
      const running=/\b(installing|updating|checking|running|queued|deploying)\b/i.test(text);
      const ready=!installButton?.disabled;
      badge.className=`rg-update-status ${failed?'rg-update-status--danger':running?'rg-update-status--warning':'rg-update-status--success'}`;
      badge.textContent=failed?'attention':running?'running':ready?'update available':'ready';
    }
    new MutationObserver(refreshUpdateSummary).observe(output,{childList:true,subtree:true,characterData:true});
    new MutationObserver(refreshUpdateSummary).observe(toolbar,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
    [installButton,revertButton].filter(Boolean).forEach(button=>new MutationObserver(refreshUpdateSummary).observe(button,{attributes:true,attributeFilter:['disabled']}));
    refreshUpdateSummary();
    if(intro)intro.remove();
  }

  // The admin enrollment API must keep returning the legacy PowerShell command for
  // compatibility, but the controller presents the native service path first. The
  // generated command downloads only the four manifest-listed binaries from the
  // same Hub origin and verifies every SHA-256 before invoking the bootstrap.
  function powerShellLiteral(value){return `'${String(value).replaceAll("'","''")}'`}
  function nativeEnrollmentCommand(enrollment){
    const origin=enrollment.preferredOrigin||new URL(enrollment.installerUrl,location.href).origin;
    const allowHttp=new URL(origin).protocol==='http:'?' --allow-http':'';
    const fallbackOrigin=enrollment.requestOrigin&&enrollment.requestOrigin!==origin?new URL(enrollment.requestOrigin,location.href).origin:'';
    const fallbackArgs=fallbackOrigin?` --fallback-hub-url ${powerShellLiteral(fallbackOrigin)}${new URL(fallbackOrigin).protocol==='http:'?' --allow-http-fallback':''}`:'';
    const files=['RoomGoblinAgent.exe','RoomGoblinSessionAgent.exe','RoomGoblinAgentUpdater.exe','RoomGoblinAgentBootstrap.exe'];
    const expected=files.map(powerShellLiteral).join(',');
    return [
      `$Hub=${powerShellLiteral(origin)}`,
      `$Dir=Join-Path $env:TEMP ('RoomGoblin-Native-'+[guid]::NewGuid().ToString('N'))`,
      `New-Item -ItemType Directory -Path $Dir -Force | Out-Null`,
      `$Manifest=Invoke-RestMethod -Uri ($Hub+'/lab-agent/native/manifest.json')`,
      `$Expected=@(${expected})`,
      `if(-not $Manifest.ok -or @($Manifest.files).Count -ne $Expected.Count){throw 'Invalid RoomGoblin native manifest.'}`,
      `foreach($Name in $Expected){$Entry=@($Manifest.files|Where-Object {$_.name -eq $Name});if($Entry.Count -ne 1){throw ('Missing or duplicate manifest entry: '+$Name)};$Path=Join-Path $Dir $Name;Invoke-WebRequest -Uri ($Hub+'/lab-agent/native/'+$Name) -OutFile $Path -UseBasicParsing;$Actual=(Get-FileHash -Path $Path -Algorithm SHA256).Hash.ToLowerInvariant();if($Actual -ne ([string]$Entry[0].sha256).ToLowerInvariant()){throw ('SHA-256 verification failed: '+$Name)}}`,
      `& (Join-Path $Dir 'RoomGoblinAgentBootstrap.exe') install --hub-url ${powerShellLiteral(origin)}${fallbackArgs} --agent-id ${powerShellLiteral(enrollment.agentId)} --enrollment-token ${powerShellLiteral(enrollment.token)}${allowHttp}`,
      `if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}`,
      `Remove-Item $Dir -Recurse -Force -ErrorAction SilentlyContinue`
    ].join('; ');
  }
  function nativeEnrollmentFile(enrollment){
    const origin=enrollment.preferredOrigin||new URL(enrollment.installerUrl,location.href).origin;
    const fallbackHubUrl=enrollment.requestOrigin&&enrollment.requestOrigin!==origin?new URL(enrollment.requestOrigin,location.href).origin:'';
    return {
      schema:'roomgoblin-native-enrollment-v1',
      hubUrl:origin,
      fallbackHubUrl,
      allowHttpFallback:!!fallbackHubUrl&&new URL(fallbackHubUrl).protocol==='http:',
      agentId:String(enrollment.agentId||''),
      enrollmentToken:String(enrollment.token||''),
      allowHttp:new URL(origin).protocol==='http:',
      trustedPublisherThumbprint:''
    };
  }
  function downloadNativeEnrollmentFile(enrollment){
    const payload=JSON.stringify(nativeEnrollmentFile(enrollment),null,2)+'\n';
    const blob=new Blob([payload],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const safe=String(enrollment.agentId||'computer').replace(/[^A-Za-z0-9._-]/g,'-');
    const a=document.createElement('a');
    a.href=url;a.download=`roomgoblin-enrollment-${safe}.json`;
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function enhanceNativeEnrollment(){
    if(typeof window.createLabAgentEnrollment!=='function'||typeof window.api!=='function')return;
    window.createLabAgentEnrollment=async function(){
      try{
        const id=document.getElementById('labEnrollmentId')?.value.trim();
        if(!id)throw Error('Enter a stable computer ID.');
        const ttl=Number(document.getElementById('labEnrollmentTtl')?.value||15);
        const j=await api(`/api/v1/admin/lab-agents/${encodeURIComponent(id)}/enrollment`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ttlMinutes:ttl})});
        const enrollment=j.enrollment,result=document.getElementById('labEnrollmentResult');
        if(!enrollment?.token||!enrollment?.installerUrl||!result)throw Error('RoomGoblin returned an incomplete enrollment package.');
        const nativeCommand=nativeEnrollmentCommand(enrollment);
        const safe=String(enrollment.agentId||'computer').replace(/[^A-Za-z0-9._-]/g,'-');
        result.style.display='block';
        const preferredOrigin=enrollment.preferredOrigin||new URL(enrollment.installerUrl,location.href).origin;
        const transportNote=new URL(preferredOrigin).protocol==='https:'?`<span class="pill ok">HTTPS / WSS preferred</span>`:`<span class="pill">LAN HTTP fallback</span>`;
        const fallback=enrollment.fallbackInstallCommand?`<details style="margin-top:10px"><summary>Current-browser/LAN-origin fallback</summary><textarea class="raw" readonly style="width:100%;min-height:120px;margin-top:8px">${esc(enrollment.fallbackInstallCommand)}</textarea><div class="muted">Use only if the preferred HTTPS origin is unavailable from this computer. HTTP fallback requires the agent's explicit insecure-LAN acknowledgement.</div></details>`:'';
        result.innerHTML=`<b>Recommended: browser package + native bootstrap for ${esc(enrollment.agentId)}</b> ${transportNote}<div class="muted" style="margin-top:6px">Preferred Hub origin: <code>${esc(preferredOrigin)}</code>. HTTPS agents automatically use <code>wss://</code> for the long-lived RoomGoblin control channel.</div><div class="toolbar" style="margin-top:8px"><a class="buttonLink" href="/lab-agent/native/RoomGoblinNativeAgent.zip" download>1. Download native package</a><button type="button" data-native-enrollment-file>2. Download one-time enrollment file</button></div><div class="muted" style="margin-top:8px">On the Windows computer, extract the ZIP, place the downloaded enrollment JSON in the extracted folder, open an elevated Command Prompt or PowerShell there, and run <code>RoomGoblinAgentBootstrap.exe install --enrollment-file roomgoblin-enrollment-${esc(safe)}.json</code>. The bootstrap deletes the plaintext enrollment file immediately after reading it and verifies manifest.json plus all four native executable hashes before installation. Expires ${esc(new Date(enrollment.expiresAt).toLocaleString())}.</div><details style="margin-top:10px"><summary>Automated PowerShell native installer fallback</summary><textarea class="raw" readonly style="width:100%;min-height:190px;margin-top:8px">${esc(nativeCommand)}</textarea><div class="muted">Use only where endpoint-protection policy permits the PowerShell download-and-execute chain. The browser package workflow above is preferred.</div></details>${fallback}<details style="margin-top:10px"><summary>Legacy PowerShell scheduled-task installer</summary><textarea class="raw" readonly style="width:100%;min-height:110px;margin-top:8px">${esc(enrollment.installCommand||'')}</textarea><div class="muted">Compatibility fallback only.</div></details>`;
        result.querySelector('[data-native-enrollment-file]')?.addEventListener('click',()=>downloadNativeEnrollmentFile(enrollment),{once:true});
        await loadLabAgentCredentials();
      }catch(error){notify(error.message,'error')}
    };
  }

  enhanceNativeEnrollment();
  enhanceUpdateWorkspace();
  syncAuthorization();
  sync();
})();
