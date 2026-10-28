"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const {ClassroomHubStorage}=require("../src/storage"),{sendspinEndpoint}=require("../src/music-assistant-sendspin");
const source=fs.readFileSync(path.join(__dirname,"../src/server.js"),"utf8");
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>0&&b>a,start);return source.slice(a,b)}
function fixture(t,failure=null){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rg-music-config-")),key=path.join(dir,"master-key");
  fs.writeFileSync(key,crypto.randomBytes(32));
  const db=new ClassroomHubStorage({dataDir:dir,dbFile:path.join(dir,"test.db"),masterKeyFile:key});
  t.after(()=>{db.db.close();assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep+"rg-music-config-"));fs.rmSync(dir,{recursive:true,force:true})});
  const original={url:"http://old.example.test",browserUrl:"",tvBridgeEnabled:true,sendspinHost:"old.example.test",sendspinPort:8927};
  db.setPreference("musicassistant.config",original);db.putSecret("musicassistant.token","old-fixture-token");db.tx(()=>{});
  const put=db.putSecret.bind(db),set=db.setPreference.bind(db),exec=db.db.exec.bind(db.db);
  let writes=0,route,closes=0,audits=0,atClose;
  db.putSecret=(...args)=>{writes++;if(failure==="secret")throw Error("fixture secret failure");const result=put(...args);if(failure==="secret-after-write")throw Error("fixture post-secret failure");return result};
  db.setPreference=(...args)=>{writes++;const result=set(...args);if(failure==="metadata-after-write")throw Error("fixture post-metadata failure");return result};
  db.db.exec=sql=>{if(sql==="COMMIT"&&failure==="commit")throw Error("fixture commit failure");return exec(sql)};
  const ctx=vm.createContext({URL,app:{put:(_path,...handlers)=>{route=handlers.at(-1)}},musicAssistantMutationLimit(){},requireAdmin(){},
    musicAssistantConfig:()=>db.getPreference("musicassistant.config"),sendspinEndpoint,dbStore:db,
    musicAssistantApiClose:reason=>{assert.equal(reason,"configuration-changed");assert.equal(db.transactionDepth,0);atClose={config:db.getPreference("musicassistant.config"),token:db.getSecret("musicassistant.token")};closes++},
    musicAssistantToken:()=>db.getSecret("musicassistant.token"),audit:()=>{audits++}});
  vm.runInContext(section("function optionalBrowserHttpUrl(","\nfunction ")+section('app.put("/api/v1/music-assistant/config"','\napp.get("/api/v1/music-assistant/background/queue"'),ctx);
  return {db,original,setFailure:value=>{failure=value},get closes(){return closes},get audits(){return audits},get writes(){return writes},get atClose(){return atClose},
    unchanged(){assert.deepEqual(db.getPreference("musicassistant.config"),original);assert.equal(db.getSecret("musicassistant.token"),"old-fixture-token");assert.equal(closes,0);assert.equal(audits,0);assert.equal(db.transactionDepth,0)},
    save(body={url:"http://new.example.test",token:"new-fixture-token"}){let status=200,result;const res={status(value){status=value;return res},json(value){result=JSON.parse(JSON.stringify(value));return res}};route({body},res);return {status,body:result}}};
}
for(const failure of ["secret","secret-after-write","metadata-after-write","commit"])test("Music settings and encrypted token roll back after "+failure,t=>{
  const h=fixture(t,failure);assert.equal(h.save().status,400);h.unchanged();
});
test("Music settings activate only after the complete encrypted identity commits",t=>{
  const h=fixture(t),result=h.save();assert.equal(result.status,200);
  assert.deepEqual(result.body,{ok:true,url:"http://new.example.test",browserUrl:"",tokenStored:true});
  assert.deepEqual(h.atClose,{config:{...h.original,url:"http://new.example.test"},token:"new-fixture-token"});
  assert.equal(h.closes,1);assert.equal(h.audits,1);
  const encrypted=h.db.db.prepare("SELECT cipher_text FROM secret_store WHERE name=?").get("musicassistant.token").cipher_text;
  assert.notEqual(Buffer.from(encrypted,"base64").toString("utf8"),"new-fixture-token");
});
for(const token of [undefined,""])test("Music settings retain the stored token when "+(token===undefined?"omitted":"blank"),t=>{
  const h=fixture(t),result=h.save({url:"http://new.example.test",...(token===undefined?{}:{token})});
  assert.equal(result.status,200);assert.equal(h.db.getSecret("musicassistant.token"),"old-fixture-token");assert.equal(h.closes,1);assert.equal(h.writes,1);
});
for(const [label,body] of [
  ["unsupported URL",{url:"ftp://example.test"}],
  ["embedded credentials",{url:"http://fixture:fixture@example.test"}],
  ["browser URL",{browserUrl:"javascript:void(0)"}],
  ["Sendspin port",{sendspinPort:70000}]
])test("Invalid "+label+" leaves Music identity untouched",t=>{
  const h=fixture(t);assert.equal(h.save(body).status,400);h.unchanged();assert.equal(h.writes,0);
});
test("A failed Music identity save can be retried without premature connection reset",t=>{
  const h=fixture(t,"secret-after-write");assert.equal(h.save().status,400);h.unchanged();h.setFailure(null);
  assert.equal(h.save().status,200);assert.equal(h.db.getSecret("musicassistant.token"),"new-fixture-token");assert.equal(h.closes,1);assert.equal(h.audits,1);
});
