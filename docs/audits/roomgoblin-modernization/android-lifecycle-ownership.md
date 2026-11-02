# Android enrollment lifecycle outcomes

[Finding classification and immutable source locations](finding-metadata.md#android-lifecycle-ownership).

RG-LAB-031 reproduces four failures: confirmed removal leaves the inventory
record available for redraw, enable and disable reload the page and discard
drafts, and an incomplete successful HTTP reply removes the visible card.
The rejected-request inventory/admission control already passes.

Lifecycle replies must confirm the requested action and display identity before
changing local inventory. Removal retires older inventory/probe generations;
enable/disable update only the confirmed flag on the current record, preserving
newer metadata. The page stays open. An editor for a removed display retains its
draft with a visible explanation and disabled Save; another editor is untouched.
Existing removal/disable confirmations and per-display admission remain intact.
Incomplete replies report an unconfirmed outcome and never retry automatically.

All 23 focused lifecycle/editor cases pass. Three browser scenarios (five
subcases) cover stale inventory, same/other-device drafts, enable/disable,
unconfirmed removal and explicit retry. The first browser run exposed completion
focus landing on the body after disabling the origin button; completion now
returns to the surviving Edit button or inventory search only when focus has no
new owner. The rerun passes. All 77 related Android cases pass. Supported Linux
qualification passes 2,328 tests with zero failures and two root-only skips,
all 23 Host Recovery cases and syntax/controller/shell checks. All 125 workspace
cases pass in both Chromium and Firefox. The mobile draft/focus evidence was
inspected. No real enrollment or physical device was changed.
