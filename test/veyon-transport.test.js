"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {bufferedVeyonFetch,readVeyonFrame,veyonResponseError,safeVeyonFailure}=require("../src/veyon-transport");
const jpeg=Buffer.from([255,216,255,224,0,2,255,217]);
const png=Buffer.from([137,80,78,71,13,10,26,10,0]);
const errorResponse=(code,status)=>new Response(JSON.stringify({error:{code,message:"remote detail"}}),{status,headers:{"content-type":"application/json"}});

test("Veyon deadline covers a body stalled after successful headers",async()=>{
  const started=Date.now();
  await assert.rejects(bufferedVeyonFetch("http://example.invalid",{timeoutMs:25},async(_url,{signal})=>new Response(new ReadableStream({
    start(controller){signal.addEventListener("abort",()=>controller.error(new Error("aborted")),{once:true})}
  }))),/timed out/);
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
    veyonPrivateKey:()=>"test-only",veyonJson:json,validatedVeyonHost:value=>value,
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
  const context=vm.createContext({validatedVeyonHost:value=>value,veyonConnectedJson:async()=>{throw new Error("authentication denied")},veyonFeatureStatus:async()=>({active:false})});
  vm.runInContext(source.slice(source.indexOf("async function veyonComputerInfo("),source.indexOf("function veyonComputerId(")),context);
  await assert.rejects(context.veyonComputerInfo("fixture"),/authentication denied/);
});
test("framebuffer route retains sensitive permission, recovers stale inventory flags and never labels errors as images",async()=>{
  const routes=[];let query;
  const context=vm.createContext({
    app:{get:(...args)=>routes.push(args)},requireCapability:capability=>capability,
    veyonComputerStore:{computers:{fixture:{ip:"fixture",online:false,authenticated:false}}},veyonComputerId:id=>id,
    URLSearchParams,readVeyonFrame,veyonResponseError,safeVeyonFailure,veyonCommandQueue:{pressure:()=>false},
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
  assert.equal(res.body.reason,"invalid-image");assert.equal(res.body.stage,"framebuffer");
  context.veyonConnectedRequest=async()=>{const error=await veyonResponseError(errorResponse(6,401));error.stage="authentication";throw error};
  await routes[0][2]({params:{id:"fixture"},query:{}},res);
  assert.equal(res.statusCode,502);assert.equal(res.body.stage,"authentication");assert.equal(res.body.code,6);assert.equal(res.body.upstreamStatus,401);assert.doesNotMatch(res.body.error,/remote detail/);
});


test("JPEG encoding failure falls back once to PNG without retrying broken PNG encoders",async()=>{
  const urls=[];
  const frame=await readVeyonFrame("format=jpeg&quality=55&width=480",async url=>{urls.push(url);return urls.length===1?errorResponse(11,500):new Response(png)});
  assert.equal(frame.contentType,"image/png");assert.match(urls[1],/format=png/);assert.doesNotMatch(urls[1],/quality/);
  let calls=0;
  await assert.rejects(readVeyonFrame("format=jpeg",async()=>{calls++;return errorResponse(11,500)}),/image codecs/);
  assert.equal(calls,2);
});
test("Veyon preview diagnostics classify transport and auth errors without copying remote data",async()=>{
  for(const [networkCode,reason] of [["ECONNREFUSED","connection-refused"],["ENOTFOUND","name-resolution"],["ECONNRESET","network-failure"]]){
    await assert.rejects(bufferedVeyonFetch("http://example.invalid",{},async()=>{throw Object.assign(new Error("secret token and private URL"),{cause:{code:networkCode}})}),error=>{
      const result=safeVeyonFailure(error);assert.equal(result.reason,reason);assert.doesNotMatch(result.error,/secret token|private URL/);return true;
    });
  }
  const authError=await veyonResponseError(errorResponse(6,401));authError.stage="authentication";
  assert.deepEqual(safeVeyonFailure(authError),{ok:false,error:authError.message,code:6,stage:"authentication",reason:"veyon-6",upstreamStatus:401});
  assert.doesNotMatch(safeVeyonFailure(new Error("private key details")).error,/private key details/);
  for(const code of [5,12])assert.equal((await veyonResponseError(errorResponse(code,400))).veyonCode,code);
});
test("Veyon root404 is reachability evidence, never authenticated screen health",async()=>{
  const routes=[];
  const context=vm.createContext({app:{get:(...args)=>routes.push(args)},requireCapability:capability=>capability,
    veyonFetch:async()=>new Response("invalid command",{status:404}),VEYON_WEBAPI_URL:"http://example.invalid",VEYON_KEY_NAME:"fixture",VEYON_PRIVATE_KEY_FILE:"/absent",VEYON_SCAN_SUBNET:"",VEYON_POOL_MAX:24,
    dbStore:{hasSecret:()=>true},fs:{existsSync:()=>false},veyonConnectionCache:new Map(),Date});
  const start=source.indexOf('app.get("/api/v1/veyon/status"'),end=source.indexOf('app.get("/api/v1/veyon/computers"',start);
  vm.runInContext(source.slice(start,end),context);
  let body;await routes[0][2]({}, {json:value=>{body=value}});
  assert.equal(body.httpStatus,404);assert.equal(body.serviceReachable,true);assert.equal(body.verification,"reachability-only");assert.equal(body.authenticatedConnections,0);
});

test("broadcast stop uses tracked jobs and reports student and teacher failures",async()=>{
  let route;const commands=[];
  const context=vm.createContext({
    app:{post:(_path,_permission,handler)=>{route=handler}},requireCapability:()=>()=>{},
    veyonComputerStore:{computers:{teacher:{id:"teacher",ip:"teacher"},a:{id:"a",ip:"a"},b:{id:"b",ip:"b"}}},
    veyonComputerId:id=>id,requestUser:()=>({id:"operator"}),
    veyonBroadcastWorkflows:new Map(),waitForVeyonCommand:async job=>job,
    veyonJobResults:job=>job.results,
    veyonCommandQueue:{enqueue:command=>{
      commands.push(command);
      return {state:"completed",results:command.targets.map(rec=>({...rec,ok:rec.id==="a",error:rec.id==="a"?undefined:"Stop could not be confirmed"}))};
    }}
  });
  const start=source.indexOf('app.post("/api/v1/veyon/demo/stop"');
  vm.runInContext(source.slice(start,source.indexOf('app.get("/api/v1/veyon/jobs"',start)),context);
  let result;
  await route({body:{teacherId:"teacher",studentIds:["a","a","b"]}},{json:value=>{result=value},status(){return this}});
  assert.equal(result.ok,false);assert.equal(result.results.length,3);
  assert.equal(result.results.find(x=>x.id==="a").ok,true);
  assert.equal(result.results.find(x=>x.id==="b").ok,false);
  assert.match(result.results.find(x=>x.id==="teacher").error,/could not be confirmed/);
  assert.equal(commands.length,3);assert.equal(commands[0].targets.length,2);
  assert.ok(commands.every(command=>command.active===false&&command.owner==="operator"));
});

test("broadcast clients wait for a confirmed teacher job and never start after teacher failure",async()=>{
  const routes=new Map(),commands=[];let teacherOk=false;
  const context=vm.createContext({
    app:{post:(path,_permission,handler)=>routes.set(path,handler)},requireCapability:()=>()=>{},
    veyonComputerStore:{computers:{teacher:{id:"teacher",ip:"teacher"},a:{id:"a",ip:"a"}}},
    veyonComputerId:id=>id,requestUser:()=>({id:"operator"}),crypto:{randomBytes:()=>Buffer.from("test-only-demo-token")},
    veyonBroadcastWorkflows:new Map(),waitForVeyonCommand:async job=>job,veyonJobResults:job=>job.results,
    veyonCommandQueue:{enqueue:command=>{
      commands.push(command);
      return {state:"completed",results:command.targets.map(rec=>({...rec,ok:command.feature!=="demoServer"||teacherOk,verified:teacherOk}))};
    }}
  });
  const start=source.indexOf('app.post("/api/v1/veyon/demo/start"');
  vm.runInContext(source.slice(start,source.indexOf('app.post("/api/v1/veyon/demo/stop"',start)),context);
  const route=routes.get("/api/v1/veyon/demo/start");let result;
  const res={json:value=>{result=value},status(){return this}},req={body:{teacherId:"teacher",studentIds:["a","a"],mode:"window"}};
  await route(req,res);assert.equal(result.ok,false);assert.equal(commands.length,1);
  teacherOk=true;commands.length=0;await route(req,res);
  assert.equal(result.ok,true);assert.deepEqual(commands.map(x=>x.feature),["demoServer","windowDemoClient"]);
  assert.equal(commands[1].targets.length,1);assert.equal(commands[1].args.demoAccessToken,commands[0].args.demoAccessToken);
  assert.doesNotMatch(JSON.stringify(result),/demoAccessToken|test-only-demo-token/);
});

function controlledBroadcastRoutes(){
  const routes=new Map(),commands=[],teacherWaiters=new Map(),workflows=new Map();let token=0;
  const context=vm.createContext({
    app:{post:(path,_permission,handler)=>routes.set(path,handler)},requireCapability:()=>()=>{},
    veyonComputerStore:{computers:{teacher:{id:"teacher",ip:"teacher"},student:{id:"student",ip:"student"}}},
    veyonComputerId:id=>id,requestUser:()=>({id:"operator"}),crypto:{randomBytes:()=>Buffer.from(`fixture-token-${++token}`)},
    veyonBroadcastWorkflows:workflows,veyonJobResults:job=>job.results,
    waitForVeyonCommand:job=>job.command.feature==="demoServer"&&job.command.active
      ?new Promise(resolve=>teacherWaiters.set(job.id,()=>resolve(job))):Promise.resolve(job),
    veyonCommandQueue:{enqueue:command=>{
      commands.push(command);return {id:String(commands.length),command,state:"completed",results:command.targets.map(rec=>({...rec,ok:true,verified:true}))};
    }}
  });
  const start=source.indexOf('app.post("/api/v1/veyon/demo/start"');
  vm.runInContext(source.slice(start,source.indexOf('app.get("/api/v1/veyon/jobs"',start)),context);
  const request={body:{teacherId:"teacher",studentIds:["student"],mode:"fullscreen"}};
  const response=()=>({body:null,json(value){this.body=value},status(){return this}});
  return {routes,commands,teacherWaiters,workflows,request,response};
}

test("overlapping broadcast starts cannot fan out an obsolete teacher token in either waiter order",async()=>{
  for(const newestFirst of [false,true]){
    const h=controlledBroadcastRoutes(),route=h.routes.get("/api/v1/veyon/demo/start"),first=h.response(),second=h.response();
    const older=route(h.request,first),newer=route(h.request,second);
    assert.equal(h.teacherWaiters.size,2);
    if(newestFirst){h.teacherWaiters.get("2")();await newer;h.teacherWaiters.get("1")();await older}
    else{h.teacherWaiters.get("1")();await older;assert.equal(h.workflows.size,1,"an obsolete route cannot clear the newer generation");h.teacherWaiters.get("2")();await newer}
    assert.equal(first.body.superseded,true);assert.equal(first.body.ok,false);assert.equal(second.body.ok,true);
    const clients=h.commands.filter(command=>command.feature==="fullScreenDemoClient");
    assert.equal(clients.length,1);assert.equal(clients[0].args.demoAccessToken,h.commands[1].args.demoAccessToken);
    assert.equal(h.workflows.size,0,"completed handlers do not retain generation entries");
    assert.doesNotMatch(JSON.stringify([first.body,second.body]),/fixture-token|demoAccessToken/);
  }
});

test("broadcast stop supersedes an older start before its teacher waiter can enqueue clients",async()=>{
  const h=controlledBroadcastRoutes(),startResult=h.response(),stopResult=h.response();
  const pending=h.routes.get("/api/v1/veyon/demo/start")(h.request,startResult);
  await h.routes.get("/api/v1/veyon/demo/stop")(h.request,stopResult);
  h.teacherWaiters.get("1")();await pending;
  assert.equal(stopResult.body.ok,true);assert.equal(startResult.body.superseded,true);
  assert.equal(h.commands.filter(command=>command.active&&command.feature!=="demoServer").length,0);
  assert.deepEqual(h.commands.slice(1).map(command=>[command.feature,command.active]),[["fullScreenDemoClient",false],["windowDemoClient",false],["demoServer",false]]);
  assert.equal(h.workflows.size,0);
});
