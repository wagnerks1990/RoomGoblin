"use strict";
const {fork}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const queue=[];let active=false;
const unavailable=()=>Object.assign(Error('Roster PDF could not be processed within resource limits; use the CSV import instead'),{status:422});
function rosterPDF(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length>5242880||!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))return Promise.reject(Error('Choose a PDF under 5 MiB'));
 if(process.platform!=='linux'||!fs.existsSync('/usr/bin/prlimit'))return Promise.reject(Object.assign(Error('PDF import requires Linux resource isolation; use CSV on this host'),{status:503}));
 if(queue.length>=2)return Promise.reject(Object.assign(Error('Roster PDF importer is busy; try again shortly'),{status:429}));
 return new Promise((resolve,reject)=>{queue.push({bytes,resolve,reject});pump()});
}
function pump(){
 if(active||!queue.length)return;active=true;const job=queue.shift();let reply=null,child=null,finished=false,timer=null;
 const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);active=false;if(reply?.ok)job.resolve(reply.result);else job.reject(unavailable());pump()};
 try{
  child=fork(path.join(__dirname,'sports-pdf-worker.js'),[],{
   execPath:'/usr/bin/prlimit',
   execArgv:['--as=2147483648','--data=536870912','--cpu=4:5','--core=0','--',process.execPath,'--jitless','--max-old-space-size=96','--max-semi-space-size=8'],
   env:{PATH:process.env.PATH||'/usr/bin:/bin',LANG:'C.UTF-8',TZ:'UTC',NODE_ENV:'production'},
   stdio:['ignore','ignore','ignore','ipc'],serialization:'advanced'
  });
  timer=setTimeout(()=>child.kill('SIGKILL'),8000);
  child.once('error',()=>{child.kill('SIGKILL');finish()});
  child.once('exit',finish);
  child.once('message',message=>{
   if(message?.ok&&Array.isArray(message.result?.rows)&&message.result.rows.length<=300&&JSON.stringify(message).length<=262144)reply=message;
   child.kill('SIGKILL');
  });
  child.send(job.bytes,error=>{if(error)child.kill('SIGKILL')});
 }catch{child?.kill('SIGKILL');finish()}
}
module.exports={rosterPDF};
