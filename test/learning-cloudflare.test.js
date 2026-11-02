'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {mergeRoute,publishStudentConnector}=require('../src/learning-cloudflare');
test('student publication preserves every unrelated ingress option and denies collisions',()=>{
 const config={warp_routing:{enabled:false},ingress:[{hostname:'admin.example.test',service:'http://127.0.0.1:3000',originRequest:{connectTimeout:10}},{hostname:'other.example.test',service:'http://127.0.0.1:9999'},{service:'http_status:404'}]},before=structuredClone(config);
 const next=mergeRoute(config,'learn.example.test');assert.deepEqual(config,before);assert.deepEqual(next.ingress.slice(1,3),config.ingress.slice(0,2));assert.equal(next.ingress[0].service,'http://127.0.0.1:3030');assert.deepEqual(mergeRoute(next,'learn.example.test'),next);
 assert.throws(()=>mergeRoute(config,'admin.example.test'));assert.throws(()=>mergeRoute({ingress:[{service:'http://127.0.0.1:3000'}]},'learn.example.test'));
});
function setup({apps=[],rows=[],ready=true}={}){const prefs=new Map([['learning.platform',{publicEnabled:true,publicOrigin:'https://learn.example.test'}]]),writes=[];const config={ingress:[{hostname:'admin.example.test',service:'http://127.0.0.1:3000'},{service:'http_status:404'}]};const manager={storage:{getPreference:(k,d)=>prefs.get(k)||d,setPreference:(k,v)=>prefs.set(k,v)},saved:()=>({hostname:'admin.example.test',zone:'example.test',ids:{tunnelId:'tunnel',zoneId:'zone',accountId:'account'}}),client:()=>({get:async path=>path.endsWith('/configurations')?{config}:path.includes('/access/apps')?apps:rows,put:async(path,body)=>{writes.push({method:'PUT',path,body});},post:async(path,body)=>{writes.push({method:'POST',path,body});return {id:'dns'};}})};return {manager,writes,prefs,probe:async()=>ready};}
test('publishing makes only an additive route and DNS change, never Access or zone changes',async()=>{const f=setup();const result=await publishStudentConnector(f.manager,{probe:f.probe});assert.equal(result.adminAccessUnchanged,true);assert.equal(f.writes.length,2);assert.ok(f.writes[0].path.endsWith('/configurations'));assert.ok(f.writes[1].path.endsWith('/dns_records'));assert.equal(f.prefs.get('learning.publicRoute').service,'http://127.0.0.1:3030');});
test('exact student route takes precedence over existing wildcard ingress',()=>{const next=mergeRoute({ingress:[{hostname:'*.example.test',service:'http://127.0.0.1:3000'},{service:'http_status:404'}]},'learn.example.test');assert.equal(next.ingress[0].hostname,'learn.example.test');assert.equal(next.ingress[0].service,'http://127.0.0.1:3030');assert.equal(next.ingress[1].hostname,'*.example.test');});
test('new and legacy Access destination fields cannot silently cover the student hostname',async()=>{for(const apps of [[{self_hosted_domains:['learn.example.test/*']}],[{destinations:[{type:'public',uri:'https://learn*.example.test/*'}]}]]){const f=setup({apps});await assert.rejects(()=>publishStudentConnector(f.manager,{probe:f.probe}));assert.equal(f.writes.length,0);}});
test('unready gateway, covering Access application and conflicting DNS fail before publication',async()=>{for(const options of [{ready:false},{apps:[{domain:'*.example.test'}]},{rows:[{type:'A',content:'192.0.2.1'}]}]){const f=setup(options);await assert.rejects(()=>publishStudentConnector(f.manager,{probe:f.probe}));assert.equal(f.writes.length,0);}});
test('republishing retains the original rollback and DNS ownership',async()=>{
 const rows=[],f=setup({rows});await publishStudentConnector(f.manager,{probe:f.probe});
 const first=structuredClone(f.prefs.get('learning.publicRoute.previous'));
 rows.push({id:'dns',type:'CNAME',content:'tunnel.cfargotunnel.com',proxied:true});
 const client=f.manager.client();f.manager.client=()=>({...client,get:async path=>path.endsWith('/configurations')?{config:f.writes[0].body.config}:client.get(path)});
 await publishStudentConnector(f.manager,{probe:f.probe});
 assert.deepEqual(f.prefs.get('learning.publicRoute.previous'),first);assert.equal(f.prefs.get('learning.publicRoute').createdDns,true);
});
test('partial route publication retains its rollback on retry and rejects hostname drift',async()=>{
 const f=setup(),client=f.manager.client();let current;f.manager.client=()=>({...client,get:async path=>path.endsWith('/configurations')&&current?{config:current}:client.get(path),put:async(path,body)=>{current=body.config;await client.put(path,body);},post:async()=>{throw Error('uncertain DNS response');}});
 await assert.rejects(()=>publishStudentConnector(f.manager,{probe:f.probe}));const first=structuredClone(f.prefs.get('learning.publicRoute.previous'));
 f.manager.client=()=>({...client,get:async path=>path.endsWith('/configurations')?{config:current}:client.get(path)});
 await publishStudentConnector(f.manager,{probe:f.probe});assert.deepEqual(f.prefs.get('learning.publicRoute.previous').config,first.config);
 f.prefs.set('learning.platform',{publicEnabled:true,publicOrigin:'https://another.example.test'});const count=f.writes.length;
 await assert.rejects(()=>publishStudentConnector(f.manager,{probe:f.probe}),/rollback information/);assert.equal(f.writes.length,count);
});
