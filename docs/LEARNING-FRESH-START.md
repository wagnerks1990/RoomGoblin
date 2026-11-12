# Learning fresh start

`/learn` is the only operator workspace. Retired teacher/platform, standalone
student discussion, companion and launcher pages return 404, without redirects.
Students use their LMS-hosted direct API packages.

## Scope

`tools/reset-learning.cjs` is an explicit offline operator tool, never a startup
migration, HTTP endpoint or automatic update step. Preview is read-only. Apply
requires explicit confirmation and an offline-operation marker.

It clears all `learning_*` records: classes, memberships, assignments, posts,
reviews, progress, submissions, grades, AI jobs, live sessions, recipes, campaigns,
resume state, signed bindings/nonces, presence proofs and class mappings. It also
removes restricted `learning-student` accounts/sessions, old enrollment/LTI secrets
and obsolete learning preferences, including automatic imports and app shortcuts.

It retains normal administrator/teacher accounts, built-in profiles, unrelated
RoomGoblin tables/settings/secrets, media, physical devices, AV mappings, room
schedules, integrations and trust identities. Working `learning.ai`, API/network
settings, public-route ownership/rollback metadata and local/cloud service keys
remain. Legacy embedded-frame and summary opt-ins reset off. No physical command
is dispatched. External references cause a refusal and transaction rollback,
rather than cascading into unrelated data.

## Offline procedure

1. Obtain explicit reset authorization and arrange its brief Hub interruption.
   Record a read-only inventory. Use authoritative `DATABASE_FILE`, never another
   filename selected by existence.
2. Create a native operational backup, verify its checksum and record the original
   running state and matching master-key identity for rollback.
3. Acquire `/run/classroom-control-hub-appliance-mutation.lock` exclusively so
   updates and Full Recovery cannot overlap. Stop the Hub cleanly and verify it
   is stopped. Leave unrelated integrations running.
4. With the Hub stopped, make a private SQLite `.backup` snapshot of the active
   database. Verify SHA-256 and `PRAGMA quick_check`; retain it with the operational
   backup. Preserve database ownership and shared modes.
5. Run the trusted published image's tool with only the canonical data mount,
   no network, no added privileges and the original application UID/GID:

   ```text
   node /app/tools/reset-learning.cjs --database <DATABASE_FILE>
   ROOMGOBLIN_LEARNING_RESET_OFFLINE=1 node /app/tools/reset-learning.cjs --database <DATABASE_FILE> --apply --confirm RESET_LEARNING_DATA
   ```

   The marker records intent; it does not stop the Hub or prove it is offline.
   The host procedure must verify that independently. Never apply in a live Hub
   with accepted writers or background grading.
6. Verify zero learning records/learners, foreign-key integrity and retained
   unrelated state/connections. Restore the original Hub running state, require
   healthy services and check `/learn`, its empty catalogs and protected student
   routing. Release the lock. Automatic import remains off until reconfigured.

Deletes commit in one transaction; SQL/validation failures roll back. Schema and
compatibility identifiers remain unchanged. The reset does not delete archived
backups, which intentionally retain old data for recovery. Withdraw old uploaded
LMS packages before publishing new ones; deleted keys cannot access new records.

## Rollback

Keep the Hub stopped. Verify snapshot checksum/integrity, then restore it through
SQLite's backup API into the canonical active database. Do not independently copy
live DB/WAL/SHM files or replace the master key. Preserve ownership/modes; require
quick-check, foreign-key, prior-count and secret-decryption verification before
restarting. Source/image rollback uses the native updater's recovery transaction.
