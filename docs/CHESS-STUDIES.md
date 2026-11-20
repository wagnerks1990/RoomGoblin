# Isolated chess studies and private feedback

Teachers can author up to 100 original instructional positions per chess
assignment. A source has a title, FEN, teaching notes, collection label and explicit
sharing flag (off for new positions). Shared sources are readable only by that
assignment's authorized learners. Other teachers' unshared sources and learners'
private branches never appear in the list. Reported names remain attribution,
not authorization.

FEN validation requires exactly one king per side, nonadjacent kings, no pawns on
promotion ranks, bounded counters and material/promotion inventory, a safe king
for the side that just moved, and consistent castling/en-passant state. These
sanity checks do not prove historical reachability from the initial position.
No imported position is allowed to alter a real game. No engine is called.

Each reader owns a separate persisted branch, up to 500 plies, with private notes
and a collection label. The server checks every legal move and revision. A teacher
source update preserves the old branch; the learner must explicitly reset before
continuing. Reset retains the submitted notes. Notes saves, source publications
and branch moves require a UUID and current revision, with immediate idempotent
replay and no automatic retry after uncertain responses. Source and note changes
are transactional with their audit record and respect freeze/closed assignment
and revoked identity boundaries.

Teacher source editing can copy a private branch's position into the FEN field,
but publication still requires the explicit Save action. An explicit Follow checkbox polls a separate demonstration view every 2.5 seconds,
with at most one pending read and no hidden-page polling. It never overwrites
the private branch or unsaved notes. Teachers can make source demonstration
moves or grant one legal source move to an authorized learner for 30–900
seconds. The UI defaults to five minutes. Permission expires, can be revoked,
and is consumed atomically on a successful move. Issuer/recipient authority is
checked fresh; no other learner identity is projected to followers. Source
and control revisions prevent stale moves. Source editing clears outstanding
grants. Collection labels group sources or own notes; they are not unrestricted
collaborative documents.

Private teacher feedback is available only for finished games. Teachers resolve
the original participant seat within the authorized class, including older
assignments. Cross-class opponents cannot be selected as recipients. Learners
read only their own feedback through the original activity authorization; their
response contains no other recipient IDs. Feedback never changes a result,
move history, leaderboard, grade or attendance. The history picker is paginated.

## Integration

`ChessStudies(learning, {training, available})` provides list/get/saveStudy/branch/
feedback/saveFeedback. `RGChessStudies(container)` exposes
configure({key, request, writable, teacher}) and destroy(). Request paths are
chess-relative `/studies`, `/studies/:id`, `/studies/:id/branch`,
`/review/history` and `/studies/matches/:id/feedback`. Both teacher and SCO bundle
the study script/styles, while authorization remains entirely server-side.
The student gateway exposes only the reviewed method/path combinations.

The UI clears all cached private data on scope change, ignores late replies,
locks editing after uncertain writes until refresh, supports the shared keyboard/
drag board and promotion selector, and fits a phone viewport. Text is rendered
as text; neither notes nor collection labels become HTML or external URLs.

Validation: eight focused study/import service tests and twelve actual teacher/exported-SCO
browser checks passed locally using pinned Chromium. Tests cover legal position
bounds, branch privacy, stale/reset behavior, original assignment and revoked
bearer restrictions, feedback scope, audit rollback, unchanged games/grades,
gateway denial and mobile layout. Synthetic LMS tests do not establish live
Schoology acceptance. Production upgrade/rollback remains a release task.

## PGN mainline final-position import

Teacher imports accept at most 12 KiB of PGN in a 16 KiB total request and at
most 400 plies. SAN is matched to exactly one server-legal move, including its
check/mate suffix; move numbers and result-marker consistency are checked.
Standard tags and non-nested comments are accepted, but variations, NAGs and
annotation symbols are rejected explicitly. A custom start requires SetUp "1"
and a validated FEN. No external parser or engine is used. Only the verified
final position is saved as a study: imported tags, comments and outcome markers
do not create match history, results, grades or user identities. The UI states
this scope rather than implying a full annotated game import.

The private teacher report also includes concept aggregates only when five or
more students contributed to that concept in the assignment. No public weakness
projection or graded rubric task is enabled by this feature.
