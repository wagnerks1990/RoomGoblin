"use strict";

const fs=require("node:fs");
const path=require("node:path");

// Only call for uploaded classroom content, never data/, identities or secrets.
// Creation modes are masked by the intentionally private process umask. Apply
// the shared-reader contract explicitly, including after copies and conversions.
function contentMode(root,file,directory){
  root=path.resolve(root);file=path.resolve(file);
  if(!file.startsWith(root+path.sep))throw Error("Classroom content is outside its configured root");
  const realRoot=fs.realpathSync(root),parent=fs.realpathSync(path.dirname(file));
  if(parent!==realRoot&&!parent.startsWith(realRoot+path.sep))throw Error("Classroom content parent escapes its configured root");
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
function contentDirectory(root,dir=root,{recursive=true}={}){
  root=path.resolve(root);dir=path.resolve(dir);
  // The configured root is trusted configuration, never a requested child path.
  // Handle it separately so every user-derived child has one strict boundary.
  if(dir===root){fs.mkdirSync(root,{recursive,mode:0o750});contentMode(path.dirname(root),root,true);return;}
  if(!dir.startsWith(root+path.sep))throw Error("Classroom content is outside its configured root");
  // Existing parent links must not redirect directory creation outside the root.
  if(dir!==root){
    let parent=path.dirname(dir);
    while(!fs.existsSync(parent))parent=path.dirname(parent);
    const realRoot=fs.realpathSync(root),realParent=fs.realpathSync(parent);
    if(realParent!==realRoot&&!realParent.startsWith(realRoot+path.sep))throw Error("Classroom content parent escapes its configured root");
  }
  fs.mkdirSync(dir,{recursive,mode:0o750});
  contentMode(root,dir,true);
}
function contentFile(root,file){contentMode(root,file,false)}

module.exports={contentDirectory,contentFile};
