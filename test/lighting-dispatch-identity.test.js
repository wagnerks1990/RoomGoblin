"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
const start=source.indexOf("function colorParts("),end=source.indexOf("function plutoBuild(",start);
function fixture(){let resolve;const calls=[];const gate=new Promise(r=>resolve=r);
 const ctx=vm.createContext({goveeDevices:{one:{id:"0011223344556677",name:"One"},two:{id:"8899AABBCCDDEEFF",name:"Two"}},goveeGroups:{all:["one","two"]},cleanId:String,runtime:{hardware:{govee:{}}},mqttPublish:async(topic,payload)=>{calls.push({topic,payload});if(calls.length===1)await gate},audit(){},diagnosticError(){}});
 vm.runInContext(source.slice(start,end),ctx);ctx.goveeUdpTemperature=async(device,kelvin)=>{calls.push({udp:{...device},kelvin});if(calls.length===1)await gate;return{method:"fixture-udp"}};return{ctx,calls,resolve};
}
test("inherited names are not dispatch targets",async()=>{
 const h=fixture();h.resolve();await assert.rejects(h.ctx.directGoveeCommand("constructor","on",{}),/Unknown/);assert.equal(h.calls.length,0);
});
test("invalid later group members reject before the first command",async()=>{
 const h=fixture();h.ctx.goveeGroups.all.push("missing");h.resolve();await assert.rejects(h.ctx.directGoveeCommand("all","on",{}),/Unknown/);assert.equal(h.calls.length,0);
});
test("a group command cannot follow a changed alias to different hardware",async()=>{
 const h=fixture(),pending=h.ctx.directGoveeCommand("all","on",{});assert.equal(h.calls.length,1);h.ctx.goveeDevices.two={id:"AABBCCDDEEFF0011",name:"Replacement"};h.resolve();
 await assert.rejects(pending,/changed|removed/i);assert.equal(h.calls.length,1);
});

const plain=value=>JSON.parse(JSON.stringify(value));
for(const alias of ["__proto__","toString"])test(`inherited alias ${alias} never dispatches`,async()=>{
 const h=fixture();h.resolve();await assert.rejects(h.ctx.directGoveeCommand(alias,"on"),/Unknown/);assert.equal(h.calls.length,0);
});
for(const value of [null,{}, {id:""},{id:22}])test(`invalid group device ${JSON.stringify(value)} rejects before delivery`,async()=>{
 const h=fixture();h.ctx.goveeDevices.two=value;h.resolve();await assert.rejects(h.ctx.directGoveeCommand("all","on"),/Unknown/);assert.equal(h.calls.length,0);
});
test("inherited group members reject before any command",async()=>{
 const h=fixture();h.ctx.goveeGroups.all.push("constructor");h.resolve();await assert.rejects(h.ctx.directGoveeCommand("all","on"),/Unknown/);assert.equal(h.calls.length,0);
});
test("a removed later target stops the remaining batch without replay",async()=>{
 const h=fixture(),run=h.ctx.directGoveeCommand("all","off");delete h.ctx.goveeDevices.two;h.resolve();
 await assert.rejects(run,/removed; remaining commands were not sent/);assert.equal(h.calls.length,1);
});
test("in-place physical identity replacement cannot redirect an accepted command",async()=>{
 const h=fixture(),run=h.ctx.directGoveeCommand("all","on");h.ctx.goveeDevices.two.id="AABBCCDDEEFF0011";h.resolve();
 await assert.rejects(run,/changed/);assert.equal(h.calls.length,1);
});
for(const change of ["address","transport"])test(`native temperature ${change} change stops before a different destination is used`,async()=>{
 const h=fixture();Object.assign(h.ctx.goveeDevices.two,{sku:"H618G",ip:"127.0.0.1"});
 const run=h.ctx.directGoveeCommand("all","temp",{kelvin:4200});
 if(change==="address")h.ctx.goveeDevices.two.ip="127.0.0.2";else h.ctx.goveeDevices.two.sku="Different";
 h.resolve();await assert.rejects(run,/changed/);assert.equal(h.calls.length,1);
});
test("a pending MQTT temperature target cannot silently become a native UDP target",async()=>{
 const h=fixture(),run=h.ctx.directGoveeCommand("all","temp",{kelvin:4200});Object.assign(h.ctx.goveeDevices.two,{sku:"H618G",ip:"127.0.0.1"});h.resolve();
 await assert.rejects(run,/changed/);assert.equal(h.calls.length,1);
});
test("metadata-only refresh preserves an accepted physical target and response label",async()=>{
 const h=fixture(),run=h.ctx.directGoveeCommand("all","on");h.ctx.goveeDevices.two={...h.ctx.goveeDevices.two,name:"New label"};h.resolve();
 const result=await run;assert.equal(result.count,2);assert.equal(h.calls[1].topic,"gv2mqtt/light/8899AABBCCDDEEFF/command");assert.equal(result.results[1].name,"Two");
});
test("accepted group members stay fixed when the group changes during delivery",async()=>{
 const h=fixture(),run=h.ctx.directGoveeCommand("all","on");h.ctx.goveeDevices.third={id:"AABBCCDDEEFF0011"};h.ctx.goveeGroups.all=["third"];h.resolve();
 assert.equal((await run).count,2);assert.deepEqual(h.calls.map(x=>x.topic),["gv2mqtt/light/0011223344556677/command","gv2mqtt/light/8899AABBCCDDEEFF/command"]);
});
test("accepted payload values stay fixed across an awaited target",async()=>{
 const h=fixture(),payload={level:25},run=h.ctx.directGoveeCommand("all","brightness",payload);payload.level=90;h.resolve();await run;
 assert.deepEqual(h.calls.map(x=>x.payload.brightness),[25,25]);
});
test("duplicate group aliases send once in their accepted order",async()=>{
 const h=fixture();h.ctx.goveeGroups.all=["two","one","two"];h.resolve();const result=await h.ctx.directGoveeCommand("all","off");
 assert.equal(result.count,2);assert.deepEqual(plain(result.results.map(x=>x.device)),["two","one"]);
});
test("a first transport rejection prevents later target writes and retries",async()=>{
 const h=fixture();h.ctx.mqttPublish=async(topic)=>{h.calls.push({topic});throw Error("delivery unconfirmed")};
 await assert.rejects(h.ctx.directGoveeCommand("all","on"),/unconfirmed/);assert.equal(h.calls.length,1);
});
for(const [action,payload,expected] of [["on",{},{state:"ON"}],["off",{},{state:"OFF"}],["brightness",{level:25.4},{state:"ON",brightness:25}],["color",{color:"#123456"},{state:"ON",color:{r:18,g:52,b:86}}],["temp",{kelvin:4200},{state:"ON",color_temp:238}],["scene",{scene:" Fixture "},{state:"ON",effect:"Fixture"}]])test(`${action} retains the existing MQTT payload`,async()=>{
 const h=fixture();h.resolve();const result=await h.ctx.directGoveeCommand("one",action,payload);assert.equal(result.count,1);assert.deepEqual(plain(h.calls[0].payload),expected);
});
test("native temperature retains its accepted IP, kelvin and device label",async()=>{
 const h=fixture();Object.assign(h.ctx.goveeDevices.one,{sku:"H618G",ip:"127.0.0.1"});h.resolve();
 const result=await h.ctx.directGoveeCommand("one","temp",{kelvin:4200});assert.equal(h.calls[0].udp.ip,"127.0.0.1");assert.equal(h.calls[0].kelvin,4200);assert.equal(result.results[0].name,"One");
});
for(const [action,payload] of [["brightness",{level:0}],["temp",{kelvin:10000}],["color",{color:"bad"}],["scene",{scene:" "}],["unknown",{}]])test(`invalid ${action} payload rejects the whole group before publication`,async()=>{
 const h=fixture();h.resolve();await assert.rejects(h.ctx.directGoveeCommand("all",action,payload));assert.equal(h.calls.length,0);
});
test("an explicitly configured prototype-shaped alias remains an ordinary target",async()=>{
 const h=fixture();Object.defineProperty(h.ctx.goveeDevices,"__proto__",{value:{id:"AABBCCDDEEFF0011",name:"Configured"},enumerable:true});h.resolve();
 assert.equal((await h.ctx.directGoveeCommand("__proto__","on")).count,1);assert.equal(h.calls[0].topic,"gv2mqtt/light/AABBCCDDEEFF0011/command");
});
test("scene lookup rejects inherited entries while retaining configured fallbacks",()=>{
 const h=fixture();Object.assign(h.ctx,{goveeLiveConfigs:{},goveeSceneFallback:{}});assert.throws(()=>h.ctx.goveeScenes("constructor"),/Unknown/);
 h.ctx.goveeDevices.one.sku="Fixture";h.ctx.goveeSceneFallback.Fixture=["Scene"];assert.deepEqual(plain(h.ctx.goveeScenes("one").scenes),["Scene"]);
});
test("status lookup rejects inherited entries without changing configured device reads",()=>{
 const h=fixture();let handler,status=200,response;Object.assign(h.ctx,{goveeStates:{},requireClassroomRead:()=>{},app:{get:(_path,...handlers)=>handler=handlers.at(-1)}});
 const a=source.indexOf('app.get("/api/v1/govee/:target/status"'),b=source.indexOf('app.get("/api/v1/govee/:target/scenes"',a);assert.ok(a>0&&b>a);
 vm.runInContext(source.slice(a,b),h.ctx);const res={status:value=>{status=value;return res},json:value=>response=value};
 handler({params:{target:"constructor"}},res);assert.equal(status,404);assert.equal(response.ok,false);
 status=200;handler({params:{target:"one"}},res);assert.equal(status,200);assert.equal(response.device,"one");assert.equal(response.meta.id,"0011223344556677");
});
