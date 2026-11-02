"use strict";
const fs=require('node:fs'),path=require('node:path'),{createHash,randomUUID}=require('node:crypto');
const {inspectUpload}=require('./resumable-upload'),{contentFile}=require('./content-permissions');
function createSportsMediaCache({root,register}){
 return async function ingest(url,{origins,fetchImpl}){
  const cached=fs.readdirSync(root).filter(n=>/^sports-[a-f0-9]{64}\./.test(n));let used=0;for(const name of cached){const stat=fs.lstatSync(path.join(root,name));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Unexpected Sports cache entry');used+=stat.size}if(used>512*1024*1024||cached.length>=200)throw Error('Sports media cache is full; remove unused Sports assets in Media library');
  const response=await fetchImpl(url,{origins,maxBytes:25*1024*1024,timeout:15000});
  const ext=({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif','video/mp4':'.mp4','video/webm':'.webm'})[response.type];if(!ext)throw Error('Sports media must be an image or MP4/WebM');
  if(used+response.body.length>512*1024*1024)throw Error('Sports media cache capacity exceeded');
  const name='sports-'+createHash('sha256').update(response.body).digest('hex')+ext,full=path.join(root,name);
  if(fs.existsSync(full)){contentFile(root,full);inspectUpload(full,name);await register({stored:name,originalName:name,mime:response.type,size:response.body.length});return name}
  const temporary=full+'.'+randomUUID()+'.tmp';
  try{fs.writeFileSync(temporary,response.body,{flag:'wx',mode:0o600});inspectUpload(temporary,name);contentFile(root,temporary);fs.renameSync(temporary,full);await register({stored:name,originalName:name,mime:response.type,size:response.body.length});return name}
  finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary)}
 };
}
module.exports={createSportsMediaCache};
