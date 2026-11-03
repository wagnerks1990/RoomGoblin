# SCORM activity platform

Available in the alpha.86 release candidate. Publication and physical/LMS
acceptance are separate deployment steps; local validation is not live acceptance.

Schoology remains the assignment experience and gradebook. A reusable SCORM
connector records authenticated activity events and resume data in RoomGoblin.
Game-reported points are labeled as such; they are not proof of mastery or a
replacement for a reviewed writing grade. Existing discussion posts, grading,
teacher overrides, and signed launches retain their compatibility identifiers.

## Boundaries

- A separate student hostname terminates through the managed Cloudflare tunnel
  at the dedicated **loopback-only port 3030** listener. Its exact route allowlist
  excludes administration, account login, device control, WebSockets and local AI.
  The existing administrator hostname and Access application remain protected.
- An authenticated signed Schoology launch supplies student identity. SCORM
  names and IDs never authorize enrollment or access. The student listener
  accepts only restricted learning sessions, never a native administrator cookie.
- The SCO and a first-party companion window exchange messages using checked
  window identity, exact origins, a random channel nonce and an activity ID.
  No API key, password or shared LTI secret belongs in an upload package.
- Manual classroom sessions require explicit teacher attendance and current
  network presence. Opt-in automatic sessions follow the native RoomGoblin
  timetable and admit only signed LMS learners with fresh local presence.
  Off-campus events update stored progress but never the active room board or
  an effect queue. Delayed events do not become effects on reconnection.
- The private-subnet presence window receives only a short-lived challenge.
  It does not receive a password, session cookie or student record. Only a direct
  request from an administrator-confirmed classroom network can attest it;
  forwarded requests are rejected. Challenges bind one authenticated session,
  student, activity and event, expire in seconds, and are consumed once.
- Physical effects use teacher-approved recipes, explicit configured receivers
  and lights, existing media, restrained volume and non-looping clips. Students
  and AI cannot submit hardware commands, target addresses, scripts or media URLs.
- First names come from the signed LMS given-name field. Missing names display
  “Student”; full-name aliases are not used as a leaderboard fallback.
- Automatic effects preserve announcement priority, freeze/shutdown admission,
  bounded dispatch, and existing display/media ownership. Interrupted or uncertain
  effects are recorded without replay. Live sessions end on restart. Automatic
  mode may start a fresh current-period session with no inherited attendance
  or presence proofs; it never replays historical progress or effects.
- AI insights receive aggregate progress, without names, resumes or roster data.
  Suggestions are teacher-facing; they do not autonomously publish content,
  alter grades or operate devices. Writing-grade qualification remains separate.

## AI tool shortcuts

The teacher progress page can open an existing AI chat service and media studio
in separate tabs. An administrator saves their HTTPS browser URLs under
**AI tool links**. Teachers can use the saved links; students and the public
student gateway cannot read or change this configuration. Blank URLs hide the
corresponding links. No hostnames are inferred or embedded in source defaults.

Tool links are stored separately in `learning.tools`. They do not change the
student HTTPS origin, signed Schoology launches, local Ollama summaries, grading,
classroom presence, or effects. RoomGoblin does not proxy these sites or forward
student records, prompts, cookies, or credentials. Each destination keeps its own
sign-in. Review generated content before importing it as approved classroom media.

The student gateway serves only its documented routes. A 404 at its root or at
`/controller/` is intentional, not a reason to repoint it at the administrative
listener or an AI service. Verify `/learn/connect/` and a real signed Schoology
launch instead. Never replace the student HTTPS origin with an AI chat URL.

Rollback: clear the tool URLs to hide the shortcuts. The additive preference can
remain stored when rolling back application code; no database reset is needed.

## Setup and daily use

1. Open the Learning teacher desk on the protected administrator site and select
   **Classroom progress and celebrations** (`/learn/platform/`). Choose a class.
2. In administrator settings enter a separate exact student HTTPS origin, the
   private HTTP origin of this RoomGoblin appliance, and the confirmed classroom
   subnet(s). Do not substitute public-IP Access bypass rules for private-subnet
   presence. Enter the actual LMS/SCORM origins after observing a real launch.
3. Save settings, then publish the student connection. Publication checks 3030,
   rejects conflicting DNS/Access coverage, and adds only this student hostname.
   It does not remove or broaden the existing administrator Access policy.
4. Create a SCORM connection with the original assignment's possible points.
   Configure a signed, **ungraded** Schoology External Tool, enable name sharing,
   and open it as the teacher to bind the course/material. Save its actual
   Schoology material URL as the connection's launch URL. Multiple connections
   in the same class can use this one identity bootstrap; each new SCO connection
   still needs a fresh signed launch. There is no passwordless identity fallback
   based on a SCORM name or an old browser cookie.
5. Bundle `public/learn/sdk/roomgoblin-scorm.js` in a configured copy of the SCO.
   Load a local configuration script defining `window.ROOMGOBLIN_SCORM` with
   `{origin, activityId}`, then the SDK, before the game's scripts. Add both files
   to the manifest. Preserve existing identifiers, scoring, resume and finish.
   Successful native SCORM score commits are mirrored; optional
   `RoomGoblinSCORM.progress(current,total)` supplies step progress. Normal LMS
   operation continues when RoomGoblin is unavailable. The SDK does not introduce
   extra LMS reads or change native method return values.
   Configuration can also declare `progressTotal` and `locationFormat` (`integer`
   or `run:step`) to mirror successful lesson-location commits. Explicit
   `captureResume: true` retains bounded suspend data; review its content before
   enabling it for another assignment. The three IPv4 packages contain game
   state and answers, not typed identity fields. Points become immutable after
   the first retained event so retry receipts remain stable.
6. Students select **Connect to RoomGoblin**; the companion authenticates through
   the existing Schoology session. Keep it open. In class they also enable the
   local presence window. Browser popup/local-network policy may require consent;
   it is not a second RoomGoblin login. Cookies and credentials never go to the
   private HTTP presence origin.
7. Under **Automatic classroom setup**, link any existing learning class to its
   matching RoomGoblin timetable entry, enable sync, and save once. Unmapped
   enabled entries import automatically. Multiple entries can share the same
   learning class without replacing assignments, signed course bindings or work.
   Students enroll when they launch the signed Schoology connection; SCORM
   supplies progress, not trusted identity or a whole-course roster.
8. Save reviewed celebration recipes with explicit targets once. Automatic
   sessions follow the timetable without daily Start, Stop or attendance clicks.
   Each new event still needs fresh classroom presence. At home, progress saves
   normally without affecting the room. If automatic mode is not configured,
   the existing timed session and explicit attendance controls remain available.

Display celebrations use the existing renderer and restore its prior scene after
eight seconds. They are not written to persistent display state or sent through
MQTT/legacy transports, so reconnect cannot replay them. Existing video, web and
PDF media and announcement priority block these interruptions. A disconnected
receiver produces an unconfirmed outcome, not a successful-delivery claim.
Static light color changes remain until another authorized light command changes
them. Dispatch is at most once per 15 seconds, never queued for later replay.
The first enabled recipe for the event is used; disable earlier alternatives.

## Automatic classes and timetable

Automatic setup is off by default. An administrator configures it once under
`/learn/platform/`; `learning.schedule` records that enabled owner. A background
15-second reconciliation imports enabled non-transition Planning classes by
stable source ID. It uses the same calendar, cycles, special days, class windows
and split-period resolution as RoomGoblin. It never sends device commands.
Only one unambiguous current period, lasting at most three hours, may open a
session. Breaks, remote days, no-school dates, invalid/missing periods and overlap
suppress effects. Event admission checks the actual end time, without waiting
for the next timer tick. Existing manual sessions are replaced when a scheduled
class begins. Turning automatic mode off ends its sessions; manual mode remains.

Imported titles follow Planning renames unless the learning title was edited.
Existing explicitly linked learning titles remain unchanged. Removing, disabling
or renaming a Planning class never deletes saved learning classes, activities,
memberships, grades or progress. A removed mapping cannot arm effects. Exact
unmapped title matches may reuse an existing class owned by the configuring
teacher; ambiguous titles create a separate class. Review mappings during setup.
Only that owner's classes are linked; other teachers are not added implicitly.
Revoking the owner's access prevents automatic session admission.

The teacher page follows the current class and refreshes progress every 15
seconds. Selecting another class or editing class content stops automatic class
switching, preserving drafts. **Pause this class today** persists across reloads
and restarts and expires on the next school day; **Resume automatic mode** can
end the pause sooner. There is no required daily enable/disable cycle. Assignment
connections that were closed remain closed until a teacher deliberately opens
them. Signed provider setup, connection packages and approved recipes remain
one-time prerequisites; sync does not invent course bindings or change grades.

Signed launches retain the existing automatic enrollment boundary. A student
appears in the current session after a fresh eligible local event, not simply
because a SCORM name is present. Stored attendance never substitutes for a new
network check. Presence proofs bind the restricted login, learner, activity,
event and classroom session; they cannot cross a pause/resume or restart.
Timetable failures suppress classroom effects while ordinary progress saves
continue. Shutdown and Full Recovery Export block reconciliation writes.

Administrator GET/PUT `/api/v1/learning/platform/schedule` reads or saves setup;
PUT accepts `{enabled, links:[{scheduleId,classId}]}`. Empty class IDs use import
or retain an existing mapping. Teacher POST `/platform/classes/:id/resume`
resumes a paused automatic class. These routes remain unavailable on the public
student gateway. The additive `learning_schedule_links`,
`learning_schedule_sessions`, `learning_schedule_pauses` and
`learning_presence_sessions` tables are included in normal database backups.
Presence bindings use a separate table so the legacy challenge row layout
remains compatible with source rollback. Disable automatic mode before a feature rollback;
retain these tables and use the normal exact-commit updater and backup.

## Rollback and retention

Disable the public listener first to deny new public access without touching
the administrator site. Stop the classroom session. Keep the additive SQLite
tables and existing records. The native exact-commit updater retains its usual
operational backup and previous-release rollback; do not downgrade/reset the DB.
`learning.publicRoute.previous` retains the prior tunnel configuration and
ownership information for a reviewed route/DNS rollback. Never delete unrelated
DNS records or Access applications. Routine tunnel reprovisioning retains the
recorded student destination at 3030.
Repeated publication preserves the original rollback snapshot and confirmed DNS
ownership. A different student hostname requires reconciling that snapshot first.

The SDK retains a bounded retry queue in this tab's session storage, bound to the
verified learner. Closing the browser before sending may lose unsent telemetry;
Schoology's successful SCORM commits remain the official assignment record.
The backend retains saved events, current progress and effect outcomes in its
normal operational backup. Current aggregate summaries are available to teachers;
Ollama suggestions are optional and requested individually, not continuous GPU
work. Keep writing auto-grading disabled until separate rubric calibration passes.

## Continuing arcade campaigns

The teacher progress page has **Continuing arcade campaigns**. Create one campaign,
select its learning classes and short period labels, and choose a verified display
receiver. Configure each existing SCORM connection above, then choose **Link selected
assignment** in the campaign. Campaign membership is derived from these teacher-owned
bindings and the signed learner identity; a package's period picker cannot enroll a
student or select another student's checkpoint. Multiple timetable entries, including
Bison meetings, can map to the same learning class using the existing schedule settings.

The SDK's `arcade(data)` saves the game's checkpoint, arcade score, level, board and
question completion. `campaign()` and `roomgoblin:ready` expose only that learner's
latest campaign. The server uses a campaign revision to reject stale concurrent tabs;
the client must reconnect before playing further. Acknowledgements are idempotent.
Checkpoints are capped at 16 KB and checked against the supported game's memory.
These are game-reported motivational scores, not tournament anti-cheat evidence.
The current adapter supports the pinned Donkey Kong engine checkpoint format;
game assets and ROMs are not shipped in RoomGoblin.

Private campaign state survives changing assignments, class meetings and restarts.
The public snapshot changes only on fresh, classroom-attested game events. Offsite
progress remains private until a later qualifying checkpoint. TV projections contain
signed first name, teacher period label, arcade score, level/board and question
completion; they exclude academic scores, answers, identities and checkpoint data.
Replaying an assessment can reduce its current completion count; official grades
still follow the original SCORM implementation.

An enabled campaign displays during an active session in any selected class, combining
previous classroom snapshots from all its classes. Eight rows rotate every 15 seconds.
Only one enabled campaign can own a receiver. Refreshes expire after eight seconds
without a new update and restore the scheduled display; they do not change persistent
display state or preempt announcements/active media. Disable the board to stop new
dispatches. No campaign automatically resets daily. Start a new campaign for a new
unit when desired; existing saved data is retained.

Use a normal database backup before deployment. The schema adds campaign, binding,
private-player and public-snapshot tables. Roll back code using the prior exact image
pair, retaining the database and additive tables; never downgrade/reset the database.
After deployment verify signed launch, cross-assignment resume, each period/Bison
schedule mapping, a real target display, and restoration when its session ends.

## Validation commands

Run `npm run check`, the `test/learning*.test.js` suite, and
`node test/browser/learning-platform-smoke.cjs`. Run the browser regressions
with `python -m unittest discover -s test/browser -p test_learning_schedule.py`;
CI covers Chromium and Firefox using synthetic local fixtures. The existing discussion and LTI
browser checks must continue to pass. On Windows run the complete active worktree
through `py -3.11 C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py`.

## Storage and access

The learning platform uses the existing encrypted-secret and SQLite identity.
New tables retain connector definitions, first-name projections, idempotent
events, current progress, classroom sessions, attendance and effect outcomes.
An event carries a UUID and increasing sequence. Retries acknowledge the original
event; reused IDs with changed data fail. Out-of-order records cannot replace
current progress. Resume data is bounded and never included in boards or AI input.

The generic connector uses `scorm-connector-v1` activities. Schoology SCORM keeps
its normal score commits; connector telemetry does not write a second grade.
Late-work policy and official grade handling remain with the assignment's existing
implementation. Do not create duplicate graded External Tool copies merely to
authenticate a SCORM connector.

Operational backups include the platform tables. Public connection settings,
classroom networks, names and credentials are runtime-only and never fixtures.
Rollback to a release without the student gateway closes its loopback destination;
never retarget the public student hostname to the full control-plane listener.

## Acceptance still required

Verify actual Schoology origins, signed launch and popup/COOP behavior; verify
remote authenticated saves without another RoomGoblin login; verify real private
subnet presence, supported browser popup policies, receiver audio/autoplay and
lighting delivery. Synthetic tests do not establish these physical or LMS results.
Keep effects disarmed until the teacher has confirmed the actual classroom targets.
