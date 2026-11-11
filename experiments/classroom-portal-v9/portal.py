#!/usr/bin/env python3
"""RoomGoblin Classroom Portal v9: isolated synthetic-pilot application.

No Schoology REST API, verified learner identity, AI grading, or hardware access.
Standard-library HTTP service: run only behind a trusted HTTPS reverse proxy.
"""
from __future__ import annotations

import argparse
import contextlib
import csv
import hashlib
import html
import io
import json
import math
import os
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
from http.cookies import SimpleCookie, CookieError
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
import zipfile

VERSION = "9.0.0-pilot.1"
ROOT = Path(__file__).resolve().parent
PREFIX = "/portal/api/v9"
MAX_BODY = 262144
SCHEMA = """
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS courses(id TEXT PRIMARY KEY,name TEXT NOT NULL,period TEXT NOT NULL,created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,course_id TEXT NOT NULL REFERENCES courses(id),
 definition TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS grants(id TEXT PRIMARY KEY,token_hash TEXT UNIQUE NOT NULL,assignment_id TEXT NOT NULL REFERENCES assignments(id),
 learner_id TEXT NOT NULL,label TEXT NOT NULL,role TEXT NOT NULL,expires REAL NOT NULL,revoked INTEGER NOT NULL DEFAULT 0,created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS commands(assignment_id TEXT PRIMARY KEY REFERENCES assignments(id),revision INTEGER NOT NULL DEFAULT 0,
 paused_until REAL NOT NULL DEFAULT 0,stage INTEGER NOT NULL DEFAULT 1,hint TEXT NOT NULL DEFAULT '',discussion_open INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS events(grant_id TEXT NOT NULL REFERENCES grants(id),id TEXT NOT NULL,assignment_id TEXT NOT NULL,
 kind TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,created REAL NOT NULL,PRIMARY KEY(grant_id,id));
CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES grants(id),assignment_id TEXT NOT NULL REFERENCES assignments(id),
 learner_id TEXT NOT NULL,label TEXT NOT NULL,answers TEXT NOT NULL,rubric TEXT NOT NULL,created REAL NOT NULL,
 late INTEGER NOT NULL DEFAULT 0,review TEXT,review_revision INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS posts(id TEXT PRIMARY KEY,assignment_id TEXT NOT NULL REFERENCES assignments(id),grant_id TEXT,
 label TEXT NOT NULL,parent_id TEXT REFERENCES posts(id),body TEXT NOT NULL,role TEXT NOT NULL,
 hidden INTEGER NOT NULL DEFAULT 0,created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,action TEXT NOT NULL,target TEXT NOT NULL,detail TEXT NOT NULL,created REAL NOT NULL);
CREATE INDEX IF NOT EXISTS events_assignment ON events(assignment_id,created);
CREATE INDEX IF NOT EXISTS submissions_assignment ON submissions(assignment_id,created);
CREATE INDEX IF NOT EXISTS posts_assignment ON posts(assignment_id,created);
"""

class Problem(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def canonical(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def text(value, name: str, maximum: int, minimum: int = 0) -> str:
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum or "\x00" in value:
        raise Problem(400, f"Invalid {name} (length {minimum}–{maximum}).")
    return value.strip()


def integer(value, name: str, low: int, high: int) -> int:
    if type(value) is not int or not low <= value <= high:
        raise Problem(400, f"Invalid {name} ({low}–{high}).")
    return value


def boolean(value, name: str) -> bool:
    if type(value) is not bool:
        raise Problem(400, f"Invalid {name}.")
    return value


def origin(value: str, allow_http: bool = False) -> str:
    if not isinstance(value, str) or any(ord(c) <= 32 or ord(c) == 127 for c in value):
        raise ValueError("Origin must not contain whitespace or control characters.")
    p = urlsplit(value)
    if p.scheme not in (("https", "http") if allow_http else ("https",)) or not p.hostname or p.username or p.password or p.path not in ("", "/") or p.query or p.fragment:
        raise ValueError("Use an exact HTTPS origin, without a path or credentials.")
    return f"{p.scheme}://{p.netloc}"


def seed_definition() -> dict:
    return {
        "title": "Compare Two Safe Storage Plans", "instructions":
        "Compare your proposed 500-GB Windows + data plan with an actual peer plan or the teacher-provided alternative. "
        "Identify the alternative in your response; do not invent another student's work. "
        "Illustrative alternative: 150 GB Windows (NTFS), 300 GB data (NTFS), about 50 GB unallocated/reserved. "
        "Account for actual usable capacity and required system partitions. Different allocations can be valid.",
        "safety": "Read-only. Never initialize, resize, delete, partition, format, convert, or change disks. "
        "Do not elevate privileges or bypass restrictions. Use a sanitized teacher report if access is blocked. "
        "Do not include names, device names, serial numbers, credentials, or private file contents.",
        "criteria": [
            {"id": "alloc", "label": "Clear allocations and appropriate filesystem choices", "prompt": "State your Windows and data allocations, filesystem choices, and the competing plan you evaluated.", "points": 5},
            {"id": "strength", "label": "Specific strength and tradeoff supported by comparison", "prompt": "Explain one strength and one tradeoff compared with the other plan.", "points": 5},
            {"id": "backup", "label": "Correct protection decision without a verified backup", "prompt": "New information: the disk contains irreplaceable files and no verified backup. How does your recommendation change?", "points": 6},
            {"id": "improve", "label": "Constructive improvement or evidence check with accurate terminology", "prompt": "Give one specific improvement or read-only evidence check. Use disk, partition, volume, or filesystem accurately.", "points": 4}],
        "due_at": None, "cutoff_at": None,
        "late_policy": "After the posted due date: maximum 50% credit. No submissions after the next class starts unless an exception is approved. Dates must be explicitly configured in this portal; Schoology dates are not imported.",
        "discussion_enabled": True,
    }


def validate_definition(obj: dict) -> dict:
    if not isinstance(obj, dict):
        raise Problem(400, "Assignment definition must be an object.")
    out = {k: text(obj.get(k, ""), k, n, 1 if k == "title" else 0) for k, n in
           (("title", 160), ("instructions", 12000), ("safety", 3000), ("late_policy", 2000))}
    criteria = obj.get("criteria")
    if not isinstance(criteria, list) or not 1 <= len(criteria) <= 12:
        raise Problem(400, "Provide 1–12 rubric criteria.")
    out["criteria"] = []
    ids = set()
    for c in criteria:
        if not isinstance(c, dict):
            raise Problem(400, "Invalid criterion.")
        cid = text(c.get("id"), "criterion ID", 40, 1)
        if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_-]*", cid) or cid in ids:
            raise Problem(400, "Criterion IDs must be unique simple identifiers.")
        ids.add(cid)
        out["criteria"].append({"id": cid, "label": text(c.get("label"), "criterion label", 300, 1),
            "prompt": text(c.get("prompt"), "prompt", 2000, 1), "points": integer(c.get("points"), "points", 1, 100)})
    if sum(c["points"] for c in out["criteria"]) > 1000:
        raise Problem(400, "Maximum total is 1,000 points.")
    for key in ("due_at", "cutoff_at"):
        v = obj.get(key)
        if v is not None and (type(v) not in (int, float) or not math.isfinite(v) or v <= 0):
            raise Problem(400, "Invalid deadline timestamp.")
        out[key] = v
    if out["cutoff_at"] is not None and (out["due_at"] is None or out["cutoff_at"] <= out["due_at"]):
        raise Problem(400, "Cutoff must be after the due date.")
    out["discussion_enabled"] = boolean(obj.get("discussion_enabled", True), "discussion enabled")
    return out


class App:
    def __init__(self, db_path: Path, admin_token: str, public_origin: str, allowed_origins=(), legacy_path=None, test=False):
        if len(admin_token) < 24:
            raise ValueError("PORTAL_ADMIN_TOKEN must contain at least 24 characters.")
        self.path = Path(db_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.admin_token = admin_token
        self.public_origin = origin(public_origin, allow_http=test)
        self.allowed = {origin(x, allow_http=test) for x in allowed_origins if x.strip()}
        self.legacy_path = Path(legacy_path) if legacy_path else None
        self.test = test
        self.sessions = {}
        self.failures = {}
        self.lock = threading.Lock()
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(SCHEMA)
            version = db.execute("SELECT value FROM meta WHERE key='schema'").fetchone()
            if version and version[0] != "1":
                raise RuntimeError("Unknown database schema; refusing downgrade.")
            db.execute("INSERT OR IGNORE INTO meta VALUES('schema','1')")
            if not db.execute("SELECT 1 FROM courses LIMIT 1").fetchone():
                db.execute("INSERT INTO courses VALUES(?,?,?,?)", ("demo-class", "IT I — Essentials", "Teacher test", time.time()))
                self.insert_assignment(db, "storage-plans", "demo-class", seed_definition())
        os.chmod(self.path, 0o600)

    @contextlib.contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=10000")
        try:
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def audit(self, db, action, target, detail=None):
        db.execute("INSERT INTO audit(action,target,detail,created) VALUES(?,?,?,?)",
                   (action, target, canonical(detail or {}), time.time()))

    def insert_assignment(self, db, aid, course, definition):
        db.execute("INSERT INTO assignments(id,course_id,definition,created) VALUES(?,?,?,?)", (aid, course, canonical(definition), time.time()))
        db.execute("INSERT INTO commands(assignment_id) VALUES(?)", (aid,))

    def assignment(self, db, aid):
        r = db.execute("SELECT * FROM assignments WHERE id=?", (aid,)).fetchone()
        if not r:
            raise Problem(404, "Assignment not found.")
        return {"id": r["id"], "course_id": r["course_id"], "revision": r["revision"], "definition": json.loads(r["definition"])}

    def command(self, db, aid):
        r = dict(db.execute("SELECT * FROM commands WHERE assignment_id=?", (aid,)).fetchone())
        r["pause_remaining"] = max(0, r["paused_until"] - time.time())
        r["paused"] = r["pause_remaining"] > 0
        r["discussion_open"] = bool(r["discussion_open"])
        return r

    def login(self, supplied, peer):
        now = time.time()
        with self.lock:
            self.failures = {k: v for k, v in self.failures.items() if v[1] > now - 60}
            hits, _ = self.failures.get(peer, (0, now))
            if hits >= 10:
                raise Problem(429, "Too many sign-in attempts. Try again in a minute.")
            if not isinstance(supplied, str) or len(supplied)>256 or not secrets.compare_digest(supplied.encode(), self.admin_token.encode()):
                self.failures[peer] = (hits + 1, now)
                raise Problem(401, "Invalid teacher token.")
            self.failures.pop(peer, None)
            self.sessions = {k: v for k, v in self.sessions.items() if v["expires"] > now}
            if len(self.sessions) >= 100:
                raise Problem(429, "Too many active teacher sessions.")
            sid = secrets.token_urlsafe(32)
            csrf = secrets.token_urlsafe(24)
            self.sessions[hashlib.sha256(sid.encode()).hexdigest()] = {"csrf": csrf, "expires": now + 8 * 3600}
        return sid, csrf

    def session(self, cookie):
        try:
            c = SimpleCookie(cookie)
            sid = c["rg_portal_session"].value
        except (KeyError, ValueError, CookieError):
            raise Problem(401, "Sign in to the teacher portal.")
        with self.lock:
            obj = self.sessions.get(hashlib.sha256(sid.encode()).hexdigest())
            if not obj or obj["expires"] <= time.time():
                raise Problem(401, "Teacher session expired.")
            return dict(obj)

    def grant(self, db, bearer, role="learner"):
        if not isinstance(bearer, str) or not bearer.startswith("Bearer "):
            raise Problem(401, "Missing scoped test credential.")
        tok = bearer[7:]
        if len(tok) > 256:
            raise Problem(401, "Invalid credential.")
        row = db.execute("SELECT * FROM grants WHERE token_hash=?", (hashlib.sha256(tok.encode()).hexdigest(),)).fetchone()
        if not row or row["revoked"] or row["expires"] <= time.time() or row["role"] != role:
            raise Problem(401, "Test credential expired, revoked, or not permitted here.")
        return dict(row)

    def issue_grant(self, db, aid, label, role="learner"):
        self.assignment(db, aid)
        token = secrets.token_urlsafe(32)
        gid, lid = secrets.token_hex(12), "synthetic-" + secrets.token_hex(8)
        expires = time.time() + 7 * 86400
        db.execute("INSERT INTO grants VALUES(?,?,?,?,?,?,?,?,?)", (gid, hashlib.sha256(token.encode()).hexdigest(), aid, lid, label, role, expires, 0, time.time()))
        self.audit(db, "grant-issued", aid, {"id": gid, "role": role, "label": label})
        return token, {"id": gid, "learner_id": lid, "label": label, "expires": expires}

    def visible_posts(self, db, aid, teacher=False):
        rows = [dict(r) for r in db.execute("SELECT id,label,parent_id,body,role,hidden,created FROM posts WHERE assignment_id=? ORDER BY created,id", (aid,))]
        hidden = {r["id"] for r in rows if r["hidden"]}
        for _ in range(len(rows) + 1):
            more = {r["id"] for r in rows if r["parent_id"] in hidden}
            if more <= hidden:
                break
            hidden |= more
        for r in rows:
            r["effectively_hidden"] = r["id"] in hidden
        return rows if teacher else [r for r in rows if not r["effectively_hidden"]]

    def submissions(self, db, aid=None, grant_id=None):
        clauses, vals = [], []
        for k, v in (("assignment_id", aid), ("grant_id", grant_id)):
            if v:
                clauses.append(k + "=?"); vals.append(v)
        sql = "SELECT * FROM submissions" + (" WHERE " + " AND ".join(clauses) if clauses else "") + " ORDER BY created DESC LIMIT 500"
        out = []
        for row in db.execute(sql, vals):
            r = dict(row)
            for k in ("answers", "rubric", "review"):
                r[k] = json.loads(r[k]) if r[k] else None
            if grant_id and r["review"] and not r["review"].get("published"):
                r["review"] = None
            out.append(r)
        return out

    def receive(self, db, grant, items):
        if not isinstance(items, list) or not 1 <= len(items) <= 30:
            raise Problem(400, "Send 1–30 events.")
        # BEGIN IMMEDIATE serializes duplicate checks and writes. Any invalid item rolls back the whole batch.
        db.execute("BEGIN IMMEDIATE")
        a = self.assignment(db, grant["assignment_id"])
        definition = a["definition"]
        command = self.command(db, a["id"])
        accepted = []
        for item in items:
            if not isinstance(item, dict):
                raise Problem(400, "Invalid event.")
            eid = text(item.get("id"), "event ID", 120, 1)
            if not re.fullmatch(r"[a-zA-Z0-9._:-]+", eid):
                raise Problem(400, "Invalid event ID characters.")
            kind = item.get("kind")
            if kind not in ("submission", "discussion", "progress", "receipt"):
                raise Problem(400, "Unsupported event type.")
            payload = item.get("payload")
            if not isinstance(payload, dict) or len(canonical(payload).encode()) > 90000:
                raise Problem(400, "Invalid event payload.")
            raw = canonical({"kind": kind, "payload": payload})
            digest = hashlib.sha256(raw.encode()).hexdigest()
            old = db.execute("SELECT digest FROM events WHERE grant_id=? AND id=?", (grant["id"], eid)).fetchone()
            if old:
                if old[0] != digest:
                    raise Problem(409, "Event ID reused with different content.")
                accepted.append(eid)
                continue
            now = time.time()
            internal = grant["id"] + ":" + eid
            if kind == "submission":
                if definition["cutoff_at"] and now >= definition["cutoff_at"]:
                    raise Problem(403, "Submission cutoff reached; draft remains on this device. Contact the teacher.")
                ans = payload.get("answers")
                valid_ids = {c["id"] for c in definition["criteria"]}
                if not isinstance(ans, dict) or set(ans) != valid_ids:
                    raise Problem(400, "Answer fields must exactly match this assignment.")
                answers = {k: text(v, "answer", 4000, 1) for k, v in ans.items()}
                db.execute("INSERT INTO submissions(id,grant_id,assignment_id,learner_id,label,answers,rubric,created,late) VALUES(?,?,?,?,?,?,?,?,?)",
                    (internal, grant["id"], a["id"], grant["learner_id"], grant["label"], canonical(answers), canonical(definition["criteria"]), now, int(bool(definition["due_at"] and now > definition["due_at"]))))
            elif kind == "discussion":
                if not definition["discussion_enabled"] or not command["discussion_open"]:
                    raise Problem(403, "Discussion is closed; your unsent post stays on this device.")
                body = text(payload.get("body"), "post", 4000, 1)
                parent = payload.get("parent_id")
                if parent is not None:
                    if not isinstance(parent, str) or parent not in {r["id"] for r in self.visible_posts(db, a["id"])}:
                        raise Problem(400, "Reply target is unavailable in this assignment.")
                db.execute("INSERT INTO posts VALUES(?,?,?,?,?,?,?,0,?)", (internal, a["id"], grant["id"], grant["label"], parent, body, "synthetic learner", now))
            elif kind == "progress":
                integer(payload.get("answered", 0), "answered count", 0, len(definition["criteria"]))
                # Only safe counts are stored for progress; never accept identity claims or unbounded diagnostic data.
                if set(payload) - {"answered", "total", "preview"}:
                    raise Problem(400, "Unsupported progress fields.")
            elif kind == "receipt":
                integer(payload.get("command_revision"), "command revision", 0, 2**31 - 1)
                if set(payload) != {"command_revision"}:
                    raise Problem(400, "Invalid command receipt.")
            db.execute("INSERT INTO events VALUES(?,?,?,?,?,?,?)", (grant["id"], eid, a["id"], kind, canonical(payload), digest, now))
            accepted.append(eid)
        # Caller returns only after this transaction has committed.
        return {"ok": True, "accepted_ids": accepted}

    def teacher_get(self, path, query):
        with self.connect() as db:
            aid = query.get("assignment", [None])[0]
            if path == "/overview":
                courses = [dict(r) for r in db.execute("SELECT * FROM courses ORDER BY name,period")]
                assignments = [self.assignment(db, r[0]) for r in db.execute("SELECT id FROM assignments ORDER BY created DESC")]
                for a in assignments:
                    a["locked"] = bool(db.execute("SELECT 1 FROM grants WHERE assignment_id=? LIMIT 1", (a["id"],)).fetchone())
                counts = {k: db.execute("SELECT COUNT(*) FROM " + t).fetchone()[0] for k, t in
                          (("courses", "courses"), ("assignments", "assignments"), ("submissions", "submissions"), ("posts", "posts"))}
                counts["reviewed"] = db.execute("SELECT COUNT(*) FROM submissions WHERE review IS NOT NULL").fetchone()[0]
                grants = [dict(r) for r in db.execute("SELECT id,assignment_id,label,role,expires,revoked,created FROM grants ORDER BY created DESC LIMIT 200")]
                progress = [dict(r) for r in db.execute("SELECT g.id,g.assignment_id,g.label,g.revoked,MAX(e.created) AS last_seen,COUNT(e.id) AS event_count FROM grants g LEFT JOIN events e ON g.id=e.grant_id WHERE g.role='learner' GROUP BY g.id ORDER BY last_seen DESC LIMIT 200")]
                return {"version": VERSION, "counts": counts, "courses": courses, "assignments": assignments, "grants": grants, "progress": progress, "origins": sorted(self.allowed), "public_origin": self.public_origin, "identity": "synthetic-only"}
            if path == "/submissions":
                return {"submissions": self.submissions(db, aid)}
            if path == "/posts":
                self.assignment(db, aid)
                return {"posts": self.visible_posts(db, aid, teacher=True)}
            if path == "/command":
                self.assignment(db, aid)
                return self.command(db, aid)
            if path == "/audit":
                return {"audit": [dict(r) for r in db.execute("SELECT * FROM audit ORDER BY id DESC LIMIT 200")]}
            if path == "/legacy":
                return self.legacy()
        raise Problem(404, "Endpoint not found.")

    def legacy(self):
        if not self.legacy_path or not self.legacy_path.exists():
            return {"available": False, "message": "No legacy database configured."}
        try:
            db = sqlite3.connect(self.legacy_path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)
            db.row_factory = sqlite3.Row
            out = {"available": True, "read_only": True}
            with contextlib.closing(db):
                existing = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                for tab in ("events", "discussions", "portal_reviews", "portal_audit"):
                    out[tab] = [dict(r) for r in db.execute(f'SELECT * FROM "{tab}" ORDER BY rowid DESC LIMIT 100')] if tab in existing else []
                    out[tab + "_count"] = db.execute(f'SELECT COUNT(*) FROM "{tab}"').fetchone()[0] if tab in existing else 0
            return out
        except sqlite3.Error:
            raise Problem(503, "Legacy data is unavailable; v9 data is unaffected.")

    def teacher_post(self, path, obj):
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            if path == "/courses":
                cid = secrets.token_hex(10)
                name = text(obj.get("name"), "course name", 120, 1)
                period = text(obj.get("period", ""), "period", 80)
                db.execute("INSERT INTO courses VALUES(?,?,?,?)", (cid, name, period, time.time()))
                self.audit(db, "course-created", cid)
                return {"id": cid}
            if path == "/assignments":
                cid = text(obj.get("course_id"), "course", 100, 1)
                if not db.execute("SELECT 1 FROM courses WHERE id=?", (cid,)).fetchone():
                    raise Problem(400, "Course not found.")
                definition = validate_definition(obj.get("definition"))
                aid = obj.get("id")
                if aid:
                    a = self.assignment(db, aid)
                    if a["revision"] != obj.get("revision"):
                        raise Problem(409, "Assignment changed; reload before editing.")
                    if db.execute("SELECT 1 FROM grants WHERE assignment_id=? LIMIT 1", (aid,)).fetchone():
                        raise Problem(409, "Assignment is locked after export. Duplicate it to change the rubric or content.")
                    db.execute("UPDATE assignments SET course_id=?,definition=?,revision=revision+1 WHERE id=?", (cid, canonical(definition), aid))
                else:
                    aid = secrets.token_hex(10)
                    self.insert_assignment(db, aid, cid, definition)
                self.audit(db, "assignment-saved", aid)
                return {"id": aid}
            if path == "/command":
                aid = text(obj.get("assignment_id"), "assignment", 100, 1)
                self.assignment(db, aid)
                current = self.command(db, aid)
                if obj.get("revision") != current["revision"]:
                    raise Problem(409, "Command changed in another tab. Reload before sending.")
                paused = boolean(obj.get("paused"), "paused")
                stage = integer(obj.get("stage"), "stage", 1, 20)
                hint = text(obj.get("hint", ""), "hint", 500)
                opened = boolean(obj.get("discussion_open"), "discussion open")
                seconds = integer(obj.get("pause_seconds", 120), "pause duration", 10, 300)
                db.execute("UPDATE commands SET revision=revision+1,paused_until=?,stage=?,hint=?,discussion_open=? WHERE assignment_id=?",
                           (time.time() + seconds if paused else 0, stage, hint, int(opened), aid))
                self.audit(db, "command", aid, {"paused": paused, "stage": stage, "discussion_open": opened})
                return self.command(db, aid)
            if path == "/review":
                sid = text(obj.get("id"), "submission", 200, 1)
                row = db.execute("SELECT * FROM submissions WHERE id=?", (sid,)).fetchone()
                if not row:
                    raise Problem(404, "Submission not found.")
                if obj.get("revision") != row["review_revision"]:
                    raise Problem(409, "Review changed in another tab. Reload before saving.")
                rubric = json.loads(row["rubric"])
                scores = obj.get("scores")
                if not isinstance(scores, dict) or set(scores) != {c["id"] for c in rubric}:
                    raise Problem(400, "Score every rubric criterion.")
                for c in rubric:
                    integer(scores[c["id"]], c["label"], 0, c["points"])
                published = boolean(obj.get("published"), "publish")
                exception = boolean(obj.get("late_exception", False), "late exception")
                total, possible = sum(scores.values()), sum(c["points"] for c in rubric)
                awarded = min(total, possible / 2) if row["late"] and not exception else total
                review = {"scores": scores, "total": total, "possible": possible, "awarded": awarded, "published": published,
                          "late_exception": exception, "feedback": text(obj.get("feedback", ""), "feedback", 4000), "reviewed_at": time.time()}
                db.execute("UPDATE submissions SET review=?,review_revision=review_revision+1 WHERE id=?", (canonical(review), sid))
                self.audit(db, "review-published" if published else "review-draft", sid, {"awarded": awarded, "late_exception": exception})
                return {"ok": True, "review": review, "revision": row["review_revision"] + 1}
            if path == "/moderate":
                pid = text(obj.get("id"), "post", 200, 1)
                hidden = boolean(obj.get("hidden"), "hidden")
                if not db.execute("SELECT 1 FROM posts WHERE id=?", (pid,)).fetchone():
                    raise Problem(404, "Post not found.")
                db.execute("UPDATE posts SET hidden=? WHERE id=?", (int(hidden), pid))
                self.audit(db, "post-hidden" if hidden else "post-restored", pid)
                return {"ok": True}
            if path == "/reply":
                aid = text(obj.get("assignment_id"), "assignment", 100, 1)
                self.assignment(db, aid)
                parent = obj.get("parent_id")
                if parent and not db.execute("SELECT 1 FROM posts WHERE id=? AND assignment_id=?", (parent, aid)).fetchone():
                    raise Problem(400, "Parent does not belong to this assignment.")
                body = text(obj.get("body"), "reply", 4000, 1)
                pid = "teacher-" + secrets.token_hex(12)
                db.execute("INSERT INTO posts VALUES(?,?,NULL,?,?,?,?,0,?)", (pid, aid, "Teacher", parent, body, "teacher", time.time()))
                self.audit(db, "teacher-reply", pid, {"assignment_id": aid})
                return {"id": pid}
            if path == "/revoke":
                gid = text(obj.get("id"), "grant", 100, 1)
                if not db.execute("SELECT 1 FROM grants WHERE id=?", (gid,)).fetchone():
                    raise Problem(404, "Credential not found.")
                db.execute("UPDATE grants SET revoked=1 WHERE id=?", (gid,))
                self.audit(db, "grant-revoked", gid)
                return {"ok": True}
            if path == "/display":
                token, grant = self.issue_grant(db, text(obj.get("assignment_id"), "assignment", 100, 1), "Aggregate classroom display", "display")
                return {"url": self.public_origin + "/portal/board/#" + token, "expires": grant["expires"]}
        raise Problem(404, "Endpoint not found.")

    def export(self, aid, label):
        with self.connect() as db:
            a = self.assignment(db, aid)
            token, grant = self.issue_grant(db, aid, text(label, "synthetic participant label", 80, 1))
            config = {"apiOrigin": self.public_origin, "token": token, "assignment": a, "participant": grant, "synthetic": True, "version": VERSION}
            # JSON escapes script-breaking characters even though config is a separate local JS file.
            conf = canonical(config).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
                for src, dst in (("index.html", "index.html"), ("learner.js", "learner.js"), ("style.css", "style.css")):
                    z.writestr(dst, (ROOT / "scorm" / src).read_bytes())
                z.writestr("config.js", "window.CLASSROOM_CONFIG=" + conf + ";\n")
                title = html.escape(a["definition"]["title"])
                manifest = f'''<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="roomgoblin_{aid}_{grant['id']}" version="1.0" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations default="ORG"><organization identifier="ORG"><title>{title}</title><item identifier="ITEM" identifierref="RES"><title>{title}</title></item></organization></organizations><resources><resource identifier="RES" type="webcontent" adlcp:scormtype="sco" href="index.html"><file href="index.html"/><file href="learner.js"/><file href="style.css"/><file href="config.js"/></resource></resources></manifest>'''
                z.writestr("imsmanifest.xml", manifest)
                z.writestr("README.txt", "Synthetic test package. The embedded credential is scoped to one assignment and test participant, expires in seven days, and cannot issue teacher commands. It is extractable, not verified student identity. Copying this ZIP copies the same test identity. No gradebook passback.\n")
            data = buf.getvalue()
        return data

    def csv_export(self, aid):
        with self.connect() as db:
            rows = self.submissions(db, aid)
        buf = io.StringIO(newline="")
        writer = csv.writer(buf)
        writer.writerow(["submission_id", "assignment_id", "synthetic_label", "received_utc_epoch", "late", "reviewed_points", "possible", "published", "feedback", "answers_json"])
        def safe(v):
            s = str(v) if v is not None else ""
            return "'" + s if s.lstrip().startswith(("=", "+", "-", "@")) or s.startswith(("\t", "\r", "\n")) else s
        for r in rows:
            review = r["review"] or {}
            writer.writerow([safe(x) for x in (r["id"], r["assignment_id"], r["label"], r["created"], bool(r["late"]), review.get("awarded", ""), sum(c["points"] for c in r["rubric"]), review.get("published", False), review.get("feedback", ""), canonical(r["answers"]))])
        return buf.getvalue().encode("utf-8-sig")


class LimitedServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    def __init__(self, address, app):
        self.app = app
        self.workers = threading.BoundedSemaphore(32)
        super().__init__(address, Handler)
    def process_request(self, request, address):
        if not self.workers.acquire(blocking=False):
            request.close(); return
        try:
            super().process_request(request, address)
        except BaseException:
            self.workers.release(); raise
    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.workers.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "RoomGoblinPilot/9"
    def setup(self):
        super().setup()
        self.connection.settimeout(10)
    @property
    def app(self):
        return self.server.app
    def log_message(self, fmt, *args):
        # No headers, request body, token, query strings, or submission content in access logs.
        print(f"{self.command} {urlsplit(self.path).path[:180]} {str(args[1]) if len(args)>1 else ''}", flush=True)
    def send(self, status, obj=None, typ="application/json", headers=None):
        body = obj if isinstance(obj, bytes) else (canonical(obj).encode() if typ == "application/json" else str(obj).encode())
        if status in (204, 304):
            body = b""
        self.send_response(status)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'")
        path = urlsplit(self.path).path
        req_origin = self.headers.get("Origin", "")
        configured_origin = next((allowed for allowed in self.app.allowed if allowed == req_origin), None)
        if path.startswith(PREFIX + "/learner/") and configured_origin is not None:
            self.send_header("Access-Control-Allow-Origin", configured_origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Headers", "Authorization,Content-Type")
            self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)
    def payload(self):
        if self.headers.get("Transfer-Encoding"):
            raise Problem(400, "Transfer-Encoding is not supported.")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            raise Problem(400, "Invalid content length.")
        if not 0 < length <= MAX_BODY:
            raise Problem(413, "Request too large or empty.")
        if self.headers.get_content_type() != "application/json":
            raise Problem(415, "Use application/json.")
        try:
            obj = json.loads(self.rfile.read(length), parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
        except (ValueError, UnicodeDecodeError):
            raise Problem(400, "Invalid JSON.")
        if not isinstance(obj, dict):
            raise Problem(400, "Expected a JSON object.")
        return obj
    def same_origin(self):
        if self.headers.get("Origin", "") != self.app.public_origin:
            raise Problem(403, "Teacher request origin rejected.")
    def auth_teacher(self, write=False):
        s = self.app.session(self.headers.get("Cookie", ""))
        if write:
            self.same_origin()
            if not secrets.compare_digest(self.headers.get("X-CSRF-Token", "").encode(), s["csrf"].encode()):
                raise Problem(403, "CSRF check failed.")
        return s
    def cookie(self, sid, clear=False):
        return f"rg_portal_session={sid}; Path=/portal; HttpOnly; SameSite=Strict; Max-Age={0 if clear else 28800}" + ("" if self.app.test else "; Secure")
    def do_OPTIONS(self):
        try:
            if not urlsplit(self.path).path.startswith(PREFIX + "/learner/") or self.headers.get("Origin", "") not in self.app.allowed:
                raise Problem(403, "Origin not allowed.")
            requested = {h.strip().lower() for h in self.headers.get("Access-Control-Request-Headers", "").split(",") if h.strip()}
            if not requested <= {"authorization", "content-type"} or self.headers.get("Access-Control-Request-Method") not in ("GET", "POST"):
                raise Problem(403, "Preflight rejected.")
            self.send(204, b"")
        except Problem as e:
            self.send(e.status, {"error": e.message})
    def do_HEAD(self):
        self.do_GET()
    def do_GET(self):
        self.dispatch("GET")
    def do_POST(self):
        self.dispatch("POST")
    def dispatch(self, method):
        try:
            self.route(method)
        except Problem as e:
            self.send(e.status, {"error": e.message})
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        except sqlite3.Error:
            self.send(503, {"error": "Database temporarily unavailable. Your draft remains local; retry."})
        except Exception as e:
            print("Unhandled server exception:", type(e).__name__, flush=True)
            self.send(500, {"error": "Unexpected server error; no success receipt issued."})
    def route(self, method):
        split = urlsplit(self.path)
        path, query = split.path, parse_qs(split.query)
        if method == "GET":
            if path == "/portal":
                return self.send(308, b"", headers={"Location": "/portal/"})
            if path == PREFIX + "/health":
                return self.send(200, {"ok": True, "version": VERSION, "identity": "synthetic-only"})
            static = {"/portal/": "index.html", "/portal/app.js": "app.js", "/portal/style.css": "style.css", "/portal/board/": "board.html", "/portal/board.js": "board.js"}
            if path in static:
                p = ROOT / "static" / static[path]
                typ = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8"}[p.suffix]
                return self.send(200, p.read_bytes(), typ)
        if path.startswith(PREFIX + "/learner/"):
            o = self.headers.get("Origin")
            if o and o not in self.app.allowed:
                raise Problem(403, "Learner origin not allowed.")
            with self.app.connect() as db:
                grant = self.app.grant(db, self.headers.get("Authorization"))
                if method == "GET" and path == PREFIX + "/learner/state":
                    a = self.app.assignment(db, grant["assignment_id"])
                    result = {"command": self.app.command(db, a["id"]), "posts": self.app.visible_posts(db, a["id"]), "submissions": self.app.submissions(db, grant_id=grant["id"]), "server_time": time.time(), "synthetic": True}
                elif method == "POST" and path == PREFIX + "/learner/events":
                    result = self.app.receive(db, grant, self.payload().get("events"))
                else:
                    raise Problem(404, "Learner endpoint not found.")
            return self.send(200, result)  # database committed before network acknowledgment
        if method == "GET" and path == PREFIX + "/display/state":
            with self.app.connect() as db:
                g = self.app.grant(db, self.headers.get("Authorization"), "display")
                a = self.app.assignment(db, g["assignment_id"])
                submitted = db.execute("SELECT COUNT(DISTINCT learner_id) FROM submissions WHERE assignment_id=?", (a["id"],)).fetchone()[0]
                posts = len(self.app.visible_posts(db, a["id"]))
                result = {"title": a["definition"]["title"], "submitted": submitted, "posts": posts, "stage": self.app.command(db, a["id"])["stage"], "synthetic": True}
            return self.send(200, result)
        if method == "POST" and path == PREFIX + "/login":
            self.same_origin()
            sid, csrf = self.app.login(self.payload().get("token"), self.client_address[0])
            return self.send(200, {"csrf": csrf}, headers={"Set-Cookie": self.cookie(sid)})
        if not path.startswith(PREFIX + "/"):
            raise Problem(404, "Not found.")
        session = self.auth_teacher(method == "POST")
        subpath = path[len(PREFIX):]
        if method == "GET":
            if subpath == "/session":
                return self.send(200, {"csrf": session["csrf"]})
            if subpath == "/export.csv":
                return self.send(200, self.app.csv_export(query.get("assignment", [None])[0]), "text/csv; charset=utf-8", {"Content-Disposition": 'attachment; filename="classroom-reviews.csv"'})
            return self.send(200, self.app.teacher_get(subpath, query))
        obj = self.payload()
        if subpath == "/logout":
            c = SimpleCookie(self.headers.get("Cookie", ""))
            sid = c["rg_portal_session"].value
            with self.app.lock:
                self.app.sessions.pop(hashlib.sha256(sid.encode()).hexdigest(), None)
            return self.send(200, {"ok": True}, headers={"Set-Cookie": self.cookie("", True)})
        if subpath == "/package":
            data = self.app.export(text(obj.get("assignment_id"), "assignment", 100, 1), obj.get("label"))
            return self.send(200, data, "application/zip", {"Content-Disposition": 'attachment; filename="RoomGoblin-Classroom-Test-SCORM.zip"'})
        return self.send(200, self.app.teacher_post(subpath, obj))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate configuration and initialize/check the v9 database, then exit.")
    args = parser.parse_args()
    data = Path(os.getenv("DATA_DIR", "/var/lib/schoology-api-test"))
    app = App(data / "classroom-v9.sqlite3", os.environ["PORTAL_ADMIN_TOKEN"], os.environ["PORTAL_PUBLIC_ORIGIN"],
              os.getenv("ALLOWED_ORIGINS", "").split(","), data / "events.sqlite3")
    if args.check:
        with app.connect() as db:
            if db.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                raise SystemExit("Database check failed.")
        print("Configuration and database check passed.")
        return
    host = os.getenv("PORTAL_BIND", "127.0.0.1")
    port = int(os.getenv("PORTAL_PORT", "8770"))
    print(f"RoomGoblin Classroom Portal {VERSION}; synthetic pilot; listening on configured interface port {port}.", flush=True)
    with LimitedServer((host, port), app) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass

if __name__ == "__main__":
    main()
