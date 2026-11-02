# Ubuntu wizard browser-route readiness

[Finding classification and immutable source locations](finding-metadata.md#ubuntu-wizard-route-fixture).

PR #328 passed its 14 required checks before merge. Its main Firefox run then
failed one of 289 browser cases: the wizard fingerprint test indexed the second
held route after the request event but before its route callback had appended it.
The application did not fail an assertion. This prevented image publication;
production stayed at verified PR #327.

The wizard fixture now uses the existing bounded held-route readiness helper for
both fingerprint replies and the probe request. It waits for the actual callback
condition and still checks single dispatch, newest fingerprint ownership and
retired probe handling. No request, assertion or required gate is skipped.
Twenty Firefox repetitions pass. The combined lifecycle worktree passes all 125
workspace cases in Chromium and Firefox. A failed-job-only retry is requested
for the unchanged main commit; exact publication and verification are still
required before any deployment.
