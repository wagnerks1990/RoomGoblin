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
- A classroom session requires explicit teacher attendance and current network
  presence. Off-campus events update stored progress but never the active room
  board or an effect queue. Delayed events do not become effects on reconnection.
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
  effects are recorded without replay. Live sessions end on restart.
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
7. Start one timed classroom session, select students physically present, and
   save attendance. Enable only reviewed recipes with explicit targets. At home,
   students keep saving normally and their events do not affect the room board.
   Stop effects at the end of class. Starting another class ends the prior room
   session; restart, expiry, removal or disabled access revoke effect admission.

Display celebrations use the existing renderer and restore its prior scene after
eight seconds. They are not written to persistent display state or sent through
MQTT/legacy transports, so reconnect cannot replay them. Existing video, web and
PDF media and announcement priority block these interruptions. A disconnected
receiver produces an unconfirmed outcome, not a successful-delivery claim.
Static light color changes remain until another authorized light command changes
them. Dispatch is at most once per 15 seconds, never queued for later replay.
The first enabled recipe for the event is used; disable earlier alternatives.

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

## Validation

Run `npm run check`, the `test/learning*.test.js` suite, and
`node test/browser/learning-platform-smoke.cjs`. The existing discussion and LTI
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
