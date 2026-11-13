# Direct RoomGoblin assignment API

The API reports assignment activity, returns classroom interaction state, and
accepts writing for server-side AI feedback and grading. It does not use the
Schoology REST API. New direct packages need no preapproved learner roster,
signed External Tool launch, companion window, third-party cookie or teacher
browser left open. Old hosted learning apps have been retired. Use fresh direct API packages.

## Teacher workflow

Choose **Custom discussion** under Add an assignment in `/learn` to author a
scenario, directions, independent case, instructor response name and rubric.
The private grading reference stays server-side. Preview directions before
creation; set actual due/close times separately after creation.

Authored discussions accept new main posts and replies, rather than student
edits. Assessment uses the learner's visible contributions together, including
follow-ups to the instructor. Only their own writing is evidence; instructor and
peer words are context. Instructor follow-ups do not satisfy peer-reply credit.
New relevant evidence can improve the rubric score; extra length or unrelated
writing does not guarantee points. Existing daily grading budgets still apply.

Each main post receives at most one automatic public comment. A separate model
check compares that post with the actual scenario/directions before publication.
Unrelated or uncertain posts receive no automatic comment; a private audit event
records the skip. Replies are graded as appropriate but never receive automatic
comments. Reassessment updates the private grade, without adding another public
comment to an already handled main post. Existing historical duplicates are retained.

Discussion fields block copy, cut, paste and text drop. This is a browser
deterrent, not authorship proof or a security boundary. Teacher accommodations
and review remain necessary. Teacher corrections and old comment history remain
available; the student append-only rule applies to authored discussions.

The student package must be re-exported/replaced for changed interface behavior.
The server change replaces the old one-initial-post unique index with an ordinary
index without deleting records. Before production rollout, take the normal
application/database backup. Roll back code and its matching backup together:
older code cannot recreate that unique index after multiple main posts exist.

For a local operator test, run `node tools/discussion-preview.cjs --origin
https://YOUR-ROOMGOBLIN --definition /private/discussion.json --out /private/test`.
The loopback helper creates a separate TEST class using an explicitly entered
native teacher sign-in, exports the real assignment, signs out that temporary
session and serves a local SCORM player with synthetic learner identities.
Credentials are not persisted. Keep exported capabilities and learner resume
private. Test grades do not write to an actual LMS. An uncertain setup is not
automatically replayed; inspect the saved creation checkpoint first.

The [password-storage discussion](LEARNING-CRYPTO-DISCUSSION.md) adds an IT III
8/6/2/4 rubric, instructor-style responses and a case-scoped clipboard restriction.

Open `/learn` → Assignments and expand an assignment. Download its direct
API assignment (written discussion) or API starter (other SCORM content). Upload
the written package as SCORM in the LMS. Existing games can include the starter's
`config.js` and `roomgoblin-scorm.js` before their scripts; native LMS calls and
return values remain intact. Already uploaded older packages must be replaced
or updated to use the new transport; server deployment cannot rewrite an LMS ZIP.

Written discussions keep their existing prompts, rubrics, automatic responses and
teacher correction path. Other written assignments use **AI grading rubric**:
enter instructions, criterion descriptions and possible points totaling the
assignment points. The existing configured grading provider, model, budget and
automatic-publication setting apply. No rubric means no invented AI grade.
Teacher review is always available; AI never replaces an existing teacher review.

The isolated student API hostname still requires the ordinary one-time server
publication. Direct requests do not need the legacy approved-origin list. Native
teacher and administrator authentication remain unchanged.

## Identity, scope and privacy

Each downloaded package contains an assignment enrollment-only capability,
encrypted at rest in RoomGoblin. Package recipients can extract it; it is not an
administrator credential or proof of verified LMS identity. It authorizes creating
a new participant for this assignment, never reading another participant's grades,
answers or resume data. Each participant has a separate cryptographically random
256-bit bearer, hashed at rest. Cookies and claimed names/IDs do not authorize a
direct API request. No username/password login or pre-created account is needed.

SCORM learner IDs and names are reported attribution only, labeled accordingly.
The same reported ID with a new private token creates a separate participant; it
cannot claim an earlier private record. Technical restricted records follow the
existing SQLite backup/recovery identity. Disable direct API access, close the
assignment, remove participant access, or disable the issuing teacher to stop
admission. Native teacher/control-plane routes never enter the direct allowlist.

The standalone written package saves its participant capability in the LMS-owned
SCORM resume state, bound to the current reported LMS learner. Generic authors
can persist `RoomGoblinSCORM.credential()` in their own private attempt resume,
and restore it as `ROOMGOBLIN_SCORM.participantCredential`. The SDK also retains
same-tab retry state. It does not alter a game's native resume payload itself.
Changing LMS learners clears the direct written UI and stops stale delivery.
Losing the private capability does not grant access using only a reported ID.

Class discussions are shared with assignment participants. Rubric feedback,
reviewed scores, answer submissions and resume state remain participant-private.
Private API credentials must never be placed in URLs, analytics or logs.

## Data protocol

All paths below start `/api/v1/learning/direct`. Send JSON with
`X-RoomGoblin-Learning: 1`, `credentials: omit`, and no native session cookie.
CORS is credential-free and confined to the exact learner route allowlist;
there is no administrator-origin exemption or wildcard cookie authorization.

| Method and path | Authorization / effect |
| --- | --- |
| `POST /activities/:id/enroll` | `RoomGoblin-Assignment <enrollment key>`; body has fresh participantToken, reportedId and name; repeat registration with the same token is idempotent |
| `GET /activities/:id` | Bearer participantToken; current written prompt, shared posts and own review |
| `POST /activities/:id/posts` | Own initial response, reply or independent critique; existing background discussion grading |
| `PUT /activities/:id/posts/:postId` | Own comment edit, revision conflict checks and atomic version retention |
| `GET /activities/:id/posts/:postId/history` | Visible comment versions, newest first; optional beforeRevision cursor |
| `POST /activities/:id/submit` | Queue the current written assessment |
| `GET /activities/:id/receipt` | Own published written-discussion grade |
| `GET /platform/activities/:id/state` | Own progress, private feedback and pause/hint/stage state |
| `POST /platform/activities/:id/events` | Idempotent progress, score, completion, answer submission and checkpoints |
| `POST /platform/activities/:id/presence` | Optional fresh event-bound classroom challenge; requires existing manual attendance |

Enrollment is rate/capacity bounded. Event IDs and normalized fingerprints prevent
uncertain retries from duplicating records or effects. Unknown, cross-assignment,
teacher, class-roster and device routes are rejected. Public student publication
stays on loopback 3030 with its exact allowlist. Teacher package export is an
admitted POST mutation, not a GET that silently creates credentials.

## Classroom interaction

Pause, hint and stage arrive through API state polling. Reports alone do not
establish physical attendance. Direct participants can use manual classroom
sessions after teacher attendance selection and fresh private-network evidence.
Automatic signed-LMS attendance retains its existing separate identity boundary.

When eligible, the SDK tries a short-lived local presence fetch, sending only the
opaque event challenge to `/learn/direct-presence/attest`. No participant bearer,
password, cookie or student record goes to the LAN attester. The endpoint rejects
forwarding/public requests and signed-legacy challenges, and the student gateway
never exposes it. A proof remains bound to participant, event, session and current
network configuration, expires in seconds and is consumed once. If browser local
network policy blocks the fetch, reporting and grading continue; no popup is
opened and no physical effect is invented or replayed. Teacher-approved recipes,
explicit targets, restrained volume and announcement priority remain authoritative.

## AI jobs and LMS score saves

Generic answer submissions and their grading jobs commit together. Jobs run on
the server after the SCO or teacher page closes. They survive restart before
inference; interrupted inference is left unavailable for review. Bounded retries
handle retryable provider failures. Grading shares the existing daily limits and
concurrency budget, preserves export/shutdown writer drain, validates every
criterion score and rechecks rubric, provider, learner access and teacher review
before publication. Model requests contain answers and the teacher rubric, not
roster/account metadata; model output cannot issue classroom commands.

The written package reads private API feedback and saves an approved score through
its native SCORM API. An unchanged receipt does not repeat the score commit;
failed native saves retry while the SCO is open. Server-side feedback does not
require any browser to remain open. Updating a Schoology SCORM attempt still uses
that attempt's native API when open or reopened; this is not a Schoology REST
integration and cannot write a browser SCORM API after the SCO closes.

## Validation and rollback

Run `npm run check`, `node --test test/learning-direct.test.js`, the existing
learning API/SDK suites, `node test/browser/learning-direct-smoke.cjs`, and the
supported active-worktree Linux runner. Browser fixtures cover two distinct
origins, no popup/cookie/signature, native score saves, private resume, identity
switching and generic AI completion after the SCO closes. Synthetic tests do not
establish real Schoology policies, production-model calibration or physical effects.

Deploy through checked main and exact published images with the mandatory backup.
Tables and settings are additive; an explicitly authorized reset is separate
from ordinary deployment. See [Learning fresh start](LEARNING-FRESH-START.md). Retain the operational backup and matching source for rollback. Disable direct access or withdraw packages requiring this transport
before reverting beyond this API; never reset the database or publish credentials.

## Reusable authored definitions

Teacher API creation accepts a schema-version-1 definition for discussion or
written assignments. Public prompts and rubric load from the direct API; private
grading references remain server-side. New lesson content needs no per-lesson
backend changes. See [data-defined discussions](LEARNING-CRYPTO-DISCUSSION.md)
and examples/assignments/it3-password-storage.json for the schema, authoring client,
immutable versions, bounded grading and connected SCORM export.


## Comment editing and retained versions

Discussion packages use inline Edit for their own initial posts, replies and
independent responses. Edited comments show an Edited marker and View edit history.
The native teacher workspace retains its teacher-response editor and exposes the
same history. Students cannot edit other participants or instructor comments.
Histories are visible to assignment participants who can see the comment; hidden
comments/ancestors and cross-assignment probes remain inaccessible to students.

Edits save original and replacement text atomically with the post revision and
audit event. Conflicts retain the browser draft; unchanged saves create no version
or grading job. Scored writing changes retain existing review invalidation and
regrading behavior. History returns 50 versions per page with nextBeforeRevision;
it contains no private grades, credentials or internal account IDs.

History begins with the text available when tracking is enabled. Earlier edits
already overwritten by the old implementation cannot be reconstructed; the API
reports historyComplete and historyAvailableFrom instead of inventing content.
The additive learning_post_versions table is included in SQLite recovery backups
and follows existing comment/data retention. No normal update resets writing.

The classroom layout preserves chronological conversations without a separate
older-grading-feedback section. Edit history belongs to the individual comment.
Confirmed replies clear/close their editor; unconfirmed submissions and failed
edits retain their text. SCORM identity, native score reporting, clipboard policy,
private feedback, teacher authorization and publication controls are unchanged.
