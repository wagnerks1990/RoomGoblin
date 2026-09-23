# AI Display Sizing Guardrails

## Current policy

Renderer revision: `dynamic-fit-20260922-12`.

`public/display/layout.mjs` is the only sizing and region-allocation authority. The logical display canvas remains 1920x1080; physical TV resolution and DPR only scale the completed stage.

Current anchored bottom-timer geometry with all components active:

- title: x=18, y=24, width=1884, height=110;
- subtitle: x=18, y=138, width=1884, height=70;
- body: x=18, y=222, width=1884, height=663;
- timer: x=18, y=900, width=1884, height=160.

Title and subtitle are anchored header regions. The body consumes the safe reading surface that remains. Timer placement can still be top, center, or bottom and body geometry must adapt without overlap.

Automatic growth is bounded to 110% of configured size before absolute caps are applied. Do not restore global-cap-only growth. Configured sizes are the design input; fitting may grow modestly and must shrink as needed for containment. `autoFit:false` prevents growth above the configured size but never permits overflow.

## Whitespace and text

Body text uses `break-spaces`. Preserve authored line breaks and blank lines exactly. Do not normalize trailing or repeated blank lines merely to make content fit.

Title and subtitle remain single-line and use intrinsic-width ceilings rather than wrapping.

## Containment

Keep all three checks:

1. scroll/offset dimensions;
2. an independent unclipped natural-size probe at the same logical width;
3. actual painted text-range rectangles.

Painted-containment checks validate glyph ranges only. Do not reject an intentionally full-width flex child because transformed subpixel geometry makes its border box differ slightly from the parent.

A bounded transform fallback may remain only after font-size reduction. Visibility and non-overlap take precedence over requested size.

## Transition recovery

TV Chromium can transiently report stale text geometry during action-to-action replacement. A visible component may briefly fall into the 1px fallback even though a later measurement fits normally.

Preserve the bounded self-heal contract:

- recover only visible `below-readable-minimum` components whose regions have positive width/height;
- wait 75ms;
- retry at most five times for the same layout key;
- clear recovery state after success;
- cancel pending recovery on dispose.

Identical state requests may skip only if the live visible/hidden region geometry already matches state. This keeps viewport-only resize from refitting while still repairing repeated content after an intermediate clear/hide.

## WYSIWYG editing

Display Studio and the scheduled automation text editor must use the real receiver page as their preview surface. Draft state is delivered only to a same-origin preview iframe with `roomgoblin.preview.state`.

Never replace the receiver with a separately implemented CSS approximation. Do not add unsanitized arbitrary HTML to the display protocol.

## Architecture

Do not add a second MutationObserver/ResizeObserver/branding fitter. The receiver layout module owns sizing.

Do not restore the historical fixed title/subtitle/body/timer bands or the obsolete dynamic allocator that distributed the full vertical canvas by weighted object demand. The current contract is anchored header + safe body + independent timer region.

Do not make containment-critical styles depend only on `layout.css`; the module establishes them before measurement.

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
- 720p/1080p/4K, DPR changes, and narrow viewports;
- viewport resize without logical refit;
- same-origin WYSIWYG draft updates;
- clear → same-state geometry restoration;
- action-to-action transient fit recovery.

Assert text-range containment, final anchored geometry, timer/body non-overlap, bounded growth, and that normal settled content does not remain at the 1px fallback.

Any rendering behavior change must update `LAYOUT_REVISION`, both receiver cache keys, tests, operator docs, Wiki mirror, and AI context.
