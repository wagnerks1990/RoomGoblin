# Automation Framework

RoomGoblin automations are stored in SQLite and execute through one canonical ordered action sequence. The schedule decides **when** an automation starts; each action decides **whether it participates on each pass** through that sequence.

## Per-action dwell timing

Actions execute in canonical order. Each action's `repeatDelaySeconds` is the **stay/dwell time after that action is applied and before RoomGoblin advances to the next eligible action**. `delaySeconds` remains a pre-action wait.

For example, if Action 1 has a 3600-second dwell and Action 2 has a 60-second dwell, RoomGoblin runs Action 1, leaves it active for one hour, runs Action 2, leaves it active for one minute, then returns to Action 1 when the configured execution modes keep the sequence eligible. This applies to text, URLs, media, lighting, TV power, and other automation actions. When the class/event window ends, the sequence stops normally.

Startup/Resume TV and lighting recovery uses each action's configured first-pass
pre-delay plus every preceding dwell, including other action domains. Eligibility
uses exact seconds; it is not rounded into an earlier minute. Later eligible steps
within the same occurrence replace earlier state on the same target. The existing
minute/priority/event-ID precedence between occurrences remains unchanged. This
projection does not reconstruct adapter latency or the phase of later loop passes.

Continuous-run admission uses a separate ownership view: already-started TV and
lighting sequences reserve their complete intended scope while waiting. Ownership
follows occurrence start, priority and event ID; a later action cannot turn an older
run into a newer owner. Pending winners can restart through the normal owned runner
without applying future state during reconciliation. Stop filtering follows winner
selection so it cannot revive a superseded predecessor.

## Schema v3: scheduled automation + ordered actions

The canonical persisted model is `actionSequence[]`. There is no runtime distinction between a primary action and later actions. Every action has the same fields:

- `id`
- `action`
- `targets`
- `useEventTargets`
- `payload`
- `delaySeconds`
- `executionMode` (`once`, `repeat`, or `loop`)
- `repeatCount`
- `repeatDelaySeconds`
- `continueOnError`

Legacy `action`, `targets`, `payload`, and `actions[]` fields remain compatibility mirrors for old saved data and database projections. The runtime must execute `actionSequence[]`, not those mirrors.

## Sequence-pass execution

The runner proceeds Action 1 → Action 2 → Action 3 → … . It starts another pass only when at least two actions remain eligible, or when an explicit finite **Loop X times** action still has passes remaining. If only one **Loop continually** action remains, sequence processing stops and leaves that action's current state in place.

- **Run once**: execute on pass 1, then skip on later passes.
- **Loop X times**: execute on passes 1 through X, then skip.
- **Loop continually**: participate on every pass while the ordered sequence still has at least two continual actions eligible. If it becomes the only eligible action, it is not reissued.

Each action keeps its own delay, targets, payload, and error policy. A failed action with `continueOnError=true` does not block the remaining eligible actions on that pass. With `continueOnError=false`, the sequence stops.

A continuing continuous sequence starts no more than one complete pass per second.
Action execution and configured waits count toward this floor; slower passes add
no further timed delay but still yield to ordinary timers. Finished runs,
finite-only repeats and a single remaining continual action receive no extra
cycle wait. Delays use a monotonic clock, so clock corrections do not shorten or
extend them. Cancellation, pause and class boundaries are checked at intervals
of at most 500 ms during waits; calendar eligibility still uses the scheduler clock.

## Scheduling and supersession

The scheduler test clock's live permission is checked again before each new
display/TV/lighting dispatch within an automation action, before timer overlays,
and during desired-state reconciliation. Returning to dry mode or expiring the
permission stops subsequent commands; an already accepted adapter operation may
finish. Explicit manual Run Now/draft actions and manual overlays remain available.
Legacy per-output TV schedules recheck permission before claiming the next write,
while persisting the result of previously accepted work.

Dry reconciliation returns a skipped result and does not begin announcement,
display, resource or Background Music restoration through that reconciliation
call. Other independent schedulers and manual-media release operations have their
own policies. A scheduler pause/resume preference is saved before its runtime flag
changes, so a failed save preserves the previous flag.

Scheduled occurrences are durably claimed before execution. When a newer scheduled occurrence starts and uses a resource already owned by an older running continuous sequence, RoomGoblin requests cancellation of the older overlapping occurrence before starting the newer one. This prevents two scheduled loops from continuously fighting for the same display, TV, or lighting target.

Conflict checks and run replacement resolve resources from dispatch intent:
empty primary targets use the action's normal defaults, lighting groups resolve
to device members, and individual TV power follows its configured connection and
legacy output override. All-TV broadcasts reserve all eight physical outputs on
both transports; HDMI-only/HDBT-only broadcasts reserve their selected transport,
independently of receiver aliases. Announcement deferral does not narrow the
saved action's intended resource set. Class-default display targets remain
separate from lighting and TV-power resources. Unknown lighting targets keep a
diagnostic identity and still fail through normal dispatch validation.

Scheduled, recovered and managed manual replacements register their own task
immediately, then wait inside that ownership for older overlapping tasks to
settle. Already accepted adapter work can finish, but cannot complete after the
replacement starts sending. Discovery and unrelated resources remain available.
A still-newer replacement can cancel a waiting one; execution rechecks lifecycle
and cancellation before class-window decisions or timer overlays. Failure of an
older task does not fail its replacement. A hung predecessor keeps overlapping
work waiting, with the existing lifecycle failure deadline unchanged.

Editing, disabling, or deleting a running automation also invalidates its revision/configuration and causes the runner to stop at the next cancellation-aware checkpoint.

Linked-class continuous automations stop cleanly when the resolved class occurrence ends. Startup reconciliation and operator Resume also recover continuous occurrences that are still currently applicable, even when their original start time is outside the normal scheduler catch-up window.

Full Recovery can defer the initial startup reconciliation. The Hub retains one
pending pass and retries it on the existing 15-second scheduler timer after thaw.
It selects the winners for that later moment, without replaying stale or cancelled
occurrences. An admitted startup pass owns the ordinary writer drain and excludes
overlapping scheduler ticks; freeze acknowledgment waits for that accepted work.

## Manual execution

Editor draft simulation never dispatches devices. The scheduler test clock is
also dry by default; its separate live-command option grants a bounded window.
Scheduled sequences recheck that permission before actions, during waits and
before starting a new timer overlay. Expiry or a switch back to dry mode stops
the sequence with a recorded dry-run error. An already accepted action may finish;
its physical effects are not undone. Explicit manual Run Now and live draft tests
remain available independently of this scheduled-run permission.

A live draft test with continual actions starts a managed background run and returns its run ID without holding the HTTP request open. Use **Stop Run** to cancel an active run. Saved **Run Now** uses the same managed lifecycle; finite manual sequences return their completed result.

## Media-aware editing

The controller shows only settings that apply to the selected uploaded content:

- images: fit/preview;
- video: fit, clip start/end, volume, mute, playback rate, preview;
- PDF/presentation/document: fit, page/slide interval, preview.

Media `payload.loop` follows the action execution mode. A media action set to `loop` remains eligible on every sequence pass; the receiver may keep that media playing between later actions until another display action replaces it.

## Scheduled workspace

Saved scheduled automations are presented through selectors ordered by resolved run time. Class-linked entries sort by their earliest resolved occurrence. The editor selector uses the same order so operators can move between automations without a long card list.

## Linked classes and target domains

Class-default display targets remain a display-domain policy. They do not become lighting or TV identifiers. Each action resolves its own resource domain and may either share compatible Action 1 targets or specify explicit targets.

## Timer overlays

Timer Overlay is initialized after the first sequence pass rather than after the entire automation finishes. This allows overlays to coexist with continuous sequences. The overlay itself is not replayed on every pass.

Standalone `display.timer.class-end` remains a normal action and follows its configured per-pass execution policy.

## Morning Announcements and Background Music

Morning Announcements remain the highest-priority display/audio owner. Priority is checked before each display delivery. Locked display work is deferred while non-display actions may continue. When announcements end, RoomGoblin reconciles the current winning scheduled display state rather than restoring stale snapshots.

Background Music remains paused until display reconciliation succeeds.

## Migration

Legacy automations are interpreted as Action 1 plus legacy additional actions and normalized into schema v3. Migration is idempotent. Existing IDs, targets, class bindings, schedule fields, and payloads are preserved.

The retired browser `automation-hotfix.js` is no longer loaded; its required behavior is part of the main controller and backend.

## Regression requirements

Changes to automation/scheduler behavior must prove:

1. scheduled runs preserve school-calendar/cycle enforcement;
2. Action 1 and every later action share the same execution semantics;
3. once/repeat/continuous eligibility is correct on every sequence pass;
4. finite sequences terminate when no action remains eligible, and continual sequences stop cycling when only one continual action remains;
5. continuous sequences are cancellation-aware and rate-limited;
6. newer overlapping scheduled occurrences supersede older loops;
7. class-linked continuous runs stop at the class boundary;
8. timer overlays initialize during continuous sequences;
9. content-specific media controls remain correct;
10. Morning Announcements priority and post-announcement reconciliation remain intact;
11. Background Music priority recovery remains intact;
12. SQLite remains authoritative;
13. legacy saved automations remain migratable without duplicate actions.

### Timer Overlay coverage across action sequences

Timer Overlay is event-level. Its `coverage` setting defaults to `all-display-actions`, which means RoomGoblin reasserts the same countdown after every display-content action (text, URL, media, image/document, or clear) so replacing the base display content does not remove the timer. `action-1-only` preserves the one-time overlay behavior. Reasserting a manual-duration timer must keep the original deadline rather than restarting its duration; class-end timers continue to resolve against the same class-end deadline. Morning Announcements priority still wins.


## Manual Run Now isolation on Resume

`Run Now` and live draft tests may start managed continuous automation loops. `Resume Scheduled State` is an explicit return-to-scheduler boundary: it cancels every active manual continuous run, waits for those tasks to observe cancellation and exit, and only then reasserts current scheduled winners and recovers applicable scheduled continuous occurrences. A manual test that is not currently scheduled must never repaint displays after Resume completes.


Starting another manual automation on overlapping resources also replaces any active managed manual continuous run before the new one-shot action executes. This applies to both saved **Run Now** and live draft runs, so an older manual loop cannot wake later and overwrite the newer manual test.


## Continuous recovery winner filtering

Recovery does not treat every earlier continuous automation as active for the rest of the day. Before restarting a continuous occurrence, RoomGoblin compares it with the current display/non-display winners and only restarts occurrences that still own at least one current winning resource identity. This prevents an older or superseded event from waking after Resume Scheduled State and repainting current content.

## Save & Enable conflict checks

Simulation and saving use the same conflict policy. Editing an already-enabled automation preserves exact existing overlaps (same other automation, date, time, and resource set). The editor reports those overlaps as warnings with the other automation's name, date, time, and shared targets. New normal-day overlaps still block saving; newly created or previously disabled automations must pass the normal-day check before enabling. The saved server record supplies the baseline, never a browser-provided baseline.

Checks include the next 90 days. Half-day, one-hour-delay, and two-hour-delay overlaps are separate, non-blocking warnings for every automation: new, edited, or being enabled. Special days use their own timetable and never prevent saving the normal schedule. Normal-day validation is scanned separately so a long list of special-day warnings cannot hide a normal-day conflict. No-school and remote days are suppressed. Warnings do not reschedule events or alter runtime priority.

## Reusable special-day timetables

Named date-assigned timetables move existing class-linked occurrences and timer
deadlines without copying automations. Omitted classes do not run. Fixed-clock
automations keep their times. See [Special-day schedules](SPECIAL-DAY-SCHEDULES.md)
for setup, split lunches, priority, validation and rollback.

## Planning timetable segments (Unreleased)

When Planning is enabled, one logical class may resolve multiple teaching segments
on a date. Class-linked start/end offsets, occurrence recovery, active/next class
and timer deadlines use each segment independently. Lunch gaps are inactive; no
extra class or automation copies are created. Fixed-clock actions keep their times.
Saved date previews use the same segment resolver. See [Planning](PLANNING.md).

## Planning and visual layers

See [Planning and Scene Studio](PLANNING-STUDIO.md) for temporary date windows,
timetable-block occurrence resolution, explicit clock deadlines and shared visual
layers. These fields extend existing event metadata without replacing canonical
`actionSequence[]`, native media sessions or occurrence identity. Scene payloads
are bounded data, not HTML/CSS execution.


## Run ownership and persistence failures

Scheduled, recovered and managed manual runs register their task and metadata
before execution begins. Admission must persist before dispatch. Final ledger or
configuration-save failures are reported, and task/cancellation metadata is always
released after settlement. Accepted work stays inside the Full Recovery/shutdown
drain until its execution, persistence and error reporting finish. A failed new
manual admission save does not cancel an existing accepted run. Durable claims, current
winner recovery and shutdown interruption semantics remain unchanged.

Cancellation saves the complete selected set in one SQLite preference write before
changing any run's in-memory cancellation flag. A failed save leaves all selected
runs unchanged; cancellation does not undo hardware actions already accepted.
Operator Stop, replacement, manual-run resume and manual-media cancellation share
this boundary. The history remains bounded to 500 records. A cancellation batch
larger than that capacity fails before changing execution, rather than silently
dropping its own new markers.

Continuous recovery excludes an occurrence with a saved `cancel-requested` or
`cancelled` marker, even if a later diagnostic row says `running` or `interrupted`.
This covers a restart between saving Stop and reaching the next cancellation
checkpoint. Shutdown interruption without a cancellation remains recoverable.
The surrounding manual-media takeover has separate priority/pause state; this
atomicity guarantee covers its run cancellation selection only.

Scheduled Stop identities are saved independently of the 500 diagnostic rows in
the same atomic preference write. Retention follows real local dates: yesterday,
today and future dated occurrences remain protected; older identities are cleaned
on a subsequent write. Test-clock changes cannot age them out. The protected set
is bounded to 5,000 identities and one MiB of UTF-8 JSON. A full budget or invalid
protected state rejects new ledger writes and recovery before acknowledging a
Stop or restarting a run. Duplicate markers consume no extra capacity. Manual
run IDs remain ordinary history. Existing history migrates on the next successful
write; public history responses are unchanged. Source rollback to an older runtime
restores that runtime's earlier history-only retention behavior.

## Display recovery timing

Display reconciliation uses the scheduler clock and only the currently due
prefix of the configured first pass, including pre-action delays and dwell in
all action domains. Future content or timers cannot take a target or clear its
current content. Due composed actions retain their order and class/inherited
target rules. Timer recovery preserves an owned deadline before clearing and
retains the original scheduled-deadline fallback. A resync with no due output
sends nothing and does not mark the occurrence executed.

Continuous-run recovery uses the full current occurrence's intended targets,
including pending actions, so the normal runner can recover a delayed owner.
Stopped winners do not cause an older owner to restart. This first-pass state
projection does not reconstruct later loop phases or adapter execution latency.
Existing announcement priority and dry/live test-clock guards remain in force.
