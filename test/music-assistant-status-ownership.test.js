"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {sendspinEndpoint}=require("../src/music-assistant-sendspin");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8"),a=source.indexOf('app.get("/api/v1/music-assistant/status"'),b=source.indexOf('\napp.put("/api/v1/music-assistant/config"',a);assert.ok(a>0&&b>a);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const flush=()=>new Promise(setImmediate);
function fixture({configured=true}={}){
 let route,cfg={url:"http://old.example.test",browserUrl:"",tvBridgeEnabled:true,sendspinHost:"old.example.test",sendspinPort:8927};
 const calls=[],ctx=vm.createContext({app:{get:(_p,...handlers)=>{route=handlers.at(-1)}},musicAssistantStatusLimit(){},requireControl(){},
  musicAssistantConfig:()=>({...cfg}),musicAssistantToken:()=>configured?"fixture-private-token":"",
  musicAssistantCommand:(command,args)=>{const d=deferred();calls.push({command,args,...d});return d.promise},sendspinEndpoint,
  runtime:{displays:{screen:{musicAssistant:{clientId:"current-player"}}}},dbStore:{getPreference:(_k,f)=>f},
  MUSIC_ASSISTANT_TV_DEFAULT_VOLUME:20,maApiGeneration:0,maApiAuthenticated:true,maApiServerInfo:{server_id:"current-server"},maApiLastConnectedAt:"fixture-time",maApiLastError:null});
 vm.runInContext(source.slice(a,b),ctx);
 return {ctx,calls,replace(){ctx.maApiGeneration++;cfg={...cfg,url:"http://new.example.test",sendspinHost:"new.example.test"}},
  async get(){let status=200,body;const res={status(v){status=v;return res},json(v){body=JSON.parse(JSON.stringify(v));return res}};await route({},res);return {status,body}}};
}
function retired(result){assert.equal(result.status,409);assert.deepEqual(result.body,{ok:false,error:"Music Assistant settings changed. Refresh to check the current connection."})}
test("connection status retires old successful player data after settings change",async()=>{
 const h=fixture(),p=h.get();h.replace();h.calls[0].resolve([{player_id:"old-player"}]);retired(await p);
});
test("retired primary failure cannot retry against the replacement connection",async()=>{
 const h=fixture(),p=h.get();h.replace();h.calls[0].reject(Error("retired request"));retired(await p);assert.equal(h.calls.length,1);
});
for(const failed of [false,true])test("connection retirement during fallback ignores its "+(failed?"failure":"success"),async()=>{
 const h=fixture(),p=h.get();h.calls[0].reject(Error("unsupported argument"));await flush();assert.equal(h.calls.length,2);h.replace();
 if(failed)h.calls[1].reject(Error("old fallback failed"));else h.calls[1].resolve([{player_id:"old-player"}]);retired(await p);
});
test("current connection retains legacy player-list fallback and bridge registration",async()=>{
 const h=fixture(),p=h.get();h.calls[0].reject(Error("unsupported argument"));await flush();assert.deepEqual(Object.keys(h.calls[1].args),[]);
 h.calls[1].resolve([{player_id:"current-player",available:true}]);const result=await p;assert.equal(result.status,200);assert.equal(result.body.online,true);assert.equal(result.body.bridgeStatus.screen.registered,true);assert.equal(result.body.url,"http://old.example.test");assert.equal(result.body.configured,true);assert.equal(JSON.stringify(result.body).includes("fixture-private-token"),false);
});
test("current connection errors preserve visible failure without claiming authenticated readiness",async()=>{
 const h=fixture(),p=h.get();h.calls[0].reject(Error("primary"));await flush();h.calls[1].reject(Error("current connection unavailable"));const result=await p;
 assert.equal(result.status,200);assert.equal(result.body.online,false);assert.equal(result.body.error,"current connection unavailable");assert.deepEqual(result.body.players,[]);
});
test("unconfigured connection status issues no player request and contains no credential",async()=>{
 const h=fixture({configured:false}),result=await h.get();assert.equal(result.status,200);assert.equal(result.body.configured,false);assert.equal(result.body.online,false);assert.deepEqual(result.body.players,[]);assert.equal(h.calls.length,0);assert.equal(Object.hasOwn(result.body,"token"),false);
});
test("current primary success preserves protocol players and transport metadata",async()=>{
 const h=fixture(),p=h.get();assert.equal(h.calls[0].args.return_protocol_players,true);h.calls[0].resolve([{player_id:"current-player"}]);const result=await p;
 assert.equal(result.status,200);assert.equal(result.body.players[0].player_id,"current-player");assert.equal(result.body.apiTransport,"persistent-websocket");assert.equal(result.body.apiServerInfo.server_id,"current-server");assert.equal(result.body.bridgeStatus.screen.registered,true);
});
