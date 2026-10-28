# Sports source refresh and undo ownership

[Finding classification and immutable source locations](finding-metadata.md#sports-refresh-ownership).

RG-SPORTS-003 reproduces three browser failures: a delayed source refresh or Undo
replaces newer draft edits, and a pending refresh allows overlapping writes.
An unchanged-draft Undo control already passes.

Save, source refresh and Undo now share one pending-operation guard across tab
redraws. Reload and scene generation cannot race that write. Successful refresh
and Undo responses replace only their unchanged originating draft. Newer edits
retain their original revision so a subsequent checked save cannot silently
overwrite server changes. The notice explains the need to reconcile. Failures
preserve the draft and release retry. Successful unchanged requests still update
source health and invalidate the preview cache.

The four regression/control cases and all 15 existing Sports browser cases pass
in Chromium and Firefox. The supported Linux snapshot passes 2,438 tests with
zero failures, two expected root-only skips, all 23 Host Recovery cases and all
55 JVM cases, plus syntax/controller/shell checks. Fixtures issue no physical
commands. Import review ownership and remaining Sports review
continue separately.
