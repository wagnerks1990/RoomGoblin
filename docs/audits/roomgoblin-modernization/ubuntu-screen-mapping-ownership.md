# Confirmed Ubuntu screen mappings and uncertain targets

RG-LAB-026 adds a pre-merge review of PR #326. Pending or failed repair replaced
the last confirmed mapping before configuration was acknowledged. Five of six
repair-mapping assertions fail on the reviewed source. Four additional ordinary
assignment assertions reproduce missing new-target announcement protection,
missing durable target claims, unprotected uncertain writes after restart and
dispatch before target persistence succeeds.

Repair retains its last confirmed configuration while pending. Repair and screen
assignment save `pendingReceiverIds` before dispatch. The claim includes current,
proposed and previously uncertain targets; subsequent commands, maintenance,
schedules and repairs all honor their announcement locks. An acknowledged
configuration atomically updates the current record and clears the claim. Failed
or uncertain outcomes preserve it across manager restart and later repairs.
Health reports pending or unconfirmed configuration. Malformed target claims fail
closed for disruptive operations. No uncertain write is automatically replayed.

All eight mapping/health cases and ten configuration cases pass with the related
manager, repair and admission suites: 46 passes and one Linux-only native skip in
the Windows focused run. The new claim is compatible with records lacking it;
it cannot reconstruct screen mappings already lost in an older operation.
Native helper files, SSH identities and receiver IDs are unchanged. No physical
configuration or announcement command was sent. Full Linux qualification passes
2,261 tests with zero failures and two root-only skips, all 23 Host Recovery
cases and syntax/controller/shell checks. The browser code is unchanged from
PR #326's 109 passing workspace cases in each of Chromium and Firefox.
