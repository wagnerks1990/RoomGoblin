# AI Context: Dynamic Display Layout and Hard Containment

Renderer revision `dynamic-fit-20260921-3` treats title, subtitle, body, and timer as dynamic objects. Do not reintroduce fixed title/subtitle/body/timer bands.

Required invariants:

- Empty text objects consume no vertical layout space.\n- Title and subtitle are single-line objects; never re-enable wrapping as the default.\n- Title, subtitle, and body use 18px logical horizontal gutters so nearly the full display width is available.
- Active objects share the full usable 1920x1080 logical canvas with small bounded gaps.
- Timer top/center/bottom changes object order rather than reserving a permanently fixed band.
- Automatic fitting may grow content up to reviewed component safety caps.
- Dense content must shrink until every actual rendered glyph remains inside its assigned dynamic region.
- `autoFit:false` is a manual maximum, never permission to overflow.
- Timer ticks must not cause global geometry churn.
- Physical resolution and DPR only scale the finished logical stage.

Do not trust only `scrollWidth`/`scrollHeight`. Keep the independent unclipped natural-size probe and painted text-range validation because TV Chromium/WebView can visually clip multiline content while constrained element metrics appear to fit.

Do not make containment-critical structural styles depend only on the companion stylesheet. The layout module must establish them before measurement.

Behavioral changes require synchronized browser regressions, operator docs, Wiki mirror, AI context, `LAYOUT_REVISION`, and receiver module/CSS cache keys.
