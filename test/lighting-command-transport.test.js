"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {EventEmitter} = require("node:events");
const mqtt = require("mqtt");
const source = fs.readFileSync(path.join(__dirname, "../src/server.js"), "utf8");
function block(startText, endText) {
  const start = source.indexOf(startText), end = source.indexOf(endText, start);
  assert.ok(start > 0 && end > start, "actual transport source boundaries must exist");
  return source.slice(start, end);
}
function clock() {
  const timers = new Set();
  return {timers, setTimeout(fn, ms) { const timer = {fn, ms}; timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
    expire() { for (const timer of [...timers]) { timers.delete(timer); timer.fn(); } }};
}
function udpFixture({sendError, createError, closeError} = {}) {
  const time = clock(), socket = new EventEmitter(), calls = [], device = {ip: "127.0.0.1"};
  let closes = 0;
  socket.send = (packet, port, ip, callback) => {
    calls.push({packet, port, ip, callback}); if (sendError) throw sendError;
  };
  socket.close = () => { closes++; if (closeError) throw closeError; };
  const ctx = vm.createContext({Buffer, ...time, dgram: {createSocket(kind) {
    assert.equal(kind, "udp4"); if (createError) throw createError; return socket;
  }}});
  vm.runInContext(block("async function goveeUdpTemperature(", "async function goveePublish("), ctx);
  return {time, socket, calls, device, get closes() {return closes;}, run: () => ctx.goveeUdpTemperature(device, 4200)};
}
test("UDP temperature preserves its packet, port and accepted address and releases the socket", async () => {
  const f = udpFixture(), result = f.run();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].port, 4003); assert.equal(f.calls[0].ip, "127.0.0.1");
  assert.deepEqual(JSON.parse(f.calls[0].packet), {msg: {cmd: "colorwc", data: {color: {r: 0, g: 0, b: 0}, colorTemInKelvin: 4200}}});
  f.device.ip = "127.0.0.2"; f.calls[0].callback();
  assert.deepEqual(JSON.parse(JSON.stringify(await result)), {method: "native-udp", ip: "127.0.0.1", port: 4003});
  assert.equal(f.closes, 1); assert.equal(f.time.timers.size, 0);
});
for (const failure of ["socket", "callback", "throw"]) test(`UDP ${failure} errors settle the command and close its socket`, async () => {
  const error = Error("controlled UDP failure"), f = udpFixture({sendError: failure === "throw" ? error : undefined});
  const result = f.run(), rejected = assert.rejects(result, /controlled UDP failure/);
  if (failure === "socket") assert.doesNotThrow(() => f.socket.emit("error", error));
  if (failure === "callback") f.calls[0].callback(error);
  await rejected; assert.equal(f.closes, 1); assert.equal(f.time.timers.size, 0);
});
test("UDP timeout reports uncertain delivery and never sends again after a late callback", async () => {
  const f = udpFixture(), result = f.run(), rejected = assert.rejects(result, /timed out; delivery is unconfirmed/);
  assert.equal([...f.time.timers][0].ms, 5000); f.time.expire(); await rejected;
  f.calls[0].callback(); assert.doesNotThrow(() => f.socket.emit("error", Error("late error")));
  assert.equal(f.calls.length, 1); assert.equal(f.closes, 1); assert.equal(f.time.timers.size, 0);
});
test("UDP success remains settled after duplicate callbacks and late socket errors", async () => {
  const f = udpFixture(), result = f.run(); f.calls[0].callback(); await result;
  f.calls[0].callback(Error("late callback")); assert.doesNotThrow(() => f.socket.emit("error", Error("late error")));
  f.time.expire(); assert.equal(f.closes, 1); assert.equal(f.calls.length, 1);
});
test("UDP socket construction failure creates no timer or send", async () => {
  const f = udpFixture({createError: Error("create failed")}); await assert.rejects(f.run(), /create failed/);
  assert.equal(f.calls.length, 0); assert.equal(f.time.timers.size, 0);
});
test("UDP cleanup errors cannot hide a send failure", async () => {
  const f = udpFixture({sendError: Error("send failed"), closeError: Error("already closed")});
  await assert.rejects(f.run(), /send failed/); assert.equal(f.closes, 1); assert.equal(f.time.timers.size, 0);
});

function mqttFixture({real = false} = {}) {
  const time = clock(), clients = [], calls = [], audits = [], errors = [];
  const ctx = vm.createContext({runtime: {mqtt: {}}, MQTT_URL: "mqtt://127.0.0.1", MQTT_USERNAME: "", MQTT_PASSWORD: "",
    crypto: require("node:crypto"), endpointForLog: () => "local test", ...time,
    shutdownRequested: false, fullExportFreeze: {requested: false}, audit: value => audits.push(value),
    console: {log() {}, error(...args) {errors.push(args);}}, mqtt: {connect(_url, options) {
      const client = real ? new mqtt.MqttClient(() => assert.fail("No broker connection is allowed"), {...options, manualConnect: true}) : new EventEmitter();
      if (!real) {
        client.connected = true; client.options = options;
        client.publish = (topic, payload, opts, callback) => calls.push({client, topic, payload, opts, callback});
        client.subscribe = () => {}; client.end = () => {client.ended = true;};
      }
      clients.push(client); return client;
    }}});
  vm.runInContext(block("let mqttClient = null;", "// Direct hardware integrations"), ctx);
  ctx.connectMqtt(); ctx.runtime.mqtt.connected = true;
  return {ctx, time, clients, calls, audits, errors, client: clients[0],
    pending: () => vm.runInContext("pendingMqttPublishes.size", ctx),
    run: (payload = {state: "ON"}) => ctx.mqttPublish("gv2mqtt/light/fixture/command", payload)};
}
test("MQTT rejects a stale runtime-connected flag without queuing the actual client", async () => {
  const f = mqttFixture({real: true}); await assert.rejects(f.run(), /not connected/);
  assert.equal(f.client.queue.length, 0); assert.equal(f.pending(), 0); assert.equal(f.time.timers.size, 0);
});
test("MQTT connection options prevent actual QoS-zero offline storage and replay", async () => {
  const f = mqttFixture({real: true});
  const result = new Promise((resolve, reject) => f.client.publish("fixture", "OFF", {qos: 0}, err => err ? reject(err) : resolve()));
  await assert.rejects(result, /connection/i); assert.equal(f.client.queue.length, 0);
  assert.equal(f.client.options.clean, true); assert.equal(f.client.options.reconnectPeriod, 2000);
});
for (const unavailable of ["runtime", "client", "disconnecting"]) test(`MQTT ${unavailable} state rejects before publication`, async () => {
  const f = mqttFixture();
  if (unavailable === "runtime") f.ctx.runtime.mqtt.connected = false;
  if (unavailable === "client") f.client.connected = false;
  if (unavailable === "disconnecting") f.client.disconnecting = true;
  await assert.rejects(f.run(), /not connected/); assert.equal(f.calls.length, 0); assert.equal(f.time.timers.size, 0);
});
for (const payload of ["legacy command", {state: "ON"}]) test(`MQTT successful ${typeof payload} publication preserves payload and cleans ownership`, async () => {
  const f = mqttFixture(), result = f.run(payload);
  assert.equal(f.calls[0].payload, typeof payload === "string" ? payload : JSON.stringify(payload));
  assert.equal(f.calls[0].opts.qos, 0); assert.equal(f.calls[0].opts.retain, false); assert.equal(f.pending(), 1);
  f.calls[0].callback(); await result; assert.equal(f.pending(), 0); assert.equal(f.time.timers.size, 0);
});
for (const event of ["close", "offline", "reconnect", "error"]) test(`MQTT ${event} settles accepted publication before a lost callback`, async () => {
  const f = mqttFixture(), result = f.run(), rejected = assert.rejects(result, /delivery is unconfirmed/);
  f.client.emit(event, Error("controlled connection failure")); await rejected;
  f.calls[0].callback(); assert.equal(f.calls.length, 1); assert.equal(f.pending(), 0); assert.equal(f.time.timers.size, 0);
});
test("MQTT publication timeout settles once without retrying uncertain delivery", async () => {
  const f = mqttFixture(), result = f.run(), rejected = assert.rejects(result, /timed out; delivery is unconfirmed/);
  assert.equal([...f.time.timers][0].ms, 5000); f.time.expire(); await rejected;
  f.calls[0].callback(); f.client.emit("close"); assert.equal(f.calls.length, 1); assert.equal(f.pending(), 0);
});
for (const failure of ["callback", "throw"]) test(`MQTT publish ${failure} failure cleans its timer and owner`, async () => {
  const f = mqttFixture(); if (failure === "throw") f.client.publish = () => {throw Error("publish failed");};
  const result = f.run(), rejected = assert.rejects(result, /publish failed/);
  if (failure === "callback") f.calls[0].callback(Error("publish failed"));
  await rejected; assert.equal(f.pending(), 0); assert.equal(f.time.timers.size, 0);
});
test("MQTT payload serialization failure leaves no accepted publisher", async () => {
  const f = mqttFixture(), cyclic = {}; cyclic.self = cyclic; await assert.rejects(f.run(cyclic), /circular/i);
  assert.equal(f.pending(), 0); assert.equal(f.calls.length, 0); assert.equal(f.time.timers.size, 0);
});
test("MQTT synchronous callback and duplicate completion release only their own owner", async () => {
  const f = mqttFixture(); f.client.publish = (_topic, _message, _options, callback) => {callback(); callback(Error("late"));};
  await f.run(); assert.equal(f.pending(), 0); assert.equal(f.time.timers.size, 0);
});
test("MQTT reconnect replacement rejects old owners and late events cannot affect the successor", async () => {
  const f = mqttFixture(), oldConnect = f.client.listeners("connect")[0], oldClose = f.client.listeners("close")[0],
    oldError = f.client.listeners("error")[0], oldMessage = f.client.listeners("message")[0];
  const first = f.run(), rejected = assert.rejects(first, /connection changed; command delivery is unconfirmed/);
  f.ctx.reconnectMqtt(); await rejected; assert.equal(f.client.ended, true);
  const successor = f.clients[1]; successor.emit("connect"); const second = f.run({state: "OFF"});
  f.calls[0].callback(); oldClose(); oldConnect(); oldError(Error("old error")); oldMessage("ignored", Buffer.from("{}"));
  assert.equal(f.ctx.runtime.mqtt.connected, true); assert.equal(f.ctx.runtime.mqtt.lastError, null);
  assert.equal(f.pending(), 1); assert.equal(f.audits.length, 1); assert.equal(f.errors.length, 0);
  f.calls[1].callback(); await second; assert.equal(f.pending(), 0);
});
test("MQTT concurrent publishers share connection listeners and all settle on close", async () => {
  const f = mqttFixture(), listenerCount = f.client.listenerCount("close"), results = [];
  for (let index = 0; index < 30; index++) results.push(assert.rejects(f.run(), /connection closed/));
  assert.equal(f.pending(), 30); assert.equal(f.client.listenerCount("close"), listenerCount);
  f.client.emit("close"); await Promise.all(results); assert.equal(f.pending(), 0); assert.equal(f.time.timers.size, 0);
});

for (const transport of ["UDP", "MQTT"]) test(`disconnected Govee HTTP handlers retain ${transport} ownership until its deadline`, {timeout: 10000}, async t => {
  const express = require("express"), http = require("node:http"), {once} = require("node:events");
  const {trackApplicationHandlers, waitUntilDrained} = require("../src/application-drain");
  const f = transport === "UDP" ? udpFixture() : mqttFixture(), app = express();
  const tracker = trackApplicationHandlers(app, {isMutation: req => req.method === "POST"});
  app.use(express.json());
  const ctx = vm.createContext({app, requireControl: (_req, _res, next) => next(), cleanId: String, directGoveeCommand: () => f.run()});
  vm.runInContext(block('app.post("/api/v1/govee/:target/:action"', '// v0.8'), ctx);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  t.after(() => {f.time.expire(); server.closeAllConnections(); server.close();});
  const request = http.request({host: "127.0.0.1", port: server.address().port, path: "/api/v1/govee/fixture/temp", method: "POST", headers: {"Content-Type": "application/json"}});
  request.on("error", () => {}); request.on("response", response => response.resume()); request.end('{"kelvin":4200}');
  t.after(() => request.destroy()); await waitUntilDrained(() => f.calls.length === 1);
  request.destroy(); await new Promise(resolve => server.close(resolve));
  assert.equal(tracker.pendingMutations, 1); f.time.expire();
  await waitUntilDrained(() => tracker.pending === 0); assert.equal(tracker.pendingMutations, 0); assert.equal(f.calls.length, 1);
});

test("native UDP callback completes and closes a real loopback socket", {timeout: 10000}, async t => {
  const dgram = require("node:dgram"), {once} = require("node:events"), receiver = dgram.createSocket("udp4");
  receiver.bind(0, "127.0.0.1"); await once(receiver, "listening");
  t.after(() => receiver.close()); const message = once(receiver, "message"); let sender, closed;
  const ctx = vm.createContext({Buffer, setTimeout, clearTimeout, dgram: {createSocket(kind) {
    sender = dgram.createSocket(kind); closed = once(sender, "close");
    return {on: (...args) => sender.on(...args), close: () => sender.close(), send(packet, port, ip, callback) {
      assert.equal(port, 4003); assert.equal(ip, "127.0.0.1"); sender.send(packet, receiver.address().port, ip, callback);
    }};
  }}});
  vm.runInContext(block("async function goveeUdpTemperature(", "async function goveePublish("), ctx);
  const result = await ctx.goveeUdpTemperature({ip: "127.0.0.1"}, 4200);
  const [packet] = await message; await closed;
  assert.equal(JSON.parse(packet).msg.data.colorTemInKelvin, 4200); assert.equal(result.method, "native-udp");
});
