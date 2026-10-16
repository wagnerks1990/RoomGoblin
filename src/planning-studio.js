"use strict";
const scene=require("../public/shared/scene");
const {validDateKey,validTime}=require("./school-schedule");
const {normalizeWeather}=require("./planning-weather");
const KEY="school.planning.studio.v1";
const list=(v,max=100)=>{if(v!==undefined&&!Array.isArray(v))throw Error("Choose a list of values");if((v||[]).length>max)throw Error("Too many selected values");return [...new Set((v||[]).map(x=>String(x).trim()).filter(Boolean))]};
function windowRule(value={}){
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Schedule window must be an object");
  const startDate=String(value.startDate||""),endDate=String(value.endDate||"");
  if(startDate&&!validDateKey(startDate)||endDate&&!validDateKey(endDate)||startDate&&endDate&&startDate>endDate)throw Error("Choose a valid start/end date range");
  const excludedDates=list(value.excludedDates,1000);if(excludedDates.some(d=>!validDateKey(d)))throw Error("Excluded dates must use YYYY-MM-DD");
  const repeatEveryMinutes=Number(value.repeatEveryMinutes||0),endTime=String(value.endTime||"");
  if(!Number.isInteger(repeatEveryMinutes)||repeatEveryMinutes<0||repeatEveryMinutes>720||repeatEveryMinutes>0&&repeatEveryMinutes<5)throw Error("Repeat interval must be zero or 5–720 whole minutes");
  if(endTime&&!validTime(endTime)||repeatEveryMinutes&&!endTime)throw Error("Repeating schedules need a valid end time");
  return {startDate,endDate,excludedDates,repeatEveryMinutes,endTime};
}
function inWindow(value,key){const w=value||{};return !(w.startDate&&key<w.startDate||w.endDate&&key>w.endDate||(w.excludedDates||[]).includes(key))}
function times(event){
  const w=event.scheduleWindow;if(!w?.repeatEveryMinutes)return [event.time];
  const minute=t=>{const [h,m]=String(t).split(":").map(Number);return h*60+m},start=minute(event.time),end=minute(w.endTime);
  if(end<=start)throw Error("Repeat end time must follow the first run on the same day");
  const out=[];for(let at=start;at<=end;at+=w.repeatEveryMinutes)out.push(`${String(Math.floor(at/60)).padStart(2,"0")}:${String(at%60).padStart(2,"0")}`);return out;
}
// Timetable-bound automations also work for lunch, transitions and assemblies.
// An omitted block has no occurrence: it must never fall back to a clock run.
function blockOccurrences(profile,calendar,event,key){
  if(!event.blockIds?.length)return null;
  const engine=require("./planning"),table=engine.timetableForDate(profile,calendar,key);
  if(!profile.planning?.enabled||engine.schoolStatus(profile,calendar,key)!=="school"||!inWindow(event.scheduleWindow,key)||!table)return [];
  const cycle=engine.cycleForDate(profile,calendar,key).cycleDay;
  return table.blocks.filter(b=>event.blockIds.includes(b.id)&&(!b.cycleDays.length||b.cycleDays.includes(cycle))).map(b=>{
    const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
    const raw=minutes(event.classTimeReference==="end"?b.endTime:b.startTime)+Number(event.classTimeOffsetMinutes||0),at=((raw%1440)+1440)%1440;
    const startAt=new Date(`${key}T${b.startTime}:00`).getTime(),endAt=new Date(`${key}T${b.endTime}:00`).getTime(),scheduled=new Date(`${key}T12:00:00`);scheduled.setDate(scheduled.getDate()+Math.floor(raw/1440));
    return {...event,time:`${String(Math.floor(at/60)).padStart(2,"0")}:${String(at%60).padStart(2,"0")}`,scheduleMode:"dates",includeDates:[`${scheduled.getFullYear()}-${String(scheduled.getMonth()+1).padStart(2,"0")}-${String(scheduled.getDate()).padStart(2,"0")}`],classId:"",classIds:[],
      _class:{id:`block-${b.id}`,name:b.label||"Timetable block",shortName:b.label||"Timetable block",enabled:true,scheduleMode:"weekly",days:[new Date(`${key}T12:00:00`).getDay()],includeDates:[key],startTime:b.startTime,endTime:b.endTime},
      _classStartAt:startAt,_classEndAt:endAt,_planningBlockId:b.id,_classIsTransition:true,_sourceDateMatched:true,_scheduledDateKey:`${scheduled.getFullYear()}-${String(scheduled.getMonth()+1).padStart(2,"0")}-${String(scheduled.getDate()).padStart(2,"0")}`};
  });
}
function normalize(input={}){
  if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Studio configuration must be an object");
  if(!Array.isArray(input.overlays||[])||(input.overlays||[]).length>12)throw Error("Use at most 12 shared overlays");
  const ids=new Set();
  if(Buffer.byteLength(JSON.stringify(input))>180000)throw Error("Shared layer configuration is too large");
  return {version:1,updatedAt:String(input.updatedAt||""),weather:normalizeWeather(input.weather||{}),overlays:(input.overlays||[]).map((o,i)=>{
    const id=String(o.id||`overlay-${i+1}`);if(!/^[\w-]{1,80}$/.test(id)||ids.has(id))throw Error("Overlay IDs must be unique");ids.add(id);
    const days=list(o.days||[0,1,2,3,4,5,6],7).map(Number);if(days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error("Choose valid weekdays");
    const startTime=String(o.startTime||""),endTime=String(o.endTime||"");
    if(startTime&&!validTime(startTime)||endTime&&!validTime(endTime)||startTime&&endTime&&startTime>=endTime)throw Error("Shared layer times must form a same-day window");
    return {id,name:String(o.name||"Shared overlay").slice(0,100),enabled:o.enabled!==false,automationIds:list(o.automationIds),excludedAutomationIds:list(o.excludedAutomationIds),classIds:list(o.classIds),cycleDays:list(o.cycleDays,32),days,
      scheduleWindow:windowRule(o.scheduleWindow||{}),startTime,endTime,scene:scene.normalize({...o.scene,transparent:true})};
  })};
}
function matchingOverlays(config,event,{dateKey,weekday,time,cycleDay}){
  if(event.overlayPolicy==="off")return [];
  const matches=(config.overlays||[]).filter(o=>o.enabled&&inWindow(o.scheduleWindow,dateKey)&&o.days.includes(weekday)&&
    (!o.startTime||time>=o.startTime)&&(!o.endTime||time<o.endTime)&&(!o.cycleDays.length||o.cycleDays.includes(cycleDay))&&
    (!o.automationIds.length||o.automationIds.includes(event.id))&&!o.excludedAutomationIds.includes(event.id)&&
    (!o.classIds.length||o.classIds.some(id=>id===event.classId||(event.classIds||[]).includes(id)))&&(event.overlayPolicy!=="selected"||(event.overlayIds||[]).includes(o.id)));
  if(matches.reduce((n,o)=>n+o.scene.layers.length,0)>80)throw Error("Selected shared overlays exceed 80 layers");
  return matches;
}
module.exports={KEY,windowRule,inWindow,times,blockOccurrences,normalize,matchingOverlays,scene};
