"use strict";
const {randomUUID}=require("node:crypto");
const ACTIONS=new Set(["open","close","state","send","roots","list","download","chunk","uploadStart","uploadChunk","uploadFinish","pointer","key","clipboard","terminalRead","terminalWrite"]);
const CONTROL_KEYS=new Set(["Backspace","Tab","Enter","Escape","Delete","Home","Left","Up","Right","Down","PageUp","PageDown","End","Insert","Shift","Control","Alt","Meta",...Array.from({length:12},(_,i)=>`F${i+1}`)]);
const fail=message=>{throw Object.assign(Error(message),{status:409})};
function argumentsFor(action,input={}){
  if(!ACTIONS.has(action))fail("Unsupported browser action");
  if(action==="open"){
    if(!["chat","files","control","terminal"].includes(input.kind))fail("Choose chat, files, control, or terminal");
    if(input.kind==="terminal"&&!['cmd','powershell'].includes(input.shell))fail("Choose CMD or Windows PowerShell");
    return {kind:input.kind,...(input.kind==="terminal"?{shell:input.shell}:{})};
  }
  if(action==="send"){
    if(typeof input.text!=="string"||!input.text.length||input.text.length>2000||input.text.includes("\0"))fail("Enter 1–2000 characters");
    return {text:input.text};
  }
  if(["list","download"].includes(action)){
    if(typeof input.path!=="string"||!input.path.length||input.path.length>4096||input.path.includes("\0"))fail("Invalid file path");
    return {path:input.path};
  }
  if(action==="chunk"){
    if(!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>8*1024*1024)fail("Invalid download offset");
    return {offset:input.offset};
  }
  if(action==="uploadStart"){
    const name=typeof input.name==="string"?input.name:"",size=input.size;
    if(!name||name.length>255||name==="."||name===".."||/[\\/\x00-\x1f]/.test(name)||!Number.isSafeInteger(size)||size<0||size>2*1024*1024)fail("Choose one ordinary file up to 2 MiB");
    return {name,size};
  }
  if(action==="uploadChunk"){
    const offset=input.offset,data=input.data;
    if(!Number.isSafeInteger(offset)||offset<0||offset>2*1024*1024||typeof data!=="string"||data.length>174764||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))fail("Invalid upload chunk");
    const bytes=Buffer.from(data,"base64");
    if(!bytes.length||bytes.length>128*1024||bytes.toString("base64")!==data)fail("Invalid upload chunk");
    return {offset,data};
  }
  if(action==="pointer"){
    if(!Number.isInteger(input.x)||!Number.isInteger(input.y)||!Number.isInteger(input.buttons)||input.x<0||input.y<0||input.x>16384||input.y>16384||input.buttons<0||input.buttons>7||![undefined,-1,1].includes(input.wheel))fail("Invalid pointer event");
    return {x:input.x,y:input.y,buttons:input.buttons,...(input.wheel?{wheel:input.wheel}:{}),...inputLease(input)};
  }
  if(action==="key"){
    if(typeof input.key!=="string"||typeof input.pressed!=="boolean"||([...input.key].length!==1&&!CONTROL_KEYS.has(input.key))||input.key.includes("\0"))fail("Unsupported key event");
    return {key:input.key,pressed:input.pressed,...inputLease(input)};
  }
  if(action==="terminalRead"){
    if(!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>Number.MAX_SAFE_INTEGER)fail("Invalid terminal offset");
    return {offset:input.offset};
  }
  if(action==="terminalWrite"){
    if(typeof input.text!=="string"||!input.text.length||input.text.includes("\0")||Buffer.byteLength(input.text,"utf8")>4096)fail("Enter up to 4096 UTF-8 bytes");
    return {text:input.text};
  }
  return {};
}
function inputLease(input){
  if(typeof input.lease!=="string"||!/^[0-9a-f-]{36}$/i.test(input.lease)||!Number.isSafeInteger(input.revision)||input.revision<1||!Number.isSafeInteger(input.sequence)||input.sequence<1)fail("Invalid remote input lease");
  return {lease:input.lease,revision:input.revision,sequence:input.sequence};
}
class BrowserSessions{
  constructor({connect,request,identity,now=Date.now}){Object.assign(this,{connect,request,identity,now});this.sessions=new Map();this.opening=new Set()}
  drop(id){const s=this.sessions.get(id);if(s){s.connection.active=Math.max(0,(s.connection.active||1)-1);this.sessions.delete(id)}}
  prune(){for(const [id,s] of this.sessions)if(this.now()>s.expires&&!s.busy)this.drop(id)}
  async run({owner,computer,action,input,authorize}){
    const args=argumentsFor(action,input);this.prune();authorize();
    const key=computer.id;
    if(action==="open"){
      if(this.opening.has(key)||[...this.sessions.values()].some(s=>s.computer.id===key))fail("Close the existing browser session first");
      if(this.sessions.size+this.opening.size>=8)fail("Eight browser sessions are already open");
      this.opening.add(key);
      let id;
      try{
        const connection=await this.connect(computer.ip);authorize();
        if(!this.identity(computer,connection))fail("Computer identity or connection changed");
        connection.active=(connection.active||0)+1;
        id=randomUUID();const s={owner,computer:{...computer},connection,kind:args.kind,expires:this.now()+(["control","terminal"].includes(args.kind)?600000:900000),busy:true};
        this.sessions.set(id,s);
        const caps=await this.request(s,"capabilities",{});authorize();
        if(caps?.protocol!==1||caps?.[args.kind]!==true)fail("Matching native browser bridge is unavailable");
        if(!this.identity(computer,connection))fail("Computer identity or connection changed");
        const upload=args.kind==="files"&&caps?.upload===true;
        const result=await this.request(s,"open",{session:id,...args});
        if(result?.ok!==true)fail("Native browser session was refused");
        s.busy=false;
        return {ok:true,session:id,kind:s.kind,expiresAt:s.expires,endpointVerified:false,upload};
      }catch(error){if(id)this.drop(id);throw error}finally{this.opening.delete(key)}
    }
    const id=String(input?.session||""),s=this.sessions.get(id);
    if(!s||s.owner!==owner||s.computer.id!==key)fail("Browser session expired or unavailable");
    if(s.busy)fail("Wait for the current browser request");
    if(!this.identity(s.computer,s.connection)){this.drop(id);fail("Computer identity or connection changed; reopen the tool")}
    const allowed=s.kind==="chat"?["close","state","send"]:s.kind==="files"?["close","state","roots","list","download","chunk","uploadStart","uploadChunk","uploadFinish"]:s.kind==="terminal"?["close","state","terminalRead","terminalWrite"]:["close","state","pointer","key","clipboard"];
    if(!allowed.includes(action))fail("Action does not match this browser session");
    s.busy=true;
    try{
      authorize();const result=await this.request(s,action,{session:id,...args});
      if(result?.ok!==true)fail("Native browser request failed; inspect the endpoint before retrying");
      authorize();return project(action,result);
    }finally{s.busy=false;if(action==="close")this.drop(id)}
  }
}
function project(action,result){
  if(action==="state"){
    const entries=Array.isArray(result.entries)?result.entries:[],messages=Array.isArray(result.messages)?result.messages:[];
    if(entries.length>1000||messages.length>100)fail("Native response exceeds browser limits");
    const screens=Array.isArray(result.screens)?result.screens:[];
    if(screens.length>16)fail("Native response exceeds screen limit");
    const frameWidth=Number(result.frameWidth),frameHeight=Number(result.frameHeight),isTerminal=['cmd','powershell'].includes(result.shell);
    if(!isTerminal&&(screens.length||result.frameWidth!==undefined)&&(!Number.isInteger(frameWidth)||!Number.isInteger(frameHeight)||frameWidth<1||frameHeight<1||frameWidth>16384||frameHeight>16384))fail("Invalid remote framebuffer dimensions");
    const lease=/^[0-9a-f-]{36}$/i.test(String(result.lease||""))?String(result.lease):"";
    const frameRevision=Number(result.frameRevision),topology=/^[0-9a-f]{64}$/.test(String(result.topology||""))?String(result.topology):"";
    const ready=result.ready===true&&lease.length===36&&Number.isSafeInteger(frameRevision)&&frameRevision>0&&topology.length===64;
    return {ok:true,pending:result.pending===true,complete:result.complete===true,error:String(result.error||"").slice(0,500),
      path:String(result.path||"").slice(0,4096),fileName:String(result.fileName||"").replace(/[\\/\x00-\x1f]/g,"_").slice(0,255),
      size:Number(result.size),received:Number(result.received),
      entries:entries.map(e=>({name:String(e.name||"").slice(0,4096),dir:e.dir===true,size:Number(e.size)||0})),
      messages:messages.map(m=>({from:String(m.from||"").slice(0,40),text:String(m.text||"").slice(0,2000)})),
      frameWidth,frameHeight,ready,lease,frameRevision,topology,
      terminalReady:result.terminalReady===true,terminalExited:result.terminalExited===true,
      terminalBase:Number.isSafeInteger(Number(result.terminalBase))?Number(result.terminalBase):0,
      terminalEnd:Number.isSafeInteger(Number(result.terminalEnd))?Number(result.terminalEnd):0,
      shell:['cmd','powershell'].includes(result.shell)?result.shell:'',
      screens:screens.map((s,index)=>({index:Number.isInteger(Number(s.index))?Number(s.index):index,name:String(s.name||`Screen ${index+1}`).slice(0,100),x:Number(s.x),y:Number(s.y),width:Number(s.width),height:Number(s.height)})).filter(s=>[s.x,s.y,s.width,s.height].every(Number.isInteger)&&s.x>=0&&s.y>=0&&s.width>0&&s.height>0&&s.x+s.width<=frameWidth&&s.y+s.height<=frameHeight)};
  }
  if(action==="clipboard")return {ok:true,pending:result.pending===true,error:String(result.error||"").slice(0,500),text:typeof result.text==="string"&&Buffer.byteLength(result.text,"utf8")<=8192?result.text:""};
  if(action==="terminalRead"){
    if(typeof result.text!=="string"||Buffer.byteLength(result.text,"utf8")>128*1024||!Number.isSafeInteger(Number(result.cursor))||Number(result.cursor)<0)fail("Invalid native terminal response");
    return {ok:true,text:result.text,cursor:Number(result.cursor),reset:result.reset===true,ready:result.ready===true,exited:result.exited===true,error:String(result.error||"").slice(0,500)};
  }
  if(action==="chunk"){
    if(typeof result.data!=="string"||result.data.length>174764||!/^[A-Za-z0-9+/]*={0,2}$/.test(result.data))fail("Invalid native file chunk");
    return {ok:true,data:result.data};
  }
  return {ok:true,accepted:true,endpointVerified:false};
}
module.exports={BrowserSessions,argumentsFor,project};
