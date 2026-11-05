# Classroom portal changelog

## 9.0.0-pilot.1

- New isolated v9 database and read-only legacy viewer preserve the working v6/v8 records.
- Added classes/periods, assignment and rubric editor, duplication, locked definitions after export, and per-participant SCORM 1.2 generation.
- Added scoped expiring commands, feedback publication, threaded posts, ancestor-aware moderation, grant revocation, aggregate classroom display, CSV export and audit.
- Removed teacher/shared demo credentials from generated learner packages. Added separate session/CSRF authorization and hashed expiring capabilities.
- Added transactional idempotency, conflict detection and visible durable outbox behavior. Preserved teacher form drafts instead of overwriting them during refresh.
- Added root-private SQLite-safe backups, reversible versioned service cutover and optional exact-match legacy INSERT compatibility repair.
- Retained explicit limitations: synthetic identities, no AI grading, no native Schoology API access and no gradebook passback.
