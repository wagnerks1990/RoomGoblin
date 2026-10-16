"use strict";
// Optional, fixed-origin, bounded and non-blocking. Weather never gates scheduling.
function normalizeWeather(input={}){
  const enabled=input.enabled===true;
  const latitude=input.latitude===""||input.latitude==null?null:Number(input.latitude),longitude=input.longitude===""||input.longitude==null?null:Number(input.longitude);
  if(latitude!==null&&(!Number.isFinite(latitude)||latitude< -90||latitude>90)||longitude!==null&&(!Number.isFinite(longitude)||longitude< -180||longitude>180))throw Error("Choose valid weather coordinates");
  if(enabled&&(!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180))throw Error("Set weather latitude and longitude before enabling weather");
  return {enabled,latitude,longitude,unit:input.unit==="fahrenheit"?"fahrenheit":"celsius",label:String(input.label||"").slice(0,80),alertsEnabled:input.alertsEnabled===true};
}
const number=(v,min,max)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
const boundedText=(v,max=300)=>String(v||"").slice(0,max);
const condition=code=>code===0?"Clear":code<=3?"Cloudy":code<=48?"Fog":code<=67?"Rain":code<=77?"Snow":code<=82?"Showers":code<=86?"Snow showers":"Thunderstorms";
function forecastSnapshot(result,settings,at){
 const c=result.current||{},temperature=number(c.temperature_2m,-150,150),code=number(c.weather_code,0,99);
 if(temperature===null||code===null||!Number.isInteger(code))throw Error("Invalid weather data");
 const unit=settings.unit==="fahrenheit"?"°F":"°C",windUnit=settings.unit==="fahrenheit"?"mph":"km/h";
 let timezone="UTC";try{new Intl.DateTimeFormat("en",{timeZone:result.timezone}).format();timezone=result.timezone||"UTC"}catch{}
 const time=(v,opts)=>new Date(v*1000).toLocaleString("en-US",{timeZone:timezone,...opts});
 const h=result.hourly||{},hourly=(Array.isArray(h.time)?h.time:[]).slice(0,48).map((t,i)=>({time:number(t,0,1e11),temperature:number(h.temperature_2m?.[i],-150,150),feelsLike:number(h.apparent_temperature?.[i],-150,150),code:number(h.weather_code?.[i],0,99),probability:number(h.precipitation_probability?.[i],0,100),precipitation:number(h.precipitation?.[i],0,5000),humidity:number(h.relative_humidity_2m?.[i],0,100),wind:number(h.wind_speed_10m?.[i],0,1000),gust:number(h.wind_gusts_10m?.[i],0,1000),visibility:number(h.visibility?.[i],0,200000),uv:number(h.uv_index?.[i],0,50)})).filter(r=>r.time!==null);
 const hour=hourly.find(r=>r.time*1000>at&&r.time*1000<=at+3600000),d=result.daily||{};
 const daily=(Array.isArray(d.time)?d.time:[]).slice(0,16).map((t,i)=>({time:number(t,0,1e11),code:number(d.weather_code?.[i],0,99),high:number(d.temperature_2m_max?.[i],-150,150),low:number(d.temperature_2m_min?.[i],-150,150),probability:number(d.precipitation_probability_max?.[i],0,100),precipitation:number(d.precipitation_sum?.[i],0,5000),wind:number(d.wind_speed_10m_max?.[i],0,1000),gust:number(d.wind_gusts_10m_max?.[i],0,1000),uv:number(d.uv_index_max?.[i],0,50),sunrise:number(d.sunrise?.[i],0,1e11),sunset:number(d.sunset?.[i],0,1e11)})).filter(r=>r.time!==null);
 const fmt=(v,suffix="")=>v===null||v===undefined?"—":`${Math.round(v)}${suffix}`;
 const current={temperature,condition:condition(code),code,feelsLike:number(c.apparent_temperature,-150,150),humidity:number(c.relative_humidity_2m,0,100),wind:number(c.wind_speed_10m,0,1000),gust:number(c.wind_gusts_10m,0,1000),direction:number(c.wind_direction_10m,0,360),cloudCover:number(c.cloud_cover,0,100),pressure:number(c.pressure_msl,500,1200),probability:hour?.probability??null};
 const text=`${settings.label?settings.label+" · ":""}${fmt(temperature,unit)} · ${current.condition}${current.probability===null?"":` · Precip. ${fmt(current.probability,"%")} this hour`}`;
 const widgets={weather:text,"weather-temperature":fmt(temperature,unit),"weather-condition":current.condition,"weather-feels":`Feels like ${fmt(current.feelsLike,unit)}`,"weather-wind":`Wind ${fmt(current.wind," "+windUnit)} · Gusts ${fmt(current.gust," "+windUnit)}`,"weather-humidity":`Humidity ${fmt(current.humidity,"%")} · Clouds ${fmt(current.cloudCover,"%")}`,"weather-precipitation":`Precipitation chance ${fmt(current.probability,"%")} this hour`,"weather-sun":daily[0]?`Sunrise ${daily[0].sunrise?time(daily[0].sunrise,{hour:"numeric",minute:"2-digit"}):"—"} · Sunset ${daily[0].sunset?time(daily[0].sunset,{hour:"numeric",minute:"2-digit"}):"—"}`:"Sun times unavailable"};
 widgets["weather-location"]=settings.label||"Local weather";widgets["weather-precipitation-today"]=`Today: ${fmt(daily[0]?.probability,"%")} max hourly precip. chance`;
 const currentHour=hourly.find(r=>r.time*1000<=at&&r.time*1000+3600000>at);
 widgets["weather-pressure"]=`Pressure ${fmt(current.pressure," hPa")}`;widgets["weather-uv"]=`UV ${fmt(currentHour?.uv)} (hourly forecast)`;widgets["weather-visibility"]=`Visibility ${currentHour?.visibility==null?"—":settings.unit==="fahrenheit"?`${(currentHour.visibility/1609.344).toFixed(1)} mi`:`${(currentHour.visibility/1000).toFixed(1)} km`} (hourly forecast)`;
 for(let i=0;i<16;i++){const row=daily[i];widgets[`weather-day-${i+1}`]=row?`${time(row.time,{weekday:"short",month:"short",day:"numeric"})}\n${fmt(row.high,"°")} / ${fmt(row.low,"°")}\n${row.code===null?"—":condition(row.code)}\nPrecip. ${fmt(row.probability,"%")}\nWind ${fmt(row.wind," "+windUnit)}\nUV ${fmt(row.uv)}`:"Forecast unavailable"}
 for(let i=0;i<12;i++){const row=hourly.filter(r=>r.time*1000>=at)[i];widgets[`weather-hour-${i+1}`]=row?`${time(row.time,{hour:"numeric"})}\n${fmt(row.temperature,unit)}\n${row.code===null?"—":condition(row.code)}\nPrecip. ${fmt(row.probability,"%")}`:"Forecast unavailable"}
 const localParts=v=>new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date(v)).reduce((p,x)=>(p[x.type]=x.value,p),{}),today=localParts(at);
 const sports=[["afternoon","After school · 3–6 PM",15,18],["evening","Evening sports · 6–10 PM",18,22]].map(([id,label,start,end])=>{
  const rows=hourly.filter(r=>{const p=localParts(r.time*1000);return p.year===today.year&&p.month===today.month&&p.day===today.day&&Number(p.hour)>=start&&Number(p.hour)<end});
  const values=key=>rows.map(r=>key==="probability"?hourly.find(h=>h.time===r.time+3600)?.probability??null:r[key]).filter(v=>v!==null),range=key=>{const a=values(key);return a.length?`${fmt(Math.min(...a),"°")}–${fmt(Math.max(...a),unit)}`:"—"},max=key=>{const a=values(key);return a.length?Math.max(...a):null};
  const visibility=values("visibility"),visibilityText=visibility.length?settings.unit==="fahrenheit"?`${(Math.min(...visibility)/1609.344).toFixed(1)} mi`:`${(Math.min(...visibility)/1000).toFixed(1)} km`:"—";
  const summary=rows.length?`${label}${rows.length<end-start?" · partial forecast":""}\n${range("temperature")} · Feels ${range("feelsLike")}\nHourly precip. up to ${fmt(max("probability"),"%")}\nWind up to ${fmt(max("wind")," "+windUnit)} · Gusts ${fmt(max("gust")," "+windUnit)}\nUV up to ${fmt(max("uv"))} · Visibility ${visibilityText}`:`${label}\nForecast unavailable`;
  widgets[`weather-sports-${id}`]=summary;return {id,label,summary,hours:rows};
 });
 widgets["weather-sports"]=sports.map(s=>s.summary).join("\n\n");
 return {text,widgets,current,hourly,daily,sports,unit,windUnit,precipitationUnit:settings.unit==="fahrenheit"?"in":"mm",timezone,label:settings.label,source:"Weather data: Open-Meteo · CC BY 4.0",updatedAt:at,alerts:[],alertsStatus:settings.alertsEnabled?"loading":"disabled"};
}
async function boundedJson(response,limit=131072){
 if(!response.ok)throw Error("Weather source unavailable");if(Number(response.headers.get("content-length"))>limit)throw Error("Weather response is too large");
 let bytes=0,text="";const decoder=new TextDecoder();
 for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>limit){await response.body.cancel().catch(()=>{});throw Error("Weather response is too large")}text+=decoder.decode(chunk,{stream:true})}text+=decoder.decode();return JSON.parse(text);
}
function createWeatherCache({fetchImpl=fetch,now=Date.now}={}){
  let cached=null,pending=null,lastAttempt=0,key="",error=null;
  function read(config){
    const settings=normalizeWeather(config);if(!settings.enabled)return null;
    const selected=JSON.stringify(settings);if(selected!==key){cached=null;key=selected;lastAttempt=0;error=null}
    if(!pending&&(!lastAttempt||now()-lastAttempt>=900000)){
      lastAttempt=now();const requestKey=key;error=null;
      pending=(async()=>{
        const url=new URL("https://api.open-meteo.com/v1/forecast");url.search=new URLSearchParams({latitude:String(settings.latitude),longitude:String(settings.longitude),current:"temperature_2m,weather_code,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,pressure_msl",hourly:"temperature_2m,apparent_temperature,weather_code,precipitation_probability,precipitation,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,visibility,uv_index",daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset",forecast_hours:"48",forecast_days:"16",timeformat:"unixtime",temperature_unit:settings.unit,wind_speed_unit:settings.unit==="fahrenheit"?"mph":"kmh",precipitation_unit:settings.unit==="fahrenheit"?"inch":"mm",timezone:"auto"}).toString();
        const response=await fetchImpl(url,{signal:AbortSignal.timeout(4000),redirect:"error"});
        const snapshot=forecastSnapshot(await boundedJson(response),settings,now());
        if(settings.alertsEnabled){try{
          const alertsUrl=new URL("https://api.weather.gov/alerts");alertsUrl.search=new URLSearchParams({active:"true",point:`${settings.latitude},${settings.longitude}`});
          const result=await boundedJson(await fetchImpl(alertsUrl,{signal:AbortSignal.timeout(4000),redirect:"error",headers:{"User-Agent":"RoomGoblin (https://github.com/wagnerks1990/RoomGoblin)",Accept:"application/geo+json"}}),262144);
          if(!Array.isArray(result.features))throw Error("Invalid alert data");
          snapshot.alerts=result.features.slice(0,16).map(a=>{const p=a.properties||{};return {event:boundedText(p.event,120),headline:boundedText(p.headline,400),severity:boundedText(p.severity,30),description:boundedText(p.description,4000),instruction:boundedText(p.instruction,2000),expires:boundedText(p.expires,40)}});snapshot.alertsStatus="available";
        }catch{snapshot.alertsStatus="unavailable"}}
        snapshot.widgets["weather-alerts"]=snapshot.alertsStatus==="available"?(snapshot.alerts.map(a=>a.headline).join("\n")||"No active NWS alerts at last check"):snapshot.alertsStatus==="disabled"?"Weather alerts disabled":"Weather alerts unavailable";
        if(key===requestKey)cached=snapshot;
      })().catch(()=>{if(key===requestKey)error="Weather source temporarily unavailable"}).finally(()=>{pending=null});
    }
    return cached;
  }
  return {read,settled:()=>pending,status:()=>({loading:!!pending,error,lastAttempt})};
}
module.exports={normalizeWeather,createWeatherCache,forecastSnapshot,condition,boundedJson};
