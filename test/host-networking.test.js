"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const {spawnSync} = require("node:child_process");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const network = require("../src/network");

test("host-mode aliases migrate exactly and preserve remote connections", () => {
  assert.equal(read("src/network.js"), read("maintenance-agent/network.js"));
  assert.equal(network.serviceUrl("mqtt://host.docker.internal:1884", [], "host"), "mqtt://127.0.0.1:1884");
  assert.equal(network.serviceUrl("http://music-assistant-server:8095/api", ["music-assistant-server"], "host"), "http://127.0.0.1:8095/api");
  assert.equal(network.serviceUrl("http://host.docker.internal:11080", [], "bridge"), "http://host.docker.internal:11080");
  for (const url of ["http://music.school.test:8095", "mqtt://broker.school.test:1883", "http://host.docker.internal.school.test:80", "", "not a url"]) {
    assert.equal(network.serviceUrl(url, [], "host"), url);
  }
  assert.equal(network.serviceHost("mosquitto", ["mosquitto"], "host"), "127.0.0.1");
  assert.equal(network.serviceHost("remote-broker", ["mosquitto"], "host"), "remote-broker");
});

test("actual listener ports and IP bindings drive internal health URLs", () => {
  assert.equal(network.localHttpUrl(3800, "0.0.0.0"), "http://127.0.0.1:3800");
  assert.equal(network.localHttpUrl(3800, "192.0.2.20"), "http://192.0.2.20:3800");
  assert.equal(network.localHttpUrl(3800, "::"), "http://[::1]:3800");
  assert.equal(network.localHttpUrl(3800, "2001:db8::1"), "http://[2001:db8::1]:3800");
  for (const port of [0, -1, 65536, "abc", 2.5]) assert.throws(() => network.validPort(port, 3000));
  assert.throws(() => network.localHttpUrl(3000, "example.com/path"));
  assert.equal(network.mainAppUrl({MAIN_APP_PORT:"3800", MAIN_APP_BIND_ADDRESS:"192.0.2.20"}), "http://192.0.2.20:3800");
  assert.equal(network.mainAppUrl({MAIN_APP_URL:"http://classroom-hub:3000", HUB_NETWORK_MODE:"host"}), "http://127.0.0.1:3000");
});

function addonHarness(t, exists = false, owned = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hub-host-network-"));
  t.after(() => fs.rmSync(dir, {recursive:true, force:true}));
  const calls = [];
  const express = {application:{get(){}, post(){}}};
  const context = vm.createContext({
    require: name => name === "express" ? express : name === "./network" ? network : require(name),
    process:{env:{MANAGED_SERVICES_ROOT:dir,HUB_NETWORK_MODE:"host"}},
    Buffer, URL, AbortController, setTimeout, clearTimeout,
  });
  vm.runInContext(read("maintenance-agent/extensions.js"), context);
  context.containerExists = async () => exists;
  context.mainAppPut = async (_id, settings) => ({resolved:settings});
  context.hostAgentRequest = async args => {
    calls.push(Array.from(args));
    if(args[0]==="network"&&args[1]==="inspect")return {ok:true,stdout:JSON.stringify([{Name:"roomgoblin-integrations",Driver:"bridge"}])};
    if(args[0]==="inspect"&&exists)return {ok:true,stdout:JSON.stringify([{Config:{Labels:owned?{"org.roomgoblin.deployment-ownership":"roomgoblin"}:{}},Mounts:[]}])};
    return {ok:true, stdout:"test-container"};
  };
  return {context, calls, dir};
}

test("managed Mosquitto uses the RoomGoblin bridge and loopback-only publication", async t => {
  const h=addonHarness(t);
  await h.context.deployAddon("mosquitto",{port:2883,username:"classroom-hub",password:"a-test-password-with-16-chars"},false);
  const args=h.calls.find(args=>args[0]==="run");
  assert.ok(args);
  assert.equal(args[args.indexOf("--network")+1],"roomgoblin-integrations");
  assert.ok(args.includes("127.0.0.1:2883:2883"));
  assert.match(fs.readFileSync(path.join(h.dir,"mosquitto/config/mosquitto.conf"),"utf8"),/listener 2883\n/);
  assert.ok(h.calls.some(args=>args[0]==="network"&&args[1]==="inspect"&&args[2]==="roomgoblin-integrations"));
});

for (const [id, settings] of [
  ["govee2mqtt", {mqttHost:"host.docker.internal",mqttPort:2883}],
  ["musicassistant", {}],
]) {
  test(`managed ${id} retains required host networking without published ports`, async t => {
    const h = addonHarness(t);
    await h.context.deployAddon(id, settings, false);
    const args = h.calls.find(args => args[0] === "run");
    assert.ok(args);
    assert.equal(args[args.indexOf("--network") + 1], "host");
    assert.ok(!args.includes("-p") && !args.includes("--publish"));
    if (id === "govee2mqtt") assert.ok(args.includes("GOVEE_MQTT_HOST=127.0.0.1"));
    if (id === "musicassistant") {
      assert.ok(args.includes("PYTHONPATH=/data/.roomgoblin-compat"));
      const shim = fs.readFileSync(path.join(h.dir, "music-assistant/.roomgoblin-compat/sitecustomize.py"), "utf8");
      assert.match(shim, /_default_route_ipv4/);
      assert.match(shim, /ROOMGOBLIN_MA_LAN_INTERFACE/);
      assert.match(shim, /"br-", "docker", "veth", "tailscale"/);
    }
  });
}

test("Music Assistant compatibility shim pins discovery to the selected LAN adapter", async t => {
  const h = addonHarness(t);
  await h.context.deployAddon("musicassistant", {}, false);
  const compat = path.join(h.dir, "music-assistant/.roomgoblin-compat");
  const stub = path.join(h.dir, "ifaddr-stub");
  fs.mkdirSync(stub, {recursive:true});
  fs.writeFileSync(path.join(stub, "ifaddr.py"), `
class IP:
    def __init__(self, value, ipv6=False):
        self.ip=value
        self.is_IPv6=ipv6
class Adapter:
    def __init__(self, name, ips):
        self.name=name
        self.nice_name=name
        self.ips=[IP(x) for x in ips]
def get_adapters():
    return [
        Adapter("enp4s0", ["192.0.2.5"]),
        Adapter("docker0", ["172.17.0.1"]),
        Adapter("br-deadbeef", ["172.20.0.1"]),
        Adapter("tailscale0", ["100.120.61.26"]),
    ]
`);
  const result = spawnSync("python3", ["-c", "import ifaddr; print(','.join(a.nice_name for a in ifaddr.get_adapters()))"], {
    encoding:"utf8",
    env:{...process.env,PYTHONPATH:`${compat}:${stub}`,ROOMGOBLIN_MA_LAN_INTERFACE:"enp4s0"},
  });
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),"enp4s0");
});

test("recreate refuses adopted containers with foreign persistent mounts", async t => {
  const h = addonHarness(t, true, false);
  await assert.rejects(
    h.context.deployAddon("musicassistant", {}, true),
    /Refusing to recreate an adopted Music Assistant container/
  );
  assert.ok(!h.calls.some(args => args[0] === "rm"));
  assert.ok(!h.calls.some(args => args[0] === "run"));
});

test("explicit Music Assistant recreate bypasses dead-service authentication preflight", async t => {
  const h = addonHarness(t, true);
  h.context.saveMusicAssistantSettings = async () => { throw new Error("dead service preflight must not run"); };
  await h.context.deployAddon("musicassistant", {}, true);
  assert.ok(h.calls.some(args => args[0] === "rm" && args[2] === "music-assistant-server"));
  assert.ok(h.calls.some(args => args[0] === "run"));
});

test("adoption never removes an existing container or changes its network", async t => {
  const h = addonHarness(t, true);
  const result = await h.context.deployAddon("govee2mqtt", {}, false);
  assert.equal(result.adopted, true);
  assert.deepEqual(h.calls, []);
});

test("invalid recreation settings do not remove the existing broker", async t => {
  const h = addonHarness(t, true);
  await assert.rejects(h.context.deployAddon("mosquitto", {username:"hub",password:"a-test-password-with-16-chars",port:65536}, true), /Port/);
  assert.ok(h.calls.every(args=>args[0]==="network"&&args[1]==="inspect"),JSON.stringify(h.calls));
  assert.ok(!h.calls.some(args=>args[0]==="rm"||args[0]==="run"));
  assert.equal(fs.existsSync(path.join(h.dir,"mosquitto/config/mosquitto.conf")), false);
});

test("Host Agent enforces per-integration network policy before Docker runs", () => {
  const result = spawnSync("python3", ["-c", `
import importlib.util
spec=importlib.util.spec_from_file_location('agent','host-agent/server.py')
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
label=['--label','org.roomgoblin.deployment-ownership=roomgoblin']
restart=['--restart','unless-stopped']
a.validate_docker_run(['run','-d','--network','roomgoblin-integrations','--name','mosquitto',*restart,*label,'-p','127.0.0.1:1883:1883','eclipse-mosquitto:2.0.22'])
a.validate_docker_run(['run','-d','--network','host','--name','govee2mqtt',*restart,*label,'ghcr.io/wez/govee2mqtt:2025.04.13-17d43d72'])
a.validate_docker_run(['run','-d','--network','host','--name','music-assistant-server',*restart,*label,'ghcr.io/music-assistant/server:2.9.13'])
bad=[
 ['run','-d','--network','host','--name','mosquitto',*restart,*label,'eclipse-mosquitto:2.0.22'],
 ['run','-d','--network','roomgoblin-integrations','--name','govee2mqtt',*restart,*label,'ghcr.io/wez/govee2mqtt:2025.04.13-17d43d72'],
 ['run','-d','--network','host','--name','music-assistant-server',*restart,*label,'-p','127.0.0.1:8095:8095','ghcr.io/music-assistant/server:2.9.13'],
 ['run','-d','--network','roomgoblin-integrations','--name','mosquitto',*restart,*label,'-p','0.0.0.0:1883:1883','eclipse-mosquitto:2.0.22'],
]
for args in bad:
    try: a.validate_docker_run(args)
    except RuntimeError: continue
    raise AssertionError('Unsafe network request accepted: '+repr(args))
`], {cwd:root, encoding:"utf8"});
  assert.equal(result.status, 0, result.stderr);
});

test("Host Agent only allows RoomGoblin integration bridge lifecycle commands", () => {
  const source=read("host-agent/server.py");
  assert.match(source,/INTEGRATION_NETWORK = 'roomgoblin-integrations'/);
  assert.match(source,/tail==\['inspect',INTEGRATION_NETWORK\]/);
  assert.match(source,/\['create','--driver','bridge','--label',INTEGRATION_NETWORK_LABEL,INTEGRATION_NETWORK\]/);
  assert.match(source,/Only the reviewed RoomGoblin integration bridge may be inspected or created/);
});

test("rendered Compose preflight rejects stale bridge overrides, exposure and collisions", () => {
  const valid = {services:{
    "classroom-hub":{network_mode:"host",environment:{PORT:"3800",BIND_ADDRESS:"0.0.0.0",HUB_NETWORK_MODE:"host",MAINTENANCE_URL:"http://127.0.0.1:3810"}},
    "maintenance-agent":{network_mode:"host",environment:{PORT:"3810",BIND_ADDRESS:"127.0.0.1",HUB_NETWORK_MODE:"host"}},
  }};
  const run = config => spawnSync("python3", ["tools/validate-host-network.py"], {cwd:root, input:JSON.stringify(config), encoding:"utf8"});
  assert.equal(run(valid).status, 0);
  for (const mutate of [
    c => c.services["classroom-hub"].ports=[{target:3000,published:"3800"}],
    c => c.services["classroom-hub"].network_mode="bridge",
    c => c.services["maintenance-agent"].environment.BIND_ADDRESS="0.0.0.0",
    c => c.services["maintenance-agent"].environment.PORT="3800",
    c => c.services["classroom-hub"].environment.MAINTENANCE_URL="http://maintenance-agent:3010",
  ]) {const config=structuredClone(valid);mutate(config);assert.notEqual(run(config).status,0);}
});

test("core runtime and upgrade paths retain the host-network contract", () => {
  const compose = read("docker-compose.yml");
  assert.equal((compose.match(/network_mode: host/g)||[]).length, 2);
  assert.doesNotMatch(compose, /^\s*(ports|networks|extra_hosts):/m);
  assert.match(compose, /PORT: \$\{HUB_PORT:-3000\}/);
  assert.match(compose, /PORT: \$\{MAINTENANCE_PORT:-3010\}/);
  assert.match(read("maintenance-agent/server.js"), /BIND_ADDRESS="127\.0\.0\.1"/);
  assert.match(read("maintenance-agent/server.js"), /PORT=\$\{validPort\(resolved\.port,1880\)\}/);
  for (const file of ["host-agent/app-update-runner.sh","host-agent/update-runner.sh"]) {
    assert.doesNotMatch(read(file), /docker compose port/);
    assert.match(read(file), /process\.env\.BIND_ADDRESS/);
    assert.match(read(file), /docker compose exec -T classroom-hub/);
  }
  assert.match(read("public/controller/app.js"), /networkMigrationRequired/);
  assert.match(read("public/controller/app.js"), /Adoption does not change networking/);
  assert.match(read("public/controller/app.js"), /Host listeners \(no port mappings\)/);
  assert.match(read("host-agent/server.py"), /HOST_SERVICES_DIR/);
  assert.match(read("install.sh"), /Environment=HOST_SERVICES_DIR=\$SERVICES/);
  assert.match(read("install.sh"), /EnvironmentFile=-\$TARGET\/\.env/);
});

test("application updater force-recreates maintenance so new persistent mounts are applied", () => {
  const runner=read("host-agent/app-update-runner.sh");
  const compose=read("docker-compose.override.yml");
  assert.match(compose,/classroom-hub-android-adb:\/managed\/classroom-hub\/data\/android-tv\/\.android/);
  assert.match(runner,/docker compose up -d --no-build --force-recreate --remove-orphans maintenance-agent classroom-hub/);
  assert.match(runner,/adb_storage_check\(\)/);
  assert.match(runner,/docker volume inspect classroom-control-hub-android-adb/);
  assert.match(runner,/test -r \/managed\/classroom-hub\/data\/android-tv\/\.android/);
});

test("installer never changes tracked updater modes in the production checkout", () => {
  const installer=read("install.sh"),runner=read("host-agent/app-update-runner.sh");
  assert.doesNotMatch(installer,/chmod 0755 "\$TARGET\/host-agent\/update-runner\.sh"/);
  assert.doesNotMatch(runner,/chmod 0755 "\$HUB_ROOT\/host-agent\/update-runner\.sh"/);
  assert.match(installer,/install -D -m 0755 "\$TARGET\/host-agent\/app-update-runner\.sh" \/usr\/local\/libexec\/classroom-control-hub\/app-update-runner\.sh/);
});
