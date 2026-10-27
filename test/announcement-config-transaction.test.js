"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const {ClassroomHubStorage}=require("../src/storage"),{validTime}=require("../src/school-schedule");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a,start);return source.slice(a,b)}
const oldUrl="https://media.example.test/old",newUrl="https://media.example.test/new",secret="automation.morning-announcements.stream-url";
function fixture(t,{failure=null,legacy=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rg-announcement-tx-")),key=path.join(dir,"master-key"),file=path.join(dir,"morning-announcements.json");
 fs.writeFileSync(key,crypto.randomBytes(32));
 const store=new ClassroomHubStorage({dataDir:dir,dbFile:path.join(dir,"test.db"),masterKeyFile:key});
 t.after(()=>{store.db.close();assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep+"rg-announcement-tx-"));fs.rmSync(dir,{recursive:true,force:true})});
 const original={enabled:true,streamUrl:oldUrl,startTime:"07:00",endTime:"08:30",targets:["screen"],volumePercent:50,checkIntervalSeconds:15,offlineConfirmations:6};
 const {streamUrl,...plain}=original,saved={...plain,streamUrlConfigured:true};
 store.putSecret(secret,oldUrl);store.writeJson(file,saved);if(legacy)fs.writeFileSync(file,JSON.stringify(original),{mode:0o600});
 store.tx(()=>{});
 const exec=store.db.exec.bind(store.db),put=store.putSecret.bind(store);
 store.db.exec=sql=>{if(sql==="COMMIT"&&failure?.startsWith("commit"))throw Error("fixture commit failure");return exec(sql)};
 store.putSecret=(...args)=>{if(failure==="secret")throw Error("fixture secret failure");const value=put(...args);if(failure==="secret-after-write")throw Error("fixture post-secret failure");return value};
 const safeFs={...fs,openSync:(...args)=>{if(failure==="legacy-open")throw Error("fixture legacy open failure");return fs.openSync(...args)},writeFileSync:(...args)=>{if(failure==="legacy-write")throw Error("fixture legacy write failure");return fs.writeFileSync(...args)},renameSync:(...args)=>{if(failure==="legacy-rename")throw Error("fixture legacy rename failure");return fs.renameSync(...args)}};
 let route,restarts=0,volumes=0;
 const ctx=vm.createContext({Date,Object,JSON,crypto,process,fs:safeFs,dbStore:store,morningAnnouncements:original,morningAnnouncementsRuntime:{},
  MORNING_ANNOUNCEMENTS_FILE:file,MORNING_ANNOUNCEMENTS_URL_SECRET:secret,DEFAULT_MORNING_ANNOUNCEMENTS_URL:"",REDACTED_CONFIG_VALUE:"REDACTED",validTime,cleanId:String,
  validateMorningAnnouncementsUrl:value=>value,persistJson:(_file,value)=>{if(failure==="metadata")throw Error("fixture metadata failure");store.writeJson(file,value);if(failure==="metadata-after-write")throw Error("fixture post-metadata failure")},
  app:{put:(_path,...handlers)=>{route=handlers.at(-1)}},requireCapability:()=>()=>{},
  restartMorningAnnouncementsWatcher:()=>{assert.equal(store.transactionDepth,0);assert.equal(store.getSecret(secret)||"",ctx.morningAnnouncements.streamUrl);assert.equal(store.readJson(file,{}).enabled,ctx.morningAnnouncements.enabled);restarts++},serializeMorningAnnouncementsLifecycle:fn=>fn(),applyMorningAnnouncementVolume:async()=>{volumes++;return {applied:true}},
  publicProjection:value=>value,publicMorningAnnouncementsConfig:()=>({enabled:ctx.morningAnnouncements.enabled})
 });
 vm.runInContext(section("function normalizeMorningAnnouncements(","const storedMorningAnnouncements=")+
  section("function persistMorningAnnouncements(","// Migrate legacy plaintext")+
  section('app.put("/api/v1/automations/morning-announcements"','app.post("/api/v1/automations/morning-announcements/check"'),ctx);
 async function save(body={enabled:false,streamUrl:newUrl,volumePercent:25}){let status=200,result;const res={status(value){status=value;return res},json(value){result=value;return res}};await route({body},res);return {status,body:result}}
 function unchanged(){assert.equal(ctx.morningAnnouncements,original);assert.equal(store.getSecret(secret),oldUrl);assert.deepEqual(store.readJson(file,{}),saved);assert.equal(restarts,0);assert.equal(volumes,0);assert.equal(store.transactionDepth,0)}
 return {ctx,store,dir,file,original,saved,save,unchanged,setFailure:value=>{failure=value},get restarts(){return restarts},get volumes(){return volumes}};
}
for(const failure of ["secret","secret-after-write","metadata","metadata-after-write","legacy-open","legacy-write","legacy-rename","commit","commit-legacy"])test("announcement settings preserve live and durable identity after "+failure+" failure",async t=>{
 const h=fixture(t,{failure,legacy:failure.startsWith("legacy")||failure==="commit-legacy"}),result=await h.save();
 assert.equal(result.status,400);h.unchanged();assert.equal(fs.readdirSync(h.dir).some(name=>name.includes(".redacted-")),false);
});
test("a successful announcement save commits the secret and redacted metadata before projection",async t=>{
 const h=fixture(t,{legacy:true});assert.equal((await h.save()).status,200);
 assert.equal(h.store.getSecret(secret),newUrl);assert.equal(h.store.readJson(h.file,{}).enabled,false);assert.equal(h.ctx.morningAnnouncements.enabled,false);
 assert.equal(h.restarts,1);assert.equal(h.volumes,1);assert.equal(h.store.transactionDepth,0);
 const {streamUrl:_secret,...expected}=JSON.parse(JSON.stringify(h.ctx.morningAnnouncements));
 assert.deepEqual(JSON.parse(fs.readFileSync(h.file,"utf8")),{...expected,streamUrlConfigured:true});
 assert.equal(fs.readdirSync(h.dir).some(name=>name.includes(".redacted-")),false);
 if(process.platform!=="win32")assert.equal(fs.statSync(h.file).mode&0o777,0o600);
});
test("clearing a stream rolls its secret deletion back if configuration persistence fails",async t=>{
 const h=fixture(t,{failure:"metadata"});assert.equal((await h.save({streamUrl:""})).status,400);h.unchanged();
});
test("a successful explicit stream clear keeps configuration and secret storage consistent",async t=>{
 const h=fixture(t);assert.equal((await h.save({streamUrl:""})).status,200);
 assert.equal(h.store.hasSecret(secret),false);assert.equal(h.store.readJson(h.file,{}).streamUrlConfigured,false);assert.equal(h.ctx.morningAnnouncements.streamUrl,"");
 assert.equal(h.restarts,1);assert.equal(h.volumes,0);
});
test("a failed settings write can be retried without a premature watcher or volume command",async t=>{
 const h=fixture(t,{failure:"metadata"});assert.equal((await h.save()).status,400);h.unchanged();h.setFailure(null);
 assert.equal((await h.save()).status,200);assert.equal(h.store.getSecret(secret),newUrl);assert.equal(h.restarts,1);assert.equal(h.volumes,1);
});
test("startup persistence still scrubs legacy plaintext without dispatching",t=>{
 const h=fixture(t,{legacy:true});h.ctx.persistMorningAnnouncements();
 assert.equal(h.store.getSecret(secret),oldUrl);assert.deepEqual(JSON.parse(fs.readFileSync(h.file,"utf8")),h.saved);
 assert.equal(h.restarts,0);assert.equal(h.volumes,0);assert.equal(h.store.transactionDepth,0);
});
