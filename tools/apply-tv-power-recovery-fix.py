"""One-use recovery repair; removed before the tested work-branch commit."""
from pathlib import Path
import subprocess
root = Path(__file__).resolve().parents[1]
server = root / 'src/server.js'
if subprocess.check_output(['git', 'hash-object', str(server)], text=True).strip() != '25e3c2c8ed9e55976f517a5f94cf5d688385d84c':
    raise SystemExit('Unexpected source revision; refusing recovery patch')
text = server.read_text()
a = text.index('function currentAutomationNonDisplayWinners')
b = text.index('function automationOccurrenceIsActiveForContinuousRecovery', a)
section = text[a:b]
old = '        const resolved=domain==="tv-power"?expandTvTargets(targets,{devices,connection:step.payload?.connection||"hdbt"}).map(item=>item.id):targets;'
new = '''        const tvTargets=domain==="tv-power"?expandTvTargets(targets,{devices,connection:step.payload?.connection||"hdbt"}):null;
        const resolved=tvTargets?tvTargets.map(item=>item.id):targets;
        // Shared in-process identity connects winners from this exact step and
        // occurrence. Do not replace the existing per-target precedence model.
        const tvPowerIntent=tvTargets?{targets:[...targets],resolvedTargets:tvTargets}:null;'''
if section.count(old) != 1 or section.count(',domain,target});') != 1:
    raise SystemExit('Winner selection anchors changed')
section = section.replace(old, new, 1).replace(',domain,target});', ',domain,target,...(tvPowerIntent?{tvPowerIntent}:{})});', 1)
section += '''function planAutomationNonDisplayDispatches(winners,{lockedTargets=[]}={}){
  const locked=new Set(lockedTargets),tvWinners=winners.filter(winner=>winner.domain==="tv-power");
  const intent=tvWinners[0]?.tvPowerIntent;
  const requested=[...new Set((intent?.targets||[]).map(cleanId).filter(Boolean))];
  const candidate=requested.includes("all")?"all":requested.length===1?requested[0]:null;
  const selector=["all","hdmi-all","hdbt-all"].includes(candidate)?candidate:null;
  // A broadcast is safe only when this exact aggregate step owns the complete
  // TV winner set. Any competing winner (even a remapped alias) keeps dispatch
  // per-target; never broadcast first and try to repair overridden TVs later.
  const complete=Boolean(selector&&intent?.resolvedTargets?.length&&
    tvWinners.every(winner=>winner.tvPowerIntent===intent)&&
    intent.resolvedTargets.every(target=>tvWinners.some(winner=>winner.target===target.id)));
  let emitted=false;
  return winners.flatMap(winner=>{
    if(winner.domain!=="tv-power")return [winner];
    if(locked.has(winner.target))return [{...winner,deferred:true}];
    const metadata=winner.tvPowerIntent,payload={...(winner.event.payload||{})};
    if((metadata?.targets||[]).some(id=>["all","hdmi-all","hdbt-all"].includes(cleanId(id))))delete payload.output;
    if(complete&&!locked.size){
      if(emitted)return [];
      emitted=true;
      return [{...winner,target:selector,event:{...winner.event,targets:[selector],payload},tvTargetsOverride:intent.resolvedTargets}];
    }
    return [{...winner,event:{...winner.event,payload},tvTargetsOverride:metadata?.resolvedTargets?.filter(target=>target.id===winner.target)}];
  });
}
'''
text = text[:a] + section + text[b:]
a = text.index('async function reconcileScheduledAutomationState')
b = text.index('app.get("/api/v1/automation-control"', a)
section = text[a:b]
old = '  for(const winner of currentAutomationNonDisplayWinners(now)){'
new = '''  const nonDisplayWinners=currentAutomationNonDisplayWinners(now);
  for(const winner of planAutomationNonDisplayDispatches(nonDisplayWinners,{lockedTargets:announcementLockedDisplayTargets(["all"])})){
    if(winner.deferred){resourceResults.push({automationId:winner.automationId,name:winner.name,domain:winner.domain,target:winner.target,ok:true,deferred:true,lockedTargets:[winner.target]});continue}'''
call = 'runSingleAutomationAction(winner.event,{manual:false,skipOverlay:true,skipAudit:true})'
if section.count(old) != 1 or section.count(call) != 1 or section.count('resourceWinners:resourceResults.length,ok') != 1:
    raise SystemExit('Reconciliation dispatch anchors changed')
section = section.replace(old, new, 1).replace(call, 'runSingleAutomationAction(winner.event,{manual:false,skipOverlay:true,skipAudit:true,tvTargetsOverride:winner.tvTargetsOverride})', 1).replace('resourceWinners:resourceResults.length,ok', 'resourceWinners:nonDisplayWinners.length,resourceDispatches:resourceResults.length,ok', 1)
server.write_text(text[:a] + section + text[b:])

notes = '''
Startup and Resume Scheduled State must preserve the same aggregate intent.
Keep per-target winner scoring unchanged; coalesce to one broadcast only when
the same aggregate step/occurrence owns every current TV winner and its complete
resolved scope, with no receiver locks. Partial overrides retain individual
commands and their typed transports; never broadcast then replay the overriding
TV command. Test real winner selection and reconciliation, not only Run Now.
'''
for name in ['AGENTS.md', 'docs/AI-CONTEXT.md', 'wiki/Automation-Display-Media.md']:
    file = root / name
    file.write_text(file.read_text().rstrip() + '\n' + notes)
file = root / 'docs/TV-POWER-AUTOMATION.md'
body = file.read_text().replace('node --test test/automation-tv-power-sequence.test.js', 'node --test test/automation-tv-power-*.test.js')
anchor = '## Executable regression coverage\n'
recovery = '''## Startup and Resume Scheduled State

Recovery first computes the existing per-target winners using scheduled time,
priority and event identity. Each TV winner retains a shared, in-process marker
for its original step/occurrence and that step's requested selectors and typed
output/connection rows. This marker is not persisted and does not change scores.

Only an explicit aggregate that owns every current TV winner and its complete
resolved target scope can become one broadcast. Any competing TV winner keeps
execution per-target, including a winner represented by a remapped receiver ID.
The planner does not broadcast first and then replay overrides. Partial winners
retain forced HDMI/HDBT transports and discard stale aggregate output metadata.
Explicit individual selections never become a broadcast merely by covering all
outputs. Full Morning Announcements restoration keeps its existing early return;
remaining receiver locks also prohibit broadcasts and defer locked TV writes.

Reconciliation audit keeps the logical `resourceWinners` count and adds
`resourceDispatches` for the potentially smaller command/result count. A broadcast
result remains an acknowledgement, not eight physical-state measurements.

'''
if body.count(anchor) != 1:
    raise SystemExit('Recovery documentation anchor changed')
file.write_text(body.replace(anchor, recovery + anchor, 1))
file = root / 'docs/CONTROLLER.md'
file.write_text(file.read_text().rstrip() + '''

Startup and **Resume Scheduled State** preserve aggregate TV-power intent only
when the aggregate owns the complete current TV winner set. A newer/higher-priority
individual TV winner prevents a broadcast; its per-target precedence is retained.
Recovery also preserves forced HDMI/HDBT transports and receiver-lock deferral.
''')
file = root / 'CHANGELOG.md'
body = file.read_text()
anchor = '- Retain typed outputs/transports after Morning Announcements filtering, prohibit\n'
entry = '''- Preserve aggregate TV intent through startup/resume reconciliation only when
  one step owns the complete TV winner set; keep per-target precedence and typed
  transports for partial overrides instead of broadcasting and replaying overrides.
'''
if body.count(anchor) != 1:
    raise SystemExit('Changelog repair section changed')
file.write_text(body.replace(anchor, entry + anchor, 1))
