# Learning workspace consolidation

## Review scope

Review the protected teacher portal, classroom setup, legacy learning management
entry, their APIs and the related student discussion/SCORM flows. Live browser
inspection is read-only; test writes use isolated synthetic SQLite fixtures.
No live learner grades, enrollment, campaigns, room sessions or physical devices
are changed by validation. Existing records and compatibility identifiers remain.

## Findings and resolution

| Finding | Resolution |
| --- | --- |
| Three overlapping teacher interfaces with separate selectors | One portal, shared class context, context-preserving legacy redirects |
| Assignment setup leaves the selected assignment | Configure directly inside each assignment |
| Empty old classes can be the initial selection | Explicit/remembered/current/recent selection; empty classes grouped separately |
| Overview counts signals but omits discussion activity | Combined bounded SCORM/discussion timeline |
| Flat discussions lose parent context | Thread grouping, assignment filtering, class updates and revision-checked edits |
| Campaigns shown across unrelated classes | Show campaigns linked to the selected class |
| Polling/save can replace an unrelated draft | Draft ownership across views and forms; explicit discard before class changes |
| Late reads can restore an old class or account | Context ownership and session-epoch checks; private DOM cleared on expiry |
| Provider form discards approved grade-service origins | Retain and edit the saved list explicitly |
| Grading form overwrites gateway origin settings | Omitted origin fields preserve current values |
| Connector creation and configuration can partially succeed | Transactional assignment/connector creation |
| Gateway settings and origins save separately | Single administrator-only transactional save |
| Obsolete teacher editor remains in student discussion page | Remove teacher desk/review/settings code; teacher bookmarks redirect |
| Duplicate platform scripts/styles and malformed separator | Remove retired assets and duplicate navigation |

## Validation

Supported full validation on Windows is:

```powershell
py -3.11 C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py
```

Focused API tests are in `test/learning-teacher-portal.test.js`; synthetic Edge
checks include `learning-teacher-portal-smoke.cjs`, `learning-platform-smoke.cjs`,
`learning-workspace-regression.cjs`, `learning-os-smoke.cjs` and
`learning-smoke.cjs` under `test/browser/`. The discovered
Python browser suite tests timetable mapping, pause/resume, draft protection and
optional service failure in Chromium and Firefox. The native teacher UI is also
inspected in a separate in-app tab. Exact executed outcomes belong in the PR and
private operational validation record; this document is not live LMS acceptance.

## Deployment and rollback

Merge through checked main and publish exact-revision images. Use the native
main updater with its mandatory SQLite-safe operational backup and automatic
rollback. Verify canonical database health, source/image identity, services,
old URL redirects and teacher/student route boundaries afterward. No database
reset or destructive migration is needed. Retain runtime configuration and
learner data when reverting to the previous exact commit. Unpause assignments
before rolling back beyond support for teacher pause controls.

## Remaining acceptance

Actual Schoology launch/pop-up/frame policies, real gradebook writes, production
model calibration and physical classroom effects require separate operator
acceptance. Synthetic tests do not establish those outcomes. The external Python
prototype is historical reference and is not restarted, deployed or migrated.
