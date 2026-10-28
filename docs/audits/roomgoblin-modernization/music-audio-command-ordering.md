# Music audio command acknowledgment ordering

Baseline: `0f49310cfd4aa1a87f933f367d785987b0793e02`. Three actual-handler
reproductions fail: reverse volume acknowledgments, reverse mute acknowledgments
and a successful old-connection command persisting after replacement.

## RG-MUSIC-016: Late audio acknowledgments overwrote newer saved settings

The generic Music Assistant command handler awaited upstream delivery and then
saved TV audio without retaining request order or connection identity. An older
response could overwrite a newer acknowledged setting. A replaced connection
could also trigger priority compensation against the replacement. This is P1.

Retain a per-receiver/per-field sequence only while accepted handlers are active.
Commit acknowledgments in request order: an older success cannot replace a newer
successful acknowledgment; a newer failed request does not discard an older
confirmed value. Volume, mute and distinct receivers remain independent.
Remove temporary ownership when the final handler settles, including errors.

Capture the connection generation and recheck it before priority compensation,
after awaited compensation and on error. Retired requests require refresh and
cannot save audio or claim current success. Revalidate enabled receiver identity
before persistence. Keep the fixed command allowlist, quotas, authentication,
Background Music controls, uncertainty handling and returned writer promises.

## Qualification and delivery boundary

All 17 new real-handler cases and all 90 expanded music checks pass. The tests
use the actual audio preference helpers and command handler, covering reverse
completion, newer failure, independent fields/receivers, connection retirement,
priority compensation/admission, removal, persistence errors, owner cleanup,
unknown commands and uncertain failures without replay. The existing real-HTTP
priority fixture now supplies the current connection generation and asserts that
blocked commands release no claimed audio owner; its original assertions remain.

The supported Linux active-worktree suite passes 1,630 tests, zero failures and
two root-only ownership skips, plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Checked PR, exact images and backed-up
appliance delivery remain pending. No physical commands or production settings changes were used.
This is scoped to command acknowledgment persistence; the broader modernization
and separate bridge-attachment review remain active.
