"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {bufferedVeyonFetch,readVeyonFrame,veyonResponseError}=require("../src/veyon-transport");
const jpeg=Buffer.from([255,216,255,224,0,2,255,217]);
const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
const errorResponse=(code,status)=>new Response(JSON.stringify({error:{code,message:"remote detail"}}),{status,headers:{"content-type":"application/json"}});

test("Veyon deadline covers a body stalled after successful headers",async()=>{
  const started=Date.now();
  await assert.rejects(bufferedVeyonFetch("http://example.invalid",{timeoutMs:25},async(_url,{signal})=>new Response(new ReadableStream({
    start(controller){signal.addEventListener("abort",()=>controller.error(new Error("aborted")),{once:true})}
  }))),/aborted/);
  assert.ok(Date.now()-started<1500);
});
test("Veyon body limits cover untrusted declared and streamed sizes",async()=>{
  await assert.rejects(bufferedVeyonFetch("http://example.invalid",{maxBytes:4},async()=>new Response("12345")),/size limit/);
  await assert.rejects(bufferedVeyonFetch("http://example.invalid",{maxBytes:4},async()=>new Response("x",{headers:{"content-length":"5"}})),/size limit/);
  const response=await bufferedVeyonFetch("http://example.invalid",{},async()=>new Response(jpeg));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),jpeg);
});
test("first framebuffer warms up on the same connection and returns actual image type",async()=>{
  let requests=0;const waits=[];
  const frame=await readVeyonFrame("format=jpeg",async()=>++requests<3?errorResponse(10,503):new Response(png),async ms=>waits.push(ms));
  assert.equal(requests,3);assert.deepEqual(waits,[200,400]);assert.equal(frame.contentType,"image/png");
});
test("unsupported JPEG retries PNG, but invalid images and permanent failures do not loop",async()=>{
  const urls=[];
  const frame=await readVeyonFrame("format=jpeg&quality=60&width=480",async url=>{urls.push(url);return urls.length===1?errorResponse(9,503):new Response(png)});
  assert.equal(frame.contentType,"image/png");assert.match(urls[1],/format=png/);assert.doesNotMatch(urls[1],/quality/);
  let calls=0;
  await assert.rejects(readVeyonFrame("format=jpeg",async()=>{calls++;return new Response("<html>Error</html>")}),/invalid screen image/);
  assert.equal(calls,1);
  await assert.rejects(readVeyonFrame("",async()=>errorResponse(6,401)),/authentication failed/);
});
test("unavailable framebuffer stops after three requests and returns actionable errors",async()=>{
  let calls=0;
  await assert.rejects(readVeyonFrame("",async()=>{calls++;return errorResponse(10,503)},async()=>{}),/not available yet/);
  assert.equal(calls,3);
  const error=await veyonResponseError(new Response("<html>private proxy error</html>",{status:502}));
  assert.equal(error.status,502);assert.doesNotMatch(error.message,/private proxy/);
});

const source=fs.readFileSync(require.resolve("../src/server"),"utf8");
function connectionHarness(json){
  const cache=new Map(),inFlight=new Map();
  const context=vm.createContext({
    veyonConnectionCache:cache,veyonAuthInFlight:inFlight,
    VEYON_POOL_MAX:4,VEYON_AUTH_RETRIES:1,VEYON_AUTHKEYS_UUID:"auth-key",VEYON_KEY_NAME:"fixture",
    veyonPrivateKey:()=>"test-only",veyonJson:json,
    setInterval:()=>({unref(){}}),setTimeout,Date,Map,Promise,encodeURIComponent
  });
  vm.runInContext(source.slice(source.indexOf("async function veyonCloseConnection("),source.indexOf("async function veyonAvailableFeatures(")),context);
  return {context,cache,inFlight};
}
test("parallel expired-session requests close old UID once and single-flight authentication",async()=>{
  let posts=0,deletes=0;
  const {context,cache}=connectionHarness(async(_path,options)=>{
    await new Promise(resolve=>setTimeout(resolve,5));
    if(options.method==="DELETE"){deletes++;return {}}
    posts++;return {"connection-uid":"fresh",validUntil:Math.floor(Date.now()/1000)+3600};
  });
  cache.set("fixture",{uid:"expired",validUntil:1,lastUsed:Date.now()});
  const uids=await Promise.all(Array.from({length:8},()=>context.veyonAuthenticate("fixture")));
  assert.equal(posts,1);assert.equal(deletes,1);assert.ok(uids.every(uid=>uid==="fresh"));
});
test("late close never deletes a newer UID and pool trimming protects active readers",async()=>{
  const {context,cache}=connectionHarness(async()=>({}));
  const old={uid:"old",lastUsed:1},fresh={uid:"fresh",lastUsed:2};
  cache.set("fixture",fresh);await context.veyonCloseConnection("fixture",old);assert.equal(cache.get("fixture"),fresh);
  cache.clear();
  cache.set("active",{uid:"busy",active:2,lastUsed:0});
  for(let i=0;i<4;i++)cache.set(`idle${i}`,{uid:`idle${i}`,lastUsed:i+1});
  await context.veyonTrimPool(1);
  assert.equal(cache.size,3);assert.equal(cache.get("active").uid,"busy");
});
test("connected image read refreshes an expired UID once and releases its lease",async()=>{
  let posts=0,reads=0;
  const {context,cache}=connectionHarness(async(_path,options)=>{
    if(options.method==="POST"){posts++;return {"connection-uid":"fresh",validUntil:Math.floor(Date.now()/1000)+3600}}
    return {};
  });
  cache.set("fixture",{uid:"expired",validUntil:Math.floor(Date.now()/1000)+3600,lastUsed:Date.now()});
  const response=await context.veyonConnectedRequest("fixture","/api/v1/framebuffer",{},async(_path,options)=>{
    reads++;assert.equal(cache.get("fixture").active,1);
    if(options.headers["Connection-Uid"]==="expired")throw await veyonResponseError(errorResponse(2,401));
    return new Response(jpeg);
  });
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),jpeg);assert.equal(reads,2);assert.equal(posts,1);assert.equal(cache.get("fixture").active,0);
});
test("authentication failure cannot be reported as a successfully authenticated computer",async()=>{
  const context=vm.createContext({veyonConnectedJson:async()=>{throw new Error("authentication denied")},veyonFeatureStatus:async()=>({active:false})});
  vm.runInContext(source.slice(source.indexOf("async function veyonComputerInfo("),source.indexOf("function veyonComputerId(")),context);
  await assert.rejects(context.veyonComputerInfo("fixture"),/authentication denied/);
});
test("framebuffer route retains sensitive permission, recovers stale inventory flags and never labels errors as images",async()=>{
  const routes=[];let query;
  const context=vm.createContext({
    app:{get:(...args)=>routes.push(args)},requireCapability:capability=>capability,
    veyonComputerStore:{computers:{fixture:{ip:"fixture",online:false,authenticated:false}}},veyonComputerId:id=>id,
    URLSearchParams,readVeyonFrame,veyonResponseError,
    veyonConnectedRequest:async(_host,pathname,_options,reader)=>{query=pathname;return reader(pathname,{})},
    veyonFetch:async()=>new Response(png)
  });
  const start=source.indexOf('app.get("/api/v1/veyon/computers/:id/framebuffer"');
  const end=source.indexOf('app.get("/api/v1/veyon/computers/:id/features"',start);
  vm.runInContext(source.slice(start,end),context);
  assert.equal(routes[0][1],"lab.sensitive.read");
  const res={headers:{},setHeader(k,v){this.headers[k]=v},type(v){this.contentType=v;return this},status(v){this.statusCode=v;return this},send(v){this.body=v},json(v){this.body=v}};
  await routes[0][2]({params:{id:"fixture"},query:{format:"jpeg",width:"99999",quality:"999"}},res);
  assert.equal(res.contentType,"image/png");assert.equal(res.headers["Cache-Control"],"no-store");
  assert.match(query,/width=3840/);assert.match(query,/quality=95/);
  context.veyonFetch=async()=>new Response("broken");res.contentType=null;
  await routes[0][2]({params:{id:"fixture"},query:{}},res);
  assert.equal(res.statusCode,502);assert.equal(res.body.ok,false);assert.equal(res.contentType,null);
});
