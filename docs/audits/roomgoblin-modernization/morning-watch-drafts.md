# Live Watch drafts and write ordering

Baseline: `2f3c4bac2acc425f43db30508604e4d9b2838797`. Four tests running the
real controller in Chromium reproduce all four failures with deterministic
HTTP/WebSocket fixtures and no live classroom commands.

## RG-ANN-014: Delayed reads and saves overwrote newer Live Watch drafts

`loadMorningWatch` and `saveMorningWatch` (`public/controller/app.js:1967-1999`
on the baseline) unconditionally refilled the form. A read begun before an edit,
or the reload following an earlier save, could discard a newer time, URL or
receiver selection. This is P2.

Configuration and volume drafts now have independent revision ownership. Reads
cannot project across a write or overwrite edited fields. Save completion applies
normalized settings only to its unchanged submitted draft; newer work stays
visible as unsaved. The target choice nodes remain stable across unchanged reads,
while successful normalization still updates checkbox properties without losing
focus. Draft/save, live-volume and probe feedback have separate status elements.

## RG-ANN-015: Full saves and live volume writes could overlap

The same functions and `queueMorningWatchVolume` used independent requests to the
same PUT endpoint. A debounce did not serialize in-flight writes, and duplicate
saves could submit twice. An older volume/configuration request arriving last
could become the persisted and live value. This is P1.

One shared promise queue orders settings and volume writes. A full save owns one
pending submission and consumes its matching debounced volume. While a volume
write is pending, subsequent slider changes coalesce to the latest intent. New
edits remain usable; a pending save stays disabled even during capability refresh.
Failed operations retain drafts and allow a later explicit retry/change. Queued
writes recheck the existing `automation.manage` capability before dispatch.
Backend authorization remains authoritative; no API or persistence migration is
introduced.

## Qualification and delivery boundary

Review reproduced a normalization/focus regression in the initial implementation;
a sixteenth case covers its correction. All 16 final cases pass in Chromium and
Firefox, and all 70 broader workspace tests pass in each browser. The full native
suite was repeated after that correction: 1,409 passed, zero failed and two
root-only ownership skips (1,411 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Checked integration, required CI, exact images
and combined PR #299/#300 appliance delivery passed; see the
[receipt](announcement-active-targets.md#verified-combined-appliance-delivery). The mobile panel was visually
inspected; fields and draft feedback remain readable. Existing saved-volume and
no-player-reload checks pass.

This is the Live Watch form's draft/write boundary. It does not close multi-target
active announcement replacement, other controller surfaces, Background Music
runtime review or the remaining modernization groups.
