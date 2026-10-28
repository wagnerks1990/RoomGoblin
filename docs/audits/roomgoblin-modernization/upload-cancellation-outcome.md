# Completed upload cancellation feedback

[Finding classification and immutable source locations](finding-metadata.md#upload-cancellation-outcome).

## RG-MEDIA-009

An actual cancellation-handler reproduction returned no completion outcome
when the upload had already registered a library item. The controllers then
reported cancellation even though that saved file remained.

Cancellation still waits for its accepted session owner and removes only the
session. It returns private metadata internally, then checks saved library
identity under the file owner after releasing the session owner. The API returns
only public file information when session, digest and size match a present item.
Missing files report incomplete cancellation; conflicting identity or size
reports an unknown outcome without exposing another item. A deletion marker
alone cannot hide a retained file after a failed deletion.

The browser preserves failures for retry. A missing receipt/local identity
reports an unknown outcome; a saved file reports that it remains in the library.
Both controllers refresh that library while retaining manual selection and
their operation-generation guards. Cancellation has an independent fixed
30-per-minute accepted-caller budget, so an exhausted completion budget does
not prevent it. Rejected callers cannot consume the quota.

Twenty new regressions cover server/store outcomes, conversion and deletion
races, private identity, client retry/unknown results, both controller messages
and real HTTP quota/authorization. One browser test covers both controller flows.
The initial focused Linux run passed 138 cases, with one new assertion failure
and two root-only skips. That assertion expected 403 for another owner's session;
the established privacy contract intentionally returns 404. The expectation was
corrected without changing authorization. The final combined Linux snapshot
passes 1,819 tests, zero failures and two root-only skips (1,821 total), plus all
23 Host Recovery tests and Node/controller/Python/Bash checks. All 73 workspace
cases pass in Chromium and Firefox. The initial Chromium run passed 72 cases
and hit one fixture error because it tried to fill an input inside a closed
disclosure; the fixture now opens that disclosure, and its focused and full
reruns pass. No application behavior was changed to accommodate that fixture.
Checked delivery remains pending. This does not exercise physical receivers or
claim cancellation reverses completed uploads.
