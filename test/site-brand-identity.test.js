"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {ClassroomHubStorage}=require("../src/storage");

const expectedIdentity={productName:"RoomGoblin",descriptor:"Classroom & Lab Management Hub",tagline:"Run the room. Manage the lab.",logoUrl:"/brand/roomgoblin_app_192x192.png",faviconUrl:"/brand/roomgoblin_app_32x32.png"};

test("legacy site branding is projected without mutating storage; saves fix product identity and retain assignments",()=>{
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-site-brand-"));
  const store=new ClassroomHubStorage({dataDir,masterKeyFile:path.join(dataDir,"absent.key")});
  try{
    const legacy={school:"Example School",room:"Science Lab",displayPrefix:"Panel",timezone:"Europe/London",productName:"Custom Product",descriptor:"Custom descriptor",tagline:"Custom tagline",logoUrl:"/media/custom-school.svg",faviconUrl:"https://assets.example.test/icon.ico",theme:{mode:"light",primary:"#123456",accent:"#654321",background:"#ffffff",surface:"#eeeeee",text:"#112233"},revision:7,updatedAt:"2025-01-01T00:00:00.000Z"};
    const uploadedFile=path.join(dataDir,"custom-school.svg");
    fs.writeFileSync(uploadedFile,"existing uploaded artwork");
    store.setSetting("site.profile",legacy);
    const before=store.db.prepare("SELECT value_json,updated_at FROM site_settings WHERE key='site.profile'").get();
    const projected=store.getAdminConfig().site;
    for(const [key,value] of Object.entries(expectedIdentity))assert.equal(projected[key],value);
    for(const key of ["school","room","displayPrefix","timezone","theme","revision","updatedAt"])assert.deepEqual(projected[key],legacy[key]);
    assert.deepEqual(store.getSetting("site.profile"),legacy);
    assert.deepEqual(store.db.prepare("SELECT value_json,updated_at FROM site_settings WHERE key='site.profile'").get(),before);

    const saved=store.putSiteProfile({...legacy,school:"Updated School"});
    for(const [key,value] of Object.entries(expectedIdentity))assert.equal(saved[key],value);
    assert.equal(saved.school,"Updated School");
    for(const key of ["room","displayPrefix","timezone","theme"])assert.deepEqual(saved[key],legacy[key]);
    assert.equal(saved.revision,8);
    assert.notEqual(saved.updatedAt,legacy.updatedAt);
    assert.deepEqual(store.getSetting("site.profile"),saved);
    assert.equal(fs.readFileSync(uploadedFile,"utf8"),"existing uploaded artwork");
  }finally{
    store.db.close();
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
});
