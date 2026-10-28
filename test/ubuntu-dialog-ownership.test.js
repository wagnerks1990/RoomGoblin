"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../public/managed-displays/ubuntu.js"),"utf8");
function fixture(){
 const handlers={},nodes={},calls=[],messages=new Map();
 const $=id=>nodes[id]??=( {value:"",checked:false,disabled:false,open:true,textContent:"",close(){this.open=false},addEventListener(name,handler){handlers[id+":"+name]=handler}} );
 for(const [id,value]of Object.entries({ubuntuDetailName:"Submitted",ubuntuDetailLocation:"Room",ubuntuDetailAddress:"10.0.0.8",ubuntuDetailPort:"22",ubuntuDetailNotes:"Note",ubuntuOperation:"check-updates",ubuntuMaintenanceWhen:"now",ubuntuScheduleAt:"2027-01-01T21:00"}))$(id).value=value;
 $("ubuntuMaintenanceConfirm").checked=true;
 const ctx=vm.createContext({$,dialogVersion:1,detailsDevice:"one",maintenanceDevice:"one",pendingCommands:new Set(),render(){},computerMessage:(id,text)=>messages.set(id,text),load:async()=>true,
  request(url,method,body){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});calls.push({url,method,body:JSON.parse(JSON.stringify(body)),resolve,reject});return promise}});
 const start=source.includes("function maintenanceDraft(")?source.indexOf("function maintenanceDraft("):source.indexOf('$("ubuntuMaintenanceForm").addEventListener("submit"');
 vm.runInContext(source.slice(start,source.indexOf('$("ubuntuSearch").addEventListener')),ctx);
 return {ctx,nodes,$,calls,messages,submit:kind=>handlers["ubuntu"+kind+"Form:submit"]({preventDefault(){}})};
}
test("Ubuntu metadata completion preserves a newer unsaved dialog draft",async()=>{
 const h=fixture(),run=h.submit("Details");h.$("ubuntuDetailName").value="Newer draft";h.calls[0].resolve({ok:true});await run;
 assert.equal(h.$("ubuntuDetails").open,true);assert.equal(h.$("ubuntuDetailName").value,"Newer draft");assert.match(h.$("ubuntuDetailsMessage").textContent,/newer edits/i);assert.equal(h.$("ubuntuDetailsSubmit").disabled,false);
});
test("Ubuntu maintenance acceptance preserves newer choices without submitting them",async()=>{
 const h=fixture(),run=h.submit("Maintenance");h.$("ubuntuOperation").value="update-os";h.calls[0].resolve({ok:true});await run;
 assert.equal(h.$("ubuntuMaintenance").open,true);assert.equal(h.calls.length,1);assert.equal(h.calls[0].body.operation,"check-updates");assert.match(h.$("ubuntuMaintenanceMessage").textContent,/newer choices/i);
});
for(const kind of ["Details","Maintenance"])test(`Ubuntu ${kind} cannot submit twice while its accepted request is pending`,async()=>{
 const h=fixture(),one=h.submit(kind),two=h.submit(kind);assert.equal(h.calls.length,1);h.calls[0].resolve({ok:true});await Promise.all([one,two]);assert.equal(h.$("ubuntu"+kind).open,false);
});
test("a reopened Ubuntu dialog cannot bypass an existing request for that computer",async()=>{
 const h=fixture(),one=h.submit("Details");h.ctx.dialogVersion++;h.$("ubuntuDetailName").value="Reopened draft";
 const two=h.submit("Details");assert.equal(h.calls.length,1);h.calls[0].resolve({ok:true});await Promise.all([one,two]);assert.equal(h.$("ubuntuDetails").open,true);assert.equal(h.$("ubuntuDetailName").value,"Reopened draft");
});
test("an older Ubuntu dialog completion cannot close a newer computer's editor",async()=>{
 const h=fixture(),one=h.submit("Details");h.ctx.dialogVersion++;h.ctx.detailsDevice="two";h.$("ubuntuDetailName").value="Second";
 const two=h.submit("Details");assert.equal(h.calls.length,2);h.calls[0].resolve({ok:true});await one;assert.equal(h.$("ubuntuDetails").open,true);assert.equal(h.$("ubuntuDetailsSubmit").disabled,true);
 h.calls[1].resolve({ok:true});await two;assert.equal(h.$("ubuntuDetails").open,false);
});
for(const kind of ["Details","Maintenance"])test(`Ubuntu ${kind} rejection preserves its draft and permits an explicit retry`,async()=>{
 const h=fixture(),one=h.submit(kind);h.calls[0].reject(Error("fixture rejection"));await one;
 assert.equal(h.$("ubuntu"+kind).open,true);assert.equal(h.$("ubuntu"+kind+"Submit").disabled,false);assert.match(h.$("ubuntu"+kind+"Message").textContent,/fixture rejection/);
 const two=h.submit(kind);assert.equal(h.calls.length,2);h.calls[1].resolve({ok:true});await two;
});
for(const kind of ["Details","Maintenance"])test(`closed Ubuntu ${kind} requests report failures on their original computer`,async()=>{
 const h=fixture(),one=h.submit(kind);h.ctx.dialogVersion++;h.calls[0].reject(Error("delivery unconfirmed"));await one;
 assert.equal(h.messages.get("one"),"delivery unconfirmed");assert.equal(h.ctx.pendingCommands.size,0);assert.equal(h.$("ubuntu"+kind+"Message").textContent,"");
});
