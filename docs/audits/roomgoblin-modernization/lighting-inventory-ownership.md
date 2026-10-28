# Lighting inventory and feedback ownership

Baseline: qualified presentation rebuild integration `83a4b15`.

## RG-LIGHTS-001: Older reads replaced newer inventory

Three actual-source failures reproduced an older Lighting response replacing a
newer inventory, an obsolete error replacing successful feedback, and slow
scheduler dependencies republishing an older lighting snapshot.

Lighting and the scheduler now share one inventory read owner. Older requests
follow the latest read; only that read publishes the cache. Scheduler rendering
does not republish its earlier inventory after unrelated dependencies settle.
Lighting retains its own render owner, so obsolete responses cannot redraw its
controls or replace the current error. Existing keyed controls retain focus and
unsaved drafts.

## RG-LIGHTS-002: Refresh erased a newer command error

An actual-source failure reproduced a read admitted before a failed command
clearing that command's error. Command/save feedback now has a separate owner.
Old replies and delayed refresh callbacks cannot replace a newer action result.
A successful device save with a failed follow-up read reports both outcomes and
retains the cached inventory. Save acknowledgments still preserve newer drafts.

## Validation and remaining scope

Fifteen new Node cases and all ten media-library ownership cases pass. Initial
fixture syntax and asynchronous-admission errors were corrected without removing
assertions. Three focused Chromium cases pass, including two new actual-page
checks for inventory order, control focus/drafts and visible command failure.
All 78 workspace cases pass in Chromium (89.403 seconds) and Firefox (116.060
seconds). The initial full Linux run reported 1,887 passes, three failures and
two root-only skips. All three failures came from the older lighting fixture
searching for the previous no-argument function signature and extracting no
source. Its extraction now includes the actual shared owner and asserts both
source boundaries; all assertions remain. All 28 focused ownership/workspace
cases pass. The final supported Linux snapshot passes 1,890 tests, zero failures
and two root-only skips (1,892 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. No runtime or browser code changed after
the two full browser runs. Required CI and checked delivery remain pending.

No MQTT, physical lighting or ESPHome commands were issued. Group 9 review of
configuration-write ordering, backend device/transport ownership and ESPHome
remains open. This batch changes controller reads/feedback, not hardware command
delivery or the existing capability and payload contracts.
