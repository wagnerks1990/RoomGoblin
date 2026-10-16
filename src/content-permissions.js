"use strict";

const fs=require("node:fs");

// Only call for uploaded classroom content, never data/, identities or secrets.
// Creation modes are masked by the intentionally private process umask. Apply
// the shared-reader contract explicitly, including after copies and conversions.
function contentMode(file,directory){
  const before=fs.lstatSync(file);
  if(before.isSymbolicLink())throw Error("Symbolic classroom content is not permitted");
  const flags=fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0);
  const fd=fs.openSync(file,flags);
  try{
    const stat=fs.fstatSync(fd);
    if(stat.dev!==before.dev||stat.ino!==before.ino)throw Error("Classroom content changed before publication");
    if(directory?!stat.isDirectory():!stat.isFile())throw Error("Unexpected classroom content file type");
    if(!directory&&stat.nlink!==1)throw Error("Hard-linked classroom content is not permitted");
    fs.fchmodSync(fd,directory?0o750:0o640);
  }finally{fs.closeSync(fd)}
}
function contentDirectory(dir,{recursive=true}={}){
  fs.mkdirSync(dir,{recursive,mode:0o750});
  contentMode(dir,true);
}
function contentFile(file){contentMode(file,false)}

module.exports={contentDirectory,contentFile};
