# Announcement configuration transaction

Baseline: `1f6f60daee73e76fd5acc8599935ad0f41663cd7`, the qualified monitor
patch integrated with Planning preview changes. Persistence is unchanged from
checked main `955195a`.

## RG-ANN-004: Failed saves changed live settings and split durable identity

| Field | Assessment |
| --- | --- |
| Subsystem / category | Morning Announcements / Durable configuration |
| Priority / confidence | P1 / Reproduced with actual handler and SQLite storage |
| Baseline locations | `src/server.js:735-748,5503-5510` |
| Complexity / compatibility risk | Small / Existing preference and secret identities |
| Expected benefit | Preserve the previous stream and configuration on failed saves |
| State | Implemented; native qualification passed |

The handler replaced active settings before persistence. It then wrote the
encrypted URL and redacted metadata separately. A later write failure returned
an error while the watcher could read unsaved settings and SQLite could retain
a new URL alongside old configuration. Explicit URL deletion had the same gap.

The normalized candidate now commits its secret and metadata in one SQLite
transaction before becoming the active configuration. A legacy scrub failure
rolls back database changes. Scrubbing uses an exclusive mode-0600 staging file
and removes owned staging remnants on failure. Startup migration retains the
same redaction behavior. No preference names, schema, authorization, URL policy
or receiver commands change.

SQLite remains authoritative. If its final commit fails after a legacy-file
rename, the migration remnant can remain redacted with newer metadata; the
database and live configuration still retain their previous identity. This is
not a cross-filesystem atomic transaction. Live volume application remains a
separate operation after the durable save.

## Evidence and delivery boundary

The 14-case regression passes three controls and fails 11 cases on the exact
baseline. All 14 pass with the fix, alongside all 20 monitor-ownership cases.
Coverage includes failures before/after secret and metadata writes, legacy open,
write and rename errors, actual SQLite COMMIT rejection, explicit deletion,
retry, successful projection ordering, startup redaction and Linux file mode.

A Windows full-server attempt passed the 34 isolated cases but could not start
the six existing secret-projection integration cases because native Windows
rejected Linux directory `fchmod`. The supported native active-worktree run
passes 1,322 tests, zero failures and two root-only ownership skips (1,324 total),
including the six full-server secret-projection cases. All 23 Host Recovery
tests and Node/controller/Python/Bash checks also pass. No test or security
control was relaxed. Required CI, checked integration, exact image publication
and backed-up delivery remain pending.
No production fault, stream, receiver or music session was exercised.
