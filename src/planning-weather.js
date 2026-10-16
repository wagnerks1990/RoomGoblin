"use strict";
// Optional, fixed-origin, bounded and non-blocking. Weather never gates scheduling.
function normalizeWeather(input={}){
  const enabled=input.enabled===true;
  const latitude=input.latitude===""||input.latitude==null?null:Number(input.latitude),longitude=input.longitude===""||input.longitude==null?null:Number(input.longitude);
  if(latitude!==null&&(!Number.isFinite(latitude)||latitude< -90||latitude>90)||longitude!==null&&(!Number.isFinite(longitude)||longitude< -180||longitude>180))throw Error("Choose valid weather coordinates");
  if(enabled&&(!Number.isFinite(latitude)||latitude< -90||latitude>90||!Number.isFinite(longitude)||longitude< -180||longitude>180))throw Error("Set weather latitude and longitude before enabling weather");
  return {enabled,latitude,longitude,unit:input.unit==="fahrenheit"?"fahrenheit":"celsius",label:String(input.label||"").slice(0,80)};
}
function createWeatherCache({fetchImpl=fetch,now=Date.now}={}){
  let cached=null,pending=null,lastAttempt=0,key="";
  function read(config){
    const settings=normalizeWeather(config);if(!settings.enabled)return null;
    const selected=JSON.stringify(settings);if(selected!==key){cached=null;key=selected;lastAttempt=0}
    if(!pending&&(!lastAttempt||now()-lastAttempt>=900000)){
      lastAttempt=now();const requestKey=key;
      pending=(async()=>{
        const url=new URL("https://api.open-meteo.com/v1/forecast");url.search=new URLSearchParams({latitude:String(settings.latitude),longitude:String(settings.longitude),current:"temperature_2m,weather_code",temperature_unit:settings.unit,timezone:"UTC"}).toString();
        const response=await fetchImpl(url,{signal:AbortSignal.timeout(4000),redirect:"error"});if(!response.ok)throw Error("Weather source unavailable");
        if(Number(response.headers.get("content-length"))>32768)throw Error("Weather response is too large");
        let bytes=0,text="";const decoder=new TextDecoder();
        for await(const chunk of response.body){bytes+=chunk.byteLength;if(bytes>32768){await response.body.cancel().catch(()=>{});throw Error("Weather response is too large")}text+=decoder.decode(chunk,{stream:true})}text+=decoder.decode();
        const result=JSON.parse(text),temperature=Number(result.current?.temperature_2m),code=Number(result.current?.weather_code);
        if(!Number.isFinite(temperature)||temperature< -150||temperature>150||!Number.isInteger(code)||code<0||code>99)throw Error("Invalid weather data");
        const condition=code===0?"Clear":code<=3?"Cloudy":code<=48?"Fog":code<=67?"Rain":code<=77?"Snow":code<=82?"Showers":code<=86?"Snow showers":"Thunderstorms";
        if(key===requestKey)cached={text:`${settings.label?settings.label+" · ":""}${Math.round(temperature)}°${settings.unit==="fahrenheit"?"F":"C"} · ${condition} · Open-Meteo`,updatedAt:now()};
      })().catch(()=>{}).finally(()=>{pending=null});
    }
    return cached;
  }
  return {read,settled:()=>pending};
}
module.exports={normalizeWeather,createWeatherCache};
