"use strict";

const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","src","server.js"),"utf8");
const current="a".repeat(40),target="b".repeat(40);

function fixture({sourceState={},relation="ahead",apiStatus=200,latestCommit=target}={}){
  const saved=new Map(),requests=[],handoffs=[];
  const context={
    APPLICATION_VERSION:"1.0.0-alpha.84",AbortSignal,
    validTime:value=>/^\d{2}:\d{2}$/.test(value),
    dbStore:{getPreference:(key,fallback)=>saved.get(key)||fallback,setPreference:(key,value)=>saved.set(key,value),getSecret:()=>"synthetic"},
    maintenanceAgentApi:async(method,url,body)=>{
      if(method==="GET")return {commit:current,branch:"main",trackedDirty:false,trackedChanges:[],...sourceState};
      handoffs.push({method,url,body});return {ok:true,started:true};
    },
    fetch:async(url,options)=>{
      requests.push({url,options});
      assert.ok(url.startsWith("https://api.github.com/repos/wagnerks1990/RoomGoblin/"));
      assert.equal(options.signal.aborted,false);
      const body=url.includes("/compare/")?{status:relation,ahead_by:2}:
        {sha:latestCommit,commit:{message:"Synthetic merged change\nmore",committer:{date:"2026-10-12T00:00:00Z"}}};
      return {ok:apiStatus===200,status:apiStatus,json:async()=>body};
    }
  };
  const start=source.indexOf('const TRUSTED_UPDATE_REPOSITORY='),end=source.indexOf('async function maintenanceAgentApi(',start);
  assert.ok(start>=0&&end>start,"main-update helpers must be present");
  vm.runInNewContext(source.slice(start,end)+"\nglobalThis.check=githubMainCheck;",context);
  return {context,check:context.check,saved,requests,handoffs};
}

test("main checker selects an exact ancestor update and persists no credential",async()=>{
  const f=fixture(),result=await f.check();
  assert.equal(result.currentCommit,current);assert.equal(result.available.commit,target);
  assert.equal(result.available.commitsAhead,2);assert.equal(result.available.name,"Synthetic merged change");
  assert.equal(f.requests.length,2);assert.ok(f.requests[1].url.endsWith(`/compare/${current}...${target}`));
  assert.equal(f.saved.get("updates.policy").lastAvailable.commit,target);
  assert.equal(JSON.stringify(result).includes("synthetic"),false);
  assert.equal(JSON.stringify(f.saved.get("updates.policy")).includes("synthetic"),false);
});

test("equal main identity needs no compare or deployment",async()=>{
  const f=fixture({latestCommit:current}),result=await f.check({persist:false});
  assert.equal(result.available,null);assert.equal(f.requests.length,1);
  assert.equal(f.saved.size,0);assert.equal(f.handoffs.length,0);
});

test("divergent or locally ahead source cannot offer an update",async()=>{
  for(const relation of ["diverged","behind","unknown"]){
    const f=fixture({relation});await assert.rejects(f.check(),/update is blocked/);
    assert.equal(f.saved.size,0);assert.equal(f.handoffs.length,0);
  }
});

test("unclassified dirty source, unsupported paths and invalid identities fail closed",async()=>{
  for(const sourceState of [
    {trackedDirty:true,trackedChanges:[]},
    {trackedDirty:true,trackedChanges:["src/server.js"]},
    {commit:"invalid"}
  ]){
    const f=fixture({sourceState});await assert.rejects(f.check());
    assert.equal(f.saved.size,0);assert.equal(f.handoffs.length,0);
  }
  const f=fixture({latestCommit:"invalid"});await assert.rejects(f.check(),/valid commit/);
});

test("legacy device configuration retains only the reviewed migration exception",async()=>{
  const f=fixture({sourceState:{trackedDirty:true,trackedChanges:["config/devices.json","config/hardware.json"]}});
  assert.equal((await f.check()).available.commit,target);
  const blocked=fixture({sourceState:{trackedDirty:true,trackedChanges:["config/devices.json","config/schema/custom.json"]}});
  await assert.rejects(blocked.check(),/Tracked local source changes block/);
});

test("GitHub metadata errors leave policy and deployment untouched",async()=>{
  const f=fixture({apiStatus:503});await assert.rejects(f.check(),/GitHub main check failed \(503\)/);
  assert.equal(f.saved.size,0);assert.equal(f.handoffs.length,0);
});

test("install handler rejects stale selections before the exact native handoff",async()=>{
  const f=fixture(),handlers=[];
  Object.assign(f.context,{app:{post:(_url,...callbacks)=>handlers.push(callbacks.at(-1))},requireAdmin:()=>{},appUpdateMutationLimit:()=>{},audit:()=>{}});
  const start=source.indexOf('app.post("/api/v1/admin/app-updates/install",'),end=source.indexOf('\napp.post("/api/v1/admin/app-updates/revert",',start);
  assert.ok(start>=0&&end>start);
  vm.runInNewContext(source.slice(start,end),f.context);
  const response=()=>({statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}});
  const stale=response();await handlers[0]({body:{commit:"c".repeat(40)}},stale);
  assert.equal(stale.statusCode,409);assert.equal(f.handoffs.length,0);
  const fresh=response();await handlers[0]({body:{commit:target}},fresh);
  assert.equal(fresh.statusCode,202);assert.equal(f.handoffs.length,1);
  const handoff=f.handoffs[0];assert.equal(handoff.url,"/app-updates/start");
  assert.equal(handoff.body.action,"published");assert.equal(handoff.body.targetCommit,target);
  assert.equal(handoff.body.confirm,"INSTALL_MAIN");assert.equal(handoff.body.backupName,undefined);
});

// Execute the actual Python projection without importing or starting the Host Agent.
test("Host Agent source projection never reads or exposes credential-bearing origins",()=>{
  const {execFileSync}=require("node:child_process");
  const script=String.raw`
import ast,json,sys
from pathlib import Path
from types import SimpleNamespace
source=Path(sys.argv[1]).read_text()
node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=="app_update_source_status")
requests=[]
def run(args,*_args):
    requests.append(args)
    if "rev-parse" in args: value="a"*40
    elif "symbolic-ref" in args: value="main"
    elif "diff" in args: value=""
    else: value="https://synthetic-user:synthetic-password@github.com/example/repository.git"
    return SimpleNamespace(returncode=0,stdout=value,stderr="")
context={"HUB_ROOT":Path("/synthetic/checkout"),"run":run}
exec(compile(ast.Module(body=[node],type_ignores=[]),"projection","exec"),context)
result=context["app_update_source_status"]()
assert "origin" not in result, "origin credentials must remain server-side"
assert not any("remote" in args for args in requests), "origin is not needed for source projection"
assert result["commit"]=="a"*40 and result["branch"]=="main" and result["trackedDirty"] is False
print(json.dumps({"ok":True,"gitOperations":len(requests)}))
`;
  const result=JSON.parse(execFileSync("python3",["-c",script,path.join(__dirname,"..","host-agent","server.py")],{encoding:"utf8"}));
  assert.equal(result.ok,true);assert.equal(result.gitOperations,4);
});
