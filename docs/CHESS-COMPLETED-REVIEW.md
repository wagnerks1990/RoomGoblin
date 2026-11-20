# Private completed-game review

`ChessReview` reads finished games only. A learner must own the exact original
assignment seat with a fresh enabled identity; a direct participant must retain
the original private bearer scope and availability. Teachers must belong to the
game's original class. An authorized teacher's selected SCORM assignment permits
review of older assignments in that same class, not games from arbitrary classes.
Global teacher spectating alone grants no review access. Names use the existing
first-name/last-initial projection. No live multiplayer engine advice is exposed.

History uses a bounded keyset cursor (maximum 50 games), mode/result filters and
search of reason/difficulty only. Search never reads another class's private
aliases. Replay returns up to 100 positions per page and validates the saved UCI
history against server legal moves before producing SAN. PGN contains escaped
public names, server-produced SAN and the recorded result. Cancelled games use
the unfinished PGN result marker rather than inventing a winner.

Replay and PGN currently support at most 2,000 plies per game. Larger saved games
remain untouched and receive an explicit unsupported-review message. Eight
validated timelines are cached; each actor may compute twelve uncached timelines
per minute. A review request cannot submit a custom FEN or fabricate history.

Position analysis performs at most two native Stockfish searches, each bounded
to 350 ms and 75,000 nodes, with the existing five-second process deadline and
shared two-search admission limit used by ordinary computer games. Engine skill
is 20 for analysis; no engine result is substituted when unavailable. Each actor
may request six analyses per minute. Search stays outside database transactions.
Authorization, saved revision and history are rechecked after waiting. Shutdown
cancels processes; ordinary drain only waits. Analysis does not write match,
grade, leaderboard, adaptive profile or training progress records.

The returned `before` evaluation is from the mover's perspective and `after`
from the opponent's perspective. Centipawn loss is their sum clamped to zero,
and is omitted when mate or terminal scores cannot be compared numerically.
Depth is the latest exact completed evaluation matching the final engine move;
an interrupted newer search iteration is not misrepresented as completed.
These bounded estimates are not ratings or proof of a tactical mistake.
Verified board facts identify check, checkmate, stalemate, special moves, a
legally capturable moved piece and certain fork patterns. A capture threat does
not prove a piece is undefended; a fork does not guarantee winning material.

Historical retry returns a fixed server-confirmed position. Its attempt method
checks an alternative move against the same position and returns the resulting
board, SAN and terminal facts. It never rewrites the completed game and does not
claim every legal alternative is good. This is an isolated one-move practice
foundation, not a new competitive game or a persistent branched analysis tree.

Focused tests cover owner/class authorization, old assignments, disabled users,
query bounds, cursor pagination, PGN and special SAN, isolated alternatives,
engine prefixes, authorization changes during search, terminal evaluation,
shared admission and missing/bound-only native output. The opt-in native test
also exercises real Stockfish analysis in the shipped adapter.

## Saved whole-game evidence

`ChessReviewInsights` stores engine evidence per finished match and ply, keyed by
an exact history hash and the pinned engine/settings version. Private scope is
checked on every read and again after every asynchronous search before saving.
One explicit request analyzes at most three missing positions; partial progress
survives rate limits, reconnects and failures. No background analysis runs on
startup, and live game search shares the existing two-process admission bound.
A read never starts analysis. Deleting the underlying match cascades evidence.

The UI exposes the number of analyzed positions, remaining work, a White-oriented
centipawn graph with accessible text values, and up to three notable reviewed
moments. Missing points are not interpolated as analyzed evidence. Mate scores
remain separate. Rule-based practice suggestions explain the specific observed
pattern and select an original lesson only after an explicit click; they do not
claim a diagnosis, a human rating or guaranteed improvement. Original game rows,
results and SCORM scores remain unchanged.

## Recurring private practice suggestions

Review evidence version `review-v2` includes structured, server-derived tactical
observations. The private adaptive profile examines at most 64 finished games and
512 saved analyzed positions in the same original assignment. It counts only the
participant's played side (including Black computer practice); solo observations
cover both sides and are counted separately. Teachers do not inherit students'
review patterns through their own profile.

At least three matching observations are required for a suggestion. Eligible
observations combine a centipawn evaluation drop of at least 80 with a legal
capture of the moved piece, an engine candidate's fork pattern absent from the
played move, or an increase in attacked squares neighboring the mover's king.
These are practice prompts, not proof of an undefended piece, forced material win,
causation, diagnosis or rating. Mate evaluations are not converted into numeric
losses. Engine version and full-history fingerprints must match; malformed,
stale and opponent evidence is ignored. No new engine searches occur on profile
reads, no public weakness is exposed, and these suggestions do not change strength
or grades. Missing analysis can leave patterns undiscovered.
