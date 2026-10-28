# Android shell and diagnostic output ownership

[Finding classification and immutable source locations](finding-metadata.md#android-shell-ownership).

RG-LAB-030 reproduces four failures: duplicate shell dispatch to one display,
late success/failure mixed into a newer command result, and shell admission while
the selected display has a pending card command. Normal stdout and unavailable
ADB admission are passing baseline controls.

Shell now shares the per-display command owner and updates Run availability when
selection, pending work or bridge health changes. Independent displays can still
operate concurrently. Typed commands remain intact. Shell and other diagnostic
writers claim a shared output generation before awaiting replies; older results
cannot replace newer output or clear its selection. A superseded success retains
a short card outcome when its pending message still owns that card. Errors remain
on their original card. No accepted server-side work is cancelled or replayed.

Nine targeted cases and all 63 related Android cases pass. The isolated enrollment
fixture was extended to load the actual shared availability helper. Three browser
scenarios pass, including mobile shell interaction, cross-display replies, late
errors and Agent v2/app-audit output ownership. Full Linux qualification passes
2,314 tests with zero failures and two root-only skips, all 23 Host Recovery
cases and syntax/controller/shell checks. All 122 workspace cases pass in each
of Chromium and Firefox. Mobile layout and retained input focus were inspected.
No shell command or physical display action reached a real device.
