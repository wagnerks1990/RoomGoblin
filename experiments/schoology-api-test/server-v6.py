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
 cols=[row[1] for row in db.execute("PRAGMA table_info(commands)")]
 if "stage" not in cols:db.execute("ALTER TABLE commands ADD COLUMN stage INTEGER DEFAULT 1")
 db.execute("CREATE TABLE IF NOT EXISTS discussions(id TEXT PRIMARY KEY,actor TEXT,parent_id TEXT,body TEXT,score INTEGER,feedback TEXT,created REAL)")
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
  if self.path=="/api/health":return self.respond(200,{"ok":True,"service":"schoology-api-test","version":6})
  if not self.authorized():return self.respond(401,{"error":"unauthorized"})
  with sqlite3.connect(DB) as db:
   if self.path=="/api/state":
    v,p,h,stage=db.execute("SELECT version,paused,hint,stage FROM commands WHERE id=1").fetchone()
    return self.respond(200,{"command":{"version":v,"paused":bool(p),"hint":h,"stage":stage}})
   if self.path=="/api/discussion":
    rows=db.execute("SELECT id,actor,parent_id,body,score,feedback,created FROM discussions ORDER BY created DESC LIMIT 100").fetchall()
    return self.respond(200,{"posts":[{"id":r[0],"actor":r[1],"parent_id":r[2],"body":r[3],"score":r[4],"feedback":r[5],"created":r[6]} for r in rows]})
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
   if self.path=="/api/events":
    events=data.get("events")
    if not isinstance(events,list) or len(events)>100:return self.respond(400,{"error":"invalid events"})
    ids=[]
    for item in events:
     if not isinstance(item,dict):return self.respond(400,{"error":"invalid event"})
     eid=str(item.get("id") or uuid.uuid4());kind=item.get("kind","test")
     if not isinstance(kind,str) or len(kind)>64:return self.respond(400,{"error":"invalid kind"})
     db.execute("INSERT OR IGNORE INTO events VALUES(?,?,?,?)",(eid,kind,json.dumps(item),time.time()));ids.append(eid)
    return self.respond(200,{"ok":True,"ids":ids,"accepted":len(ids)})
   if self.path=="/api/discussion":
    actor=data.get("actor");body=data.get("body");parent=data.get("parent_id")
    if actor not in ("Student A","Student B","Teacher Demo") or not isinstance(body,str) or not 1<=len(body)<=1500:return self.respond(400,{"error":"invalid discussion"})
    matches=sum(term in body.lower() for term in ("phishing","verify","report","link","password","mfa","security"))
    score=min(20,matches*4);feedback="Demo feedback: "+("Includes relevant security concepts." if matches>=2 else "Add concrete indicators and response steps.")
    eid=str(uuid.uuid4())
    db.execute("INSERT INTO discussions VALUES(?,?,?,?,?,?,?)",(eid,actor,parent,body,score,feedback,time.time()))
    return self.respond(200,{"ok":True,"id":eid,"score":score,"feedback":feedback})
   if self.path=="/api/event":
    kind=data.get("kind","test")
    if not isinstance(kind,str) or len(kind)>64:return self.respond(400,{"error":"invalid kind"})
    eid=str(data.get("id") or uuid.uuid4())
    db.execute("INSERT OR IGNORE INTO events VALUES(?,?,?,?)",(eid,kind,json.dumps(data),time.time()))
    return self.respond(200,{"ok":True,"id":eid})
   if self.path=="/api/command":
    paused=data.get("paused");hint=data.get("hint","");stage=data.get("stage",1)
    if type(paused)!=bool or not isinstance(hint,str) or len(hint)>300 or type(stage)!=int or not 1<=stage<=20:return self.respond(400,{"error":"invalid command"})
    db.execute("UPDATE commands SET version=version+1,paused=?,hint=?,stage=? WHERE id=1",(int(paused),hint,stage))
    return self.respond(200,{"ok":True})
  self.respond(404,{"error":"not found"})
if __name__=="__main__":
 ThreadingHTTPServer((os.environ.get("BIND_HOST","127.0.0.1"),int(os.environ.get("PORT","8765"))),Handler).serve_forever()
