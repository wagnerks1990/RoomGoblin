/* Shared, bounded scene model and renderer. No HTML, scripts, remote embeds or CSS input. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.RoomGoblinScene=api})(typeof globalThis!=="undefined"?globalThis:this,()=>{
  "use strict";
  const WIDTH=1920,HEIGHT=1080,MAX_LAYERS=40;
  const EFFECTS=["none","fade","slide","bounce","scroll"],TRANSITIONS=["none","fade","slide","zoom"];
  const WIDGETS=["clock","date","class","countdown","cycle","weather","progress"];
  const num=(v,d,min,max)=>{const n=v===undefined?d:Number(v);if(!Number.isFinite(n))throw Error("Scene values must be finite numbers");return Math.max(min,Math.min(max,n))};
  const color=(v,d)=>{const s=String(v||d);if(!/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(s))throw Error("Choose a hex color");return s};
  const asset=v=>{const s=String(v||"");if(s&&!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$/.test(s)||s.includes("..")||s&&!/\.(png|jpe?g|gif|webp|bmp)$/i.test(s))throw Error("Choose an uploaded image");return s};
  function fitGeometry(layer){
    let w=layer.w*WIDTH/100,h=layer.h*HEIGHT/100;
    const angle=layer.rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
    const shrink=Math.min(1,WIDTH/(w*c+h*s),HEIGHT/(w*s+h*c));w*=shrink;h*=shrink;
    const halfW=(w*c+h*s)/2,halfH=(w*s+h*c)/2;
    const cx=Math.max(halfW,Math.min(WIDTH-halfW,layer.x*WIDTH/100+w/2)),cy=Math.max(halfH,Math.min(HEIGHT-halfH,layer.y*HEIGHT/100+h/2));
    return {...layer,x:(cx-w/2)/WIDTH*100,y:(cy-h/2)/HEIGHT*100,w:w/WIDTH*100,h:h/HEIGHT*100};
  }
  function normalize(input={}){
    if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Scene must be an object");
    if(!Array.isArray(input.layers)||input.layers.length>MAX_LAYERS)throw Error(`A scene supports up to ${MAX_LAYERS} layers`);
    const ids=new Set();
    if(JSON.stringify(input).length>60000)throw Error("Scene content is too large");
    const data=input.data&&typeof input.data==="object"?input.data:{};
    const safeData={};for(const key of ["className","cycleDay","dayGroup","weather","timezone"])safeData[key]=String(data[key]||"").slice(0,160);
    for(const key of ["endAt","startAt","weatherUpdatedAt"])safeData[key]=Number.isFinite(Number(data[key]))?Number(data[key]):0;
    return {version:1,background:color(input.background,"#101d2c"),transparent:input.transparent===true,data:safeData,
      transition:TRANSITIONS.includes(input.transition)?input.transition:"none",durationMs:num(input.durationMs,500,100,2000),
      layers:input.layers.map((l,i)=>{
        if(!l||!["text","image","shape","widget"].includes(l.type))throw Error("Choose text, image, shape or widget");
        const id=String(l.id||`layer-${i+1}`);if(!/^[\w-]{1,80}$/.test(id)||ids.has(id))throw Error("Layer IDs must be unique");ids.add(id);
        const x=num(l.x,10,0,99),y=num(l.y,10,0,99);
        return fitGeometry({id,type:l.type,name:String(l.name||`${l.type} ${i+1}`).slice(0,100),x,y,w:num(l.w,50,1,100-x),h:num(l.h,15,1,100-y),
          text:String(l.text||"").slice(0,8000),asset:asset(l.asset),color:color(l.color,"#ffffff"),fill:color(l.fill,"#0f766e"),
          widget:WIDGETS.includes(l.widget)?l.widget:"clock",clock24:l.clock24===true,autoFit:l.autoFit!==false,
          fontSize:num(l.fontSize,64,12,220),bold:l.bold===true,italic:l.italic===true,underline:l.underline===true,
          align:["left","center","right"].includes(l.align)?l.align:"center",opacity:num(l.opacity,1,0,1),
          radius:num(l.radius,0,0,200),rotation:num(l.rotation,0,-180,180),glow:num(l.glow,0,0,40),
          effect:EFFECTS.includes(l.effect)?l.effect:"none",speed:num(l.speed,10,2,60),locked:l.locked===true,
          fit:l.fit==="cover"?"cover":"contain"});
      })};
  }
  const active=new Map();let ticker=null;
  function widgetText(layer,data,now=Date.now()){
    const date=new Date(now),timezone=data.timezone||undefined;
    try{
      if(layer.widget==="clock")return date.toLocaleTimeString(undefined,{timeZone:timezone,hour:"2-digit",minute:"2-digit",hour12:!layer.clock24});
      if(layer.widget==="date")return date.toLocaleDateString(undefined,{timeZone:timezone,weekday:"long",month:"short",day:"numeric"});
    }catch{return "Time zone unavailable"}
    if(layer.widget==="class")return data.className||"No active class";
    if(layer.widget==="cycle")return [data.dayGroup,data.cycleDay?`Cycle ${data.cycleDay}`:""].filter(Boolean).join(" · ")||"No cycle";
    if(layer.widget==="weather")return data.weather?(now-data.weatherUpdatedAt>3600000?`${data.weather} · stale`:data.weather):"Weather unavailable";
    if(!data.endAt)return "Class timer unavailable";
    if(layer.widget==="progress"){const duration=data.endAt-data.startAt;return duration>0?`${Math.round(Math.max(0,Math.min(100,(now-data.startAt)/duration*100)))}% complete`:"Progress unavailable"}
    const seconds=Math.max(0,Math.ceil((data.endAt-now)/1000));return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  }
  function render(container,value,{resolveAsset=name=>`/media/${encodeURIComponent(name)}`,interactive=false,reducedMotion=false,fitText=null}={}){
    const scene=normalize(value);container.replaceChildren();container.classList.add("rg-scene");
    container.style.background=scene.transparent?"transparent":scene.background;
    container.dataset.transition=reducedMotion?"none":scene.transition;
    container.style.setProperty("--scene-transition",`${scene.durationMs}ms`);
    for(const layer of scene.layers){
      const node=container.ownerDocument.createElement("div");node.className="rg-scene-layer";node.dataset.layerId=layer.id;
      node.dataset.effect=reducedMotion?"none":layer.effect;node.style.cssText=`left:${layer.x}%;top:${layer.y}%;width:${layer.w}%;height:${layer.h}%;opacity:${layer.opacity};border-radius:${layer.radius}px;transform:rotate(${layer.rotation}deg);--scene-speed:${layer.speed}s`;
      const inner=container.ownerDocument.createElement(layer.type==="image"?"img":"div");inner.className="rg-scene-content";
      if(layer.type==="image"){if(layer.asset)inner.src=resolveAsset(layer.asset);inner.alt=layer.name;inner.style.objectFit=layer.fit;inner.draggable=false}
      else if(layer.type==="shape")inner.style.background=layer.fill;
      else {inner.textContent=layer.type==="widget"?widgetText(layer,scene.data):layer.text;inner.style.cssText=`color:${layer.color};font-size:${layer.fontSize}px;font-weight:${layer.bold?800:400};font-style:${layer.italic?"italic":"normal"};text-decoration:${layer.underline?"underline":"none"};text-align:${layer.align};justify-content:${layer.align==="left"?"flex-start":layer.align==="right"?"flex-end":"center"};text-shadow:${layer.glow?`0 0 ${layer.glow}px ${layer.color}`:"none"}`}
      if(layer.type==="text"||layer.type==="widget"){inner.style.lineHeight="1.15";inner.style.overflow="visible";}
      node.append(inner);if(interactive){node.tabIndex=0;node.setAttribute("role","button");node.setAttribute("aria-label",`Select ${layer.name}`)}container.append(node);
      if((layer.type==="text"||layer.type==="widget")&&layer.autoFit&&fitText){inner.style.height="auto";inner.style.maxHeight="100%";fitText(inner,node,layer.fontSize)}
    }
    active.delete(container);
    if(scene.layers.some(l=>l.type==="widget"))active.set(container,{scene,fitText});
    if(active.size&&!ticker)ticker=setInterval(()=>{for(const [host,{scene,fitText}] of active){if(!host.isConnected){active.delete(host);continue}for(const layer of scene.layers.filter(l=>l.type==="widget")){const outer=[...host.children].find(n=>n.dataset.layerId===layer.id),inner=outer?.firstChild;if(!inner)continue;const text=widgetText(layer,scene.data);if(inner.textContent!==text){inner.textContent=text;if(layer.autoFit&&fitText)fitText(inner,outer,layer.fontSize)}}}if(!active.size){clearInterval(ticker);ticker=null}},1000);
    return scene;
  }
  const fromText=p=>({version:1,background:/^#[0-9a-f]{6}$/i.test(p.background||"")?p.background:"#101d2c",layers:[
    {id:"title",type:"text",text:p.title||"",name:"Title",x:6,y:5,w:88,h:15,fontSize:Number(p.titleSize)||88,bold:true,color:p.titleColor||"#ffffff"},
    {id:"body",type:"text",text:p.text||"",name:"Body",x:6,y:25,w:88,h:52,fontSize:Number(p.size)||64,color:p.color||"#ffffff"},
    {id:"subtitle",type:"text",text:p.subtitle||"",name:"Subtitle",x:6,y:80,w:88,h:12,fontSize:Number(p.subtitleSize)||38,color:p.subtitleColor||"#ffffff"}].filter(l=>l.text)});
  return {WIDTH,HEIGHT,MAX_LAYERS,EFFECTS,TRANSITIONS,WIDGETS,normalize,render,fromText,widgetText};
});
