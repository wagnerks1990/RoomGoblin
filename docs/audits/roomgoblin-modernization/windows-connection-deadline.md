# Native Windows connection deadline

RG-LAB-011 reproduces a stalled primary WebSocket handshake preventing the
configured fallback after an 18-second observation. The actual connection owner
had only the service stopping token, so it could remain pending indefinitely.

Each configured origin now gets a linked 15-second attempt budget. A timeout
disposes that socket and advances to the next configured origin. Service
cancellation preserves the original token and stops fallback; already-cancelled
requests open no socket. Healthy primary preference and final error reporting
remain intact. No origin, HTTP opt-in, certificate validation, credential, frame
limit, heartbeat or reconnect-backoff policy changed.

Five actual-source loopback cases cover primary success, the real 15-second
timeout/fallback, cancellation, pre-cancelled admission and all-origin rejection.
The fixture uses an HTTP upgrade handshake without enrollment or telemetry; it
does not claim TLS trust, live Hub acceptance or workstation service validation.
All five cases pass locally on .NET 10 with zero build warnings/errors. Supported
Linux qualification passes 2,169 tests, zero failures and two root-only skips
(2,171 total), all 23 Host Recovery tests and syntax/controller checks. Browser
sources are unchanged from qualified `32416c9`. The repair joins PR #320;
fresh required .NET 8 CI and exact publication precede delivery.
