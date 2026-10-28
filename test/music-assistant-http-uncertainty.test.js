"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),http=require("node:http");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8").replace(/\r\n/g,"\n"),a=source.indexOf("async function musicAssistantHttpCommand("),b=source.indexOf("\n\n\n//",a);assert.ok(a>0&&b>a);
function fixture(fetch,overrides={}){
 const c=vm.createContext({fetch,AbortSignal,maApiGeneration:0,musicAssistantCommandTimeout:()=>15000,musicAssistantConfig:()=>({url:"http://fixture.invalid"}),musicAssistantToken:()=>"fixture-token",musicAssistantApiRawCommand:async()=>{throw Error("unsent")},diagnosticError(){},...overrides});vm.runInContext(source.slice(a,b),c);return c;
}
for(const kind of ["lost response","lost body","invalid response"])for(const fallback of [false,true])test((fallback?"fallback":"HTTP")+" mutation retains uncertainty after "+kind,async()=>{
 const c=fixture(async()=>{if(kind==="lost response")throw Error("network lost");return {ok:true,status:200,text:async()=>{if(kind==="lost body")throw Error("body lost");return "not-json"}}});
 await assert.rejects(()=>c[fallback?"musicAssistantCommand":"musicAssistantHttpCommand"]("players/cmd/volume_set",{player_id:"fixture",volume_level:20}),e=>e.mayHaveExecuted===true&&!e.message.includes("not-json"));
});
test("explicit upstream API rejection remains a known failure",async()=>{
 for(const body of [{error:"rejected"},{error_code:2,details:"rejected"}]){
  const c=fixture(async()=>({ok:true,status:200,text:async()=>JSON.stringify(body)}));
  await assert.rejects(()=>c.musicAssistantCommand("players/cmd/volume_set",{}),e=>!e.mayHaveExecuted&&e.message.includes("rejected"));
 }
});
test("unexplained HTTP failure remains uncertain",async()=>{
 const c=fixture(async()=>({ok:false,status:503,text:async()=>"null"}));
 await assert.rejects(()=>c.musicAssistantCommand("players/cmd/volume_set",{}),e=>e.mayHaveExecuted===true&&e.message.includes("503"));
});
test("successful null HTTP result is still accepted",async()=>{
 const c=fixture(async()=>({ok:true,status:200,text:async()=>"null"}));assert.equal(await c.musicAssistantCommand("players/cmd/volume_set",{}),null);
});
test("payload serialization fails before dispatch without uncertainty",async()=>{
 let calls=0;const c=fixture(async()=>{calls++;throw Error("unexpected")}),args={};args.self=args;
 await assert.rejects(()=>c.musicAssistantHttpCommand("players/cmd/volume_set",args),e=>!e.mayHaveExecuted);assert.equal(calls,0);
});
test("invalid local configuration fails before dispatch without uncertainty",async()=>{
 let calls=0;const c=fixture(async()=>{calls++;throw Error("unexpected")},{musicAssistantConfig:()=>{throw Error("invalid local settings")}});
 await assert.rejects(()=>c.musicAssistantHttpCommand("players/cmd/volume_set",{}),e=>!e.mayHaveExecuted);assert.equal(calls,0);
});
test("actual accepted HTTP request with lost response remains uncertain and is sent once",async t=>{
 let calls=0;const server=http.createServer((req,res)=>{calls++;req.resume();req.on("end",()=>res.destroy())}).listen(0,"127.0.0.1");
 await new Promise(resolve=>server.once("listening",resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve)}));
 const c=fixture(fetch,{musicAssistantConfig:()=>({url:`http://127.0.0.1:${server.address().port}`})});
 await assert.rejects(()=>c.musicAssistantCommand("players/cmd/volume_set",{player_id:"fixture",volume_level:20}),e=>e.mayHaveExecuted===true);assert.equal(calls,1);
});
