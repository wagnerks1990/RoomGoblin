# SCORM classroom progress

SCORM games stay in Schoology and keep their original gradebook behavior.
RoomGoblin can retain signed student progress through a separate restricted
student connection, then show first-name boards and approved celebrations during
a teacher-controlled classroom session.

The Learning teacher desk links to **Classroom progress and celebrations**.
Use [the canonical setup and security guide](https://github.com/wagnerks1990/RoomGoblin/blob/main/docs/LEARNING-PLATFORM.md)
for signed Schoology setup, private-subnet presence, attendance, media/light
recipes, local Ollama summaries, rollback and acceptance requirements.

Offsite events save without classroom effects. Live sessions end on restart,
and old events or uncertain deliveries are never replayed. Writing-grade
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
