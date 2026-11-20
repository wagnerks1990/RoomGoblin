# Chess teaching and practice assistance

This document is the teaching design for the separate chess teaching branch. It does not change the reviewed chess interaction release or establish that every item below has shipped. Existing access, grading, board and game rules remain in [Chess Arena](CHESS-ARENA.md) and [the rules audit](CHESS-RULES.md).

The implemented companion currently has six piece guides, five stages (basics, safety, tactics, strategy and endgames), fourteen independent questions with explanations, and requested practice-position examples. Question progress is kept in memory and is not a verified grade. The longer progression below guides future instruction and development; it is not a shipped ten-level certification.

## Learning progression

Advance by demonstrated understanding, with optional review and no age, rating or time gate. The following sequence is a RoomGoblin curriculum proposal, not a claim of validated educational outcomes. Each activity follows **notice → predict → try → explain → revisit**. Use a short demonstration, two guided examples, an independent example and a later review. Let learners explain orally, by selecting squares, or in writing.

| Stage | What learners practice | Evidence of understanding |
| --- | --- | --- |
| First game | Board coordinates, piece names, white/black orientation, alternating turns, movement, capture, blocked paths and the king's safety | Identify legal destinations for each piece and explain why one tempting move is illegal |
| A safe move | Check, defending or escaping check, checking the opponent's last move, undefended pieces, captures and threats | Before moving, name the opponent's threat and check whether the proposed destination is attacked |
| Special rules | Castling rights and safe king path, immediate en passant, all four promotions, checkmate versus stalemate | Solve fresh examples that change one condition; explain why an attacked rook differs from an attacked castling transit square |
| Finish the game | Queen/rook with king against king, safe promotion, king activity, basic pawn races and opposition | Finish a basic mate without stalemating; describe the plan before executing it |
| Tactics | Checks, captures, threats, forks, pins, skewers, discovered attacks, removal of a defender and simple mating patterns | Calculate a short line including the opponent's best reply; identify which detail makes the tactic work |
| A playable opening | Develop pieces, contest the center, protect the king, coordinate pieces and avoid repeated moves without a purpose | Explain the purpose of each opening move and adapt when the opponent deviates; do not assess memorized move counts |
| Planning and evaluation | Material, king safety, development, activity, pawn structure, open files, weak squares and exchanges | Compare two candidate moves with concrete replies and a position-based reason |
| Deeper calculation | Candidate generation, forcing replies, quiet defensive moves, visualization and evaluating the final position | Record a predicted line before moving; review where calculation diverged without hindsight scoring |
| Advanced study | Rook/minor-piece endings, strategic sacrifices, prophylaxis, practical defense, time management and repertoire research | Analyze a complete game independently, identify turning points and defend an improvement against alternatives |
| Independent competition | Unassisted slow games, sportsmanship, draw/clock procedures, personal study plans and tournament preparation | Maintain a reflective game journal and transfer skills to unfamiliar positions and opponents |

Give plain-language definitions on first use. A highlighted destination is a legal possibility, not automatically a good move. Piece values are rough teaching aids; king safety and concrete lines can override them. Do not label a learner unintelligent or a move a moral failure. Praise specific reasoning and improvement, not only wins.

## Assistance and fair play

Practice may show general checklists, legal-move explanations, a selected-piece hint and an explicitly requested suggested move. Reveal help progressively: first a question, then a relevant feature, then a concrete move with a short reason. The learner must still choose and submit the move. State that bounded computer suggestions may be incomplete; they are not proof of the objectively best continuation or a mate-in-N claim.

Live multiplayer must not receive position-specific suggestions, evaluation scores, candidate moves, tactical arrows or engine analysis, including for a teacher who is participating or watching. Disabling a button is insufficient: the server must reject the request. General rules/reference lessons may remain available when they do not analyze the live position. A future explicitly consented cooperative training mode would need its own stored mode, separate matchmaking/statistics and review; changing a competitive game's mode in a request cannot grant assistance.

This classroom boundary is consistent with the prohibition on outside advice in FIDE's over-the-board rules (Article 11.3.1), while RoomGoblin practice is deliberately assisted learning rather than a FIDE event. Use the [official FIDE Laws](https://handbook.fide.com/chapter/e012023) for movement, endings, claims and competition procedures; do not reproduce an entire rulebook in prompts or lesson assets.

Teacher demonstrations use an owned solo practice game, never a learner's private active seat as a coaching backdoor. A teacher may teach from an independently chosen lesson position. Completed multiplayer game analysis is a separate future permission decision; the proposed hint endpoint below rejects multiplayer in every status.

Existing participation points continue to reflect five validated player moves. Hints, lesson clicks, quiz answers, time spent and the coach's chosen moves must not silently award assignment points, competitive wins or verified mastery. Locally saved lesson progress is a convenience, not a verified grade or identity record. Do not send names, grades, tokens or class rosters to an external coach provider.

## Practice hint contract

The teaching branch implements these routes using the deterministic explanation helper. They are not part of the earlier interaction release.

| Caller | Exact endpoint |
| --- | --- |
| Direct SCORM | `POST /api/v1/learning/direct/activities/:id/chess/matches/:matchId/hint` |
| Native learner | `POST /api/v1/learning/activities/:id/chess/matches/:matchId/hint` |
| Teacher's own practice | `POST /api/v1/learning/teacher/classes/:id/chess/matches/:matchId/hint` |

Request JSON is `{ "revision": 4 }`, with a nonnegative safe integer and no caller-supplied FEN, history, mode, actor, permissions, provider, URL or search difficulty. Reject unsupported fields rather than accepting an arbitrary analysis service. The teacher class route resolves the original seat activity through `teacherActivity`; direct access retains the existing private bearer, exact scoped route and cookie-free CORS.

Resolve the saved match and original activity server-side. Require an active owned `solo` or `computer` seat, an available enabled participant, a writable assignment and the exact saved revision. For computer practice require the human's turn and no pending computer move. Deny spectators, any multiplayer game, another assignment's bearer, paused/closed/revoked access, and invalid or finished positions. Teacher role alone never bypasses these restrictions. Do not broaden gateway access to teaching pages, teacher assets, public TV endpoints or generic engine URLs.

Derive the position from saved validated moves. The synchronous `explainPosition` helper generates legal examples and factual reasons, with at most three examples returned. It does not search for a best move, call a worker or an external model, predict a result, or mutate the game. Authorization and revision checks run in the same synchronous request as explanation generation. A future asynchronous replacement must recheck access and state after awaiting work. Responses carry `Cache-Control: no-store` and no private identity fields.

Response shape (example content abbreviated):

```json
{
  "ok": true,
  "matchId": "the-requested-match-id",
  "revision": 4,
  "hint": {
    "turn": "white",
    "inCheck": false,
    "legalMoveCount": 20,
    "summary": "Compare a few legal moves and think about your opponent's reply.",
    "suggestions": [{ "move": "g1f3", "from": "g1", "to": "f3", "title": "Develop a piece", "reasons": ["This brings a knight off the back rank and into play."] }],
    "notice": "These are legal examples to explore, not best-move rankings or a prediction of who will win. Check what your opponent can do next."
  }
}
```

Use existing error conventions: unauthenticated `401`, prohibited mode/seat `403` or deliberately opaque `404`, unavailable/stale state `409`, writer freeze `423`, and budget saturation `429`. The server allows 12 explanations per learner per fixed 60-second window across all their games. Its in-memory limiter holds at most 512 unexpired learner windows and rejects new windows when full; expired entries are removed on subsequent requests. No hint response cache or durable hint audit is created. The browser permits one request in flight and ignores obsolete match/revision responses.

No hint changes moves, revision, clocks, draw offers, outcomes, attendance, score, standings or saved mastery. The browser applies a response only to the same selected match/revision, uses text nodes, clears old suggestions on move, selection, identity change and sign-out, and never auto-submits. Hints do not pause a timed computer game. The SCORM ZIP bundles teaching assets locally and keeps normal offline-reference lessons useful without creating a new enrollment path.

## Beyond the classroom

Learners who want stronger competitive play should combine enjoyable practice with slow unassisted games, honest self-analysis before engine review, focused tactics/endgames and feedback from a qualified coach or club. Set the next goal from an observed weakness, revisit it and adjust the workload to the learner's time and wellbeing. A school leaderboard, computer difficulty label, streak or lesson badge is not a FIDE rating.

Grandmaster is a formal international title with regulated competition and application requirements. RoomGoblin cannot award it, promise it or infer progress toward it from classroom wins. Families pursuing formal titles should consult their national federation and the current [FIDE Qualification Commission regulations](https://qc.fide.com/regulations/), which link the [title regulations](https://handbook.fide.com/chapter/B012024). The index was checked on 18 November 2026; the linked title chapter could not be fetched during this review, so this document deliberately does not restate numerical title thresholds or claim to audit eligibility. There is no guaranteed timetable or sufficient number of app lessons for a title.

## Evaluation, accessibility and release checks

Evaluate the design with teachers and learners before claiming learning gains. Compare pre/post performance on different but equivalent positions, retain an independent unassisted check and inspect reasoning, not just answer accuracy. Track which help stage was needed locally without publishing a learner's mistakes or private progress on the global board. Review ambiguous explanations and give a path to report them. Validate reading level and avoid claiming classroom improvements from a small usability sample.

`test/learning-chess-hints.test.js` verifies practice-only authorization, original assignment scope, revoked/disabled seats, paused/closed assignments, stale revisions, teacher bypass attempts, legal examples, pending computer-turn rejection, exact POST allowlists, per-learner budgets and unchanged match/participation/standings. Engine explanation tests separately exercise fixed rule positions. Browser and broader regression acceptance remain required; endpoint tests alone do not establish live Schoology behavior.

Browser checks must use the real shared/brand styles as well as exported SCO assets. Test mouse, touch, keyboard-only operation, focus return after a hint, screen-reader names, high contrast, 200% zoom, a narrow viewport, reduced motion and sound off. Announce requested hints through a restrained live region, never every poll. Pair square colors with coordinates and text; keep long explanations readable beside both 2D and optional 3D. Learners must be able to decline assistance and return to an unobstructed board.

Run the supported repository checks and existing chess/direct-assignment regressions from the teaching worktree. Confirm teacher pages and assets stay denied at the isolated learner gateway. Verify fresh Schoology launch, saved learner resume, participation reporting and review mode with a newly exported teaching package; synthetic LMS tests do not establish actual Schoology acceptance. This phase must not modify the earlier interaction release, deploy production or merge before its own checks and review are complete.
