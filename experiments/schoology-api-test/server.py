#!/usr/bin/env python3
"""Isolated synthetic-data Schoology API connectivity test. Not production authentication."""
import json, os, sqlite3, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
DB=Path(os.environ.get("DATA_DIR","/var/lib/schoology-api-test"))/"events.sqlite3"
DB.parent.mkdir(parents=True,exist_ok=True)
KEY=os.environ["DEMO_KEY"]
ORIGINS=set(filter(None,os.environ.get("ALLOWED_ORIGINS","").split(",")))
with sqlite3.connect(DB) as db:
 db.execute("CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, kind TEXT, payload TEXT, created REAL)")
 db.execute("CREATE TABLE IF NOT EXISTS commands(id INTEGER PRIMARY KEY, version INTEGER, paused INTEGER, hint TEXT)")
 db.execute("INSERT OR IGNORE INTO commands VALUES(1,0,0,'')")
class Handler(BaseHTTPRequestHandler):
 def respond(self,status,data):
  body=json.dumps(data).encode(); self.send_response(status)
  self.send_header("Content-Type","application/json");self.send_header("Content-Length",str(len(body)))
  self.send_header("Cache-Control","no-store")
  origin=self.headers.get("Origin","")
  if origin in ORIGINS:
   self.send_header("Access-Control-Allow-Origin",origin);self.send_header("Vary","Origin")
   self.send_header("Access-Control-Allow-Headers","Content-Type,X-Demo-Key")
   self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS")
  self.end_headers();self.wfile.write(body)
 def do_OPTIONS(self):self.respond(204,{})
 def authorized(self):return self.headers.get("X-Demo-Key")==KEY
 def do_GET(self):
  if self.path=="/api/health":return self.respond(200,{"ok":True,"service":"schoology-api-test"})
  if not self.authorized():return self.respond(401,{"error":"unauthorized"})
  with sqlite3.connect(DB) as db:
   if self.path=="/api/state":
    v,p,h=db.execute("SELECT version,paused,hint FROM commands WHERE id=1").fetchone()
    return self.respond(200,{"command":{"version":v,"paused":bool(p),"hint":h}})
   if self.path=="/api/dashboard":
    rows=db.execute("SELECT id,kind,payload,created FROM events ORDER BY created DESC LIMIT 100").fetchall()
    return self.respond(200,{"events":[{"id":r[0],"kind":r[1],"payload":json.loads(r[2]),"created":r[3]} for r in rows]})
  self.respond(404,{"error":"not found"})
 def do_POST(self):
  if not self.authorized():return self.respond(401,{"error":"unauthorized"})
  try:
   length=int(self.headers.get("Content-Length","0"))
   if not 0<length<=32768:return self.respond(413,{"error":"invalid size"})
   data=json.loads(self.rfile.read(length))
   if not isinstance(data,dict):raise ValueError()
  except (ValueError,json.JSONDecodeError):return self.respond(400,{"error":"invalid JSON"})
  with sqlite3.connect(DB) as db:
   if self.path=="/api/event":
    kind=data.get("kind","test")
    if not isinstance(kind,str) or len(kind)>64:return self.respond(400,{"error":"invalid kind"})
    eid=str(data.get("id") or uuid.uuid4())
    db.execute("INSERT OR IGNORE INTO events VALUES(?,?,?,?)",(eid,kind,json.dumps(data),time.time()))
    return self.respond(200,{"ok":True,"id":eid})
   if self.path=="/api/command":
    paused=data.get("paused");hint=data.get("hint","")
    if type(paused)!=bool or not isinstance(hint,str) or len(hint)>300:return self.respond(400,{"error":"invalid command"})
    db.execute("UPDATE commands SET version=version+1,paused=?,hint=? WHERE id=1",(int(paused),hint))
    return self.respond(200,{"ok":True})
  self.respond(404,{"error":"not found"})
if __name__=="__main__":
 ThreadingHTTPServer(("127.0.0.1",8765),Handler).serve_forever()
