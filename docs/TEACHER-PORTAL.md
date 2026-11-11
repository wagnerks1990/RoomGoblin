# RoomGoblin teacher portal

The native teacher workspace at `/learn/teacher/` replaces the earlier teacher
landing experience with the six-tab workflow from the isolated Schoology API
prototype: Overview, Assignments, Submissions & grading, Discussions, Classroom
controls, and Audit. A teacher opening `/learn/` without a selected activity is
sent here. Student assignments still open their own discussion or SCORM package.

## Ownership and implementation

`src/learning-teacher-portal.js` supplies class-scoped API projections, submission
reviews, controls, and exports. `public/learn/teacher/` owns the browser workspace.
The module uses RoomGoblin's existing authenticated learning routes, active SQLite
database, teacher class membership, mutation freeze and HTTP writer tracking.
There is no second Python service, database, shared teacher token, or public
teacher listener. Classroom hardware is outside this portal's command API.

The reference was a Python/SQLite synthetic-data demonstration, not a qualified
student service. Its shared demo key, fixed lesson, fake actors, global control
row, and keyword-based demonstration grading are deliberately replaced by native
signed learner identity, selectable classes/assignments, and teacher review.
The prototype's restart failure came from a positional four-value insert after
its commands table gained a fifth column. Native portal persistence uses named
columns, no startup seed insert, and regression coverage for an extended schema.
No prototype database or production credentials are bundled or imported.

## Daily use

1. Sign in using an enabled RoomGoblin teacher account. Choose an assigned class.
   **Manage classes & accounts** handles class creation and student membership.
2. **Overview** shows event/submission/discussion counts and recent signed activity.
3. **Assignments** lists class assignments and creates SCORM connections or the
   supported written discussions. **Connections & setup** configures signed LMS
   launches, networking, optional boards/effects, and the timetable.
4. **Submissions & grading** displays written SCORM answers and provisional scores.
   Teachers record a private score and feedback for each submission. These records
   do not automatically change a Schoology grade. Written discussions instead use
   the existing rubric, freshness check, approved-grade receipt and LMS sync path.
5. **Discussions** shows posts/replies and permits teacher replies and moderation.
6. **Classroom controls** saves pause, stage (1–20), and hint (300 characters maximum)
   for one assignment. Pause rejects new student writes; it does not stop a game
   engine, alter another assignment, or send physical device commands. A connected
   package can react to stage/hint messages as described below. Resume permits
   retained client work to retry through the normal event admission checks.
7. **Audit** shows recent actions for the selected class. CSV export contains
   private class submissions and teacher feedback; keep downloads private.

The page refreshes every eight seconds, while visible. Unsaved forms remain open
and prevent background replacement of editable sections. Switching classes,
refreshing explicitly, or signing out asks before discarding drafts. Concurrent
review/control edits return a conflict rather than silently overwriting a newer
teacher save. Recent lists are bounded (80 events/actions, 100 submissions,
discussions and written reviews, 200 assignments); CSV exports at most 5,000
submissions, newest first. CSV cells are quoted and formula prefixes neutralized.

## Written SCORM submissions

After configuring the normal signed connector, an assignment may explicitly send:

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

The signed companion polls only the current learner's allowed activity state.
Control messages retain exact-origin, source-window, nonce and activity checks.
No teacher endpoint is added to the public student gateway. Pausing admission is
server-enforced even if the package ignores the optional browser control event.

## API and storage

All routes below are under `/api/v1/learning`, require teacher capability and
class membership, and are unavailable through the student listener:

| Method and path | Purpose |
| --- | --- |
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
test/learning-sdk.test.js`, and `node test/browser/learning-teacher-portal-smoke.cjs`
with Playwright and Microsoft Edge available. On Windows run the full supported
`py -3.11 C:\ChatGPT\Workspace\Tools\RoomGoblin-LinuxTests.py` validation too.

GitHub publication is separate from deployment. Live Schoology launches, updated
uploaded SDKs, actual student submissions, browser policies and gradebook results
still require acceptance. This feature does not deploy, stop, or migrate the
external prototype and does not import its synthetic records. Site-specific
inventory and source captures remain private local operational records.
