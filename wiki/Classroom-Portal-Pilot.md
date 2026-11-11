# RoomGoblin Classroom Portal v9 pilot

Source and deployment guide: [independent classroom portal](../experiments/classroom-portal-v9/README.md).
Architecture and release boundary: [pilot operations](../docs/CLASSROOM-PORTAL-PILOT.md).

This is a standalone synthetic experiment, not the native Hub, signed LMS identity bridge, or hardware-control system. It implements a class/assignment builder, scoped commands, teacher rubric reviews, discussion moderation, generated API-independent SCORM packages and aggregate browser displays.

The separate v9 database preserves the original v6/v8 database as read-only legacy history. The installer preserves the existing portal service identity, port, administrator token and private listener. It takes SQLite-safe backups and supports code/config rollback without deleting records. Existing `/api/` traffic is not rerouted.

Generated packages embed only a seven-day, revocable, assignment-specific test capability. They do not prove real student identity and cannot call teacher endpoints. Academic grades are not written to Schoology, and automated correctness grading is not implemented. No live deployment or student use is implied by local tests. See the source validation record for actual checks and remaining acceptance requirements.
