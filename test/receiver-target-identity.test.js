"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {expandDisplayTargets}=require('../src/automation-runtime');
const devices={'Screen-A':{enabled:true,avOutput:1},'screen-a':{enabled:true,avOutput:2},OnlyUpper:{enabled:true,avOutput:3},disabled:{enabled:false,avOutput:4}};
const group='display-LongHistoricalGroup'+'-Segment'.repeat(15);
const options={devices,displayGroups:{[group]:['Screen-A','OnlyUpper','missing','disabled'],Pair:['Screen-A','screen-a']}};
test('scheduler expansion preserves exact receiver IDs and distinct case peers',()=>{
 assert.deepEqual(expandDisplayTargets(['Screen-A','screen-a'],options),['Screen-A','screen-a']);
});
test('scheduler expansion preserves exact long group keys and their receiver members',()=>{
 assert.deepEqual(expandDisplayTargets([group],options),['Screen-A','OnlyUpper']);
 assert.deepEqual(expandDisplayTargets(['Pair'],options),['Screen-A','screen-a']);
});
test('scheduler expansion rejects ambiguous receiver aliases and accepts a unique case alias',()=>{
 assert.deepEqual(expandDisplayTargets(['SCREEN-A'],options),[]);
 assert.deepEqual(expandDisplayTargets(['ONLYUPPER'],options),['OnlyUpper']);
});
test('scheduler groups cannot manufacture unknown receiver targets',()=>{
 assert.deepEqual(expandDisplayTargets(['fixture'],{devices,displayGroups:{fixture:['missing','disabled']}}),[]);
});
test('all receiver expansion retains enabled configured identities',()=>{
 assert.deepEqual(expandDisplayTargets(['all'],options),['Screen-A','screen-a','OnlyUpper']);
});
test('scheduler receivers take precedence over colliding group aliases',()=>{
 const options={devices:{'screen-a':{enabled:true},other:{enabled:true}},displayGroups:{'Screen-A':['other']}};
 assert.deepEqual(expandDisplayTargets(['screen-a'],options),['screen-a']);
 assert.deepEqual(expandDisplayTargets(['Screen-A'],options),['screen-a']);
});
test('ambiguous receiver aliases cannot fall through to a group',()=>{
 assert.deepEqual(expandDisplayTargets(['SCREEN-A'],{devices,displayGroups:{'screen-a':['OnlyUpper']}}),[]);
});
const source=fs.readFileSync(require.resolve('../src/server'),'utf8').replace(/\r\n/g,'\n');
function block(a,b){const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return source.slice(x,y)}
function context(){
 const ctx=vm.createContext({devices,cleanId:v=>String(v||'').toLowerCase(),crypto:require('node:crypto'),musicAssistantProxyTickets:new Map(),musicAssistantProxyTicketByDevice:new Map()});
 vm.runInContext(block('function cleanId(','function cookieValue('),ctx);return ctx;
}
test('direct dispatch rejects ambiguous and malformed aliases before group fallback',()=>{
 const ctx=context();ctx.displayGroups={'screen-a':['OnlyUpper'],group:['OnlyUpper']};
 vm.runInContext(block('function resolveDisplayTargets(','function commandId('),ctx);
 assert.deepEqual(Array.from(ctx.resolveDisplayTargets('SCREEN-A')),[]);
 assert.deepEqual(Array.from(ctx.resolveDisplayTargets('group!')),[]);
 assert.deepEqual(Array.from(ctx.resolveDisplayTargets('GROUP')),['OnlyUpper']);
});
test('direct and scheduled group members resolve the same unique receiver aliases',()=>{
 const ctx=context();ctx.displayGroups={group:['onlyupper','missing']};vm.runInContext(block('function resolveDisplayTargets(','function commandId('),ctx);
 assert.deepEqual(Array.from(ctx.resolveDisplayTargets('group')),expandDisplayTargets(['group'],{devices,displayGroups:ctx.displayGroups}));
 assert.deepEqual(Array.from(ctx.resolveDisplayTargets('group')),['OnlyUpper']);
});
test('physical announcement locks use the exact receiver output mapping',()=>{
 const ctx=context();vm.runInContext(block('function automationTvPowerPhysicalLocks(','function timerLinkedClassChain('),ctx);
 assert.deepEqual(Array.from(ctx.automationTvPowerPhysicalLocks({output:1},['Screen-A'])),['Screen-A']);
 assert.deepEqual(Array.from(ctx.automationTvPowerPhysicalLocks({output:2},['Screen-A'])),[]);
});
test('Music Assistant tickets retain distinct exact receiver and player identities',()=>{
 const ctx=context();ctx.pruneMusicAssistantProxyTickets=()=>{};
 vm.runInContext(block('function issueMusicAssistantProxyTicket(','function consumeMusicAssistantProxyTicket('),ctx);
 const upper=ctx.issueMusicAssistantProxyTicket('Screen-A'),lower=ctx.issueMusicAssistantProxyTicket('screen-a');
 assert.equal(upper.playerId,'classroom-hub-Screen-A');assert.equal(lower.playerId,'classroom-hub-screen-a');
 assert.equal(ctx.musicAssistantProxyTickets.size,2);assert.equal(ctx.musicAssistantProxyTickets.get(upper.ticket).deviceId,'Screen-A');
});
test('AV output inference uses the exact configured receiver mapping',()=>{
 const ctx=context();vm.runInContext(block('function plutoActionForCommand(','const wsClients ='),ctx);
 assert.equal(ctx.plutoActionForCommand({type:'av.route',target:'Screen-A',payload:{input:1}}).output,1);
 assert.equal(ctx.plutoActionForCommand({type:'av.cecOutput',target:'Screen-A',payload:{index:0}}).output,1);
});
for(const kind of ['media','audio'])test(`${kind} control routes retain the exact receiver target`,async()=>{
 const ctx=context(),calls=[];let route;
 Object.assign(ctx,{app:{post:(_url,...handlers)=>route=handlers.at(-1)},schedulerMutationLimit(){},requireControl(){},displayMedia:require('../src/display-media'),displayAudio:{describe:()=>({})},persistentState:{displays:{}},executeCommand:async value=>{calls.push(value);return {ok:true}},audit(){}});
 vm.runInContext(kind==='media'?block('app.post("/api/v1/displays/:id/media/control"','app.get("/api/v1/displays/audio"'):block('app.post("/api/v1/displays/:id/audio"','function startManagedManualAutomation('),ctx);
 let status=200;const res={status(value){status=value;return res},json(){return res}};
 await route({params:{id:'Screen-A'},body:{action:'volume',volume:.2}},res);assert.equal(status,200);assert.deepEqual(Array.from(calls[0].target),['Screen-A']);
});
test('MQTT receiver observations retain exact identities and reject ambiguous aliases',()=>{
 const ctx=context(),events=[];Object.assign(ctx,{runtime:{displays:{}},broadcastControllers:event=>events.push(event),publicDisplayStatus:id=>ctx.runtime.displays[id]});
 vm.runInContext('function receive(topic,payload){'+block('const dm = topic.match(','    try{\n    const cm=')+'}',ctx);
 ctx.receive('classroom/v2/display/Screen-A/presence',{online:true});assert.equal(events[0].deviceId,'Screen-A');assert.equal(ctx.runtime.displays['screen-a'],undefined);
 ctx.receive('classroom/v2/display/SCREEN-A/presence',{online:true});assert.equal(events.length,1);
});
test('Music Assistant player observation preserves exact receiver identity',()=>{
 const ctx=context();vm.runInContext(block('function musicAssistantTvDeviceIdFromPlayerId(','function musicAssistantTvAudioState('),ctx);
 assert.equal(ctx.musicAssistantTvDeviceIdFromPlayerId('classroom-hub-Screen-A'),'Screen-A');
 assert.equal(ctx.musicAssistantTvDeviceIdFromPlayerId('classroom-hub-SCREEN-A'),null);
 assert.equal(ctx.musicAssistantTvDeviceIdFromPlayerId('classroom-hub-ONLYUPPER'),'OnlyUpper');
});
test('Music Assistant audio state remains separate for exact case peers',()=>{
 const ctx=context();let saved={'Screen-A':{volume:20},'screen-a':{volume:80}};
 Object.assign(ctx,{MUSIC_ASSISTANT_TV_DEFAULT_VOLUME:20,dbStore:{getPreference:()=>saved,setPreference:(_key,value)=>saved=value}});
 vm.runInContext(block('function musicAssistantTvAudioState(','const musicAssistantTvAudioWrites='),ctx);
 assert.equal(ctx.musicAssistantTvAudioState('Screen-A').volume,20);ctx.setMusicAssistantTvAudioState('Screen-A',{volume:30});
 assert.equal(saved['Screen-A'].volume,30);assert.equal(saved['screen-a'].volume,80);
});
test('unambiguous legacy lowercase audio preferences remain readable without rewriting them',()=>{
 const ctx=context();let saved={onlyupper:{volume:40}};
 Object.assign(ctx,{MUSIC_ASSISTANT_TV_DEFAULT_VOLUME:20,dbStore:{getPreference:()=>saved,setPreference:(_key,value)=>saved=value}});
 vm.runInContext(block('function musicAssistantTvAudioState(','const musicAssistantTvAudioWrites='),ctx);
 assert.equal(ctx.musicAssistantTvAudioState('OnlyUpper').volume,40);ctx.setMusicAssistantTvAudioState('OnlyUpper',{volume:50});
 assert.equal(saved.OnlyUpper.volume,50);assert.equal(saved.onlyupper.volume,40);
});
