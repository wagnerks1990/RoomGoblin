"use strict";
// This module runs only in a prlimit-isolated child, never on the Hub event loop.
let started=false;
process.once('disconnect',()=>process.exit(0));
process.on('message',async bytes=>{
 if(started)return;started=true;
 try{
  const result=await require('./sports-pdf-core').parse(bytes);
  const message={ok:true,result};
  if(JSON.stringify(message).length>262144)throw Error('Result is too large');
  process.send(message);
 }catch{process.exit(1)}
});
