# Android management port admission

RG-LAB-039 reproduces four failures: Agent configuration accepts a port below
1024, silently clamps an excessive port, truncates a fractional port, and
persistent-ADB bootstrap accepts a target below the Android receiver's range.
The valid-port control passes. Saving a different endpoint from the one applied
on the device can leave subsequent management requests targeting the wrong port.

The shared management-port validator accepts only whole numbers in 1024-65535.
Agent configuration, outbound Agent requests and persistent bootstrap reject
unsupported ports before remote work. Bootstrap validates both its direct helper
and HTTP entrypoint, and the HTTP response, broadcast and saved endpoint agree.
Explicit zero is rejected; omitted values keep the established defaults.

General ADB endpoints and existing inventory normalization remain unchanged.
Inactive legacy persistent targets do not block Agent configuration, and the
disable path remains available. Active invalid settings require an explicit
corrected configuration; no device is automatically migrated or reconfigured.

All 29 port cases and 38 configuration/record cases pass against actual handlers
and helpers with remote operations substituted. Four failures were reproduced
before repair. Two initial new route assertions were corrected to capture
res.json rather than expecting an HTTP handler return value. The first full run
passed 2,426 tests with two skips and found one static transport assertion still
requiring the old port helper. It now checks the same private HTTP endpoint with
the strict validator; a runtime request test also verifies that endpoint.
Final supported Linux qualification passes 2,428 tests with zero failures and
two root-only skips, all 23 Host Recovery cases, four socket and seven activity
JVM cases, and syntax/controller/shell checks. All 73 targeted port, ownership,
record and endpoint-policy cases pass. Browser sources retain their 126-case-per-
engine qualification; no physical port change or credential rotation was tested.
