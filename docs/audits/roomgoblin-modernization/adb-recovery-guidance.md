# ADB recovery guidance follows the reviewed mount boundary

**Finding ID:** RG-DOC-ADB-001. **Subsystem:** Managed Displays recovery and
developer guidance. **Category:** Documentation. **Priority:** P2.
**Complexity:** Small. **Compatibility risk:** Low. **Confidence:** Confirmed.

**Audited revision:** `fab0e5f74964651006794fbad6c4c5b9875a79eb`.
**Location:** `AGENTS.md:196`, `docs/AI-CONTEXT.md:410-411`,
`docs/MANAGED-DISPLAYS-RECOVERY.md:128-152,170-191`,
`docs/DATABASE-FIRST-RECOVERY.md:500-505` and
`wiki/Managed-Displays-Recovery.md:7-15,33-46` at that immutable revision.

**Current implementation and evidence:** Compose mounts the shared named ADB
volume writable in the Hub and read-only in maintenance
(`docker-compose.yml:70,134`; the override preserves the same boundary).
`host-agent/app-update-runner.sh:119-123` checks maintenance readability.
`test/live-upgrade-permissions.test.js:69-75` and
`test/managed-displays-regression.test.js:8-15` explicitly preserve read-only
maintenance access. Final production acceptance independently confirmed both
mount modes, Hub write access as UID 10001, maintenance readability under its
configured runtime identity, 0750/0640 directory/key modes and unchanged key
digests. The Android signing certificate also matched its pre-update identity.

**Problem:** Older guidance incorrectly required a writable maintenance mount.
Its manual repair recipe also used ad hoc image builds instead of the supported
verified-image update transaction. Following it could weaken a reviewed boundary
or bypass backup and rollback protection. The first independent acceptance
script inherited the writable-maintenance assumption and correctly stopped;
inspection resolved the mismatch without changing production permissions.

**Recommendation and implementation:** State the two mount paths and access
modes explicitly in contributor, AI, recovery and Wiki guidance. Keep host-owned
permission repair and the shared trust identity. Use the normal updater for
reconciliation; use read-only access and mount checks afterward. Parenthesize the
optional-inventory shell condition so an unreadable identity directory cannot be
masked by a readable inventory file.

**Expected benefit:** Operators and future contributors can verify the actual
deployment without granting unnecessary write access or replacing trusted keys.

**Verification:** The full `fab0e5f` main validation and both 357-case browser
runs passed. Independent production acceptance passed after following the exact
Dockerfile version-stamping transformations and actual mount/runtime identities;
no server, key, mount or permission repair was needed. The changes here are
Markdown only. All 24 existing upgrade-permission, managed-display and networking
cases pass in the supported native Linux active-worktree snapshot, with zero
failures or skips; controller checks also pass. Relative-link, immutable-location,
history-preservation and runtime-parity checks pass. Checked merge and the ordinary
source synchronization path remain separate delivery gates. No physical ADB command or playback
test is part of this verification. The current delivery record is linked from
the [audit index](README.md).
