"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

test("maintenance credential probe reopens an atomically replaced SQLite database",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-maintenance-db-"));
  const file=path.join(dir,"hub.db");
  const script=String.raw`
    const fs=require("node:fs");
    const {DatabaseSync}=require("node:sqlite");
    const file=process.env.DATABASE_FILE;
    const create=(target,withToken)=>{
      const db=new DatabaseSync(target);
      db.exec("CREATE TABLE secret_store(name TEXT PRIMARY KEY)");
      if(withToken)db.prepare("INSERT INTO secret_store(name) VALUES(?)").run("musicassistant.token");
      db.close();
    };
    create(file,false);
    const bridge=require("./src/maintenance-route-bridge");
    if(bridge.musicAssistantTokenConfigured()!==false)throw Error("old database unexpectedly had a token");
    const replacement=file+".replacement";
    create(replacement,true);
    fs.renameSync(replacement,file);
    if(bridge.musicAssistantTokenConfigured()!==true)throw Error("replacement database was not reopened");
    const current=new DatabaseSync(file);
    current.exec("DELETE FROM secret_store");
    if(bridge.musicAssistantTokenConfigured()!==false)throw Error("removed token was cached");
    current.exec("INSERT INTO secret_store VALUES ('musicassistant.token')");
    if(bridge.musicAssistantTokenConfigured()!==true)throw Error("new token was not detected");
    current.close();
    require("./src/music-assistant-readiness").closeMusicAssistantReadiness();
  `;
  try{
    const result=spawnSync(process.execPath,["-e",script],{
      cwd:path.resolve(__dirname,".."),
      env:{...process.env,DATABASE_FILE:file},
      encoding:"utf8",
      timeout:10_000
    });
    assert.equal(result.status,0,result.stderr||result.stdout);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test("registering maintenance routes leaves global timers unchanged",()=>{
  const result=spawnSync(process.execPath,["-e",String.raw`
    const assert=require("node:assert/strict");
    const timeout=global.setTimeout,interval=global.setInterval;
    require("./src/maintenance-route-bridge");
    assert.equal(global.setTimeout,timeout);
    assert.equal(global.setInterval,interval);
  `],{cwd:path.resolve(__dirname,".."),encoding:"utf8",timeout:10000});
  assert.equal(result.status,0,result.stderr||result.stdout);
});

test("missing music credentials cannot suppress a surrounding recovery callback",()=>{
  const result=spawnSync(process.execPath,["-e",String.raw`
    const assert=require("node:assert/strict");
    const nativeTimeout=setTimeout;
    require("./src/maintenance-route-bridge");
    let reconciled=false;
    const backgroundMusicTick=()=>{};
    // Announcement release retries do other work before their music tick.
    setTimeout(()=>{reconciled=true;backgroundMusicTick()},1);
    nativeTimeout(()=>assert.equal(reconciled,true),30);
  `],{cwd:path.resolve(__dirname,".."),env:{...process.env,DATABASE_FILE:""},encoding:"utf8",timeout:10000});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
