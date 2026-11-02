# Android card command ownership

[Finding classification and immutable source locations](finding-metadata.md#android-command-ownership).

RG-LAB-029 reproduces two duplicate-dispatch cases: a redrawn display card can
send the same or another command while its first command is pending. Independent
display operations and explicit retry after failure are passing baseline controls.

A shared per-display owner now spans ADB, Agent v2, installation, lifecycle and
Device Admin card controls. Redrawn buttons inherit pending state; capability
updates cannot unlock them. Releasing an old owner cannot unlock a successor or
erase a newer message. Capability-disabled controls remain disabled after release.
Failures remain on the originating card. Existing legacy APK replacement and
on-device Device Administrator confirmations remain intact; pending duplicate
events cannot repeat the confirmation. Server-side work is not cancelled.

Nine targeted cases and all 54 related Android cases pass. The isolated preview
fixture was extended to load the actual shared helpers before those passing
runs. Three real-browser scenarios pass, covering ADB/Agent v2 cross-control
admission, independent displays, redraws, capability restrictions, Device Admin
failure/retry and legacy installation confirmation. Full Linux qualification
passes 2,305 tests with zero failures and two root-only skips, all 23 Host Recovery
cases and syntax/controller/shell checks. All 119 workspace cases pass in each
of Chromium and Firefox. No real display command, install or enrollment was
performed.

The held-route readiness repair from PR #328 is included, and the new command
fixtures use the same bounded readiness check. Both final browser suites again
pass all 119 workspace cases; application code is unchanged from Linux
qualification. The PR #327 verified delivery receipt accompanies this batch.
