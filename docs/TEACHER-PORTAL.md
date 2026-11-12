# RoomGoblin teacher portal

The native workspace at `/learn` is the single teacher entry for
assignments, discussion review, classroom sessions, class accounts and setup.
The retired `/learn/teacher`, `/learn/platform`, student discussion, companion and
old SCORM launcher pages return 404. They do not redirect. Students use the
[direct API package](DIRECT-ASSIGNMENT-API.md) inside their LMS. An explicitly
authorized [fresh start](LEARNING-FRESH-START.md) removes obsolete learning data;
normal updates never reset records.

## Ownership and implementation

`src/learning-teacher-portal.js` supplies class-scoped API projections, submission
reviews, controls, and exports. `public/learn` owns the browser workspace.
The module uses RoomGoblin's existing authenticated learning routes, active SQLite
database, teacher class membership, mutation freeze and HTTP writer tracking.
There is no second Python service, database, shared teacher token, or public
teacher listener. Assignment pause/hint/stage commands cannot dispatch hardware. The Classroom
view retains the existing authenticated, presence-gated session/effect APIs.

The reference was a Python/SQLite synthetic-data demonstration, not a qualified
student service. Its shared demo key, fixed lesson, fake actors, global control
row, and keyword-based demonstration grading are deliberately replaced by native
private participant capabilities, selectable classes/assignments, and teacher review.
The prototype's restart failure came from a positional four-value insert after
its commands table gained a fifth column. Native portal persistence uses named
columns, no startup seed insert, and regression coverage for an extended schema.
No prototype database or production credentials are bundled or imported.

## Direct assignment reporting

Use [Direct assignment API](DIRECT-ASSIGNMENT-API.md) for new SCORM assignments.
Learners register automatically; reports, pause/hint/stage, automatic responses
and AI grading use API calls. No preapproved roster, signed launch or companion
window is needed. Written discussions keep the existing rubric. Other written
submissions use a teacher-configured AI rubric, with private server-side feedback
and teacher correction. New assignments use direct API delivery.

## Daily use

1. Sign in with an enabled RoomGoblin teacher account. The shared class selector
   prefers explicit bookmarks, a remembered class, the active timetable class,
   then recent activity. Empty imported classes are grouped under Other classes.
2. **Overview** combines SCORM events and discussion posts in a recent timeline.
3. **Assignments** creates an assignment and its connector atomically. Expand an
   assignment for direct API packages, AI rubrics, availability, pause/hint/stage,
   possible points, package downloads, assessment policies, exceptions and continuing-campaign links.
   Written discussions stay at 20 points. Participant access is assignment-scoped and enrollment is automatic.
4. **Submissions & grading** reviews written SCORM answers privately. These review
   annotations are returned privately to direct API packages; their native SCORM
   attempt applies the saved score. Legacy review annotations do not independently
   call the Schoology gradebook. Written discussions
   use the existing rubric, freshness checks, approved receipt and LMS sync path.
   Changed writing is shown as superseded until a fresh assessment is available.
5. **Discussions** groups replies under their parent posts. Filter by assignment
   for its saved thread (up to 1,000 posts); the all-class view is a recent sample.
   Teachers can reply, post a class update, moderate and revise teacher responses.
   Response edits check their revision before saving.
6. **Classroom** retains manual/automatic sessions, attendance, first-name boards,
   class-filtered campaigns, approved celebrations and aggregate suggestions.
   Creating a celebration or campaign requires an explicit configured target.
   Existing display dedication, signed identity and presence rules are unchanged.
7. **Classes & accounts** manages classes and student access. Administrators can
   create restricted student accounts and assign eligible existing accounts.
8. **Setup** is administrator-only: isolated student connection, timetable mapping,
   writing-grading service and independent AI/media shortcuts. Connection settings and the grading service save independently. Secrets stay server-side and clear from forms.
9. **Audit** shows recent class actions, including membership and class creation.
   CSV export is in Submissions & grading and contains private class records.

The page polls every eight seconds while visible. Drafts survive polling, saving
another form and moving between views. Switching classes, explicit refresh and
sign-out ask before discarding drafts. Drafts disable automatic class following;
re-enable Follow timetable after saving/discarding them. Class switches and session
loss retire pending reads, and sign-out/expiry clears private DOM before another
account can enter. Concurrent review/control/teacher-response edits conflict
rather than overwrite a newer save. Read timeouts never retry mutations.

Recent lists are bounded: 80 events/actions, 100 submissions, discussions and
written reviews, 200 assignments, 500 classes. Review-needed counts reflect the
recent review sample. CSV exports up to 5,000 submissions, newest first; cells
are quoted and formula prefixes neutralized. Schoology remains the gradebook.

## Written SCORM submissions

After including its direct API config and SDK, an assignment may explicitly send:

```js
RoomGoblinSCORM.submit({
  allocation: 'My storage plan and supporting evidence.',
  backup: 'How the plan protects existing data.'
}, 75); // provisional percentage; assignment possible points come from the server

window.addEventListener('roomgoblin:control', ({detail}) => {
  // detail: {version, paused, hint, stage}; update this assignment's own UI.
});
```

Submission answers are 1–12 named text fields, at most 80 characters per field
name, 2,000 characters per answer, and 16,000 UTF-8 bytes combined. Percentage
scores must be finite numbers from 0 to 100. The SDK uses its existing
learner-bound, idempotent retry queue; it does not write another LMS score or
invent identity from a SCORM name. An uploaded package must include the updated
SDK to use these additions. Existing packages do not automatically send answers.

The direct SDK polls only the current participant's allowed activity state.
Control messages retain exact-origin, source-window, nonce and activity checks.
No teacher endpoint is added to the public student gateway. Pausing admission is
server-enforced even if the package ignores the optional browser control event.

## API and storage

All routes below are under `/api/v1/learning`, require teacher capability and
class membership, and are unavailable through the student listener:

| Method and path | Purpose |
| --- | --- |
| `GET /teacher/classes` | Owned class catalog with activity/learner counts |
| `POST /teacher/classes/:id/assignments` | Atomic assignment and connector creation |
| `PUT /teacher/connection-settings` | Administrator-only atomic gateway/origin settings |
| `GET /teacher/classes/:id` | Bounded class overview, assignments, submissions, discussions and audit |
| `GET /teacher/classes/:id/export` | Private, formula-safe submission CSV |
| `PUT /teacher/activities/:id/command` | `{version, paused, stage, hint}` with revision conflict detection |
| `PUT /teacher/submissions/:id/review` | `{revision, score, feedback}` for a numeric submission signal ID |

The additive `learning_portal_commands` and `learning_portal_reviews` tables live
in the canonical RoomGoblin database and follow its ordinary backup/recovery
identity. Written submissions use `learning_signals` with `kind: 'submission'`.
No destructive schema or data migration is required. To roll back, unpause any
assignments before reverting code, retain the database, and use the normal
exact-commit updater with its backup. Older code can ignore the additive records.

## Verification and deployment

Run `npm run check`, `node --test test/learning-teacher-portal.test.js
test/learning-sdk.test.js`, and `node test/browser/learning-teacher-portal-smoke.cjs`,
`node test/browser/learning-platform-smoke.cjs`,
`node test/browser/learning-workspace-regression.cjs`,
`node test/browser/learning-direct-smoke.cjs` with Playwright and Microsoft Edge
available. The Python browser suite covers timetable setup, pause/resume and
draft-protected class following in Chromium and Firefox. On Windows run the full supported
`py -3.11 C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py` validation too.

GitHub publication is separate from deployment. Live Schoology launches, updated
uploaded SDKs, actual student submissions, browser policies and gradebook results
still require acceptance. This feature does not deploy, stop, or migrate the
external prototype and does not import its synthetic records. Site-specific
inventory and source captures remain private local operational records.
