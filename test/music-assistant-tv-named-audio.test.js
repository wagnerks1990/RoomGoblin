"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n"),a=source.indexOf("function musicAssistantTvDeviceIdFromPlayerId("),b=source.indexOf("\nfunction musicAssistantTvAudioState",a);assert.ok(a>0&&b>a);
const devices={tv1:{enabled:true},"front-screen":{enabled:true},"lab.monitor_2":{},disabled:{enabled:false},["a".repeat(80)]:{enabled:true}};
function lookup(value){const c=vm.createContext({devices});vm.runInContext(source.slice(a,b),c);return c.musicAssistantTvDeviceIdFromPlayerId(value)}
for(const id of ["tv1","front-screen","lab.monitor_2","a".repeat(80)])test("TV audio maps configured stable receiver "+id,()=>{assert.equal(lookup("classroom-hub-"+id),id)});
test("legacy case-insensitive prefix remains compatible",()=>{assert.equal(lookup("CLASSROOM-HUB-TV1"),"tv1")});
for(const id of ["classroom-hub-tv9","classroom-hub-disabled","speaker","roomgoblin-front-screen","classroom-hub-constructor","classroom-hub-__proto__","classroom-hub-front-screen ","classroom-hub-","",null])test("TV audio rejects unconfigured or unrelated player "+id,()=>{assert.equal(lookup(id),null)});
