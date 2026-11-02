/* System Updates presentation; app.js owns requests and the native runner owns deployment. */
(()=>{
  'use strict';
  // Present the main-branch updater with the same deployment-first hierarchy used by LabGoblin.
  // Existing IDs and handlers remain owned by app.js; the backend resolves only trusted merged main
  // commits and the native updater still owns exact-image verification, backup, health and rollback.
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
    header.innerHTML='<div><p class="rg-update-eyebrow">Administration</p><h2>System updates</h2><p class="rg-update-description">Merged <code>main</code> commits, exact CI-built images, database-safe backup, and automatic rollback.</p></div>';

    const deployment=document.createElement('section');
    deployment.className='rg-update-card';
    deployment.setAttribute('aria-labelledby','rg-update-deployment-title');
    deployment.innerHTML='<div class="rg-update-card-header"><div><h3 id="rg-update-deployment-title">Deployment</h3><p>Review the installed commit and latest merged <code>main</code> commit before updating.</p></div><span id="rgUpdateOperationBadge" class="rg-update-status rg-update-status--idle">idle</span></div><dl class="rg-update-detail-list"><div><dt>Repository</dt><dd id="rgUpdateRepositoryValue"></dd></div><div><dt>Installed</dt><dd id="rgUpdateCurrentVersion">Checking…</dd></div><div><dt>Main update</dt><dd id="rgUpdateAvailableVersion">Checking…</dd></div><div><dt>Rollback point</dt><dd id="rgUpdateRollbackState">Checking…</dd></div></dl><div class="rg-update-actions"></div><details class="rg-update-status-detail"><summary><strong>Update status</strong></summary></details>';
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
      const currentVersion=valueFor('Current version','Current');
      const currentCommit=valueFor('Current commit','Active commit');
      const available=valueFor('Available','Main commit','Target commit');
      document.getElementById('rgUpdateCurrentVersion').textContent=[currentVersion,currentCommit].filter(Boolean).join(' @ ')||'See update status';
      document.getElementById('rgUpdateAvailableVersion').textContent=available||(/up to date/i.test(text)?'Up to date':'See update status');
      document.getElementById('rgUpdateRollbackState').textContent=revertButton?.disabled?'No revert point available':'Previous upgrade available';
      const badge=document.getElementById('rgUpdateOperationBadge');
      const failed=/\b(fail|error|rollback failed|unhealthy|blocked)\b/i.test(text);
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

  enhanceUpdateWorkspace();
})();
