# WYSIWYG Display Content Editing

RoomGoblin uses the classroom receiver itself as the preview engine for display-content editing.

## Why this design

A separate generic HTML/Rich Text preview would eventually drift from the physical receiver's font loading, dynamic-object allocation, title single-line fitting, body wrapping, timer geometry, and containment rules. The editor therefore embeds the actual `/display/:id?preview=1` receiver and injects local draft state into that iframe.

The preview is not a second renderer.

## Display Studio

The Display Studio preview is open by default. Changes to title, subtitle, body text, colors, background, font size, and body alignment are reflected immediately in the embedded receiver.

Nothing is sent to a classroom display until the operator explicitly uses a Send action.

The editor shows:

- the fixed 1920x1080 logical design canvas;
- a reference output resolution such as 1920x1080, 3840x2160, or 1280x720;
- the same fonts and layout engine used on physical receivers;
- the same dynamic object allocation and hard containment behavior.

## Scheduled automation editor

The Display Text action includes the same embedded receiver preview. Automation variables remain visible as typed in the draft; they are resolved only when the scheduled automation runs.

Editing the preview does not save or enable the automation.

## Preview message boundary

The receiver accepts `roomgoblin.preview.state` only when all of these are true:

1. the receiver is running with `preview=1`;
2. the message origin exactly equals the receiver origin;
3. the sender is `window.parent`;
4. the message includes a draft state object.

Normal physical receivers do not install the preview message handler.

## Rich text policy

Do not send arbitrary operator-authored HTML directly to classroom receivers. That would add a new XSS/sanitization boundary and could make preview behavior differ from the display protocol.

If richer formatting is added later, prefer a structured, bounded formatting model (for example bold/italic/emphasis spans, lists, alignment, and safe colors) or a strict sanitization allowlist. The dynamic receiver layout engine remains the final sizing/containment authority.

## Verification

Regression coverage must verify that:

- the preview uses the actual receiver page;
- draft messages are same-origin and parent-only;
- editing a draft does not call the physical display command API;
- the receiver still rejects draft messages outside preview mode;
- the same layout revision is used by preview and physical receivers;
- the NOCTI fixture and dense-content fixtures remain contained.
