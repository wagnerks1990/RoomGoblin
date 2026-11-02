"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {ClassroomHubStorage}=require('../src/storage'),{serviceUrl}=require('../src/network');
const source=fs.readFileSync(require.resolve('../src/server'),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
function fixture(t,kind){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rg-settings-identity-')),key=path.join(dir,'master-key');fs.writeFileSync(key,crypto.randomBytes(32));
 const store=new ClassroomHubStorage({dataDir:dir,masterKeyFile:key});
 t.after(()=>{store.db.close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('rg-settings-identity-'));fs.rmSync(dir,{recursive:true,force:true})});
 const names=['github.update.token','integration.mqtt.password','veyon.private-key'];for(const name of names)store.putSecret(name,'fixture-original');store.tx(()=>{});
 let route,live,effects=0,audits=0;
 const activate=()=>{assert.equal(store.transactionDepth,0);effects++};
 const ctx=vm.createContext({URL,serviceUrl,app:{put:(_path,...handlers)=>{route=handlers.at(-1)}},requireAdmin(){},appUpdateMutationLimit(){},dbStore:store,
  validTime:v=>/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v),audit:()=>{assert.equal(store.transactionDepth,0);audits++},
  currentIntegrationConnections:()=>live,applyIntegrationConnections:value=>{activate();live=clone(value)},integrationConnectionsView:()=>live,
  plutoStatusReader:{invalidate:activate},runtime:{hardware:{pluto:{}}},PLUTO_URL:'http://old.example.test',MQTT_URL:'mqtt://old.example.test',VEYON_WEBAPI_URL:'http://old.example.test',
  veyonConnectionCache:new Map([['old',{}]]),veyonAuthInFlight:new Map([['old',{}]]),reconnectMqtt:activate});
 vm.runInContext(section('function boundedNumber(','function currentIntegrationConnections(')+section('const TRUSTED_UPDATE_REPOSITORY=','function githubUpdateHeaders('),ctx);
 const preference=kind==='updates'?'updates.policy':'integrations.connections';
 const original=kind==='updates'?clone(ctx.updatePolicy()):clone(ctx.normalizedIntegrationConnections({mqtt:{url:'mqtt://old.example.test'},pluto:{url:'http://old.example.test'},veyon:{url:'http://old.example.test'}}));
 live=clone(original);store.setPreference(preference,original);
 const marker=kind==='updates'?'app.put("/api/v1/admin/app-updates/settings"':'app.put("/api/v1/admin/integration-connections"';
 vm.runInContext(section(marker,'\napp.'),ctx);
 const newBody=kind==='updates'?{automatic:true,token:'fixture-replacement'}:{mqtt:{url:'mqtt://new.example.test',password:'fixture-replacement'},pluto:{url:'http://new.example.test'},veyon:{url:'http://new.example.test',privateKey:crypto.generateKeyPairSync('ed25519',{privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey}};
 return {store,ctx,preference,original,newBody,get effects(){return effects},get audits(){return audits},
  unchanged(){assert.deepEqual(store.getPreference(preference),original);for(const name of names)assert.ok(store.getSecret(name)==='fixture-original','Stored fixture secret changed: '+name);assert.deepEqual(live,original);assert.equal(effects,0);assert.equal(audits,0);assert.equal(store.transactionDepth,0);assert.equal(ctx.veyonConnectionCache.size,1);assert.equal(ctx.veyonAuthInFlight.size,1)},
  async save(body=newBody){let status=200,result;const res={status(value){status=value;return res},json(value){result=clone(value);return res}};await route({body},res);return {status,body:result}}
 };
}
function failWrite(h,table,column,value,operation='UPDATE'){
 const row=operation==='DELETE'?'OLD':'NEW';
 h.store.db.exec(`CREATE TRIGGER fixture_failure BEFORE ${operation} ON ${table} WHEN ${row}.${column}='${value}' BEGIN SELECT RAISE(ABORT,'fixture write failure'); END`);
}
function failCommit(h,table,column,value){
 h.store.db.exec(`CREATE TABLE fixture_parent(id INTEGER PRIMARY KEY);
  CREATE TABLE fixture_child(id INTEGER REFERENCES fixture_parent(id) DEFERRABLE INITIALLY DEFERRED);
  CREATE TRIGGER fixture_failure AFTER UPDATE ON ${table} WHEN NEW.${column}='${value}' BEGIN INSERT INTO fixture_child VALUES(1); END`);
}
for(const failure of ['secret-write','secret-clear','commit'])test(`update settings preserve policy and credential after ${failure}`,async t=>{
 const h=fixture(t,'updates');
 if(failure==='commit')failCommit(h,'secret_store','name','github.update.token');
 else failWrite(h,'secret_store','name','github.update.token',failure==='secret-clear'?'DELETE':'UPDATE');
 const body=failure==='secret-clear'?{automatic:true,clearToken:true}:h.newBody;
 assert.equal((await h.save(body)).status,400);h.unchanged();
 h.store.db.exec('DROP TRIGGER fixture_failure');assert.equal((await h.save(body)).status,200);
 assert.equal(h.store.getPreference(h.preference).automatic,true);assert.equal(h.store.hasSecret('github.update.token'),failure!=='secret-clear');
});
for(const mode of ['replace','clear','retain'])test(`successful update settings ${mode} only the requested credential`,async t=>{
 const h=fixture(t,'updates'),result=await h.save(mode==='replace'?h.newBody:{automatic:true,...(mode==='clear'?{clearToken:true}:{})});
 assert.equal(result.status,200);assert.equal(h.store.getPreference(h.preference).automatic,true);
 assert.equal(h.store.getSecret('github.update.token'),mode==='replace'?'fixture-replacement':mode==='clear'?null:'fixture-original');
 assert.equal(h.store.getSecret('integration.mqtt.password'),'fixture-original');assert.equal(h.audits,1);
 assert.equal(JSON.stringify(result.body).includes('fixture-'),false);
});
test('invalid Veyon key cannot replace the MQTT password before rejecting settings',async t=>{
 const h=fixture(t,'integrations');const body=clone(h.newBody);body.veyon.privateKey='invalid fixture';
 assert.equal((await h.save(body)).status,400);h.unchanged();
});
for(const failure of ['second-secret','metadata','commit'])test(`integration settings preserve all credentials and runtime after ${failure}`,async t=>{
 const h=fixture(t,'integrations');
 if(failure==='commit')failCommit(h,'system_preferences','key',h.preference);
 else if(failure==='metadata')failWrite(h,'system_preferences','key',h.preference);
 else failWrite(h,'secret_store','name','veyon.private-key');
 assert.equal((await h.save()).status,400);h.unchanged();
 h.store.db.exec('DROP TRIGGER fixture_failure');assert.equal((await h.save()).status,200);
 assert.equal(h.store.getSecret('integration.mqtt.password'),'fixture-replacement');assert.equal(h.effects,3);
});
test('successful integration save commits metadata and both credentials before activation',async t=>{
 const h=fixture(t,'integrations'),result=await h.save();assert.equal(result.status,200);
 assert.equal(h.store.getPreference(h.preference).mqtt.url,'mqtt://new.example.test');assert.equal(h.store.getSecret('integration.mqtt.password'),'fixture-replacement');
 assert.ok(h.store.getSecret('veyon.private-key')===h.newBody.veyon.privateKey.trim());assert.equal(h.effects,3);assert.equal(h.audits,1);
 assert.equal(h.ctx.veyonConnectionCache.size,0);assert.equal(h.ctx.veyonAuthInFlight.size,0);
 assert.equal(/fixture-|PRIVATE KEY/.test(JSON.stringify(result.body)),false);assert.equal(/fixture-|PRIVATE KEY/.test(JSON.stringify(h.store.getPreference(h.preference))),false);
});
test('accepted integration settings retire earlier hardware observation evidence',async t=>{
 const h=fixture(t,'integrations');h.ctx.goveeDevices={lamp:{id:'fixture'}};
 h.ctx.runtime.hardware.pluto.lastSuccessAt='2026-01-01T00:00:00.000Z';
 h.ctx.runtime.hardware.govee={configured:true,lastSuccessAt:'2026-01-01T00:00:00.000Z',lastError:null};
 const result=await h.save();assert.equal(result.status,200);
 assert.equal(h.ctx.runtime.hardware.pluto.lastSuccessAt,null);assert.equal(h.ctx.runtime.hardware.govee.lastSuccessAt,null);
});
