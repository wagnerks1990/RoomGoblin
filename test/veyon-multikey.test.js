"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const crypto=require("node:crypto");

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-veyon-keyring-"));
const dbFile=path.join(tempDir,"hub.db"),masterKeyFile=path.join(tempDir,"master.key");
fs.writeFileSync(masterKeyFile,crypto.randomBytes(32).toString("hex"),{mode:0o600});
process.env.DATA_DIR=tempDir;
process.env.DATABASE_FILE=dbFile;
process.env.MASTER_KEY_FILE=masterKeyFile;
process.env.VEYON_PRIVATE_KEY_FILE=path.join(tempDir,"missing-legacy-key");

const {runtimeVeyonKeyring,secretNameForKey,shouldFallbackAuthentication}=require("../src/veyon-keyring");
const {bufferedVeyonFetch,veyonResponseError}=require("../src/veyon-transport");

const privateKeyLabel=["PRIVATE","KEY"].join(" ");
const privateKeyHeader=["BEGIN",privateKeyLabel].join(" ");
const pem=name=>`-----${privateKeyHeader}-----\n${Buffer.from(`fixture-${name}`).toString("base64")}\n-----${["END",privateKeyLabel].join(" ")}-----`;

test.after(()=>{
  try{runtimeVeyonKeyring.storage().db.close()}catch{}
  fs.rmSync(tempDir,{recursive:true,force:true});
});

test("named Veyon keys use encrypted secret slots and expose metadata only",()=>{
  runtimeVeyonKeyring.importKey("primary-fixture",pem("primary"),{preferred:false});
  runtimeVeyonKeyring.importKey("secondary-fixture",pem("secondary"),{preferred:true});
  const meta=runtimeVeyonKeyring.metadata();
  assert.deepEqual(meta.keyNames,["primary-fixture","secondary-fixture"]);
  assert.equal(meta.preferredKeyName,"secondary-fixture");
  assert.match(secretNameForKey("secondary-fixture"),/^veyon\.private-key\.[a-f0-9]{24}$/);
  assert.equal(JSON.stringify(meta).includes(privateKeyHeader),false);
  const encrypted=runtimeVeyonKeyring.storage().db.prepare("SELECT cipher_text FROM secret_store WHERE name=?").get(secretNameForKey("secondary-fixture"));
  assert.ok(encrypted?.cipher_text);
  assert.equal(encrypted.cipher_text.includes(privateKeyHeader),false);
});

test("authentication tries preferred key then falls back only after explicit key rejection",async()=>{
  const calls=[];
  const fetchImpl=async(_url,options)=>{
    const body=JSON.parse(options.body);calls.push(body.credentials.keyname);
    if(body.credentials.keyname==="secondary-fixture")return new Response(JSON.stringify({error:{code:4}}),{status:401,headers:{"content-type":"application/json"}});
    return new Response(JSON.stringify({"connection-uid":"ok"}),{status:200,headers:{"content-type":"application/json"}});
  };
  const response=await bufferedVeyonFetch("http://127.0.0.1:11080/api/v1/authentication/192.0.2.25",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({method:"test",credentials:{keyname:"primary-fixture",keydata:pem("primary")}})},fetchImpl);
  assert.equal(response.status,200);
  assert.deepEqual(calls,["secondary-fixture","primary-fixture"]);
  assert.equal(runtimeVeyonKeyring.hostPreferred("192.0.2.25"),"primary-fixture");
});

test("connection-pool exhaustion does not spray alternate credentials",async()=>{
  runtimeVeyonKeyring.setPreferred("secondary-fixture");
  const calls=[];
  const fetchImpl=async(_url,options)=>{
    calls.push(JSON.parse(options.body).credentials.keyname);
    return new Response(JSON.stringify({error:{code:7}}),{status:429,headers:{"content-type":"application/json"}});
  };
  const response=await bufferedVeyonFetch("http://127.0.0.1:11080/api/v1/authentication/192.0.2.26",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({method:"test",credentials:{keyname:"primary-fixture",keydata:pem("primary")}})},fetchImpl);
  assert.equal(response.status,429);
  assert.deepEqual(calls,["secondary-fixture"]);
  const error=await veyonResponseError(response);
  assert.equal(error.veyonCode,7);
  assert.equal(shouldFallbackAuthentication(error),false);
});

test("startup recovery loads the Veyon keyring bridge before server routes",()=>{
  const recovery=fs.readFileSync(path.join(__dirname,"..","src","startup-recovery.js"),"utf8");
  assert.match(recovery,/require\("\.\/veyon-keyring-bridge"\);\s*require\("\.\/maintenance-route-bridge"\);\s*require\("\.\/server"\);/);
  const ui=fs.readFileSync(path.join(__dirname,"..","public","controller","veyon-keyring-ui.js"),"utf8");
  assert.match(ui,/\/api\/v1\/admin\/veyon-keys/);
  assert.match(ui,/Key material is never displayed after import/);
});
