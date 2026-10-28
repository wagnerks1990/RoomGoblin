'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../public/managed-displays/agent-capability-ui.js'),'utf8');
function fixture(){let now=1000;const calls=[],devices=new Map([['one',{id:'one',createdAt:'old',host:'192.0.2.1'}],['two',{id:'two',createdAt:'old',host:'192.0.2.2'}]]);const ctx=vm.createContext({deviceById:id=>devices.get(id),performance:{now:()=>now},fetch:()=>new Promise((resolve,reject)=>calls.push({resolve:v=>resolve({ok:true,json:async()=>({capabilities:v})}),reject}))});vm.runInContext(source.slice(source.indexOf('  const cache'),source.indexOf('  function set('))+';globalThis.readCaps=getCaps;',ctx);return{ctx,calls,devices,advance:delta=>now+=delta,read:id=>ctx.readCaps(id)}}
test('same-display capability readers share pending transport',async()=>{const h=fixture(),a=h.read('one'),b=h.read('one');try{assert.equal(h.calls.length,1)}finally{h.calls.forEach(c=>c.resolve({version:'current'}));await Promise.all([a,b])}});
test('replacement enrollment never inherits cached capabilities',async()=>{const h=fixture(),a=h.read('one');h.calls[0].resolve({version:'old'});await a;h.devices.set('one',{id:'one',createdAt:'new',host:'192.0.2.2'});const b=h.read('one');try{assert.equal(h.calls.length,2)}finally{h.calls[1]?.resolve({version:'new'});await b}});
test('retired completion cannot replace newer capability cache',async()=>{const h=fixture(),a=h.read('one');h.devices.set('one',{id:'one',createdAt:'new',host:'192.0.2.2'});const b=h.read('one');h.calls[1].resolve({version:'new'});await b;h.calls[0].resolve({version:'old'});await a;assert.equal((await h.read('one')).version,'new')});
test('removed enrollment cannot serve a retained capability cache',async()=>{const h=fixture(),a=h.read('one');h.calls[0].resolve({version:'old'});await a;h.devices.delete('one');assert.equal(await h.read('one'),null)});
test('independent displays retain concurrent capability reads',async()=>{const h=fixture(),a=h.read('one'),b=h.read('two');assert.equal(h.calls.length,2);h.calls.forEach(c=>c.resolve({version:'current'}));await Promise.all([a,b])});

test('ordinary metadata redraws retain a fresh capability cache until its monotonic expiry',async()=>{
 const h=fixture(),a=h.read('one');h.calls[0].resolve({version:'current'});await a;
 h.devices.set('one',{...h.devices.get('one'),name:'Renamed'});h.advance(29999);
 assert.equal((await h.read('one')).version,'current');assert.equal(h.calls.length,1);
 h.advance(1);const next=h.read('one');assert.equal(h.calls.length,2);h.calls[1].resolve({version:'refreshed'});assert.equal((await next).version,'refreshed');
});
test('current capability failure permits an explicit subsequent read',async()=>{
 const h=fixture(),a=h.read('one');h.calls[0].reject(Error('Synthetic unavailable'));await assert.rejects(a,/Synthetic unavailable/);
 const b=h.read('one');assert.equal(h.calls.length,2);h.calls[1].resolve({version:'recovered'});assert.equal((await b).version,'recovered');
});
test('retired capability failure cannot evict the newer cache',async()=>{
 const h=fixture(),a=h.read('one');h.devices.set('one',{...h.devices.get('one'),host:'192.0.2.3'});
 const b=h.read('one');h.calls[1].resolve({version:'current'});await b;
 h.calls[0].reject(Error('Synthetic old failure'));await assert.rejects(a,/Synthetic old failure/);
 assert.equal((await h.read('one')).version,'current');assert.equal(h.calls.length,2);
});
test('new Agent v2 configuration retires a cached capability response',async()=>{
 const h=fixture(),a=h.read('one');h.calls[0].resolve({version:'old'});await a;
 h.devices.get('one').agentV2={port:8765,configuredAt:'new-configuration'};
 const b=h.read('one');assert.equal(h.calls.length,2);h.calls[1].resolve({version:'new'});assert.equal((await b).version,'new');
});
function cardsFixture(){
 const h=fixture(),renders=[],cards=[];
 h.ctx.root={contains:card=>card.connected,querySelectorAll:()=>cards};h.ctx.render=(card,value)=>renders.push({card,value});
 vm.runInContext(source.slice(source.indexOf('  async function scanCard('),source.indexOf('  // Inventory refresh')),h.ctx);
 return{...h,renders,cards};
}
test('detached cards cannot render late capability replies while the replacement shares that read',async()=>{
 const h=cardsFixture(),old={dataset:{id:'one'},connected:true},current={dataset:{id:'one'},connected:true};
 const a=h.ctx.scanCard(old);old.connected=false;const b=h.ctx.scanCard(current);assert.equal(h.calls.length,1);
 h.calls[0].resolve({version:'current'});await Promise.all([a,b]);assert.equal(h.renders.length,1);assert.equal(h.renders[0].card,current);
 assert.equal(old.dataset.capUiBusy,undefined);assert.equal(current.dataset.capUiBusy,undefined);
});
test('card completion cannot render after its enrollment identity changes',async()=>{
 const h=cardsFixture(),card={dataset:{id:'one'},connected:true},a=h.ctx.scanCard(card);
 h.devices.set('one',{...h.devices.get('one'),createdAt:'replacement'});h.calls[0].resolve({version:'retired'});await a;
 assert.equal(h.renders.length,0);assert.equal(card.dataset.capUiBusy,undefined);
});
test('inventory scans prune capability caches for removed enrollments',async()=>{
 const h=cardsFixture(),old=h.devices.get('one'),a=h.read('one');h.calls[0].resolve({version:'old'});await a;
 h.devices.delete('one');h.ctx.scan();h.devices.set('one',old);
 const b=h.read('one');assert.equal(h.calls.length,2);h.calls[1].resolve({version:'new'});await b;
});
