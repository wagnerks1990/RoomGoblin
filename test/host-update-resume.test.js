"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");

test("Host Agent resumes only an orphaned update journal and releases the lock before systemd",()=>{
  const script=String.raw`
import ast, fcntl, tempfile
from pathlib import Path
from types import SimpleNamespace

tree=ast.parse(Path('host-agent/server.py').read_text())
function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='resume_interrupted_app_update')
with tempfile.TemporaryDirectory() as temp:
    request=Path(temp)/'request.json'
    lock=Path(temp)/'mutation.lock'
    calls=[]
    def run(args,*rest):
        with open(lock,'a+b') as probe:
            fcntl.flock(probe,fcntl.LOCK_EX|fcntl.LOCK_NB)
        calls.append(args)
        return SimpleNamespace(returncode=0)
    scope=dict(fcntl=fcntl,APP_UPDATE_REQUEST_FILE=request,APPLIANCE_MUTATION_LOCK=lock,
               APP_UPDATE_SERVICE='fixture-update.service',run=run)
    exec(compile(ast.Module(body=[function],type_ignores=[]),'<host-agent>','exec'),scope)
    resume=scope['resume_interrupted_app_update']
    assert resume() is False and calls==[]
    request.write_text('{"mutationStarted":true}')
    with open(lock,'a+b') as owner:
        fcntl.flock(owner,fcntl.LOCK_EX|fcntl.LOCK_NB)
        assert resume() is False and calls==[]
        assert request.read_text()=='{"mutationStarted":true}'
    assert resume() is True
    assert calls==[['systemctl','start','--no-block','fixture-update.service']]
    request.unlink()
    assert resume() is False and len(calls)==1
`;
  const result=spawnSync("python3",["-c",script],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
