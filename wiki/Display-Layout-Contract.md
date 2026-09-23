# Display Layout Contract

## Authority

`public/display/layout.mjs` is the only title/subtitle/body/timer sizing and region-allocation authority. `public/display/index.html` owns state application, media, timer state, transport, and viewport scaling. `public/display/layout.css` provides the packaged font and matching structural defaults, but the module reasserts containment-critical styles before measurement so a stale or missing stylesheet cannot silently change fit behavior.

The current renderer revision is `dynamic-fit-20260922-12`.

## Logical canvas and scaling

Every receiver renders one 1920x1080 logical stage. The completed stage is scaled uniformly with `min(viewportWidth / 1920, viewportHeight / 1080)`.

Physical screen resolution and DPR are diagnostics only. They do not alter logical font fitting or region geometry. Different aspect ratios letterbox rather than independently reflowing the logical composition.

The receiver uses the Hub-served Liberation Sans regular/bold font. Font loading completes before fitting when possible; diagnostics report `ready` or `fallback`.

## Current anchored geometry

All four logical regions use an 18px horizontal gutter, giving a 1884px region width on the 1920px stage.

With title, subtitle, body, and a bottom timer active:

| Component | Logical geometry |
| --- | --- |
| Title | x=18, y=24, width=1884, height=110 |
| Subtitle | x=18, y=138, width=1884, height=70 |
| Body | x=18, y=222, width=1884, height=663 |
| Timer | x=18, y=900, width=1884, height=160 |

Title and subtitle are stable anchored header regions. The body consumes the safe remaining reading surface between the header and timer. The timer uses a 160px safe region so its border and rounded corners are not clipped by browser rounding.

Empty title/subtitle/body objects are hidden rather than rendered as permanent empty bands. The body start is recomputed from whichever header objects are present.

Timer placement remains state-driven:

- `bottom`: timer sits 20px from the stage bottom; body reserves safe space above it.
- `top`: timer is placed immediately below the active header and the body begins below the timer.
- `center`: timer is centered vertically and the body is restricted to the non-overlapping space above it.

The timer chrome itself remains content-sized inside its region; the 1884px region is not a full-width timer border.

## Font sizing

The configured scene size remains the design input. Automatic fitting may grow only to 110% of the configured size, still subject to the absolute component safety caps:

| Component | Absolute cap |
| --- | ---: |
| Title | 220px |
| Subtitle | 140px |
| Body | 180px |
| Timer | 180px |

For example, a configured body size of 64px may auto-grow only to 70.4px before containment ceilings are applied. `autoFit:false` uses the configured value as a ceiling, but containment may still shrink below it.

The fitter searches in quarter-pixel increments and applies browser-independent hard ceilings before binary fitting. Title/subtitle also receive an intrinsic single-line width ceiling. Timer chrome receives a conservative label/value vertical ceiling.

## Containment

Containment has three independent checks:

1. scroll/offset dimensions;
2. an unclipped natural-size probe at the same logical width;
3. actual painted text-range rectangles.

The text-range pass validates glyph containment only. It intentionally does not reject a full-width flex child merely because transformed/subpixel browser geometry makes its border box differ slightly from its parent.

Title and subtitle are single-line and shrink horizontally rather than wrap. Body text uses `break-spaces`, preserving authored line breaks and blank lines while allowing wrapping of long content. Authored whitespace must not be normalized merely to make a fit pass.

Extremely dense content may shrink below the 12px readable threshold to preserve containment. Such results report component status `below-readable-minimum` and set `fitWarning=content-too-dense`.

## Transition recovery

Managed TV Chromium builds can transiently report stale text geometry during action-to-action content replacement. A visible component may briefly fall into the 1px fallback even though the same content fits normally once browser layout settles.

The renderer therefore performs bounded recovery:

- only a visible component with a valid non-zero region and status `below-readable-minimum` is considered recoverable;
- recovery waits 75ms and requests a fresh canonical layout;
- at most five retries occur for one layout key;
- successful recovery clears the retry state;
- pending recovery is cancelled when the renderer is disposed.

The renderer still avoids unnecessary refits. Identical state requests skip only when the live region geometry already matches the expected visible/hidden state. This preserves the invariant that viewport-only resize scales the stage without changing fitted logical geometry, while still repairing repeated content after an intermediate clear/hide transition.

## Timers

Routine timer ticks update digits and expiration state only. They do not trigger global layout, reset fonts, or resize the body. During fitting the timer uses a stable wide digit envelope so ordinary MM:SS / HH:MM:SS changes do not cause geometry churn.

## Diagnostics

Run:

```js
JSON.stringify(window.ClassroomDisplayDiagnostics(), null, 2)
```

For the current production renderer, expect `revision: dynamic-fit-20260922-12`.

Diagnostics include viewport, DPR, logical stage scale, font status, layout pass count, active object order, fitted sizes, region geometry, and containment status.

A normal successful component should end with `status: "fit"`. On the validated TV8 transition case, the body recovered from the transient 1px fallback to about 70.25px, scale 1, status `fit`.

## Regression verification

Required browser coverage runs the real receiver in Chromium and Firefox and checks anchored geometry, missing components, timer positions, repeated-state recovery, action transitions, timer ticks, dense content, long strings, manual sizing, missing CSS, reload/reconnect, resize-without-refit, cross-resolution scaling, text-range containment, and component non-overlap.

```bash
bash tools/prepare-display-fonts.sh
python3 -m venv /tmp/display-tests
/tmp/display-tests/bin/pip install -r test/browser/requirements.txt
/tmp/display-tests/bin/python -m playwright install --with-deps chromium firefox
DISPLAY_TEST_BROWSER=chromium /tmp/display-tests/bin/python -m unittest discover -s test/browser -v
DISPLAY_TEST_BROWSER=firefox /tmp/display-tests/bin/python -m unittest discover -s test/browser -v
npm test
```

## Deployment

Display renderer changes must bump `LAYOUT_REVISION` and both receiver cache keys. Build/publish the exact main-commit image, update the Hub, verify health, remove any temporary local overlay, reload receivers, and confirm the expected renderer revision in live diagnostics.

Do not call a display fix complete based only on source review or container health. Verify the real receiver behavior and, for TV-specific failures, retain the live diagnostics that demonstrate the settled final state.

## Receiver input safety

The receiver validates media URLs in `public/display/security.mjs` before touching the DOM. Only HTTP(S) URLs without embedded credentials are accepted. Protected same-origin assets may receive the Hub asset token; external hosts never do.

Music Assistant browser connections may use only this Hub's `/music-assistant/sendspin-proxy` WebSocket endpoint with the trusted Hub origin and fixed path.

Identify overlays are independent of the title/subtitle/body/timer layout engine and must not create a second fitter or layout observer.
