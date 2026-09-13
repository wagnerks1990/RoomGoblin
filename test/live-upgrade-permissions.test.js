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

test("ADB upgrade accepts empty or complete stores and rejects partial or linked keys",t=>{
  const {spawnSync}=require("node:child_process");
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"rgb-adb-"));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const mount=path.join(dir,"classroom-control-hub-android-adb","_data");
  fs.mkdirSync(mount,{recursive:true,mode:0o700});
  const source=fs.readFileSync("host-agent/app-update-runner.sh","utf8");
  const fn=source.slice(source.indexOf("ensure_adb_runtime_layout(){"),source.indexOf("ensure_runtime_layout(){"));
  const run=(fail="")=>spawnSync("bash",["-c",'set -eu\ndocker(){ printf "%s\\n" "$TEST_MOUNT"; }\nchown(){ test "$TEST_FAIL" != chown; }\nchmod(){ test "$TEST_FAIL" != chmod && command chmod "$@"; }\n'+fn+'\nensure_adb_runtime_layout || exit 1'],{env:{...process.env,DOCKER_VOLUMES_ROOT:dir,TEST_MOUNT:mount,TEST_FAIL:fail},encoding:"utf8"});
  assert.equal(run().status,0);
  assert.equal(fs.statSync(mount).mode&0o777,0o750);
  assert.deepEqual(fs.readdirSync(mount),[]);
  for(const operation of ["chmod","chown"])assert.notEqual(run(operation).status,0);
  const key=path.join(mount,"adbkey"),pub=key+".pub";
  fs.writeFileSync(key,"private",{mode:0o600});
  assert.notEqual(run().status,0);
  assert.equal(fs.statSync(key).mode&0o777,0o600);
  fs.writeFileSync(pub,"public",{mode:0o600});
  for(let i=0;i<2;i++)assert.equal(run().status,0);
  for(const [file,bytes] of [[key,"private"],[pub,"public"]]){
    assert.equal(fs.statSync(file).mode&0o777,0o640);
    assert.equal(fs.readFileSync(file,"utf8"),bytes);
  }
  fs.unlinkSync(pub);fs.symlinkSync(key,pub);
  assert.notEqual(run().status,0);
});
