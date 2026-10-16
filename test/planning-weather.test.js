"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createWeatherCache,forecastSnapshot}=require("../src/planning-weather");
const {weatherScene}=require("../src/weather-scene"),scene=require("../public/shared/scene");
const settings={enabled:true,latitude:40,longitude:-77,unit:"fahrenheit",label:"School"};
async function snapshot(at,hourly){
 const cache=createWeatherCache({now:()=>Date.parse(at),fetchImpl:async url=>{
  assert.equal(url.origin,"https://api.open-meteo.com");
  assert.ok(url.searchParams.get("hourly").split(",").includes("precipitation_probability"));
  assert.equal(url.searchParams.get("forecast_hours"),"48");
  assert.equal(url.searchParams.get("timeformat"),"unixtime");
  assert.equal(url.searchParams.get("temperature_unit"),"fahrenheit");
  return new Response(JSON.stringify({current:{temperature_2m:76,weather_code:3},hourly}));
 }});
 assert.equal(cache.read(settings),null);await cache.settled();return cache.read(settings);
}
const seconds=at=>Date.parse(at)/1000;
test("weather chooses the probability for the hour containing the observation",async()=>{
 const data=await snapshot("2026-10-16T17:35:00Z",{time:[seconds("2026-10-16T17:00Z"),seconds("2026-10-16T18:00Z")],precipitation_probability:[2,14]});
 assert.equal(data.text,"School · 76°F · Cloudy · Precip. 14% this hour");
});
test("sports precipitation uses the hour ending after each sports-hour start, in the location timezone",()=>{
 const start=seconds("2026-10-16T19:00:00Z"),times=Array.from({length:9},(_,i)=>start+i*3600);
 const w=forecastSnapshot({timezone:"America/New_York",current:{temperature_2m:76,weather_code:0},hourly:{time:times,temperature_2m:times.map(()=>70),apparent_temperature:times.map(()=>69),precipitation_probability:[99,3,4,5,6,7,8,9,10],wind_speed_10m:times.map(()=>12),wind_gusts_10m:times.map(()=>22),uv_index:times.map(()=>4),visibility:times.map(()=>16000)}},settings,Date.parse("2026-10-16T17:35Z"));
 assert.match(w.sports[0].summary,/Hourly precip\. up to 5%/);assert.doesNotMatch(w.sports[0].summary,/99%/);assert.match(w.sports[1].summary,/Hourly precip\. up to 9%/);assert.match(w.sports[0].summary,/Gusts 22 mph/);assert.match(w.sports[0].summary,/Visibility 9\.9 mi/);
});
test("full-screen defaults to seven days plus sports; overlays have editable compact fields",()=>{
 const full=weatherScene({},{});assert.equal(full.transparent,false);assert.equal(full.layers.filter(l=>/^day-\d+$/.test(l.id)).length,7);assert.ok(full.layers.some(l=>l.widget==="weather-sports-evening"));
 const overlay=weatherScene({},{mode:"overlay"});assert.equal(overlay.transparent,true);assert.deepEqual(overlay.layers.find(l=>l.widget==="weather").weatherFields,["temperature","condition","precipitation-today"]);
 const customized=weatherScene({},{mode:"overlay",overlayFields:["wind","sun"]});assert.deepEqual(customized.layers.at(-1).weatherFields,["wind","sun"]);
 for(const days of [1,3,7,10,14,16])assert.ok(weatherScene({},{view:"daily",days,metrics:["feels","wind","humidity","sun","alerts","precipitation"]}).layers.length<=40);
 assert.equal(weatherScene({},{view:"daily",days:1,dayOffset:5}).layers.find(l=>l.id==="day-1").widget,"weather-day-6");
 assert.throws(()=>weatherScene({},{days:17}));assert.throws(()=>weatherScene({},{view:"daily",days:7,dayOffset:15}));assert.throws(()=>weatherScene({},{mode:"overlay",overlayFields:["html"]}));
});
test("weather overlay output uses only the selected details and keeps source outside the main readout",()=>{
 const w={weather:"Fallback",weatherWidgets:{"weather-temperature":"76°F","weather-condition":"Cloudy","weather-wind":"Wind 8 mph"},weatherUpdatedAt:1000};
 assert.equal(scene.widgetText({widget:"weather",weatherFields:["temperature","wind"]},w,1000),"76°F · Wind 8 mph");
 assert.match(scene.widgetText({widget:"weather-wind"},w,4000000),/stale/);
 assert.doesNotMatch(scene.widgetText({widget:"weather",weatherFields:["temperature"]},w,1000),/Open-Meteo/);
 const normalized=scene.normalize({layers:[],data:{weatherWidgets:{"weather-temperature":"x".repeat(3000),html:"evil"}}});assert.equal(normalized.data.weatherWidgets["weather-temperature"].length,2000);assert.equal(normalized.data.weatherWidgets.html,undefined);
});
test("NWS alert outages and malformed responses are never presented as all clear",async()=>{
 for(const alerts of [null,{}, {features:[]}]){
  const cache=createWeatherCache({fetchImpl:async url=>{if(url.hostname==="api.weather.gov"){if(alerts===null)throw Error("offline");return new Response(JSON.stringify(alerts))}return new Response(JSON.stringify({current:{temperature_2m:76,weather_code:0}}))}});
  const cfg={...settings,alertsEnabled:true};cache.read(cfg);await cache.settled();const w=cache.read(cfg);assert.equal(w.alertsStatus,alerts?.features?"available":"unavailable");assert.match(w.widgets["weather-alerts"],alerts?.features?/No active/:/unavailable/);
 }
});
test("stream bounds, stale retention and a changed location cannot leak a previous forecast",async()=>{
 let at=1000000,calls=0;const cache=createWeatherCache({now:()=>at,fetchImpl:async()=>{calls++;if(calls>1)return new Response('x'.repeat(131073));return new Response(JSON.stringify({current:{temperature_2m:76,weather_code:0}}))}});
 cache.read(settings);await cache.settled();at+=900001;cache.read(settings);await cache.settled();assert.equal(cache.read(settings).current.temperature,76);assert.ok(cache.status().error);
 const changed={...settings,latitude:41};assert.equal(cache.read(changed),null);await cache.settled();assert.equal(cache.read(changed),null);
});
test("weather advances to the upcoming hour at an exact boundary and across UTC midnight",async()=>{
 for(const at of ["2026-10-16T18:00:00Z","2026-10-16T23:35:00Z"]){
  const current=Date.parse(at),end=(Math.floor(current/3600000)+1)*3600;
  const data=await snapshot(at,{time:[end-3600,end],precipitation_probability:[90,0]});
  assert.match(data.text,/Precip\. 0% this hour/);
 }
});
test("missing, invalid and out-of-window probabilities never become a false zero",async()=>{
 for(const probability of [null,-1,101,"10",undefined]){
  const data=await snapshot("2026-10-16T17:35:00Z",{time:[seconds("2026-10-16T18:00Z")],precipitation_probability:[probability]});
  assert.doesNotMatch(data.text,/Precip\./);assert.match(data.text,/76°F/);assert.match(data.source,/Open-Meteo/);
 }
 for(const hourly of [undefined,{time:[seconds("2026-10-16T20:00Z")],precipitation_probability:[60]},{time:[seconds("2026-10-16T18:00Z")],precipitation_probability:[]}]){
  assert.doesNotMatch((await snapshot("2026-10-16T17:35:00Z",hourly)).text,/Precip\./);
 }
});
