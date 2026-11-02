/* Windows enrollment UI, loaded after the controller API helpers. */
(()=>{
  'use strict';
  let enrollmentPending=null,enrollmentGeneration=0;
  const enrollmentAllowed=()=>typeof userCan==='function'&&userCan('admin');
  function clearEnrollmentResult(){
    const result=document.getElementById('labEnrollmentResult');
    if(result){result.innerHTML='';result.style.display='none'}
  }
  window.addEventListener('roomgoblin:authchange',()=>{enrollmentGeneration++;clearEnrollmentResult()});
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
    window.createLabAgentEnrollment=async function(){
      if(!enrollmentAllowed()){clearEnrollmentResult();notify('Administrator access is required for enrollment.','error');return}
      if(enrollmentPending){notify('An enrollment request is still pending. Wait for it to finish.','warn');return}
      const request={},generation=++enrollmentGeneration;
      enrollmentPending=request;clearEnrollmentResult();
      try{
        const id=document.getElementById('labEnrollmentId')?.value.trim();
        if(!id)throw Error('Enter a stable computer ID.');
        const ttl=Number(document.getElementById('labEnrollmentTtl')?.value||15);
        if(!document.getElementById('labEnrollmentResult'))throw Error('The enrollment result view is unavailable.');
        const j=await api(`/api/v1/admin/lab-agents/${encodeURIComponent(id)}/enrollment`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ttlMinutes:ttl})});
        if(generation!==enrollmentGeneration||!enrollmentAllowed())return;
        const enrollment=j.enrollment,result=document.getElementById('labEnrollmentResult');
        if(!enrollment?.token||!enrollment?.installerUrl||!result)throw Error('RoomGoblin returned an incomplete enrollment package.');
        const nativeCommand=nativeEnrollmentCommand(enrollment);
        const safe=String(enrollment.agentId||'computer').replace(/[^A-Za-z0-9._-]/g,'-');
        result.style.display='block';
        const preferredOrigin=enrollment.preferredOrigin||new URL(enrollment.installerUrl,location.href).origin;
        const transportNote=new URL(preferredOrigin).protocol==='https:'?`<span class="pill ok">HTTPS / WSS preferred</span>`:`<span class="pill">LAN HTTP fallback</span>`;
        const fallback=enrollment.fallbackInstallCommand?`<details style="margin-top:10px"><summary>Current-browser/LAN-origin fallback</summary><textarea class="raw" readonly style="width:100%;min-height:120px;margin-top:8px">${esc(enrollment.fallbackInstallCommand)}</textarea><div class="muted">Use only if the preferred HTTPS origin is unavailable from this computer. HTTP fallback requires the agent's explicit insecure-LAN acknowledgement.</div></details>`:'';
        result.innerHTML=`<b>Recommended: browser package + native bootstrap for ${esc(enrollment.agentId)}</b> ${transportNote}<div class="muted" style="margin-top:6px">Preferred Hub origin: <code>${esc(preferredOrigin)}</code>. HTTPS agents automatically use <code>wss://</code> for the long-lived RoomGoblin control channel.</div><div class="toolbar" style="margin-top:8px"><a class="buttonLink" href="/lab-agent/native/RoomGoblinNativeAgent.zip" download>1. Download native package</a><button type="button" data-native-enrollment-file>2. Download one-time enrollment file</button></div><div class="muted" style="margin-top:8px">On the Windows computer, extract the ZIP, place the downloaded enrollment JSON in the extracted folder, open an elevated Command Prompt or PowerShell there, and run <code>RoomGoblinAgentBootstrap.exe install --enrollment-file roomgoblin-enrollment-${esc(safe)}.json</code>. The bootstrap deletes the plaintext enrollment file immediately after reading it and verifies manifest.json plus all four native executable hashes before installation. Expires ${esc(new Date(enrollment.expiresAt).toLocaleString())}.</div><details style="margin-top:10px"><summary>Automated PowerShell native installer fallback</summary><textarea class="raw" readonly style="width:100%;min-height:190px;margin-top:8px">${esc(nativeCommand)}</textarea><div class="muted">Use only where endpoint-protection policy permits the PowerShell download-and-execute chain. The browser package workflow above is preferred.</div></details>${fallback}<details style="margin-top:10px"><summary>Legacy PowerShell scheduled-task installer</summary><textarea class="raw" readonly style="width:100%;min-height:110px;margin-top:8px">${esc(enrollment.installCommand||'')}</textarea><div class="muted">Compatibility fallback only.</div></details>`;
        result.querySelector('[data-native-enrollment-file]')?.addEventListener('click',()=>{
          if(generation===enrollmentGeneration&&enrollmentAllowed())downloadNativeEnrollmentFile(enrollment);
        },{once:true});
        await loadLabAgentCredentials();
      }catch(error){if(generation===enrollmentGeneration&&enrollmentAllowed())notify(error.message,'error')}
      finally{if(enrollmentPending===request)enrollmentPending=null}
    };
  }

  enhanceNativeEnrollment();
})();
