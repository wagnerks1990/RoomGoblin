# RoomGoblin Classroom Portal v9

**Version: 9.0.0-pilot.1. Synthetic classroom pilot, not approved for real student records.**

A self-contained teacher portal and SCORM 1.2 package builder that works without the Schoology REST API. This is a separate experiment: it does not modify the RoomGoblin Hub, its signed LMS integration, announcements, scheduler, devices, or hardware controls.

## What is implemented

- Classes and periods; assignment creation and duplication; 1–12 editable rubric criteria and written prompts.
- One-click export of self-contained SCORM 1.2 packages with the configured API origin and a new assignment-limited synthetic participant credential.
- Draft saving, compact SCORM resume, localStorage outbox, automatic bounded retries, and exact-event receipt checking.
- Commands scoped to an assignment (which belongs to one class), optimistic concurrency, temporary pause expiry, and a 20-second client connection lease.
- Threaded synthetic discussions, teacher replies, hide/restore moderation with hidden ancestors respected.
- Criterion-by-criterion teacher review, draft versus published feedback, optimistic review concurrency, late-credit cap and teacher waiver.
- Published reviews returned only to the matching participant. No automatic academic grading and no Schoology gradebook passback.
- Counts, progress/activity history, revocable learner/display capabilities, aggregate-only classroom display, CSV export, and teacher audit records.
- Read-only v6/v8 legacy history with original events, discussions, reviews, and audit records retained.

## Install alongside the working v6 API

Requirements: Ubuntu with Python 3.10+, existing `schoology-api-test` user/data directory, the installed v8 `classroom-teacher-portal.service`, and an HTTPS reverse proxy already routing `/portal/` to that service. The default service port remains 8770. The v6 API stays on its existing port and routes.

Extract the ZIP and run, substituting the existing public API origin:

```bash
sudo bash install.sh --public-origin https://api.example.edu --repair-legacy-startup
```

The installer:
1. Validates the existing separate portal administrator token and exact allowed origins without printing secrets.
2. Runs the synthetic backend regression suite.
3. Creates root-private SQLite-safe backups, including committed WAL records.
4. Copies versioned source under `/opt/classroom-teacher-portal/v9-releases/` and checks configuration/database as the existing service user.
5. Switches only `classroom-teacher-portal.service`, verifies the versioned health endpoint, and restores the prior code/configuration automatically on cutover failure.
6. With `--repair-legacy-startup`, corrects only the exact known v6 `commands` INSERT column-list bug, preserving the old code in the backup. The API is not restarted. This prevents its additive `stage` migration from breaking a later restart.

No firewall, Docker, Nginx Proxy Manager, DNS, or certificate changes are made. The existing portal bind, port, data directory, and administrator token are preserved. The actual public origin is runtime configuration, never a source-code default. Exact learner CORS origins are inherited from the existing API environment when necessary.

### Remote source installation

`install-remote.sh` accepts a full immutable Git commit SHA and the public HTTPS origin. It downloads the repository archive and safely extracts only `experiments/classroom-portal-v9/`. It refuses branch names, traversal, symlinks, and oversized files. Use the exact published SHA in the delivery instructions, not an unverified guessed link.

### Verification

```bash
sudo systemctl status classroom-teacher-portal --no-pager -l
curl --fail --silent --show-error --max-time 10 https://api.example.edu/portal/api/v9/health
curl --fail --silent --show-error --max-time 10 https://api.example.edu/api/health
```

The first health response must identify `9.0.0-pilot.1`; the second remains the legacy v6 response. Visit `/portal/` and use the existing **portal administrator token**, not the old demo key. A new browser sign-in is expected because v9 uses an HttpOnly session cookie rather than the v8 sessionStorage token scheme.

### Rollback

```bash
sudo python3 /opt/classroom-teacher-portal/v9-current/deploy.py --rollback
```

This restores the previous portal unit and environment and the prior version pointer when applicable. It restarts only the portal, retains both databases, and does not rewind newly received records. Root-private snapshots are under `/var/backups/classroom-teacher-portal/`. A failed first installation that has not switched services leaves the running v8 service untouched. The optional v6 INSERT repair is a compatible correction and is not reverted by portal rollback; its original source copy is retained separately.

## First assignment test

1. Open Assignment builder. The starter assignment is **Compare Two Safe Storage Plans**, with the original 5/5/6/4 rubric, read-only safety instructions, and the teacher-provided comparison option described in the first prompt.
2. Add or duplicate classes and assignments as needed. Definition changes are blocked after a credential is issued, preserving the rubric used by existing packages; duplicate an assignment to revise it.
3. Select **Export SCORM**, enter a synthetic label, and download the ZIP. The URL and scoped credential are configured automatically and are not displayed in the assignment interface. Export separate packages for Synthetic A and Synthetic B; copying a ZIP copies the same test identity.
4. Upload each ZIP as SCORM material to a test course. Core instructions, rubric, responses and local submission do not require the server.
5. Submit a response, then review each rubric criterion in the portal. Publish the feedback. The matching open assignment receives the reviewed score on its next successful poll.
6. Test discussions, moderation, an assignment-scoped pause, and outage recovery. Use Progress & credentials to revoke packages. Display links show only aggregates.

A package capability expires after seven days. A revoked or expired capability cannot sync, but the local assignment remains usable. Export a new package for additional synthetic testing; work does not silently transfer to a different synthetic identity.

## Persistence and compatibility

- Legacy: `DATA_DIR/events.sqlite3`, read-only from v9. Old v6 clients continue using `/api/*` unchanged. Their old shared credential and global controls remain an explicitly unsafe legacy boundary.
- V9: `DATA_DIR/classroom-v9.sqlite3`, separate SQLite WAL database. Tables: courses, assignments, grants, commands, events, submissions, posts, audit, meta. Schema version 1, with fail-closed unknown-version handling.
- Backups use SQLite's backup API, not raw copies of a live database.
- Event identity is `(grant_id,event_id)` with canonical content digests. Changed content under a reused ID is rejected; duplicate retries acknowledge the existing event. Invalid batches roll back entirely. The HTTP success response follows transaction commit.
- Review and command versions reject stale tabs with HTTP 409. Teacher form edits are not overwritten by automatic refresh.
- All pending learner messages, including discussion posts, use the same persistent outbox. A permanent server rejection remains visibly blocked in the queue; it is not silently dropped. Users may explicitly discard an item or retry after a teacher correction.
- The v9 portal does not import legacy records into new authenticated identities, relabel them as v9 attempts, or rewrite existing grades. They remain visible in Legacy history.

## SCORM behavior and limits

A protected SCORM 1.2 adapter initializes the LMS, restores compatible suspend data, and saves drafts/exit state without letting LMS errors break local coursework. It never writes `cmi.core.score.*` or claims gradebook synchronization. Teacher preview is not a graded student attempt.

When serialized draft data fits within 3,900 characters, it is placed in `cmi.suspend_data`; otherwise only a compact summary is sent to the LMS and full writing remains in local browser storage. The user is told to download a draft backup. Browser storage can be blocked or cleared and cannot guarantee cross-device resume. No service worker is installed on the shared LMS content origin. Already-loaded content is API-independent, not a promise that Schoology can launch during an LMS outage.

## Dates, feedback, and identity

Due and cutoff dates are initially blank; the portal cannot fetch Schoology dates. Once configured, server receipt time determines lateness and cutoff. A late reviewed score is capped at 50% unless the teacher explicitly waives the cap. After-cutoff submissions remain local and require a revised assignment/deadline process; per-participant cutoff extensions are not implemented in this release. A draft's client timestamp is never treated as trusted evidence of on-time submission.

Feedback suggestions are a static teacher review checklist, not AI evaluation or correctness scoring. A teacher must enter criterion scores. Real student identity, enrollment, school SSO, native Schoology discussions, student-grade privacy under verified identities, comprehensive retention rules, and production security review remain required before real use.

## Tests

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
node --check static/app.js
node --check static/board.js
node --check scorm/learner.js
bash -n install.sh install-remote.sh
```

Optional Playwright tests:
- `tests/browser_dom_smoke.py` renders the real UI in Chromium with in-memory fetch/LMS stubs. It checks controls, editing, responsive widths, queues, preview write boundaries, and simulated outage behavior. It is not a real network/LMS test.
- `tests/browser_network_smoke.py` exercises HTTP plus browser behavior in an unrestricted local test environment. It passed in WSL on 2026-11-11 using temporary synthetic data and localhost HTTP. It does not establish live Schoology or appliance acceptance. Do not disable organizational browser policy to run it. Set `CHROMIUM_PATH` when needed and `PORTAL_TEST_OUTPUT` to select a screenshot directory.

See `VALIDATION.md` for the actual delivered test evidence and untested deployment boundaries.

## References used in implementation

- Python SQLite connection transactions and online backup: https://docs.python.org/3/library/sqlite3.html
- Browser preflight and exact-origin CORS behavior: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
- SCORM 1.2 runtime data model: https://scorm.com/scorm-explained/technical-scorm/run-time/run-time-reference/

These references describe underlying APIs. They do not certify this pilot against Schoology or constitute live deployment results.
