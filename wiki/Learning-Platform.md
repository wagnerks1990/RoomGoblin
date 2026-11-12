# RoomGoblin learning platform

The sole operator workspace is **`/learn`**. It serves directly with normal
RoomGoblin sign-in, classes, assignments, reviews, classroom controls and setup.
Retired teacher/platform, standalone discussion, companion and old launcher pages
return 404 without redirects. Old SCORM launcher exports return 410. Create new
packages through the direct API export in `/learn`.

## Assignment data

Read [Direct assignment API](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/DIRECT-ASSIGNMENT-API.md). Students open SCORM in their
LMS; the package reports progress/answers and receives classroom state and private
feedback through the assignment API. No preapproved roster, signed launch,
companion window or third-party cookie is required.

An enrollment-only package capability creates an isolated participant with its
own random private bearer. Reported names/IDs are attribution, never verified LMS
identity or authority to claim existing records. Keep assignment scope, private
grades, enabled-account checks and teacher authorization. Model requests contain
writing and the rubric, not roster/account metadata. Server jobs continue after
the browser closes. Native SCORM saves the LMS score when open or reopened;
this is not Schoology REST gradebook access.

## Network and classroom boundaries

- Public student traffic uses the dedicated loopback listener on 3030 and its
  exact learner-route allowlist. It never exposes the `/learn` operator page,
  scripts/styles/modules, login, administration, sockets, local AI, maintenance or
  room/device control. Keep administrator Access and native authentication intact;
  never route the student hostname to 3000.
- Direct API CORS is bearer-only and cookie-free. Unknown/cross-assignment routes
  fail closed; enrollment and authorization are rate/capacity bounded.
- Reports do not establish attendance. Direct participants require manual teacher
  attendance and fresh event/session-bound private-network proof for physical
  effects. The attester receives only an opaque challenge, never a token, cookie,
  password or student record. Browser policy may block proof while reports and
  grading continue. Never invent presence or replay an effect later.
- Automatic classroom identity remains a separate signed-LMS contract: Planning
  supplies timing, verified signed identity supplies enrollment and fresh direct
  network proof admits events. Reported names never substitute for that identity.
  Backend signed protocols retain their security boundaries; their retired web
  apps are not current delivery options.
- Preserve manual mode, calendar suppression, pauses and per-session binding.
  Metadata timers respect export/shutdown freezes and never dispatch hardware or
  replay old progress. Effects use teacher-approved recipes, explicit targets and
  restrained volume, with announcement priority. Native renderer effects are
  transient: no persistence or reconnect replay. Physical acceptance requires
  authorization.
- Continuing arcade campaigns retain signed identity, private grades, revision
  checks and scheduled display ownership. Explicit remote leaderboard opt-in
  changes only the arcade snapshot, never attendance or room-effect eligibility.
- Dedicated arcade boards are opt-in and reserve only their selected receiver.
  Other receivers retain announcement priority. Preserve AV mappings, saved
  schedules and device enrollment during learning cleanup.

## Fresh start and recovery

[Learning fresh start](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/LEARNING-FRESH-START.md) is a separately authorized offline
operation with a verified snapshot and rollback. Startup and ordinary upgrades
never reset learning records. The reset clears learning data, restricted learners
and old assignment/launch settings; working API/AI connections and unrelated
RoomGoblin state remain. Automatic class import stays off until configured again.

Deploy checked main and exact published images through the native updater.
Preserve SQLite identity, writer drain, export freezes, backups and rollback.
Synthetic validation does not establish real LMS policy, grading calibration or
physical classroom acceptance.
