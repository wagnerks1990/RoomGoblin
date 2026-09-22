# Display Hard Containment

Renderer revision `dynamic-fit-20260922-8` makes containment and dynamic space use joint invariants.

Title, subtitle, body, and timer are active layout objects rather than permanent fixed-height bands. Title and subtitle are single-line objects with 18px logical edge gutters; they shrink horizontally as needed rather than wrapping. Body content uses the same near-edge-to-edge width and may wrap/preserve intentional line breaks. Empty objects consume no vertical space. The active objects are ordered by content and timer position, then share the usable 1920x1080 logical canvas from the 30px top margin to the 30px bottom margin with 14px gaps.

Automatic fitting is allowed to grow short content toward component safety caps and must shrink dense content until every rendered glyph fits. Manual `autoFit:false` keeps the configured font size as a ceiling, but still never permits clipping.

The fitter validates ordinary scroll/offset dimensions, an independent unclipped natural-size probe, and the browser's actual text range rectangles. This protects against Chromium/WebView cases where a constrained flex child reports dimensions that look contained while multiline glyphs are visibly cut off.

The dynamic height allocator starts with minimum readable object bands, keeps headings and timer in compact deterministic minimum bands and gives otherwise-unused room to the body reading surface. This means the screen is not permanently divided into title/subtitle/body/timer rectangles when some content is short or absent.

Timer position is now an ordering rule:
- `top`: timer, title, subtitle, body
- `center`: title, subtitle, timer, body
- `bottom`: title, subtitle, body, timer

The timer chrome remains content-sized inside its dynamic region. Timer ticks do not trigger global re-layout; the fitter reserves width using a worst-case timer value during the layout pass.

The receiver HTML uses the same `dynamic-fit-20260922-8` cache key for the layout module and stylesheet. Every renderer behavior change must bump this key.

## Verification

After deployment and receiver reload, run:

```js
JSON.stringify(window.ClassroomDisplayDiagnostics(), null, 2)
```

Expected revision: `dynamic-fit-20260922-8`.

Diagnostics should report `dynamic: true`, an `order` array for active objects, and fitted regions. For normal bottom-timer content, the first active region should begin near logical y=30, the final active region should end near y=1050, and neighboring active regions should remain separated by about 14 logical pixels.

No rendered text rectangle may cross its assigned region and no active regions may overlap.

Live-TV containment note: renderer `dynamic-fit-20260922-8` adds a browser-independent mathematical ceiling before binary fitting. Title/subtitle are bounded by logical line height and intrinsic single-line width; timer chrome is bounded conservatively for its label/value stack. This guard exists because a live Chromium receiver reported apparently acceptable overflow metrics while visibly clipping glyphs at component caps.
