"use strict";

const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {spawnSync}=require("node:child_process");

// Each subprocess owns its SQLite connections and fixture credentials. No
// classroom configuration or network service is inherited from the developer.
function scenario(script){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-bridges-"));
  try{
    const master=path.join(dir,"master.key");fs.writeFileSync(master,Buffer.alloc(32,31));
    const result=spawnSync(process.execPath,["-e",String.raw`
      const assert=require("node:assert/strict"),http=require("node:http");
      const {once}=require("node:events"),{setTimeout:delay}=require("node:timers/promises");
      const express=require("express");
      const methods=["get","post","put","delete","use","route"];
      const original=Object.fromEntries(methods.map(m=>[m,express.application[m]]));
      const before=express();
      const {installApplicationBridges}=require("./src/application-bridges");
      for(const name of ["veyon-keyring","veyon-dhcp-identity","veyon-update","cloudflare","maintenance-route"])
        require("./src/"+name+"-bridge");
      const {trackApplicationHandlers,waitUntilDrained}=require("./src/application-drain");
      const servers=[];
      async function listen(app){
        const server=http.createServer(app);servers.push(server);server.listen(0,"127.0.0.1");await once(server,"listening");
        return "http://127.0.0.1:"+server.address().port;
      }
      async function request(url,method="GET",body,headers={}){
        const r=await fetch(url,{method,headers:{"content-type":"application/json",...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(3000)});
        const text=await r.text();let value;try{value=JSON.parse(text)}catch{value=text}
        return {status:r.status,body:value};
      }
      const maintenance={"x-maintenance-token":"fixture-maintenance"};
      function guard(name){return (req,res,next)=>req.get("x-fixture-admin")===name?next():res.status(403).json({ok:false,error:"fixture-denied"})}
      function appFor(name){
        const app=express(),tracker=trackApplicationHandlers(app);installApplicationBridges(app);app.use(express.json());
        return {app,tracker,admin:guard(name),headers:{"x-fixture-admin":name}};
      }
      (async()=>{
    `+script+String.raw`
        for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
      })().catch(error=>{console.error(error);process.exitCode=1;for(const server of servers){server.closeAllConnections();server.close()}});
    `],{cwd:path.resolve(__dirname,".."),env:{PATH:process.env.PATH,SystemRoot:process.env.SystemRoot,TEMP:dir,HOME:dir,
      DATA_DIR:dir,DATABASE_FILE:path.join(dir,"hub.db"),MASTER_KEY_FILE:master,VEYON_PRIVATE_KEY_FILE:path.join(dir,"missing-key"),
      MAINTENANCE_TOKEN:"fixture-maintenance",MAINTENANCE_URL:"http://127.0.0.1:1"},encoding:"utf8",timeout:20000});
    assert.equal(result.status,0,result.stderr||result.stdout);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
}

test("loading and installing bridges leaves Express and unowned applications unchanged",()=>scenario(String.raw`
  const owned=appFor("owned");
  const installed=Object.fromEntries(methods.map(m=>[m,owned.app[m]]));
  installApplicationBridges(owned.app);
  for(const method of methods){assert.equal(express.application[method],original[method]);assert.equal(owned.app[method],installed[method])}
  for(const app of [before,express()]){
    app.set("fixture-setting","kept");assert.equal(app.get("fixture-setting"),"kept");
    app.get("/api/v1/admin/config",(_req,res)=>res.json({ok:true}));
    const url=await listen(app);
    assert.equal((await request(url+"/api/v1/admin/config")).status,200);
    assert.equal((await request(url+"/api/v1/internal/maintenance/config","GET",undefined,maintenance)).status,404);
    assert.equal((await request(url+"/api/v1/admin/veyon-update-status")).status,404);
    assert.equal((await request(url+"/api/v1/admin/cloudflare")).status,404);
  }
`));

test("each installed application gets management routes with its own administrator guard",()=>scenario(String.raw`
  for(const name of ["first","second"]){
    const {app,admin,headers}=appFor(name);
    app.get("/api/v1/admin/config",admin,(_req,res)=>res.json({ok:true}));
    app.put("/api/v1/admin/integration-connections",admin,(_req,res)=>res.json({ok:true}));
    const url=await listen(app);
    for(const [method,route] of [
      ["GET","veyon-keys"],["POST","veyon-keys"],["PUT","veyon-keys/preferred"],["DELETE","veyon-keys/fixture"],
      ["GET","veyon-update-status"],["POST","veyon-update"],
      ["GET","cloudflare"],["PUT","cloudflare"],["POST","cloudflare/validate"],["POST","cloudflare/provision"],
      ["POST","cloudflare/restart"],["DELETE","cloudflare/credentials"]
    ]){
      assert.equal((await request(url+"/api/v1/admin/"+route,method,undefined,maintenance)).status,403,method+" "+route);
      assert.equal((await request(url+"/api/v1/admin/"+route,method,undefined,{"x-fixture-admin":"wrong"})).status,403);
    }
    assert.equal((await request(url+"/api/v1/admin/veyon-keys","GET",undefined,headers)).status,200);
    assert.equal((await request(url+"/api/v1/admin/veyon-update","POST",{},headers)).status,400);
    assert.equal((await request(url+"/api/v1/admin/cloudflare","PUT",{},headers)).status,200);
  }
`));

test("maintenance mirrors retain token authentication and Music Assistant request/response transforms",()=>scenario(String.raw`
  const {app,admin,headers}=appFor("admin");
  app.get("/api/v1/admin/config",admin,(_req,res)=>res.json({ok:true}));
  app.get("/api/v1/music-assistant/status",admin,(_req,res)=>res.json({ok:true,players:[
    {player_id:"protocol"},{player_id:"universal",provider:"universal",output_protocols:[{output_protocol_id:"protocol"}]}]}));
  app.put("/api/v1/music-assistant/config",admin,(req,res)=>res.json({ok:true,value:req.body.value}));
  app.post("/api/v1/music-assistant/command",admin,(req,res)=>res.json(req.body));
  app.post("/api/v1/music-assistant/background/control",admin,(req,res)=>res.json(req.body));
  app.put("/api/v1/music-assistant/background/schedule",admin,(req,res)=>res.json(req.body));
  app.get("/api/v1/veyon/status",admin,(_req,res)=>res.json({ok:true,httpStatus:404}));
  const url=await listen(app);
  for(const [method,route] of [["GET","config"],["GET","music-assistant/status"],["PUT","music-assistant/config"],["GET","veyon/status"]]){
    for(const credential of [{},headers,{"x-maintenance-token":"wrong"}])assert.equal((await request(url+"/api/v1/internal/maintenance/"+route,method,undefined,credential)).status,401);
  }
  assert.equal((await request(url+"/api/v1/admin/config","GET",undefined,maintenance)).status,403);
  for(const prefix of ["/api/v1/","/api/v1/internal/maintenance/"]){
    const auth=prefix.includes("internal")?maintenance:headers;
    const r=await request(url+prefix+"music-assistant/status","GET",undefined,auth);
    assert.equal(r.status,200);assert.deepEqual(r.body.players.map(p=>p.player_id),["universal"]);
    assert.deepEqual(r.body.protocolPlayers.map(p=>p.player_id),["protocol"]);
    const status=await request(url+prefix+"veyon/status","GET",undefined,auth);
    assert.equal(status.body.operational,false);assert.equal(status.body.health,"reachable-unvalidated");
  }
  const config=await request(url+"/api/v1/internal/maintenance/music-assistant/config","PUT",{value:"kept"},maintenance);
  assert.equal(config.status,200);assert.equal(config.body.value,"kept");
  const command=await request(url+"/api/v1/music-assistant/command","POST",{args:{player_id:"protocol",queue_id:"protocol"}},headers);
  assert.deepEqual(command.body.args,{player_id:"universal",queue_id:"universal"});
  for(const [method,route] of [["POST","control"],["PUT","schedule"]])assert.equal((await request(url+"/api/v1/music-assistant/background/"+route,method,{playerId:"protocol"},headers)).body.playerId,"universal");
`));

test("Veyon keyring and stable identity transforms keep their existing composition",()=>scenario(String.raw`
  const {app,admin,headers}=appFor("admin");
  app.get("/api/v1/admin/config",admin,(_req,res)=>res.json({ok:true,integrationConnections:{veyon:{}}}));
  app.put("/api/v1/admin/integration-connections",admin,(_req,res)=>res.json({ok:true,integrationConnections:{veyon:{}}}));
  app.get("/api/v1/veyon/computers",admin,(_req,res)=>res.json({ok:true,computers:[{id:"192.0.2.10",ip:"192.0.2.10",hostname:"fixture-pc",online:true}]}));
  app.post("/api/v1/veyon/computers/:id/control",admin,(req,res)=>res.json({ok:true,computer:{id:req.params.id},received:req.body}));
  const url=await listen(app);
  const key=require("node:crypto").generateKeyPairSync("rsa",{modulusLength:1024,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}}).privateKey;
  for(const [route,auth,keyName] of [["/api/v1/admin/integration-connections",headers,"admin-fixture"],["/api/v1/internal/maintenance/integration-connections",maintenance,"maintenance-fixture"]]){
    assert.equal((await request(url+route,"PUT",{veyon:{keyName,privateKey:key}})).status,route.includes("internal")?401:403);
    const saved=await request(url+route,"PUT",{veyon:{keyName,privateKey:key}},auth);
    assert.equal(saved.status,200);assert.ok(saved.body.integrationConnections.veyon.keyNames.includes(keyName));
    assert.equal(JSON.stringify(saved.body).includes("PRIVATE KEY"),false);
  }
  const config=await request(url+"/api/v1/admin/config","GET",undefined,headers);
  assert.deepEqual(config.body.integrationConnections.veyon.keyNames,["admin-fixture","maintenance-fixture"]);
  const inventory=await request(url+"/api/v1/veyon/computers","GET",undefined,headers);
  assert.equal(inventory.status,200);const stable=inventory.body.computers[0].id;assert.notEqual(stable,"192.0.2.10");
  const control=await request(url+"/api/v1/veyon/computers/"+stable+"/control","POST",{ids:[stable]},headers);
  assert.equal(control.body.computer.id,stable);assert.deepEqual(control.body.received.ids,["192.0.2.10"]);
  // Maintenance inventory historically returns backend IDs; preserve that API.
  const mirror=await request(url+"/api/v1/internal/maintenance/veyon/computers","GET",undefined,maintenance);
  assert.equal(mirror.body.computers[0].id,"192.0.2.10");
`));

test("mirrored async handlers remain tracked after response finish and propagate errors",()=>scenario(String.raw`
  const {app,tracker,admin,headers}=appFor("admin");let release,finished=0;
  const blocked=new Promise(resolve=>{release=resolve});
  app.put("/api/v1/music-assistant/config",admin,async(_req,res)=>{res.json({ok:true});await blocked;finished++});
  app.get("/api/v1/music-assistant/status",admin,async()=>{await delay(1);throw Error("fixture-rejection")});
  app.use((error,_req,res,_next)=>res.status(409).json({error:error.message}));
  const url=await listen(app);
  for(const [prefix,auth] of [["/api/v1/",headers],["/api/v1/internal/maintenance/",maintenance]]){
    assert.equal((await request(url+prefix+"music-assistant/config","PUT",{},auth)).status,200);
    const error=await request(url+prefix+"music-assistant/status","GET",undefined,auth);
    assert.equal(error.status,409);assert.equal(error.body.error,"fixture-rejection");
  }
  assert.equal(tracker.pending,2);assert.equal(finished,0);release();await waitUntilDrained(()=>tracker.pending===0);assert.equal(finished,2);
`));
