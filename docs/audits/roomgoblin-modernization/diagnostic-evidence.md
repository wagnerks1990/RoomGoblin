# Diagnostic evidence and secret projection

The diagnostics review reproduces eight snapshot failures: unconfigured or
unobserved hardware reported success; old Govee publish evidence survived MQTT
disconnection; configuration changes could leave a stale configured flag; and
endpoint query credentials escaped redaction through configuration and Veyon
service/error fields. Four Chromium cases independently reproduce misleading
summary and detail labels, including Veyon reachability presented simply as OK.

Snapshots now distinguish not-configured, not-observed, observed, error and
disconnected states. Observations retain their timestamp and verification scope.
The UI distinguishes a response, MQTT publication and WebAPI reachability from
device acknowledgment or authenticated control. Unknown states remain neutral.
Configuration and Veyon service/error fields use the existing bounded redactor.

Four additional failures reproduce late Pluto responses/errors, late Govee
publication and old evidence surviving accepted settings changes. Requests now
update the observation object they started with; accepted settings replace those
objects with unchecked state after the database transaction commits. Pending
commands are not replayed, and transport/scan budgets remain unchanged.

All 46 focused snapshot, settings, Pluto, Veyon and secret-projection cases pass.
All 130 workspace/diagnostic cases pass in each of Chromium and Firefox. The
supported Linux snapshot passes 2,521 tests, zero failures and two root-only
skips (2,523 total), all 23 Host Recovery and all 55 Android JVM cases, plus
Node/controller/Python/Bash checks. Checked delivery and later roadmap review remain open.
No production credentials, hardware commands or service configuration were used
for these failure injections.

Integration on receiver main `3bdc179` passes all 60 focused diagnostic, settings,
Pluto, Veyon and secret-projection cases. The shared development snapshot including
the independent retention, publication and request-deadline work passes 2,572
Node cases, zero failures and two root-only skips, all 23 Host Recovery and
55 Android JVM cases. Those independent batches are not part of this diagnostics
PR. Its exact-head CI and backed-up delivery remain pending.
