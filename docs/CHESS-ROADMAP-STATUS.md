# Chess roadmap implementation status

This checklist separates implemented source from release acceptance. It does not
declare the complete Chess.com research inventory implemented. All content and
drills are original; no Chess.com accounts, telemetry or assets are required.

## Current development release

* Adjustable 3D camera presets, orbit, tilt and zoom.
* Confirmed two-ply computer animation, castling rook animation and cancellation.
* One local, legally revalidated multiplayer premove.
* Six server-owned guided drills, progressive hints and private saved progress.
* Local untimed/timed coordinate practice with accessible input and pause.
* Fixed native computer challenge ladder, preserving legacy saved difficulty IDs.
* Default Adaptive computer play, position-dependent challenge/style selection.
* Adaptive Coach and private progress-informed lesson recommendations.
* Bounded shared game-pattern adaptation without exposing cross-class profiles.

The working-tree implementation requires combined regression, actual engine,
exported-package/browser, security and release checks. A committed or merged
change is not automatically deployed. Actual Schoology launch, saved identity,
resume and grade acceptance remain distinct from synthetic tests.

## Remaining research inventory

The broader [teaching roadmap](CHESS-COM-FEATURE-ROADMAP.md) and
[gameplay inventory](CHESS-COM-PLAY-FEATURES-RESEARCH.md) remain the source for
subsequent work: completed-game analysis and retry, richer skill diagnostics,
larger authored lesson/puzzle sets, spaced practice, opening/endgame study,
teacher assignment/reporting tools, tournaments and optional engagement features.
These require their own implementation and acceptance; do not advertise them as
available merely because this research is checked into the repository.

## Adaptive scope

Adaptation selects from bounded server-owned engine settings and evaluated legal
moves. It is not continuous neural-network retraining or certified Elo. New
completed games supply private summary evidence; the current position can alter
the next reply. Unknown historical assistance, hints, forfeits and interrupted
games must not masquerade as independent strength evidence. Match outcomes and
multiplayer standings remain authoritative and separate.

The initial learning windows are deliberately finite. Identifiers are private,
reported LMS names never merge identities, and account/assignment deletion must
remove associated profile evidence. No raw cross-class games or profiles are
returned through adaptive endpoints. See [adaptive research](CHESS-ADAPTIVE-BOTS-RESEARCH.md)
and [packaged engine/source obligations](CHESS-ENGINE-SOURCE.md).
