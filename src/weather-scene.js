"use strict";
const scene=require("../public/shared/scene");
function weatherScene(weather={},options={}){
 const mode=options.mode==="overlay"?"overlay":"fullscreen",view=["current","hourly","daily","week","sports"].includes(options.view)?options.view:"week";
 const days=Number(options.days??7);if(!Number.isInteger(days)||days<1||days>16)throw Error("Choose 1–16 forecast days");
 const offset=view==="daily"?Number(options.dayOffset||0):0;if(!Number.isInteger(offset)||offset<0||offset+days>16)throw Error("Choose a day range within the next 16 days");
 const metrics=options.metrics===undefined?["feels","wind","humidity","sun"]:options.metrics;
 if(!Array.isArray(metrics)||metrics.length>12||new Set(metrics).size!==metrics.length||metrics.some(m=>!["feels","wind","humidity","precipitation","sun","pressure","uv","visibility","alerts","sports-afternoon","sports-evening"].includes(m)))throw Error("Choose valid weather details");
 const layers=[],add=(type,id,text,x,y,w,h,fontSize=32)=>layers.push({id,type,name:id,text:type==="text"?text:"",widget:type==="widget"?text:undefined,x,y,w,h,fontSize,bold:true,color:"#ffffff",fill:"#102b27",radius:16});
 if(mode==="overlay"){
  add("shape","weather-badge","",55,69,44,11);add("widget","weather-now","weather",56,70,42,9,30);
  if(options.overlayFields!==undefined)layers.at(-1).weatherFields=options.overlayFields;
 }else{
  add("text","weather-location",weather.label||"Weather",5,3,62,7,52);
  add("widget","weather-clock","clock",70,3,25,5,36);add("widget","weather-date","date",70,8,25,4,22);
  add("widget","weather-temperature","weather-temperature",5,12,29,19,166);add("widget","weather-condition","weather-condition",5,31,29,7,44);
  metrics.forEach((metric,i)=>add("widget",`detail-${metric}`,`weather-${metric}`,37+(metrics.length>4?i%2*30:0),13+(metrics.length>4?Math.floor(i/2):i)*(metrics.length>8?4.5:6),metrics.length>4?28:58,metrics.length>8?4:5,metrics.length>4?23:28));
  if(view==="week"||view==="daily"){
   const count=view==="daily"?days:7,cols=count>8?Math.ceil(count/2):count,rows=count>8?2:1;
   if(rows===1){add("widget","sports-afternoon","weather-sports-afternoon",5,41,44,22,26);add("widget","sports-evening","weather-sports-evening",51,41,44,22,26)}
   for(let i=0;i<count;i++){const width=90/cols,x=5+(i%cols)*width,y=rows===1?67:42+Math.floor(i/cols)*26;if(count<=8)add("shape",`day-background-${i}`,"",x,y,width-1,26);add("widget",`day-${i+1}`,`weather-day-${i+1+offset}`,x+.4,y+1,width-1.8,rows===1?24:22,count>8?22:26)}
  }else if(view==="hourly"){
   for(let i=0;i<12;i++){const x=5+(i%6)*15,y=43+Math.floor(i/6)*25;add("shape",`hour-background-${i}`,"",x,y,14,23);add("widget",`hour-${i+1}`,`weather-hour-${i+1}`,x+.5,y+1,13,21,30)}
  }else if(view==="sports"){
   add("widget","afternoon","weather-sports-afternoon",5,42,44,35,36);add("widget","evening","weather-sports-evening",51,42,44,35,36);add("widget","sunset","weather-sun",5,80,90,7,36);add("widget","alerts","weather-alerts",5,88,90,5,26);
  }else{
   add("widget","today","weather-day-1",5,43,42,45,50);add("widget","afternoon","weather-sports-afternoon",51,43,44,23,30);add("widget","evening","weather-sports-evening",51,68,44,23,30);
  }
 }
 return scene.normalize({background:"#081b20",transparent:mode==="overlay",layers,data:{weather:weather.text,weatherWidgets:weather.widgets,weatherUpdatedAt:weather.updatedAt,weatherSource:weather.source,timezone:weather.timezone}});
}
module.exports={weatherScene};
