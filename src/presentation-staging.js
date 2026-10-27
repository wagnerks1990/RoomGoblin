"use strict";

const fs=require("node:fs"),path=require("node:path");
const RENDER_DIRECTORY=/^render-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Run once before accepting uploads or starting conversions. This private tree
// contains expendable renderer output, never presentation originals. Bound the
// scan and plan a whole candidate before deleting any of it. Leave unknown or
// unsafe trees for inspection, rather than following links or changing modes.
function cleanupPresentationStaging(root,{maxEntries=512,maxDirectories=64,maxNodes=8192}={}){
  const result={removed:0,skipped:0,errors:0,limited:false};
  root=path.resolve(root);
  let rootStat;
  try{
    rootStat=fs.lstatSync(root);
    if(!rootStat.isDirectory()||rootStat.isSymbolicLink()){result.skipped++;return result}
  }catch(error){if(error.code!=="ENOENT")result.errors++;return result}
  let scanned=0,candidates=0,remaining=maxNodes;
  const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid&&a.mode===b.mode;
  function plan(file,depth,entries){
    if(remaining--<=0){result.limited=true;throw Error("budget")}
    const stat=fs.lstatSync(file);
    if(depth>8||stat.dev!==rootStat.dev||stat.uid!==rootStat.uid||stat.isSymbolicLink()||
      (!stat.isDirectory()&&(!stat.isFile()||stat.nlink!==1)))throw Error("unsafe");
    if(stat.isDirectory()){
      const dir=fs.opendirSync(file);
      try{let child;while((child=dir.readSync()))plan(path.join(file,child.name),depth+1,entries)}finally{dir.closeSync()}
    }
    entries.push({file,stat});
  }
  let directory;
  try{
    directory=fs.opendirSync(root);
    let entry;
    while((entry=directory.readSync())){
      if(scanned++>=maxEntries){result.limited=true;break}
      if(!RENDER_DIRECTORY.test(entry.name))continue;
      if(candidates++>=maxDirectories||remaining<=0){result.limited=true;break}
      const candidate=path.join(root,entry.name),entries=[];
      // Only application-created directories qualify; a same-named file/link
      // must not become a deletion target.
      if(!entry.isDirectory()||entry.isSymbolicLink()){result.skipped++;continue}
      try{plan(candidate,0,entries)}catch{result.skipped++;continue}
      try{
        if(!same(rootStat,fs.lstatSync(root)))throw Error("root changed");
        for(const item of entries){
          if(!same(item.stat,fs.lstatSync(item.file)))throw Error("entry changed");
          if(item.stat.isDirectory())fs.rmdirSync(item.file);else fs.unlinkSync(item.file);
        }
        result.removed++;
      }catch{result.errors++}
    }
  }catch{result.errors++}finally{directory?.closeSync()}
  return result;
}

module.exports={cleanupPresentationStaging};
