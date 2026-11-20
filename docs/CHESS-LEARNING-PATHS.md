# Private chess learning paths

The original position bank now contains 32 authored exercises covering piece
movement, opening development, king safety, special rules, tactical captures,
checking patterns, promotion and mating patterns. Every published example is
validated at module initialization using the server legal-move engine and its
lesson objective. These foundation/developing drills are not a complete advanced
curriculum, a measured rating, or a searched best-move claim. Existing six lesson
IDs, sessions and aggregate totals remain unchanged.

`training.catalogue` adds stage, difficulty and searchable metadata. The learner
panel can filter all three without sending search terms to another service.
`training.review` exposes only the caller's missed-concept review: misses become
due immediately; assisted completions after one day; consecutive independent
completions after 1/3/7/14/30 days. A suggested path and assignment-specific UTC
calendar daily exercise are optional and carry no speed, attendance or grade
reward. Earlier totals remain available; new concept evidence starts when the
new tracker observes a server-validated attempt.

Teacher sequences use UUID/revision/request-ID mutations, at most 32 unique
published lesson IDs and 50 saved sequences per assignment. Creation records a
monotonic completion baseline: earlier practice cannot silently satisfy a newly
assigned sequence. Editing preserves that original baseline and says so in the
learner notice. The order is guidance, not an enforced lock; learners can revisit
any authored drill and use hints. Disable a sequence to stop advertising it;
no practice history is deleted. Repeating the same successful request is
idempotent; uncertain saves require refresh instead of automatic replay.

The teacher report is limited to the authorized chess assignment, paginates
1–100 participants, and distinguishes missed objectives, attempts, assisted and
independent completions, and sequence completion. It is not a public leaderboard.
Names remain reported attribution. An assignment selected by the class route is
the current chess assignment; earlier assignments retain separate histories.
Concept-level class aggregates are shown only after at least five student
contributors and remain private to the teacher. No identity merging, grade
writes, room effects or enrollment expansion occurs.

All new tables reference original participant/activity identities and cascade
when that identity/activity is explicitly removed. New progress writes share the
training transaction: audit or persistence failure rolls back both the original
attempt and its new concept/completion evidence. Freeze, closed assignment,
revoked bearer, disabled identity and original assignment isolation continue to
apply. Public learner routes never expose the teacher report or authoring API.

## Interfaces

- `training.review(user, activityId, options)` → concepts, dueLessonIds,
  suggestedPath, daily and notice.
- `training.sequences(user, activityId, options)` → enabled sequences and the
  caller's own completion; teacher reads also include inactive sequences.
- `training.saveSequence(user, activityId, body, {teacher:true})`: body has exactly
  sequenceId, title, lessonIds, enabled, revision and requestId.
- `training.teacherReport(user, activityId, {teacher:true, after, limit})` →
  students, nextCursor and notice. Cursor is the prior user UUID; limit accepts
  a canonical decimal query string or integer.

`RGChessTeacherTraining(container)` has configure({key, request, writable}) and
destroy(). Its request paths are chess-relative `/training/catalogue`,
`/training/sequences`, and `/training/report`. Load its scoped CSS only in the
teacher workspace. It clears cached names, selected lessons and reports on scope
change; old asynchronous replies cannot restore them. The learner panel adds due,
daily and sequence selectors without automatically starting an attempt.

Validation: 17 focused training/progress/route tests and ten actual exported-SCO/teacher
browser checks passed locally using pinned Chromium. Browser checks use synthetic
LMS/private identities, not live Schoology. Mobile teacher authoring was visually
inspected. Production migration and live LMS acceptance remain release checks.

## Guided opening branches

`center-and-develop` accepts either e4 or d4, validates and applies the matching
prepared black reply, then resumes with the Nf3 objective. The additive
`step_index` column defaults to zero for every existing record. Intermediate
progress stores the step position and does not award a completion. A legal move
that misses the objective restores only the current step. Hint use remains
assisted across the entire attempt. The prepared reply is authored content, not
an engine-selected best move. Checkmate exercises verify check and no legal
reply; pin/skewer/opposition lessons explain a pattern without claiming a forced
win. The new positions remain foundation/developing material, not a claim of
complete grandmaster instruction.
