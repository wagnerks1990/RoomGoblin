# Interrupted operational restore: media preservation

The 2026-11-02 acceptance phase extends PR #349's real SQLite restore drills.
At baseline `3359c0d`, startup rollback always called `replaceRestoreContent`
with `preserveMedia:false`. Current operational safety archives deliberately
exclude `data/media`, so directory synchronization deleted the live media tree
after an interrupted restore. Older safety archives containing media did recover
their snapshot correctly.

## Reproduction and repair

The regression starts the actual maintenance HTTP service against an isolated
real SQLite database, stores synthetic encrypted values, and creates a normal
operational archive. It then changes the database and presentation/media assets,
starts a restore, and holds the application-readiness response after database
replacement. SIGKILL interrupts that maintenance process while its real durable
restore journal and safety archive remain on disk. A fresh maintenance process
must recover those files before accepting HTTP requests.

Both configuration-only and configuration/data interruption cases lost excluded
media on the baseline. The initial focused run recorded 25 passes and four
failures, including the parent subtest result and the retry-after-corruption
case. Archived legacy-media cases passed. No production restore or process
interruption was used to reproduce the defect.

Startup rollback now preserves live media when the extracted safety archive has
no media directory. An older archive that includes the directory retains its
existing complete media rollback behavior. Database validation, application
readiness, journal durability, master-key identity and host-owned ADB protection
are unchanged. No schema, archive format, dependency or permission changes are
required.

The added cases verify real database/settings and encrypted-value recovery,
unchanged master key, presentation recovery, excluded-media preservation,
legacy-media replacement, retained safety archives and journal removal only on
success. A corrupted safety database prevents startup and retains the journal;
repairing only that isolated archive permits a later restart to recover.

After the repair, the active-worktree native Linux run passed all 29 focused
maintenance recovery cases and all 23 native Host Agent recovery cases, with
zero failures or skips. The same run passed `npm run check`; the final PR receipt
records full-suite, CI and deployment results.

## Evidence limits

Docker and Host Agent operations use the existing fixture adapters; this is
process-interruption acceptance, not a replacement-host disaster-recovery drill.
The associated PR records the exact passing checks and deployment receipt.

Read-only live checks on 2026-11-02 found healthy core services and a working
authenticated Apple Music catalog search. The selected hallway music player
remained unavailable; another output had active playback and the available TV
had an existing queue. Those were preserved. Browser control was unavailable in
this session. Audible playback, announcement priority/reconciliation and physical
device acceptance remain open rather than inferred from these recovery tests.
