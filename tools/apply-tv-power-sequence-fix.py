"""One-use work-branch repair; removed before the final pull-request commit."""
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
server = root / "src/server.js"
expected_blob = "03651f450220a808b8f510d08530daccd0ecf85a"
actual_blob = subprocess.check_output(["git", "hash-object", str(server)], text=True).strip()
if actual_blob != expected_blob:
    raise SystemExit("Refusing to patch an unexpected server revision")
text = server.read_text()

def replace_once(old, new):
    global text
    if text.count(old) != 1:
        raise SystemExit("Expected exactly one source anchor: " + old[:100])
    text = text.replace(old, new, 1)

replace_once(
    'async function runSingleAutomationAction(event,{manual=false,skipOverlay=false,skipAudit=false,commandSource="automation"}={}){',
    'async function runSingleAutomationAction(event,{manual=false,skipOverlay=false,skipAudit=false,commandSource="automation",tvTargetsOverride=null}={}){'
)
replace_once(
    '    const requestedTargets=Array.isArray(event.targets)?event.targets.map(cleanId).filter(Boolean):[];\n    const broadcastTarget=p.output===undefined&&requestedTargets.length===1?requestedTargets[0]:null;',
    '    const requestedTargets=[...new Set(Array.isArray(event.targets)?event.targets.map(cleanId).filter(Boolean):[])];\n    // An explicit All selector is intent, not an expanded list of receiver IDs.\n    // Legacy individual-output metadata must not narrow an aggregate command.\n    const broadcastTarget=requestedTargets.includes("all")?"all":requestedTargets.length===1?requestedTargets[0]:null;'
)
replace_once(
    '    const tvTargets=expandTvTargets(requestedTargets,{devices,connection:p.connection==="hdmi"?"hdmi":"hdbt"});',
    '    // Only the in-process sequence runner supplies this typed, lock-filtered\n    // override. Preserve its forced transport instead of expanding IDs again.\n    const tvTargets=Array.isArray(tvTargetsOverride)?tvTargetsOverride.map(target=>({...target})):expandTvTargets(requestedTargets,{devices,connection:p.connection==="hdmi"?"hdmi":"hdbt"});'
)
replace_once(
    '''      let resolvedTargets;
      if(stepDomain==="display-content"||stepDomain==="display-overlay")resolvedTargets=automationDisplayTargets(rawTargets);
      else if(stepDomain==="tv-power")resolvedTargets=expandTvTargets(rawTargets,{devices,connection:step.payload?.connection||"hdbt"}).map(item=>item.id);
      else resolvedTargets=[...rawTargets];

      let lockedTargets=[];''',
    '''      let resolvedTargets,resolvedTvTargets=null;
      if(stepDomain==="display-content"||stepDomain==="display-overlay")resolvedTargets=automationDisplayTargets(rawTargets);
      else if(stepDomain==="tv-power"){
        resolvedTvTargets=expandTvTargets(rawTargets,{devices,connection:step.payload?.connection||"hdbt"});
        resolvedTargets=resolvedTvTargets.map(item=>item.id);
      }else resolvedTargets=[...rawTargets];

      const stepPayload={...(step.payload||{}),...(stepAction==="display.media"?{loop:step.executionMode==="loop"}:{})};
      if(stepDomain==="tv-power"&&rawTargets.some(id=>["all","hdmi-all","hdbt-all"].includes(cleanId(id))))delete stepPayload.output;
      // Preserve aggregate intent only when it cannot broaden a filtered
      // announcement target set. Any active receiver lock prohibits broadcast,
      // including receivers whose IDs are not part of the legacy tvN inventory.
      const preserveTvSelectors=stepDomain==="tv-power"&&(bypassAnnouncementPriority||announcementLockedDisplayTargets(["all"]).length===0);
      let lockedTargets=[];'''
)
start = text.index('async function runClassroomAutomation')
end = text.index('function safeStoredName', start)
runner = text[start:end]
old_event = 'payload:{...(step.payload||{}),...(stepAction==="display.media"?{loop:step.executionMode==="loop"}:{})},targets:resolvedTargets,timerOverlay:null'
new_event = 'payload:stepPayload,targets:preserveTvSelectors&&!lockedTargets.length?rawTargets:resolvedTargets,timerOverlay:null'
old_call = 'runSingleAutomationAction(stepEvent,{manual,skipOverlay:true,skipAudit:true})'
new_call = 'runSingleAutomationAction(stepEvent,{manual,skipOverlay:true,skipAudit:true,tvTargetsOverride:resolvedTvTargets?.filter(target=>resolvedTargets.includes(target.id))})'
if runner.count(old_event) != 2 or runner.count(old_call) != 2:
    raise SystemExit("Expected both priority-aware sequence dispatch sites")
runner = runner.replace(old_event, new_event).replace(old_call, new_call)
text = text[:start] + runner + text[end:]
server.write_text(text)

contract = '''
## TV-power aggregate intent

Read `docs/TV-POWER-AUTOMATION.md` before changing scheduled TV power. Preserve
explicit All/HDMI-All/HDBT-All selectors through the canonical action sequence;
expanded IDs are for resource/priority checks, not a replacement for broadcast
intent. Never broadcast after announcement filtering or while any configured
receiver is announcement-locked. Keep typed output/connection rows through
partial filtering so forced HDMI/HDBT selection survives. Individual output
metadata must not narrow an aggregate or redirect its last unlocked target.
The override is an internal function option, never a persisted/browser field.
Do not replay uncertain CEC writes. Test the real sequence and single-action
handler together; helper-only and source-string tests missed this regression.
'''
for name in ['AGENTS.md', 'docs/AI-CONTEXT.md']:
    file = root / name
    file.write_text(file.read_text().rstrip() + '\n' + contract)

controller = root / 'docs/CONTROLLER.md'
old = "An automated TV-power step with **All TVs**, **All HDMI TVs**, or **All HDBT TVs** uses the matching Pluto broadcast CEC command, the same command used by the Room controls. A selected set of TVs continues to use individual output commands."
new = old + " The canonical sequence preserves that selector until dispatch rather than replacing it with browser receiver IDs. During Morning Announcements, broadcasts are prohibited: locked targets are deferred and remaining targets use their original output/connection rows. Legacy individual-output metadata does not narrow an aggregate. See [TV power automation](TV-POWER-AUTOMATION.md) for regression coverage and deployment verification."
body = controller.read_text()
if body.count(old) != 1:
    raise SystemExit("Controller documentation anchor changed")
controller.write_text(body.replace(old, new, 1))

wiki = root / 'wiki/Automation-Display-Media.md'
wiki.write_text(wiki.read_text().rstrip() + '''

## Scheduled TV power

All TVs, All HDMI TVs and All HDBT TVs retain their selectors through the ordered
action sequence and use the corresponding Pluto broadcast command. This matches
the manual room controls and does not depend on browser receiver count or duplicate
receiver-to-output mappings. Existing automations do not need to be recreated.
Individual selections continue using individual mapped outputs.

Morning Announcements prohibit aggregate broadcasts while any configured receiver
is locked. Locked targets are deferred; unlocked targets retain their original
HDMI/HDBT transport. Stale individual output metadata cannot redirect a filtered
aggregate onto a locked target. Run once, action ordering, cancellation, calendar
suppression and continue-on-error behavior remain unchanged. Failed or uncertain
CEC results remain failures and are not automatically replayed.

Deploy the exact validated and published image pair with the normal backed-up
main updater. Verify the existing automation on physical TVs after installation;
a successful command acknowledgement is not a physical power-state measurement.
See `docs/TV-POWER-AUTOMATION.md` in the source repository for the detailed contract
and executable sequence regression command.
''')

changelog = root / 'CHANGELOG.md'
body = changelog.read_text()
anchor = '## Unreleased\n'
entry = '''
### Scheduled all-TV power handoff

- Preserve All TVs/HDMI/HDBT selectors through the canonical sequence so scheduled
  shutdown uses the same Pluto broadcast path as manual room controls, rather
  than a second expansion of possibly remapped browser receiver IDs.
- Retain typed outputs/transports after Morning Announcements filtering, prohibit
  broadcasts during receiver locks, and ignore stale individual-output metadata
  on aggregate actions without changing stored automation/device configuration.
- Add executable full-sequence regressions for scheduled/manual and legacy runs,
  remapped receivers, priority filtering, failures, cancellation and Run once;
  update operator, Wiki and AI documentation. Physical acceptance remains separate.

'''
if body.count(anchor) != 1:
    raise SystemExit("Changelog anchor changed")
changelog.write_text(body.replace(anchor, anchor + entry, 1))

(root / 'docs/TV-POWER-AUTOMATION.md').write_text('''# Scheduled TV power and aggregate selectors

## Defect and execution path

The TV-power handler already supports the same Pluto broadcast command used by
manual room controls. The canonical action sequencer nevertheless expanded a
saved All selector to receiver IDs before calling that handler. The broadcast
branch was therefore unreachable from normal sequence execution. A second
expansion could also lose a forced HDMI/HDBT transport, and duplicate receiver
output mappings could omit a physical port from the resulting individual writes.

The correction retains two distinct values: requested selector intent and typed
resolved output/connection rows. Expanded IDs are still used for existing
resource and announcement-priority checks. With no announcement receiver lock,
explicit All selectors reach the handler unchanged. All TVs dominates redundant
narrower selections; duplicate selections do not duplicate the broadcast.

| Saved selector | Pluto command |
| --- | --- |
| All TVs (`all`) | `cecAllOutputs` |
| All HDMI TVs (`hdmi-all`) | `cecAllHdmi` |
| All HDBT TVs (`hdbt-all`) | `cecAllHdbt` |

Power On retains index 0 and Power Off retains index 1. Individual TV selections
still use `cecOutput` with their saved mapping; they never broaden to All merely
because they happen to cover several or all ports. A legacy individual `output`
field does not narrow aggregate intent. No stored event, receiver mapping, group,
credential, database schema, archived topology or deployment identifier changes.

## Priority and failure boundaries

Any announcement-locked configured receiver prevents aggregate broadcast,
including a receiver outside the legacy tvN inventory. Existing target filtering
continues to defer locked targets; if every target is locked, no TV-power command
is sent. Partial dispatch carries the original typed output/connection rows as
an internal function option, avoiding another ID expansion that would discard
an explicit HDMI/HDBT transport. The runner removes stale aggregate `output`
metadata before filtering so it cannot redirect the last remaining output.
This option is not accepted as a browser or persisted automation override.

The existing internal announcement-priority bypass remains separate from normal
scheduled and manual Run Now operation. This repair does not change the existing
receiver-to-physical-output priority mapping model, discover physical wiring, or
assert that a browser receiver's name identifies a particular physical panel.

A rejected, missing, pending-verification or thrown adapter result is a failed
action. Continue-on-error advances only according to the saved action setting;
it does not turn the result into success. No automatic CEC retries are added,
particularly after uncertain delivery. Run once still participates only on pass
1. Calendar suppression, class-end handling, occurrence cancellation, timers,
Morning Announcements ownership and Background Music policy are unchanged.

## Executable regression coverage

```bash
node --test test/automation-tv-power-sequence.test.js
npm run check
npm test
```

The focused harness executes the actual `runClassroomAutomation` and
`runSingleAutomationAction` source together with the real schema and target
helpers. Only appliance dependencies are fixtures. It covers scheduled/manual
broadcast parity, canonical/legacy events, cross-domain/default/inherited
targets, remapped/duplicate receiver outputs, explicit individual commands,
forced transport after partial locks, full deferral, failure handling, no replay,
Run once, cancellation, pause and class-end boundaries. A helper-only test or
assertion that the source contains `cecAllOutputs` cannot detect this handoff bug.

These tests do not contact classroom hardware or verify physical panel standby.

## Upgrade, acceptance and rollback

Wait for the required PR and merged-main validation gates and publication of the
exact SHA-tagged Hub/maintenance images. Use the existing backed-up updater:

```bash
sudo bash /opt/classroom-hub/deploy/update-production.sh --plan
sudo bash /opt/classroom-hub/deploy/update-production.sh
```

Do not pull main first, copy files into the running container, retag an older
image, or bypass a failed validation/publication gate. See
[Production updates](PRODUCTION-UPDATES.md) for old-runner transition and rollback.
This is a Hub application change; the normal selective updater may retain the
unchanged maintenance component after its existing input/identity checks.

After deployment, compare the running Hub OCI revision with the selected commit
and verify `/health` and `/health/ready`. Run the existing shutdown automation in
an appropriate maintenance period and confirm every intended physical panel,
including the previously missed panel, enters standby. Then verify manual power
controls still work. No automation recreation or Android APK reinstall is needed.
A successful Pluto acknowledgement alone is not proof of physical power state.

The updater owns operational backup, health checking and automatic rollback on
deployment failure. Preserve its saved source/database/environment and image
identity together when reverting; do not reset the database or recreate device
credentials to undo this source-only repair.
''')
