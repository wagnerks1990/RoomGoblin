#!/usr/bin/env python3
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
server_path=ROOT/'src/server.js'
s=server_path.read_text()

old='function assertAutomationConflicts(candidate,events){const conflicts=automationConflictDiagnostics(candidate,events);if(!conflicts.length)return;const first=conflicts[0],error=new Error(`${candidate.name} conflicts with ${first.otherName} at ${first.time} on ${first.date}. Save it disabled or resolve the shared targets.`);error.code="AUTOMATION_CONFLICT";error.conflicts=conflicts;throw error}'
new='''function automationConflictSignature(conflict){\n  return [String(conflict?.otherId||""),String(conflict?.date||""),String(conflict?.time||""),...(conflict?.resources||[]).map(String).sort()].join("|");\n}\nfunction assertAutomationConflicts(candidate,events,{previous=null,startDate=new Date()}={}){\n  const conflicts=automationConflictDiagnostics(candidate,events,{startDate});\n  if(!conflicts.length)return;\n  // Existing installations may already contain same-minute resource overlaps that\n  // predate conflict validation. Editing an existing event must not become an\n  // accidental configuration lockout. Preserve those exact existing overlaps,\n  // while still rejecting any newly introduced date/time/resource collision.\n  let blocking=conflicts;\n  if(previous&&previous.enabled!==false){\n    const existing=new Set(automationConflictDiagnostics(previous,events,{startDate}).map(automationConflictSignature));\n    blocking=conflicts.filter(conflict=>!existing.has(automationConflictSignature(conflict)));\n  }\n  if(!blocking.length)return;\n  const first=blocking[0],error=new Error(`${candidate.name} conflicts with ${first.otherName} at ${first.time} on ${first.date}. Save it disabled or resolve the shared targets.`);error.code="AUTOMATION_CONFLICT";error.conflicts=blocking;throw error;\n}'''
if old not in s:
    raise SystemExit('assertAutomationConflicts marker not found')
s=s.replace(old,new,1)
old_route='assertAutomationConflicts(event,classroomAutomations.events.filter((_,index)=>index!==idx));'
new_route='assertAutomationConflicts(event,classroomAutomations.events.filter((_,index)=>index!==idx),{previous:prior});'
if old_route not in s:
    raise SystemExit('automation update conflict marker not found')
s=s.replace(old_route,new_route,1)
server_path.write_text(s)

# Focused source-level regression guard for the compatibility behavior.
test_path=ROOT/'test/automation-existing-conflict-edit.test.js'
test_path.write_text(r'''"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const server=fs.readFileSync(path.join(__dirname,"..","src","server.js"),"utf8");

test("editing an existing automation preserves only pre-existing conflict signatures",()=>{
  assert.match(server,/function automationConflictSignature\(conflict\)/);
  assert.match(server,/automationConflictDiagnostics\(previous,events,\{startDate\}\)/);
  assert.match(server,/blocking=conflicts\.filter\(conflict=>!existing\.has\(automationConflictSignature\(conflict\)\)\)/);
  assert.match(server,/assertAutomationConflicts\(event,classroomAutomations\.events\.filter\(\(_,index\)=>index!==idx\),\{previous:prior\}\)/);
});

test("new automation creation still rejects resource conflicts",()=>{
  assert.match(server,/assertAutomationConflicts\(event,classroomAutomations\.events\);/);
});
''')

doc_path=ROOT/'docs/AUTOMATION-FRAMEWORK.md'
doc=doc_path.read_text()
needle='## Regression requirements\n'
insert='''## Existing-conflict edit compatibility\n\nConflict validation must not turn an already-saved automation into an uneditable record after an upgrade. When an existing enabled automation is edited, RoomGoblin compares the candidate conflicts with the exact conflicts produced by the previously saved revision over the same planning horizon. Exact pre-existing date/time/resource overlaps are grandfathered for that edit; newly introduced overlaps are still rejected. New automations continue to require conflict-free enabled schedules.\n\nThis compatibility rule does not create new runtime priority semantics and does not silently disable either event. It exists only to preserve editability of configurations that were valid before conflict validation was introduced. Operators can then deliberately resolve or reprioritize those legacy overlaps instead of being locked out of unrelated edits.\n\n'''
if insert not in doc:
    if needle not in doc: raise SystemExit('documentation insertion marker not found')
    doc=doc.replace(needle,insert+needle,1)
doc_path.write_text(doc)

wiki_path=ROOT/'wiki/Automation-Framework.md'
if wiki_path.exists():
    wiki=wiki_path.read_text()
    if insert not in wiki and needle in wiki:
        wiki=wiki.replace(needle,insert+needle,1)
        wiki_path.write_text(wiki)
