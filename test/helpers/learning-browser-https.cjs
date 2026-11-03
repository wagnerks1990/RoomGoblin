'use strict';
// Ephemeral test-only TLS server. Neither keys nor synthetic credentials leave
// the local machine. Real redirects exercise browser cookie/opener policies.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),https=require('node:https'),http=require('node:http'),{execFileSync}=require('node:child_process');
async function createBrowserHttps(gateway,renderLms,{learnHost='learn.example.test',lmsHost='lms.example.test',scormHost='scorm.example.test'}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'roomgoblin-test-tls-')),key=path.join(dir,'key.pem'),cert=path.join(dir,'cert.pem');
 const openssl=process.env.OPENSSL|| (process.platform==='win32'?'C:\\Program Files\\Git\\usr\\bin\\openssl.exe':'openssl');
 try{execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',key,'-out',cert,'-subj','/CN=learn.example.test'],{stdio:'ignore'});}catch(error){fs.rmSync(dir,{recursive:true,force:true});throw error;}
 const server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(req,res)=>{
  if(req.headers.host.startsWith(learnHost+':')){
   const forward=http.request({hostname:'127.0.0.1',port:gateway.address().port,path:req.url,method:req.method,headers:{...req.headers,'x-forwarded-proto':'https','cf-connecting-ip':'198.51.100.10'}},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});forward.on('error',()=>{res.writeHead(502);res.end();});req.pipe(forward);
  }else if([lmsHost+':',scormHost+':'].some(host=>req.headers.host.startsWith(host))){const result=renderLms(new URL(req.url,'https://'+lmsHost).pathname,req);res.writeHead(result.status||200,{'Content-Type':result.contentType});res.end(result.body);}
  else{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 return {origin:'https://'+learnHost+':'+port,lms:'https://'+lmsHost+':'+port,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}};
}
module.exports={createBrowserHttps};
