"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),os=require('node:os');
const source=fs.readFileSync(require.resolve('../src/server'),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function fixture(){
 const runtime={startedAt:'fixture',mqtt:{configured:false,connected:false},hardware:{pluto:{configured:false,lastError:null,lastSuccessAt:null},govee:{configured:false,lastError:null,lastSuccessAt:null}},websocketClients:0};
 const ctx=vm.createContext({runtime,URL,process,os,fs:{existsSync:()=>false},publicRuntime:()=>({displays:{}}),veyonFetch:async()=>({status:404}),veyonConnectionCache:new Map(),diagnosticsEventSlice:()=>[],diagnosticsFileStatus:()=>({exists:false}),schedulerStatus:()=>({}),dbStore:{databaseInfo:()=>({}),hasSecret:()=>false},deviceConfig:{},devices:{},goveeDevices:{},displayGroups:{},lightingGroups:[],classScheduleStore:{classes:[]},classroomAutomations:{events:[]},APPLICATION_VERSION:'fixture',SCHEDULER_TIMEZONE:'UTC',ROOM_NAME:'Fixture',MQTT_URL:'',MQTT_JSON_BRIDGE:true,MQTT_LEGACY_BRIDGE:true,PLUTO_URL:'',PLUTO_TIMEOUT_MS:4000,PLUTO_READ_RETRIES:0,VEYON_WEBAPI_URL:'http://127.0.0.1:11080',VEYON_KEY_NAME:'fixture',VEYON_PRIVATE_KEY_FILE:'fixture',VEYON_SCAN_SUBNET:'',VEYON_POOL_MAX:24,MEDIA_DIR:'fixture',PRESENTATIONS_DIR:'fixture',AUDIT_FILE:'fixture',AUTOMATIONS_FILE:'fixture',CLASS_SCHEDULES_FILE:'fixture',VEYON_COMPUTERS_FILE:'fixture'});
 vm.runInContext(section('function redactUrlSecrets(','function publicProjection(')+section('function diagnosticSanitize(','function diagnosticError(')+section('async function buildDiagnosticsSnapshot(','// Local authentication, users and setup completion.'),ctx);
 return ctx;
}
test('unconfigured optional hardware is not reported healthy or failed',async()=>{
 const ctx=fixture(),snapshot=await ctx.buildDiagnosticsSnapshot();
 for(const key of ['pluto','govee']){assert.equal(snapshot.services[key].ok,null,key);assert.equal(snapshot.services[key].status,'not-configured',key)}
});
test('configured hardware needs observation before a successful diagnostic claim',async()=>{
 const ctx=fixture();ctx.PLUTO_URL='http://pluto.example.test';ctx.runtime.hardware.pluto.configured=true;ctx.goveeDevices.lamp={id:'fixture'};
 const snapshot=await ctx.buildDiagnosticsSnapshot();
 for(const key of ['pluto','govee']){assert.equal(snapshot.services[key].ok,null,key);assert.equal(snapshot.services[key].status,'not-observed',key)}
});
test('Pluto diagnostics describe a recorded success rather than inventing a current probe',async()=>{
 const ctx=fixture();ctx.PLUTO_URL='http://pluto.example.test';ctx.runtime.hardware.pluto={configured:true,lastError:null,lastSuccessAt:'2026-01-01T00:00:00.000Z'};
 const snapshot=await ctx.buildDiagnosticsSnapshot();assert.equal(snapshot.services.pluto.ok,true);assert.equal(snapshot.services.pluto.status,'observed');assert.equal(snapshot.services.pluto.lastSuccessAt,'2026-01-01T00:00:00.000Z');
});
test('an observed integration error does not make unrelated services fail',async()=>{
 const ctx=fixture();ctx.PLUTO_URL='http://pluto.example.test';ctx.runtime.hardware.pluto={configured:true,lastError:'fixture failure',lastSuccessAt:'2026-01-01T00:00:00.000Z'};
 const snapshot=await ctx.buildDiagnosticsSnapshot();assert.equal(snapshot.services.pluto.ok,false);assert.equal(snapshot.services.pluto.status,'error');assert.equal(snapshot.services.classroomHub.ok,true);assert.equal(snapshot.services.govee.ok,null);
});
test('Govee transport evidence does not claim device acknowledgment',async()=>{
 const ctx=fixture();ctx.goveeDevices.lamp={id:'fixture'};ctx.runtime.mqtt.connected=true;ctx.runtime.hardware.govee.lastSuccessAt='2026-01-01T00:00:00.000Z';
 const snapshot=await ctx.buildDiagnosticsSnapshot();assert.equal(snapshot.services.govee.configured,true);assert.equal(snapshot.services.govee.ok,true);assert.equal(snapshot.services.govee.verification,'mqtt-publish');
});
test('a disconnected MQTT transport supersedes an old Govee publish',async()=>{
 const ctx=fixture();ctx.goveeDevices.lamp={id:'fixture'};ctx.runtime.hardware.govee.lastSuccessAt='2026-01-01T00:00:00.000Z';
 const snapshot=await ctx.buildDiagnosticsSnapshot();assert.equal(snapshot.services.govee.ok,false);assert.equal(snapshot.services.govee.status,'disconnected');
});
test('diagnostic configuration and reachable service URLs redact query credentials',async()=>{
 const ctx=fixture(),sentinel='DIAGNOSTIC_URL_SECRET_93fa';
 ctx.MQTT_URL=`mqtt://broker.example.test?token=${sentinel}`;ctx.PLUTO_URL=`http://pluto.example.test?key=${sentinel}`;ctx.VEYON_WEBAPI_URL=`http://veyon.example.test?token=${sentinel}`;
 const snapshot=await ctx.buildDiagnosticsSnapshot();assert.doesNotMatch(JSON.stringify(snapshot),new RegExp(sentinel));assert.equal(snapshot.services.veyon.serviceReachable,true);assert.equal(snapshot.services.veyon.verification,'reachability-only');
});
test('failed reachability diagnostics redact URLs in the error message',async()=>{
 const ctx=fixture(),sentinel='DIAGNOSTIC_ERROR_SECRET_7df1';ctx.veyonFetch=async()=>{throw Error(`Could not reach http://veyon.example.test?token=${sentinel}`)};
 const snapshot=await ctx.buildDiagnosticsSnapshot();assert.doesNotMatch(JSON.stringify(snapshot),new RegExp(sentinel));assert.equal(snapshot.services.veyon.serviceReachable,false);
});
for(const failed of [false,true])test(`retired Pluto ${failed?'errors':'responses'} cannot mark a replacement connection`,async()=>{
 const ctx=fixture();let resolve,reject;
 ctx.PLUTO_READ_RETRIES=0;ctx.plutoPostRaw=()=>new Promise((a,b)=>{resolve=a;reject=b});
 vm.runInContext(section('async function performPlutoRequest(','const plutoStatusReader='),ctx);
 const pending=ctx.performPlutoRequest({action:'systemStatus'},{readOnly:true,body:{},expected:'system'});
 ctx.runtime.hardware.pluto={configured:true,lastSuccessAt:null,lastError:null};
 if(failed){reject(Error('old endpoint error'));await assert.rejects(pending)}else{resolve({comhead:'system'});await pending}
 assert.equal(ctx.runtime.hardware.pluto.lastSuccessAt,null);assert.equal(ctx.runtime.hardware.pluto.lastError,null);
});
test('retired Govee publish cannot mark a replacement connection',async()=>{
 const ctx=fixture();let resolve;ctx.goveeDevices.lamp={id:'fixture'};ctx.mqttPublish=()=>new Promise(a=>resolve=a);ctx.audit=()=>{};ctx.diagnosticError=()=>{};
 vm.runInContext(section('async function goveePublish(','async function directGoveeCommand('),ctx);
 const pending=ctx.goveePublish('lamp',{});ctx.runtime.hardware.govee={configured:true,lastSuccessAt:null,lastError:null};resolve();await pending;
 assert.equal(ctx.runtime.hardware.govee.lastSuccessAt,null);
});
