# AI Display Runtime Guardrails

Read `docs/DISPLAY-LAYOUT-CONTRACT.md` before editing display or automation rendering.

## Authority

- `public/display/layout.mjs` exclusively owns fitted font sizes and title/subtitle/body/timer regions.
- `public/display/index.html` owns state, media, timer digits, transport, and viewport scaling.
- Branding must not inject display layout code.
- Do not add style/class/timer MutationObservers that create a second layout owner.

Current renderer: `dynamic-fit-20260922-12`.

## Geometry

Keep a fixed 1920x1080 logical canvas and one uniform viewport scale. Physical resolution and DPR never choose fonts.

Current all-active bottom-timer geometry is title y=24/h=110, subtitle y=138/h=70, body y=222/h=663, timer y=900/h=160, all at x=18/w=1884.

The body and timer geometry can differ for top/center timer placement or missing header objects, but active regions must never overlap.

## Sizing

Automatic fitting is bounded to 110% of configured size, then by absolute component caps and containment ceilings. Manual sizes still yield to containment.

Preserve body whitespace exactly. `break-spaces` is intentional.

Containment requires scroll/offset checks, an independent natural-size probe, and painted text-range checks. Do not infer successful fit from constrained child dimensions alone.

## Transition recovery

Some TV Chromium builds can transiently return stale geometry during action transitions. The receiver may briefly compute a visible component at 1px / `below-readable-minimum` even though the same content fits at normal size on the next stable pass.

The renderer therefore retries only this pathological visible-state case: 75ms delay, maximum five retries for one layout key. Do not turn this into an unconditional polling loop.

Repeated same-content state may skip only when its live region geometry is already current. This is required so:
- viewport-only resize scales the stage without refitting;
- a clear/hide followed by the same content can restore collapsed regions.

## Timer stability

Timer ticks may update digits and expiration state only. They must not force global relayout. Timer fitting uses a stable wide digit envelope.

## Verification gate

`npm test` provides policy coverage. Required visual validation is `.github/workflows/display-browser.yml` in Chromium and Firefox.

Retain browser evidence for:
- action transitions;
- repeated state after clear;
- resize without refit;
- anchored final geometry;
- timer positions;
- dense content;
- long labels/strings;
- missing stylesheet;
- reload/reconnect;
- cross-resolution scaling.

Do not weaken a failing browser assertion merely to make CI green. Do not call a deployment fixed based only on merge status or container health.

When renderer behavior changes, update this file, `docs/DISPLAY-LAYOUT-CONTRACT.md`, its Wiki mirror, sizing guardrails, tests, and changelog.
