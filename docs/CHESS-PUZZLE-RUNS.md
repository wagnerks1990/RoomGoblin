# Daily puzzle challenges and personal survival

These optional activities use RoomGoblin's original, fixed-position curriculum.
They are classroom practice objectives, not rated puzzles, engine-verified best
moves, or a claim of chess mastery. Multi-step lessons are deliberately excluded
from the single-move run catalogue. No external puzzle database or asset is used.
Practice scores never write grades, SCORM validated moves, competitive games,
training progress, adaptive strength evidence, or the global game leaderboard.

The class teacher can publish one immutable daily challenge for the server's UTC
date, selecting one to ten original objectives and either no timer or 60, 180 or
300 seconds. The UI explicitly labels UTC. Every entrant receives one scored
attempt for that challenge through their existing private assignment identity;
starting again resumes or displays that original attempt, without resetting time
or points. Personal untimed survival remains available separately, including after
an expired, stopped, or completed daily attempt. Survival uses a bounded sequence
of eighteen original single-position objectives and ends on its first legal wrong
answer or completion. Illegal moves are rejected without advancing the run.

The server owns the start time, deadline, sequence snapshot, objective, legal-move
validation, points, mistakes and assistance state. Time continues while a browser
is away, disconnected, the assignment is paused, or the application is saving.
It never changes a competitive result or grade. A request arriving at or after
the deadline cannot gain a point or reveal another hint. Read-only requests may
project an expired run without writing an expiration record. No browser clock,
score, success flag, position, deadline or assistance flag is accepted.

Hints are revealed through a bounded ladder and mark the entire run as assisted,
including later objectives. The class-only daily view separates attempts without
hints from assisted practice, labels mistakes and final status, and keeps equal
scores/mistakes tied with deterministic ordering. It uses existing privacy-safe
nicknames and opaque run keys, never raw participant identifiers or private
assignment records. It is not exposed on the public global chess leaderboard.
Class membership, original direct-participant activity, revocation, enabled user,
teacher role and assignment writability are checked afresh for relevant actions.

Daily objectives are copied to a private server snapshot when published; the
saved run copies that snapshot. A curriculum wording update cannot change an
already-started run's answer or objective. Only the current objective, position,
legal moves and already-requested hints are projected; stored examples and hidden
hints are not sent. A standard solution uses the authored legal move, except the
back-rank mate objective verifies actual check with no legal reply.

## Persistence and UI

`ChessPuzzleRuns` provides `catalogue`, `createDaily`, `start`, `attempt`, `hint`
and `stop`. Mutations use request UUID fingerprints and revisions, with atomic
audit/transaction rollback. Starting a resumed run is also remembered so retrying
that request after a later stop cannot create a new run. There are at most twenty
new runs per participant/assignment/UTC day and 128 ordinary actions per run;
stopping remains available as a final recovery action. User/activity/class
deletion cascades through the private run data. No background timer or startup
scan is introduced.

`RGChessPuzzleRuns(root)` exposes `configure({key,request,writable,teacher})`,
`load()` and `destroy()`. The browser countdown is a display estimate from the
last server time and a monotonic elapsed timer; only the server awards points.
It stops board interaction when that estimate expires and asks for refresh.
Context changes invalidate pending responses, text is inserted through text nodes,
and failed writes require refresh rather than automatic replay. Scoped CSS ensures
finished/expired boards remain hidden despite the shared board's grid styles.

Validation includes all authored survival examples, idempotent retries, stale
revisions, deadline races, assistance, immutable daily publication, direct identity
revocation, audit rollback, deletion, and real board clicks. A separate synthetic
browser check exercises the actual teacher page, exported SCORM package and
isolated student gateway: teacher publication, student hint/move/expiry, unchanged
SCORM score, and denied teacher paths. This is local Schoology-style launch testing;
actual Schoology deployment acceptance remains a separate release check.
