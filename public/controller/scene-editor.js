"use strict";
(() => {
  const model=RoomGoblinScene,clone=x=>structuredClone(x),id=()=>`layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,11)}`;
  const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e};
  window.editPlanningScene=async(value,{transparent=false}={})=>{
    const {fitElement}=await import("/display/layout.mjs?v=dynamic-fit-20261022-1");
    const sportsBoards=await api("/api/v1/sports").then(r=>r.config?.boards||[]).catch(()=>[]);
    return new Promise(resolve=>{
    let scene=model.normalize(value||{transparent,background:"#101d2c",layers:[]}),selected=scene.layers[0]?.id||"",playing=false,viewRatio=16/9,history=[],future=[],closed=false;
    scene.transparent=transparent;
    const dialog=node("dialog",undefined,"sceneEditor"),header=node("header"),heading=node("div"),title=node("h2","Scene studio"),hint=node("p","Drag layers on the canvas. Arrow keys nudge; Shift moves 10 pixels. Preview motion before saving.");
    heading.append(title,hint);const cancel=node("button","Cancel"),save=node("button","Use scene","primary");cancel.type=save.type="button";header.append(heading,cancel,save);
    const toolbar=node("div",undefined,"sceneTools"),left=node("aside",undefined,"sceneLayers"),workspace=node("div",undefined,"sceneWorkspace"),inspector=node("aside",undefined,"sceneInspector"),frame=node("div",undefined,"sceneFrame"),canvas=node("div",undefined,"sceneCanvas"),status=node("div",undefined,"studioStatus");
    title.id=`scene-title-${id()}`;dialog.setAttribute("aria-labelledby",title.id);status.setAttribute("role","status");frame.append(canvas);workspace.append(toolbar,frame,status);
    const body=node("div",undefined,"sceneEditorBody");body.append(left,workspace,inspector);dialog.append(header,body);document.body.append(dialog);
    function remember(){history.push(clone(scene));if(history.length>50)history.shift();future=[]}
    function announce(text){status.textContent=text}
    const chosen=()=>scene.layers.find(l=>l.id===selected);
    function button(label,fn,parent=toolbar){const b=node("button",label);b.type="button";b.addEventListener("click",fn);parent.append(b);return b}
    function fit(){const width=frame.clientWidth,height=width/viewRatio,scale=Math.min(width/model.WIDTH,height/model.HEIGHT);canvas.style.transform=`scale(${scale})`;canvas.style.left=`${(width-model.WIDTH*scale)/2}px`;canvas.style.top=`${(height-model.HEIGHT*scale)/2}px`;frame.style.height=`${height}px`}
    function draw(){
      model.render(canvas,{...scene,data:{className:"Example class",cycleDay:"A",dayGroup:"Green",timezone:S.scheduler?.timezone||"",startAt:Date.now()-600000,endAt:Date.now()+1800000,weather:"Weather preview",weatherUpdatedAt:Date.now(),...scene.data}},{interactive:true,previewSports:true,reducedMotion:!playing||matchMedia("(prefers-reduced-motion: reduce)").matches,fitText:fitElement});
      for(const e of canvas.children){e.classList.toggle("sceneSelected",e.dataset.layerId===selected);e.setAttribute("aria-pressed",String(e.dataset.layerId===selected));if(e.dataset.layerId===selected&&!chosen()?.locked){const resize=node("span",undefined,"sceneResize");resize.dataset.resize="1";resize.setAttribute("aria-hidden","true");e.append(resize)}}
      fit();renderLayers();
    }
    function renderLayers(){
      left.replaceChildren(node("h3","Layers"),node("p","Top of this list is the front of the screen."));
      [...scene.layers].reverse().forEach(layer=>{const b=button(`${layer.locked?"Locked · ":""}${layer.name}`,()=>{selected=layer.id;draw();properties()},left);b.classList.toggle("selected",selected===layer.id)});
      if(!scene.layers.length)left.append(node("p","Add text, an image, or a shape to start."));
      const actions=node("div",undefined,"sceneLayerTools");left.append(actions);
      button("Duplicate",()=>{const l=chosen();if(!l)return;remember();const copy={...clone(l),id:id(),x:Math.min(99-l.w,l.x+2),y:Math.min(99-l.h,l.y+2),name:`${l.name} copy`};scene.layers.push(copy);selected=copy.id;draw();properties()},actions);
      button("Forward",()=>move(1),actions);button("Backward",()=>move(-1),actions);
      button("Delete layer",()=>{if(!chosen()||chosen().locked)return;remember();scene.layers=scene.layers.filter(l=>l.id!==selected);selected=scene.layers.at(-1)?.id||"";draw();properties()},actions);
    }
    function move(delta){const index=scene.layers.findIndex(l=>l.id===selected),to=index+delta;if(index<0||to<0||to>=scene.layers.length)return;remember();[scene.layers[index],scene.layers[to]]=[scene.layers[to],scene.layers[index]];draw()}
    function field(label,key,{type="text",options,min,max,owner=chosen()}={}){
      const wrap=node("label",label),input=node(options?"select":type==="textarea"?"textarea":"input");
      input.setAttribute("aria-label",label);
      if(options)options.forEach(([value,label])=>{const opt=node("option",label);opt.value=value;input.append(opt)});else if(type!=="textarea")input.type=type;
      if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;
      if(type==="checkbox")input.checked=!!owner[key];else input.value=owner[key]??"";
      input.addEventListener("focus",()=>{input.dataset.before=JSON.stringify(scene)});
      input.addEventListener("input",()=>{if(input.dataset.before){history.push(JSON.parse(input.dataset.before));input.dataset.before="";future=[]}owner[key]=type==="checkbox"?input.checked:type==="number"||type==="range"?Number(input.value):input.value;draw()});
      wrap.append(input);inspector.append(wrap);return input;
    }
    function properties(){
      inspector.replaceChildren(node("h3","Canvas"));field("Background","background",{type:"color",owner:scene});field("Entry transition","transition",{options:model.TRANSITIONS.map(x=>[x,x]),owner:scene});field("Transition duration (ms)","durationMs",{type:"number",min:100,max:2000,owner:scene});
      const layer=chosen();if(!layer){inspector.append(node("p","Select a layer to edit its content and appearance."));return}
      inspector.append(node("h3",layer.name));field("Layer name","name");field("Lock position","locked",{type:"checkbox"});
      if(layer.type==="text"||layer.type==="widget"){
        if(layer.type==="widget"){field("Widget","widget",{options:model.WIDGETS.map(x=>[x,x])}).addEventListener("change",properties);field("24-hour clock","clock24",{type:"checkbox"})}
        if(layer.type==="widget"&&layer.widget==="sports-board"){
          const choices=[['','Choose a saved Sports board'],...sportsBoards.map(b=>[b.id,b.name])];if(layer.sportsBoardId&&!sportsBoards.some(b=>b.id===layer.sportsBoardId))choices.push([layer.sportsBoardId,'Saved board (currently unavailable)']);
          field("Sports board","sportsBoardId",{options:choices}).addEventListener('change',()=>{const board=sportsBoards.find(b=>b.id===layer.sportsBoardId);layer.sportsAudio=board?.audio===true;layer.sportsVolume=board?.volume??1;draw();properties()});
          field("Sports video sound","sportsAudio",{type:'checkbox'});field("Sports video volume","sportsVolume",{type:'range',min:0,max:1}).step='.01';
        }
        if(layer.type==="widget"&&layer.widget==="weather"){
          const group=node("fieldset"),legend=node("legend","Weather overlay details");group.append(legend);inspector.append(group);
          for(const key of model.WEATHER_FIELDS){const label=node("label",key.replaceAll("-"," ")),input=node("input");input.type="checkbox";input.checked=layer.weatherFields.includes(key);input.setAttribute("aria-label",`Weather detail: ${key}`);input.addEventListener("change",()=>{const next=model.WEATHER_FIELDS.filter(x=>x===key?input.checked:layer.weatherFields.includes(x));if(!next.length){input.checked=true;announce("Keep at least one weather detail");return}remember();layer.weatherFields=next;draw()});label.prepend(input);group.append(label)}
        }
        if(layer.type==="text"){
        field("Text","text",{type:"textarea"});
        const variables=node("div",undefined,"sceneVariables");inspector.append(variables);
        for(const token of ["%class%","%class_short%","%date%","%time%","%day_color%","%cycle_day%"]){button(token,()=>{remember();layer.text+=token;draw();properties()},variables)}
        }
        field("Text color","color",{type:"color"});field("Font size","fontSize",{type:"number",min:12,max:220});
        field("Auto-fit text inside layer","autoFit",{type:"checkbox"});
        field("Bold","bold",{type:"checkbox"});field("Italic","italic",{type:"checkbox"});field("Underline","underline",{type:"checkbox"});
        field("Alignment","align",{options:["left","center","right"].map(x=>[x,x])});field("Glow strength","glow",{type:"range",min:0,max:40});
      }
      if(layer.type==="image"){
        field("Uploaded image","asset",{options:[["","Choose an image"],...(S.mediaFiles||[]).filter(f=>f.type==="image"||/\.(png|jpe?g|gif|webp|bmp)$/i.test(f.storedName||"")).map(f=>[f.storedName,f.originalName||f.storedName])]});
        field("Image fit","fit",{options:[["contain","Fit inside"],["cover","Fill / crop"]]});
      }
      if(layer.type==="shape")field("Fill color","fill",{type:"color"});
      for(const [key,label,min,max] of [["x","Horizontal position (%)",0,99],["y","Vertical position (%)",0,99],["w","Width (%)",1,100],["h","Height (%)",1,100],["rotation","Rotation (degrees)",-180,180],["radius","Corner radius",0,200]])field(label,key,{type:"number",min,max});
      field("Opacity","opacity",{type:"range",min:0,max:1}).step="0.05";
      field("Motion","effect",{options:model.EFFECTS.map(x=>[x,x])});field("Motion duration (seconds)","speed",{type:"number",min:2,max:60});
    }
    function add(type,x=10,y=10){
      if(scene.layers.length>=model.MAX_LAYERS)return announce(`Maximum ${model.MAX_LAYERS} layers`);
      remember();const layer=model.normalize({layers:[{id:id(),type,name:type==="text"?"Text":type==="image"?"Image":type==="widget"?"Live widget":"Shape",text:type==="text"?"Your message":"",x,y,w:50,h:type==="image"?35:18}]}).layers[0];scene.layers.push(layer);selected=layer.id;draw();properties();
    }
    for(const [label,type] of [["+ Text","text"],["+ Image","image"],["+ Shape","shape"],["+ Widget","widget"]]){const b=button(label,()=>add(type));b.draggable=true;b.addEventListener("dragstart",e=>e.dataTransfer.setData("text/plain",type))}
    button("Undo",()=>{if(!history.length)return;future.push(clone(scene));scene=history.pop();draw();properties()});button("Redo",()=>{if(!future.length)return;history.push(clone(scene));scene=future.pop();draw();properties()});
    const motion=button("Preview motion",()=>{playing=!playing;motion.textContent=playing?"Stop motion":"Preview motion";motion.setAttribute("aria-pressed",String(playing));draw()});
    const previewLabel=node("label","Receiver shape "),previewShape=node("select");for(const [value,label]of [[16/9,"16:9 widescreen"],[16/10,"16:10 monitor"],[4/3,"4:3 display"],[21/9,"Ultrawide"],[9/16,"Portrait"]]){const option=node("option",label);option.value=value;previewShape.append(option)}previewShape.setAttribute("aria-label","Receiver shape");previewShape.addEventListener("change",()=>{viewRatio=Number(previewShape.value);fit()});previewLabel.append(previewShape);toolbar.append(previewLabel);
    button("Center layer",()=>{const l=chosen();if(!l||l.locked)return;remember();l.x=(100-l.w)/2;l.y=(100-l.h)/2;draw();properties()});
    canvas.addEventListener("dragover",e=>e.preventDefault());canvas.addEventListener("drop",e=>{e.preventDefault();const type=e.dataTransfer.getData("text/plain");if(!["text","image","shape","widget"].includes(type))return;const r=canvas.getBoundingClientRect();add(type,Math.min(49,Math.max(0,(e.clientX-r.left)/r.width*100)),Math.min(64,Math.max(0,(e.clientY-r.top)/r.height*100)))});
    let gesture=null;
    canvas.addEventListener("pointerdown",e=>{const target=e.target.closest("[data-layer-id]");if(!target)return;selected=target.dataset.layerId;properties();const l=chosen();if(!l||l.locked){draw();return}remember();gesture={x:e.clientX,y:e.clientY,before:clone(l),resize:!!e.target.dataset.resize,pointer:e.pointerId};canvas.setPointerCapture(e.pointerId);e.preventDefault();draw()});
    canvas.addEventListener("pointermove",e=>{if(!gesture)return;const l=chosen(),r=canvas.getBoundingClientRect(),dx=(e.clientX-gesture.x)/r.width*100,dy=(e.clientY-gesture.y)/r.height*100,b=gesture.before;if(gesture.resize){l.w=Math.max(1,Math.min(100-b.x,b.w+dx));l.h=Math.max(1,Math.min(100-b.y,b.h+dy))}else{l.x=Math.max(0,Math.min(100-b.w,b.x+dx));l.y=Math.max(0,Math.min(100-b.h,b.y+dy))}draw()});
    const finish=()=>{if(gesture){gesture=null;properties();announce("Layer position updated")}};canvas.addEventListener("pointerup",finish);canvas.addEventListener("pointercancel",finish);
    canvas.addEventListener("keydown",e=>{if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key))return;const l=chosen();if(!l||l.locked)return;e.preventDefault();remember();const step=e.shiftKey?10:1;l.x=Math.max(0,Math.min(100-l.w,l.x+(e.key==="ArrowRight"?step:e.key==="ArrowLeft"?-step:0)/model.WIDTH*100));l.y=Math.max(0,Math.min(100-l.h,l.y+(e.key==="ArrowDown"?step:e.key==="ArrowUp"?-step:0)/model.HEIGHT*100));draw();properties();canvas.querySelector(`[data-layer-id="${selected}"]`)?.focus()});
    function close(value){if(closed)return;closed=true;observer.disconnect();dialog.close();dialog.remove();resolve(value)}
    dialog.addEventListener("close",()=>close(null));cancel.addEventListener("click",()=>close(null));dialog.addEventListener("cancel",e=>{e.preventDefault();close(null)});save.addEventListener("click",()=>{try{close(model.normalize(scene))}catch(err){announce(err.message)}});
    const observer=new ResizeObserver(fit);observer.observe(frame);dialog.showModal();draw();properties();save.focus();
  })};
})();
