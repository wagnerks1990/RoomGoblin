# Find a starting point

The optional four-position check helps a learner choose initial practice. It uses
the existing original pawn-step, escape-check, knight-fork and mate-in-one lesson
goals through the frozen server-only curriculum accessor. It does not estimate a
rating, diagnose ability, assign a grade or promise mastery.

Each legal answer advances once. An illegal move is rejected. Learners may reveal
up to three hints or skip; a hinted correct answer stays assisted, and a skipped
position stays unanswered. These distinctions remain in the saved summary. The
interface explains this behavior before starting, so a wrong legal answer is not
silently retried as though it were an independent correct answer.

The final suggestion offers piece movement when the pawn objective was not
completed independently, king safety when the king escape was not completed
independently, and optional tactical practice after those two independent answers.
It explains the observed basis, shows all four outcomes and lets the learner
choose an easier path. Selecting a path does not automatically submit lessons.

There is one durable current check per participant and original assignment, with
a run UUID, exact revisions, request fingerprints, server-validated moves and an
atomic audit. Starting an active check resumes it rather than resetting answers.
Starting over after completion requires the displayed current revision. The last
ten timestamped own summaries are retained; they are private practice records.
No competitive match, grade, validated-move count, original drill attempt, drill
completion, or adaptive-strength record is written. Shared request budgets remain
bounded. Fresh authorization, direct-bearer revocation, pause/close, writer-freeze,
and cascade-deletion rules remain enforced.

`ChessPlacement.get/start/attempt/hint/skip` serve `/placement`,
`/placement/start`, and `/placement/:id/attempt|hint|skip`. Responses contain
`{placement,notice}`. `RGChessPlacement` uses the same scoped request/configuration
contract as the other teaching panels and invalidates stale responses when the
assignment changes. Its optional `onPractice(lessonIds)` callback follows an
explicit user choice. The parent page owns navigation and SCORM reporting.
