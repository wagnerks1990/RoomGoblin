"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{spawnSync}=require("node:child_process");
test("native Music Assistant cold upgrade, rollback and recovery boundaries",()=>{
  const result=spawnSync("python3",["-m","unittest","discover","-s","test","-p","host_music_updates_test.py","-v"],{encoding:"utf8",timeout:60000});
  assert.equal(result.status,0,(result.stdout||"")+(result.stderr||""));
});
