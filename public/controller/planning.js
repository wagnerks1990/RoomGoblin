"use strict";
(() => {
  const el = id => document.getElementById(id);
  const clone = value => structuredClone(value);
  const csv = value => [...new Set(String(value || "").split(/[\s,]+/).filter(Boolean))];
  const uid = prefix => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
  let draft = null, snapshot = null, source = null, selectedTable = "", dirty = false, review = null, busy = false, saving = false, editRevision = 0, loadGeneration = 0, importGeneration = 0, todayGeneration = 0, pendingPreview = null;
  const monthCache=new Map(),monthPending=new Set();
  function message(text, error = false) {el("planningMessage").textContent=text;el("planningMessage").classList.toggle("bad",error)}
  function changed() {editRevision++;todayGeneration++;monthCache.clear();dirty=true;review=null;el("planningPublish").disabled=true;message("Unsaved draft. Preview changes before saving.")}
  function selectDate(date) {todayGeneration++;el("planningDate").value=date;renderDate();preview(false)}
  async function selectToday() {
    if(!draft||saving)return;
    const owner=draft,generation=++todayGeneration;
    const current=()=>generation===todayGeneration&&owner===draft&&!saving;
    try{
      const result=await api("/api/v1/planning/day"),date=result.day?.date;
      if(!current())return;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date)throw Error("The appliance did not return a valid current date.");
      selectDate(date);
    }catch(error){if(current())message(`Could not select Today: ${error.message}`,true)}
  }
  function option(select,value,label) {const node=document.createElement("option");node.value=value;node.textContent=label;select.append(node)}
  function input(label,value,type="text") {
    const wrapper=document.createElement("label"),field=document.createElement("input");wrapper.append(document.createTextNode(label));field.type=type;field.value=value||"";wrapper.append(field);return {wrapper,field};
  }
  function pane(name) {
    if(name==="Calendar"&&draft){capture();const select=el("planningDayTimetable"),value=select.value;select.replaceChildren();option(select,"","Follow regular / calendar exceptions");p().timetables.forEach(table=>option(select,table.id,table.name));select.value=value}
    for(const value of ["Calendar","Timetable","Rotation"]){el(`planning${value}Pane`).hidden=value!==name;el(`planning${value}Tab`).setAttribute("aria-pressed",String(value===name))}
  }
  function p() {return draft.planning}
  function capture() {
    if(!draft)return;
    p().enabled=el("planningEnabled").value==="1";
    p().startDate=el("planningYearStart").value;p().endDate=el("planningYearEnd").value;
    draft.anchorDate=el("planningAnchor").value;draft.cycleDays=csv(el("planningCycleLetters").value);
    p().weekdays=[...el("planningWeekdays").querySelectorAll("input:checked")].map(node=>Number(node.value));
    draft.dayGroups=[...el("planningGroups").children].map(row=>{const fields=row.querySelectorAll("input");return {...draft.dayGroups.find(g=>g.id===row.dataset.groupId),id:row.dataset.groupId,label:fields[0].value,cycleDays:csv(fields[1].value)}});
    draft.periodCycleDays=Object.fromEntries([...el("planningPeriodMapping").querySelectorAll("input")].map(field=>[field.dataset.period,csv(field.value)]));
    p().defaultTimetableId=el("planningDefaultTable").value;
    const table=p().timetables.find(item=>item.id===selectedTable);
    if(table){
      table.name=el("planningTableName").value.trim();
      table.blocks=[...el("planningBlocks").children].map(row=>{
        const fields=row.querySelectorAll("input,select");
        return {id:row.dataset.blockId,kind:fields[0].value,period:fields[1].value.trim(),label:fields[2].value,classId:fields[3].value.trim(),startTime:fields[4].value,endTime:fields[5].value,cycleDays:csv(fields[6].value)};
      });
    }
  }
  function renderRotation() {
    el("planningEnabled").value=p().enabled?"1":"0";el("planningYearStart").value=p().startDate;el("planningYearEnd").value=p().endDate;
    el("planningAnchor").value=draft.anchorDate||"";el("planningCycleLetters").value=draft.cycleDays.join(", ");
    el("planningWeekdays").replaceChildren();
    ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach((day,i)=>{const label=document.createElement("label"),field=document.createElement("input");field.type="checkbox";field.value=i;field.checked=p().weekdays.includes(i);label.append(field,document.createTextNode(day));el("planningWeekdays").append(label)});
    el("planningGroups").replaceChildren();
    for(const group of draft.dayGroups){const row=document.createElement("div");row.dataset.groupId=group.id;row.append(input("Day-group name",group.label).wrapper,input("Cycle days",group.cycleDays.join(", ")).wrapper);el("planningGroups").append(row)}
    el("planningPeriodMapping").replaceChildren();
    const keys=[...new Set([...Object.keys(draft.periodCycleDays),...Array.from({length:8},(_,i)=>String(i+1)),...Array.from({length:8},(_,i)=>`BISON-${i+1}`)])];
    for(const period of keys){const item=input(`${period.startsWith("BISON-")?"Bison "+period.slice(6):"Period "+period} · cycle days`,(draft.periodCycleDays[period]||[]).join(", "));item.field.dataset.period=period;el("planningPeriodMapping").append(item.wrapper)}
  }
  function renderMonth() {
    const key=el("planningDate").value;if(!key)return;
    const monthKey=key.slice(0,7);
    if(!dirty&&!monthCache.has(monthKey)&&!monthPending.has(monthKey)){const revision=editRevision;monthPending.add(monthKey);api(`/api/v1/planning/month?month=${monthKey}`).then(result=>{if(revision!==editRevision||dirty)return;monthCache.set(monthKey,result.days||[]);if(el("planningDate").value.startsWith(monthKey))renderMonth()}).catch(()=>{}).finally(()=>monthPending.delete(monthKey))}
    const [year,month]=key.split("-").map(Number),last=new Date(year,month,0).getDate();el("planningMonth").replaceChildren();
    for(const name of ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]){const label=document.createElement("span");label.className="muted";label.textContent=name;el("planningMonth").append(label)}
    for(let i=0;i<new Date(year,month-1,1).getDay();i++){const spacer=document.createElement("span");spacer.setAttribute("aria-hidden","true");el("planningMonth").append(spacer)}
    for(let day=1;day<=last;day++){
      const date=`${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`,button=document.createElement("button");button.type="button";button.textContent=String(day);button.setAttribute("aria-pressed",String(date===key));
      const assigned=p().dates[date],saved=monthCache.get(monthKey)?.find(day=>day.date===date),detail=document.createElement("span"),status=assigned?.status||saved?.status;
      detail.textContent=status==="no-school"?"Closed":status==="remote"?"Remote":assigned?.cycleDay||saved?.cycle?`Cycle ${assigned?.cycleDay||saved.cycle}`:new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:"short"});
      button.classList.toggle("school-closed",status==="no-school");button.classList.toggle("school-green",status==="school"&&saved?.group===draft.dayGroups[0]?.label);button.classList.toggle("school-white",status==="school"&&saved?.group===draft.dayGroups[1]?.label);
      const table=assigned?.timetableId?p().timetables.find(t=>t.id===assigned.timetableId):saved?.timetable;if(table){const small=document.createElement("small");small.textContent=table.name;button.title=table.name;button.append(small)}
      button.setAttribute("aria-label",`${date}${assigned?": "+assigned.status+(assigned.cycleDay?", Cycle "+assigned.cycleDay:""):""}`);button.append(detail);button.addEventListener("click",()=>selectDate(date));el("planningMonth").append(button);
    }
  }
  function renderDate() {
    const key=el("planningDate").value,value=p().dates[key];
    const dow=new Date(`${key}T12:00:00`).getDay();
    const inherited=(p().startDate&&key<p().startDate||p().endDate&&key>p().endDate)?"no-school":(source.calendar.noSchoolDates||source.calendar.excludedDates||[]).includes(key)?"no-school":(source.calendar.remoteDates||[]).includes(key)?"remote":p().weekdays.includes(dow)?"school":"no-school";
    el("planningDayStatus").value=value?.status||inherited;
    el("planningCycleOverride").replaceChildren();option(el("planningCycleOverride"),"","Follow calculated rotation");draft.cycleDays.forEach(day=>option(el("planningCycleOverride"),day,`Cycle ${day}`));el("planningCycleOverride").value=value?.cycleDay||"";
    el("planningDayTimetable").replaceChildren();option(el("planningDayTimetable"),"","Follow regular / calendar exceptions");p().timetables.forEach(table=>option(el("planningDayTimetable"),table.id,table.name));el("planningDayTimetable").value=value?.timetableId||"";
    el("planningDayNote").value=value?.note||"";renderMonth();
  }
  function renderTable() {
    const select=el("planningTableSelect"),regular=el("planningDefaultTable");select.replaceChildren();regular.replaceChildren();option(regular,"","Keep existing class times");
    p().timetables.forEach(table=>{option(select,table.id,table.name||"Unnamed timetable");option(regular,table.id,table.name||"Unnamed timetable")});
    if(!p().timetables.some(table=>table.id===selectedTable))selectedTable=p().timetables[0]?.id||"";
    select.value=selectedTable;regular.value=p().defaultTimetableId||"";
    const table=p().timetables.find(item=>item.id===selectedTable);el("planningTableFields").hidden=!table;el("planningBlocks").replaceChildren();if(!table)return;
    el("planningTableName").value=table.name;
    table.blocks.forEach((block,index)=>{
      const row=document.createElement("details");row.className="planningBlock";row.dataset.blockId=block.id;row.open=!block.classId&&!block.label;
      const kind=document.createElement("label"),select=document.createElement("select");kind.append(document.createTextNode("Block type"));["class","break","event"].forEach(value=>option(select,value,value==="class"?"Teaching":value==="break"?"Lunch / break":"Assembly / event"));select.setAttribute("aria-label","Block type");select.value=block.kind;kind.append(select);row.append(kind);
      const periodLabel=document.createElement("label"),periodSelect=document.createElement("select");periodLabel.append(document.createTextNode("Period / Bison block"));option(periodSelect,"","Choose a period");
      const periodKeys=[...new Set([...Array.from({length:8},(_,i)=>String(i+1)),...Array.from({length:8},(_,i)=>`BISON-${i+1}`),...source.classes.map(cls=>cls.period).filter(Boolean),block.period].filter(Boolean))];
      periodKeys.forEach(key=>option(periodSelect,key,key.startsWith("BISON-")?`Bison Period ${key.slice(6)}`:/^[1-8]$/.test(key)?`Period ${key}`:key));periodSelect.setAttribute("aria-label","Period / Bison block");periodSelect.value=block.period;periodLabel.append(periodSelect);row.append(periodLabel,input("Block label",block.label).wrapper);
      const classLabel=document.createElement("label"),classSelect=document.createElement("select");classLabel.append(document.createTextNode("Specific class (optional)"));option(classSelect,"","All classes in this period");source.classes.forEach(cls=>option(classSelect,cls.id,cls.name));if(block.classId&&!source.classes.some(cls=>cls.id===block.classId))option(classSelect,block.classId,"Unavailable saved class");classSelect.setAttribute("aria-label","Specific class (optional)");classSelect.value=block.classId;classLabel.append(classSelect);row.append(classLabel);
      for(const [label,value,type] of [["Start",block.startTime,"time"],["End",block.endTime,"time"],["Cycle days (blank = all)",block.cycleDays.join(", "),"text"]])row.append(input(label,value,type).wrapper);
      const buttons=document.createElement("div");buttons.className="toolbar";
      const remove=document.createElement("button");remove.type="button";remove.textContent="Remove block";remove.addEventListener("click",()=>{capture();table.blocks.splice(index,1);changed();renderTable()});buttons.append(remove);
      if(index){const move=document.createElement("button");move.type="button";move.textContent="Swap with prior time slot";move.addEventListener("click",()=>{capture();const prior=table.blocks[index-1],current=table.blocks[index];[prior.startTime,current.startTime]=[current.startTime,prior.startTime];[prior.endTime,current.endTime]=[current.endTime,prior.endTime];table.blocks.sort((a,b)=>a.startTime.localeCompare(b.startTime));changed();renderTable()});buttons.append(move)}
      row.append(buttons);
      const fields=document.createElement("div");fields.className="planningBlockFields";fields.append(...row.children);row.append(fields);
      const summary=document.createElement("summary"),time=document.createElement("time"),name=document.createElement("span");
      const updateSummary=()=>{const values=row.querySelectorAll("input,select");time.textContent=`${values[4].value}–${values[5].value}`;name.textContent=values[2].value||source.classes.find(c=>c.id===values[3].value)?.name||values[1].selectedOptions[0]?.textContent||"New block"};
      summary.append(time,name);row.prepend(summary);updateSummary();row.addEventListener("input",updateSummary);row.addEventListener("change",updateSummary);el("planningBlocks").append(row);
    });
  }
  function renderDay(result) {
    const {day,changes}=result;
    el("planningDayHeading").textContent=`${day.date} · ${day.status} · ${day.cycle.dayColor||"No group"}${day.cycle.cycleDay?" / Cycle "+day.cycle.cycleDay:""} · ${day.timetable?.name||"Existing class times / calendar rules"}`;
    el("planningDayRows").replaceChildren();
    for(const row of day.rows){const node=document.createElement("div");node.className="planningRow";const time=document.createElement("time");time.textContent=`${row.startTime}–${row.endTime}`;const content=document.createElement("div"),name=document.createElement("b");name.textContent=row.name;content.append(name);const subtitle=document.createElement("div");subtitle.className="muted";subtitle.textContent=row.kind==="class"?[row.period?`Period ${row.period.replace("BISON-","Bison ")}`:"Daily entry",row.className!==row.name?row.className:""] .filter(Boolean).join(" · "):row.kind;content.append(subtitle);
      for(const event of row.automations){const action=document.createElement("div");action.className="muted";action.textContent=`${event.time}${event.dayOffset?" ("+(event.dayOffset>0?"+":"")+event.dayOffset+" day)":""} · ${event.name}${event.suppressed?" · suppressed":""}`;content.append(action)}node.append(time,content);el("planningDayRows").append(node)}
    if(!day.rows.length)el("planningDayRows").textContent="No class occurrences on this date.";
    for(const event of day.fixedAutomations||[]){const node=document.createElement("p");node.textContent=`${event.time}  ·  ${event.name}  ·  fixed clock time${event.suppressed?"  ·  suppressed":""}`;el("planningDayRows").append(node)}
    el("planningWarnings").replaceChildren();
    const notices=[...day.warnings];if(day.automationSuppressed)notices.unshift("Scheduled classroom automations are suppressed on this date.");if(!p().enabled)notices.unshift("Planning is off. The saved legacy resolver remains active until you enable and save the reviewed plan.");
    for(const warning of notices){const node=document.createElement("div");node.className="planningNotice";node.textContent=warning;el("planningWarnings").append(node)}
    el("planningChanges").replaceChildren();for(const item of changes){const node=document.createElement("p");node.textContent=`${item.date}: ${item.before.status} / ${item.before.cycle||"—"} / ${item.before.timetable} → ${item.after.status} / ${item.after.cycle||"—"} / ${item.after.timetable}`;el("planningChanges").append(node)}
    if(!changes.length)el("planningChanges").textContent="No resolved day changes within this 14-day preview. Review separately for dates outside this window.";
  }
  async function preview(forSave=true) {
    if(!draft)return;
    if(busy){pendingPreview=forSave;return}
    try{
      busy=true;capture();const submitted=JSON.stringify(draft),date=el("planningDate").value,revision=editRevision;
      const data=await api("/api/v1/planning/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date,includeMonth:true,scheduleProfile:JSON.parse(submitted)})});
      if(revision!==editRevision||date!==el("planningDate").value){review=null;el("planningPublish").disabled=true;message("The draft changed while preview was loading. Preview again before saving.");return}
      if(data.monthDays){monthCache.set(date.slice(0,7),data.monthDays);renderMonth()}
      renderDay(data);review=forSave?{...data,draft:submitted}:null;el("planningPublish").disabled=!review;
      message(forSave?"Preview ready. Review the date, warnings, and subsequent rotation changes before saving. No device commands were sent.":"Date preview only. Editing date fields requires Add / update date in draft, then Preview changes.");
    }catch(error){review=null;el("planningPublish").disabled=true;message(error.message,true)}
    finally{busy=false;if(pendingPreview!==null){const next=pendingPreview;pendingPreview=null;preview(next)}}
  }
  window.loadPlanning=async(force=false)=>{
    if(saving)return;
    if(dirty&&!force){message("Your unsaved planning draft is preserved. Use Reload saved plan to discard it.");return}
    const generation=++loadGeneration;let revision=editRevision;
    try{const result=await api("/api/v1/planning");
      if(generation!==loadGeneration)return;
      if(revision!==editRevision||saving){message("Your newer planning edits were kept. Reload again to discard them.");return}
      source=result;importGeneration++;todayGeneration++;monthCache.clear();draft=clone(source.scheduleProfile);snapshot=draft.updatedAt;draft.planning ||= {enabled:false,startDate:"",endDate:"",weekdays:[1,2,3,4,5],defaultTimetableId:"",timetables:[],dates:{}};
      const imported=source.migration;el("planningImportStatus").hidden=!imported||["empty","preserved"].includes(imported.status);
      if(imported?.status==="imported")el("planningImportStatus").textContent=`Existing configuration imported automatically: ${imported.counts.classes} classes, ${imported.counts.automations} linked/existing automations retained, ${imported.counts.timetables} timetables, ${imported.counts.dates} calendar dates. ${draft.planning.enabled?"Planning is enabled.":"Your previous scheduler remains active until Planning is enabled and saved."} The original configuration is retained for recovery.${imported.retainedEmptyTemplates?" Empty schedules/rules remain in the compatibility settings.":""}`;
      else if(imported?.status==="blocked")el("planningImportStatus").textContent="Automatic import needs configuration review. Existing scheduling has been retained; no partial conversion was saved.";
      else if(imported?.status==="failed")el("planningImportStatus").textContent="Automatic import could not be committed. Existing scheduling has been retained. The import will retry on a later startup.";
      editRevision++;revision=editRevision;dirty=false;review=null;el("planningPublish").disabled=true;if(!el("planningDate").value)el("planningDate").value=source.today||new Date().toLocaleDateString("en-CA");renderRotation();renderTable();renderDate();await preview(false);
    }catch(error){if(generation===loadGeneration&&revision===editRevision&&!saving)message(error.message,true)}
  };
  el("planningReload").addEventListener("click",()=>{if(!dirty||confirm("Discard the unsaved Planning draft and reload saved settings?"))loadPlanning(true)});
  el("planningPreview").addEventListener("click",()=>preview());
  el("planningPublish").addEventListener("click",async()=>{
    if(!review||busy)return;capture();if(review.draft!==JSON.stringify(draft)){changed();return}
    const controls=[...el("planning").querySelectorAll("input,select,button")].map(node=>({node,disabled:node.disabled}));controls.forEach(({node})=>node.disabled=true);
    try{busy=saving=true;loadGeneration++;importGeneration++;todayGeneration++;const result=await api("/api/v1/planning",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({scheduleProfile:draft,expectedUpdatedAt:snapshot,previewHash:review.previewHash})});draft=clone(result.scheduleProfile);S.scheduleProfile=result.scheduleProfile;snapshot=draft.updatedAt;dirty=false;review=null;message("Planning saved. No commands were dispatched. Running occurrences keep their resolved boundaries; use Resume Scheduled State deliberately if needed.")}
    catch(error){review=null;message(error.message,true)}finally{busy=saving=false;controls.forEach(({node,disabled})=>node.disabled=disabled);el("planningPublish").disabled=true}
  });
  for(const name of ["Calendar","Timetable","Rotation"])el(`planning${name}Tab`).addEventListener("click",()=>pane(name));
  el("planningDate").addEventListener("input",()=>todayGeneration++);
  el("planningDate").addEventListener("change",()=>{if(draft)selectDate(el("planningDate").value)});
  el("planningStageDate").addEventListener("click",()=>{if(!draft)return;capture();const key=el("planningDate").value;if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return message("Choose a valid date",true);p().dates[key]={status:el("planningDayStatus").value,cycleDay:el("planningCycleOverride").value,timetableId:el("planningDayTimetable").value,note:el("planningDayNote").value};changed();renderMonth();preview(false)});
  el("planningRemoveDate").addEventListener("click",()=>{if(draft){delete p().dates[el("planningDate").value];changed();renderDate();preview(false)}});
  el("planningPreset").addEventListener("click",()=>{if(!draft)return;capture();Object.assign(draft,clone(source.preset));changed();renderRotation();renderDate();message("A–H / Green / White / Bison mapping staged. Set an anchor, choose whether to enable Planning, and preview before saving.")});
  el("planningTableSelect").addEventListener("change",event=>{if(draft){capture();selectedTable=event.target.value;renderTable()}});
  function newTable(table){capture();p().timetables.push(table);selectedTable=table.id;changed();renderTable();renderDate()}
  el("planningTableNew").addEventListener("click",()=>{if(draft)newTable({id:uid("table"),name:"New timetable",blocks:[{id:uid("block"),kind:"class",period:"1",classId:"",label:"Period 1",startTime:"08:00",endTime:"09:00",cycleDays:[]}]})});
  el("planningTableImport").addEventListener("click",()=>{if(!draft)return;const blocks=source.classes.map(cls=>({id:uid("block"),kind:"class",period:cls.period||"",classId:cls.id,label:cls.name,startTime:cls.startTime,endTime:cls.endTime,cycleDays:[]}));if(!blocks.length)return message("Create classes before copying their times.",true);newTable({id:uid("table"),name:"Existing class times",blocks})});
  el("planningTableCopy").addEventListener("click",()=>{if(!draft)return;capture();const table=p().timetables.find(item=>item.id===selectedTable);if(table)newTable({...clone(table),id:uid("table"),name:`${table.name} copy`})});
  el("planningTableRemove").addEventListener("click",()=>{if(!draft)return;capture();if(p().defaultTimetableId===selectedTable||Object.values(p().dates).some(date=>date.timetableId===selectedTable))return message("Reassign dates and the regular timetable before removing this timetable.",true);const table=p().timetables.find(item=>item.id===selectedTable);if(table&&confirm(`Remove timetable "${table.name}" from the draft?`)){p().timetables=p().timetables.filter(item=>item!==table);changed();renderTable();renderDate()}});
  el("planningBlockAdd").addEventListener("click",()=>{capture();const table=p().timetables.find(item=>item.id===selectedTable);if(table){table.blocks.push({id:uid("block"),kind:"class",period:"",classId:"",label:"",startTime:"09:00",endTime:"10:00",cycleDays:[]});changed();renderTable()}});
  const calendarTools=document.createElement("div");calendarTools.className="toolbar";el("planningMonth").before(calendarTools);
  for(const [label,offset]of [["← Previous month",-1],["Today",0],["Next month →",1]]){const button=document.createElement("button");button.type="button";button.textContent=label;button.addEventListener("click",()=>{if(!draft||saving)return;if(!offset)return selectToday();const date=new Date(`${el("planningDate").value}T12:00:00`);date.setDate(1);date.setMonth(date.getMonth()+offset);selectDate(`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-01`)});calendarTools.append(button)}
  const rangeButton=document.createElement("button");rangeButton.type="button";rangeButton.textContent="Apply to a date range";el("planningStageDate").after(rangeButton);
  rangeButton.addEventListener("click",()=>{
    if(!draft)return;todayGeneration++;capture();const dialog=document.createElement("dialog");dialog.className="studioDialog";const body=document.createElement("div");body.className="studioDialogBody";const heading=document.createElement("h2");heading.textContent="Apply this day setup to a range";heading.id="planningRangeHeading";dialog.setAttribute("aria-labelledby",heading.id);body.append(heading);
    const hint=document.createElement("p");hint.textContent="Applies the selected status, timetable, note and optional fixed cycle letter to each chosen date. Everything stays in your draft until reviewed and saved.";body.append(hint);
    const start=input("First date",el("planningDate").value,"date"),end=input("Last date",el("planningDate").value,"date"),weekends=input("Include weekends","","checkbox");body.append(start.wrapper,end.wrapper,weekends.wrapper);
    const status=document.createElement("p");status.setAttribute("role","status");body.append(status);const tools=document.createElement("div");tools.className="toolbar";body.append(tools);
    for(const [name,fn]of [["Cancel",()=>dialog.close()],["Stage dates",()=>{try{if(!start.field.value||!end.field.value||start.field.value>end.field.value)throw Error("Choose a valid date range");const cursor=new Date(`${start.field.value}T12:00:00`),last=new Date(`${end.field.value}T12:00:00`);if((last-cursor)/86400000>366)throw Error("Choose at most one school year at a time");let count=0;while(cursor<=last){if(weekends.field.checked||p().weekdays.includes(cursor.getDay())){const date=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,"0")}-${String(cursor.getDate()).padStart(2,"0")}`;p().dates[date]={status:el("planningDayStatus").value,cycleDay:el("planningCycleOverride").value,timetableId:el("planningDayTimetable").value,note:el("planningDayNote").value};count++}cursor.setDate(cursor.getDate()+1)}changed();renderMonth();dialog.close();message(`${count} dates staged. Preview affected dates and save to apply.`)}catch(error){status.textContent=error.message}}]]){const button=document.createElement("button");button.type="button";button.textContent=name;button.addEventListener("click",fn);tools.append(button)}
    dialog.append(body);document.body.append(dialog);dialog.addEventListener("close",()=>dialog.remove());dialog.showModal();
  });
  el("planning").addEventListener("input",event=>{if(draft&&!['planningDate'].includes(event.target.id))changed()});
  el("planning").addEventListener("change",event=>{if(draft&&event.target.matches("select")&&event.target.id!=="planningTableSelect")changed()});
  el("planningImport").addEventListener("change",async event=>{
    const file=event.target.files?.[0],owner=draft,revision=editRevision,generation=++importGeneration;
    try{if(!draft||saving||!file)return;if(file.size>256*1024)throw Error("Calendar CSV must be at most 256 KiB");
      const text=(await file.text()).replace(/^\uFEFF/,"");
      if(generation!==importGeneration||owner!==draft)return;
      if(revision!==editRevision||saving){message("The draft changed while the calendar file was loading. Import it again to apply its dates.",true);return}
      const rows=[];let row=[],field="",quoted=false;
      for(let i=0;i<text.length;i++){const char=text[i];if(char==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(!quoted&&(char===','||char==='\n')){row.push(field.trim());field="";if(char==='\n'){if(row.some(Boolean))rows.push(row);row=[]}}else if(char!=='\r')field+=char}
      if(quoted)throw Error("Unclosed CSV quote");row.push(field.trim());if(row.some(Boolean))rows.push(row);
      const header=rows.shift();if(!header||header.join(',')!=="date,status,cycleDay,timetableId,note")throw Error("CSV header must be date,status,cycleDay,timetableId,note");if(rows.length>2000)throw Error("At most 2000 CSV rows are supported");
      const next=clone(p().dates),seen=new Set();let replacements=0;
      for(const values of rows){if(values.length!==5)throw Error("Every calendar row must have five columns");const [date,status,cycleDay,timetableId,note]=values;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(`${date}T12:00:00Z`).toISOString().slice(0,10)!==date||!["school","no-school","remote"].includes(status)||seen.has(date))throw Error(`Invalid or duplicate CSV date/status: ${date}`);if(cycleDay&&!draft.cycleDays.includes(cycleDay))throw Error(`${date}: unknown cycle day`);if(timetableId&&!p().timetables.some(table=>table.id===timetableId))throw Error(`${date}: unknown timetable`);seen.add(date);if(Object.hasOwn(next,date))replacements++;next[date]={status,cycleDay,timetableId,note}}
      p().dates=next;changed();renderDate();el("planningImportSummary").textContent=`${rows.length} dates staged; ${replacements} existing overrides replaced in draft. Preview and save to apply.`;
    }catch(error){if(generation===importGeneration&&owner===draft)message(error.message,true)}finally{if(event.target.files?.[0]===file)event.target.value=""}
  });
  // Navigation shares the existing class/automation nodes and handlers.
  for(const [id,current] of [["planning","planning"],["classes","classes"],["schedules","schedules"]]){
    const nav=document.createElement("div");nav.className="planningTabs";nav.setAttribute("aria-label","Planning workspace");
    for(const [target,label] of [["planning","Calendar & Timetables"],["classes","Classes"],["schedules","Automations"]]){const button=document.createElement("button");button.type="button";button.textContent=label;button.dataset.planningPage=target;if(target===current)button.setAttribute("aria-current","page");button.addEventListener("click",()=>showPage(target));nav.append(button)}el(id).prepend(nav);
  }
  const datalist=document.createElement("datalist");datalist.id="planningPeriodKeys";for(const key of [...Array.from({length:8},(_,i)=>String(i+1)),...Array.from({length:8},(_,i)=>`BISON-${i+1}`)])option(datalist,key,key);el("classes").append(datalist);
  function disclosure(parent,label,nodes,open=false){const details=document.createElement("details"),summary=document.createElement("summary");details.className="panel workspaceDisclosure";details.open=open;summary.textContent=label;details.append(summary);parent.insertBefore(details,nodes[0]);const content=document.createElement("div");content.className="disclosureBody";details.append(content);nodes.forEach(node=>content.append(node));return details}
  const classParent=el("className").closest(".panel"),fallbackNodes=["classContinuationOf","classStart","classEnd"].map(id=>el(id).closest("label"));
  const fallback=document.createElement("details"),fallbackSummary=document.createElement("summary"),fallbackContent=document.createElement("div");fallbackSummary.textContent="Fallback times & timer continuation";fallbackContent.className="grid2";fallbackNodes.forEach(node=>fallbackContent.append(node));fallback.append(fallbackSummary,fallbackContent);classParent.insertBefore(fallback,el("classNotes").closest("label"));
  const editor=el("automationEditorTitle").closest(".panel"),whenStart=el("autoName").closest(".grid2"),whenEnd=el("scheduleModeFields");
  const whenNodes=[];for(let node=whenStart;node;node=node.nextElementSibling){whenNodes.push(node);if(node===whenEnd)break}disclosure(editor,"1 · When should it run?",whenNodes,true);
  const actionStart=el("autoAction").closest(".grid2"),actionEnd=el("autoActionSteps").closest(".panel"),actionNodes=[];
  for(let node=actionStart;node;node=node.nextElementSibling){actionNodes.push(node);if(node===actionEnd)break}disclosure(editor,"2 · Actions & targets",actionNodes,true);
  const timerPanel=el("autoTimerOverlayEnabled").closest(".panel");disclosure(editor,"3 · Timer overlay (optional)",[timerPanel],false);
  const previewLabel=document.createElement("label");previewLabel.textContent="Preview linked classes on date";const dateField=document.createElement("input");dateField.id="autoPlanningDate";dateField.type="date";previewLabel.append(dateField);el("autoClassBindingFields").append(previewLabel);
  let previewSerial=0,previewTimer=null;
  const originalClassPreview=window.updateAutomationClassPreview;
  window.updateAutomationClassPreview=function(){
    originalClassPreview();clearTimeout(previewTimer);const serial=++previewSerial;
    if(!S.scheduleProfile?.planning?.enabled||!selectedAutomationClassIds().length)return;
    const ids=selectedAutomationClassIds(),reference=el("autoClassRef").value,offset=Number(el("autoClassOffset").value)||0,date=dateField.value;
    el("autoClassPreview").textContent="Resolving saved timetable…";
    previewTimer=setTimeout(async()=>{
      try{const result=await api(`/api/v1/planning/day${date?"?date="+encodeURIComponent(date):""}`);if(serial!==previewSerial)return;el("autoClassPreview").replaceChildren();
        if(result.day.automationSuppressed){el("autoClassPreview").textContent=`${result.day.date}: scheduled classroom actions are suppressed.`;return}
        const rows=result.day.rows.filter(row=>ids.includes(row.classId));
        for(const row of rows){
          const node=document.createElement("div"),base=reference==="end"?row.endTime:row.startTime,[h,m]=base.split(":").map(Number),raw=h*60+m+offset,value=((raw%1440)+1440)%1440,dayOffset=Math.floor(raw/1440);
          const dispatchDate=new Date(`${result.day.date}T12:00:00Z`);dispatchDate.setUTCDate(dispatchDate.getUTCDate()+dayOffset);
          node.textContent=`${dispatchDate.toISOString().slice(0,10)} · ${row.name} → ${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")} · segment ${dayOffset?result.day.date+" ":""}${row.startTime}–${row.endTime}`;
          el("autoClassPreview").append(node);
        }
        if(!rows.length)el("autoClassPreview").textContent=`${result.day.date}: none of these classes occur in the saved day plan.`;
      }catch(error){if(serial===previewSerial)el("autoClassPreview").textContent=`Day preview unavailable: ${error.message}`}
    },150);
  };
  dateField.addEventListener("change",()=>updateAutomationClassPreview());
  function permissions(){for(const button of document.querySelectorAll("[data-planning-page]")){const allowed=button.dataset.planningPage==="schedules"?userCan("schedule.manage")&&userCan("automation.manage"):userCan("schedule.manage");button.hidden=!allowed}}
  window.addEventListener("roomgoblin:authchange",permissions);permissions();
})();
