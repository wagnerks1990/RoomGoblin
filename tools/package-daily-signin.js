"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),AdmZip=require("adm-zip");
const directory=process.argv[2]||"public/lab-agent/daily-signin";
const version=fs.readFileSync("VERSION","utf8").trim();
const files=["RoomGoblinSignIn.exe","RoomGoblinCredentialProvider.dll"].map(file=>{
  const bytes=fs.readFileSync(path.join(directory,file));
  if(!bytes.length)throw Error(`Empty sign-in artifact: ${file}`);
  return {file,size:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex")};
});
fs.writeFileSync(path.join(directory,"manifest.json"),JSON.stringify({version,files},null,2));
const zip=new AdmZip();
for(const {file} of files)zip.addLocalFile(path.join(directory,file));
zip.addLocalFile(path.join(directory,"manifest.json"));
zip.writeZip(path.join(directory,"RoomGoblinDailySignIn.zip"));
