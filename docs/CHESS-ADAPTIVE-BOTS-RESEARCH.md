# Stronger computer opponents and adaptive teaching

## Runtime choice

The reviewed initial deployment target is Debian Bookworm's **Stockfish 15.1-4**,
not a claim to ship the newest Stockfish. Debian lists builds for amd64 and arm64
and links its corresponding upstream source and Debian patches. The package is
installed only during the reviewed image build. Runtime must never download an
engine, model or executable supplied by a browser. See the
[Debian package](https://packages.debian.org/bookworm/stockfish).

Stockfish's official site currently lists version 19. Using the pinned Bookworm
package deliberately trades the newest engine improvements for a smaller,
distribution-maintained runtime compatible with the existing base image.
Revisiting the pin is a separate tested dependency change, not an automatic
download. See the [official downloads](https://stockfishchess.org/download/).

The fixed server executable is
`/usr/local/libexec/roomgoblin-stockfish/stockfish`, linked by the image to the
reviewed package binary. `ROOMGOBLIN_STOCKFISH=1` enables it. No HTTP input chooses
an executable, working directory, UCI option, tablebase or model path. Windows
unit tests inject a fake subprocess; genuine binary acceptance runs in Linux.

Stockfish is GPLv3-or-later. Preserve its license, copyright notice and access to
the exact corresponding source, including Debian's patch archive, when shipping
images containing it. Do not copy its code into the RoomGoblin JavaScript engine
or pretend the native engine is MIT. The separate process communicates through
UCI. See [Stockfish 15.1 source and distribution documentation](https://github.com/official-stockfish/Stockfish/tree/sf_15.1)
and [Debian source package](https://packages.debian.org/source/bookworm/stockfish).

## Fixed challenge ladder

Legacy `beginner`, `standard` and `advanced` saved games retain the existing
lightweight worker engine. New native-engine identifiers are distinct:

| ID | Label | Stockfish skill | Search time cap | Node cap |
| --- | --- | ---: | ---: | ---: |
| normal | Normal | 3 | 200 ms | 30,000 |
| intermediate | Intermediate | 7 | 350 ms | 75,000 |
| stockfish-advanced | Advanced | 12 | 500 ms | 150,000 |
| expert | Expert | 16 | 700 ms | 300,000 |
| master | Master | 19 | 1,000 ms | 600,000 |
| grandmaster | Grandmaster | 20 | 1,200 ms | 1,000,000 |

These are challenge labels, not human ratings or FIDE title certification.
Hardware, available thinking time and search limits affect actual play. Skill
reduction intentionally weakens the engine; it does not train a model.
The selected options are present in the
[official 15.1 option definitions](https://github.com/official-stockfish/Stockfish/blob/sf_15.1/src/ucioption.cpp).
The [official FAQ](https://official-stockfish.github.io/docs/stockfish-wiki/Stockfish-FAQ.html)
explains why engine and human ratings cannot be equated and confirms that gameplay
evaluation runs on the CPU.

Each subprocess uses one thread, a 32 MiB hash table, no pondering and one primary
variation. The existing two-search admission budget is shared with legacy
workers. Handshake/search/exit has a five-second overall deadline, followed by
termination escalation. Output is bounded and never returned to learners.
Cancellation retains capacity until the process actually closes. Native failures
do not silently substitute the lightweight engine under a stronger label.
The hash size is **not** a total process-memory limit: native code, NNUE weights,
stacks and allocator overhead also consume memory. Measure resident memory and
latency under two concurrent searches on the appliance before release acceptance.

The server supplies its validated position and, where available, complete saved
move history. The adapter accepts only a legal returned UCI move; the existing
transaction then checks permissions, state/revision and applies legal moves again.
No learner engine result, rating or reported name becomes authorization. Freeze
and shutdown must retain the existing accepted-handler drain, stop new work and
close/drain computer children. SCORM contains no native engine or cloud request.
UCI setup and search limits follow the
[official protocol documentation](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-Protocol-and-Stockfish-Commands.html).

## Can the bot learn from everyone's play?

The following roadmap distinguishes RoomGoblin practice adaptation from actual
Stockfish neural-network training. The engine-side adaptive implementation is
described below; lesson generation and network training remain separate work.

1. **Stronger fixed opponents:** establish the pinned engine, transparent named
   difficulty, bounded resource use, reproducible legal-game regressions and
   clear unavailable-engine errors. Preserve fixed difficulty for each saved
   game and keep computer results separate from multiplayer standings.
2. **Adaptive teaching between games:** derive a learner's own practice needs
   from completed, server-owned games: repeated opening choices, overlooked
   checks, hanging-piece patterns and endgame practice needs. Recommend a lesson
   or next challenge, explain the observation and let the learner/teacher choose.
   A small sample should say there is not enough evidence. Never alter a chosen
   fixed level secretly during a game or infer personal traits from move style.
3. **Local opponent-style model:** add an explicitly labeled adaptive mode with
   bounded, versioned statistics. It can choose among server-legal candidates
   within a disclosed difficulty band, or create practice positions around a
   recurring mistake. Keep personal statistics tied to the existing private
   participant and teacher-class authority. Reported LMS names must not merge
   people, classes or accounts. Provide reset/retention behavior and exclude
   unfinished games from learning jobs to avoid interfering with live play.
4. **School-wide aggregate curriculum signals:** consider only sufficiently
   broad, non-identifying pattern counts to improve exercises. Do not expose
   another class's games, roster, individual weaknesses or player identities.
   Aggregation alone does not prove anonymity; small or distinctive groups need
   suppression and a separate privacy review. Keep data local and do not export
   student games to a model provider or public training dataset by default.
5. **Offline engine-network training research:** this is a separate model
   development project, requiring controlled datasets, compatible network
   architecture, training hardware, held-out tests and engine matches. A few
   classroom games do not establish a stronger general engine. Any resulting
   network needs provenance, release pinning, rollback and independent strength
   validation before classroom use. Stockfish's
   [official NNUE training project](https://github.com/official-stockfish/nnue-pytorch)
   is the relevant implementation starting point; ordinary UCI gameplay does
   not retrain its shipped weights.

For educational use, stages 2–3 offer a more direct benefit than attempting to
retrain Stockfish: students receive useful practice and a clearly explained
challenge without hidden handicaps or misleading rating claims. This is a
design judgment, not a measured learning-outcome result.

### Adaptive decision implementation and examples

The engine now accepts `adaptive`, `adaptive-coach` and `adaptive-practice`, alongside every fixed
and legacy level. The trusted service supplies `{band:0..5,style}`; the adapter
never accepts learner identity or records from another class. The newest product
decision explicitly allows changes during a game. Starting at full move three,
a material lead of at least three pawns raises the effective computer challenge
one band; a comparable deficit lowers it one band. The adjustment is bounded
to one band from the saved baseline and clamped to the six fixed engine profiles.
This coarse rule is disclosed practice adaptation, not a calibrated skill rating.
For realtime modes, check selects solid style; a human material deficit selects
solid, and a human material lead selects attacking. Otherwise the saved style
applies. Adaptive Coach uses the same realtime decisions with teaching assistance.
Adaptive Practice instead retains its trusted initial match band and style for
the entire game; learning affects its next game's initial profile only.

Balanced retains the engine's selected move. Attacking, solid and exploratory
styles can choose among three latest-depth legal MultiPV candidates within
35 centipawns of the best candidate. Incomplete, stale, bounded, duplicate or
illegal variation output falls back to the engine's selected move. Any mate
score also preserves that move. Style never substitutes a speculative illegal
move or changes multiplayer play. Profile persistence and visible effective
band projection are owned by the authenticated learning service. No engine
weights are retrained by this feature.

Examples for future richer diagnostics (not all implemented):

- Repeatedly missing a knight fork suggests a short knight-fork exercise before
  another practice game; it does not announce a permanent skill label.
- Consistently completing unassisted practice games successfully can offer one
  small increase next game; repeated difficulty can offer an easier game or a
  guided lesson.
- A learner choosing hints can receive more explanations and targeted drills,
  while that assisted game is excluded from strength estimation.
- Forfeits, cancelled games, disconnections and incomplete games should not be
  treated as evidence of weak chess ability. Time-pressure results need their
  own clearly defined treatment rather than being mixed blindly with untimed
  practice.

These changes must never affect multiplayer competitive results or secretly
change fixed opponents. The current service uses recent outcomes and opening
center-square frequency, not engine analysis of specific tactical mistakes.
It recommends general rules/safety drills without claiming to detect missed
forks or hanging queens. Shared opening patterns affect style only after ten
eligible games across five accounts; richer curriculum aggregates remain future
work. Both are separate from retraining engine weights.

## Validation boundaries

Mock-process and pure decision tests cover options, malformed input/output,
legality, bounded output, cancellation, deadline escalation, lingering-process
capacity, shared admission, adaptive bounds and MultiPV fallback cases.
An opt-in native test ran the exact Debian 15.1-4 amd64 binary in local WSL:
all six fixed levels, all three adaptive modes, mate, complete repetition history,
abort, drain and two-process admission passed. One observed run took 4.37 seconds,
with peak sampled individual-process RSS 152788 KiB and maximum observed process
CPU ticks 113. These are local observations, not production capacity guarantees.
The container image and actual appliance still require acceptance. No student
dataset is exported or used for neural-network training by this adapter.
