# Display Sizing Recovery

## Historical regression

A prior renderer allowed `autoFit` to grow directly to global maximums whenever space was available. This made ordinary classroom scenes visually oversized and could clip headings or make the timer dominate the screen.

Another failure mode on TV Chromium appeared during action-to-action replacement: a transient stale geometry read could push body text to the 1px fallback even though the same content fit normally once layout settled.

## Current behavior

Current renderer: `dynamic-fit-20260922-12`.

`public/display/layout.mjs` remains the only layout owner. The 1920x1080 logical stage is unchanged.

Automatic growth is bounded to 110% of configured size before absolute component caps and hard containment ceilings. Configured scene sizes remain the primary design input.

Current all-active bottom-timer geometry:

- title y=24/h=110;
- subtitle y=138/h=70;
- body y=222/h=663;
- timer y=900/h=160;
- all regions x=18/w=1884.

The visible timer border remains content-sized.

Body text preserves authored line breaks and blank lines; whitespace is not normalized as a sizing workaround.

## Action-transition recovery

If a visible component ends a pass at `below-readable-minimum` while its region has valid non-zero dimensions, the renderer treats this as potentially transient and retries after 75ms.

Recovery is bounded to five attempts per layout key. Successful recovery clears retry state. Pending recovery is cancelled on dispose.

This recovery was validated on the live TV8 action transition where body text initially fell to 1px / scale ~0.05 and then recovered to about 70.25px / scale 1 / `fit`.

## Verification

After deployment, reload the receiver and run:

```js
JSON.stringify(window.ClassroomDisplayDiagnostics(), null, 2)
```

Expected revision: `dynamic-fit-20260922-12`.

Verify:
1. title/subtitle are fully contained;
2. body does not overlap timer;
3. timer border is fully visible;
4. authored blank lines remain intact;
5. timer ticks do not resize other content;
6. repeated action transitions settle to `fit`;
7. viewport resize does not change logical fitted sizes.

## Guardrail

Do not restore global-cap-only auto-growth, normalize authored whitespace, disable hard containment, or replace bounded transition recovery with an unbounded polling loop.
