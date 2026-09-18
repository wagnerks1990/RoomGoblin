"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("fs");
const {CloudflareClient,CloudflareManager,normalizeSettings}=require("../src/cloudflare");

class Store{
  constructor(){this.prefs=new Map();this.secrets=new Map()}
  getPreference(k,d){return this.prefs.has(k)?structuredClone(this.prefs.get(k)):d}
  setPreference(k,v){this.prefs.set(k,structuredClone(v))}
  putSecret(k,v){this.secrets.set(k,String(v))}
  getSecret(k){return this.secrets.get(k)||null}
  hasSecret(k){return this.secrets.has(k)}
  deleteSecret(k){this.secrets.delete(k)}
  tx(fn){return fn()}
}

function response(result,status=200){return Promise.resolve({ok:status>=200&&status<300,status,json:async()=>({success:status<400,result,errors:status>=400?[{message:String(result?.error||"error")}]:[]})})}
function apiFixture({existingDns=null,existingTunnel=null}={}){
  const calls=[];
  const fetch=async(url,opts={})=>{
    const u=new URL(url),p=u.pathname+u.search,method=opts.method||"GET",body=opts.body?JSON.parse(opts.body):null;
    calls.push({method,path:p,body,headers:opts.headers});
    if(method==="GET"&&u.pathname==="/client/v4/zones")return response([{id:"zone1",name:"example.org",status:"active",account:{id:"acct1"}}]);
    if(method==="GET"&&u.pathname==="/client/v4/accounts/acct1/cfd_tunnel")return response(existingTunnel?[existingTunnel]:[]);
    if(method==="GET"&&u.pathname==="/client/v4/accounts/acct1/cfd_tunnel/tun1")return response({id:"tun1",name:"roomgoblin-hub",status:"healthy"});
    if(method==="POST"&&u.pathname==="/client/v4/accounts/acct1/cfd_tunnel")return response({id:"tun1",name:body.name,status:"inactive"});
    if(method==="PUT"&&u.pathname==="/client/v4/accounts/acct1/cfd_tunnel/tun1/configurations")return response({id:"tun1"});
    if(method==="GET"&&u.pathname==="/client/v4/zones/zone1/dns_records")return response(existingDns?[existingDns]:[]);
    if(method==="POST"&&u.pathname==="/client/v4/zones/zone1/dns_records")return response({id:"dns1",...body});
    if(method==="PUT"&&u.pathname.startsWith("/client/v4/zones/zone1/dns_records/"))return response({id:"dnsExisting",...body});
    if(method==="PATCH"&&u.pathname.startsWith("/client/v4/zones/zone1/settings/"))return response({id:u.pathname.split("/").at(-1),value:body.value});
    if(method==="GET"&&u.pathname==="/client/v4/accounts/acct1/access/apps")return response([]);
    if(method==="POST"&&u.pathname==="/client/v4/accounts/acct1/access/apps")return response({id:"app1",...body});
    if(method==="GET"&&u.pathname==="/client/v4/accounts/acct1/access/apps/app1/policies")return response([]);
    if(method==="POST"&&u.pathname==="/client/v4/accounts/acct1/access/apps/app1/policies")return response({id:"policy1",...body});
    if(method==="GET"&&u.pathname==="/client/v4/accounts/acct1/cfd_tunnel/tun1/token")return response("connector-secret-token-value");
    throw Error(`Unexpected fixture request ${method} ${p}`);
  };
  return {fetch,calls};
}

test("Cloudflare settings validate domain boundaries and Access lockout guard",()=>{
  assert.throws(()=>normalizeSettings({zone:"example.org",hostname:"other.test"}),/inside the selected zone/);
  assert.throws(()=>normalizeSettings({zone:"example.org",hostname:"hub.example.org",accessEnabled:true}),/requires an allowed email domain/);
  const s=normalizeSettings({zone:"example.org",hostname:"hub.example.org",accessEnabled:true,accessEmailDomain:"@staff.example.org"});
  assert.equal(s.accessEmailDomain,"staff.example.org");
});

test("validation reports registrar nameservers for a pending Cloudflare zone",async()=>{
  const store=new Store();store.putSecret("integration.cloudflare.api-token","api-secret-value");store.setPreference("integrations.cloudflare",normalizeSettings({zone:"example.org",hostname:"hub.example.org"}));
  const fetch=async(url)=>{const u=new URL(url);if(u.pathname==="/client/v4/zones")return response([{id:"zone1",name:"example.org",status:"pending",name_servers:["ada.ns.cloudflare.com","bob.ns.cloudflare.com"],account:{id:"acct1"}}]);throw Error("unexpected request")};
  const manager=new CloudflareManager({storage:store,fetchImpl:fetch});
  await assert.rejects(()=>manager.validate(),error=>error.status===409&&/ada\.ns\.cloudflare\.com/.test(error.message)&&/registrar/.test(error.message));
});

test("Cloudflare client preserves 404 for missing-resource reconciliation",async()=>{
  const fetch=async()=>response({error:"not found"},404);
  const client=new CloudflareClient({auth:{mode:"token",token:"token-value"},fetchImpl:fetch});
  await assert.rejects(client.get("/missing"),error=>error.status===404&&/not found/.test(error.message));
});

test("Cloudflare client prefers scoped bearer token and supports legacy global key",async()=>{
  const seen=[];
  const fetch=async(_url,opts)=>{seen.push(opts.headers);return response([])};
  await new CloudflareClient({auth:{mode:"token",token:"token-value"},fetchImpl:fetch}).get("/zones");
  await new CloudflareClient({auth:{mode:"global",email:"admin@example.org",key:"key-value"},fetchImpl:fetch}).get("/zones");
  assert.equal(seen[0].Authorization,"Bearer token-value");
  assert.equal(seen[1]["X-Auth-Email"],"admin@example.org");
  assert.equal(seen[1]["X-Auth-Key"],"key-value");
  assert.equal(seen[1].Authorization,undefined);
});

test("managed provisioning reconciles tunnel, DNS, HTTPS, Access and host connector without returning secrets",async()=>{
  const store=new Store(),fx=apiFixture();let connectorToken="";
  const manager=new CloudflareManager({storage:store,fetchImpl:fx.fetch,originUrl:"http://127.0.0.1:3456",connectorInstaller:async token=>{connectorToken=token;return {ok:true,installed:true,restartRequired:true}}});
  const result=await manager.provision({zone:"example.org",hostname:"hub.example.org",tunnelName:"roomgoblin-hub",apiToken:"api-secret-value",accessEnabled:true,accessEmailDomain:"staff.example.org"});
  assert.equal(result.ok,true);assert.equal(result.publicUrl,"https://hub.example.org/controller/");
  assert.equal(connectorToken,"connector-secret-token-value");
  assert.equal(result.connector.installed,true);assert.equal(result.connector.restartRequired,true);
  assert.equal(result.settings.apiTokenConfigured,true);
  assert.doesNotMatch(JSON.stringify(result),/api-secret-value|connector-secret-token-value/);
  const config=fx.calls.find(x=>x.method==="PUT"&&x.path.includes("/configurations"));
  assert.equal(config.body.config.ingress[0].service,"http://127.0.0.1:3456");
  const dns=fx.calls.find(x=>x.method==="POST"&&x.path.includes("/dns_records"));
  assert.equal(dns.body.content,"tun1.cfargotunnel.com");assert.equal(dns.body.proxied,true);
  const policy=fx.calls.find(x=>x.method==="POST"&&x.path.endsWith("/policies"));
  assert.deepEqual(policy.body.include,[{email_domain:{domain:"staff.example.org"}}]);
  assert.equal(store.getPreference("integrations.cloudflare").ids.tunnelId,"tun1");
});


test("connector failure checkpoints Cloudflare ownership so retry does not orphan the tunnel",async()=>{
  const store=new Store(),first=apiFixture();
  const failing=new CloudflareManager({storage:store,fetchImpl:first.fetch,connectorInstaller:async()=>{throw Error("host connector install failed")}});
  await assert.rejects(()=>failing.provision({zone:"example.org",hostname:"hub.example.org",tunnelName:"roomgoblin-hub",apiToken:"api-secret-value"}),/host connector install failed/);
  const saved=store.getPreference("integrations.cloudflare");
  assert.equal(saved.ids.tunnelId,"tun1");
  assert.equal(saved.ids.dnsRecordId,"dns1");
  assert.equal(saved.ownership.tunnel,true);
  assert.equal(saved.ownership.dns,true);

  const retry=apiFixture({
    existingTunnel:{id:"tun1",name:"roomgoblin-hub",status:"healthy"},
    existingDns:{id:"dns1",type:"CNAME",name:"hub.example.org",content:"tun1.cfargotunnel.com",proxied:true}
  });
  const manager=new CloudflareManager({storage:store,fetchImpl:retry.fetch,connectorInstaller:async()=>({ok:true,installed:true,restartRequired:true})});
  const result=await manager.provision({});
  assert.equal(result.ok,true);
  assert.equal(result.tunnel.id,"tun1");
  assert.equal(result.tunnel.adopted,false);
  assert.equal(store.getPreference("integrations.cloudflare").ownership.tunnel,true);
});

test("provisioning refuses to overwrite an unrecorded same-name tunnel without explicit adoption",async()=>{
  const store=new Store(),fx=apiFixture({existingTunnel:{id:"foreign1",name:"roomgoblin-hub",status:"healthy"}});
  const manager=new CloudflareManager({storage:store,fetchImpl:fx.fetch,connectorInstaller:async()=>({installed:true})});
  await assert.rejects(()=>manager.provision({zone:"example.org",hostname:"hub.example.org",tunnelName:"roomgoblin-hub",apiToken:"api-secret-value"}),/explicitly allow adoption/);
  assert.equal(fx.calls.some(x=>x.method==="PUT"&&x.path.includes("/cfd_tunnel/foreign1/configurations")),false);
});

test("explicit tunnel adoption replaces only the selected tunnel ingress and records it as adopted",async()=>{
  const store=new Store(),fx=apiFixture({existingTunnel:{id:"foreign1",name:"roomgoblin-hub",status:"healthy"}});
  const originalFetch=fx.fetch;
  fx.fetch=async(url,opts={})=>{
    const u=new URL(url),method=opts.method||"GET";
    if(method==="PUT"&&u.pathname==="/client/v4/accounts/acct1/cfd_tunnel/foreign1/configurations"){
      const body=JSON.parse(opts.body);fx.calls.push({method,path:u.pathname+u.search,body,headers:opts.headers});return response({id:"foreign1"});
    }
    if(method==="GET"&&u.pathname==="/client/v4/accounts/acct1/cfd_tunnel/foreign1/token"){
      fx.calls.push({method,path:u.pathname+u.search,body:null,headers:opts.headers});return response("connector-secret-token-value");
    }
    return originalFetch(url,opts);
  };
  const manager=new CloudflareManager({storage:store,fetchImpl:fx.fetch,connectorInstaller:async()=>({installed:true})});
  const result=await manager.provision({zone:"example.org",hostname:"hub.example.org",tunnelName:"roomgoblin-hub",apiToken:"api-secret-value",adoptExistingTunnel:true});
  assert.equal(result.tunnel.id,"foreign1");assert.equal(result.tunnel.created,false);assert.equal(result.tunnel.adopted,true);
  assert.equal(store.getPreference("integrations.cloudflare").ownership.tunnel,false);
});
test("provisioning refuses conflicting DNS takeover unless explicitly enabled",async()=>{
  const store=new Store(),fx=apiFixture({existingDns:{id:"existing",type:"A",name:"hub.example.org",content:"192.0.2.10",proxied:true}});
  const manager=new CloudflareManager({storage:store,fetchImpl:fx.fetch,connectorInstaller:async()=>({installed:true})});
  await assert.rejects(()=>manager.provision({zone:"example.org",hostname:"hub.example.org",apiToken:"api-secret-value"}),/Enable explicit conflicting-record replacement/);
  assert.equal(fx.calls.some(x=>x.method==="PUT"&&x.path.includes("/dns_records/existing")),false);
});

test("Cloudflare host integration never places tunnel token in process arguments or browser state",()=>{
  const host=fs.readFileSync("host-agent/server.py","utf8"),maint=fs.readFileSync("maintenance-agent/server.js","utf8"),bridge=fs.readFileSync("src/cloudflare-bridge.js","utf8"),installer=fs.readFileSync("deploy/configure-cloudflare-tunnel.sh","utf8");
  const unit=fs.readFileSync("host-agent/classroom-control-hub-host-agent.service","utf8");
  const appUpdater=fs.readFileSync("host-agent/app-update-runner.sh","utf8");
  const hostInstaller=fs.readFileSync("deploy/install-cloudflared-host.sh","utf8");
  assert.match(host,/cloudflare-token-/);assert.match(host,/--token-file/);assert.match(host,/--skip-install/);assert.doesNotMatch(host,/--token['"]/);
  assert.match(installer,/chmod 0600/);assert.match(installer,/TRUST_PROXY_HOPS 1/);
  assert.match(unit,/ReadWritePaths=.*\/etc\/cloudflared .*\/etc\/systemd\/system\/cloudflared-roomgoblin\.service/);
  assert.match(appUpdater,/ReadWritePaths=.*\/etc\/cloudflared .*\/etc\/systemd\/system\/cloudflared-roomgoblin\.service/);
  assert.match(bridge,/integration\.cloudflare\.api-token/);assert.match(bridge,/\/api\/v1\/admin\/cloudflare\/provision/);
  assert.match(maint,/\/cloudflare\/configure/);
});
