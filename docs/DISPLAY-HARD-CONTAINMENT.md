# Display Hard Containment

Current renderer: `dynamic-fit-20260922-12`.

Containment and readable anchored geometry are joint invariants.

## Regions

With title, subtitle, body, and a bottom timer active:

- title: x=18, y=24, width=1884, height=110;
- subtitle: x=18, y=138, width=1884, height=70;
- body: x=18, y=222, width=1884, height=663;
- timer: x=18, y=900, width=1884, height=160.

Missing header/body objects are hidden. Top/center timer placement recomputes body space without overlap.

The timer chrome remains content-sized inside the 160px timer region. The region itself is full-width for safe alignment and fitting; the visible timer border is not.

## Fitting

Automatic growth is limited to 110% of configured size and then further bounded by absolute caps and hard geometry ceilings. `autoFit:false` uses configured size as a maximum.

Title/subtitle are single-line objects. Body text preserves authored whitespace with `break-spaces`.

The fitter validates:
1. scroll/offset dimensions;
2. an independent unclipped natural-size probe;
3. painted text-range rectangles.

Painted containment is intentionally glyph-only. Element-box overflow is already handled by the first two checks.

Dense content may shrink below 12px rather than clip; this sets `below-readable-minimum` and `fitWarning=content-too-dense`.

## Transient TV recovery

TV Chromium may briefly produce stale layout geometry during an action transition and send a visible component to the 1px fallback. A stable re-measurement of the same content can fit normally.

The renderer retries that pathological state after 75ms, at most five times per layout key, only when the component is visible and its region has positive dimensions.

Identical layout state may skip work only when live region geometry is already current. This preserves resize-only scaling while allowing same-content recovery after a clear/hide.

## Verification

Run:

```js
JSON.stringify(window.ClassroomDisplayDiagnostics(), null, 2)
```

Expected revision: `dynamic-fit-20260922-12`.

For normal settled content, visible components should report `status: "fit"`. The validated TV8 action-transition case recovers the body to about 70.25px, scale 1, with the bottom-timer body region restored to y=222/h=663.

No rendered text rectangle may cross its region and no active regions may overlap.
