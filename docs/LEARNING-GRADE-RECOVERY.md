# Automatic SCORM grade recovery

New [direct API packages](DIRECT-ASSIGNMENT-API.md) queue AI responses/grading on
the server and retrieve private feedback without a companion window. Jobs finish
after the learner closes the assignment. Their native SCORM attempt saves the
approved score when open or reopened. The signed bridge instructions below apply
to legacy delivery, not a prerequisite for the direct data API.


SCORM owns the LMS score channel. The signed student connector carries private
progress and optional server-awarded grades; it cannot write an existing native
Schoology SCORM grade item through the separate identity External Tool.

## Written discussions

Configure the existing written activity with 20 points and its signed LMS launch
URL in Classroom progress. Download its SCORM ZIP from the teacher desk. The ZIP
uses the configured signed student HTTPS origin, or the public student origin
when using the legacy assigned-account flow. It never includes credentials.
Keep one graded SCORM item and retain existing posts, replies and reviews.

Starting the wrapper opens the signed LMS connection and existing written UI.
Approved AI or teacher receipts return to that exact SCO window, activity, origin
and nonce. Native commits retry automatically, and the discussion distinguishes
SCORM confirmation from the independent LTI outcome status. Revised approved
writing grades remain authoritative; the writing rubric and moderation rules
are unchanged.

## Single-window signed connections

An administrator can enable **Allow signed student connections inside approved
Schoology frames** in connection settings. Keep the exact Schoology course origin
and SCORM player origin in the approved list. The student gateway then permits
only those HTTPS frame ancestors; administrative routes remain unavailable.

New written SCORM downloads automatically open the signed discussion inside the
SCO. Game packages set `connectionMode: 'embedded'` and call the SDK connection
at launch. Identity is still supplied by a fresh signed LMS launch. Session and
flow cookies use Secure, HttpOnly, SameSite=None and Partitioned for this mode.
Origin, source-window, nonce, activity and learner checks remain required. No
secret or learner identifier is embedded in a package. The default companion
mode is retained for existing installations; embedded mode never falls back to
a popup silently.

Expired sessions reconnect in the same frame. An unresponsive connection frame
reloads with bounded backoff, and an online event resumes pending delivery. Written drafts survive a confirmed
401 response, are restored only for the same newly authenticated learner, and
only a write rejected with 401 is retried automatically. Uncertain network writes
are not replayed. Rejected native SCORM commits retry without repeating writing.
For leaderboard-only campaigns, enable signed updates from anywhere so private
LAN presence is unnecessary; classroom effects still require their own proof.

The LMS and browser must allow the signed launch to load inside this frame.
In a cross-site ancestor chain the LMS authentication cookie must support that
context; a SameSite=Lax-only LMS cookie is deliberately not bypassed.
Local browser fixtures verify nested origins and partitioned sessions, but are
not evidence of Schoology policy or student-device acceptance. A blocked LMS
frame must be resolved through supported LMS settings; do not weaken origin or
identity checks. Disable embedded mode and retain existing records for rollback.

## Optional dated assessment policy

Teacher PUT `/api/v1/learning/platform/activities/:id/grade-policy` accepts
`enabled`, `assignmentDate` (`YYYY-MM-DD`) and an IANA `timeZone`. The teacher UI
suggests a leading `M/D/YYYY` title date; ambiguous or invalid dates are rejected.
This is opt-in and requires configured points. A signed `assessment` event
contains percentage `raw`, answered `current` and question `total`.

The server uses receipt time in the configured school time zone: full credit on
or before the class date, half the following calendar day, zero thereafter.
Previously awarded higher scores and completion are monotonic. Initial zero and
partial answers can be recorded; opening a retry cannot erase earlier awards.
The first configuration preserves historical completed SCORM scores once.
Delayed/offline answers use the receipt date, so teachers can grant exceptions
for a documented outage rather than trusting a learner-controlled clock.

Teacher PUT `/api/v1/learning/platform/activities/:id/grade-override` accepts
`userId`, `creditDate` and a reason, or `creditDate:null` to remove an exception.
Only an enrolled student in that teacher-owned class is eligible. Exceptions
change future credit dates without erasing prior scores. Grade policies and
exceptions are unavailable through the public student gateway.

Private signed state exposes only that learner's award. Grades do not enter the
arcade projection. Client-reported assessment points are not a proctored test or
proof of mastery. Existing event deduplication and identity isolation remain.

## LMS limitations and release checks

The LMS must provide a writable normal attempt. Review/browse launches never
write zero, overwrite grades or impersonate a learner. A normal launch can
restore an authenticated saved award without repeating questions. Native LMS
commit success is distinct from visibility in the Schoology gradebook; the LMS
may publish scores only at its configured completion point. This feature does
not establish live gradebook updates after every answer or unlock completed
review attempts. Those require supported LMS attempt settings or separately
authorized server-to-LMS grade access.

Validate the exact uploaded package as a real student: normal first launch,
final-answer completion, gradebook score, reopen, higher/lower retry and an
interrupted connection. Teacher previews and synthetic browser fixtures do not
establish student behavior. Do not replace used items destructively or delete
student attempts to force a writable launch.

Deploy via the normal backed-up updater. The three `learning_grade_*` tables are
additive. Keep the previous image and all records for rollback. Disable dated
grading and withdraw packages requiring this feature before source rollback;
never downgrade or reset the database.


## Preserve grades before replacing an LMS package

Export the original gradebook to a private local backup before changing used
assignments. Keep original submissions and items. Record assignment identifiers,
possible points, student identifiers and grade values, and hash the backup. Match
students to their signed class identity; do not guess from similar display names.

The teacher-only `POST /platform/activities/:id/grade-restore` accepts a backup
`sourceDigest` (SHA-256) and up to 200 `records` containing `userId`, `earned`,
`possible`, `completed` and numeric-string `sourceAssignment`. The entire batch is
validated before writing. It only raises retained awards and completion, leaves
writing intact, bypasses late penalties only for documented prior credit, and
audit-records its source. Public students cannot access it. The teacher UI exposes
this under Automatic dated grading. Restore the Schoology gradebook independently
and verify actual values; the server award protects a later writable SCO reopen.

A discussion may reuse an existing signed identity tool in the same class. The
fresh flow is bound to that class and the requested discussion; after the signed
launch the connector opens the requested written activity in its existing frame.
This avoids creating new credentials for every assignment and does not allow
identity from another course. Reuse an active existing launch URL, never a deleted
Schoology material URL.

## Concurrent assignment connections

Previously each fresh signed launch replaced the shared browser cookie with a
new session. Opening Discussion could therefore invalidate the flow in an open
Do Now, and automatic reconnects could invalidate each other in turn. A saved
server award could coexist with a pending SCORM receipt on the learner's screen.

The same-origin connector start now retains an existing restricted learning
session ID as an unauthenticated candidate. After the fresh signed launch has
validated identity, course and membership, an unexpired session for that exact
learner is reused without changing the browser cookie or extending its lifetime.
The flow stays unsigned until that launch; account changes, revocation and expiry
cannot inherit the other learner's authorization. No token is returned to SCORM.

Regression: `node --test test/learning-concurrent-sessions.test.js` exercises
multiple activities, unsigned flows, different learners, revoked/expired sessions,
disabled accounts, original expiry, simultaneous starts and candidate cleanup.
Browser acceptance should keep Do Now and written Discussion open together,
complete the last question, submit writing, then reopen and retry. Confirm both
native Schoology scores separately; local test adapters do not establish that.

Deployment requires the normal reviewed, backed-up server release. The added
candidate table is transient and additive; rollback retains all grade awards,
writing, memberships and signed identities. Do not delete assignments or reset
the database. No package replacement is necessary for this connection fix.
