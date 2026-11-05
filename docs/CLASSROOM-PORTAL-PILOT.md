# RoomGoblin Classroom Portal v9 pilot

The independent synthetic classroom experiment is maintained in [`experiments/classroom-portal-v9/`](../experiments/classroom-portal-v9/README.md). Its runtime, tests, installer, security model, version and validation record are local to that directory. It is **not** the native Hub learning platform documented in `LEARNING-PLATFORM.md`, and it does not replace the signed student gateway or alter physical-device behavior.

## Implemented scope

Class/period assignment builder, per-criterion teacher review, generated SCORM 1.2 packages, scoped temporary commands, discussion moderation and teacher replies, participant-bound feedback, aggregate web displays, audit and CSV export. Existing v6 API and v8 records remain separately available; v9 reads legacy history without modifying it.

## Security boundary

Synthetic learners receive expiring, revocable assignment capabilities, not administrator/shared demo keys. These are extractable test credentials and **not verified student identity**. Teacher requests use a separate session/CSRF boundary. No gradebook passback or AI correctness grading is implemented. No real student use is approved.

## Deployment and rollback

Use only the pilot's explicit installer on an existing v8 portal host, with its configured HTTPS origin. It backs up SQLite safely, preserves the administrator token and private binding, switches only the portal service and rolls back code/configuration on health failure. Neither the RoomGoblin production updater nor its image contract installs this experiment. No NPM, firewall, Docker or DNS rewrite occurs. The optional exact-match v6 INSERT repair is separately backed up and does not restart the legacy API.

See the [README](../experiments/classroom-portal-v9/README.md), [security notes](../experiments/classroom-portal-v9/SECURITY.md), [AI context](../experiments/classroom-portal-v9/AGENTS.md), [changelog](../experiments/classroom-portal-v9/CHANGELOG.md), and [actual validation record](../experiments/classroom-portal-v9/VALIDATION.md). Local synthetic passes do not establish live Ubuntu/Schoology acceptance. Core release/CI requirements remain unchanged.
