# Active announcement receiver ownership

Baseline: `af18b99a1936ab3952dcdda9af45377c61bb3376`. Five actual-function
reproductions fail against its unchanged announcement implementation.

## RG-ANN-016: Adding receivers forgot the earlier active receivers

`assertMorningAnnouncements` (`src/server.js:958`) replaced runtime targets with
the selected receivers while dispatching only to that selection. Earlier
receivers continued playing but disappeared from the global Stop/release scope,
leaving their content and mandatory audio holds behind. This is P1.

Retain the union of active and newly selected receivers. Starting an additional
receiver still sends takeover commands only to that selection. Global Stop and
automatic release account for every active receiver, including older pending
release work. Repeated selections do not duplicate ownership.

## RG-ANN-017: Partial replacement discarded the continuing active lifecycle

The start failure handler (`src/server.js:977-984`) deactivated the prior session
after a partial takeover, including when unselected receivers still played the
earlier announcement. Their content and holds could outlive the recorded
lifecycle. This is P1.

Keep prior active ownership and add receivers whose content carries the failed
attempt's command IDs. Preserve the previous mode and timestamps, but retire its
target-array/audio-retry identity when content changed. Do not replay old content.
Pending conditional cleanup waits while announcements remain active. Global Stop
or normal automatic release finishes all ownership; explicit Resume repairs all
tracked receivers. The original start error remains visible to the caller.

A fresh failed start still becomes inactive and uses the existing conditional
release retry. An entirely unchanged failed replacement still retains its exact
previous array identity. The earlier target-admission partial-failure assertion
is deliberately refined: retain active ownership, never restore stale content or
retired audio retries. This follows the existing operator clear/Resume contract.

## Qualification and delivery boundary

All 12 new actual-function cases and all 78 expanded focused checks pass. Cases
cover additional starts and global Stop, partial extension/subset failures,
pending cleanup during active playback, older pending work, invalid inputs,
deduplicated selections, fresh failure recovery, retired audio callbacks and
explicit Resume. Tests use deterministic transports without physical commands.

The supported native active-worktree suite passes 1,421 tests, zero failures and
two root-only ownership skips (1,423 total), plus all 23 Host Recovery tests and
Node/controller/Python/Bash checks. Checked integration, required CI, exact images
and backed-up appliance delivery passed as recorded below. Continuing receivers' delayed
audio retries are covered by the [content-ownership follow-up](announcement-audio-content.md).
That follow-up refines audio retirement to changed receiver content, preserving
needed retries for unchanged continuing receivers. Background Music session
reconciliation remains separate review.

## Verified combined appliance delivery

PR #300 passed all 14 checks and merged at
`336a71d6002239e77e5084a804d526e475ef9369`. All five main workflows passed
and its exact image pair published. The normal updater completed at
`2026-10-28T02:41:58.118591+00:00`, delivering PR #299's target/Live Watch
fixes together with PR #300's active-target/Music queue changes and fixture fix.

The verified selective plan replaced only the Hub. Maintenance retained its
healthy container at `20f8c501916f34e17bee2c643434e7cce0c919e6`; Host Agent was
retained. Control/media health, readiness and alpha.85 version, clean main and
an empty remaining reconciliation plan passed. Canonical SQLite integrity,
all 8 encrypted secrets, DB/WAL/SHM shared modes, ADB volume mode, maintenance
versus administrator authorization and served controller asset hashes passed.

Backup: `auto-operational-2026-10-28T02-41-44-324Z.zip`,
128,727,932 bytes, mode 0600, SHA-256
`9424c11c183ac633814eedce32e87e4ecbb6848a239e663c6b8a8613cfb1ceb1`.
Its checksum, archive CRC, operational manifest, sole canonical database
snapshot and extracted SQLite integrity passed. Previous source/images
`4a41f00afb65754a14e2d87f5855d3a35ab7d035` remain available for rollback.
Verification issued no physical classroom commands or receiver reloads,
injected no production faults and did not exercise rollback. The broader
modernization remains active.
