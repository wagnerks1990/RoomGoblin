"use strict";

const crypto = require("node:crypto");
const {promisify} = require("node:util");
const {recoveryTransportAllowed} = require("./recovery-transport-policy");
const pbkdf2 = promisify(crypto.pbkdf2);
const STORE = "windows.daily-signin.v1";
const FORMAT = "roomgoblin-daily-signin-v1";
const ITERATIONS = 600000;
const secretName = id => `windows.daily-signin.${id}`;
const fail = (message, status = 400) => Object.assign(new Error(message), {status});

function dayAt(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone, year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(now);
  const part = name => parts.find(p => p.type === name).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function dailyCode(seed, id, day) {
  if (!Buffer.isBuffer(seed) || seed.length !== 32 || !/^[a-f0-9-]{36}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw fail("Invalid daily-code identity.");
  const digest = crypto.createHmac("sha256", seed).update(`${FORMAT}\n${id}\n${day}`, "utf8").digest();
  return String(digest.readBigUInt64BE(0) % 100000000n).padStart(8, "0");
}
function text(value, label, max = 80) {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) throw fail(`Invalid ${label}.`);
  return value.trim();
}

class DailySignIn {
  constructor(storage, {now = () => new Date()} = {}) { this.storage = storage; this.now = now; }
  list() { return this.storage.getPreference(STORE, []); }
  group(id) { const row = this.list().find(g => g.id === id); if (!row) throw fail("Sign-in group not found.", 404); return row; }
  create(input) {
    const name = text(input.name, "group name"), timeZone = text(input.timeZone, "timezone");
    try { dayAt(timeZone); } catch { throw fail("Choose a valid IANA timezone, such as America/New_York."); }
    const group = {id:crypto.randomUUID(), name, timeZone, createdAt:this.now().toISOString()};
    this.storage.tx(() => {
      const groups = this.list();
      if (groups.length >= 64) throw fail("At most 64 sign-in groups are supported.", 409);
      if (groups.some(g => g.name.toLowerCase() === name.toLowerCase())) throw fail("A group with this name already exists.", 409);
      this.storage.putSecret(secretName(group.id), crypto.randomBytes(32), {type:"daily-signin-seed"});
      this.storage.setPreference(STORE, [...groups, group]);
    });
    return group;
  }
  code(id) {
    const group = this.group(id), day = dayAt(group.timeZone, this.now());
    const seed = this.storage.getSecret(secretName(id), {asBuffer:true});
    if (!seed) throw fail("Group key is unavailable.", 503);
    try { return {code:dailyCode(seed, id, day), day, timeZone:group.timeZone}; } finally { seed.fill(0); }
  }
  async provision(id, input) {
    const group = this.group(id);
    const computerName = text(input.computerName, "Windows computer name", 15);
    if (!/^[a-z0-9][a-z0-9-]{0,14}$/i.test(computerName)) throw fail("Use the exact Windows computer name (letters, numbers and hyphens, up to 15 characters).");
    const username = text(input.username, "local account name", 20);
    if ([...username].some(c => '\\/[]:;|=,+*?<>@"'.includes(c)) || username.endsWith(".")) throw fail("Use a local Windows account name without a domain.");
    const passphrase = input.passphrase;
    if (typeof passphrase !== "string" || passphrase.length < 16 || Buffer.byteLength(passphrase) > 1024) throw fail("Enrollment passphrase must contain 16 or more characters and at most 1024 UTF-8 bytes.");
    const salt = crypto.randomBytes(16), nonce = crypto.randomBytes(12);
    const key = await pbkdf2(passphrase, salt, ITERATIONS, 32, "sha256");
    const seed = this.storage.getSecret(secretName(id), {asBuffer:true});
    if (!seed) { key.fill(0); throw fail("Group key is unavailable.", 503); }
    const now = this.now();
    const payload = Buffer.from(JSON.stringify({format:FORMAT, groupId:id, groupName:group.name, timeZone:group.timeZone,
      computerName:computerName.toUpperCase(), username, seed:seed.toString("base64"), issuedAt:now.toISOString(),
      expiresAt:new Date(now.getTime() + 24*60*60*1000).toISOString()}));
    try {
      const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
      cipher.setAAD(Buffer.from(FORMAT));
      const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
      return {format:FORMAT, iterations:ITERATIONS, salt:salt.toString("base64"), nonce:nonce.toString("base64"),
        ciphertext:ciphertext.toString("base64"), tag:cipher.getAuthTag().toString("base64")};
    } finally { seed.fill(0); key.fill(0); payload.fill(0); }
  }
}

function registerDailySignInRoutes(app, {storage, requireAdmin, isAdmin, canRun = () => true, audit = () => {}, trustProxyHops = 0}) {
  const {rateLimit} = require("express-rate-limit");
  const manager = new DailySignIn(storage), base = "/api/v1/admin/daily-signin";
  const limit = rateLimit({windowMs:60000, limit:30, keyGenerator:()=>"daily-signin", skip:req=>!isAdmin(req), standardHeaders:"draft-8", legacyHeaders:false});
  const secure = (req,res,next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!recoveryTransportAllowed(req, {trustProxyHops}).allowed) return res.status(426).json({ok:false,error:"Daily sign-in codes and enrollment require HTTPS or a browser connected through localhost."});
    next();
  };
  const handle = fn => async (req,res) => {
    try { if (!canRun()) throw fail("Appliance changes are temporarily locked.", 423); await fn(req,res); }
    catch (error) { res.status(error.status || 500).json({ok:false,error:error.status ? error.message : "Daily sign-in operation failed. Check configuration and retry explicitly."}); }
  };
  app.get(base, limit, requireAdmin, secure, handle(async (_req,res) => res.json({ok:true,groups:manager.list()})));
  app.post(`${base}/groups`, limit, requireAdmin, secure, handle(async (req,res) => {
    const group = manager.create(req.body || {});
    audit({kind:"daily-signin.group.create", groupId:group.id});
    res.status(201).json({ok:true,group});
  }));
  app.post(`${base}/groups/:id/code`, limit, requireAdmin, secure, handle(async (req,res) => {
    const result = manager.code(req.params.id);
    audit({kind:"daily-signin.code.view", groupId:req.params.id});
    res.json({ok:true,...result});
  }));
  app.post(`${base}/groups/:id/enrollment`, limit, requireAdmin, secure, handle(async (req,res) => {
    const enrollment = await manager.provision(req.params.id, req.body || {});
    audit({kind:"daily-signin.enrollment.export", groupId:req.params.id});
    res.json({ok:true,enrollment});
  }));
  return manager;
}
module.exports = {DailySignIn, registerDailySignInRoutes, dailyCode, dayAt, FORMAT, ITERATIONS, STORE, secretName};
