# Windows enrollment request ownership

[Finding classification and immutable source locations](finding-metadata.md#windows-enrollment-ownership).

Baseline: qualified native cancellation repair `51ef31b`.

RG-LAB-008 reproduced four actual-source failures: concurrent issuance, a prior
raw package remaining during new issuance, authentication changes retaining that
package, and a late response refilling a logged-out view. The controller now
admits one pending request, captures its input and owns the result by its
authentication/request generation. New attempts clear old packages; auth changes
clear content and invalidate old download handlers and replies. Current errors
release admission for explicit retry without replay. Newer form drafts remain.

All 16 new Node regressions and 21 focused cases pass. Two Chromium cases verify
pending admission/new drafts and cleared content/download handlers across auth
changes. Existing schema, canonical server ID, native package hashes, HTTP
acknowledgement, HTTPS/LAN fallback and legacy installer presentation remain
covered. Full qualification passes 2,165 Linux tests, zero failures and two
root-only skips (2,167 total), all 23 Host Recovery tests, syntax/controller
checks and all 96 workspace plus nine Veyon command-page cases in both Chromium
and Firefox. Required CI and delivery remain pending. All tokens and
computer identities are synthetic fixtures; no real token was issued and no
workstation enrollment or service change was performed.
