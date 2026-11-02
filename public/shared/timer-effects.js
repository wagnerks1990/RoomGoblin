"use strict";
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.RoomGoblinTimerEffects=api})(typeof globalThis!=="undefined"?globalThis:this,()=>{
  const STYLES=["badge","glass","broadcast","ring","minimal","segments"],ANCHORS=["inherit","top-left","top","top-right","center","bottom-left","bottom","bottom-right","custom"],MOTIONS=["none","glow","pulse","pop","bounce","slide","ripple","flip"],SOUNDS=["none","chime","bell","speak"];
  const object=v=>v&&typeof v==="object"&&!Array.isArray(v);
  function number(v,fallback,min,max){const n=v==null||v===""?fallback:Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(`Timer effect value must be between ${min} and ${max}`);return n}
  const text=(v,f="",max=160)=>String(v??f).slice(0,max),choice=(v,all,f)=>all.includes(v)?v:f;
  function color(v,f){if(v===undefined||v==="")return f;if(!/^#[0-9a-f]{6}$/i.test(String(v)))throw Error("Timer effect colors must use #RRGGBB");return String(v)}
  function stage(v,i){if(!object(v))throw Error("Timer stage must be an object");return {id:text(v.id,`stage-${i}`,60).replace(/[^\w-]/g,"" )||`stage-${i}`,seconds:number(v.seconds,300,1,86400),color:color(v.color,"#ffd56a"),scale:number(v.scale,1,1,4),largeSeconds:number(v.largeSeconds,0,0,120),anchor:choice(v.anchor,ANCHORS,"inherit"),effect:choice(v.effect,MOTIONS,"glow"),label:text(v.label),message:text(v.message),sound:choice(v.sound,SOUNDS,"none")}}
  function normalize(value){
    if(value==null)value={};if(!object(value))throw Error("Timer effects must be an object");
    if(!Array.isArray(value.stages||[])||(value.stages||[]).length>8)throw Error("Use at most eight timer stages");
    const stages=(value.stages||[]).map(stage).sort((a,b)=>b.seconds-a.seconds),ids=new Set(),times=new Set();
    for(const s of stages){if(["normal","finished"].includes(s.id)||ids.has(s.id)||times.has(s.seconds))throw Error("Timer stage IDs and thresholds must be unique and not reserved");ids.add(s.id);times.add(s.seconds)}
    const finish=value.finish||{};if(!object(finish))throw Error("Timer finish settings must be an object");
    return {version:1,enabled:value.enabled===true,style:choice(value.style,STYLES,"badge"),anchor:choice(value.anchor,ANCHORS,"inherit"),x:number(value.x,34,0,98),y:number(value.y,80,0,98),width:number(value.width,32,12,96),height:number(value.height,18,8,90),motion:choice(value.motion,["full","reduced","off"],"full"),intensity:number(value.intensity,1,.25,2),transitionMs:number(value.transitionMs,650,100,2000),progress:value.progress!==false,dim:number(value.dim,0,0,.7),volume:number(value.volume,.2,0,.5),digitEffect:value.digitEffect===true,stages,finish:{behavior:choice(finish.behavior,["hold","message","hide","fade"],"hold"),message:text(finish.message,"Time’s up"),label:text(finish.label,"Follow your teacher’s directions"),seconds:number(finish.seconds,8,0,120),color:color(finish.color,"#b4e990"),sound:choice(finish.sound,SOUNDS,"none")}};
  }
  function preset(name){const stages=[{id:"five-minutes",seconds:300,color:"#ffd56a",effect:"glow",label:"5 minutes remaining"},{id:"two-minutes",seconds:120,color:"#ffd56a",scale:2.5,effect:"pop",label:"2 minutes remaining",message:"Finish your work & save"}];return normalize({enabled:name!=="classic",style:name==="broadcast"?"broadcast":name==="ring"?"ring":"glass",motion:name==="calm"?"off":"full",stages,finish:{behavior:"message",message:"Time’s up",label:"Follow your teacher’s directions"}})}
  function resolve(timer,seconds,now=Date.now()){
    const e=normalize(timer.effects);if(!e.enabled||timer.mode==="countup")return null;
    const done=seconds<=0,s=done?null:e.stages.filter(s=>seconds<=s.seconds).at(-1),deadline=Number(timer.effectsEndAt||timer.endAt)||0;
    const elapsed=s&&deadline?Math.max(0,(now-(deadline-s.seconds*1000))/1000):0;
    const scale=s&&(!s.largeSeconds||elapsed<s.largeSeconds)?s.scale:1;
    const anchor=(s?.anchor!=="inherit"&&s?.anchor)||e.anchor!=="inherit"&&e.anchor||timer.position||"bottom";
    let w=Math.min(96,e.width*(scale>1?Math.min(1.85,scale):1)),h=Math.min(90,e.height*scale),x,y;
    if(e.style==="broadcast"){w=96;h=Math.min(70,e.height*scale)}
    if(e.style==="ring"){h=Math.min(70,Math.max(30,e.height*1.8)*Math.min(1.5,scale));w=h*9/16}
    x=anchor.includes("left")?2:anchor.includes("right")?98-w:(100-w)/2;y=anchor.startsWith("top")?2:anchor==="center"?(100-h)/2:98-h;
    if(anchor==="custom"){x=Math.min(e.x,98-w);y=Math.min(e.y,98-h)}
    const finishElapsed=done&&deadline?Math.max(0,(now-deadline)/1000):0;
    const duration=deadline&&Number(timer.effectsStartAt)?(deadline-Number(timer.effectsStartAt))/1000:Number(timer.durationSeconds)||seconds||1;
    return {effects:e,stage:s,stageId:done?"finished":s?.id||"normal",visible:timer.visible!==false&&!(done&&e.finish.behavior==="hide")&&!(done&&e.finish.behavior==="fade"&&finishElapsed>=e.finish.seconds),fade:done&&e.finish.behavior==="fade",color:done?e.finish.color:s?.color||timer.textColor||"#ffffff",label:done&&e.finish.behavior!=="hold"?e.finish.label:s?.label||timer.label||"",message:done?"":s?.message||"",value:done&&e.finish.behavior!=="hold"?e.finish.message:null,scale,geometry:{x,y,w,h},progress:Math.max(0,Math.min(1,seconds/Math.max(1,duration)))};
  }
  return {STYLES,ANCHORS,MOTIONS,SOUNDS,normalize,preset,resolve};
});
