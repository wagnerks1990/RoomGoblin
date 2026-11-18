# Chess rules and verification

The authoritative rules reference is the [FIDE Laws of Chess effective 1 January 2023](https://handbook.fide.com/chapter/e012023), reviewed 18 November 2026. RoomGoblin implements online play; physical touch-move, scoresheets, arbiter penalties and tournament administration are outside this product's scope. The interface never decides whether a move is legal: the server validates the saved position and revision.

| Area | FIDE reference | Regression coverage |
| --- | --- | --- |
| Piece movement and king safety | Articles 1–3 | Starting-position and castling-rich move-tree counts; pins, blocking and adjacent kings |
| Castling | 3.8.2 | Both sides/colors; lost king/rook rights; check on the king's path; occupied queenside b-file; attacked rook and b-file permitted |
| Pawn special moves | 3.7 | Immediate-only en passant, exposed king and escaping check; all four promotions, including captures |
| Endings | Article 5 | Checkmate, stalemate and supported dead-position proofs |
| Draws | 9.2, 9.3, 9.6 | Claimable threefold/50-move thresholds; automatic fivefold/75-move thresholds; checkmate priority; position identity includes usable en passant and castling rights |
| Clock/resignation outcomes | 5.1.2, 6.9 | Server outcome checks use conservative mating-possibility proofs |

`test/learning-chess-rules.test.js` contains explicit positions and expected outcomes. Its move-tree counts also exercise interacting rules, rather than only isolated special moves. `test/learning-chess-ai.test.js` checks legal computer choices, tactical mate, fixed difficulty choices, bounded worker concurrency and recovery after rejection. `test/learning-chess-session.test.js` checks durable create intents, draw agreements/claims, authoritative clock expiry and leaderboard outcome attribution and averages.

The dead-position and mating-possibility helpers prove selected safe cases, including a locked pawn barrier. They are not an exhaustive solver for every possible composed position. Passing these tests does not certify full FIDE tournament compliance. The browser interaction suite additionally checks actual input and presentation against the authoritative server state; its synthetic LMS is not live Schoology acceptance.

Run from the active checkout:

```sh
node --test test/learning-chess-rules.test.js test/learning-chess-ai.test.js test/learning-chess-session.test.js
node test/browser/learning-chess-interaction-smoke.cjs
```

Browser checks require Playwright and an installed Microsoft Edge browser (or `CHESS_TEST_BROWSER=chromium` with Playwright Chromium installed). Run the repository's Linux regression workflow separately. Actual Schoology launch, resume and reporting, isolated gateway denial and cross-class privacy remain release checks in `CHESS-ARENA.md`.
