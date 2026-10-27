"use strict";

const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const net=require("node:net");
const {spawn}=require("node:child_process");
const {once}=require("node:events");
const {setTimeout:delay}=require("node:timers/promises");

const root=path.resolve(__dirname,"../..");
const start=require("../../package.json").scripts.start;
const linux={skip:process.platform!=="linux"?"Requires Linux signal and /proc child-lifecycle semantics":false,timeout:25000};
async function port(){const server=net.createServer();server.listen(0,"127.0.0.1");await once(server,"listening");const value=server.address().port;await new Promise(resolve=>server.close(resolve));return value}
async function waitFor(check,description){
  const end=Date.now()+10000;
  while(Date.now()<end){if(await check())return;await delay(40)}
  throw new Error(`Timed out: ${description}`);
}
async function launch(t,{preload=null,directory=null,receivers=false,mockMqtt=false,gateway=false,maintenanceUrl=null}={}){
  const dir=directory||fs.mkdtempSync(path.join(os.tmpdir(),"roomgoblin-lifecycle-"));
  if(receivers)fs.writeFileSync(path.join(dir,"runtime-config.json"),JSON.stringify({devices:{tv1:{name:"Test receiver",enabled:true}}}));
  const control=await port(),media=await port();
  const master=path.join(dir,"master.key");fs.writeFileSync(master,Buffer.alloc(32,23),{mode:0o600});
  // Only test-owned configuration enters this subprocess; never inherit a
  // developer's configured classroom integrations or credentials.
  const env={PATH:process.env.PATH,HOME:dir,TZ:"UTC",DATA_DIR:dir,DATABASE_FILE:path.join(dir,"hub.db"),MASTER_KEY_FILE:master,
    PORT:String(control),MEDIA_PLANE_PORT:String(media),BIND_ADDRESS:"127.0.0.1",MQTT_URL:"",MAINTENANCE_PROXY_ENABLED:"false",MAINTENANCE_TOKEN:"lifecycle-test-maintenance",TRUST_PROXY_HOPS:"0",SETUP_TOKEN:"lifecycle-test-setup"};
  const [command,...args]=start.split(/\s+/);assert.equal(command,"node");
  if(mockMqtt){env.MQTT_URL="mqtt://127.0.0.1:1883";env.SHUTDOWN_MQTT_FIXTURE="1"}
  if(gateway)env.DISPLAY_GATEWAY_ALLOWED_HOSTS="example.invalid";
  if(maintenanceUrl){env.MAINTENANCE_URL=maintenanceUrl;env.MAINTENANCE_PROXY_ENABLED="true"}
  if(preload)args.unshift("--require",preload);
  const child=spawn(process.execPath,args,{cwd:root,env,stdio:["ignore","pipe","pipe"]});
  const exited=once(child,"exit");let output="",mediaPid=null;
  child.stdout.on("data",data=>{output+=data});child.stderr.on("data",data=>{output+=data});
  t.after(async()=>{
    if(child.exitCode===null&&child.signalCode===null){child.kill("SIGKILL");await exited}
    if(mediaPid)try{process.kill(mediaPid,"SIGKILL")}catch{}
    fs.rmSync(dir,{recursive:true,force:true});
  });
  const healthy=async p=>{try{const response=await fetch(`http://127.0.0.1:${p}/health`,{signal:AbortSignal.timeout(300)});await response.arrayBuffer();return response.ok}catch{return false}};
  await waitFor(async()=>{
    assert.equal(child.exitCode,null,output);assert.equal(child.signalCode,null,output);
    return await healthy(control)&&await healthy(media);
  },"both npm-start listeners");
  const children=fs.readFileSync(`/proc/${child.pid}/task/${child.pid}/children`,"utf8").trim().split(/\s+/).filter(Boolean).map(Number);
  mediaPid=children.find(pid=>{try{return fs.readFileSync(`/proc/${pid}/cmdline`,"utf8").includes("media-server.js")}catch{return false}});
  assert.ok(mediaPid,"the application must own the media child");
  return {dir,child,exited,control,media,mediaPid,output:()=>output};
}

module.exports={launch,waitFor,linux};
