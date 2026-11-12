# Direct RoomGoblin assignment API

The API reports assignment activity, returns classroom interaction state, and
accepts writing for server-side AI feedback and grading. It does not use the
Schoology REST API. New direct packages need no preapproved learner roster,
signed External Tool launch, companion window, third-party cookie or teacher
browser left open. Existing signed packages remain compatible.

## Teacher workflow

Open Teacher portal → Assignments and expand an assignment. Download its direct
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
| `PUT /activities/:id/posts/:postId` | Own post revision; existing conflict checks |
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
Tables and settings are additive. Retain old signed packages and records for
rollback. Disable direct access or withdraw packages requiring this transport
before reverting beyond this API; never reset the database or publish credentials.
