# SCORM classroom progress

SCORM games stay in Schoology and keep their original gradebook behavior.
RoomGoblin can retain signed student progress through a separate restricted
student connection, then show first-name boards and approved celebrations during
a teacher-controlled classroom session.

The Learning teacher desk links to **Classroom progress and celebrations**.
Use [the canonical setup and security guide](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/LEARNING-PLATFORM.md)
for signed Schoology setup, private-subnet presence, attendance, media/light
recipes, local Ollama summaries, rollback and acceptance requirements.

Offsite events save without classroom effects. Old sessions close on restart;
automatic mode can open a fresh current-period session without inherited
attendance or presence proofs. Old events and uncertain deliveries never replay. Writing-grade
qualification and actual Schoology/device acceptance remain separate checks.

## AI tools

Administrators can add existing AI chat and media studio HTTPS browser addresses
under **AI tool links** on the teacher progress page. Teachers open these in
separate tabs using each service's own sign-in. The links do not change signed
Schoology progress, grading, presence, or classroom effects. Clear a URL to hide
its shortcut. Students cannot read or edit this configuration.

Keep the student connection separate. Its root and administrator pages
intentionally return 404; verify the connector and signed Schoology launch.
An AI chat URL cannot replace the student HTTPS origin.

## Automatic classroom setup

Configure **Automatic classroom setup** once to sync RoomGoblin Planning classes
and follow their calendar and timetable. Link existing learning classes before
saving so assignments, signed course bindings and saved work keep their IDs.
Enabled unmapped classes import by stable source ID; removing a Planning class
never deletes learning records. Multiple timetable entries can share one class.

Signed Schoology launches enroll students automatically. SCORM supplies progress;
its names never authorize attendance. Fresh local presence is required for each
classroom event. There is no daily Start, Stop or attendance checklist in automatic
mode. Breaks, remote/no-school days, ambiguous periods and revoked teacher access
suppress effects. Manual mode remains available when automatic setup is off.

The page follows the current class while preserving teacher drafts. **Pause this
class today** lasts through restarts and clears on the next school day. Existing
closed assignments remain closed; reviewed recipes and signed connections are
one-time prerequisites. Timetable failures do not block ordinary progress saves.
Disable automatic mode before feature rollback and retain the additive tables.
