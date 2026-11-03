'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createEffectAdapter}=require('../src/learning-effects');
test('typed effects use only catalog assets, bounded clips and explicit targets',async()=>{
 const calls=[],adapter=createEffectAdapter({catalog:()=>({displays:[{id:'screen'}],lights:[{id:'light'}],assets:[{id:'sound',kind:'sound',url:'/learn/effects/chime.wav'}]}),available:()=>true,execute:async(...args)=>{calls.push(args);return {ok:true};}}),context={admitted:()=>true,board:[{firstName:'Alex',earned:40,possible:50}]};
 assert.equal((await adapter({kind:'sound',targets:['screen'],assetId:'unknown',volume:.2},context)).ok,false);assert.equal(calls.length,0);
 await adapter({kind:'sound',targets:['screen'],assetId:'sound',volume:.2},context);assert.equal(calls[0][0].payload.endAtSeconds,8);assert.equal(calls[0][0].payload.loop,false);assert.equal(calls[0][0].source,'learning-effects');assert.ok(calls[0][1].admission());
});
test('revoking classroom admission between light writes prevents the next write',async()=>{
 let admitted=true,calls=0;const adapter=createEffectAdapter({catalog:()=>({lights:[{id:'a'},{id:'b'}]}),available:()=>true,execute:async()=>{calls++;admitted=false;return {ok:true};}});assert.equal((await adapter({kind:'lights',targets:['a','b'],color:'#008800'},{admitted:()=>admitted})).ok,false);assert.equal(calls,1);
});
test('arcade projection sends only names, period, arcade points, level and completion',async()=>{
 const calls=[],adapter=createEffectAdapter({catalog:()=>({displays:[{id:'screen'}]}),available:()=>true,execute:async c=>{calls.push(c);return {ok:true};}});
 await adapter({kind:'arcade-board',targets:['screen']},{admitted:()=>true,title:'Continuing arcade',offset:0,count:1,board:[{firstName:'Alex',period:'P2',arcadeScore:5000,level:2,board:3,answered:10,total:55,completed:1,assignments:20,earned:9,possible:50,checkpoint:'secret'}]});
 const text=calls[0].payload.text;assert.ok(text.includes('5,000'));assert.ok(text.includes('P2'));assert.ok(!text.includes('secret'));assert.ok(!text.includes('9 / 50'));
});
test('refreshing a transient board does not flash the scheduled screen between updates',()=>{
 const html=fs.readFileSync(require.resolve('../public/display/index.html'),'utf8'),start=html.indexOf('let transientLearning=null;'),end=html.indexOf('function applyState(s){',start),calls=[];
 const ctx=vm.createContext({Date,setTimeout:()=>1,clearTimeout(){},applyState:s=>calls.push(['restore',s]),handle:c=>calls.push(['command',c])});vm.runInContext(html.slice(start,end),ctx);
 const message={command:{type:'display.text'},transient:{expiresAt:Date.now()+8000,previousState:{text:'Lesson'}}};ctx.receiveDisplayCommand(message);ctx.receiveDisplayCommand(message);assert.deepEqual(calls.map(c=>c[0]),['command','command']);ctx.receiveDisplayCommand({command:{type:'display.title'}});assert.deepEqual(calls.map(c=>c[0]),['command','command','restore','command']);
});
test('native receiver expires transient effects and restores before a new command without replay',()=>{
 const html=fs.readFileSync(require.resolve('../public/display/index.html'),'utf8'),start=html.indexOf('let transientLearning=null;'),end=html.indexOf('function applyState(s){',start),calls=[],timers=[];
 const ctx=vm.createContext({Date,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},applyState:s=>calls.push(['restore',s]),handle:c=>calls.push(['command',c])});vm.runInContext(html.slice(start,end),ctx);
 const original={text:'Scheduled lesson'};ctx.receiveDisplayCommand({command:{type:'display.video'},transient:{expiresAt:Date.now()+8000,previousState:original}});assert.equal(calls[0][0],'command');timers[0]();assert.equal(calls[1][1],original);
 calls.length=0;ctx.receiveDisplayCommand({command:{type:'display.text'},transient:{expiresAt:Date.now()-1,previousState:original}});assert.equal(calls.length,0);
 ctx.receiveDisplayCommand({command:{type:'display.image'},transient:{expiresAt:Date.now()+8000,previousState:original}});ctx.receiveDisplayCommand({command:{type:'display.title'}});assert.deepEqual(calls.map(c=>c[0]),['command','restore','command']);
});
function router(){
 const source=fs.readFileSync(require.resolve('../src/server'),'utf8'),start=source.indexOf('async function executeCommand('),end=source.indexOf('\n}',start)+2,calls=[],displays={screen:{text:'Scheduled lesson'}},control={admitted:true,before:async()=>{}};
 const ctx=vm.createContext({Date,Promise,URL_BEARING_DISPLAY_COMMANDS:new Set(),normalizeCommand:c=>({...c,id:'synthetic',payload:c.payload||{}}),validateCommandForDispatch:c=>c,engageManualMediaPriority:async()=>{await control.before();return null;},resolveDisplayTargets:x=>x,announcementPriorityError:()=>null,persistentState:{displays},physicalDisplayState:id=>displays[id],updateStateFromCommand:()=>calls.push('persist'),broadcastDisplays:(ids,message)=>{calls.push({message});return ids;},broadcastDisplayPreviews:()=>calls.push('preview'),MQTT_JSON_BRIDGE:true,MQTT_LEGACY_BRIDGE:true,runtime:{mqtt:{connected:true}},toLegacyCommand:()=>'',mqttPublish:()=>calls.push('mqtt'),backgroundMusicObserveDisplayCommand:()=>calls.push('music'),audit(){},broadcastControllers(){},diagnosticError(){}});vm.runInContext(source.slice(start,end),ctx);return {ctx,calls,displays,control,run:()=>ctx.executeCommand({type:'display.text',target:['screen'],payload:{text:'Alex · 40 / 50'}},'automation',{admission:()=>control.admitted})};
}
test('native router transmits an expiring effect without persisting state or replaying over MQTT',async()=>{const f=router();assert.equal((await f.run()).ok,true);assert.equal(f.calls.length,1);assert.equal(f.calls[0].message.transient.previousState.text,'Scheduled lesson');assert.ok(f.calls[0].message.transient.expiresAt>Date.now());assert.equal(f.displays.screen.text,'Scheduled lesson');});
test('native router rechecks admission after await and refuses to interrupt active media',async()=>{const f=router();f.control.before=async()=>{f.control.admitted=false;};assert.equal((await f.run()).skipped,true);assert.equal(f.calls.length,0);f.control.before=async()=>{};f.control.admitted=true;f.displays.screen.media={type:'video'};assert.equal((await f.run()).reason,'active-media');assert.equal(f.calls.length,0);});
