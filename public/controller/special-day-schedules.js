"use strict";

const specialDayEditor = (() => {
  const el = id => document.getElementById(id);
  let schedules = [], classes = [], selected = "", loaded = null;
  function capture() {
    const schedule = schedules.find(item => item.id === selected);
    if (!schedule) return;
    schedule.name = el("specialDayName").value.trim();
    schedule.dates = [...new Set(el("specialDayDates").value.split(/[\s,]+/).filter(Boolean))];
    for (const row of el("specialDayRows").querySelectorAll("[data-class-id]")) {
      const [include, start, end] = row.querySelectorAll("input");
      if (include.checked) Object.defineProperty(schedule.classTimes,row.dataset.classId,{value:{startTime:start.value,endTime:end.value},enumerable:true,writable:true,configurable:true});
      else delete schedule.classTimes[row.dataset.classId];
    }
  }
  function render() {
    const select = el("specialDaySelect");
    select.replaceChildren();
    for (const schedule of schedules) {
      const option = document.createElement("option");
      option.value = schedule.id; option.textContent = schedule.name || "Unnamed timetable";
      select.append(option);
    }
    select.value = selected;
    const schedule = schedules.find(item => item.id === selected);
    el("specialDayFields").hidden = !schedule;
    el("specialDayDelete").disabled = !schedule;
    el("specialDayRows").replaceChildren();
    if (!schedule) return;
    el("specialDayName").value = schedule.name;
    el("specialDayDates").value = schedule.dates.join("\n");
    // Keep unavailable class IDs in the draft; deleting a class is not permission
    // to silently remove it from a saved timetable.
    const known = new Set(classes.map(item => item.id));
    const rows = [...classes, ...Object.keys(schedule.classTimes).filter(id => !known.has(id)).map(id => ({id,name:`Unavailable class (${id})`}))];
    for (const cls of rows) {
      const row = document.createElement("div"); row.className = "toolbar"; row.dataset.classId = cls.id;
      const label = document.createElement("label"), include = document.createElement("input");
      include.type = "checkbox"; include.checked = Object.hasOwn(schedule.classTimes,cls.id);
      label.append(include, document.createTextNode(` ${cls.name} (period ${cls.period || "unset"}) `));
      row.append(label);
      const times = Object.hasOwn(schedule.classTimes,cls.id) ? schedule.classTimes[cls.id] : cls;
      for (const [field, text] of [["startTime","start"],["endTime","end"]]) {
        const input = document.createElement("input"); input.type = "time"; input.value = times[field] || "";
        input.setAttribute("aria-label",`${cls.name} special ${text} time`); row.append(input);
      }
      el("specialDayRows").append(row);
    }
  }
  el("specialDaySelect").addEventListener("change",event => {capture();selected=event.target.value;render()});
  el("specialDayNew").addEventListener("click",() => {
    capture(); selected = `day-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    schedules.push({id:selected,name:"Special day",dates:[],classTimes:{}}); render();
  });
  el("specialDayDelete").addEventListener("click",() => {
    const schedule = schedules.find(item => item.id === selected);
    if (!schedule || !confirm(`Remove timetable "${schedule.name}" and its date assignments? Normal calendar rules will apply on those dates after saving.`)) return;
    schedules = schedules.filter(item => item.id !== selected); selected = schedules[0]?.id || ""; render();
  });
  return {
    load(items, availableClasses) {
      const fingerprint = JSON.stringify(items);
      if (loaded === fingerprint) capture();
      else {schedules = structuredClone(items); loaded = fingerprint}
      classes = availableClasses;
      if (!schedules.some(item => item.id === selected)) selected = schedules[0]?.id || "";
      render();
    },
    value() {capture(); return structuredClone(schedules)}
  };
})();
