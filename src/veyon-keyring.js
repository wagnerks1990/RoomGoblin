"use strict";

const fs=require("fs");
const path=require("path");
const crypto=require("crypto");
const {ClassroomHubStorage}=require("./storage");

const KEYRING_PREF="veyon.keyring";
const HOST_KEY_PREF="veyon.auth-key-hosts";
const LEGACY_SECRET="veyon.private-key";
const MAX_KEYS=32;
const MAX_HOST_PREFERENCES=512;

function normalizeKeyName(value){
  const name=String(value||"").trim();
  if(!name||name.length>128||/[\u0000-\u001f\u007f]/.test(name))throw new Error("Veyon key name must be 1-128 printable characters");
  return name;
}
function secretNameForKey(keyName){
  const name=normalizeKeyName(keyName);
  return `veyon.private-key.${crypto.createHash("sha256").update(name).digest("hex").slice(0,24)}`;
}
function validPrivateKey(value){
  const key=String(value||"").trim();
  return key.includes("BEGIN")&&key.includes("PRIVATE KEY");
}
function defaultPaths(){
  const dataDir=path.resolve(process.env.DATA_DIR||path.join(__dirname,"..","data"));
  return {
    dataDir,
    dbFile:String(process.env.DATABASE_FILE||path.join(dataDir,"classroom-control-hub.db")),
    masterKeyFile:String(process.env.MASTER_KEY_FILE||"/run/secrets/classroom-control-hub-master-key")
  };
}

class VeyonKeyring{
  constructor({storage=null,storageFactory=null}={}){
    this._storage=storage;
    this._storageFactory=storageFactory||(()=>new ClassroomHubStorage(defaultPaths()));
  }
  storage(){
    if(!this._storage)this._storage=this._storageFactory();
    return this._storage;
  }
  ring(){
    const raw=this.storage().getPreference(KEYRING_PREF,{})||{};
    const names=[];
    for(const value of Array.isArray(raw.keyNames)?raw.keyNames:[]){
      try{const name=normalizeKeyName(value);if(!names.includes(name))names.push(name)}catch{}
    }
    let preferred="";
    try{preferred=raw.preferredKeyName?normalizeKeyName(raw.preferredKeyName):""}catch{}
    if(preferred&&!names.includes(preferred))names.unshift(preferred);
    return {version:1,keyNames:names.slice(0,MAX_KEYS),preferredKeyName:preferred||names[0]||""};
  }
  saveRing(ring){
    const names=[];
    for(const value of Array.isArray(ring?.keyNames)?ring.keyNames:[]){
      const name=normalizeKeyName(value);if(!names.includes(name))names.push(name);
    }
    let preferred="";
    try{preferred=ring?.preferredKeyName?normalizeKeyName(ring.preferredKeyName):""}catch{}
    if(preferred&&!names.includes(preferred))names.unshift(preferred);
    const next={version:1,keyNames:names.slice(0,MAX_KEYS),preferredKeyName:preferred||names[0]||""};
    this.storage().setPreference(KEYRING_PREF,next);
    return next;
  }
  getKey(keyName){
    const name=normalizeKeyName(keyName);
    try{return String(this.storage().getSecret(secretNameForKey(name))||"")}catch{return ""}
  }
  hasKey(keyName){return !!this.getKey(keyName)}
  importKey(keyName,privateKey,{preferred=false}={}){
    const name=normalizeKeyName(keyName),key=String(privateKey||"").trim();
    if(!validPrivateKey(key))throw new Error("Veyon private key must be PEM-formatted private-key material");
    const store=this.storage(),ring=this.ring();
    if(!ring.keyNames.includes(name)&&ring.keyNames.length>=MAX_KEYS)throw new Error(`Veyon supports at most ${MAX_KEYS} stored authentication keys`);
    store.putSecret(secretNameForKey(name),key,{type:"private-key",integration:"veyon",keyName:name,keyring:true});
    if(!ring.keyNames.includes(name))ring.keyNames.push(name);
    if(preferred||!ring.preferredKeyName)ring.preferredKeyName=name;
    this.saveRing(ring);
    return name;
  }
  removeKey(keyName){
    const name=normalizeKeyName(keyName),store=this.storage(),ring=this.ring();
    store.deleteSecret(secretNameForKey(name));
    ring.keyNames=ring.keyNames.filter(item=>item!==name);
    if(ring.preferredKeyName===name)ring.preferredKeyName=ring.keyNames[0]||"";
    this.saveRing(ring);
    const hosts=store.getPreference(HOST_KEY_PREF,{})||{};
    for(const [host,value] of Object.entries(hosts))if(value===name)delete hosts[host];
    store.setPreference(HOST_KEY_PREF,hosts);
    return this.metadata();
  }
  setPreferred(keyName){
    const name=normalizeKeyName(keyName),ring=this.ring();
    if(!ring.keyNames.includes(name)||!this.hasKey(name))throw new Error("Veyon key is not stored");
    ring.preferredKeyName=name;this.saveRing(ring);return this.metadata();
  }
  currentLegacy(){
    const store=this.storage();
    const cfg=store.getPreference("integrations.connections",{})||{};
    let keyName=String(cfg?.veyon?.keyName||process.env.VEYON_KEY_NAME||"ClassroomControlHub").trim()||"ClassroomControlHub";
    try{keyName=normalizeKeyName(keyName)}catch{keyName="ClassroomControlHub"}
    let privateKey="";
    try{privateKey=String(store.getSecret(LEGACY_SECRET)||"")}catch{}
    if(!privateKey){
      const file=String(process.env.VEYON_PRIVATE_KEY_FILE||"").trim();
      if(file)try{privateKey=fs.readFileSync(file,"utf8")}catch{}
    }
    return {keyName,privateKey};
  }
  captureLegacy(){
    const legacy=this.currentLegacy();
    if(!validPrivateKey(legacy.privateKey))return legacy;
    const ring=this.ring(),stored=this.getKey(legacy.keyName);
    if(stored!==String(legacy.privateKey).trim())this.importKey(legacy.keyName,legacy.privateKey,{preferred:!ring.preferredKeyName});
    else if(!ring.keyNames.includes(legacy.keyName)){
      ring.keyNames.push(legacy.keyName);if(!ring.preferredKeyName)ring.preferredKeyName=legacy.keyName;this.saveRing(ring);
    }
    return legacy;
  }
  observeCredential(keyName,privateKey){
    const name=normalizeKeyName(keyName),key=String(privateKey||"").trim();
    if(!validPrivateKey(key))return name;
    if(this.getKey(name)!==key)this.importKey(name,key,{preferred:!this.ring().preferredKeyName});
    return name;
  }
  hostPreferred(host){
    const value=(this.storage().getPreference(HOST_KEY_PREF,{})||{})[String(host||"")];
    try{return value?normalizeKeyName(value):""}catch{return ""}
  }
  rememberHost(host,keyName){
    const target=String(host||"").trim();if(!target)return;
    const name=normalizeKeyName(keyName),store=this.storage(),prefs=store.getPreference(HOST_KEY_PREF,{})||{};
    if(prefs[target]===name)return;
    delete prefs[target];prefs[target]=name;
    const entries=Object.entries(prefs);
    while(entries.length>MAX_HOST_PREFERENCES){const [stale]=entries.shift();delete prefs[stale]}
    store.setPreference(HOST_KEY_PREF,prefs);
  }
  moveHostPreference(fromHost,toHost){
    const from=String(fromHost||"").trim(),to=String(toHost||"").trim();
    if(!from||!to||from===to)return false;
    const store=this.storage(),prefs=store.getPreference(HOST_KEY_PREF,{})||{};
    const value=prefs[from];if(!value)return false;
    try{normalizeKeyName(value)}catch{return false}
    delete prefs[from];delete prefs[to];prefs[to]=value;
    const entries=Object.entries(prefs);
    while(entries.length>MAX_HOST_PREFERENCES){const [stale]=entries.shift();delete prefs[stale]}
    store.setPreference(HOST_KEY_PREF,prefs);return true;
  }
  orderedCredentials(host,original={}){
    const originalName=normalizeKeyName(original.keyName||"ClassroomControlHub"),originalKey=String(original.privateKey||"");
    if(validPrivateKey(originalKey))this.observeCredential(originalName,originalKey);
    try{this.captureLegacy()}catch{}
    const ring=this.ring(),order=[];
    const add=name=>{if(name&&ring.keyNames.includes(name)&&!order.includes(name))order.push(name)};
    add(this.hostPreferred(host));add(ring.preferredKeyName);add(originalName);for(const name of ring.keyNames)add(name);
    const out=[];
    for(const name of order){const privateKey=name===originalName&&validPrivateKey(originalKey)?originalKey:this.getKey(name);if(validPrivateKey(privateKey))out.push({keyName:name,privateKey})}
    if(!out.length&&validPrivateKey(originalKey))out.push({keyName:originalName,privateKey:originalKey});
    return out.slice(0,MAX_KEYS);
  }
  metadata(){
    try{this.captureLegacy()}catch{}
    const ring=this.ring(),configured=ring.keyNames.filter(name=>this.hasKey(name));
    return {keyNames:configured,preferredKeyName:configured.includes(ring.preferredKeyName)?ring.preferredKeyName:(configured[0]||""),count:configured.length};
  }
}

function shouldFallbackAuthentication(error){
  const code=Number(error?.veyonCode);
  return [4,5,6].includes(code);
}

const runtimeVeyonKeyring=new VeyonKeyring();
module.exports={VeyonKeyring,runtimeVeyonKeyring,normalizeKeyName,secretNameForKey,validPrivateKey,shouldFallbackAuthentication,KEYRING_PREF,HOST_KEY_PREF};
