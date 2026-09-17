"use strict";
const {randomUUID}=require("node:crypto");
const ACTIONS=new Set(["open","close","state","send","roots","list","download","chunk"]);
const fail=message=>{throw Object.assign(Error(message),{status:409})};
function argumentsFor(action,input={}){
  if(!ACTIONS.has(action))fail("Unsupported browser action");
  if(action==="open"){
    if(!["chat","files"].includes(input.kind))fail("Choose chat or files");
    return {kind:input.kind};
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
  return {};
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
        id=randomUUID();const s={owner,computer:{...computer},connection,kind:args.kind,expires:this.now()+900000,busy:true};
        this.sessions.set(id,s);
        const caps=await this.request(s,"capabilities",{});authorize();
        if(caps?.protocol!==1||caps?.[args.kind!=="files"?"chat":"files"]!==true)fail("Matching native browser bridge is unavailable");
        if(!this.identity(computer,connection))fail("Computer identity or connection changed");
        const result=await this.request(s,"open",{session:id,...args});
        if(result?.ok!==true)fail("Native browser session was refused");
        s.busy=false;
        return {ok:true,session:id,kind:s.kind,expiresAt:s.expires,endpointVerified:false};
      }catch(error){if(id)this.drop(id);throw error}finally{this.opening.delete(key)}
    }
    const id=String(input?.session||""),s=this.sessions.get(id);
    if(!s||s.owner!==owner||s.computer.id!==key)fail("Browser session expired or unavailable");
    if(s.busy)fail("Wait for the current browser request");
    if(!this.identity(s.computer,s.connection)){this.drop(id);fail("Computer identity or connection changed; reopen the tool")}
    if(s.kind==="chat"&&!["close","state","send"].includes(action)||s.kind==="files"&&action==="send")fail("Action does not match this browser session");
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
    return {ok:true,pending:result.pending===true,complete:result.complete===true,error:String(result.error||"").slice(0,500),
      path:String(result.path||"").slice(0,4096),fileName:String(result.fileName||"").replace(/[\\/\x00-\x1f]/g,"_").slice(0,255),
      size:Number(result.size),received:Number(result.received),
      entries:entries.map(e=>({name:String(e.name||"").slice(0,4096),dir:e.dir===true,size:Number(e.size)||0})),
      messages:messages.map(m=>({from:String(m.from||"").slice(0,40),text:String(m.text||"").slice(0,2000)}))};
  }
  if(action==="chunk"){
    if(typeof result.data!=="string"||result.data.length>174764||!/^[A-Za-z0-9+/]*={0,2}$/.test(result.data))fail("Invalid native file chunk");
    return {ok:true,data:result.data};
  }
  return {ok:true,accepted:true,endpointVerified:false};
}
module.exports={BrowserSessions,argumentsFor,project};
