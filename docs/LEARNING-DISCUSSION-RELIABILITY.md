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

## Qualification and release limits

Actual-provider calibration still under-credits a complete synthetic answer and
can classify a relevant incorrect answer as unrelated. These changes improve
failure handling; they do not establish reliable grading or relevance accuracy.
Keep this work in draft review until the remaining qualification is addressed.
Existing scores and provider/publication settings are not changed or replayed.

Automatic teacher/non-student views and teacher authentication inside an LMS
package are not included. Browse/review mode does not grant access to private
teacher data. The separate manual-approval prototype is not part of this change.

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
- `node test/browser/learning-direct-smoke.cjs`
- `node test/browser/learning-cumulative-discussion-smoke.cjs`

Browser fixtures use synthetic records and synthetic grading. They do not write
classroom data or establish production-model or Schoology gradebook acceptance.
