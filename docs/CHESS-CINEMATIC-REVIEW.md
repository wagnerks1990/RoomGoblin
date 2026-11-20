# Cinematic next: implementation and review

The cinematic renderer is integrated into the teaching release candidate. Its
presentation does not modify server chess rules, learner identity, clocks, grades,
matchmaking or gateway permissions. The video sample shows implemented rendering,
not generated concept footage.

## Visual changes

The three user-supplied reference images were actually inspected. They corrected
the earlier humanoid horse crest into a rearing armored **horse**, the rook into a
fortress/tower, pawns into smaller stooped helmeted shield infantry, and the royal
and bishop silhouettes into tall armored/robed figures. Ivory/charcoal stone and
muted gray trim replace the toy-like gold appearance. The geometry is an original
interpretation; movie models, logos, watermarks, textures, characters and sound
were not imported. The earlier exact YouTube clip could not be fetched during
the research; these image references, actual rendered screenshots and a decoded
recording supplied the visual evidence for this phase.

Human faces now use a detailed head/neck-only derivative of the official MakeHuman
hm08 basemesh. The source file's own header explicitly grants CC0; the exact Git
blob, authors, SHA-256, modifications and full CC0 text are recorded under
`public/learn/chess/cinematic/assets/`. No unclothed body, application code,
community add-on or third-party animation was imported. Armor, robes, shields,
horse, tower, environment, rig and motion remain original.

The four jointed limbs now have separate lower segments, foot pivots and hand
weapon pivots. Separate chest/head pivots retain the infantry's stooped baseline.
Motion has anticipation, turning, planted-step inverse kinematics, weight transfer,
block/counter/finisher beats, a defensive reaction and a non-graphic stone defeat.
The horse uses a four-leg/rearing/vaulting form; the tower uses weighted rigid
motion. Stone chips are bounded to eight. En passant reacts at the captured
pawn's actual square before the attacker occupies its confirmed destination.

Overview remains the default camera. Optional `battleCamera: true` provides a
temporary pair framing and returns to the seat's overview. Canvas picking is
disabled during that camera transition so a click cannot use a stale overview
projection. The semantic 2D board and API remain independent. No camera or
animation decides a move, winner, legal square, clock result or participation.

## Snapshot, accessibility and resource review

Only an exactly contiguous server revision with one appended move can animate.
First load, a different match, reconnect gaps and skipped revisions snap to the
latest FEN. A newer snapshot interrupts presentation immediately. A defender is
recreated at its confirmed square with its resting rig, so capturing a previously
moving actor cannot retain a mid-walk location or pose.

Effects off and reduced motion settle directly to the authoritative final board.
A preference change is checked during rendering as well as updates. Switching
`fast: true` during a longer scene also settles it; new fast scenes are shortened.
Joint X/Y/Z, knees, feet, weapon, chest/head and seat camera are reset before a
resting figure is baked. Context loss invokes one fallback callback; destruction
removes observers/listeners, scheduled frames, instanced GPU allocations,
geometries, materials, textures and the canvas.

Resting posed figures are merged into material batches. Only the moving attacker
and temporary defender retain full rigs. All 64 board squares use two instanced
meshes while preserving square picking. Mixed indexed/non-indexed primitives are
normalized before batching; incompatible batches fail closed instead of silently
dropping an entire stone body. This caught and fixed an invisible-pawn regression
during visual QA.

## Executed checks and measured limits

Measured in a synthetic headless Edge WebGL2 fixture using an isolated software
GPU, with no real student/LMS data. Software-GPU browser flags are test-only;
RoomGoblin does not require them or change browser security settings.

| Check | Actual result |
| --- | --- |
| `node --test test/learning-chess-cinematic-motion.test.js` | 4 passed, 0 failed, 0 skipped; 14,472 form/capture samples and 9 IK targets, plus camera restore, en passant and fast/reduced contracts |
| `node test/browser/chess-cinematic-next-smoke.cjs` | Passed complete stone batches, local-only runtime requests, instanced picking, interrupted capture reset, optional battle picking guard, fast/reduced motion, bounded chips, repeated replacement, context loss and destruction |
| Initial full 32-piece rendered scene | 204 draw calls including the shadow pass; 588,460 rendered triangles including shadow work; 116 tracked geometry resources |
| Earlier fully articulated next-art scene | 716 calls before idle baking and board instancing; the initial lower 172-call result was invalid because a pawn batch was missing and is not a valid performance baseline |
| Before/after comparison | Actual local teaching/next renderer lineup captured and visually inspected |
| Actual encoded preview | 24.04-second, 960×900 WebM; four moves validated through the chess engine: e2e4, d7d5, e4d5, g8f6; decoded and seeked in Edge, with an inspected mid-capture frame |

The preview explicitly enables the optional battle camera. It does not establish
actual Chromebook/TV FPS, thermal behavior, hardware GPU memory, live Schoology
acceptance or successful packaged deployment. Timed games continue while visuals
run. Long normal captures are optional presentation, never a turn gate; a newer
move or switching to 2D/effects off can interrupt them.

## Rebuilding and integration

Use the existing pinned Three.js 0.187.0 / esbuild build procedure in
[the cinematic plan](CHESS-CINEMATIC-PLAN.md). `view.mjs` bundles the animation
module and head data locally; no runtime CDN or additional model request is
required. The source files are retained for review.

To reproduce the head derivative offline, obtain the exact reviewed OBJ blob
identified in `assets/MAKEHUMAN-NOTICE.txt`, then run:

```text
node tools/build-chess-head.cjs /absolute/path/to/reviewed-base.obj
node tools/build-chess-cinematic.cjs /absolute/temporary/dependency-prefix
```

The first command refuses a source whose SHA-256 does not match the reviewed CC0
file, parses data only, extracts the named body's head/neck region, and does not
execute input or access the network. The ordinary cinematic build needs only the
committed derivative module, not the original body OBJ or MakeHuman software.

Integration includes `assets/MAKEHUMAN-NOTICE.txt` and
`assets/MAKEHUMAN-CC0.txt` in exported SCORM notices and manifest coverage alongside
the updated NOTICE/Three.js license. The package regression checks every exported
asset against its manifest and preserves the package identifier. No gateway route
is added for model assets: the executable renderer and model data are bundled
locally. Actual application/SCORM and keyboard/2D fallback checks remain separate
from the standalone renderer test.

## Remaining art limitations

The horse, armor, robes and architecture remain procedural and visibly stylized.
The face is more anatomically detailed, but this is not a film-quality cast or an
exact reproduction of the supplied objects. There is no motion-captured combat,
physical collision solver, detailed horse sculpt, cloth simulation, photogrammetric
stone environment or synchronized audio. Contact beats are authored geometric
presentation; unusual piece pairings can still intersect or look theatrical.
Actual school-device profiling, stronger LOD/quality adaptation, art review and a
polished representative capture pair remain necessary before wider release.
