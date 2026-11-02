# Workspace held-response fixture readiness

[Finding classification and immutable source locations](finding-metadata.md#workspace-route-fixtures).

PR #330 passed all 14 checks before merge. Its main Firefox run failed when the
Android screenshot test received a request event before the route callback had
appended the held response. The first `pending[-1]` access raised `IndexError`;
two later errors followed because that request remained unanswered. Publication
stopped at the required browser gate. The application failed no assertion.

All remaining indexed held responses in the workspace suite now use the existing
five-second, monotonic readiness helper. The screenshot error loop uses explicit
response indexes. The helper waits for the route callback while servicing browser
events; it does not retry application requests. Assertions, intentional response
ordering, focus checks and required gates remain intact.

Twenty repetitions of the screenshot error scenario pass in Firefox (17.328 s).
The full workspace suite passes all 125 cases in Chromium (136.043 s) and
Firefox (178.390 s). The unchanged main commit's failed-job-only Firefox retry
passed; its exact image publication remains required before deployment.
