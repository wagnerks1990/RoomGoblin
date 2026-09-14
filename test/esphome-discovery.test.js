"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawnSync}=require("node:child_process");
const {ESPHomeManager,encryptionKey,secretName}=require("../src/esphome");
const {ClassroomHubStorage}=require("../src/storage");

function fixture(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-esp-discovery-")),master=path.join(dir,"master.key");
  fs.writeFileSync(master,crypto.randomBytes(32).toString("hex"));
  const storage=new ClassroomHubStorage({dataDir:dir,dbFile:path.join(dir,"hub.db"),masterKeyFile:master});
  const manager=new ESPHomeManager({storage,autostart:false});
  manager.rpc=async(op)=>op==="probe"?{info:{mac_address:"02:00:00:00:00:44",name:"open-node",esphome_version:"test"}}:{ok:true};
  return {storage,manager,close(){manager.close();storage.db.close();fs.rmSync(dir,{recursive:true,force:true})}};
}

test("blank ESPHome key is accepted only when explicitly allowed",()=>{
  assert.equal(encryptionKey("",{allowEmpty:true}),"");
  assert.throws(()=>encryptionKey(""),/32-byte base64/);
  const key=crypto.randomBytes(32).toString("base64");assert.equal(encryptionKey(key,{allowEmpty:true}),key);
});

test("an intentionally unencrypted native API device can be enrolled without storing a fake secret",async()=>{
  const h=fixture();try{
    const result=await h.manager.save(null,{name:"Open node",address:"10.44.0.9",port:6053,key:""});
    const row=h.manager.records()[0];assert.equal(result.devices[0].hasKey,false);assert.equal(h.storage.hasSecret(secretName(row.id)),false);
    h.manager.live.set(row.id,{generation:row.generation,online:true,error:"",entities:[{id:"0:1",domain:"switch",writable:true,disabledByDefault:false,adminOnly:false}],states:{}});
    h.manager.rpc=async()=>({confirmed:true,status:"state-confirmed"});
    const command=await h.manager.command(row.id,"0:1",{requestId:"keyless-command",command:{state:true}},{owner:"admin"});
    assert.equal(command.confirmed,true);
  }finally{h.close()}
});

test("new ESPHome discovery Python entry points remain syntactically valid",()=>{
  const python=process.env.PYTHON||"python3",run=spawnSync(python,["-m","py_compile","src/esphome/discovery.py","src/esphome/worker_entry.py"],{encoding:"utf8"});
  assert.equal(run.status,0,run.stderr||run.stdout);
});
