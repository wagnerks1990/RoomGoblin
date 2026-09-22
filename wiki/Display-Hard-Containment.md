# Display Hard Containment

Renderer `dynamic-fit-20260922-8` uses dynamic layout objects for title, subtitle, lesson body, and timer.

Only active objects take vertical space. The renderer measures their content, orders them according to timer placement, allocates the available 1920x1080 logical canvas, and then grows or shrinks each object's text to the largest safe size that remains completely visible.

The renderer checks normal dimensions, an unclipped measurement probe, and actual painted text rectangles. This prevents the TV Chromium/WebView failure mode where text is visibly cut off even though the constrained element reports dimensions that appear to fit.

For a bottom timer, active objects normally fill the logical canvas from about y=30 through y=1050 with 14px gaps. Top and center timer modes reorder the timer among the other active objects rather than reserving a fixed timer band.

After updating the Hub, reload receiver pages and verify `window.ClassroomDisplayDiagnostics()` reports `revision: "dynamic-fit-20260922-8"`, `dynamic: true`, the expected object order, no overlap, and no fit warning for normal classroom content.


Live Chromium/TV validation also requires distinguishing element-box containment from painted-glyph containment. Full-width flex children may differ from their parent by transformed subpixel geometry; that border-box difference alone must not force text to shrink. Scroll/offset and natural-size checks validate the element box, while text-range rectangles validate painted glyphs.
