#!/usr/bin/env python3
from pathlib import Path
p=Path('src/server.js')
s=p.read_text()
old='app.get("/api/v1/displays/:id/media/status",requireControl,(req,res)=>{'
new='app.get("/api/v1/displays/:id/media/status",schedulerReadLimit,requireControl,(req,res)=>{'
if old not in s: raise SystemExit('media status route marker missing')
s=s.replace(old,new,1)
p.write_text(s)
print('added scheduler read rate limit to media status route')
