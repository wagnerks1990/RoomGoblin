# Acceptance follow-up and isolated restore drill

On 2026-10-29, the deployed appliance remained healthy on source `36acd449`
with Hub and maintenance runtime revision `fab0e5f7`. Both containers reported
healthy with zero restarts; the control and media health endpoints answered
successfully. Music Assistant 2.10.8 accepted the existing authenticated API
connection and reported the Apple Music provider available.

These are availability checks, not proof of audible playback. The selected
physical test player's Music Assistant state was unavailable. Its enrolled
Android management connection also failed both an ADB state read and a bounded
TCP connection to the saved endpoint. No replacement address or receiver identity
was guessed, and no power, playback, announcement or device mutation was sent.
Live operator acceptance additionally requires an authenticated controller
session. Those conditions remain prerequisites for the physical checks below.

## Isolated restore coverage

The existing maintenance restore fixtures used sentinel database bytes and a
stubbed SQLite command. They qualified archive selection and file replacement,
but could not establish that a restored database remained readable or that its
encrypted values still matched the retained master key.

`test/full-recovery-export.test.js` now also runs the actual maintenance HTTP
backup/restore handlers against temporary, real SQLite databases created by
`ClassroomHubStorage`. The fixture CLI uses Python's SQLite backup API and real
integrity queries. Its application-health adapter opens the current database
read-only, checks integrity and authenticates every encrypted fixture row.

The added cases cover:

- Configuration-only and configuration/data restore of saved settings and
  punctuation-bearing synthetic encrypted values.
- Preservation of the master key and current uploaded media; presentation
  assets follow the requested restore mode.
- A failed post-restore readiness check followed by recovery of the complete
  prior database, encrypted values and presentation asset from the safety backup.
- Retention of that safety backup and removal of the completed transaction journal.

The focused active-worktree Linux run passed all 23 maintenance recovery cases
and all 23 native Host Agent recovery cases, with no failures or skips. These
fixtures replace Docker/Host Agent operations with adapters; they do not restart
production services, copy production identities, or qualify a replacement host.
The full checked-commit results and deployment receipt belong to the associated
pull request. No runtime restore behavior or schema is changed by this addition.

## Remaining physical acceptance

Once the selected receiver is reachable and the operator session is available,
verify Apple Music playback, low-volume adjustment, pause and resume; then verify
Morning Announcements take priority and release into the current schedule before
music resumes. Presentation start, preview isolation, persistent video controls,
TV routing/power schedules and selected managed-device/integration commands need
their own observed outcomes and restoration of changed settings.

Optional unconfigured integrations and the Windows daily-code sign-in pilot are
separate qualification work. A normal Hub update must not install or activate
that pilot on Windows. The documented later-loop scheduler recovery limit also
remains unchanged. This follow-up does not assert physical acceptance or a
whole-repository line-by-line review.
