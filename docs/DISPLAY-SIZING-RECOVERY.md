# Display Sizing Recovery

## 2026-09-09 regression

A renderer change allowed `autoFit` to grow title, subtitle, body, and timer text directly to global maximums whenever space was available. On normal classroom scenes this changed configured values such as 72/40/54/75 into approximately 118/82/120/132 logical pixels. The result was visually oversized text, clipped heading glyphs on some receivers, and a timer that dominated the display.

The same change forced the timer overlay to `width: 100%`, which turned the historic compact white timer border into a nearly full-width horizontal box.

## Correct behavior

`public/display/layout.mjs` remains the only layout owner. The 1920x1080 logical stage remains unchanged and physical TV resolution/DPR remain scaling-only inputs.

The current renderer supersedes the fixed-band recovery model. With automatic fitting enabled, configured sizes are starting inputs only; active title, subtitle, body, and timer objects dynamically share the usable canvas and may grow up to reviewed safety caps or shrink as much as required for containment. Empty objects consume no vertical space.

The visible timer overlay remains content-sized (`max-content`), but its region is now dynamically allocated and ordered by top/center/bottom placement instead of always reserving a fixed 240px band. Timer ticks still do not trigger global layout changes.

## Verification

After deploying/rebuilding, reload each receiver and run:

```js
JSON.stringify(window.ClassroomDisplayDiagnostics(), null, 2)
```

Expected renderer revision: `dynamic-fit-20260921-1`.

Diagnostics should report `dynamic: true`, active-object `order`, and fitted regions that collectively use the available logical canvas without overlap. Font sizes are content-dependent: short content may grow substantially, while long content may shrink.

Visually verify all of the following on the same real classroom state:

1. title and subtitle are fully inside their bands;
2. body text does not overlap the headings or timer;
3. timer border is a compact centered box around the timer content;
4. timer ticks do not cause the body or headings to resize;
5. 1080p and 4K receivers retain the same logical font sizes.

## Regression guardrail

Do not restore global-cap-only auto-growth. Absolute caps are safety limits, not target sizes. Any future readability work must preserve the configured scene size as the primary design input and must retain compact timer chrome unless a separate timer style is explicitly selected.
