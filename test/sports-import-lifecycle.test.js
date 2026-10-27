"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http"),{setTimeout:delay}=require("node:timers/promises");
const {launch,waitFor,linux}=require("./helpers/lifecycle-process.cjs");
for(const boundary of ["freeze","shutdown"])for(const reject of [false,true])test(`disconnected Sports PDF import drains across ${boundary} on ${reject?"failure":"success"}`,linux,async t=>{
  const app=await launch(t,{preload:path.join(__dirname,"fixtures/sports-import-work.cjs")}),base=`http://127.0.0.1:${app.control}`;
  const admin=await fetch(base+"/api/v1/setup/administrator",{method:"POST",headers:{"content-type":"application/json","x-setup-token":"lifecycle-test-setup"},body:JSON.stringify({username:"sports-admin",password:"test-only-long-password"})});assert.equal(admin.status,201);await admin.text();
  const cookie=admin.headers.get("set-cookie").split(";",1)[0];
  if(reject)fs.writeFileSync(path.join(app.dir,"reject-pdf-import"),"");
  const payload=Buffer.from('--fixture-boundary\r\nContent-Disposition: form-data; name="file"; filename="fixture.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-fixture\r\n--fixture-boundary--\r\n');
  const req=http.request(base+"/api/v1/sports/import/roster",{method:"POST",headers:{cookie,"content-type":"multipart/form-data; boundary=fixture-boundary","content-length":payload.length}});req.on("error",()=>{});req.on("response",res=>res.resume());req.end(payload);t.after(()=>req.destroy());
  await waitFor(()=>fs.existsSync(path.join(app.dir,"pdf-import-entered")),"PDF parser entry");req.destroy();await delay(80);
  const internal=(route,body)=>fetch(base+"/api/v1/internal/maintenance/"+route,{method:"POST",headers:{"content-type":"application/json","x-maintenance-token":"lifecycle-test-maintenance"},body:JSON.stringify(body)});
  let freezing,acknowledged=false;
  if(boundary==="freeze")freezing=internal("export-freeze",{confirm:"FREEZE_FULL_EXPORT"}).then(r=>{acknowledged=true;return r});else app.child.kill("SIGTERM");
  await delay(150);
  if(boundary==="freeze")assert.equal(acknowledged,false,"freeze discarded the callback's accepted import");else assert.equal(app.child.exitCode,null,"shutdown discarded the callback's accepted import");
  fs.writeFileSync(path.join(app.dir,"release-pdf-import"),"");
  if(boundary==="freeze"){
    const frozen=await freezing;assert.equal(frozen.status,200);const {freezeToken}=await frozen.json();assert.ok(fs.existsSync(path.join(app.dir,"pdf-import-finished")));
    const thaw=await internal("export-thaw",{freezeToken});assert.equal(thaw.status,200);await thaw.text();app.child.kill("SIGTERM");
  }
  assert.deepEqual(await app.exited,[0,null],app.output());assert.ok(fs.existsSync(path.join(app.dir,"pdf-import-finished")));
});
