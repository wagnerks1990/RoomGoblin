"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const {ClassroomHubStorage}=require("../src/storage");

test("legacy private database is repaired across reopen and WAL recreation",t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rgb-db-mode-"));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const options={dataDir:dir,masterKeyFile:path.join(dir,"missing")};
  let store=new ClassroomHubStorage(options);
  const db=store.dbFile;
  store.db.close();fs.chmodSync(db,0o600);
  for(let i=0;i<2;i++){
    store=new ClassroomHubStorage(options);
    try{
      store.db.exec("CREATE TABLE IF NOT EXISTS regression(value); INSERT INTO regression VALUES(1)");
      for(const file of [db,db+"-wal",db+"-shm"])assert.equal(fs.statSync(file).mode&0o777,0o660,file);
      assert.equal(store.db.prepare("SELECT count(*) AS n FROM regression").get().n,i+1);
    }finally{store.db.close()}
  }
});

test("pre-rebrand signing pair migrates without changing bytes and repeats safely",t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rgb-signing-"));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const root=path.join(dir,"android-agent"),key=path.join(root,"RoomGoblin-Display-Agent.keystore"),password=path.join(root,"password");
  const old=path.join(dir,"ClassroomHub-Display-Agent.keystore");
  fs.writeFileSync(old,"existing-keystore");fs.writeFileSync(path.join(dir,"password"),"existing-password");
  const source=fs.readFileSync("maintenance-agent/android-tv-agent-artifact.js","utf8");
  const fn=source.slice(source.indexOf("function migrateLegacySigningIdentity()"),source.indexOf("function signerDigest("));
  const context=vm.createContext({fs,path,SIGNING_MOUNT_ROOT:dir,SIGNING_ROOT:root,KEYSTORE:key,PASSWORD_FILE:password,console:{warn(){}},sha256:file=>crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")});
  vm.runInContext(fn+";migrateLegacySigningIdentity();migrateLegacySigningIdentity();",context);
  assert.equal(fs.readFileSync(key,"utf8"),"existing-keystore");
  assert.equal(fs.readFileSync(password,"utf8"),"existing-password");
  assert.ok(fs.existsSync(old));
  fs.writeFileSync(old,"conflicting-key");
  assert.throws(()=>vm.runInContext("migrateLegacySigningIdentity()",context),/Conflicting/);
  assert.equal(fs.readFileSync(key,"utf8"),"existing-keystore");
});
