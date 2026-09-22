# Display Sizing Recovery

## Current renderer policy

Renderer revision `dynamic-fit-20260922-8` replaces the old fixed-band sizing model.

The TV renderer still uses one fixed 1920x1080 logical canvas. TV resolution and DPR only scale the finished canvas; they do not choose independent font sizes.

Title, subtitle, body, and timer are dynamic layout objects:

- empty objects consume no vertical space;
- title and subtitle stay on one line and shrink to fit;
- title, subtitle, and body use 18px logical horizontal gutters;
- the body receives otherwise-unused room;
- timer top/center/bottom changes object order instead of reserving a fixed timer band;
- every object may shrink as far as necessary to remain visible and non-overlapping.

The Display Studio and scheduled automation text editor now use the actual receiver renderer for WYSIWYG preview. Draft changes are shown locally before they are sent or saved.

## After updating

Rebuild/recreate the RoomGoblin service and reload open receiver pages. In the receiver console run:

```js
JSON.stringify(window.ClassroomDisplayDiagnostics(), null, 2)
```

Confirm `revision` is `dynamic-fit-20260922-8`, `dynamic` is true, active regions do not overlap, and title/body text remains fully contained.

See `docs/DISPLAY-SIZING-RECOVERY.md` and `docs/DISPLAY-LAYOUT-CONTRACT.md` in the repository for the engineering contract and verification details.
