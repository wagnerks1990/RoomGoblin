# Optional cinematic chess prototype

RoomGoblin can present the same confirmed chess match as an original fantasy stone
board. This is an optional procedural 3D prototype, not a recreation of a movie's
characters, artwork or soundtrack. It does not change rules, enrollment, grades,
leaderboard results, gateway authorization, or room/display controls.

## Current implementation

`public/learn/chess/cinematic/view.mjs` exports `ChessCinema`:

```js
const cinema = new ChessCinema(container, { onSquare, onFailure });
cinema.update(match, {
  orientation: 'white', effects: true, selected: 'e2',
  targets: ['e3', 'e4'], disabled: false
});
cinema.destroy();
```

The container supplies width and height. `onSquare(square)` is only a selection
callback: the existing board/controller must perform server validation and turn
authorization. The match contains confirmed `id`, `fen`, `moves` (UCI strings),
`revision`, `result` and `reason`. The renderer never submits requests or chooses
legal moves. Only exactly contiguous revisions with one appended confirmed move
animate; first loads, reconnect gaps and changed matches snap to the latest board.
Newer snapshots cancel old animation. Visual animation never delays server moves.

All six piece types are original procedural humanoid stone statues: pawn infantry
with spear/shield, crowned king/queen warriors, robed bishop, armored horse-crest
knight, and turret-helmet fortress guard rook. Four simple jointed limbs create a
heavy stepping motion. A deterministic generated mineral/bump texture, warm/rim
lighting, 512px soft shadows and stone dais add depth without external assets.
Static body parts are merged by material. White/Black camera orientation follows
the player's seat. Captures collapse with a small dust ring rather than depicting
graphic violence; checkmate gets a short ring pulse. No combat outcome comes from
physics. Effects off or the system
reduced-motion preference snaps immediately. Idle scenes render on demand.

The constructor requires WebGL2 and throws on initialization failure; context loss
or subsequent rendering failure invokes `onFailure(message)` once. The parent UI
must retain an accessible semantic 2D board, support switching back, and destroy
failed/hidden renderers. The canvas itself is decorative to assistive technology;
it is not the keyboard/screen-reader authority. Pixel ratio is capped at 1.5.

## Reproducible local bundle

Three.js is pinned to **0.187.0**. No CDN, remote assets, decoder, service worker,
WebGPU, or additional browser permissions are needed. The repository's existing
esbuild builds one local ESM. Do not modify repository dependency manifests just
to rebuild this optional renderer. Use an empty temporary prefix outside the repo:

```text
npm install --prefix /absolute/temp/chess-deps --ignore-scripts --no-audit --no-fund three@0.187.0
node tools/build-chess-cinematic.cjs /absolute/temp/chess-deps
```

The build checks the exact version and copies Three.js's MIT license beside the
bundle. Source is `cinematic/source.mjs`; `view.mjs` is the committed generated
artifact. Include view.mjs, NOTICE.txt and THREE-LICENSE.txt in SCORM exports.
The self-contained graphics can load without third-party networks; multiplayer
still requires the RoomGoblin server. Schoology launch/resume and actual low-end
Chromebook/TV GPU performance remain live acceptance requirements.

## Next stage beyond procedural pieces

A high-quality virtual fantasy chess experience needs a separate original or
licensed art pipeline: six distinctive sculpted/rigged piece types, optimized GLB
models, shared materials, authored walk/attack/defeat clips, sound, and optional
short camera vignettes. Prototype two combatants and one skippable capture first.
Keep a license ledger for every acquired asset, including redistribution rights
for complete SCORM games. The procedural prototype does not claim realistic
humanoid animation or movie-level visual quality.

Keep 2D/Fast/Cinematic choices and reduced motion. Measure asset bytes, load time,
frame time, memory, context loss, resize, interrupted animation and touch input on
actual school devices before expanding environments, particles and shadows.
WebGPU is optional future work: ordinary LAN HTTP lacks its required secure
context. Do not change appliance security or require unsafe browser flags for a
visual effect.

Technical sources: [Three.js WebGL renderer](https://threejs.org/docs/pages/WebGLRenderer),
[glTF loader](https://threejs.org/docs/pages/GLTFLoader.html),
[animation mixer](https://threejs.org/docs/pages/AnimationMixer.html),
[render on demand](https://threejs.org/manual/pages/rendering-on-demand.html),
[WebGPU limitations](https://developer.chrome.com/docs/web-platform/webgpu/troubleshooting-tips).

## GitHub reference review (2026-11-18)

The requested [UFMiDAS2020/WizardsChess](https://github.com/UFMiDAS2020/WizardsChess)
is a **virtual Unity/Oculus Quest** hackathon game, not physical chess. Its README
describes hand/voice levitation with Photon multiplayer. The inspected
[ChessManager.cs](https://github.com/UFMiDAS2020/WizardsChess/blob/main/Assets/Scripts/ChessManager.cs)
parses spoken coordinates and lifts/translates/lowers Unity objects; it does not
provide RoomGoblin's authoritative legal-move service. Its speech path depends on
Google cloud speech, which is unsuitable as a required offline classroom feature.
The repository root has no project license file in the inspected tree. No code,
models, textures or sounds were copied. Its broad levitation presentation is a
useful reference; the local glide/lift animation here was independently written.

[Terminats/chess-3d](https://github.com/Terminats/chess-3d) has an actual
[MIT license](https://github.com/Terminats/chess-3d/blob/main/LICENSE.MD).
Its README and `ChessGameEngine.ts` show separate pieces/container/game layers and
a worker for computer search. This supports keeping rendering separate from
rules and keeping expensive computer work off the UI thread. It uses local
chess.js/physics state, which must not replace RoomGoblin's server decisions.
Its implementation and models were not imported.

[mrabhin03/3D-Chess-Game](https://github.com/mrabhin03/3D-Chess-Game) demonstrates
GLTF/KTX2 loading, picking, turn presentation and animation in
[main.js](https://github.com/mrabhin03/3D-Chess-Game/blob/main/main.js).
These are useful future asset-pipeline references. Although its README claims
MIT, the inspected recursive tree contains no LICENSE/COPYING file, so no code
or assets were reused. Its global input handlers, local rule authority, high
pixel ratios and animation-delayed moves are not suitable RoomGoblin defaults.

All reference projects are untrusted examples, not correctness/security proof.
The only third-party implementation included in this prototype is the pinned,
locally bundled Three.js renderer with its actual upstream MIT license.

## Film reference and realistic art gap

The user supplied [this film clip](https://www.youtube.com/watch?v=edG_NsKjE98)
as the desired visual direction. Direct video fetch was throttled and the
available browser inventory was empty during this agent's review; **this exact
clip was not visually verified**. Do not describe shot-specific comparison as an
observed result. The user's stated target is lifelike virtual stone warriors,
not physical hardware. No frames, likenesses, soundtrack or movie models are
incorporated in RoomGoblin.

The revised prototype now has humanoid infantry, crowned warriors, a robed bishop,
armor/horse motif and fortress guard, with mineral grain, shadows, jointed stepping
and a weighted capture collapse. It remains visibly stylized and geometric.
It lacks sculpted anatomy/faces, detailed carved armor, believable skinning,
foot-contact/weight transfer, paired combat choreography, fracture debris,
cinematic set dressing and authored camera staging. Procedural primitives and
bump grain do not meet a photorealistic or film-quality claim.

Concrete next-art candidates researched from official sources:

| Candidate | License evidence and SCORM implications | Remaining work |
| --- | --- | --- |
| MakeHuman bundled human base/rig exports + original armor/animation | [Official asset/output license](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md), sections C/D, releases bundled assets and exports under CC0. This supports redistribution in the app and self-contained SCORM; third-party community clothes/assets have separate licenses. | Best clear-rights route to realistic proportions. Create original armored/clothed statues and walk/attack/defeat clips in Blender; not a finished knight pack. Do not bundle the AGPL application code. |
| Quaternius [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) + [Modular Character Outfits—Fantasy](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html) + [Universal Animation Library](https://quaternius.com/packs/universalanimationlibrary.html) | Each official pack page explicitly labels CC0; character page specifies humanoid rig, glTF and about13k triangles. The separate current [QAL](https://quaternius.com/license.html) permits completed incorporated products but restricts standalone assets. Preserve the actual downloaded pack license before import; website inconsistency means raw assets are not cleared for the public repository yet. | Good compatible proof-of-concept rig/armor/motion set, but deliberately stylized rather than realistic stone sculpture. Retarget only a few clips and optimize. Completed-game SCORM distribution is supported under both published license descriptions, while repository/source asset redistribution depends on the acquired license. |
| Adobe Mixamo animation library for an original/MakeHuman humanoid | [Official Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) explicitly permits royalty-free characters/animations in video games. It does not establish unrestricted raw-asset redistribution or a named pack's complete provenance. | Useful motion candidate, not a fully cleared public-source asset pack. Verify acquired terms and embedded SCORM distribution before import; never distribute animations as a separate asset library. No models were uploaded or downloaded here. |

A more detailed [Medieval Knight with Rig](https://www.fab.com/listings/7d157fbd-e498-474b-8588-d7c2bd4eb2a7)
listing advertises rigged GLB/PBR armor, but its accessible page did not expose the
selected license. [Fab's standard license](https://www.fab.com/eula) permits use
in completed products but forbids standalone redistribution. Consequently this is
an **uncleared candidate**, not an approved import or purchase recommendation.
No paid asset was acquired. There are not yet three fully verified realistic
ready-made model/animation packs in this implementation.

Next: make one original realistically proportioned infantry model and one defender
with a shared rig, stone PBR material and a short paired capture clip; validate
feet/weapon contact, silhouettes at board scale, clip interruption and reduced
motion. Then add the remaining four ranks and a restrained optional close camera.
Every visual remains subordinate to the confirmed server snapshot. Only after
one polished slice passes device/LMS/performance checks should the scene expand.
