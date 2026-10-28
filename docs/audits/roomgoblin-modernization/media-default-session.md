# Default video session identity

Baseline: `73d5f7433972da1100e62a008910d0040a41d59a`.

## RG-MEDIA-004: Video commands could lack reconnect identity

An actual normalize/validate reproduction fails: a valid video command without
an explicit session ID leaves the payload without one. The receiver cannot use
its same-session replay path, so reconnect may replace that video even when its
content is unchanged. This is P1 for the default command path's continuity.

Use the normalized command ID when a video payload has no usable session ID.
The outgoing command and saved replay then share that identity. Preserve caller
and automation IDs; each new command retains its own default identity. Other
content kinds, selected targets, clip options and legacy video strings are
unchanged. Do not migrate stored receiver state or rewrite old compatibility IDs.
An old saved video without an ID gains this behavior only after a new command.

## Qualification and delivery boundary

All eight new actual-source cases and 36 expanded media checks pass. Coverage
includes persistence, explicit IDs, distinct commands, repeated command identity,
empty defaults, other content, caller-input preservation and legacy compatibility.
The supported Linux snapshot passes 1,674 tests, zero failures and two root-only
skips (1,676 total), plus all 23 Host Recovery tests and Node/controller/Python/Bash
checks. Checked delivery remains pending. No physical receiver commands, reloads
or production fault injection were performed.
