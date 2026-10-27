# Announcement probe destination review

PR #293 head `4054c06433e78773b931ef88f5411b7e526ecc26` reported four
CodeQL findings. JavaScript analysis `2035724884` and check `122171652937`
were reviewed before changing the tests or classifying an alert.

## Exact destination policy

Alert #411 (`js/request-forgery`) traces the configured HLS application path
through `announcementsCoordinates`, `announcementHlsProbeUrl` and
`fetchWithDeadline` to `src/server.js:849`. Both complete SARIF paths were
examined. The destination passes the actual shared `validateAllowedTarget`
policy before the initial request and every redirect: HTTP(S), no embedded
credentials, ports 80/443 and exact membership in the server-configured host
allowlist. The operator-supplied stream URL does not extend that allowlist.
The traced application path cannot authorize another origin.

Fifteen new cases execute the real coordinate/probe helpers with the real
shared validator. They cover forged hostname prefixes/suffixes, trailing dots,
credentials, unsafe ports/protocols, unapproved loopback, canonical approved
origins, hostile path values, approved/rejected redirects and redirect limits.
All pass; the expanded policy/configuration/gateway suite passes 36 tests.
Alert #411 was classified as a false positive, and its stored dismissal and
reason were independently read back from GitHub. No scanner exclusion, rule,
workflow or destination-policy change was made.

## Structural redaction assertions

Alerts #418-420 (`js/incomplete-url-substring-sanitization`) identified URL
substring comparisons in the configuration transaction tests. These assertions
now parse the legacy JSON and require exact equality with the complete redacted
configuration. They verify the entire persisted shape, including the absence
of the secret field, while the secret-store assertions still verify the URL.

## Qualification

The supported native Linux active-worktree snapshot passes 1,354 tests, zero
failures and two root-only ownership skips (1,356 total), plus all 23 Host
Recovery tests and Node/controller/Python/Bash checks. Fresh required CI on
the updated PR remains mandatory. Docker/image/platform/browser gates remain
owned by CI; no production probe, stream or receiver command was used here.
