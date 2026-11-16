# Discussion readiness, drafts and assessment recovery

Direct SCORM discussions previously accepted typing before connection and
instruction loading completed. Students could reach a disabled submit button
with unsaved writing, and refreshing could discard text when the LMS save failed
or the writing exceeded its draft payload budget.

Response/reply editors now start read only. A shared readiness function updates
the editor and submit button after connection, instruction retries, pause/resume
and submission completion. Partial instruction rendering is not marked complete.
Control/polling events cannot unlock a pending form. A delayed initial LMS
identity can establish the first connection; a later identity switch still
retires the old learner view.

Each input immediately updates a tab-local sessionStorage backup scoped to the
assignment and reported LMS learner. Native LMS commits remain debounced. The
backup excludes participant credentials and restores the full text on refresh
when available, including drafts exceeding the 3,900-byte LMS payload budget.
Confirmed append-only submissions clear their submitted text; unconfirmed
requests retain it and no longer advise refreshing. Storage restrictions, tab
closure and content-origin changes can prevent recovery. This is not server-side
draft saving and cannot recover writing already lost in an older package.

Rubric quote validation accepts only straight/curly quotation-mark variants in
otherwise verbatim evidence. Words, case, spaces, negation and source IDs remain
exact. Malformed rubric evidence gets one fresh attempt for that criterion,
within existing per-review and daily request budgets. The response must pass the
same validator; no support flags or scores are silently repaired. Provider and
budget failures do not trigger this extra evidence-repair call. Persistent
failure retains saved writing without publishing a partial automatic result.

Unavailable reviews record bounded diagnostic categories without exception text,
model output or student writing. Earlier unavailable records do not acquire a
retrospective explanation. Teacher corrections, relevance gating, one automatic
comment per main post, native score reporting and authorization remain intact.

## Automatic preview and saved learner review

Browse/review launches without a saved participant credential automatically load
public instructions and the visible shared thread without sign-in. The narrow
GET preview endpoint validates the assignment capability, excludes hidden
branches/private assessments and creates no participant, grading job or LMS
write. Page-local practice never posts to the real discussion. A returning
learner with a saved credential keeps read-only access to their own feedback.
The existing private teacher workspace remains the route for grade correction
and moderation; runtime mode does not grant teacher authorization.

## Qualification and release limits

Earlier actual-provider calibration under-credited a complete answer and
misclassified a relevant incorrect attempt. The revised path binds named checks
to server-provided verbatim spans, independently confirms mixed positive
support, and classifies message kind separately from technical correctness.
The configured local provider passed six controlled lesson cases with exact
criterion/relevance expectations: complete, initial-only, partial, incorrect,
agreement-only and injection. This is sample calibration, not a guarantee for
all writing or providers. A separately worded public synthetic rubric passed
five of six cases; its partial answer scored 7 instead of the expected 10.
The case remains a failed calibration, even though the review hold prevents
its publication. Keep teacher review available and qualify the actual
rubric/model before release. Mixed-support criteria, including independently confirmed partial evidence,
now keep the whole assessment in needs_review. Eligible coaching still posts
once; no new final grade or LMS receipt is published until teacher approval.
Clear full/zero-support assessments retain the configured automatic path.
This guard is not a guarantee that every remaining model decision is correct.
Existing scores and provider/publication settings
are not changed or replayed. Call use increased in some paths; class-size budget
and provider capacity must be checked before rollout.

The shared preview is automatic and requires no extra login. Private teacher
authentication inside an LMS package is not included; browse/review mode does
not authorize private teacher data. The rejected manual-approval prototype is
not part of this change.

Existing uploaded packages are immutable client artifacts: a server deployment
cannot rewrite them. Before any authorized rollout, take a verified normal
backup and retain the prior image/package. Server changes require no new schema
or data reset. Roll back code/image if needed; preserve learning records.
Client fixes require an updated package and a verified LMS continuation route.
Do not delete/recreate a graded material or assume matching SCO identifiers alone
preserve attempts and private resume credentials. Live LMS acceptance remains
unverified.

## Validation

- Supported active-worktree Linux runner: application checks and Node tests.
- `node --test test/learning-rubric-checks.test.js`
- `node test/browser/learning-composer-readiness-smoke.cjs`
- `node test/browser/learning-preview-smoke.cjs`
- `node test/browser/learning-direct-smoke.cjs`
- `node test/browser/learning-cumulative-discussion-smoke.cjs`

Browser fixtures use synthetic records and synthetic grading. They do not write
classroom data or establish production-model or Schoology gradebook acceptance.

See LEARNING-CRYPTO-DISCUSSION.md and tools/learning-calibration.cjs for
reproducible synthetic-only provider calibration. The reports omit writing and
private references. No automatic regrading or student-record migration occurs.
