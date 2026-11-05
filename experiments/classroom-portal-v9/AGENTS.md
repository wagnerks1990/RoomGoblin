# AI / contributor context: isolated classroom portal v9

This directory is an experimental Python standard-library application, **not** the RoomGoblin Hub or its signed LMS gateway. Product name: RoomGoblin Classroom Portal. Retain Kyle Wagner attribution. Keep public source generic; no school hosts, real tokens, database records, names, or deployment IPs.

## Compatibility

- Preserve `/portal/`, existing v8 service/path identifiers, bind/port configuration and separate administrator token. Preserve `schoology-api-test` and its 8765 listener; never repoint that hostname to the Hub.
- Never write `events.sqlite3` from v9. Legacy history is explicitly read-only. V9 uses `classroom-v9.sqlite3` and schema meta version 1. Back up through SQLite's backup API before migration.
- No physical devices, displays, lights, sound, announcements, scheduler, native signed-LTI connection or RoomGoblin production updater are modified by this pilot. Aggregate web display is not a device-control integration.

## Boundaries

Teacher token signs in to a bounded eight-hour in-memory HttpOnly session; teacher mutations require exact configured Origin and CSRF. Learner and aggregate-display capabilities are generated on export, hashed at rest, revocable and scoped to an assignment. No admin/shared demo credential belongs in generated learner ZIPs. These capabilities are **not verified student identity** and do not replace a future approved authentication process.

Each assignment belongs to one class. New commands never read the legacy global command row. Pause requires an expiring server duration and a short client connection lease. Optional server failure must release the local pause. Do not introduce a mandatory online gate for core instruction or local submission.

Acknowledge events only after commit. Preserve canonical-digest duplicate checks, all-or-nothing batch transactions, explicit blocked-queue state, scope-derived identity, revision conflicts, hidden-descendant moderation, published-only private reviews and CSV formula neutralization. Never hide persistence failures behind a success counter.

SCORM draft persistence is bounded and preview-safe. Do not claim all LMS fields are mirrored or grades are passed back: this release deliberately does neither. No numeric correctness score is inferred from response length/keywords. The static checklist is only a teacher aid.

## Validation

Run all `tests/test_*.py`, JavaScript syntax and shell syntax checks. Run offline browser DOM tests when Playwright/Chromium is available, and real-network browser tests only where browser policy allows. Never disable enterprise policy or claim mocked tests are live Schoology tests. Update README, SECURITY, CHANGELOG, VALIDATION, and corresponding repository docs/wiki pages when behavior changes.

Installer cutover must be bounded, preserve data and automatically roll back code/config on health failure. Never print portal tokens. Changes to systemd, NPM, firewall or DNS outside the isolated portal need separate review. The optional exact-match v6 SQL INSERT repair is documented and must not restart the API.
