"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

async function until(check, message, timeout = 2000) {
  const deadline = Date.now() + timeout;
  do {
    if (await check()) return;
    await delay(20);
  } while (Date.now() < deadline);
  assert.fail(message);
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function fixture(t, authorize) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "roomgoblin-media-lifecycle-"));
  const mediaDir = path.join(root, "media");
  fs.mkdirSync(mediaDir);
  fs.writeFileSync(path.join(mediaDir, "fixture.mp4"), "0123456789");
  fs.writeFileSync(path.join(mediaDir, "empty.mp4"), "");
  const largeFile = path.join(mediaDir, "large.mp4");
  const fd = fs.openSync(largeFile, "w");
  try { fs.ftruncateSync(fd, 128 * 1024 * 1024); } finally { fs.closeSync(fd); }
  const requests = [];
  const control = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url, headers: req.headers });
    if (authorize) return authorize(req, res);
    const accepted = req.method === "HEAD" && (
      new URL(req.url, "http://control.invalid").searchParams.get("asset") === "valid" ||
      req.headers.cookie === "classroom_hub_session=test-session"
    );
    res.writeHead(accepted ? 200 : 401);
    res.end();
  });
  const controlPort = await listen(control);
  const reservation = http.createServer();
  const mediaPort = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, [path.join(__dirname, "..", "src", "media-server.js")], {
    env: { ...process.env, DATA_DIR: root, PORT: String(controlPort),
      MEDIA_PLANE_PORT: String(mediaPort), MEDIA_PLANE_BIND_ADDRESS: "127.0.0.1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  const record = data => { output = (output + data).slice(-8192); };
  child.stdout.on("data", record);
  child.stderr.on("data", record);
  let exited = false;
  const exit = new Promise(resolve => child.once("exit", () => { exited = true; resolve(); }));
  t.after(async () => {
    if (!exited) {
      child.kill("SIGTERM");
      const force = setTimeout(() => child.kill("SIGKILL"), 1500);
      try { await exit; } finally { clearTimeout(force); }
    }
    control.closeAllConnections();
    await new Promise(resolve => control.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${mediaPort}`;
  await until(async () => {
    assert.equal(exited, false, output);
    try { return (await fetch(`${origin}/health`, { signal: AbortSignal.timeout(500) })).ok; }
    catch { return false; }
  }, "media plane did not start", 5000);
  return { origin, mediaPort, child, requests, largeFile };
}

function descriptorsFor(pid, filename) {
  return fs.readdirSync(`/proc/${pid}/fd`).filter(fd => {
    try { return fs.readlinkSync(`/proc/${pid}/fd/${fd}`) === filename; }
    catch { return false; } // A descriptor may close during enumeration.
  }).length;
}

async function disconnectAfterData(url, headers = {}) {
  await new Promise((resolve, reject) => {
    const request = http.get(url, { headers, agent: false }, response => {
      response.once("error", () => {}); // Deliberate client disconnect.
      response.once("data", () => {
        response.destroy();
        request.destroy();
        resolve();
      });
    });
    request.once("error", reject);
    request.setTimeout(2000, () => request.destroy(new Error("no media received")));
  });
}

test("media responses preserve authorization, HEAD, full-file and range behavior", async t => {
  const { origin, requests } = await fixture(t);
  const denied = await fetch(`${origin}/media/fixture.mp4?asset=invalid`);
  assert.equal(denied.status, 401);
  assert.equal(await denied.text(), "");
  const full = await fetch(`${origin}/media/fixture.mp4?asset=valid`);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(full.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await full.text(), "0123456789");
  const head = await fetch(`${origin}/media/fixture.mp4`, {
    method: "HEAD", headers: { cookie: "classroom_hub_session=test-session" }
  });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), "10");
  assert.equal(await head.text(), "");
  for (const [range, body, expected] of [
    ["bytes=2-5", "2345", "bytes 2-5/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=8-100", "89", "bytes 8-9/10"],
    ["bytes=-100", "0123456789", "bytes 0-9/10"]
  ]) {
    const response = await fetch(`${origin}/media/fixture.mp4?asset=valid`, { headers: { range } });
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get("content-range"), expected);
    assert.equal(await response.text(), body);
  }
  for (const range of ["bytes=10-", "bytes=5-2", "bytes=-0", "bytes=-", "bytes=a-b", "bytes=0-1,4-5"]) {
    const response = await fetch(`${origin}/media/fixture.mp4?asset=valid`, { headers: { range } });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get("content-range"), "bytes */10");
    await response.arrayBuffer();
  }
  assert.ok(requests.every(request => request.method === "HEAD"));
});

test("suffix ranges on empty files are unsatisfiable for GET and HEAD", async t => {
  const { origin } = await fixture(t);
  for (const method of ["GET", "HEAD"]) {
    const response = await fetch(`${origin}/media/empty.mp4?asset=valid`, {
      method, headers: { range: "bytes=-4" }
    });
    assert.equal(response.status, 416, method);
    assert.equal(response.headers.get("content-range"), "bytes */0");
    assert.equal(await response.text(), "");
  }
  const full = await fetch(`${origin}/media/empty.mp4?asset=valid`);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("content-length"), "0");
  assert.equal(await full.text(), "");
});

for (const range of [null, "bytes=0-100663295"]) {
  test(`disconnecting a ${range ? "ranged" : "full"} response releases its file descriptor`, {
    skip: process.platform !== "linux" && "Linux /proc descriptor accounting is required"
  }, async t => {
    const { origin, child, largeFile } = await fixture(t);
    for (let attempt = 0; attempt < 3; attempt++) {
      await disconnectAfterData(`${origin}/media/large.mp4?asset=valid`, range ? { range } : {});
      await until(() => descriptorsFor(child.pid, largeFile) === 0,
        "disconnected media response retained an open file descriptor");
    }
    assert.equal((await fetch(`${origin}/health`)).status, 200);
  });
}

test("disconnecting before authorization cancels the upstream probe", async t => {
  let accepted = false;
  let closed = false;
  const { origin } = await fixture(t, (req, res) => {
    accepted = true;
    res.once("close", () => { closed = true; });
    // Hold headers: the client should cancel this work, not wait for its timeout.
  });
  const request = http.get(`${origin}/media/fixture.mp4?asset=valid`, { agent: false });
  request.on("error", () => {});
  t.after(() => request.destroy());
  await until(() => accepted, "authorization request did not arrive");
  request.destroy();
  await until(() => closed, "abandoned authorization probe remained active", 1000);
});

test("authorization forwards only the signed path and approved session cookie", async t => {
  const { mediaPort, requests } = await fixture(t);
  const response = await new Promise((resolve, reject) => {
    const request = http.request({ hostname: "127.0.0.1", port: mediaPort, method: "GET",
      path: "http://ignored:credentials@untrusted.invalid/media/fixture.mp4?asset=valid",
      headers: { cookie: "classroom_hub_session=test-session", authorization: "Bearer test-only",
        "x-forwarded-host": "untrusted.invalid" }, agent: false }, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", chunk => { body += chunk; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
      res.on("error", reject);
    });
    request.on("error", reject);
    request.end();
  });
  assert.equal(response.status, 200);
  assert.equal(response.body, "0123456789");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/media/fixture.mp4?asset=valid");
  assert.equal(requests[0].headers.cookie, "classroom_hub_session=test-session");
  assert.equal(requests[0].headers.authorization, undefined);
  assert.equal(requests[0].headers["x-forwarded-host"], undefined);
});


test("authorization has a wall-clock deadline even while upstream sends interim responses", async t => {
  let closed = false;
  const { origin } = await fixture(t, (req, res) => {
    res.writeProcessing();
    const keepAlive = setInterval(() => res.writeProcessing(), 100);
    res.once("close", () => { closed = true; clearInterval(keepAlive); });
  });
  const started = Date.now();
  const response = await fetch(`${origin}/media/fixture.mp4?asset=valid`, {
    signal: AbortSignal.timeout(5000)
  });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "1");
  assert.equal(await response.text(), "");
  assert.ok(Date.now() - started < 4500, "authorization exceeded its bounded deadline");
  await until(() => closed, "timed-out authorization retained its upstream socket");
});

test("authorization failures never disclose file bytes", async t => {
  const { origin } = await fixture(t, (req, res) => {
    const status = Number(new URL(req.url, "http://control.invalid").searchParams.get("status"));
    if (status === 0) { req.socket.destroy(); return; }
    res.writeHead(status); res.end();
  });
  for (const [status, expected] of [[401, 401], [403, 403], [404, 403], [302, 403], [500, 403], [0, 503]]) {
    const response = await fetch(`${origin}/media/fixture.mp4?status=${status}`);
    assert.equal(response.status, expected, `upstream HTTP ${status}`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "");
  }
});
