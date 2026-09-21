# AI Display Sizing Guardrails

## Current policy

Renderer revision: `dynamic-fit-20260921-2`.

`public/display/layout.mjs` is the only sizing and region-allocation authority. The logical display canvas remains 1920x1080; physical TV resolution and DPR only scale the finished stage.

Title, subtitle, body, and timer are dynamic content objects:

- Empty objects consume no vertical space.
- Title and subtitle stay on one line and shrink to fit the near-edge-to-edge width.
- Title, subtitle, and body use an 18px logical horizontal gutter; do not restore the old 72px/90px gutters.
- Active objects share the usable logical canvas with bounded gaps.
- The timer's top/center/bottom setting changes object order.
- Automatic fitting may grow short content up to the reviewed component safety cap.
- Dense content shrinks as far as necessary to prevent clipping.
- `autoFit:false` uses the configured size as a hard maximum, not permission to overflow.
- The body is the primary reading surface and receives otherwise-unused vertical room.
- Timer digit changes do not cause global geometry churn.

## Containment

Never decide fit from constrained element dimensions alone. Keep all three checks:

1. scroll/offset dimensions;
2. an independent unclipped natural-size probe at the same logical width;
3. actual painted text-range rectangles.

This is required because Chromium/WebView can clip multiline flex content while the constrained child reports dimensions that appear to fit.

A bounded transform fallback may remain for pathological content after font-size reduction. Visibility and non-overlap take precedence over the requested size.

## WYSIWYG editing

Display Studio and the scheduled automation text editor use the real receiver page as their preview surface. Draft state is delivered only to a same-origin preview iframe with the `roomgoblin.preview.state` message. Never replace this with a separately implemented CSS approximation.

The preview bridge must remain preview-only:

- only active when the receiver was opened with `preview=1`;
- only accept messages from `window.parent` with exactly the same origin;
- never persist draft state or send commands to physical displays;
- use the same renderer revision and fonts as classroom displays;
- keep reference-resolution controls scaling the same 1920x1080 logical design canvas.

Do not introduce arbitrary unsanitized HTML as a display protocol. If rich formatting is added later, use a reviewed bounded formatting model or sanitized allowlist and keep the receiver layout engine authoritative.

## Architecture

Do not add a second MutationObserver/ResizeObserver/branding fitter. The receiver layout module owns sizing.

Do not hard-code the historical 125px title, 100px subtitle, 511px body, or 240px timer bands back into active layout behavior. CSS may provide loading/fallback geometry, but the running renderer must allocate active regions dynamically.

Do not make containment-critical child styles depend only on `layout.css`; the module establishes them before measurement.

## Regression verification

Browser coverage must include:

- the reported NOCTI classroom scene;
- short and dense content;
- missing title/subtitle/body objects;
- top/center/bottom timer placement;
- manual sizing;
- long unbroken strings;
- missing companion stylesheet;
- reload/reconnect;
- 720p/1080p/4K, DPR changes, and narrow portrait-like viewports;
- same-origin WYSIWYG draft updates without physical-device command side effects.

Assert actual text-range containment, dynamic region ordering, bounded gaps, full logical-canvas use, and component non-overlap.

Any behavior change must update `LAYOUT_REVISION`, both receiver cache keys, tests, operator docs, Wiki mirror, and AI context.
