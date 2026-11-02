# Media-card dispatch and library refresh ownership

[Finding classification and immutable source locations](finding-metadata.md#media-library-controller).

Baseline: PR #308 head `d9f0aeb85472f6d3cc5d6ed28c50d8d05eeb979e`.

## RG-MEDIA-008: Document cards used image dispatch

Actual Display content card callbacks reproduced PDF, Word and presentation
files being sent as images. Cards now use the canonical media-library route,
which resolves the PDF viewer or converted document and reports conversion
readiness. The route preserves arrays of selected receivers; the common command
validator still owns limits, target validation and Morning Announcements locks.
Image/video options retain fit, opacity, local-direct selection and explicit
autoplay, loop and mute values. Omitted video autoplay still defaults to true.
Selection alone never dispatches and video cards remain decoder-free.

## RG-MEDIA-010: Older refreshes overwrote the latest library

Actual-source regressions reproduced old results replacing new files in both
controller views and an old failure replacing a successful main-library read.
The main library, scheduler load and automation pickers now share one request
owner. Older callers follow the newest read; only that read publishes the cache.
Slow unrelated schedule dependencies cannot publish an older media snapshot.
Each view retains its own render owner, including current error presentation.
Explicit automation refresh bypasses the populated cache and reports failures.
The Display content grid uses the same latest-view rule without changing a
selected manual URL when refreshing.

## Validation

Twenty-six new Node regressions pass alongside all 15 existing manual-content
replacement cases. The supported Linux snapshot passes 1,797 tests, zero failures
and two root-only skips (1,799 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. All 72 workspace cases pass in each of
Chromium and Firefox, including two new document-card and stale/error cases.
The first browser launch found no tests due to its Windows/WSL handoff; the next
run exposed an incorrect test interception (71 passes, one error). The fixture
now intercepts fetch used by the module; the full passing runs retain all checks.
Required GitHub checks and delivery remain pending. PR #308's multipart cleanup
security repair is separate from this qualified controller snapshot.

Final integration review also covers the legacy empty-target fallback using the
actual receiver resolver: omitted/empty values still select only `tv1`, while
an empty target array fails before dispatch. With this additional regression and
the cancellation outcome changes, the final Linux snapshot passes 1,819 tests,
zero failures and two root-only skips (1,821 total), plus all 23 Host Recovery
tests and Node/controller/Python/Bash checks. All 73 workspace cases pass in
Chromium and Firefox. Required GitHub delivery remains pending.
No production receiver commands or playback experiments are part of this check.
Completed-upload cancellation feedback and the presentation review remain open.
