# Data-defined SCORM discussions

Teacher-authored assignment data uses one API for creation, student work, grading
and export. New lesson content needs no per-lesson backend code or deployment.
Schema version 1 supports discussion and written assignments; it does not add a
visual authoring editor or general-purpose quiz engine.

## Author, create and export

Start with `examples/assignments/it3-password-storage.json`. Required fields:
title, kind, points, prompt, initialDirections, gradingInstructions and criteria.
Each criterion needs a unique ID, label, description, points and ascending score
levels from zero to its maximum. Criterion points must equal possible points.
Discussions also need replyDirections, alternate and the reserved reply criterion.
Optional fields include courseLabel, responseLabel, latePolicy, authored feedback
and clipboardPolicy (blocked or allowed). The private reference stays server-side.

Use `tools/create-assignment.cjs` with `--origin`, `--definition`, `--class-id`
(or explicit `--class-title`) and `--out`. Set ROOMGOBLIN_TEACHER_SESSION privately;
never include it in arguments, source or logs. Optional `--due-at` requires a real
zoned timestamp. No due date, closing time or global AI setting is invented.
The tool checks teacher access and API capability before creating anything.
Uncertain creates are not retried; inspect /learn to avoid duplicates.

Routes under /api/v1/learning:

- GET /me advertises assignmentDefinitions schema and kinds.
- POST /teacher/classes/:id/assignments accepts {definition} atomically.
- GET or PUT /teacher/activities/:id/definition are teacher-only.
- POST /teacher/activities/:id/direct-package exports the connected SCORM ZIP.
- Existing direct enrollment, posts, submit and receipt routes handle student work.

The SCO loads public instructions and rubric through the API, without a private
answer key or companion window. Definitions become immutable once writing is
saved; create a new assignment version for changes. Upload the live ZIP as SCORM
1.2 and configure matching possible points in Schoology. Reported learner identity
is attribution rather than verified pupil authentication. LMS score commits happen
while the SCO is open or reopened; server grading continues after it closes.

## Password-storage example

Should the Salt Be Secret? supplies all three designs, the independent claim and
a 20-point rubric: technical understanding 0/4/8, evidence 0/3/6, limits 0/1/2,
response 0/2/4. Initial writing alone earns at most 16. The peer response or supplied
independent critique supplies the final four. It distinguishes fast file hashing,
costly password KDFs, unique public salts, offline guessing and online protection.
No local writing establishes completion of a licensed provider module.

Response display names are assignment data. The private classroom definition can
use the instructor's name and exact late policy without hard-coding personal
information into the shared platform. Instructions disclose automatic processing;
internal roles retain provenance. Comments have no on-behalf-of suffix and make no
claim of personal teacher review.

Initial posts and scored peer/independent replies trigger assessment. Students can
reply to instructor/conversation comments; these follow-ups do not replace the
scored response, change grades or trigger unrestricted AI chat. Revising scored
writing requests another assessment within the existing daily budget.

## Grading and controls

Discussion grading assesses each criterion separately through the configured
provider using named bands and cited student sentence IDs. Up to eight bounded
model calls form one assessment; an absent reply needs no model call. The server
validates citations and bands, calculates points and constructs bounded feedback.
Invalid or uncertain output stays unavailable for teacher review. A reference is
context, never evidence of student writing. Written definitions automatically
configure the existing generic written-response grading path.

Provider enablement, daily budgets, publication settings, teacher overrides,
moderation, retry queue, export freeze and shutdown drain remain in force.
Provider failure never manufactures a passing grade. The earned-score late policy
halves points once after a configured due date, retains possible points and
supports approved member exemptions. Leave close time unset unless authorized.
Do not combine this writing grade with unrelated completion-credit policies.

With clipboardPolicy blocked, the SCO cancels copy/cut/paste events and response
fields cancel text drops and supported paste/drop beforeinput events. Typing,
saving and resume still work. This is a deterrent, not proof of authorship or a
secure exam browser. It cannot stop another device, screenshots, retyping,
extensions or browser-code changes. Provide an approved accommodation route.

## Validation and release

### Explicit evidence checks

Discussion criteria may include private `evidenceChecks` (1-8 plain-language
requirements, each at most 500 characters). The teacher editor accepts one per
line. State one observable requirement per check and include acceptable
paraphrases. The model extracts exact student quotations for each check; the
server validates source IDs and quotation substrings before assigning points.
The scenario, rubric description, private technical reference and bounded peer
context remain available as context, never as the student's evidence. Each check
can cite up to four quotations; checked criteria support up to 32 distinct source
IDs. Legacy classification criteria retain their eight-ID bound.
No supported checks earn zero, all earn full credit, and some earn intermediate
bands distributed by the number of supported checks. A two-band criterion
requires every check for credit. Invalid evidence remains for teacher review.

This avoids giving a strong answer credit for a different, missing criterion.
Checks are private, do not appear in student SCORM packages, and use the existing
per-request budget. Long-writing selection receives the checks as well as the
posted rubric. Written-response jobs do not support this option. Existing
definitions retain their previous grading path; once writing exists, create a
new assignment version to adopt checks. Do not rewrite historical submissions.

Qualify both zero and partial credit as well as full answers using the actual
configured provider. Quote validation establishes that text exists, not that a
model's interpretation is infallible. Teacher corrections remain authoritative.

A positive, quotation-validated check also establishes relevance for a main post
containing that checked source span. Earlier credited writing does not approve
unrelated new posts. Other posts still use conservative semantic relevance
triage; legacy classifications without checked quotations cannot bypass it.
This permits feedback on incomplete but demonstrably on-topic attempts without
requiring a second model to agree with its own rubric evidence.

Run npm run check, node --test test/learning-assignment-definition.test.js,
the supported active-worktree Linux runner, and, with Playwright available,
node test/browser/learning-crypto-scorm-smoke.cjs. CRYPTO_QA_OUTPUT selects a private
evidence folder; CRYPTO_CASE_PATH selects a private authored definition.
Browser fixtures cover creation/export, two origins/participants, shared posts,
private grades, peer/independent replies, instructor follow-ups, clipboard,
responsive layout, SCORM saves/resume and identity loss. They use a synthetic
model. Qualify the actual configured provider separately with synthetic correct,
incomplete, incorrect, agreement-only and injection responses.

Fixture ZIPs are LOCAL-TEST-ONLY and point to a temporary isolated service. Never
upload one to the classroom. Export a fresh live package after an explicitly
authorized deployment, then check Schoology Student View. Neither fixture tests
nor model calibration establishes real Schoology acceptance or universal accuracy.

Deploy through the reviewed native update path with a verified backup and explicit
authorization. For rollback withdraw affected packages/disable direct enrollment,
retain learning tables/submissions and restore the prior reviewed image/source.
This addition does not authorize a reset, deployment, LMS upload or grade change.
