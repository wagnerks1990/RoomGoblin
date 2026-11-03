"use strict";
(()=>{
  const endpoint="/api/v1/admin/music-maintenance",views=[];
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node};
  const admin=()=>userCan("admin")&&userCan("*");
  let state=null,busy=false,loading=false,revision=0,auth=0,message="",messageError=false,pollError="",checking=false;
  function action(parent,label,fn){const button=el("button",label);button.type="button";button.addEventListener("click",fn);parent.append(button);return button}
  function checkbox(parent,label){const wrap=el("label"),input=el("input");input.type="checkbox";wrap.append(input,document.createTextNode(" "+label));parent.append(wrap);return input}
  for(const id of ["music","esphome"]){
    const page=document.getElementById(id);if(!page)continue;
    const panel=el("details"),summary=el("summary","Updates & recovery"),content=el("div"),status=el("p"),info=el("p"),devices=el("div"),toolbar=el("div"),host=el("p");
    panel.className="panel";panel.hidden=true;toolbar.className="toolbar";status.setAttribute("role","status");status.setAttribute("aria-live","polite");
    const ma=checkbox(content,"Automatically update Music Assistant to stable releases"),recover=checkbox(content,"Recover an unresponsive Music Assistant service automatically");
    for(const input of [ma,recover])input.parentElement.style.display="block";
    const view={page,panel,status,info,devices,ma,recover,host,rows:new Map(),dirty:false};
    content.addEventListener("change",()=>{view.dirty=true});
    action(toolbar,"Save maintenance policy",()=>mutate(endpoint,{musicAssistant:ma.checked,recoverMusicAssistant:recover.checked,apollo:[...view.rows].filter(([,row])=>row.auto.checked).map(([id])=>id),playbackOutputs:Object.fromEntries([...view.rows].map(([id,row])=>[id,row.output.value]))},"PUT",()=>{view.dirty=false},"Maintenance policy saved."));
    action(toolbar,"Check stable updates",()=>mutate(endpoint+"/check",{},"POST",()=>{checking=true},"Stable release check requested."));
    view.install=action(toolbar,"Update Music Assistant now",()=>install("musicAssistant",null,state?.catalog?.musicAssistant?.latestVersion));
    content.append(info,host,devices,toolbar,status);panel.append(summary,content);
    (id==="music"?page.querySelectorAll(".musicPane")[4]:page)?.append(panel);views.push(view);
    panel.addEventListener("toggle",()=>{if(panel.open)refresh()});
  }
  function visible(){return admin()&&!document.hidden&&views.some(v=>v.page.classList.contains("active")&&v.panel.open)}
  function render(){
    for(const v of views){
      v.panel.hidden=!admin();
      if(!state||!admin()){for(const input of v.panel.querySelectorAll("input,button"))input.disabled=true;continue}
      if(!v.dirty){v.ma.checked=state.policy.musicAssistant;v.recover.checked=state.policy.recoverMusicAssistant}
      v.info.textContent=`Automatic updates wait for idle playback during ${state.window.start}–${state.window.end} in the appliance time zone. Recovery is limited to three service restarts per day. Link each Apollo to its music output for physical playback checks. Apollo reconnects automatically; firmware delivery is never blindly repeated.`;
      const ma=state.catalog?.musicAssistant,job=state.hostJob;
      v.host.textContent=[ma?.currentVersion?`Music Assistant ${ma.currentVersion}; latest stable ${ma.latestVersion}.`:"Check stable updates to load Music Assistant versions.",ma?.checking?"Checking…":"",ma?.error||"",job?`Last service operation: ${job.stage}${job.version?" · "+job.version:""}. ${job.error||""}`:""].filter(Boolean).join(" ");
      const ids=new Set();
      for(const device of state.devices){
        ids.add(device.id);let row=v.rows.get(device.id);
        if(!row){
          const root=el("div"),auto=checkbox(root,`Automatically update ${device.name}`),detail=el("p"),button=action(root,"Update firmware now",()=>install("apollo",device.id,state?.catalog?.apollo?.version));
          const label=el("label",`Playback health output for ${device.name} `),output=el("select");label.append(output);root.append(detail,label);v.devices.append(root);row={root,auto,detail,button,output};v.rows.set(device.id,row);
        }
        if(!v.dirty)row.auto.checked=state.policy.apollo.includes(device.id);
        const selected=v.dirty?row.output.value:state.policy.outputBindings?.[device.id]?.playerId||"",outputs=[{id:"",name:"Not linked"},...(state.outputs||[])];
        if(selected&&!outputs.some(p=>p.id===selected))outputs.push({id:selected,name:`Saved output (${selected})`});
        const optionsKey=JSON.stringify(outputs);if(row.optionsKey!==optionsKey){row.output.replaceChildren(...outputs.map(p=>{const option=el("option",p.name);option.value=p.id;return option}));row.optionsKey=optionsKey}row.output.value=selected;
        row.detail.textContent=`${device.name}: ${device.online?"connected":"offline"}, firmware ${device.version||"unknown"}. ${device.candidate?"Stable update: "+device.candidate.latestVersion+".":"Stable update information is unavailable."} ${device.job?"Last update: "+device.job.stage+".":""}`;
        row.button.disabled=busy||state.busy||!device.candidate?.available||device.candidate.latestVersion!==state.catalog?.apollo?.version||["issued","unconfirmed"].includes(device.job?.stage);
      }
      for(const [id,row]of v.rows)if(!ids.has(id)){row.root.remove();v.rows.delete(id)}
      v.status.textContent=(messageError?message:pollError||message)||state.error||"";
      for(const button of v.panel.querySelectorAll(".toolbar button"))button.disabled=busy;
      v.install.disabled=busy||state.busy||!ma?.available||ma.checking;
      for(const input of v.panel.querySelectorAll("input,select"))input.disabled=busy;
    }
  }
  async function mutate(url,body,method,done=()=>{},success=""){
    if(busy||!admin())return;busy=true;const owner=auth;revision++;render();
    try{const result=await api(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(owner!==auth||!admin())return;if(result.policy)state=result;done();message=success;messageError=false;pollError=""}
    catch(error){if(owner===auth&&admin()){message=error.message;messageError=true}}
    finally{busy=false;render();refresh()}
  }
  function install(kind,deviceId,version){
    if(!version||!confirm(`Install stable ${version}? Playback must be idle. Music Assistant keeps a cold rollback snapshot; Apollo will restart and must reconnect before success is reported.`))return;
    mutate(endpoint+"/install",{kind,deviceId,version},"POST",()=>{},"Update requested. Keep this status open to verify completion.");
  }
  async function refresh(){
    render();if(!visible()||busy||loading)return;loading=true;const owner=auth,readRevision=revision;
    try{
      const result=await api(checking?endpoint+"/check":endpoint,checking?{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}:undefined);
      if(owner!==auth||readRevision!==revision||!admin())return;
      state=result;pollError="";checking=!!result.catalog?.musicAssistant?.checking;
    }catch(error){if(owner===auth&&readRevision===revision&&admin())pollError=`Connection check failed: ${error.message}. Retrying…`}finally{loading=false;render()}
  }
  window.addEventListener("roomgoblin:authchange",()=>{auth++;revision++;state=null;message="";messageError=false;pollError="";checking=false;for(const v of views){v.dirty=false;v.devices.replaceChildren();v.rows.clear();v.host.textContent="";v.status.textContent=""}render();refresh()});
  new MutationObserver(()=>{render();refresh()}).observe(document.querySelector("main")||document.body,{attributes:true,attributeFilter:["class"],subtree:true});
  setInterval(refresh,10000);render();
})();
