# Android screenshot preview lifetime

[Finding classification and immutable source locations](finding-metadata.md#android-preview-ownership).

RG-LAB-027 reproduces three failures on the reviewed source: no preview/progress
while capture is pending, a late capture reopening a closed dialog, and an older
capture replacing the newest requested image. The normal capture/close control
case passes on both versions.

The preview now opens immediately, owns its capture/decode result, and discards
late replies after Close, Escape or a newer request. It clears image bytes on
close, decodes an allowlisted bitmap before display, enforces the existing
16 MiB capture response ceiling, and shows current errors in the dialog.
Focus returns to the current Screenshot control or display search. Server-side
ADB capture is not cancelled or automatically repeated.

Ten focused cases pass, including close during decode, invalid/oversized images,
decode failure, late errors after Escape and a superseded decoder. All 29 related
Android enrollment/editor/preview cases pass. Combined Linux qualification passes
2,280 tests with zero failures and two root-only skips, all 23 Host Recovery
cases and syntax/controller/shell checks. The first browser fixture failed to
open the device-controls disclosure; normal UI setup corrected it, and both
focused cases passed. All 113 workspace cases passed in Chromium and Firefox.
Visual inspection then removed the empty image placeholder during capture;
the final CSS and image visibility assertions also pass all 113 workspace cases
in each browser, and the final mobile preview was inspected. No physical display
capture was requested.
