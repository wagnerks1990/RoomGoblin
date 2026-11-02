# Android shell and lifecycle delivery

PR #330 merged as `92adafe1c610050f5ffd6465ed7f3a94136a30e7` after all 14
required checks passed. Main Validate and Security gates passed. Main Firefox
exposed a held-route fixture readiness race; its failed-job-only retry passed,
followed by exact Hub and maintenance image publication. The permanent fixture
repair is in PR #331 and passes 20 Firefox repetitions plus all 125 workspace
cases per browser.

The normal updater completed at `2026-10-28T15:32:04.184079+00:00`. Its reviewed
plan replaced only the Hub. The maintenance container retained its identity,
start time and reviewed `7acaa7a` source revision. Both containers are healthy
with zero restarts. Main is clean and the post-update selective plan is empty.

Verification passed control/media health, maintenance and Host Agent health,
database quick-check, decryption of all eight encrypted secret rows, shared
database modes, ADB identity-directory mode, internal/admin authorization
boundaries, all 22 served assets and the four native Windows artifact hashes.
Runtime version remains `1.0.0-alpha.85`; Hub source identity matches the merged
commit exactly.

The operational backup is
`auto-operational-2026-10-28T15-31-50-422Z.zip` (129,188,211 bytes, mode 0600),
SHA-256 `a348222cfda53c9999c35a89abc48b76c969aba25cd00e59c74ae218b775ed36`.
Archive CRC, canonical database scope and extracted SQLite quick-check pass.
Rollback source `039a1fc3506cb0f60f2b31e9a45369005cb88ebb` remains available;
rollback was not exercised. No physical display command or workstation
installation was performed.
