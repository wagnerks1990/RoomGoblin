# Ubuntu screen configuration owns only its configuration fields

RG-LAB-018 reproduces screen configuration restoring a maintenance schedule that
was cancelled while the remote configure request was pending. The same stale
record replacement discards the cancellation's history and newer metadata.
Three assertions fail against old source; three failure/concurrency controls pass.

Successful configuration now merges only config into the current persisted record.
It preserves the latest schedule, history, health/reporting and identity fields.
Cancellation remains available while configuration is pending. Existing per-device
ownership, identity checks, announcement checks and writer-drain tracking remain.
Remote failures and local persistence errors still fail visibly; writes are never
automatically replayed, and overlapping configuration remains rejected.

Six focused actual-module cases pass for cancellation, history, metadata,
uncertain delivery, persistence failure and overlap. Supported Linux validation
passes 2,175 tests with zero failures and two root-only skips, all 23 Host Recovery
cases and syntax/controller/shell checks. Browser/native sources remain unchanged
from their preceding qualification. Required CI, checked merge, exact publication
and backed-up appliance verification precede delivery. No SSH
request or command reached a real display. Post-dispatch per-computer history
failure handling and frontend refresh/dialog ownership remain under review.
