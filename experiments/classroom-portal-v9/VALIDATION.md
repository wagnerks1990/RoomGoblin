# Delivered validation — 9.0.0-pilot.1

## Executed locally

- **35 Python tests passed.** 26 API/data/security tests plus nine deployment-helper/cutover tests. Synthetic local databases only.
- HTTP tests exercised real localhost requests for session/CSRF authorization, exact CORS, scoped access, package export, duplicate/concurrent events, atomic batch rejection, submission ownership, review publication and conflict checks, scoped commands, expiration, discussion moderation, revocation, display minimization, deadlines, CSV safety, database reopen and legacy read-only access.
- Deployment tests exercised atomic files, SQLite/WAL backup, environment parsing, required package files, the exact v6 INSERT compatibility correction, code/config cutover and rollback under **mocked systemd and health checks**. They do not certify an actual Ubuntu service installation.
- `node --check` passed for portal, display and generated learner JavaScript.
- `bash -n` passed for local and remote installers; Python compilation passed.
- SCORM export smoke: ZIP integrity and XML parsing passed; generated packages include local HTML/JS/CSS/config and no teacher token.
- Offline Chromium DOM suite passed: sign-in UI, course creation, prompt/rubric editor, dirty-draft preservation, rubric publication UI, scoped-command request, learner queue/retry behavior, fail-open simulated pause, no academic score writes in preview, and responsive layouts at **320, 390, 768 and 1440 pixels**. No JavaScript exceptions. Browser transport and LMS were mocked in this suite.
- Rendered desktop and phone screenshots were inspected. A mobile navigation overflow was corrected and re-tested.
- Source/package scan excluded exposed legacy demo credentials, real deployment hostnames, runtime databases, .env files, private keys, and Python bytecode.

## Not passed or not executed

- Real-network Chromium integration test was attempted but the authoring environment's managed URL-block policy rejected localhost navigation. The policy was not altered. This is an environment-blocked test, not a claim of browser transport success for v9.
- V9 has not been installed on the user's Ubuntu server.
- V9 exports have not been imported into a live Schoology teacher or student session.
- No Safari/iPhone v9 run, real Internet outage, device shutdown, full power-loss recovery, or real student authentication was tested.
- Full RoomGoblin core builds, Docker image tests, native-device tests and repository-wide CI were not executed locally for this independent Python experiment. No core runtime files were changed.
- No gradebook passback, AI correctness grading, SSO or production privacy/security certification is claimed.

The successful v6/v8 live tests documented by the user establish the prior connection path, not automatic acceptance of this new implementation.
