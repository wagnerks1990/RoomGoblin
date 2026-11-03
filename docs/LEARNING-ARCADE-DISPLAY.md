# Dedicated arcade display

The native receiver shows a featured leader, eight ranked rows, arcade points,
level/stage badges, question progress and last saved checkpoint status. Pages
rotate every 15 seconds and the server refreshes every five seconds. First names
and completion are public; grades, responses, learner IDs and game memory are not.
"Just saved" means a checkpoint arrived within two minutes, not proof that a
student is online or physically present. The original vector gorilla illustration
ships with this view; no game ROM, sprite extraction or third-party font is bundled.
Reduced-motion preferences disable movement and score highlights.

Under **Classroom progress → Continuing arcade campaigns**, enable **Dedicate this
display to the scheduled class leaderboard** for an existing campaign. This is
an explicit exclusive-content choice, including exclusion from Morning
Announcements. Other receivers retain their normal announcement priority.
The native command router excludes the reserved receiver from ordinary content,
presentations, timers, voice, sound and music-attach writes, including group/all
commands. Identification, reload, setup and music detach remain available for
maintenance. The reservation does not delete receiver enrollment, AV mappings,
groups, saved schedules or historical display state. Physical power and matrix
routing remain operator-managed; keep the receiver's existing native input selected.

An enabled dedicated campaign displays only the currently active linked class's
standings. Existing automatic timetable mapping determines that class, including
Bison meetings mapped to the same learning class. No active class produces a
waiting screen, without resetting or mixing saved learner records. Check Planning
and the learning schedule mappings; do not infer a period from the wall clock.
Ordinary, non-dedicated campaigns keep their combined standings and active-session
requirement. Multiple active mapped sessions display their combined class labels.

The board remains transient. It is never persisted as display content or replayed
over MQTT. It expires after eight seconds without updates; dedicated receiver
reconnects get a generic waiting screen until a fresh update arrives. A stale
checkpoint does not establish presence. Signed updates from anywhere remain a
separate explicit campaign option. Disabling the campaign or reservation restores
normal command eligibility without deleting saved points or schedules.

## Upgrade, verification and rollback

Use the normal backed-up updater with the reviewed exact image pair. The only
schema addition is `learning_arcade_displays`, defaulting to no reservation for
every existing campaign. Older clients that omit the option preserve its value.
Reload the native receiver after deployment so it loads the new renderer assets.
Verify a real learner checkpoint, class transition, waiting state and physical
receiver. Automated browser and router tests do not prove physical TV output.

To roll back the display change, disable its dedicated option before reverting
to the prior image through the standard updater. Retain the database and additive
table; never reset student history or downgrade the schema. The earlier image
does not enforce the new reservation and resumes ordinary display schedules.
