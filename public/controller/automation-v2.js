"use strict";

(function installAutomationV2(){
  const SCHEMA_VERSION=3;
  const TAIL_SUFFIX=".__primary-repeat-tail";
  let installed=false;

  function waitForController(){
    if(installed)return;
    if(typeof window.editAutomation!=="function"||typeof window.newAutomation!=="function"||typeof window.editorEvent!=="function"||!document.getElementById("autoActionSteps")){
      setTimeout(waitForController,50);return;
    }
    installed=true;install();
  }
  const clone=value=>JSON.parse(JSON.stringify(value??null));
  const number=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};
  const ids=value=>[...new Set((Array.isArray(value)?value:[]).map(x=>String(x||"").trim()).filter(Boolean))];
  const uid=()=>`action-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  function modeFor(action,value,payload={}){
    const allowed=new Set(["once","repeat","loop"]);let mode=String(value||"").toLowerCase();
    if(!mode&&action==="display.media"&&payload.loop===true)mode="loop";
    if(!allowed.has(mode))mode="once";
    return mode;
  }
  function normalizeAction(input={},index=0){
    const action=String(input.action||"display.clear"),payload=clone(input.payload||{})||{};
    const executionMode=modeFor(action,input.executionMode,payload);
    if(action==="display.media")payload.loop=executionMode==="loop";
    return {
      id:String(input.id||`action-${index+1}`),action,targets:ids(input.targets),useEventTargets:index>0&&input.useEventTargets!==false,
      payload,delaySeconds:number(input.delaySeconds,0,0,3600),executionMode,
      repeatCount:Math.round(number(input.repeatCount,executionMode==="repeat"?2:1,1,100)),
      repeatDelaySeconds:number(input.repeatDelaySeconds,0,0,3600),continueOnError:input.continueOnError!==false
    };
  }
  function sequenceFromEvent(event={}){
    if(Array.isArray(event.actionSequence)&&event.actionSequence.length)return event.actionSequence.map(normalizeAction);
    const extras=(Array.isArray(event.actions)?event.actions:[]).filter(x=>!String(x?.id||"").endsWith(TAIL_SUFFIX));
    const primary=normalizeAction({
      id:event.primaryActionId||"action-1",action:event.action,targets:event.targets,payload:event.payload,
      executionMode:event.primaryExecutionMode||(event.action==="display.media"&&event.payload?.loop?"loop":"once"),
      repeatCount:event.primaryRepeatCount||1,repeatDelaySeconds:event.primaryRepeatDelaySeconds||0,
      delaySeconds:event.primaryDelaySeconds||0,continueOnError:event.continueOnError!==false,useEventTargets:false
    },0);
    return [primary,...extras.map((x,i)=>normalizeAction(x,i+1))];
  }
  function compileLegacy(sequence){
    const first=normalizeAction(sequence[0]||{},0),payload={...(first.payload||{})};
    if(first.action==="display.media")payload.loop=first.executionMode==="loop";
    return {
      action:first.action,targets:ids(first.targets),payload,
      actions:sequence.slice(1).map((x,i)=>normalizeAction(x,i+1)),
      primaryActionId:first.id,primaryDelaySeconds:first.delaySeconds,
      primaryExecutionMode:first.executionMode,primaryRepeatCount:first.repeatCount,
      primaryRepeatDelaySeconds:first.repeatDelaySeconds,continueOnError:first.continueOnError
    };
  }
  function allActionOptions(selected){return automationActionOptions(selected)}
  function actionDomain(action){return automationActionDomain(action)}
  function targetRows(step){
    const domain=actionDomain(step.action);
    if(domain==="lighting"){
      const groups=Object.keys(S.govee?.groups||{}).map(id=>[id,`${id.toUpperCase()} group`]);
      const devices=Object.entries(S.govee?.devices||{}).map(([id,d])=>[id,d.name||id]);return [...groups,...devices];
    }
    if(domain==="tv")return [["all","All TVs"],["hdmi-all","All HDMI TVs"],["hdbt-all","All HDBT TVs"],...configuredDisplayTargets(false)];
    return configuredDisplayTargets(true);
  }
  function mediaOptions(selected=""){
    const allowed=(S.mediaFiles||[]).filter(f=>["image","video","pdf","presentation","document"].includes(f.type));
    const saved=selected&&!allowed.some(f=>f.storedName===selected)?`<option value="${esc(selected)}" selected>${esc(selected)} (saved item)</option>`:"";
    return `${saved}<option value="">— Select uploaded media —</option>${allowed.map(f=>`<option value="${esc(f.storedName)}" ${selected===f.storedName?'selected':''}>${esc(f.originalName||f.storedName)} • ${esc(f.type)}</option>`).join("")}`;
  }
  function setPayload(i,key,value){autoSteps[i].payload=autoSteps[i].payload||{};autoSteps[i].payload[key]=value}
  function mediaPayload(step,i){
    const p=step.payload||{};
    return `<label>Uploaded Media<select onchange="RoomGoblinAutomationV2.payload(${i},'storedName',this.value)">${mediaOptions(p.storedName||"")}</select></label>
      <div class="grid2" style="margin-top:8px">
       <label>Fit<select onchange="RoomGoblinAutomationV2.payload(${i},'fit',this.value)"><option value="contain" ${p.fit!=="cover"?'selected':''}>Contain</option><option value="cover" ${p.fit==="cover"?'selected':''}>Cover</option></select></label>
       <label>Slide / Page Seconds<input type="number" min="0" max="300" value="${Math.round(Number(p.autoAdvanceMs||10000)/1000)}" onchange="RoomGoblinAutomationV2.payload(${i},'autoAdvanceMs',Number(this.value)*1000)"></label>
       <label>Start at (seconds)<input type="number" min="0" step="0.1" value="${Number(p.startAtSeconds||0)}" onchange="RoomGoblinAutomationV2.payload(${i},'startAtSeconds',Number(this.value||0))"></label>
       <label>End at (seconds, 0 = file end)<input type="number" min="0" step="0.1" value="${Number(p.endAtSeconds||0)}" onchange="RoomGoblinAutomationV2.payload(${i},'endAtSeconds',Number(this.value||0))"></label>
       <label>Volume %<input type="number" min="0" max="100" value="${Math.round(Number(p.volume??1)*100)}" onchange="RoomGoblinAutomationV2.payload(${i},'volume',Math.max(0,Math.min(1,Number(this.value||0)/100)))"></label>
       <label>Playback Rate<input type="number" min="0.25" max="4" step="0.25" value="${Number(p.playbackRate||1)}" onchange="RoomGoblinAutomationV2.payload(${i},'playbackRate',Number(this.value||1))"></label>
      </div>
      <div class="toolbar"><label><input type="checkbox" ${p.muted?'checked':''} onchange="RoomGoblinAutomationV2.payload(${i},'muted',this.checked)"> Mute video</label><button type="button" onclick="RoomGoblinAutomationV2.previewMedia(${i})">Preview Selected Media</button></div>
      <div class="muted">Media playback settings apply each time this action participates in a sequence pass. "Loop continually" keeps this action eligible when the sequence returns to it.</div>`;
  }
  function payloadHtml(step,i){
    const p=step.payload||{},a=step.action;
    if(a==="display.media")return mediaPayload(step,i);
    if(a==="tv.power"||a==="govee.power")return `<label>State<select onchange="RoomGoblinAutomationV2.payload(${i},'state',this.value)"><option value="on" ${p.state!=="off"?'selected':''}>On</option><option value="off" ${p.state==="off"?'selected':''}>Off</option></select></label>`;
    if(a==="display.text")return `<label>Title<input id="v2Title${i}" value="${esc(p.title||"")}" onchange="RoomGoblinAutomationV2.payload(${i},'title',this.value)"></label>${variableButtons(`v2Title${i}`)}<label>Main Text<textarea id="v2Text${i}" rows="6" onchange="RoomGoblinAutomationV2.payload(${i},'text',this.value)">${esc(p.text||"")}</textarea></label>${variableButtons(`v2Text${i}`)}<label>Subtitle<input id="v2Subtitle${i}" value="${esc(p.subtitle||"")}" onchange="RoomGoblinAutomationV2.payload(${i},'subtitle',this.value)"></label>${variableButtons(`v2Subtitle${i}`)}<div class="grid2"><label>Text Color<input type="color" value="${esc(p.color||'#ffffff')}" onchange="RoomGoblinAutomationV2.payload(${i},'color',this.value)"></label><label>Background<input type="color" value="${esc(p.background||'#000000')}" onchange="RoomGoblinAutomationV2.payload(${i},'background',this.value)"></label><label>Text Size<input type="number" min="12" max="200" value="${Number(p.size||54)}" onchange="RoomGoblinAutomationV2.payload(${i},'size',Number(this.value))"></label><label>Position<select onchange="RoomGoblinAutomationV2.payload(${i},'position',this.value)"><option value="center" ${!['top','bottom'].includes(p.position)?'selected':''}>Center</option><option value="top" ${p.position==='top'?'selected':''}>Top</option><option value="bottom" ${p.position==='bottom'?'selected':''}>Bottom</option></select></label></div>`;
    if(a==="display.url")return `<label>Website / URL<input type="url" value="${esc(p.url||location.origin+'/')}" onchange="RoomGoblinAutomationV2.payload(${i},'url',this.value.trim())"></label><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${p.localDirect!==false?'checked':''} onchange="RoomGoblinAutomationV2.payload(${i},'localDirect',this.checked)"> Load directly from the TV browser</label>`;
    if(a==="display.timer.class-end")return `<label>Timer Label<input id="v2TimerLabel${i}" value="${esc(p.label||'%class_short% • Class Ends In')}" onchange="RoomGoblinAutomationV2.payload(${i},'label',this.value)"></label>${variableButtons(`v2TimerLabel${i}`)}<div class="grid2"><label>Position<select onchange="RoomGoblinAutomationV2.payload(${i},'position',this.value)"><option value="top" ${p.position==='top'?'selected':''}>Top</option><option value="center" ${p.position==='center'?'selected':''}>Center</option><option value="bottom" ${!['top','center'].includes(p.position)?'selected':''}>Bottom</option></select></label><label>Font Size<input type="number" min="20" max="220" value="${Number(p.fontSize||64)}" onchange="RoomGoblinAutomationV2.payload(${i},'fontSize',Number(this.value))"></label><label>Text Color<input type="color" value="${esc(p.textColor||'#ffffff')}" onchange="RoomGoblinAutomationV2.payload(${i},'textColor',this.value)"></label><label>Border Color<input type="color" value="${esc(p.borderColor||'#ffffff')}" onchange="RoomGoblinAutomationV2.payload(${i},'borderColor',this.value)"></label><label>Border Width<input type="number" min="0" max="20" value="${Number(p.borderWidth??4)}" onchange="RoomGoblinAutomationV2.payload(${i},'borderWidth',Number(this.value))"></label><label>Border Radius<input type="number" min="0" max="80" value="${Number(p.borderRadius??18)}" onchange="RoomGoblinAutomationV2.payload(${i},'borderRadius',Number(this.value))"></label></div><label>Background CSS<input value="${esc(p.background||'rgba(0,0,0,.35)')}" onchange="RoomGoblinAutomationV2.payload(${i},'background',this.value)"></label>`;
    if(a==="display.clear")return `<div class="muted">Clears current content from the selected display targets.</div>`;
    if(a==="govee.color")return `<label>Color<input type="color" value="${esc(p.color||'#0066ff')}" onchange="RoomGoblinAutomationV2.payload(${i},'color',this.value)"></label>`;
    if(a==="govee.brightness")return `<label>Brightness<input type="number" min="1" max="100" value="${Number(p.level??50)}" onchange="RoomGoblinAutomationV2.payload(${i},'level',Number(this.value))"></label>`;
    if(a==="govee.temp")return `<label>Color Temperature (K)<input type="number" min="2000" max="9000" step="100" value="${Number(p.kelvin??6500)}" onchange="RoomGoblinAutomationV2.payload(${i},'kelvin',Number(this.value))"></label>`;
    if(a==="govee.scene")return `<label>Scene<input value="${esc(p.scene||"")}" onchange="RoomGoblinAutomationV2.payload(${i},'scene',this.value)"></label>`;
    return `<div class="muted">No additional settings are required.</div>`;
  }
  function targetsHtml(step,i){
    const rows=targetRows(step),selected=step.targets?.length?step.targets:[rows[0]?.[0]].filter(Boolean);
    const canShare=i>0&&actionDomain(step.action)===actionDomain(autoSteps[0]?.action);
    return `${canShare?`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" ${step.useEventTargets!==false?'checked':''} onchange="RoomGoblinAutomationV2.shareTargets(${i},this.checked)"> Use the same targets as Action 1</label>`:''}
      ${!canShare||step.useEventTargets===false?`<div class="toolbar" style="margin-top:7px">${rows.map(([id,label])=>`<label><input type="checkbox" ${selected.includes(id)?'checked':''} onchange="RoomGoblinAutomationV2.target(${i},${inlineJsArg(String(id))},this.checked)"> ${esc(label)}</label>`).join("")}</div>`:`<div class="muted">Targets follow Action 1, including linked-class default display targets.</div>`}`;
  }
  function render(){
    const host=document.getElementById("autoActionSteps");if(!host)return;
    host.innerHTML=autoSteps.map((raw,i)=>{const step=normalizeAction(raw,i);autoSteps[i]=step;const label=automationActionLabel(step.action);return `<div class="card" style="margin-top:12px;border-width:2px" data-automation-v2-action="${i}">
      <div class="top"><div><b>ACTION ${i+1} — ${esc(label)}</b><div class="muted">Every action independently decides whether it runs on each pass through the sequence.</div></div><div class="toolbar"><button type="button" onclick="RoomGoblinAutomationV2.move(${i},-1)" ${i===0?'disabled':''}>↑</button><button type="button" onclick="RoomGoblinAutomationV2.move(${i},1)" ${i===autoSteps.length-1?'disabled':''}>↓</button><button type="button" class="danger" onclick="RoomGoblinAutomationV2.remove(${i})" ${autoSteps.length===1?'disabled':''}>Remove</button></div></div>
      <div class="grid2"><label>Action<select onchange="RoomGoblinAutomationV2.changeAction(${i},this.value)">${allActionOptions(step.action)}</select></label><label>Wait before running<input type="number" min="0" max="3600" step="0.1" value="${step.delaySeconds}" onchange="RoomGoblinAutomationV2.set(${i},'delaySeconds',Number(this.value||0))"></label></div>
      <div class="panel" style="box-shadow:none;margin-top:10px"><b>Targets</b>${targetsHtml(step,i)}</div>
      <div class="panel" style="box-shadow:none;margin-top:10px"><b>Action Settings</b><div style="margin-top:8px">${payloadHtml(step,i)}</div></div>
      <div class="grid2" style="margin-top:10px"><label>Execution<select onchange="RoomGoblinAutomationV2.execution(${i},this.value)"><option value="once" ${step.executionMode==='once'?'selected':''}>Run once</option><option value="repeat" ${step.executionMode==='repeat'?'selected':''}>Loop X times</option><option value="loop" ${step.executionMode==='loop'?'selected':''}>Loop continually</option></select></label>${step.executionMode==='repeat'?`<label>Total Passes<input type="number" min="1" max="100" value="${step.repeatCount}" onchange="RoomGoblinAutomationV2.set(${i},'repeatCount',Math.max(1,Math.min(100,Number(this.value||1))))"></label>`:''}${step.executionMode!=='once'?`<label>Wait Before Next Loop<input type="number" min="0" max="3600" step="0.1" value="${step.repeatDelaySeconds}" onchange="RoomGoblinAutomationV2.set(${i},'repeatDelaySeconds',Math.max(0,Number(this.value||0)))"></label>`:''}</div>
      ${step.executionMode==='loop'?`<div class="muted">Runs every time the sequence returns to this action. The sequence continues until cancelled, changed, disabled, or superseded.</div>`:step.executionMode==='repeat'?`<div class="muted">Runs on the first ${step.repeatCount} pass(es), then is skipped on later passes.</div>`:`<div class="muted">Runs on the first pass only, then is skipped if other actions keep the sequence looping.</div>`}
      <label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" ${step.continueOnError?'checked':''} onchange="RoomGoblinAutomationV2.set(${i},'continueOnError',this.checked)"> Continue to the next action if this action fails</label>
    </div>`}).join("");
    enforceCapabilityControls?.(host);
  }
  function hideLegacy(){
    const actionLabel=document.getElementById("autoAction")?.closest("label");if(actionLabel)actionLabel.style.display="none";
    const targets=document.getElementById("autoTargets")?.parentElement;if(targets)targets.style.display="none";
    const payload=document.getElementById("autoPayload");if(payload)payload.style.display="none";
    const steps=document.getElementById("autoActionSteps"),panel=steps?.closest(".panel");
    if(panel){const top=panel.querySelector(":scope > .top");if(top){const title=top.querySelector("b");if(title)title.textContent="Actions";const help=top.querySelector(".muted");if(help)help.textContent="Build one ordered action sequence. After the last action, RoomGoblin returns to Action 1 while any action is still eligible to run."}}
  }
  function syncHiddenFirst(){
    const first=normalizeAction(autoSteps[0]||{},0);autoAction.value=first.action;currentEditTargets=[...first.targets];currentAutomationPayload=clone(first.payload||{});renderAutomationFields(first.payload||{});
  }
  function v2Event(){
    syncHiddenFirst();const base=original.editorEvent();const canonical=autoSteps.map(normalizeAction);const legacy=compileLegacy(canonical);
    return {...base,...legacy,automationSchemaVersion:SCHEMA_VERSION,actionSequence:canonical};
  }
  async function save(){
    try{const body=v2Event();if(!body.actionSequence.length)throw Error("Add at least one action");if(!body.targets.length&&!((body.classIds||[]).length&&body.useClassTargets))throw Error("Action 1 needs a target or linked-class default targets");const id=autoId.value;const j=id?await api('/api/v1/automations/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}):await jpost('/api/v1/automations',body);autoEditorMsg.textContent=`Saved • ${body.actionSequence.length} action(s) • schema v3`;await loadSchedules();window.editAutomation(j.event.id);return j}catch(e){autoEditorMsg.textContent=e.message;throw e}
  }
  async function simulate(){try{const body=v2Event(),j=await api('/api/v1/automations/draft/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,id:autoId.value||undefined})});autoEditorMsg.textContent=j.ok?`Simulation OK • ${body.actionSequence.length} action(s) • pass-based execution`:(j.error||`Simulation found ${(j.conflicts||[]).length} conflict(s)`);return j}catch(e){autoEditorMsg.textContent=e.message;throw e}}
  async function runDraft(){if(!confirm('Run the current unsaved action sequence on real classroom devices? This does not save or enable the event.'))return;try{const body=v2Event(),j=await api('/api/v1/automations/draft/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,id:autoId.value||undefined})});const failures=automationRunFailureSummary(j);autoEditorMsg.textContent=failures.length?`Live draft completed with errors: ${failures.join(' • ')}`:'Live draft completed.';return j}catch(e){autoEditorMsg.textContent=e.message;throw e}}
  const original={editAutomation:window.editAutomation,newAutomation:window.newAutomation,editorEvent:window.editorEvent,renderAutomationSteps:window.renderAutomationSteps};
  function install(){
    hideLegacy();
    window.renderAutomationSteps=render;
    window.addAutomationStep=()=>{autoSteps.push(normalizeAction({id:uid(),action:"display.clear",targets:[],useEventTargets:autoSteps.length>0,payload:{}},autoSteps.length));render()};
    window.removeAutomationStep=i=>{if(autoSteps.length<=1)return;autoSteps.splice(i,1);autoSteps.forEach((x,n)=>x.useEventTargets=n>0&&x.useEventTargets!==false);render()};
    window.moveAutomationStep=(i,d)=>{const j=i+d;if(j<0||j>=autoSteps.length)return;[autoSteps[i],autoSteps[j]]=[autoSteps[j],autoSteps[i]];autoSteps[0].useEventTargets=false;render()};
    window.newAutomation=function(){original.newAutomation();autoSteps=[normalizeAction({id:uid(),action:"tv.power",targets:[configuredDisplayTargets(false)[0]?.[0]||"all"],useEventTargets:false,payload:{state:"on"}},0)];hideLegacy();render()};
    window.editAutomation=function(id){original.editAutomation(id);const event=S.automations.find(x=>x.id===id);if(event)autoSteps=sequenceFromEvent(event);if(!autoSteps.length)autoSteps=[normalizeAction({},0)];autoSteps[0].useEventTargets=false;hideLegacy();render();automationEditorTitle.textContent=`Edit Scheduled Event • schema v${event?.automationSchemaVersion||1}${event?.automationSchemaVersion===2?'':' → will migrate on save'}`};
    window.editorEvent=v2Event;window.saveAutomation=save;window.simulateAutomationEditor=simulate;window.testAutomationEditor=simulate;window.runAutomationDraft=runDraft;
    window.validateEnableAutomation=async()=>{autoEnabled.value="1";const result=await simulate();if(result?.ok===false)throw Error("Resolve simulation conflicts before enabling.");return save()};
    window.RoomGoblinAutomationV2={
      render,payload:setPayload,set:(i,k,v)=>{autoSteps[i][k]=v},execution:(i,v)=>{autoSteps[i].executionMode=modeFor(autoSteps[i].action,v,autoSteps[i].payload);autoSteps[i].payload.loop=autoSteps[i].action==='display.media'&&autoSteps[i].executionMode==='loop';render()},
      changeAction:(i,value)=>{const old=actionDomain(autoSteps[i].action);autoSteps[i].action=value;autoSteps[i].payload={};if(i>0&&old!==actionDomain(value)){autoSteps[i].useEventTargets=false;autoSteps[i].targets=[]}autoSteps[i]=normalizeAction(autoSteps[i],i);render()},
      shareTargets:(i,value)=>{autoSteps[i].useEventTargets=!!value;render()},
      target:(i,id,checked)=>{let t=ids(autoSteps[i].targets);if(id==='all'&&checked)t=['all'];else{t=t.filter(x=>x!=='all'&&x!==id);if(checked)t.push(id)}autoSteps[i].targets=t;render()},
      move:(i,d)=>window.moveAutomationStep(i,d),remove:i=>window.removeAutomationStep(i),
      previewMedia:i=>{const stored=autoSteps[i]?.payload?.storedName,f=(S.mediaFiles||[]).find(x=>x.storedName===stored);if(!f?.url)return alert('Select uploaded media first.');window.open(f.url,'_blank','noopener')},
      sequence:()=>clone(autoSteps),event:v2Event
    };
    if(autoId.value){const event=S.automations.find(x=>x.id===autoId.value);autoSteps=event?sequenceFromEvent(event):autoSteps}else if(!autoSteps.length)autoSteps=[normalizeAction({id:uid(),action:'tv.power',targets:['all'],payload:{state:'on'}},0)];
    hideLegacy();render();
  }
  waitForController();
})();
